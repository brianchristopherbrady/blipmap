---
name: browser-qa
description: "Use when verifying blipmap's running application in a browser: launching the dev server, running smoke tests, checking console errors, testing user flows (add patch, measure, path check, export, import, persistence), or debugging runtime issues that only appear in a real browser."
---

# Browser QA for blipmap

## When to Use
- After implementing a feature, to verify it works end-to-end in a real browser
- When a test passes but the app appears broken at runtime
- When debugging a UI issue that is not reproducible from source inspection alone
- When verifying persistence across page reloads

## Prerequisites

```bash
npm install          # ensure dependencies are installed
npm run build        # ensure TypeScript compiles
```

## Launch Dev Server

```bash
npm start
# → Vite dev server at http://localhost:5173 (or configured port)
```

Wait for the "ready" message before opening the browser.

## Automated Smoke Test

Run the bundled smoke test script (requires Playwright Chromium):

```bash
# First-time setup (also verifies Python 3 and installs npm deps)
bash scripts/agent/setup.sh        # Unix
# OR
pwsh scripts/agent/setup.ps1       # Windows

# Run smoke test against the running dev server
node .github/skills/browser-qa/scripts/smoke-test.js http://localhost:5173
```

The smoke test checks: app loads, map renders, toolbar is present, add-mode activates, ESC resets mode, no console errors on load.

See [./scripts/smoke-test.js](./scripts/smoke-test.js) for the full script.

## Manual Verification Checklist

When automated testing is insufficient, verify these flows manually:

### Core Flows
- [ ] Map tiles load (not blank, no 404s in network tab)
- [ ] Seed patches visible on map and in panel
- [ ] Add Patch: click mode → click map → form → save → marker + panel update
- [ ] Edit Patch: open → change title → save → marker label + panel update
- [ ] Delete Patch: delete → marker gone → panel count decrements
- [ ] Select from map → panel highlights card
- [ ] Select from panel → map flies to feature

### Tools
- [ ] Measure: click 3+ points → distance label updates → ESC clears
- [ ] Path Check: draw path across patches → results panel appears with rating

### Data
- [ ] Export: button downloads `blipmap-patches-YYYY-MM-DD.geojson`
- [ ] Import valid GeoJSON → success message with count
- [ ] Import malformed file → error message, no crash, no existing data lost
- [ ] Reload page → all patches persist

### Accessibility (spot check)
- [ ] Tab key navigates toolbar buttons
- [ ] Focus rings are visible on all interactive elements
- [ ] No elements require hover to interact

## Interpreting Console Errors

| Error Type | Likely Cause |
|------------|--------------|
| `Cannot read properties of undefined` | Missing null check after async IndexedDB read |
| `Uncaught (in promise) ...` | Unhandled IndexedDB rejection |
| `maplibre: Source ... does not exist` | Layer added before source, or source name typo |
| `customElement already defined` | Lit component registered twice (duplicate import) |
| `LitElement: ...` | Property binding type mismatch on `@lit/react` wrapper |

## Debugging Persistence Issues

If data disappears on reload:
1. Open DevTools → Application → IndexedDB → blipmap
2. Inspect the `patches` object store before and after reload
3. Check that `savePatch()` is being awaited — fire-and-forget is a common bug
4. Check that `getPatches()` is called on startup, not just on events

## Stopping the Dev Server

After QA is complete, terminate the dev server process (`Ctrl+C` or kill the terminal).
