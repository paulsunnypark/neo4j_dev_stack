# Stack Upgrade Continuation Plan (Backend/Docker/Docs)

Date: 2026-02-27
Status: In progress

## 1) Completed in this phase

- Backend CORS hardening by configuration:
  - `backend/app/core/config.py`
    - Added `cors_origins` env setting
    - Added parsed `cors_origins_list`
  - `backend/app/main.py`
    - `CORSMiddleware.allow_origins` now reads from settings instead of wildcard

- Docker backend runtime alignment:
  - `docker/docker-compose.yml`
    - Added `CORS_ORIGINS` env for backend
    - Backend healthcheck switched `/docs` -> `/health`

- Frontend test/quality expansion completed earlier and retained:
  - API test mock helper
  - Advanced e2e scenarios (Topology filter, Outbox refresh, Entities CRUD)
  - CI gates for type sync + lint/build/test/e2e

## 2) Why this matters

- Removes permissive wildcard CORS default and makes origin policy explicit.
- Improves container readiness signal by validating operational health endpoint.
- Strengthens regression safety across UI and API integration behavior.

## 3) Next backend upgrades (recommended)

1. Add unit tests for config parsing and CORS application behavior.
2. Add API schema versioning header and changelog policy.
3. Harden auth profile split (dev API key vs production auth mode).

## 4) Next docker upgrades (recommended)

1. Add profile-based compose overlays (`dev`, `ci`, `prod-like`).
2. Add explicit restart policies and tighter resource bounds.
3. Add container-level logging/retention defaults.

## 5) Next docs upgrades (recommended)

1. Update runbook with new frontend quality commands and OpenAPI sync flow.
2. Add troubleshooting for Playwright/browser install in CI and local.
3. Add stack upgrade changelog section linking reports 12 and 13.
