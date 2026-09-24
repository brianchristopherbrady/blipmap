# blipmap

blipmap is a local-first street-level accessibility notebook and map. It helps people record pedestrian conditions, review nearby reports, measure paths, and plan non-driving trips.

The central record is a **Patch**: a georeferenced point with a category, severity, status, notes, and optional local photo. Source-backed records retain their provider, source ID, dates when available, and attribution context.

> Accessibility reports are incomplete observations, not guarantees. Conditions change, source dates may be unknown, and route providers do not know every physical barrier. Check critical access needs independently. blipmap is not live navigation or an emergency service.

## Current Application

The application is a Vite + React + Lit browser app with a MapLibre map. It works as a guest and stores local observations in IndexedDB. Optional Supabase accounts save private preferences and favorite destinations; local Patches are not uploaded or synchronized between accounts.

### Regions

The Region selector controls the map view, active records, address-search bounds, source status, and region-scoped clear/restore actions. The selection persists in this browser.

- **Seattle** is the default region. It loads a small downtown Project Sidewalk observation preview covering missing curb ramps, obstacles, surface problems, and missing sidewalks.
- **Portland** loads the City of Portland Bureau of Transportation curb-ramp inventory. It imports ramps explicitly recorded with no detectable warning surface, such as truncated domes. These are potential tactile-access barriers, not missing ramps or certified ADA violations. Observation dates are unknown.
- **Other locations** holds imported records outside the configured Seattle and Portland operational envelopes.

Configured envelopes are approximate data boundaries, not authoritative legal jurisdiction polygons. Portland source coverage and interpretation are documented in [docs/portland-data.md](docs/portland-data.md). The broader storage and architecture decisions are in [docs/multi-region-architecture.md](docs/multi-region-architecture.md).

## Features

### Record observations

- Add a Patch at a map location.
- Choose from curb/ramp, stairs, obstruction, surface, crossing, entrance, construction, good passage, elevator, and other.
- Set severity to `easy`, `caution`, or `difficult`.
- Set status to `observed`, `verified`, or `resolved`.
- Add notes and an optional local photo.
- Edit, hide, undo a deletion, clear a region, or restore recoverable records.
- Search, filter, and sort records by category, severity, status, title, date, or distance.

Record labels are user-facing state, not independent verification. A locally marked `verified` record is not the same as a server-reviewed community report.

### Explore clustered map records

The map uses category icons for individual reports and numbered groups for dense areas.

- Clicking a numbered group with more than six members zooms into smaller groups.
- Clicking a group with six or fewer members reveals its individual reports.
- Zooming alone never reveals individual reports.
- Co-located reports that cannot split at maximum zoom remain numbered and stay available in the records panel.
- **Back to groups** restores the overview and the previous map view.

### Measure and check a path

**Measure** draws a line and reports geodesic distance.

**Path Check** draws a candidate path and finds Patch reports within 15 meters. Results appear after the second point and update as points are added. Finish, clear, redraw, and exit actions remain available while results scroll.

Path Check is proximity analysis. It does not prove that a route is continuous, step-free, legal, safe, or accessible, and an empty result does not prove that no barriers exist.

### Plan a non-driving trip

The route planner supports walking, hiking, wheelchair, and cycling profiles through OpenRouteService. It displays provider directions, nearby observations, route warnings, and printable directions.

Address search is explicit rather than autocomplete. It defaults to the selected region, shows up to 20 matches, supports keyboard selection, and provides an **Anywhere** option. Search results are filtered to the configured region envelope unless Anywhere is selected.

Supported access requirements include avoiding stairs, minimum width, supported wheelchair incline limits, avoiding steep slopes, and avoiding rough surfaces. Requirements that the current routing provider cannot enforce, such as guaranteed step-free crossings or avoiding construction, block route generation rather than silently changing the request.

Nearby Patch reports provide context only. They do not automatically modify the provider route, create detours, or provide live GPS guidance.

### Preferences and accounts

Settings support multiple mobility aids and independent access requirements. Guest preferences remain in this browser.

Optional accounts use Supabase email/password authentication with PKCE. Signed-in users can explicitly save private preferences and favorite destinations. Signing in does not upload local Patches or make browser-local records account-private. Guest use remains available when Supabase is not configured.

See [docs/accounts.md](docs/accounts.md) for Supabase setup, row-level security, redirects, SMTP, and deployment checks.

### Import and export

