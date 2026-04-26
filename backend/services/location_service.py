import math
from typing import List, Optional

import models
from services.data_service import data_service


class LocationService:
    def get_all_location_options(self):
        return data_service.get_all_locations()

    def ensure_seeded_stops(self, db):
        existing = {
            (stop.name, stop.type)
            for stop in db.query(models.Stop).all()
        }

        bus_stops = []
        for info in data_service.get_all_locations().values():
            if not info.get("name") or info.get("lat") is None or info.get("lng") is None:
                continue
            key = (info["name"], "BUS")
            if key in existing:
                continue
            bus_stops.append(
                models.Stop(
                    name=info["name"],
                    lat=float(info["lat"]),
                    lon=float(info["lng"]),
                    type="BUS",
                )
            )
            existing.add(key)

        metro_stops = []
        for station in data_service.get_metro_data().get("stations", []):
            if not station.get("name") or station.get("lat") is None or station.get("lng") is None:
                continue
            key = (station["name"], "METRO")
            if key in existing:
                continue
            metro_stops.append(
                models.Stop(
                    name=station["name"],
                    lat=float(station["lat"]),
                    lon=float(station["lng"]),
                    type="METRO",
                )
            )
            existing.add(key)

        if bus_stops or metro_stops:
            db.add_all(bus_stops + metro_stops)
            db.commit()

    def haversine_distance_meters(self, lat1, lon1, lat2, lon2):
        r = 6371000
        phi1 = math.radians(float(lat1))
        phi2 = math.radians(float(lat2))
        delta_phi = math.radians(float(lat2) - float(lat1))
        delta_lambda = math.radians(float(lon2) - float(lon1))

        a = (
            math.sin(delta_phi / 2) ** 2
            + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return r * c

    def get_available_routes_for_stop(self, stop_name: str):
        canonical = self._canonical_name(stop_name)
        matches = []

        for route_id, route in data_service.get_all_routes().items():
            start = route.get("start", "")
            end = route.get("end", "")
            if canonical in (self._canonical_name(start), self._canonical_name(end)):
                matches.append(
                    {
                        "line_id": str(route_id),
                        "mode": "BUS",
                        "destination": end if canonical == self._canonical_name(start) else start,
                        "eta_minutes": int(route.get("eta", 0) or 0),
                    }
                )

        for station in data_service.get_metro_data().get("stations", []):
            if self._canonical_name(station.get("name", "")) == canonical:
                matches.append(
                    {
                        "line_id": "M1/M2",
                        "mode": "METRO",
                        "destination": "Metro network access",
                        "eta_minutes": 4,
                    }
                )
                break

        return matches[:6]

    def get_nearest_stops(self, db, lat: float, lon: float, stop_type: Optional[str] = None, limit: int = 3):
        query = db.query(models.Stop)
        if stop_type:
            query = query.filter(models.Stop.type == stop_type)

        stops = query.all()
        ranked = sorted(
            stops,
            key=lambda stop: self.haversine_distance_meters(lat, lon, stop.lat, stop.lon),
        )

        result = []
        for stop in ranked[:limit]:
            result.append(
                {
                    "id": stop.id,
                    "name": stop.name,
                    "lat": stop.lat,
                    "lon": stop.lon,
                    "type": stop.type,
                    "distance_meters": round(self.haversine_distance_meters(lat, lon, stop.lat, stop.lon), 1),
                    "available_routes": self.get_available_routes_for_stop(stop.name),
                }
            )
        return result

    def get_nearest_transit_snapshot(self, db, lat: float, lon: float, limit: int = 3):
        nearby = self.get_nearest_stops(db, lat, lon, limit=limit)
        nearest_bus = self.get_nearest_stops(db, lat, lon, stop_type="BUS", limit=1)
        nearest_metro = self.get_nearest_stops(db, lat, lon, stop_type="METRO", limit=1)

        return {
            "user_location": {"lat": lat, "lon": lon},
            "nearest_bus_stop": nearest_bus[0] if nearest_bus else None,
            "nearest_metro_station": nearest_metro[0] if nearest_metro else None,
            "nearby_stops": nearby,
        }

    def _canonical_name(self, value: str):
        return str(value or "").strip().lower()


location_service = LocationService()
