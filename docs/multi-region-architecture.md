# Multi-Region Foundation

Audit and phase-one implementation: 2026-09-21. This is a local-first foundation, not a deployment of shared community reporting, an accessibility-certified router, or a WCAG conformance claim.

Update 2026-09-22: the Portland source scaffold is now connected to verified PBOT curb-ramp inventory data. See [Portland Data](portland-data.md) for research, source semantics, custom municipal use terms and import behavior. The audit below describes the original foundation unless updated explicitly.

## Repository Audit

The review covered application orchestration, React/Lit UI, GIS and network operations, storage, source conversion, authentication, SQL ownership policies, build/test configuration, test inventory, and deployment documentation. Dependencies, generated bundles, browser artifacts, and local environment secrets were excluded. Existing uncommitted work and the user's plan were preserved. Findings below distinguish source inspection from browser verification.

### Architecture and Data Flow

- Vite 5, TypeScript strict mode, React 18 and Lit 3 with `@lit/react`. React owns state/forms/panels; Lit owns the MapLibre 4 map and emits custom events. Styles use CSS custom properties with dark, reduced-motion, and higher-contrast variants.
- `App.tsx` loads local Patches, refreshes source observations, filters/sorts records, and passes the active view to the map. Category markers and numbered groups are a rendering projection, not physical GIS features.
- Turf geodesic measurement and point-to-line proximity implement the 15-meter Path Check. Nearest sorting currently compares squared longitude/latitude differences, not geodesic distance. Path Check does not inspect a connected network, enforce access requirements, or account for report expiry.
- The browser calls ORS directions and Nominatim search directly. There is no application-owned API server, graph store, background ingestion worker, geocoding proxy, or service worker. Network code in `gis/routing.ts` predates the pure-GIS convention and remains there to avoid an unrelated rewrite.
- ORS walking, hiking, wheelchair and cycling profiles are distinct. Requirements unsupported by the current integration block routing. Nearby report warnings do not modify the route. No edge-level confidence, cross-slope, closure timing, soft cost, alternative ranking, or guarantee is available.
- Supabase Auth uses email/password and PKCE. Only preferences and favorites are stored remotely. Owner-scoped RLS is enabled and forced; private reads/writes are covered by embedded PostgreSQL tests. Real email delivery and end-to-end recovery remain deployment verification tasks; existing documentation records the SMTP blocker.

### Original Models

- IndexedDB v2: `patches` (GeoJSON point, title/category/severity/status/notes/photo, creation/update timestamps, optional source metadata) and arbitrary `meta` values.
- Source snapshots, hidden-record tombstones, refresh timestamps, one-time seed flag, and reversible-clear backup lived in `meta`.
- PostgreSQL: `accessibility_profiles(user_id, preferences)` and `favorite_locations(id, user_id, label, lng, lat)`. No public observations, evidence, moderation, spatial graph, or trust tables.
- Guest profiles and auth sessions use browser-local storage. Patches are shared within a browser profile, not privately partitioned by authenticated account.

### Seattle Assumptions Found

| Location | Original assumption | Phase-one disposition |
| --- | --- | --- |
| `src/config/map.ts` | Seattle center/zoom | Region configuration drives map initialization. |
| `src/data/geocoding.ts`, route/search UI | Seattle-only area union, hard-coded bounds/text | Selected region supplies bounds, country and label; Anywhere remains explicit. |
| `src/App.tsx`, records UI | Seattle refresh and source messages | Region-scoped loading, data, status, attribution and selection. |
| `src/data/seattleBaseline.ts` | One URL/schedule/lock | Compatibility wrapper over generic registry and per-source coordinator. |
| `src/data/db.ts` | One source/snapshot/tombstone namespace | Dataset storage keys; legacy Seattle namespace intentionally retained for compatibility. |
| `src/gis/seattleBaseline.ts` | One source ID and bounds | Shared Project Sidewalk converter reads registered source config; old exports remain compatible. |
| Import validation | Seattle-prefixed source IDs | Registered provider IDs; numeric finite/range validation and inferred region. |
| Source details/imagery | Seattle host/bounds and text | Registry-backed host, bounds, metadata namespace and attribution. |
| `src/data/seed.ts` and tests | Seattle fixture coordinates | Dormant seed/fixtures retained; seed is not invoked at startup. |

