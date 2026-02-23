"""
Prometheus 메트릭 정의.
FastAPI에 /metrics 엔드포인트로 마운트.
"""
from prometheus_client import Counter, Gauge, make_asgi_app

OUTBOX_PROCESSED = Counter(
    "outbox_processed_total",
    "Total successfully projected outbox events",
    ["event_type"],
)

OUTBOX_FAILED = Counter(
    "outbox_failed_total",
    "Total failed outbox events",
    ["event_type"],
)

OUTBOX_PENDING = Gauge(
    "outbox_pending_count",
    "Current count of PENDING outbox events",
)

# FastAPI에 app.mount("/metrics", metrics_app) 으로 등록
metrics_app = make_asgi_app()
