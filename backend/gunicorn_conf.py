import multiprocessing, os
bind = "0.0.0.0:8000"
workers = int(os.getenv("GUNICORN_WORKERS", multiprocessing.cpu_count()*2+1))
worker_class = "uvicorn.workers.UvicornWorker"
timeout = int(os.getenv("GUNICORN_TIMEOUT", "30"))
graceful_timeout = int(os.getenv("GUNICORN_GRACEFUL_TIMEOUT", "30"))
loglevel = os.getenv("LOG_LEVEL", "info").lower()
accesslog = "-"
errorlog = "-"
