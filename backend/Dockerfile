FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

# Install Python deps (from requirements if present; otherwise minimal set)
COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install --upgrade pip && \
    if [ -f /tmp/requirements.txt ]; then \
        pip install -r /tmp/requirements.txt ; \
    else \
        pip install fastapi uvicorn[standard] gunicorn httpx pydantic pydantic-settings python-multipart orjson cachetools ; \
    fi

# App source
COPY backend/ ./

EXPOSE 8000
CMD ["gunicorn", "-c", "gunicorn_conf.py", "app.main:app"]
