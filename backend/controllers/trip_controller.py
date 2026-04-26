from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
import models
from schemas.trip import TripTrackingPingRequest, TripTrackingResponse, TripTrackingStopRequest
from services.gps_service import gps_service

router = APIRouter(prefix="/api/v1/trips", tags=["trips"])


@router.post("/track", response_model=TripTrackingResponse)
async def track_trip(payload: TripTrackingPingRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return gps_service.record_ping(db, payload, user_id=user.id)


@router.post("/stop")
async def stop_trip_tracking(payload: TripTrackingStopRequest, db: Session = Depends(get_db)):
    gps_service.stop_tracking(db, payload.session_id)
    return {"stopped": True, "session_id": payload.session_id}
