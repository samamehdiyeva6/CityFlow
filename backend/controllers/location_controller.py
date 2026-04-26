from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from schemas.location import NearestTransitResponse
from services.density_service import density_service
from services.location_service import location_service

router = APIRouter(prefix="/api/v1/locations", tags=["locations"])


@router.get("")
async def get_locations():
    return location_service.get_all_location_options()


@router.get("/nearest", response_model=NearestTransitResponse)
async def get_nearest_transit(lat: float, lon: float, limit: int = 3, db: Session = Depends(get_db)):
    density_service.register_observation(lat, lon, source="nearest-transit")
    return location_service.get_nearest_transit_snapshot(db, lat=lat, lon=lon, limit=limit)
