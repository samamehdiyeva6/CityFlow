import datetime
import math
from collections import deque

from services.data_service import data_service


class DensityService:
    def __init__(self):
        self.traffic = data_service.get_traffic_data()
        self.observations = deque(maxlen=500)
        self.zone_points = {
            "center": (40.3795, 49.8476),
            "koroglu": (40.4177, 49.9189),
            "lokbatan": (40.3251, 49.7332),
        }
        self.zone_score_map = {
            "high": 82,
            "medium": 56,
            "low": 28,
        }

    def register_observation(
        self,
        lat,
        lon,
        source="planner",
        db=None,
        session_id=None,
        route_id=None,
        route_number=None,
        accuracy_m=None,
        speed_mps=None,
    ):
        if lat is None or lon is None:
            return
        self.observations.append(
            {
                "lat": float(lat),
                "lon": float(lon),
                "source": source,
                "session_id": session_id,
                "route_id": route_id,
                "route_number": route_number,
                "accuracy_m": accuracy_m,
                "speed_mps": speed_mps,
                "timestamp": datetime.datetime.utcnow(),
            }
        )

    def estimate_route_density(self, route, desired_time=None, db=None):
        time_score = self._time_based_score(route, desired_time)
        historical_score = self._historical_score(route, db)
        realtime_score = self._realtime_score(route, db=db)
        score = round(time_score * 0.5 + historical_score * 0.3 + realtime_score * 0.2)
        level = self._level_from_score(score)
        confidence = self._confidence_score(route, db, realtime_score)

        return {
            "score": score,
            "level": level,
            "confidence": confidence,
            "components": {
                "time_based": round(time_score, 1),
                "historical": round(historical_score, 1),
                "realtime": round(realtime_score, 1),
            },
            "formula": "50% time-based + 30% historical + 20% real-time",
        }

    def _time_based_score(self, route, desired_time=None):
        if self._is_rush_hour(desired_time):
            base = 84
        elif self._is_shoulder_hour(desired_time):
            base = 58
        else:
            base = 32

        zone_values = []
        for zone_name, zone_level in self.traffic.get("zones", {}).items():
            zone_point = self.zone_points.get(zone_name)
            if not zone_point:
                continue
            if self._route_near_point(route, zone_point, radius_km=2.6):
                zone_values.append(self.zone_score_map.get(zone_level, 45))

        zone_adjustment = sum(zone_values) / len(zone_values) if zone_values else 45
        return min(100, max(0, base * 0.7 + zone_adjustment * 0.3))

    def _historical_score(self, route, db):
        if not db:
            return 35

        try:
            import models
        except Exception:
            return 35

        recent_cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=14)
        journeys = (
            db.query(models.JourneyHistory)
            .filter(models.JourneyHistory.timestamp >= recent_cutoff)
            .all()
        )

        route_number = str(route.get("route_number", ""))
        start = str(route.get("start", ""))
        end = str(route.get("end", ""))
        matched = 0
        corridor = 0

        for journey in journeys:
            details = journey.route_details or {}
            selected_route = details.get("selected_route") or {}
            selected_number = str(selected_route.get("route_number", ""))
            selected_start = str(selected_route.get("start", ""))
            selected_end = str(selected_route.get("end", ""))

            if route_number and selected_number == route_number:
                matched += 1
            elif start and end and (
                (selected_start == start and selected_end == end)
                or (selected_start == end and selected_end == start)
            ):
                matched += 1
            elif start and end and (
                start in {journey.start_location, journey.end_location}
                or end in {journey.start_location, journey.end_location}
            ):
                corridor += 1

        score = min(100, matched * 18 + corridor * 8 + 22)
        return score

    def _realtime_score(self, route, db=None):
        path = route.get("path") or []
        if not path:
            return 18

        fresh_cutoff = datetime.datetime.utcnow() - datetime.timedelta(minutes=20)
        recent = [obs for obs in self.observations if obs["timestamp"] >= fresh_cutoff]

        db_recent = []
        if db:
            try:
                import models

                recent_rows = (
                    db.query(models.RealtimeLocationPing)
                    .filter(
                        models.RealtimeLocationPing.timestamp >= fresh_cutoff,
                        models.RealtimeLocationPing.trip_status == "ACTIVE",
                    )
                    .all()
                )
                latest_by_session = {}
                for row in recent_rows:
                    current = latest_by_session.get(row.session_id)
                    if not current or row.timestamp > current.timestamp:
                        latest_by_session[row.session_id] = row
                db_recent = [
                    {
                        "lat": row.lat,
                        "lon": row.lon,
                        "route_id": row.route_id,
                        "route_number": row.route_number,
                        "timestamp": row.timestamp,
                    }
                    for row in latest_by_session.values()
                ]
            except Exception:
                db_recent = []

        combined = recent + db_recent
        if not combined:
            return 20

        clustered = 0
        same_route = 0
        same_origin = 0
        route_number = str(route.get("route_number", ""))
        route_start = self._first_route_point(route)

        for obs in combined:
            if self._route_near_point(route, (obs["lat"], obs["lon"]), radius_km=0.9):
                clustered += 1
            if route_number and str(obs.get("route_number", "")) == route_number:
                same_route += 1
            if route_start and self._distance_km(obs["lat"], obs["lon"], route_start[0], route_start[1]) <= 0.55:
                same_origin += 1

        return min(100, 16 + clustered * 14 + same_route * 12 + same_origin * 10)

    def _confidence_score(self, route, db, realtime_score):
        confidence = 50
        if route.get("path"):
            confidence += 12
        if route.get("type"):
            confidence += 8
        confidence += 12 if db else 4
        confidence += 12 if realtime_score > 25 else 5
        if route.get("segments"):
            confidence += 8
        return min(99, confidence)

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

    def _is_shoulder_hour(self, time_str=None):
        if not time_str:
            now = datetime.datetime.now().time()
        else:
            try:
                now = datetime.datetime.strptime(time_str, "%H:%M").time()
            except Exception:
                now = datetime.datetime.now().time()

        return (
            datetime.time(7, 0) <= now < datetime.time(8, 0)
            or datetime.time(10, 0) < now <= datetime.time(11, 0)
            or datetime.time(16, 30) <= now < datetime.time(17, 30)
            or datetime.time(20, 0) < now <= datetime.time(21, 0)
        )

    def _route_near_point(self, route, point, radius_km=1.0):
        path = route.get("path") or []
        if not path:
            return False

        for path_point in path:
            if not isinstance(path_point, list) or len(path_point) != 2:
                continue
            if self._distance_km(path_point[0], path_point[1], point[0], point[1]) <= radius_km:
                return True
        return False

    def _first_route_point(self, route):
        path = route.get("path") or []
        for point in path:
            if isinstance(point, list) and len(point) == 2:
                return point
        return None

    def _level_from_score(self, score):
        if score >= 70:
            return "HIGH"
        if score >= 40:
            return "MEDIUM"
        return "LOW"

    def _distance_km(self, lat1, lon1, lat2, lon2):
        r = 6371.0
        p1 = math.radians(float(lat1))
        p2 = math.radians(float(lat2))
        dp = math.radians(float(lat2) - float(lat1))
        dl = math.radians(float(lon2) - float(lon1))
        a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return r * c


density_service = DensityService()