Seattle literals remain in configuration, compatibility names, source-specific fixtures and documentation, not routing or UI decision branches. Project Sidewalk is third-party observation data, not a Seattle municipal inventory. No Portland municipal endpoint or license was found in the repository.

### Accessibility, Security and Technical Risks

1. Shared community persistence and authorization do not exist. Local `verified`/`resolved` labels are freely editable and cannot be considered independent review. This phase never enables public publication.
2. Before this phase, edits replaced claims and source withdrawals deleted unedited observations. New history is append-only through application APIs; apparent source disappearance is an audit event, not a resolution. Local storage is still user-editable, not a security boundary.
3. The Patch form and shortcuts modal are non-native modal containers without complete focus containment/restoration. The photo input is hidden behind a label and is not a complete keyboard upload flow. Canvas drawing and numbered cluster selection have no complete keyboard equivalent; the record list permits keyboard access to observations but not all spatial operations.
4. File imports have no comprehensive payload limit, all-or-nothing batch transaction, or malicious-photo processing pipeline. Coordinate finite/range validation is fixed here. Uploaded photos are decoded/resized locally, but resource limits, redaction, meaningful alternative-text entry, and error handling need work. Historical storage retains photos and can increase quota usage.
5. Path Check's existing clear-state wording can overstate absent evidence; it also includes old/resolved observations. Do not interpret an empty result as evidence of safe passage. A freshness-aware condition projection must replace this compatibility behavior in a later phase.
6. Public Nominatim prohibits autocomplete and limits aggregate application requests, not each browser tab. Current explicit search, in-tab pacing and memory caching are not a production-wide rate limiter. Queries and route endpoints leave the browser. Use a compliant proxy/provider arrangement before public scaling.
7. ORS client keys are browser-visible. Only publishable Supabase keys belong in browser configuration; keep administrative keys and processing credentials server-side. No environment secrets were read or changed in this phase.
8. API geometry validation, dataset size limits/pagination, robust anti-forgery provenance, spatial indexing, history retention/export, and moderation permissions need further work. A source API may return a syntactically valid partial snapshot without declaring it; removals are therefore only apparent.
9. Two package-manager lockfiles exist in the worktree; this phase changes no dependencies. There is no lint script/configured linter. Vite emits an existing large-bundle warning. Local persistence does not guarantee cold offline startup.

## Phased Architecture

1. **Foundation (this implementation):** region configuration; Seattle-compatible defaults; Portland and Other locations views; scoped records/search/clear/restore; IndexedDB v3; distinct normalized contracts and append-only history; source adapters/import reports; migrations/tests.
2. **Trusted community service:** agree publication/privacy policy; add PostGIS storage, server-owned identity, ingestion workers, moderation commands, evidence quarantine, and offline synchronization. Existing local observations remain guest-owned drafts until explicitly published. No automatic upload.
3. **Access-aware graph evaluation:** procure/validate graph data, implement mode-specific hard constraints and soft costs with explicit unknown policy, source age, temporal closures, route/alternative explanations, and on-route matching. Do not equate point proximity with an impassable edge.
4. **Accessible workflows and advisory AI:** remediate modal/upload/map keyboard gaps; independently audit WCAG 2.2 AA with assistive technology; introduce redacted, consented AI evidence only after model/privacy/retention review.

## Region Contract

`src/config/regions.ts` defines stable IDs, names/jurisdictions, an operational bounding box plus nullable authoritative Polygon/MultiPolygon, map center/zoom, time zone, locale, units, supported routing modes/categories, dataset configuration and feature flags. Each source carries endpoint, attribution/license scope, validation bounds, API version, import/retry/staleness intervals and storage namespace. Actual import times/versions remain in storage, not static config.

