from typing import Optional

from pydantic import BaseModel


class TripTrackingPingRequest(BaseModel):
    session_id: str
    route_id: Optional[str] = None
    route_number: Optional[str] = None
    trip_status: Optional[str] = "ACTIVE"
    start: Optional[str] = None
    end: Optional[str] = None
    lat: float
    lon: float
    accuracy_m: Optional[float] = None
    speed_mps: Optional[float] = None
    selected_time: Optional[str] = None


class TripTrackingStopRequest(BaseModel):
    session_id: str


class TripTrackingResponse(BaseModel):
    session_id: str
    tracked: bool
    nearby_active_users: int
    inferred_density_score: int
