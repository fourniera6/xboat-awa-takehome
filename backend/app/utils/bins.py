from typing import Tuple

def bin_latlon(lat: float, lon: float, step: float = 0.05) -> Tuple[float, float]:
    # ~5.5 km at mid‑latitudes; adjust if needed
    b = lambda v: round(v / step) * step
    return (b(lat), b(lon))