- Seattle preserves its current downtown preview URL, daily refresh, hourly retry, source IDs, camera and metric display.
- Portland has an approximate operational envelope and camera center. Its PBOT adapter imports only ramps explicitly recorded without detectable warnings, under the City's data policy. Observation dates and actual dataset version remain unknown. Local reports, search and existing ORS profiles remain available; this subset is not complete accessibility coverage.
- Other locations retains legacy/imported observations outside either envelope rather than assigning all old data to Seattle or making it unreachable.
- These rectangles are not authoritative municipal boundaries. Region inference currently uses their non-overlapping operational envelopes. Before overlapping regions or exact legal boundaries are introduced, specify deterministic ownership/membership rules and polygon containment.
- Region selection is a device preference. Public observations do not become account-private when regions change. Locale currently controls refresh date display; map scale reads units. Full localization and imperial measurement/direction formatting remain later work; both city configs retain metric units.

## Normalized Records

| Entity | Purpose and authority |
| --- | --- |
| Physical feature | Stable spatial association with point/line/polygon geometry. Migrated point reports are explicitly unmatched locations with unknown feature kind, not fabricated sidewalk segments. |
| Observation | Versioned claim with region/feature IDs, observedAt/validFrom/expiresAt, recordedAt, source/sourceRecordId, confidence, verificationStatus, permanence, createdBy, geometry, category and nullable access attributes. Legacy snapshot retained. |
| Evidence | Separate note, local photo, source entry, sensor or advisory assessment; provenance/capture time and visibility explicit. Migrated evidence remains device-only. |
| Verification | Confirmation/dispute/review/advisory action with reviewer identity, evidence references and policy version. Account-history/proximity/freshness/trust signals are separate, not a vote-total truth score. Store exists but no public write API is enabled. |
| Current condition | Rebuildable derived projection referencing relevant observations, calculation time and policy. Empty/expired/future/rejected claims produce unknown, not accessible. It is not yet the Patch UI's authority. |
| Moderation event | Append-only action/reason/actor/time. Source disappearance and local hiding are recorded separately from resolution. Hosted reviewer actions are not implemented. |
| Source record | Immutable raw payload revisions, provider/external ID, import time, declared source version (ETag/Last-Modified when available), attribution/license and prior revision reference. API v3 is not represented as a dataset observation date. |

Null access attributes mean unknown, never false or zero. Source clusters/votes do not imply verified access. Legacy manually verified/resolved labels normalize to `needs-review`; the unchanged Patch snapshot preserves the user's original label. Missing actual observation time is not replaced with the import time. Local corrections and source imports have separate supersession streams; refresh does not supersede local testimony. Freshly fetched data can still describe old imagery.

### IndexedDB Migration

Version 2 -> 3 is additive and transactional:

- Keep `patches`, `meta`, IDs, fields, seed flag, legacy source keys, snapshots and recovery backups.
- Add a `properties.regionId` projection inferred from coordinates and a `by-region` index on Patches.
- Add `physicalFeatures`, `observations`, `evidence`, `verifications`, `currentConditions`, `moderationEvents`, `sourceRecords`, and `importReports`, each with `by-region` indexes. Observations also index `patchId`; source records index `(regionId, sourceId, externalId)`.
- Backfill snapshots and recovery backups before current records so no recoverable legacy claim is discarded. No raw municipal payload is fabricated for legacy records that only have a Patch projection.
- Save/edit appends changed claims. Local delete hides the active projection, preserving history. Clear retains recovery data and history; restore is region-scoped and does not overwrite active edits. No secure-erasure promise is made.
- Source imports atomically persist raw revisions, observations, compatibility Patches, import report and success timestamp. Repeated identical data creates no additional source/observation revisions; an import-run report is still recorded. A missing source record remains available for review instead of being deleted.

