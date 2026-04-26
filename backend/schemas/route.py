from typing import List, Optional

from pydantic import BaseModel


class RoutePlanRequest(BaseModel):
    start: Optional[str] = None
    end: Optional[str] = None
    time: Optional[str] = None
    origin_lat: Optional[float] = None
    origin_lon: Optional[float] = None
    destination_lat: Optional[float] = None
    destination_lon: Optional[float] = None


class RoutePlanResponse(BaseModel):
    origin: dict
    destination: dict
    recommended_routes: List[dict]
