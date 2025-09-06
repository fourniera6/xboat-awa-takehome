import math

# All angles degrees; wind_dir is meteorological FROM direction

def apparent_from(heading_deg: float, speed: float, wind_speed: float, wind_dir_deg: float):
    th = math.radians(heading_deg)
    tw = math.radians(wind_dir_deg)
    # ambient wind vector components (towards):
    uw = -wind_speed * math.sin(tw)
    vw = -wind_speed * math.cos(tw)
    # boat velocity components (towards)
    uv = speed * math.sin(th)
    vv = speed * math.cos(th)
    ua = uw - uv
    va = vw - vv
    aws = math.hypot(ua, va)
    # apparent wind absolute direction (towards, global frame, 0=N)
    aw_abs = (math.degrees(math.atan2(ua, va)) + 360) % 360
    # relative to heading (-180..180)
    rel = ((aw_abs - heading_deg + 540) % 360) - 180
    head = aws * math.cos(math.radians(rel))
    cross = aws * math.sin(math.radians(rel))
    return aws, rel, head, cross

# Simple wind-adjusted pace heuristic (bounded):
# Remove headwind component influence with a small coefficient, clamp ±10%

def adjusted_speed(speed: float, head_component: float, coeff: float = 0.25):
    adj = speed + coeff * head_component
    # clamp to ±10% of observed speed to avoid unrealistic corrections
    lo, hi = speed * 0.90, speed * 1.10
    return max(lo, min(hi, adj))