No Supabase SQL migration is applied in phase one: adding public tables before specifying policies would create an unsafe, unused backend. IndexedDB region/identity indexes are not geospatial indexes. For citywide service queries, phase two should use PostGIS geometry/geography with GiST indexes, B-tree region/source/temporal indexes, foreign keys and region-consistent references. Migration rollback requires restoring a browser backup; do not run an older application expecting database version 2 against an upgraded origin. Browser-site erasure removes history; the existing GeoJSON export contains active Patches only, not the full audit archive.

## Source Adapters

`SourceAdapter.fetch(signal)` uses only configured endpoints. `normalize(raw, importedAt, sourceVersion)` also accepts fixtures/offline payloads. The Project Sidewalk adapter validates the response/point bounds/types, deduplicates identical external IDs, rejects conflicting duplicates and invalid partial batches, preserves original payloads, and emits a complete batch. Empty responses are quarantined as errors rather than mass deletion.

The generic coordinator enforces source schedules, per-source single-flight and Web Locks where available. A late completed download may populate its own region's cache but cannot update a different selected region's UI. The import report lists additions, modifications, unchanged rows, duplicate counts, and apparent removals. Failed batches do not advance the success timestamp or overwrite cached data. At present rejected batches surface as errors rather than persisted rejection reports; a durable ingestion job/error ledger and bounded/paginated network ingestion belong in phase two.

The Portland adapter now uses the verified municipal open-data endpoint and use constraints, stable `NonAssetID`, WGS84 output, weekly refresh and complete ID-based pagination. It fails closed on partial, malformed, oversized or empty batches. See [Portland Data](portland-data.md). Future adapters must likewise establish source semantics, attribution and reuse terms before enabling imports.

## Routing Design for Phase Three

`RoutingEdge` and `EdgeEvaluation` contracts establish separate pedestrian/wheelchair/bicycle modes and explicit unknown stairs, ramps, grade, cross-slope, width, clearance, surface, condition, obstruction, traffic exposure, lighting and temporary-closure attributes. Confidence, observation time and expiry remain distinct.

Evaluate each edge against an explicit profile:

1. Apply hard requirements and an explicit user-reviewed unknown-data policy. Known violations make an edge unavailable. Unknown required width/ramp/grade cannot silently pass as safe.
2. For eligible edges, compute nonnegative cost from distance/exertion plus disclosed soft penalties (surface, exposure, lighting, uncertainty, stale evidence, temporary risks). Bicycle exposure/handcycle requirements are not wheelchair defaults.
3. Preserve reason codes for every exclusion/penalty and identify source observations and policy version. Return route selection and rejected-alternative explanations, unavailable-data warnings and service restrictions. No guaranteed-accessible wording.
4. Enforce total distance/exertion/transit constraints across the route, not only individual edges. Resolve conflicting/expired observations conservatively and retain the uncertainty explanation.

This phase does not implement or connect an edge evaluator to ORS. Existing provider-enforceable hard requirements and no-driving safeguards remain in place. ORS does not expose the graph needed to make a truthful custom-cost or rejected-alternative claim through the current API.

## Community Lifecycle and AI Design

Planned server-controlled lifecycle: `submitted -> provisionally-visible -> confirmed/disputed/needs-review`, with reviewed transitions to `superseded`, `resolved`, or `rejected`. Disputes must not hide hazards automatically. Resolution requires a newer, linked observation plus authorized human review; rejection/merge/hiding never deletes the original audit trail. Temporary expiry yields unknown/needs renewed observation, not confirmed resolution.

All command authorization, reviewer trust and quotas must be server-side. A new/anonymous account cannot resolve or erase another person's report. Confirmation signals should consider independent account history, coarse proximity proof, fresh evidence and audited reviewer trust; cap correlated accounts and repeat votes, flag brigading and duplicate claims, and never interpret popularity as proof. Do not infer reviewer trust from merely possessing an account or record. Precise reviewer travel history must not be retained as a trust shortcut.

Before public photo upload: byte/dimension/MIME limits, safe decoding/re-encoding, malware checks, EXIF/GPS removal, face/license-plate redaction, quarantine, access controls, retention/deletion policy, accessible descriptions/instructions and rate limits. Separate private original evidence from a moderated public derivative. Do not publish home locations or sensitive notes by default.

