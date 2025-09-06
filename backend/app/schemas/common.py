from pydantic import BaseModel
from typing import List, Optional, Tuple

class Point(BaseModel):
    timestamp: Optional[str]
    lat: Optional[float]
    lon: Optional[float]
    altitude_m: Optional[float] = None
    speed_m_s: Optional[float] = None
    heart_rate_bpm: Optional[int] = None
    cadence_rpm: Optional[int] = None

class ParseResult(BaseModel):
    file_type: str
    num_points: int
    start_time: Optional[str]
    end_time: Optional[str]
    bounds: Optional[Tuple[float, float, float, float]]
    sample: List[Point]
    points: Optional[List[Point]] = None

class WindedPoint(Point):
    wind_speed_10m_ms: Optional[float] = None
    wind_direction_10m_deg: Optional[float] = None
    wind_u10_ms: Optional[float] = None
    wind_v10_ms: Optional[float] = None

class WindForTrackRequest(BaseModel):
    points: List[Point]
    coord_strategy: Optional[str] = "centroid"     # centroid | start | midpoint
    source_preference: Optional[str] = "auto"      # auto | era5 | forecast

class WindForTrackResult(BaseModel):
    source: str
    lat_used: float
    lon_used: float
    start_time: str
    end_time: str
    hourly_count: int
    mapped_count: int
    sample: List[WindedPoint]
    points: Optional[List[WindedPoint]] = None
