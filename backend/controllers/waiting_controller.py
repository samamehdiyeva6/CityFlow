from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
import models
from schemas.waiting import WaitSuggestionRequest, WaitSuggestionResponse
from services.waiting_bonus_service import waiting_bonus_service

router = APIRouter(prefix="/api/v1/waiting", tags=["waiting"])


@router.post("/suggest", response_model=WaitSuggestionResponse)
async def suggest_wait_bonus(payload: WaitSuggestionRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return waiting_bonus_service.create_wait_suggestion(
        db=db,
        user_id=user.id,
        route=payload.route,
        start=payload.start,
        end=payload.end,
        selected_time=payload.selected_time,
        origin_lat=payload.origin_lat,
        origin_lon=payload.origin_lon,
    )
