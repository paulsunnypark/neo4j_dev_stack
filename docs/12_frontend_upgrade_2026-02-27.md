# Frontend Upgrade Report (neo_stacker)

Date: 2026-02-27
Status: Completed (planned frontend scope)

## 1. Scope and Goal

- Upgrade `frontend/` into a production-grade UI baseline for neo_stacker.
- Priorities: type safety, API contract alignment, testability, delivery safety, and modular architecture.

## 2. Major Changes

### 2.1 Build/Lint/Type Stabilization

- Resolved TypeScript build blockers (including topology graph path issues).
- Removed unsafe suppressions (`@ts-ignore`) and reduced `any` usage.
- Enforced stable lint/build quality gate baseline.

### 2.2 API Contract and Service Architecture

- Added OpenAPI sync + type generation workflow:
  - `frontend/scripts/sync-openapi.mjs`
  - `npm run sync:openapi`
  - `npm run gen:api-types`
  - `npm run sync:api-types`
- Generated schema types from backend OpenAPI:
  - `frontend/openapi/openapi.json`
  - `frontend/src/api/schema.ts`
- Introduced contract layer:
  - `frontend/src/api/contracts.ts`
- Refactored API calls into domain services:
  - `frontend/src/api/services/entitiesService.ts`
  - `frontend/src/api/services/relationshipsService.ts`
  - `frontend/src/api/services/opsService.ts`
  - `frontend/src/api/services/projectsService.ts`

### 2.3 Error Handling Standardization

- Added shared API domain error mapping:
  - `frontend/src/api/errors.ts`
- Services now map transport errors to domain errors consistently.

### 2.4 Server-State Modernization (TanStack Query)

- Added Query Client bootstrap:
  - `frontend/src/queryClient.ts`
  - `QueryClientProvider` wired in `frontend/src/App.tsx`
- Migrated core server-state pages/features:
  - Projects loading in layout
  - Overview stats/outbox polling
  - Outbox list/stats polling
  - Entities list + mutation invalidate flow

### 2.5 Performance and UX Delivery Improvements

- Applied route-level code splitting with `React.lazy` and `Suspense` in `frontend/src/App.tsx`.
- Build output moved from single large chunk to split route chunks.

### 2.6 Accessibility and UI Interaction Improvements

- Added skip link and navigation labeling in layout.
- Added explicit action labels for entity edit/delete controls.

### 2.7 Test and CI Pipeline

- Added frontend test stack:
  - Vitest + RTL
  - Playwright
- Added/expanded tests:
  - `frontend/src/__tests__/app.smoke.test.tsx`
  - `frontend/src/api/__tests__/errors.test.ts`
  - `frontend/tests/e2e/smoke.spec.ts`
  - `frontend/tests/e2e/entities.crud.spec.ts` (mocked deterministic CRUD)
- Added GitHub Actions workflow:
  - `.github/workflows/frontend-ci.yml`
  - Gates: OpenAPI type sync check, lint, build, unit test, e2e

## 3. Verification Summary

Verified repeatedly during implementation with the following commands:

```bash
npm run sync:api-types
npm run lint
npm run build
npm run test
npm run test:e2e
```

Latest status at report time:

- sync:api-types: PASS
- lint: PASS
- build: PASS
- unit tests: PASS
- e2e tests: PASS

## 4. Remaining Recommendations (Post-Completion Enhancements)

- Increase e2e coverage for topology/outbox edge cases and failure states.
- Add stronger API mocking utilities for unit tests to remove network-error console noise.
- Consider additional chunk optimization and prefetch strategy per route.

## 5. Conclusion

The frontend module now has a stable, typed, tested, and CI-gated baseline suitable for sustained feature development and cross-module integration.
