from typing import Optional

from pydantic import BaseModel


class WaitSuggestionRequest(BaseModel):
    route: dict
    start: Optional[str] = None
    end: Optional[str] = None
    selected_time: Optional[str] = None
    origin_lat: float
    origin_lon: float


class WaitSuggestionResponse(BaseModel):
    session_id: str
    should_wait: bool
    current_density_score: int
    projected_density_score: int
    density_improvement: int
    wait_seconds: int
    bonus_points: int
    recommended_departure_at: str
