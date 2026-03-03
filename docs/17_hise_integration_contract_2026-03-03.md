# 17. hi-se to neo_stacker Integration Contract (2026-03-03)

## 목적

- `hi-se-simulator`가 Aura를 직접 붙지 않고, `neo_stacker` API를 통해 그래프를 사용하도록 표준 계약을 정의한다.

## 운영 원칙

- `hi-se`는 도메인 원본(PostgreSQL) 유지.
- 그래프 반영은 `neo_stacker` 이벤트 API를 통해 비동기 투영.
- 테넌시는 반드시 `project_id`로 분리.

## 필수 인증/스코프

- Header: `X-API-Key`
- Payload/Query: `project_id`

## 권장 엔드포인트

1) 단건 이벤트
- `POST /entities`
- `POST /relationships`
- `POST /entities/{entity_id}/status`
- `POST /entities/{entity_id}/attributes`

2) 배치 이벤트 (신규)
- `POST /events/batch`

요청 예시:

```json
{
  "events": [
    {
      "event_type": "EntityCreated",
      "payload": {
        "project_id": "hise-prod",
        "entity_id": "dev-1001",
        "entity_type": "Device",
        "name": "Living Room Light",
        "attributes": {"device_type": "light"}
      },
      "actor": "hi-se"
    }
  ]
}
```

응답 예시:

```json
{
  "event_ids": [101, 102],
  "count": 2,
  "note": "Queued for projection"
}
```

3) 조회/모니터링
- `GET /entities?project_id=...`
- `GET /relationships?project_id=...`
- `GET /stats?project_id=...`
- `GET /outbox?project_id=...`
- `GET /outbox/stats?project_id=...`

## 구현 메모 (hi-se 측)

- `NEO_STACKER_ENABLED=false` 모드에서는 그래프 전송을 건너뛰고 시뮬레이터 핵심 기능만 동작.
- `NEO_STACKER_ENABLED=true`에서만 API 전송/재시도/모니터링 활성화.
- 고빈도 이벤트는 `/events/batch` 우선 사용.