- Export active Patches as `blipmap-patches-YYYY-MM-DD.geojson`.
- Import GeoJSON Point Features after coordinate, category, status, and source validation.
- Imported region is inferred from coordinates rather than trusted from an input label.
- Source metadata and supported provenance fields are preserved when valid.

Exports may contain precise coordinates, notes, photos, and source metadata. Review them before sharing. The export contains active Patches, not the complete normalized history or IndexedDB recovery archive.

## Data and Provenance

IndexedDB version 3 stores active Patches plus normalized local history:

- physical feature associations
- immutable observations and revisions
- evidence records
- verification records
- derived current-condition projections
- moderation events
- raw source-record revisions
- import reports

Source refreshes are validated and committed as complete batches. Repeated identical source data is idempotent. Local corrections use a separate history stream from source imports. Apparent source removals are retained for review instead of being treated as resolved or deleted.

Clearing records is reversible, not secure erasure. Recovery backups and history may retain notes and photos until browser site data is removed. Existing active records take precedence during restoration. Local Patches are shared by users of the same browser profile and origin.

## External Data Sources

### Seattle: Project Sidewalk

Seattle uses the Project Sidewalk Seattle v3 label-cluster API for a small downtown preview. The observation data is CC0; that does not license the underlying imagery. blipmap does not embed remote imagery. It performs bounded, on-demand exact-report lookups when a source-backed record is opened and links to the original report when a verified link is available.

