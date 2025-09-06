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

# --- Apparent wind I/O models ---

class ApparentPoint(WindedPoint):
    course_deg: Optional[float] = None          # course over ground (deg, 0=N, cw)
    boat_u_ms: Optional[float] = None           # boat eastward component
    boat_v_ms: Optional[float] = None           # boat northward component
    apparent_wind_speed_ms: Optional[float] = None
    apparent_wind_dir_deg: Optional[float] = None    # meteorological "from"
    awa_deg: Optional[float] = None             # signed angle from bow (-180..+180), + = starboard

class ApparentWindRequest(BaseModel):
    # If wind_* not present, we can fetch via Open-Meteo (auto ERA5→forecast)
    points: List[WindedPoint]
    coord_strategy: Optional[str] = "centroid"       # centroid | start | midpoint
    source_preference: Optional[str] = "auto"        # auto | era5 | forecast
    fetch_wind_if_missing: Optional[bool] = True

class ApparentWindResult(BaseModel):
    source: Optional[str] = None   # "era5" | "forecast" | None (when not fetched)
    lat_used: Optional[float] = None
    lon_used: Optional[float] = None
    start_time: str
    end_time: str
    mapped_count: int
    sample: List[ApparentPoint]
    points: Optional[List[ApparentPoint]] = None
