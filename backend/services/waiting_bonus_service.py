import copy
import datetime
import os
import uuid

import models
from services.density_service import density_service


class WaitingBonusService:
    def __init__(self):
        self.wait_seconds = int(os.getenv("WAIT_BONUS_SECONDS", "900"))
        self.min_density_improvement = int(os.getenv("WAIT_BONUS_MIN_IMPROVEMENT", "8"))
        self.max_stability_radius_m = float(os.getenv("WAIT_BONUS_STABILITY_RADIUS_M", "220"))
        self.extra_wait_bonus_points = int(os.getenv("WAIT_BONUS_EXTRA_POINTS", "25"))

    def preview_wait_bonus(self, route: dict, selected_time: str | None, db=None, now=None):
        now = now or datetime.datetime.utcnow()
        future_time = (now + datetime.timedelta(seconds=self.wait_seconds)).strftime("%H:%M")
        current_density = density_service.estimate_route_density(route, desired_time=selected_time, db=db)
        projected_density = density_service.estimate_route_density(route, desired_time=future_time, db=db)
        current_score = int(route.get("crowding", current_density["score"]) or current_density["score"])
        should_wait = projected_density["score"] <= current_score - self.min_density_improvement

        return {
            "should_wait": should_wait,
            "current_density_score": current_score,
            "projected_density_score": int(projected_density["score"]),
            "density_improvement": int(current_score - projected_density["score"]),
            "wait_seconds": self.wait_seconds,
            "bonus_points": self.extra_wait_bonus_points,
            "recommended_departure_at": (now + datetime.timedelta(seconds=self.wait_seconds)).isoformat(),
        }

    def create_wait_suggestion(self, db, user_id: int, route: dict, start: str | None, end: str | None, selected_time: str | None, origin_lat: float, origin_lon: float):
        now = datetime.datetime.utcnow()
        preview = self.preview_wait_bonus(route=copy.deepcopy(route), selected_time=selected_time, db=db, now=now)

        session = models.WaitBonusSession(
            user_id=user_id,
            session_id=f"wait-{uuid.uuid4().hex[:12]}",
            route_id=str(route.get("id", "")),
            route_number=str(route.get("route_number", "")),
            start_location=start or route.get("start"),
            end_location=end or route.get("end"),
            origin_lat=float(origin_lat),
            origin_lon=float(origin_lon),
            current_density_score=preview["current_density_score"],
            projected_density_score=preview["projected_density_score"],
            suggested_at=now,
            recommended_departure_at=now + datetime.timedelta(seconds=self.wait_seconds),
            status="PENDING",
        )
        db.add(session)
        db.commit()

        return {
            "session_id": session.session_id,
            **preview,
        }

    def verify_wait_bonus(self, db, user_id: int, wait_session_id: str, route: dict):
        session = (
            db.query(models.WaitBonusSession)
            .filter(
                models.WaitBonusSession.session_id == wait_session_id,
                models.WaitBonusSession.user_id == user_id,
            )
            .first()
        )
        if not session:
            return False, "Waiting session tapılmadı.", 0

        if session.status == "VERIFIED":
            return True, "Waiting bonus artıq təsdiqlənib.", self.extra_wait_bonus_points

        now = datetime.datetime.utcnow()
        if now < session.recommended_departure_at:
            remaining = int((session.recommended_departure_at - now).total_seconds())
            return False, f"Gözləmə tamamlanmayıb. {remaining} saniyə qalıb.", 0

        if str(route.get("id", "")) != (session.route_id or "") and str(route.get("route_number", "")) != (session.route_number or ""):
            return False, "Bonus üçün tövsiyə olunan route izlənməyib.", 0

        cutoff = session.suggested_at
        pings = (
            db.query(models.RealtimeLocationPing)
            .filter(
                models.RealtimeLocationPing.session_id == session.session_id,
                models.RealtimeLocationPing.timestamp >= cutoff,
                models.RealtimeLocationPing.trip_status == "WAITING",
            )
            .order_by(models.RealtimeLocationPing.timestamp.asc())
            .all()
        )
        if len(pings) < 2:
            return False, "GPS gözləmə məlumatı kifayət deyil.", 0

        stable = all(
            density_service._distance_km(session.origin_lat, session.origin_lon, ping.lat, ping.lon) * 1000 <= self.max_stability_radius_m
            for ping in pings
        )
        if not stable:
            return False, "Gözləmə zamanı başlanğıc nöqtəsindən çox uzaqlaşmısınız.", 0

        session.status = "VERIFIED"
        db.commit()
        return True, "Gözləmə bonusu təsdiqləndi.", self.extra_wait_bonus_points


waiting_bonus_service = WaitingBonusService()
