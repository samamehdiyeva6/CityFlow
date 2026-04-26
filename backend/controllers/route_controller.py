from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from schemas.route import RoutePlanResponse
from services.density_service import density_service
from services.routing_service import routing_service

router = APIRouter(prefix="/api/v1/routes", tags=["routes"])


@router.get("/plan", response_model=RoutePlanResponse)
async def plan_routes(
    start: str | None = None,
    end: str | None = None,
    time: str | None = None,
    origin_lat: float | None = None,
    origin_lon: float | None = None,
    destination_lat: float | None = None,
    destination_lon: float | None = None,
    db: Session = Depends(get_db),
):
    if origin_lat is not None and origin_lon is not None:
        density_service.register_observation(origin_lat, origin_lon, source="route-plan-origin", db=db)
    if destination_lat is not None and destination_lon is not None:
        density_service.register_observation(destination_lat, destination_lon, source="route-plan-destination", db=db)
    return await routing_service.plan_routes(
        start_name=start,
        end_name=end,
        desired_time=time,
        origin_coords=(origin_lat, origin_lon) if origin_lat is not None and origin_lon is not None else None,
        destination_coords=(destination_lat, destination_lon) if destination_lat is not None and destination_lon is not None else None,
        db=db,
    )
