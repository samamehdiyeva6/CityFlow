from typing import List, Optional

from pydantic import BaseModel


class NearestStopRequest(BaseModel):
    lat: float
    lon: float
    limit: int = 3


class NearbyRouteOption(BaseModel):
    line_id: str
    mode: str
    destination: Optional[str] = None
    eta_minutes: Optional[int] = None


class StopResponse(BaseModel):
    id: int
    name: str
    lat: float
    lon: float
    type: str
    distance_meters: float
    available_routes: List[NearbyRouteOption]


class NearestTransitResponse(BaseModel):
    user_location: dict
    nearest_bus_stop: Optional[StopResponse] = None
    nearest_metro_station: Optional[StopResponse] = None
    nearby_stops: List[StopResponse]
