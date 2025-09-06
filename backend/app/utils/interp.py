# Interpolate circular direction (degrees, 0..360) via vector-aware average

def lerp(a, b, w):
    return a + (b - a) * w

def interp_dir(t0, t1, d0, d1, t):
    if t1 == t0:
        return d0
    w = (t - t0) / (t1 - t0)
    # convert meteo "from" dir to unit vectors (towards direction)
    import math
    r0 = math.radians(d0)
    r1 = math.radians(d1)
    u0 = -math.sin(r0); v0 = -math.cos(r0)
    u1 = -math.sin(r1); v1 = -math.cos(r1)
    u = lerp(u0, u1, w); v = lerp(v0, v1, w)
    ang = (math.degrees(math.atan2(-u, -v)) + 360) % 360
    return ang