`AdvisoryPhotoAssessment` contains possible categories/confidence, quality warnings, contradictions and model/version/time metadata, with literal `advisoryOnly: true`. It has no command to certify, resolve, reject or delete a report. AI output is evidence for reviewers, not verification authority. No AI service or photo transfer is enabled here.

## Test and Release Gates

Phase-one coverage includes configuration/placeholder validation; geographic import validation; normalized unknown/expiry semantics; region isolation; v1/v2 migration; backup/seed preservation; append-only source/local streams; import idempotency/raw provenance; duplicate rejection; refresh/backoff; no Portland fetch; and keyboard region/list/dialog/search/recovery workflows on mobile/desktop, including late-response isolation.

Existing suites continue to test account RLS, provider hard requirements, non-driving modes, source-link safety, clustering, drawing and responsive layouts. Community permissions/brigading, real spatial SQL, soft edge costs, full screen-reader workflows, malicious uploads and live provider quality remain release gates for their implementing phases. Mocked browser tests do not establish real municipal coverage, inbox delivery, screen-reader usability or WCAG AA conformance.

Run `scripts/agent/verify.ps1`, then Playwright against the running server. No lint command exists. Inspect the new regional UI at mobile/desktop sizes and retain test artifacts. No dependencies or credentials are added by this phase.

### Verification Results

- TypeScript: no errors; editor diagnostics: no errors.
- Vitest: 16 files, 166 tests passed, including embedded PostgreSQL account-policy tests.
- Production build: passed; existing large-bundle warning remains (approximately 1.39 MB before gzip).
- Playwright: all 58 tests passed. After adding tile-readiness gating to regional screenshots, the three region tests passed again.
- Portland screenshots inspected at 390px and 1280px with rendered basemap tiles, region controls and local observations; keyboard/dialog focus and horizontal overflow are asserted by browser tests. External tile service availability is not guaranteed by these tests.
- Two old license assertions were updated to the registry-driven disclosure. The baseline request-count assertion now excludes per-report imagery lookups sharing the same endpoint; it still requires exactly one baseline download across reload.
- No hosted migrations, live municipal ingestion, real-email auth verification, formal screen-reader audit or lint run was performed. No linter is configured.

### Phase-One File Inventory

Paths below identify this phase, not every pre-existing worktree edit.

New production files:

- `src/config/regions.ts`
- `src/types/spatial.ts`
- `src/data/spatialHistory.ts`
- `src/data/sourceAdapters.ts`
- `src/data/regionBaseline.ts`

Updated production files:

- `src/types/patch.ts`, `src/config/map.ts`, `src/App.tsx`
- `src/data/db.ts`, `src/data/seattleBaseline.ts`, `src/data/geocoding.ts`, `src/data/sidewalkImagery.ts`
- `src/gis/seattleBaseline.ts`, `src/gis/importValidate.ts`
- `src/components/web/curb-map.ts`
- `src/components/react/RecordsPanel.tsx`, `src/components/react/RoutePanel.tsx`, `src/components/react/AddressSearch.tsx`, `src/components/react/PatchForm.tsx`, `src/components/react/PatchDetails.tsx`

New tests:

- `src/config/__tests__/regions.test.ts`
- `src/data/__tests__/spatialHistory.test.ts`, `src/data/__tests__/sourceAdapters.test.ts`
- `tests/browser/regions.spec.ts`

Updated tests and documentation:

- `src/data/__tests__/baselineStorage.test.ts`, `src/data/__tests__/seattleRefresh.test.ts`, `src/data/__tests__/geocoding.test.ts`
- `tests/browser/non-driving-routes.spec.ts`, `tests/browser/seattle-baseline.spec.ts`
- `README.md`, `docs/multi-region-architecture.md`

No dependency additions, CSS redesign, server deployment, or edits to `plan.md` were made in this phase.