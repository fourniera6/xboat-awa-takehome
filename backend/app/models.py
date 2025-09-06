from pydantic import BaseModel
from typing import List, Optional

class Sample(BaseModel):
    t: str  # ISO UTC
    lat: float
    lon: float
    speed: float  # m/s
    heading: float  # deg, 0=N

class Series(BaseModel):
    track_id: str
    samples: List[Sample]

class WindPoint(BaseModel):
    t: str
    ws: float  # wind speed m/s
    wd: float  # wind dir (from) deg

class AWPoint(BaseModel):
    t: str
    aws: float
    awa: float  # deg relative to heading (-180..180)
    head: float  # along-boat component (+ headwind)
    cross: float # + to starboard

class AWSeries(BaseModel):
    track_id: str
    aws: List[AWPoint]

class Summary(BaseModel):
    duration_s: float
    median_aws: float
    pct_head: float
    pct_tail: float
    pct_cross: float
    hed_m: float  # headwind-equivalent distance
    adj_avg_split_s_per_500: Optional[float] = None
