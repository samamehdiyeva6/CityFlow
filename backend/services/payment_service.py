import datetime

import models
from services.density_service import density_service


class PaymentService:
    def __init__(self):
        self.match_radius_m = 250
        self.max_wait_session_age_hours = 4

    def record_nfc_payment(self, db, user_id: int, payload):
        now = datetime.datetime.utcnow()
        matched_session = self._match_wait_session(db, user_id=user_id, payload=payload, paid_at=now)

        transaction = models.FareTransaction(
            user_id=user_id,
            session_id=payload.session_id,
            payment_method="NFC",
            route_id=payload.route_id,
            route_number=payload.route_number,
            validator_stop=payload.validator_stop,
            lat=float(payload.lat),
            lon=float(payload.lon),
            amount_azn=float(payload.amount_azn),
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
        }

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


payment_service = PaymentService()
