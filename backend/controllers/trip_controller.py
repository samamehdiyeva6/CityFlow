from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
import models
from schemas.trip import TripTrackingPingRequest, TripTrackingResponse, TripTrackingStopRequest
from services.gps_service import gps_service

router = APIRouter(prefix="/api/v1/trips", tags=["trips"])


def _resolve_user(db: Session, user_email: Optional[str]):
    if user_email:
        credential = (
            db.query(models.SignInCredential)
            .filter(models.SignInCredential.email == user_email.strip().lower())
            .first()
        )
        if credential:
            return db.query(models.User).filter(models.User.id == credential.user_id).first()
    return db.query(models.User).first()


@router.post("/track", response_model=TripTrackingResponse)
async def track_trip(payload: TripTrackingPingRequest, user_email: Optional[str] = None, db: Session = Depends(get_db)):
    user = _resolve_user(db, user_email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return gps_service.record_ping(db, payload, user_id=user.id)


@router.post("/stop")
async def stop_trip_tracking(payload: TripTrackingStopRequest, db: Session = Depends(get_db)):
    gps_service.stop_tracking(db, payload.session_id)
    return {"stopped": True, "session_id": payload.session_id}
