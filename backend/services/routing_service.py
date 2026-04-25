import datetime
import heapq
import math
import re
import unicodedata
from collections import defaultdict

from services.data_service import data_service
from services.gemini_service import gemini_service


class RoutingService:
    def __init__(self):
        self.locations = data_service.get_all_locations()
        self.metro_data = data_service.get_metro_data()
        self.traffic = data_service.get_traffic_data()
        self.route_sets = {
            "core": data_service.routes_core,
            "express": data_service.routes_express,
            "suburbs": data_service.routes_suburbs,
            "general": data_service.routes,
        }
        self.node_coords = {}
        self.name_index = {}
        self.edges = defaultdict(list)
        self._build_graph()

    async def find_routes(self, start_name, end_name, desired_time=None):
        if not self.edges:
            self._build_graph()

        start = self._resolve_name(start_name)
        end = self._resolve_name(end_name)
        is_rush = self._is_rush_hour(desired_time)

        matches = []

        # 1) AI suggestion (optional, non-blocking for routing output)
        ai_suggestions = await gemini_service.get_ai_suggestions(start, end, desired_time or "now")
        if ai_suggestions:
            for item in ai_suggestions[:2]:
                matches.append(self._sanitize_external_route(item, start, end))

        # 2) Exact direct routes from all route datasets
        matches.extend(self._find_direct_routes(start, end))

        # 3) Graph-based multi-leg route using full route network + coordinates
        graph_route = self._find_graph_route(start, end)
        if graph_route:
            matches.append(graph_route)

        # 4) Metro direct option when both endpoints are metro stations
        metro_option = self._metro_direct_option(start, end)
        if metro_option:
            matches.append(metro_option)

        # 5) Guaranteed fallback route (never return empty list)
        matches.append(self._build_fallback_route(start, end))

        # Apply rush-hour adjustments and finalize ranking
        for route in matches:
            self._apply_rush_hour_adjustments(route, is_rush)

        deduped = self._dedupe_routes(matches)
        deduped.sort(key=lambda r: (r.get("eta", 9999), r.get("crowding", 100), -r.get("confidence", 0)))
        return deduped[:3]

    def _build_graph(self):
        self.node_coords.clear()
        self.name_index.clear()
        self.edges.clear()

        for info in self.locations.values():
            self._register_node(info.get("name"), (info.get("lat"), info.get("lng")))

        for station in self.metro_data.get("stations", []):
            self._register_node(station.get("name"), (station.get("lat"), station.get("lng")))

        # Build bus edges from all route files using all available coordinates
        for source, routes in self.route_sets.items():
            for route_id, route in routes.items():
                start = route.get("start")
                end = route.get("end")
                path = route.get("path") or []
                if not start or not end:
                    continue

                start_coord = self._resolve_route_endpoint_coord(start, path, 0)
                end_coord = self._resolve_route_endpoint_coord(end, path, -1)

                self._register_node(start, start_coord)
                self._register_node(end, end_coord)

                eta = max(4, int(route.get("eta", 30)))
                cost = float(route.get("cost", 0.6))

                edge = {
                    "route_id": str(route_id),
                    "source": source,
                    "mode": "Bus",
                    "eta": eta,
                    "cost": cost,
                    "path": path,
                }
                self.edges[start].append((end, edge))

                reverse_edge = {
                    **edge,
                    "eta": max(5, int(eta * 1.12)),
                    "path": list(reversed(path)),
                    "source": f"{source}_reverse",
                }
                self.edges[end].append((start, reverse_edge))

        # Build metro sequential graph from station order
        stations = self.metro_data.get("stations", [])
        fare = float(self.metro_data.get("fare", 0.6))
        for i in range(len(stations) - 1):
            a = stations[i]
            b = stations[i + 1]
            a_name = a.get("name")
            b_name = b.get("name")
            if not a_name or not b_name:
                continue

            seg_km = self._distance_km(a.get("lat"), a.get("lng"), b.get("lat"), b.get("lng"))
            eta = max(3, int(seg_km * 3.2 + 2))
            path = [[a.get("lat"), a.get("lng")], [b.get("lat"), b.get("lng")]]

            edge = {
                "route_id": f"M{i+1}",
                "source": "metro",
                "mode": "Metro",
                "eta": eta,
                "cost": fare,
                "path": path,
            }
            self.edges[a_name].append((b_name, edge))
            self.edges[b_name].append((a_name, {**edge, "path": list(reversed(path))}))

    def _find_direct_routes(self, start, end):
        direct = []
        start_key = self._canonical_name(start)
        end_key = self._canonical_name(end)

        for source, routes in self.route_sets.items():
            for route_id, route in routes.items():
                s = route.get("start", "")
                e = route.get("end", "")
                if self._canonical_name(s) == start_key and self._canonical_name(e) == end_key:
                    direct.append(self._format_dataset_route(route_id, route, source, is_return=False))
                elif self._canonical_name(s) == end_key and self._canonical_name(e) == start_key:
                    reversed_route = {
                        **route,
                        "start": route.get("end"),
                        "end": route.get("start"),
                        "path": list(reversed(route.get("path") or [])),
                        "eta": max(5, int(float(route.get("eta", 30)) * 1.12)),
                    }
                    direct.append(self._format_dataset_route(route_id, reversed_route, source, is_return=True))

        return direct

    def _find_graph_route(self, start, end):
        if start == end:
            coord = self._get_coord(start)
            return {
                "id": "same_location",
                "type": "Walk",
                "start": start,
                "end": end,
                "cost": 0.0,
                "eta": 2,
                "path": [coord, coord] if coord else [],
                "explanation": "Başlanğıc və təyinat eyni nöqtədir.",
                "crowding": 0,
                "confidence": 99,
                "bonus_points": 5,
                "route_number": "WALK",
                "line_name": "Walk",
            }

        if start not in self.edges or end not in self.edges:
            return None

        dist = {start: 0}
        heap = [(0, start)]
        prev = {}

        while heap:
            current_cost, node = heapq.heappop(heap)
            if node == end:
                break
            if current_cost > dist.get(node, float("inf")):
                continue

            for nxt, edge in self.edges.get(node, []):
                new_cost = current_cost + edge["eta"]
                if new_cost < dist.get(nxt, float("inf")):
                    dist[nxt] = new_cost
                    prev[nxt] = (node, edge)
                    heapq.heappush(heap, (new_cost, nxt))

        if end not in prev and start != end:
            return None

        segments = []
        cursor = end
        while cursor != start:
            parent, edge = prev[cursor]
            segments.append((parent, cursor, edge))
            cursor = parent
        segments.reverse()

        if not segments:
            return None

        total_eta = sum(seg[2]["eta"] for seg in segments)
        total_cost = sum(seg[2]["cost"] for seg in segments)
        crowding = self._estimate_crowding_from_segments(segments)
        confidence = max(70, 98 - len(segments) * 4)

        bus_ids = [seg[2]["route_id"] for seg in segments if seg[2]["mode"] == "Bus"]
        metro_count = sum(1 for seg in segments if seg[2]["mode"] == "Metro")
        bus_count = sum(1 for seg in segments if seg[2]["mode"] == "Bus")

        if metro_count and bus_count:
            route_type = "Metro+Bus"
        elif metro_count:
            route_type = "Metro"
        else:
            route_type = "Bus"

        full_path = self._merge_segment_paths(segments)
        route_number = bus_ids[0] if bus_ids else "M-Combined"
        line_name = "Metro Line" if metro_count else f"Bus {route_number}"

        return {
            "id": "network_best",
            "type": route_type,
            "start": start,
            "end": end,
            "cost": round(total_cost, 2),
            "eta": int(total_eta),
            "path": full_path,
            "explanation": "Marşrut bütün mövcud data fayllarındakı xətlər və koordinatlar üzərindən hesablanıb.",
            "crowding": crowding,
            "confidence": confidence,
            "bonus_points": 25,
            "route_number": route_number,
            "line_name": line_name,
        }

    def _metro_direct_option(self, start, end):
        stations = {self._canonical_name(s["name"]): s for s in self.metro_data.get("stations", []) if s.get("name")}
        start_station = stations.get(self._canonical_name(start))
        end_station = stations.get(self._canonical_name(end))
        if not start_station or not end_station:
            return None

        km = self._distance_km(
            start_station["lat"],
            start_station["lng"],
            end_station["lat"],
            end_station["lng"],
        )
        eta = max(8, int(km * 3.0 + 4))

        return {
            "id": "metro_direct",
            "type": "Metro",
            "start": start_station["name"],
            "end": end_station["name"],
            "cost": float(self.metro_data.get("fare", 0.6)),
            "eta": eta,
            "path": [[start_station["lat"], start_station["lng"]], [end_station["lat"], end_station["lng"]]],
            "explanation": "Metro stansiyaları arasında birbaşa xətt təklifi.",
            "crowding": 42,
            "confidence": 96,
            "bonus_points": 20,
            "route_number": "M2",
            "line_name": f"{start_station['name']} - {end_station['name']}",
        }

    def _build_fallback_route(self, start, end):
        start_coord = self._get_coord(start)
        end_coord = self._get_coord(end)

        if not start_coord and self.locations:
            first = next(iter(self.locations.values()))
            start_coord = (first.get("lat"), first.get("lng"))
        if not end_coord and self.locations:
            first = next(iter(self.locations.values()))
            end_coord = (first.get("lat"), first.get("lng"))

        km = self._distance_km(
            start_coord[0] if start_coord else 40.40,
            start_coord[1] if start_coord else 49.85,
            end_coord[0] if end_coord else 40.40,
            end_coord[1] if end_coord else 49.85,
        )
        eta = max(12, int(km * 4.5 + 8))

        return {
            "id": "fallback_smart",
            "type": "Bus",
            "start": start,
            "end": end,
            "cost": 0.7,
            "eta": eta,
            "path": [[start_coord[0], start_coord[1]], [end_coord[0], end_coord[1]]] if start_coord and end_coord else [],
            "explanation": "Bu marşrut koordinat əsaslı yaxınlıq və şəbəkə məlumatları ilə avtomatik yaradıldı.",
            "crowding": 35,
            "confidence": 78,
            "bonus_points": 15,
            "route_number": "AUTO",
            "line_name": "Smart fallback",
        }

    def _sanitize_external_route(self, route, start, end):
        return {
            "id": str(route.get("id", "ai_suggestion")),
            "type": str(route.get("type", "AI Suggested")),
            "start": str(route.get("start", start)),
            "end": str(route.get("end", end)),
            "cost": float(route.get("cost", 0.7)),
            "eta": int(route.get("eta", 30)),
            "path": route.get("path", []),
            "explanation": str(route.get("explanation", "AI əsaslı marşrut təklifi.")),
            "crowding": int(route.get("crowding", 35)),
            "confidence": int(route.get("confidence", 90)),
            "bonus_points": int(route.get("bonus_points", 20)),
            "route_number": str(route.get("route_number", "AI")),
            "line_name": str(route.get("line_name", "AI Suggested")),
        }

    def _format_dataset_route(self, route_id, route_info, source, is_return):
        route_type = "Bus"
        if source == "express":
            crowding = 35
        elif source == "suburbs":
            crowding = 30
        elif source == "core":
            crowding = 45
        else:
            crowding = 40

        eta = int(route_info.get("eta", 30))
        explanation = "Məlumat fayllarından birbaşa uyğun marşrut tapıldı."
        if is_return:
            explanation = "Əks istiqamətli marşrut koordinatlarla çevrilərək uyğunlaşdırıldı."

        return {
            "id": str(route_id),
            "type": route_type,
            "start": route_info.get("start"),
            "end": route_info.get("end"),
            "cost": float(route_info.get("cost", 0.6)),
            "eta": eta,
            "path": route_info.get("path", []),
            "explanation": explanation,
            "crowding": crowding,
            "confidence": 94,
            "bonus_points": 20,
            "route_number": str(route_id),
            "line_name": f"Bus {route_id}",
        }

    def _apply_rush_hour_adjustments(self, route, is_rush):
        if not is_rush:
            return
        route["crowding"] = min(99, int(route.get("crowding", 35) + 22))
        route["eta"] = max(1, int(route.get("eta", 20) * 1.25))
        route["bonus_points"] = int(route.get("bonus_points", 0) + 40)
        route["explanation"] = "Pik saat təsiri nəzərə alındı: gecikmiş çıxış bonusu ilə daha rahat səfər mümkündür."

    def _dedupe_routes(self, routes):
        seen = set()
        output = []
        for route in routes:
            key = (
                route.get("type"),
                route.get("start"),
                route.get("end"),
                int(route.get("eta", 0)),
                str(route.get("route_number", "")),
            )
            if key in seen:
                continue
            seen.add(key)
            output.append(route)
        return output

    def _resolve_route_endpoint_coord(self, name, path, idx):
        coord = self._get_coord(name)
        if coord:
            return coord
        if path and isinstance(path, list):
            point = path[idx]
            if isinstance(point, list) and len(point) == 2:
                return (float(point[0]), float(point[1]))
        return None

    def _register_node(self, name, coord):
        if not name:
            return
        canonical = self._canonical_name(name)
        if canonical not in self.name_index:
            self.name_index[canonical] = name
        if coord and canonical not in self.node_coords:
            self.node_coords[canonical] = (float(coord[0]), float(coord[1]))

    def _resolve_name(self, raw_name):
        if not raw_name:
            return raw_name
        canonical = self._canonical_name(raw_name)
        if canonical in self.name_index:
            return self.name_index[canonical]

        for key, value in self.name_index.items():
            if canonical and (canonical in key or key in canonical):
                return value

        return raw_name

    def _get_coord(self, name):
        if not name:
            return None
        canonical = self._canonical_name(name)
        if canonical in self.node_coords:
            return self.node_coords[canonical]

        for info in self.locations.values():
            if self._canonical_name(info.get("name", "")) == canonical:
                return (float(info.get("lat")), float(info.get("lng")))

        for station in self.metro_data.get("stations", []):
            if self._canonical_name(station.get("name", "")) == canonical:
                return (float(station.get("lat")), float(station.get("lng")))

        return None

    def _merge_segment_paths(self, segments):
        merged = []
        for from_node, to_node, edge in segments:
            edge_path = edge.get("path") or []
            if not edge_path:
                from_coord = self._get_coord(from_node)
                to_coord = self._get_coord(to_node)
                edge_path = [[from_coord[0], from_coord[1]], [to_coord[0], to_coord[1]]] if from_coord and to_coord else []

            for point in edge_path:
                if not merged or merged[-1] != point:
                    merged.append(point)
        return merged

    def _estimate_crowding_from_segments(self, segments):
        values = []
        for _, _, edge in segments:
            source = str(edge.get("source", ""))
            if "express" in source:
                values.append(28)
            elif "suburbs" in source:
                values.append(32)
            elif "metro" in source:
                values.append(40)
            else:
                values.append(48)
        if not values:
            return 35
        return int(sum(values) / len(values))

    def _canonical_name(self, value):
        text = str(value or "").strip().lower()
        text = unicodedata.normalize("NFKD", text)
        text = "".join(ch for ch in text if not unicodedata.combining(ch))
        text = re.sub(r"[^a-z0-9 ]+", " ", text)
        text = re.sub(r"\s+", " ", text).strip()
        return text

    def _distance_km(self, lat1, lon1, lat2, lon2):
        if None in (lat1, lon1, lat2, lon2):
            return 0.0
        r = 6371.0
        p1 = math.radians(float(lat1))
        p2 = math.radians(float(lat2))
        dp = math.radians(float(lat2) - float(lat1))
        dl = math.radians(float(lon2) - float(lon1))
        a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return r * c

    def _is_rush_hour(self, time_str=None):
        if not time_str:
            now = datetime.datetime.now().time()
        else:
            try:
                now = datetime.datetime.strptime(time_str, "%H:%M").time()
            except Exception:
                now = datetime.datetime.now().time()

        for rush in self.traffic.get("rush_hours", []):
            try:
                start, end = rush.split("-")
                start_time = datetime.datetime.strptime(start, "%H:%M").time()
                end_time = datetime.datetime.strptime(end, "%H:%M").time()
                if start_time <= now <= end_time:
                    return True
            except Exception:
                continue
        return False


routing_service = RoutingService()
