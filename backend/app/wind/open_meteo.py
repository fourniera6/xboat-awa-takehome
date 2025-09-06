import httpx

BASE_FORECAST = "https://api.open-meteo.com/v1/forecast"
BASE_ARCHIVE = "https://archive-api.open-meteo.com/v1/archive"

async def fetch_hourly(latlons, start_date: str, end_date: str, use_archive=False):
    lats = ",".join(f"{x:.4f}" for x,_ in latlons)
    lons = ",".join(f"{y:.4f}" for _,y in latlons)
    url = BASE_ARCHIVE if use_archive else BASE_FORECAST
    params = {
        "latitude": lats,
        "longitude": lons,
        "hourly": "wind_speed_10m,wind_direction_10m",
        "timeformat": "iso8601",
        "start_date": start_date,
        "end_date": end_date,
        "wind_speed_unit": "ms",
        "timezone": "UTC",
    }
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(url, params=params)
        r.raise_for_status()
        return r.json()
