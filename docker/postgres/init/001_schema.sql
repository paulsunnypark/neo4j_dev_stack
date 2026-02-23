-- 이벤트 원장(감사/리플레이)
CREATE TABLE IF NOT EXISTS event_log (
  id            BIGSERIAL PRIMARY KEY,
  event_type    TEXT NOT NULL,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor         TEXT,
  payload       JSONB NOT NULL
);

-- Outbox: Neo4j로 투영할 이벤트 큐
CREATE TABLE IF NOT EXISTS outbox (
  id            BIGSERIAL PRIMARY KEY,
  event_id      BIGINT NOT NULL REFERENCES event_log(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'PENDING',   -- PENDING | PROCESSING | DONE | FAILED
  retry_count   INT  NOT NULL DEFAULT 0,
  last_error    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outbox_status_created ON outbox(status, created_at);
CREATE INDEX IF NOT EXISTS idx_event_type_time ON event_log(event_type, occurred_at);
