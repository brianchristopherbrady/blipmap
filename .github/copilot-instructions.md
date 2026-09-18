# blipmap — Project Guidelines

> **Agent system docs:** [docs/agent-system.md](../docs/agent-system.md)

## What It Is

blipmap is a micro-GIS tool for documenting pedestrian accessibility at street level. It is a local-first, offline-capable application with optional user accounts and backend synchronization. The central data unit is a **Patch** — a georeferenced accessibility observation.

## Stack (Hard Requirements)

| Layer | Technology |
|-------|-----------|
| Build | Vite + TypeScript (strict) |
| UI orchestration | React 18 |
| Design system / Map component | Lit 3 + `@lit/react` |
| Map rendering | MapLibre GL JS |
| Spatial analysis | Turf.js |
| Local persistence | IndexedDB via `idb` |
| Tests | Vitest |
| Styles | CSS custom properties — no Tailwind, no Bootstrap, no CSS-in-JS |

Never introduce: Next.js, Redux, Material UI, Chakra, GraphQL, Docker, or a routing engine.

## Accounts and Backend

- Authentication and backend storage are permitted for user accounts, saved accessibility preferences, favorite locations, and cross-device synchronization.
- Preserve guest mode and local-first Patch workflows; do not require sign-in for existing local features.
- Select the authentication and storage provider before implementation; no provider is mandated by these guidelines.
- Enforce per-user access to private data on the backend, not only in the UI.
- Treat accessibility preferences and saved locations as sensitive data. Minimize collection and do not store location history by default.
- Keep server secrets out of browser code and `VITE_*` environment variables; only provider-designated public client keys may be exposed there.

## Architecture Split

**Lit owns:**
- Map surface lifecycle (`<curb-map>`)
- Design-system primitives (`<curb-tool-button>`, `<curb-record-card>`, `<curb-status-pill>`)
- Emit `CustomEvent`s upward — never import React inside a Lit component

**React owns:**
- App-level state (patches array, active mode, selection, filters)
- Forms (add/edit Patch)
- Panel/drawer composition
- Wiring CustomEvents from Lit into React state via `@lit/react` wrappers

## App Mode State Machine

```ts
type MapMode = "browse" | "add" | "measure" | "path-check";
```

Only one mode is active at a time. `Escape` always returns to `"browse"` and clears temporary geometry.

## Core Data Model

```ts
interface Patch {
  id: string;
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    title: string;
    category: PatchCategory;  // "curb-ramp" | "stairs" | "obstruction" | "surface" | "crossing" | "entrance" | "construction" | "good-passage" | "elevator" | "other"
    severity: "easy" | "caution" | "difficult";
    status: "observed" | "verified" | "resolved";
    notes: string;
    createdAt: string;   // ISO 8601
    updatedAt: string;
  };
}
```

Always use slug values internally; display-friendly labels are derived in the UI layer only.

## Key File Locations

| File | Purpose |
|------|---------|
| `src/config/map.ts` | Basemap tile URL — the ONLY place tile URLs live |
| `src/data/db.ts` | All IndexedDB operations (`getPatches`, `savePatch`, `updatePatch`, `deletePatch`, `clearPatches`) |
| `src/gis/measure.ts` | Pure geodesic measurement functions |
| `src/gis/pathCheck.ts` | Pure Path Check spatial analysis (Turf point-to-line distance) |
| `src/components/web/` | Lit custom elements |
| `src/components/react/` | React components + `@lit/react` wrappers |

## CSS Design System

Use only CSS custom properties. Core tokens:

```css
--ink, --paper, --paper-raised, --moss, --warning, --danger, --muted, --line,
--radius-sm, --radius-md, --shadow-float
```

Mood: warm off-white surfaces, dark graphite text, moss/leaf accent, coral/orange warnings. Not playful, not corporate.

## Conventions

- Spatial analysis functions in `src/gis/` must be **pure functions** with Vitest unit tests.
- Map tile configuration lives only in `src/config/map.ts`.
- Lit components emit typed `CustomEvent`s; never call React state setters from inside Lit.
- Use `@lit/react` `createComponent()` to wrap custom elements for React consumers.
- Seed data runs only once; store completion in IndexedDB with a `seedCompleted` flag.
- GeoJSON export filename: `blipmap-patches-YYYY-MM-DD.geojson`.
- Path Check buffer distance: **15 meters** (Turf `pointToLineDistance`).
- No fake buttons, no TODO-only features, no dead controls.

## Verification

Before reporting a task complete, always confirm:

```
npx tsc --noEmit   # zero type errors
npm test           # all Vitest tests pass
npm run build      # production build succeeds
```

Run `scripts/agent/verify.ps1` (Windows) or `scripts/agent/verify.sh` (Unix) to run all three at once.

## Agent Architecture

This repository uses a layered agent system. See [docs/agent-system.md](../docs/agent-system.md) for the full architecture. Agents available:

| Agent | Role |
|-------|------|
| `orchestrator` | Classifies tasks, delegates, tracks done criteria |
| `planner` | Read-only research, produces implementation plans |
| `feature-builder` | Full-stack implementer with closed-loop verification |
| `reviewer` | Read-only challenger of implementations |
| `qa` | Build, test, and browser verification |
| `component-author` | Lit component specialist |
| `gis-analyst` | Spatial analysis specialist |
