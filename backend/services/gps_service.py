import datetime
import math

import models
from services.density_service import density_service


class GPSService:
    def record_ping(self, db, payload, user_id=None):
        trip_status = str(getattr(payload, "trip_status", "ACTIVE") or "ACTIVE").upper()
        ping = models.RealtimeLocationPing(
            user_id=user_id,
            session_id=payload.session_id,
            route_id=payload.route_id,
            route_number=payload.route_number,
            trip_status=trip_status,
            lat=float(payload.lat),
            lon=float(payload.lon),
            accuracy_m=float(payload.accuracy_m) if payload.accuracy_m is not None else None,
            speed_mps=float(payload.speed_mps) if payload.speed_mps is not None else None,
            timestamp=datetime.datetime.utcnow(),
        )
        db.add(ping)
        db.commit()

        density_service.register_observation(
            payload.lat,
            payload.lon,
            source="gps-track",
            db=db,
            session_id=payload.session_id,
            route_id=payload.route_id,
            route_number=payload.route_number,
            accuracy_m=payload.accuracy_m,
            speed_mps=payload.speed_mps,
        )

        nearby_users = self.count_nearby_active_users(db, payload.lat, payload.lon, exclude_session_id=payload.session_id)
        density_score = min(100, 18 + nearby_users * 16)
        return {
            "session_id": payload.session_id,
            "tracked": True,
            "nearby_active_users": nearby_users,
            "inferred_density_score": density_score,
        }

    def stop_tracking(self, db, session_id: str):
        cutoff = datetime.datetime.utcnow() - datetime.timedelta(hours=6)
        (
            db.query(models.RealtimeLocationPing)
            .filter(
                models.RealtimeLocationPing.session_id == session_id,
                models.RealtimeLocationPing.timestamp >= cutoff,
            )
            .update({"trip_status": "STOPPED"}, synchronize_session=False)
        )
        db.commit()

    def count_nearby_active_users(self, db, lat: float, lon: float, exclude_session_id: str | None = None):
        cutoff = datetime.datetime.utcnow() - datetime.timedelta(minutes=10)
        query = db.query(models.RealtimeLocationPing).filter(
            models.RealtimeLocationPing.timestamp >= cutoff,
            models.RealtimeLocationPing.trip_status.in_(["ACTIVE", "WAITING"]),
        )
        if exclude_session_id:
            query = query.filter(models.RealtimeLocationPing.session_id != exclude_session_id)

        latest_by_session = {}
        for ping in query.all():
            current = latest_by_session.get(ping.session_id)
            if not current or ping.timestamp > current.timestamp:
                latest_by_session[ping.session_id] = ping

        count = 0
        for ping in latest_by_session.values():
            if self._distance_km(lat, lon, ping.lat, ping.lon) <= 0.45:
                count += 1
        return count

    def _distance_km(self, lat1, lon1, lat2, lon2):
        r = 6371.0
        p1 = math.radians(float(lat1))
        p2 = math.radians(float(lat2))
        dp = math.radians(float(lat2) - float(lat1))
        dl = math.radians(float(lon2) - float(lon1))
        a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return r * c


gps_service = GPSService()