- [Project Sidewalk Seattle](https://sidewalk-sea.cs.washington.edu/)
- [Source and imagery details](docs/sidewalk-imagery.md)

### Portland: PBOT curb-ramp inventory

Portland uses the City of Portland open-data layer for curb ramps. The importer selects `ADAWarnings='N'`, which means the inventory records no detectable warning. It does not convert `Y`, `U`, null, or undocumented values into issues.

The source is refreshed weekly. The importer uses the stable municipal `NonAssetID`, queries the full ID list, retrieves complete 200-record pages in WGS84, rejects incomplete or oversized responses, and retains raw source evidence. The City's custom Data Distribution Policy applies; this is not CC0. The app links the official metadata and use constraints.

- [Portland source research and limits](docs/portland-data.md)
- [City metadata and use constraints](https://www.portlandmaps.com/metadata/index.cfm?action=DisplayLayer&LayerID=52778)
- [Portland open-data layer](https://www.portlandmaps.com/od/rest/services/COP_OpenData_Transportation/MapServer/61)

## Privacy and Network Behavior

### Stored locally

IndexedDB stores local Patches, local photos, cached source observations, normalized history, recovery data, and import provenance. Guest preferences use localStorage. Address-search results are cached in memory only and are not saved as location history.

Changing browsers, origins, ports, or profiles changes the storage location. Clearing site data removes local records and history. Export records before clearing storage or moving devices.

### Sent to external services

| Service | Purpose |
| --- | --- |
| OpenStreetMap raster tiles | Map tiles for the visible area. |
| Nominatim | Explicit origin and destination place searches. |
| OpenRouteService | Route coordinates, travel profile, supported restrictions, and API key. |
| Project Sidewalk Seattle | Seattle baseline and exact source-report lookups. |
| PortlandMaps / ArcGIS | Portland curb-ramp inventory records and metadata. |
| Configured Supabase project | Authentication and explicitly saved private preferences/favorites. |

The app does not upload local Patches, photos, route history, or location history automatically. External services still receive normal network metadata such as IP address. Review provider policies before production use.

Public Nominatim is paced and cached per browser tab, but client-side pacing cannot enforce an aggregate limit across all users. Use a compliant geocoding provider or proxy before public scaling. Never send confidential information to public geocoding services.

Every `VITE_*` value is visible in browser code. Never put database passwords, Supabase service-role keys, SMTP credentials, or server secrets in them.

## Technology and Repository Layout

- Vite 5 and strict TypeScript
- React 18 for application state, forms, and panel composition
- Lit 3 and `@lit/react` for map and reusable custom elements
- MapLibre GL JS for map rendering
- Turf.js for geodesic measurement and Path Check geometry
- IndexedDB through `idb` for local persistence
- Supabase JS for optional authentication and private account data
- Vitest, Playwright, fake-indexeddb, and PGlite for tests

```text
src/
  App.tsx                 React application state and workflow coordination
  components/react/       Panels, forms, account flows, and Lit wrappers
  components/web/         Lit map and design-system elements
  config/                 Regions, map, routing, access, and account settings
  data/                   IndexedDB, profiles, imports, exports, and adapters
  gis/                    Measurement, Path Check, routing I/O, and converters
  styles/                 CSS custom properties and global styles
  types/                  Patch and normalized spatial contracts
docs/                     Account, imagery, Portland, and architecture guides
scripts/agent/            Setup and verification scripts
supabase/                 Account migration and SQL authorization tests
tests/browser/            Playwright workflows
```

React owns application state, forms, and panels. Lit owns the MapLibre lifecycle and reusable visual elements. Typed custom events connect the two layers. Map tile URLs live in [src/config/map.ts](src/config/map.ts). Pure spatial calculations remain independently testable.

## Local Development

### Requirements

- Node.js 22 or newer
- npm
- A current browser with WebGL and IndexedDB
- Internet access for map tiles, source imports, address search, routing, and optional accounts

### Install and run

```sh
git clone https://github.com/brianchristopherbrady/blipmap.git
cd blipmap
npm ci
npm start -- --port 5180 --strictPort
```

Open [http://localhost:5180](http://localhost:5180). `npm run dev` is equivalent to `npm start`. Use another free port if 5180 is occupied, then set `BLIPMAP_BASE_URL` when running browser tests.

### Optional environment

Create `.env.local` from `.env.example` when the template is available. The main optional values are:

| Variable | Purpose |
| --- | --- |
| `VITE_ORS_API_KEY` | Enables OpenRouteService directions. |
| `VITE_SUPABASE_URL` | Supabase project URL. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public browser key for the Supabase project. |

Restart Vite after changing environment values. Production values are embedded at build time, so rebuild after changes.

## Tests and Verification

| Command | Purpose |
| --- | --- |
| `npx tsc --noEmit` | Type-check without emitting files. |
| `npm test -- --run` | Run all Vitest tests once. |
| `npm run build` | Type-check and create the production bundle. |
| `npm run test:browser` | Run Playwright against an already-running server. |
| `npm run preview` | Serve the built bundle for local inspection. |

Windows convenience gate:

```powershell
.\scripts\agent\verify.ps1
```

Unix-like systems:

```sh
bash scripts/agent/verify.sh
```

Install Chromium for browser tests when needed:

```sh
npx playwright install chromium
```

The ordinary browser suite uses mocked external services. The real Portland source check is opt-in so normal tests remain deterministic:

```powershell
$env:BLIPMAP_LIVE_DATA = '1'
npx playwright test tests/browser/portland-live.spec.ts --workers=1
Remove-Item Env:BLIPMAP_LIVE_DATA
```

The live check depends on the City service and its current record count. It verifies import, map rendering at desktop/mobile sizes, and reload persistence; it is not a guarantee of source availability.

## Deployment

Build the static bundle with `npm run build` and publish `dist` on an HTTPS static host. `npm run preview` is for local inspection, not a production server.

A static deployment does not provision Supabase or apply SQL migrations. Configure Supabase separately, apply the account migration, verify RLS, configure HTTPS redirects and SMTP, and test real confirmation/recovery email flows before enabling public accounts.

Review OpenStreetMap tile policy, Nominatim policy, OpenRouteService quotas, Project Sidewalk terms, Portland's Data Distribution Policy, and Supabase configuration before inviting production traffic.

## Known Boundaries

- Seattle coverage is a small downtown preview, not a citywide inventory.
- Portland coverage is limited to PBOT curb ramps recorded without detectable warnings and does not describe every accessibility condition.
- Source observation dates may be unknown or old.
- Current routing is provider-backed and does not use a custom accessibility graph or edge-level soft costs.
- Local community publishing, shared moderation, server-side trust signals, and cross-device Patch synchronization are not implemented.
- AI photo assessment is not enabled. No AI output certifies, resolves, or rejects a Patch.
- Full WCAG 2.2 AA conformance has not been independently certified.
- Cold offline startup, service-worker installation, continuous GPS guidance, and automatic Patch-aware detours are not implemented.
- There is no configured linter. Production builds may report an existing large-bundle warning.

## Contributing

Keep changes focused and preserve the React/Lit architecture, guest workflows, local data, source attribution, and region boundaries. Add unit tests for data and GIS behavior and browser tests for affected workflows. Treat imported data as provenance-bearing observations, not truth without context.

Do not commit credentials, private exports, photos, exact personal locations, or environment output. Consider IndexedDB migrations, import/export compatibility, source licenses, and user privacy when changing the data model.

The repository currently has no specified open-source license. Public visibility does not grant permission to reuse or redistribute the application source. Third-party software, map tiles, geocoding, routing, authentication, imagery, and municipal data retain their own terms.
