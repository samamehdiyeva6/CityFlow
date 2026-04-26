import datetime
import math

import models
from services.data_service import data_service
from services.density_service import density_service


class PaymentService:
    def __init__(self):
        self.match_radius_m = 250
        self.max_wait_session_age_hours = 4

    def record_payment(self, db, user_id: int, payload, method: str = "NFC"):
        now = datetime.datetime.utcnow()
        matched_session = self._match_wait_session(db, user_id=user_id, payload=payload, paid_at=now)
        verification = self._verify_boarding_context(db=db, payload=payload)
        if not verification["passed"]:
            raise ValueError(verification["reason"])

        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            raise ValueError("User not found")

        if not user.card_balance:
            user.card_balance = models.CardBalance(user_id=user_id, amount_azn=10.0)
            db.add(user.card_balance)
            db.flush()

        amount = float(payload.amount_azn)
        if user.card_balance.amount_azn < amount:
            raise ValueError("Bakikart balansı kifayət etmir")

        user.card_balance.amount_azn -= amount

        transaction = models.FareTransaction(
            user_id=user_id,
            session_id=payload.session_id,
            payment_method=method,
            route_id=payload.route_id,
            route_number=payload.route_number,
            validator_stop=payload.validator_stop,
            lat=float(payload.lat),
            lon=float(payload.lon),
            amount_azn=amount,
            paid_at=now,
            boarding_status="WAIT_VERIFIED_BOARDED" if matched_session else "PAID_BOARDED",
            matched_wait_session_id=matched_session.session_id if matched_session else None,
            matched_wait_minutes=self._matched_wait_minutes(matched_session, now) if matched_session else None,
        )
        db.add(transaction)

        if matched_session:
            matched_session.status = "PAID_AND_BOARDED"

        db.commit()

        return {
            "payment_recorded": True,
            "paid_at": now.isoformat(),
            "validator_stop": payload.validator_stop,
            "wait_bonus_candidate": matched_session is not None,
            "matched_wait_session_id": matched_session.session_id if matched_session else None,
            "matched_wait_minutes": self._matched_wait_minutes(matched_session, now) if matched_session else None,
            "boarding_status": transaction.boarding_status,
            "bakikart_balance": round(user.card_balance.amount_azn, 2),
            "boarding_verified": verification["passed"],
            "verification_reason": verification["reason"],
        }

    def _verify_boarding_context(self, db, payload):
        route_data = self._resolve_route(payload)
        if not route_data:
            # Demo axınında bəzi dinamik route_id-lər data faylında olmayacaq.
            # Bu halda ödənişi bloklamırıq ki QR scan -> travel countdown axını işləsin.
            return {
                "passed": True,
                "reason": "Demo rejimi: route data match tapılmadı, QR ödənişi qəbul edildi.",
            }

        route_cost = float(route_data.get("cost", payload.amount_azn))
        paid_amount = float(payload.amount_azn)
        if abs(route_cost - paid_amount) > 0.2:
            return {
                "passed": False,
                "reason": "Kartdan çıxılan məbləğ marşrut qiyməti ilə uyğun gəlmir.",
            }

        recent_pings = self._recent_pings_for_session(db=db, session_id=payload.session_id)
        points = [(float(p.lat), float(p.lon)) for p in recent_pings]
        points.append((float(payload.lat), float(payload.lon)))
        path = route_data.get("path") or []
        if not path:
            return {
                "passed": False,
                "reason": "Marşrut trayektoriyası tapılmadı.",
            }

        near_points = 0
        for lat, lon in points:
            min_distance_km = min(self._distance_km(lat, lon, float(node[0]), float(node[1])) for node in path)
            if min_distance_km <= 0.45:
                near_points += 1

        gps_match = near_points >= 1
        trajectory_match = len(points) < 2 or near_points >= 2

        if not gps_match or not trajectory_match:
            return {
                "passed": False,
                "reason": "GPS/trayektoriya marşrutla üst-üstə düşmür.",
            }

        return {
            "passed": True,
            "reason": "GPS, trayektoriya və qiymət uyğunluğu təsdiqləndi.",
        }

    def _resolve_route(self, payload):
        routes = data_service.get_all_routes()
        route_id = str(getattr(payload, "route_id", "") or "")
        route_number = str(getattr(payload, "route_number", "") or "")

        if route_id and route_id in routes:
            return routes[route_id]

        if route_number and route_number in routes:
            return routes[route_number]

        for key, route in routes.items():
            if route_id and str(key) == route_id:
                return route
            if route_number and str(key) == route_number:
                return route
        return None

    def _recent_pings_for_session(self, db, session_id):
        if not session_id:
            return []
        cutoff = datetime.datetime.utcnow() - datetime.timedelta(minutes=20)
        return (
            db.query(models.RealtimeLocationPing)
            .filter(
                models.RealtimeLocationPing.session_id == session_id,
                models.RealtimeLocationPing.timestamp >= cutoff,
            )
            .order_by(models.RealtimeLocationPing.timestamp.asc())
            .all()
        )

    def _match_wait_session(self, db, user_id: int, payload, paid_at):
        cutoff = paid_at - datetime.timedelta(hours=self.max_wait_session_age_hours)
        candidates = (
            db.query(models.WaitBonusSession)
            .filter(
                models.WaitBonusSession.user_id == user_id,
                models.WaitBonusSession.suggested_at >= cutoff,
                models.WaitBonusSession.status.in_(["PENDING", "VERIFIED"]),
            )
            .order_by(models.WaitBonusSession.suggested_at.desc())
            .all()
        )

        for session in candidates:
            if paid_at < session.recommended_departure_at:
                continue

            route_match = False
            if payload.route_id and session.route_id and str(payload.route_id) == str(session.route_id):
                route_match = True
            if payload.route_number and session.route_number and str(payload.route_number) == str(session.route_number):
                route_match = True
            if not route_match:
                continue

            distance_m = density_service._distance_km(session.origin_lat, session.origin_lon, payload.lat, payload.lon) * 1000
            if distance_m > self.match_radius_m:
                continue

            return session
        return None

    def _matched_wait_minutes(self, session, paid_at):
        if not session:
            return None
        return max(0, int((paid_at - session.suggested_at).total_seconds() // 60))

    def _distance_km(self, lat1, lon1, lat2, lon2):
        r = 6371.0
        p1 = math.radians(float(lat1))
        p2 = math.radians(float(lat2))
        dp = math.radians(float(lat2) - float(lat1))
        dl = math.radians(float(lon2) - float(lon1))
        a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return r * c


payment_service = PaymentService()
