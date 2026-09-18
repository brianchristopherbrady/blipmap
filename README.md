# blipmap

**A tiny field map for the places where walking gets weird.**

blipmap is a focused micro-GIS tool for documenting pedestrian accessibility at street level. Click the map, drop a Patch, describe what makes this curb ramp, crossing, or sidewalk section notable. View your records spatially. Draw a path and check it against your observations. Export and share.

---

## What It Does

- **Drop a Patch** — georeference any accessibility observation: curb ramps, stairs, obstructions, surfaces, crossings, entrances, construction, elevators, good passages.
- **Measure** — geodesic distance measurement across multiple points.
- **Path Check** — draw a route and instantly see which recorded observations fall within 15 meters of it, with an overall friction rating.
- **Filter and search** — find patches by category, severity, status, or text.
- **Export / Import** — GeoJSON round-trip. All data is yours.
- **Local storage** — Patch records remain on this device. Map tiles, baseline downloads, and route requests require a network connection; ORS routing requires its own API key.

## Seattle Baseline

Seattle observations are part of the default experience: cached reports appear immediately and the app downloads the baseline automatically on first use. No import or setup action is required. The source is a small downtown Seattle starter area from [Project Sidewalk's Label Clusters API](https://sidewalk-sea.cs.washington.edu/v3/api-docs/labelClusters), not the whole city. The bounding box is longitude -122.34 to -122.33, latitude 47.60 to 47.61. Coverage within that area is incomplete.

The baseline refreshes every **24 hours**. While the app is open, it checks for due updates every five minutes, and also checks on launch, window focus, visibility, and restored connectivity. Successful refresh times are persisted in IndexedDB, so reloading does not repeatedly download the data. Failures retain the cache and retry no sooner than one hour later. Concurrent refreshes share one request; browsers supporting Web Locks also coordinate across tabs. Without Web Locks, separate tabs may make duplicate requests, but storage reconciliation remains transactional.

This is a client-side refresh schedule, not an always-running backend job: when the app is closed, the next due refresh happens when it is opened again. A new device needs connectivity for its first baseline download. The panel reports the last successful source check separately from the imagery and observation dates.

- Includes explicit missing curb ramps, obstacles, surface problems, and missing sidewalks. It does not infer missing infrastructure from absent records.
- Imported reports are marked **Observed**, never automatically **Verified**. Barrier severity 3 maps to Difficult; lower or unknown severity maps to Caution, not Easy.
- Patch details retain source cluster IDs, average imagery and label dates, severity, and validation counts. Validation totals may include human and AI judgments. These dates are distinct from the import date.
- Refreshes atomically add new records and update source-owned records. Local corrections to title, category, severity, status, notes, photos, or geometry are preserved, while source metadata is refreshed. Previously imported, unedited records are enrolled automatically. Older manually edited imports are preserved.
- A record absent from a subsequent valid source snapshot is removed only if it still matches the prior source observation. Locally edited records remain. Absence is not treated as confirmation that a barrier was resolved. Source cluster IDs can change when the provider reclusters; locally retained records can therefore overlap newer clusters.
- Deleting a baseline report, including through Clear all patches, hides that source ID from future refreshes on this device. Undo restores it and re-enables updates. New source IDs may still appear on later refreshes.
- Empty, malformed, partially invalid, or failed responses do not replace the existing baseline or advance the successful-refresh timestamp.
- Source metadata survives editing and GeoJSON export/import. Existing local and fictional demo patches are not removed; new installations no longer receive fictional demo patches by default.
- Data is [CC0](https://sidewalk-sea.cs.washington.edu/api); imagery is not downloaded or redistributed. Contributor identifiers are not stored. The provider's v3 API is a preview and may change.

These reports are a baseline, not a current accessibility survey. A report near a route does not identify the exact traversed sidewalk or guarantee a detour. Missing observations mean unknown conditions, not an accessible route. Expanding coverage and connecting barriers to routing remain separate work.

## Non-Driving Directions

All generated routes, map route lines, and printed directions use an explicitly selected non-driving OpenRouteService profile: walking (`foot-walking`), hiking (`foot-hiking`), wheelchair (`wheelchair`), or bicycle (`cycling-regular`). Car and truck profiles are rejected at the request boundary; failed requests never fall back to driving. Invalid legacy preferences normalize to walking, or wheelchair when that mobility aid is selected.

These profiles apply the provider's pedestrian or bicycle access restrictions to exclude car-only roads. Shared streets that permit the selected mode can still be used. This relies on the provider's map/access data, not an independent audit of every segment; obey posted access restrictions and actual conditions. ORS's `avoid_features: highways` option is driving-only and is deliberately not used as a substitute for the correct profile.

Changing the travel profile, access requirements, or endpoints clears existing directions and cancels pending route requests. Printed directions use the same result as the map and identify the selected profile and requirements. Nearby barrier reports are still warnings rather than guaranteed detours; live GPS guidance remains separate work.

Mobility aids are optional, multiple selections; they do not change the chosen travel mode. Walking does not imply stair access: **No stairs** sends `avoid_features: ["steps"]` for any non-driving mode. The wheelchair routing profile also supports minimum width, maximum incline (3%, 6%, 10%, or 15%), and smooth-surface restrictions. These are filters on the provider's mapped data, not a physical-access guarantee. Provider defaults still apply when no extra limit is selected.

Requirements that the provider cannot enforce, including guaranteed flush crossings, exclusion of all active construction, and width/surface/incline constraints in walking or cycling mode, block route generation with an explanation. They are never silently dropped or relaxed. Users can save those requirements even when routing is unavailable for them.

## Accounts

Optional Supabase accounts support registration, email confirmation, sign-in, password recovery, private access preferences, and explicitly saved destination favorites. Guest mode remains available and local Patches are not uploaded. Accounts require a configured Supabase project and the included database migration; see [setup, privacy, and verification](docs/accounts.md). Only a public publishable client key belongs in browser configuration.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Build | Vite + TypeScript (strict) |
| UI | React 18 |
| Map component | Lit 3 + `@lit/react` |
| Map rendering | MapLibre GL JS |
| Spatial analysis | Turf.js |
| Persistence | IndexedDB via `idb` |
| Tests | Vitest |

---

## Quick Start

```bash
npm install
npm start        # dev server at http://localhost:5173
npm test         # Vitest unit tests
npm run build    # production build
```

---

## Agentic Development Architecture

This repository intentionally demonstrates a **layered agentic AI development system** — not just AI-assisted coding, but a reference implementation of how context engineering, deterministic enforcement, specialized agents, and verification loops combine into something more than a smart autocomplete.

The system includes:

- **Persistent project instructions** — always-loaded stack constraints and data model
- **Scoped file instructions** — React, Lit, GIS, and data-layer conventions loaded only when those files are in context
- **Dynamically loaded Skills** — MapLibre rendering, Turf spatial operations, design tokens, browser QA — loaded only when the task requires them
- **Specialized agents** — orchestrator, planner, implementer, reviewer, and QA agents with distinct responsibilities and tool surfaces
- **Deterministic lifecycle hooks** — dangerous command guard (PreToolUse) and TypeScript validation (PostToolUse) that enforce behavior regardless of the model's working memory
- **Parallel subagent investigation** — independent domain research runs concurrently to avoid sequential bottlenecks
- **Closed-loop verification** — agents run type-check, tests, and production build and self-correct on failures before reporting done
- **Browser-driven QA** — a QA agent that exercises real user flows in a real browser, not just inspects source code

See [docs/agent-system.md](docs/agent-system.md) for the full architecture, including the context layering strategy, tool permission matrix, memory conventions, self-correction loop, and an end-to-end example tracing a feature from request through planning, implementation, review, browser QA, repair, and completion.

---

## Contributing

The agent system is the primary contribution surface for AI-assisted work. Use `/new-feature` in chat to trigger the full orchestrated workflow for new functionality.

For direct changes, run `scripts/agent/verify.ps1` (Windows) or `scripts/agent/verify.sh` (Unix) before opening a PR.
