# HI-SE Sync Report (2026-03-06)

## Purpose
- Capture `neo4j_dev_stack` changes made to support stable joint operation with `hi-se-simulator`.

## Changes
- Docker compose port defaults moved to collision-safe profile:
  - API `18080`, UI `15173`, Postgres `15435`
- Added optional local Neo4j service profile (`local-neo`):
  - HTTP `17474`, Bolt `17687`
- Added `docker/.env.example` for explicit runtime variable baseline.
- Updated frontend API fallback default to `http://localhost:18080`.
- Updated backend default CORS/postgres settings for new port profile.
- Updated docker ports documentation.

## Outcome
- With `hi-se` `stack:up`, neo_stacker health is stable and graph projection/topology verification is reproducible even without external Aura credentials.
