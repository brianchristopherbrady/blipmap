# Build Prompt: blipmap, a Lightning-Fast Micro-Accessibility GIS Application

You are acting as the senior engineer, GIS engineer, product designer, and design-systems engineer responsible for building this application to completion.

Do not merely scaffold the project, describe what you would build, or leave placeholder components.

Build the complete working application in the current repository.

Your job is finished only when:

1. Dependencies install successfully.
2. `npm start` launches the application.
3. The app loads without runtime errors.
4. The map renders.
5. All primary controls actually work.
6. Records can be created, edited, selected, filtered, and deleted.
7. Measurement works.
8. Data persists across reloads.
9. GeoJSON can be exported and imported.
10. The production build succeeds.
11. There are no fake buttons, TODO-only features, dead controls, or knowingly broken paths.

If something in this specification creates an implementation conflict, choose the simplest robust implementation that preserves the product intent.

Do not ask me to make routine implementation decisions. Make reasonable engineering decisions yourself and continue.

---

# PRODUCT

Build a small, unusually polished GIS application called:

# blipmap

Tagline:

**A tiny field map for the places where walking gets weird.**

blipmap is a focused micro-GIS tool for documenting pedestrian accessibility at street level.

It is not a general-purpose ArcGIS clone.

It exists for a specific job:

A person walking a neighborhood, campus, downtown district, event site, park, or development can quickly record tiny physical conditions that determine whether a route is actually usable.

Examples:

* missing curb cuts
* steep curb ramps
* stairs
* sidewalk construction
* temporary obstructions
* narrow passages
* rough pavement
* inaccessible entrances
* awkward crossings
* broken sidewalks
* unexpectedly good accessible passages
* elevators
* ramps
* useful shortcuts
* other accessibility observations

Traditional maps tend to show that a sidewalk or entrance exists.

blipmap records whether it actually works.

The product should feel like a pocket field notebook became a GIS application.

It should be useful, fast, slightly charming, and extremely easy to understand.

---

# CORE PRODUCT IDEA

The central unit of the application is a **Patch**.

A Patch is a georeferenced observation about pedestrian accessibility.

Example:

> Broken curb ramp
> Difficult
> NW corner of intersection
> "Lip is approximately 3 inches. Wheelchair approach from south looks difficult."

A user should be able to click the map, create that record in seconds, and immediately see it represented spatially.

The application should make adding information feel closer to dropping a sticky note than filling out enterprise GIS metadata.

---

# NOVEL GIS FEATURE: PATH CHECK

In addition to ordinary distance measurement, blipmap should have a small spatial-analysis feature called:

**Path Check**

The user draws a line or short path across the map.

blipmap then checks existing accessibility records near that line and summarizes the likely friction along the path.

For example:

**PATH CHECK**

620 m

3 nearby observations

* 1 difficult obstruction
* 1 rough surface
* 1 accessible crossing

Result:

**CAUTION**

"Two accessibility issues are within 15 m of this path."

This does NOT need sophisticated routing.

Do not build a routing engine.

Use straightforward spatial analysis against the line the user draws.

Use Turf or equivalent geospatial operations to determine which existing point records are within approximately 15 meters of the drawn path.

This little feature is what makes blipmap more than a pin-dropping demo.

---

# TECH STACK

Build this as a modern TypeScript application.

Required:

* React
* TypeScript
* Vite
* native Web Components
* Lit for custom Web Components
* `@lit/react` where useful for React/Web Component integration
* MapLibre GL JS for map rendering
* Turf for lightweight GIS calculations
* IndexedDB for persistence
* `idb` as the IndexedDB helper
* CSS variables and normal CSS for styling
* Vitest for important logic tests

Optional small dependencies are acceptable when they genuinely simplify the implementation.

Avoid unnecessary framework weight.

Do NOT introduce:

* Next.js
* Redux
* Material UI
* Chakra
* Bootstrap
* a large component framework
* a backend
* authentication
* a database server
* Docker
* GraphQL
* an elaborate state-management framework

This should remain a small, quick local application.

---

# MAP

Use MapLibre GL JS.

The application must work without requiring the user to obtain an API key just to launch the demo.

Use a suitable publicly accessible development basemap source with correct attribution.

Isolate the basemap configuration into one file so a production tile provider can be swapped later.

For example:

`src/config/map.ts`

Do not scatter tile URLs throughout the codebase.

The initial map can center on Seattle or another visually useful urban area.

Suggested starting location:

Seattle, Washington.

Approximate center:

* longitude: -122.335
* latitude: 47.608

Initial zoom around neighborhood/city-block scale.

---

# WEB COMPONENT ARCHITECTURE

This requirement is important.

I specifically want this project to demonstrate **Web Components used inside a React application**.

Do not simply create everything as React components.

Create a small, intentional framework-agnostic component layer using Lit.

At minimum create these custom elements:

`<curb-map>`

Owns the MapLibre map surface and map lifecycle.

Responsibilities:

* initialize MapLibre
* destroy it cleanly
* expose selected tool/mode as properties
* display Patch graphics
* display active measurement geometry
* display Path Check geometry
* expose map center/zoom when useful
* emit semantic CustomEvents rather than leaking MapLibre events everywhere

Possible custom events:

* `curb-map-click`
* `curb-map-ready`
* `curb-record-select`
* `curb-measure-change`
* `curb-path-complete`

Use event names that are clear and consistent.

---

`<curb-tool-button>`

Reusable toolbar button.

Properties such as:

* label
* icon
* active
* disabled
* shortcut

Accessible keyboard/focus behavior is required.

---

`<curb-record-card>`

Framework-agnostic display for a Patch.

Properties:

* title
* category
* severity
* status
* selected
* distance if available

It should emit semantic events for selection or actions rather than depending on React internals.

---

`<curb-status-pill>`

Small Web Component for statuses/severity labels.

---

You may create additional custom elements where useful.

React should orchestrate application state, panels, forms, filtering, and application composition.

Lit/Web Components should represent reusable design-system primitives and the map boundary.

Use `@lit/react` wrappers where that creates cleaner React interoperability, especially for custom events and TypeScript typing.

The architecture should make it obvious that these Web Components could later be reused by Angular, Vue, plain HTML, or another framework.

---

# APPLICATION LAYOUT

The map is the application.

Do not make the interface look like a normal dashboard with a map trapped inside a card.

Desktop:

* map occupies nearly the entire viewport
* compact vertical toolbar on left
* small brand area upper left
* records drawer/panel on right
* contextual tool panel near bottom or lower-left
* small statistics/readout area where useful
* floating UI rather than giant permanent chrome

Mobile:

* map remains primary
* toolbar becomes compact
* records panel becomes bottom sheet/drawer
* touch targets at least approximately 44px
* forms must remain usable

---

# VISUAL DESIGN

Make blipmap cute but sophisticated.

Think:

* pocket field notebook
* tiny survey kit
* botanical field-guide restraint
* modern GIS utility
* tactile labels
* rounded controls
* small annotation marks
* subtle grid/paper references
* tiny status dots
* playful microcopy

Do NOT turn it into:

* children's software
* a cartoon
* a giant pastel SaaS dashboard
* glassmorphism everywhere
* neon cyberpunk
* generic Tailwind startup UI

Use a restrained visual system.

Suggested personality:

Warm off-white UI surfaces over the map, dark graphite text, one strong moss/leaf accent, small coral/orange warning accents, muted category colors.

Use CSS custom properties.

For example:

```css
:root {
  --ink: ...;
  --paper: ...;
  --paper-raised: ...;
  --moss: ...;
  --warning: ...;
  --danger: ...;
  --muted: ...;
  --line: ...;
  --radius-sm: ...;
  --radius-md: ...;
  --shadow-float: ...;
}
```

Do not blindly use these exact values. Establish a coherent system.

Use excellent typography.

Use a system font stack or another zero-configuration option rather than introducing a blocking font dependency.

Animations should be short and restrained.

The UI should feel extremely responsive.

---

# BRAND DETAIL

Logo treatment can simply be:

**blipmap**

with a tiny graphic mark resembling:

* a curb corner
* waypoint
* little survey flag
* or bent path

Do not spend excessive engineering time on the logo.

Microcopy can have personality.

Examples:

Empty state:

> Nothing weird here yet.

New Patch:

> Drop a Patch

Measurement:

> Walk the line

Delete confirmation:

> Remove this Patch?

Path Check with no nearby issues:

> Looks pleasantly uneventful.

Use this tone sparingly.

---

# APP MODES

There should be a clear tool state machine.

Modes:

```ts
type MapMode =
  | "browse"
  | "add"
  | "measure"
  | "path-check";
```

Only one interaction mode should be active at once.

ESC returns to browse mode and clears incomplete temporary geometry.

Toolbar:

1. Browse
2. Add Patch
3. Measure
4. Path Check

Potential additional toolbar controls:

* Fit to records
* Import
* Export
* Settings/about

Do not overload the toolbar.

---

# ADD PATCH WORKFLOW

Click:

**Add Patch**

Cursor/interaction state changes.

User clicks the map.

Immediately place a temporary marker.

Open a compact form.

Fields:

### Category

Required.

Options:

* Curb / ramp
* Stairs
* Obstruction
* Surface
* Crossing
* Entrance
* Construction
* Good passage
* Elevator
* Other

Internally use stable slug values.

Example:

```ts
type PatchCategory =
  | "curb-ramp"
  | "stairs"
  | "obstruction"
  | "surface"
  | "crossing"
  | "entrance"
  | "construction"
  | "good-passage"
  | "elevator"
  | "other";
```

### Severity

Required.

Three simple levels:

* Easy
* Caution
* Difficult

For positive observations such as Good Passage, interpretation can simply represent accessibility quality.

### Title

Required.

Short text.

### Notes

Optional textarea.

### Status

* Observed
* Verified
* Resolved

Default:

Observed.

Coordinates should display subtly but should not dominate the form.

Save.

Cancel.

Cancel removes the temporary marker.

Save persists the record.

---

# PATCH DATA MODEL

Create a proper domain model.

Something similar to:

```ts
export interface Patch {
  id: string;
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: {
    title: string;
    category: PatchCategory;
    severity: PatchSeverity;
    status: PatchStatus;
    notes: string;
    createdAt: string;
    updatedAt: string;
  };
}
```

Prefer GeoJSON-compatible structures wherever practical.

Do not create unnecessary GIS abstraction layers.

---

# RECORD INTERACTION

Clicking a marker selects its corresponding Patch.

Selection should:

* visually emphasize marker
* highlight corresponding record card
* open/show record details
* keep map and list selection synchronized

Patch details should show:

* title
* category
* severity
* status
* notes
* coordinates
* created date
* edit action
* delete action

Editing must actually update the map and IndexedDB.

Deleting must actually remove it.

---

# MARKER DESIGN

Do not use generic default MapLibre markers.

Create small custom markers.

Marker appearance should communicate category and/or severity without becoming noisy.

Possible visual language:

* small circular or rounded pin
* icon or category mark in center
* severity ring
* selected halo

Make selected state obvious.

Map remains legible with dozens of records.

---

# RECORDS PANEL

Provide a floating Records panel.

Header:

**Patches**

Show count.

Include:

* text search
* category filter
* severity filter
* status filter

Search title and notes.

Records should update immediately.

Selecting a record card should pan/fly the map to the corresponding feature and select it.

Provide a friendly empty state.

Example:

> Nothing weird here yet. Drop a Patch to start mapping the block.

---

# MEASURE TOOL

Implement a real distance measurement mode.

User chooses:

Measure.

Then clicks multiple points on the map.

Render a polyline.

While measuring, show:

* current segment length
* total length
* number of vertices if useful

Use geodesic/geographic calculations, not screen pixels.

Display sensible units automatically.

Examples:

* 12 m
* 248 m
* 1.4 km

For US-friendly presentation you may optionally provide a metric/imperial toggle.

Default can be metric or a local preference stored in IndexedDB/local state.

Double-click, Enter, or an explicit Finish button completes the measurement.

ESC clears it.

Include a Clear action.

Do not leave the map's normal double-click zoom fighting with the drawing interaction.

---

# PATH CHECK

Implement the signature feature.

Select:

**Path Check**

User clicks two or more points to draw a path.

Upon Finish:

1. Calculate total path distance.
2. Inspect all Patch point features.
3. Calculate each Patch's distance to the drawn line.
4. Include records within approximately 15 meters.
5. Summarize nearby records.

Display results in a compact panel.

Example:

```text
PATH CHECK

742 m

4 observations nearby

1 difficult
2 caution
1 easy

CAUTION

Three potential barriers are close to this path.
```

Also list nearby Patch titles.

Clicking one selects it on the map.

Determine a simple overall result:

### CLEAR

No Caution/Difficult records nearby.

### CAUTION

At least one Caution record nearby.

### DIFFICULT

At least one Difficult record nearby.

Do not pretend this is formal accessibility certification.

This is simply a field-observation summary.

Visually display a subtle buffer or highlighted nearby records if doing so remains performant.

---

# SPATIAL OPERATIONS

Use Turf for operations such as:

* line length
* point-to-line distance
* bounding box
* GeoJSON helpers

Keep spatial-analysis functions separate from UI.

Example:

`src/gis/measure.ts`

`src/gis/pathCheck.ts`

These should be pure functions where practical and have tests.

---

# LOCAL DATA PERSISTENCE

No backend.

Use IndexedDB through `idb`.

Create:

`src/data/db.ts`

Store Patches persistently.

Required operations:

```ts
getPatches()
getPatch(id)
savePatch(patch)
updatePatch(patch)
deletePatch(id)
clearPatches()
```

Use a small versioned database schema.

The application should survive browser reloads.

Do not use a giant state-management package.

React state can mirror IndexedDB data.

---

# SEED DATA

On the first-ever run only, create approximately 6–10 demo records around the initial map location.

These should make the interface immediately interesting.

Examples:

* Missing curb ramp
* Construction narrows sidewalk
* Steep entrance
* Smooth curb cut
* Broken pavement
* Accessible side entrance
* Stairs only
* Wide crossing

Clearly treat them as demo data.

Add an unobtrusive option:

**Clear demo data**

Do not recreate the seed records after the user clears them.

Persist a seed-completed flag.

---

# GEOJSON EXPORT

Provide:

**Export GeoJSON**

Generate a valid GeoJSON FeatureCollection containing all Patch records.

Download filename:

```text
blipmap-patches-YYYY-MM-DD.geojson
```

Include all Patch properties.

---

# GEOJSON IMPORT

Provide:

**Import GeoJSON**

Allow a user to select a `.geojson` or `.json` file.

Validate it.

Accept Point Features that reasonably match the blipmap schema.

Gracefully reject malformed content.

Do not crash.

If imported features lack optional fields, provide sensible defaults.

Generate IDs when necessary.

Show a small success message such as:

> Imported 14 Patches.

If some features were invalid:

> Imported 12 Patches. Skipped 2 invalid records.

---

# FIT TO RECORDS

Provide a useful:

**Fit to Patches**

control.

If records exist, fit the map to their bounding box with sane padding and max zoom.

If there is one record, center on it at an appropriate zoom.

If there are none, do nothing destructive.

---

# KEYBOARD INTERACTIONS

Implement useful keyboard behavior.

At minimum:

* Escape: return to Browse / cancel incomplete drawing
* Enter: finish current measurement/path when reasonable

Do not hijack keyboard events while typing in form controls.

Tooltips can display shortcuts.

---

# ACCESSIBILITY

This is an accessibility-oriented product, so the application itself should not be sloppy.

Implement:

* semantic buttons
* proper labels
* keyboard focus
* visible focus states
* sufficient contrast
* accessible dialog/drawer semantics
* `aria-live` for important creation/import/delete feedback
* sensible heading structure
* icons with labels or accessible names
* no hover-only essential interactions
* touch-friendly controls

Map-specific interactions obviously cannot all be represented perfectly to screen readers, but all surrounding UI should be well implemented.

---

# PERFORMANCE

"Lightning fast" is a real requirement.

The app should feel immediate.

Prioritize:

* minimal dependency weight
* Vite
* no unnecessary rerenders
* no giant UI framework
* no blocking startup operations
* map initialized once
* derived filtered results memoized where useful
* IndexedDB operations kept small
* GeoJSON source updated efficiently
* debounced text search only if necessary
* no expensive calculation on every mousemove unless actually required

Do not prematurely build elaborate performance abstractions.

Just write clean, efficient code.

---

# ERROR HANDLING

The application must have reasonable failure behavior.

Handle:

* map initialization failure
* basemap/network failure
* IndexedDB failure
* malformed import
* empty import
* invalid geometry
* duplicate IDs
* unsupported GeoJSON geometry
* measurement with fewer than two points
* Path Check with fewer than two points

Do not dump raw stack traces into the UI.

Console diagnostics are fine for development.

---

# REPOSITORY STRUCTURE

Use a clean structure approximately like this:

```text
blipmap/
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.json
├── tsconfig.app.json
├── vite.config.ts
├── README.md
├── public/
│   └── ...
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   │
│   ├── app/
│   │   ├── types.ts
│   │   ├── constants.ts
│   │   └── useblipmap.ts
│   │
│   ├── components/
│   │   ├── AppToolbar.tsx
│   │   ├── RecordsPanel.tsx
│   │   ├── PatchForm.tsx
│   │   ├── PatchDetails.tsx
│   │   ├── MeasurePanel.tsx
│   │   ├── PathCheckPanel.tsx
│   │   ├── ImportExportMenu.tsx
│   │   └── ToastRegion.tsx
│   │
│   ├── web-components/
│   │   ├── curb-map.ts
│   │   ├── curb-tool-button.ts
│   │   ├── curb-record-card.ts
│   │   ├── curb-status-pill.ts
│   │   ├── register.ts
│   │   └── react/
│   │       ├── CurbMap.ts
│   │       ├── CurbToolButton.ts
│   │       └── CurbRecordCard.ts
│   │
│   ├── gis/
│   │   ├── geojson.ts
│   │   ├── measure.ts
│   │   ├── pathCheck.ts
│   │   └── bounds.ts
│   │
│   ├── data/
│   │   ├── db.ts
│   │   ├── seed.ts
│   │   └── importExport.ts
│   │
│   ├── config/
│   │   └── map.ts
│   │
│   ├── styles/
│   │   ├── tokens.css
│   │   ├── global.css
│   │   └── app.css
│   │
│   ├── utils/
│   │   ├── ids.ts
│   │   ├── units.ts
│   │   └── dates.ts
│   │
│   └── tests/
│       ├── measure.test.ts
│       ├── pathCheck.test.ts
│       └── geojson.test.ts
└── ...
```

This structure is guidance, not dogma.

If a slightly different structure makes the implementation cleaner, use it.

Do not create dozens of meaningless one-function files.

---

# PACKAGE.JSON

Create a real `package.json`.

Use the latest stable mutually compatible versions available in the environment at implementation time.

Do not leave version placeholders.

Expected dependencies should include the appropriate packages for:

```text
react
react-dom
lit
@lit/react
maplibre-gl
@turf/turf
idb
```

You may use a tiny ID library such as `nanoid`, or use `crypto.randomUUID()` with a fallback.

Dev dependencies should include the normal packages for:

```text
typescript
vite
@vitejs/plugin-react
vitest
@types/react
@types/react-dom
```

Add ESLint only if it is configured properly and does not create unnecessary friction.

The scripts MUST include:

```json
{
  "scripts": {
    "start": "vite",
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  }
}
```

Adjust TypeScript build syntax if the final tsconfig structure requires it, but:

```bash
npm start
```

MUST work.

Do not make the user remember an obscure command.

---

# INSTALLATION

The expected workflow after you finish must be:

```bash
npm install
npm start
```

Then display the local Vite URL.

Production validation:

```bash
npm run build
npm test
```

These must succeed before considering the task complete.

---

# TYPESCRIPT

Use strict TypeScript.

Avoid `any`.

It is acceptable to use narrowly scoped type assertions when dealing with Web Component/custom-event boundaries where TypeScript requires them.

Create explicit domain types for:

* Patch
* PatchCategory
* PatchSeverity
* PatchStatus
* MapMode
* Measurement
* PathCheckResult

Prefer discriminated unions where they simplify state transitions.

---

# WEB COMPONENT EVENTS

Do not create brittle callbacks through DOM properties.

Prefer proper `CustomEvent`s.

Example conceptual shape:

```ts
this.dispatchEvent(
  new CustomEvent("curb-map-click", {
    detail: {
      longitude,
      latitude
    },
    bubbles: true,
    composed: true
  })
);
```

Create typed detail interfaces.

React wrappers should bridge those events cleanly.

---

# MAP DATA

Prefer a GeoJSON source + style layers rather than creating hundreds of individual DOM markers.

For example:

* patch source
* patch circles/symbols
* selected patch source/layer
* measurement source/layer
* path check source/layer

This should make the application feel like a real mapping application rather than a collection of HTML pins floating over a canvas.

DOM markers are acceptable for a temporary insertion marker or truly interactive special case.

---

# STATE MODEL

Keep application state understandable.

Possible high-level state:

```ts
interface AppState {
  mode: MapMode;
  patches: Patch[];
  selectedPatchId: string | null;
  pendingPatchLocation: [number, number] | null;
  measurement: Measurement | null;
  pathCheck: PathCheckResult | null;
  filters: PatchFilters;
}
```

Do not introduce Redux for this.

React hooks/context or a focused application hook are sufficient.

---

# FILTERING

Filters should be combinable.

Search:

* title
* notes

Category:

* all
* specific category

Severity:

* all
* easy
* caution
* difficult

Status:

* all
* observed
* verified
* resolved

The map and records list should reflect the same filtered dataset.

If a selected Patch disappears due to filtering, handle the selection gracefully.

---

# RESPONSIVE EXPERIENCE

Test mentally and visually at roughly:

* 1440px desktop
* 1024px laptop
* 768px tablet
* 390px mobile

Do not simply hide half the application on mobile.

The map should remain useful.

Desktop records panel may become a bottom drawer on narrow screens.

---

# SMALL DETAILS THAT WILL MAKE THIS FEEL FINISHED

Add:

* record count
* subtle map coordinate readout when appropriate
* active-tool indicator
* selected-record animation or highlight
* clean empty states
* little success/error toasts
* loading state while local records initialize
* disabled Finish button until drawing has enough vertices
* hover/focus tooltips
* cursor change during Add / Measure / Path Check
* appropriate map attribution
* confirmation before destructive clear/delete actions

Do not overdo animation.

---

# README

Write a useful README.

Include:

# blipmap

Short product description.

## Why it exists

Explain the micro-accessibility mapping idea.

## Features

List actual implemented features only.

## Stack

Explain:

* React as application shell
* Lit Web Components as framework-independent component layer
* MapLibre as mapping engine
* Turf for spatial calculations
* IndexedDB for local persistence

## Run locally

Exactly:

```bash
npm install
npm start
```

## Build

```bash
npm run build
```

## Test

```bash
npm test
```

## Architecture

Briefly describe the React/Web Component boundary.

## Data

Explain that data is local to the browser and can be exported as GeoJSON.

## Future possibilities

Keep this short.

Possibilities might include:

* shared projects
* photo attachments
* real accessibility routing
* cloud synchronization
* field GPS mode
* organization-specific schemas

Do not describe future features as already implemented.

---

# TESTS

At minimum write tests for pure GIS/domain logic.

### Measurement

Given known coordinates, calculates reasonable distance.

### Path Check

Given a test line and several Points:

* includes points within threshold
* excludes distant points
* computes correct overall classification

### GeoJSON

* exports a valid FeatureCollection
* handles valid imports
* rejects unsupported geometry
* supplies defaults where intended

Do not spend the entire project building an enormous test suite.

Test the pieces where mistakes are expensive or invisible.

---

# QUALITY BAR

I want this to feel like something an experienced frontend/GIS engineer deliberately built.

It should NOT feel like:

* a tutorial
* a hackathon shell
* a CRUD form pasted beside a map
* autogenerated enterprise UI
* a portfolio mockup with fake controls
* a half-working AI prototype

Details matter.

Interaction state matters.

Map behavior matters.

Typography matters.

Spacing matters.

Empty states matter.

Fast startup matters.

Architecture matters.

But resist architecture astronautics.

This is a **small excellent application**.

---

# IMPLEMENTATION ORDER

Use approximately this sequence:

1. Inspect the current repository.
2. Establish Vite + React + TypeScript if needed.
3. Install dependencies.
4. Create domain types.
5. Create map configuration.
6. Build `<curb-map>`.
7. Render map successfully.
8. Create IndexedDB layer.
9. Seed demo data.
10. Render Patches as GeoJSON.
11. Implement selection synchronization.
12. Implement Add Patch workflow.
13. Implement edit/delete.
14. Implement Records panel and filtering.
15. Implement measurement.
16. Implement Path Check.
17. Implement import/export.
18. Build remaining Lit Web Components.
19. Polish responsive UI.
20. Add accessibility improvements.
21. Add tests.
22. Write README.
23. Run tests.
24. Run production build.
25. Launch app and fix any runtime errors.

Do not spend the first half of the task writing documentation before the map works.

Get the map on screen early.

---

# IMPORTANT AUTONOMY INSTRUCTION

Do not stop after generating files.

Actually inspect the files you created.

Run:

```bash
npm install
npm test
npm run build
```

Fix errors.

Then run:

```bash
npm start
```

Confirm from the terminal output that the Vite development server starts correctly.

If your environment lets you inspect the rendered application, do so.

Fix obvious visual/runtime problems you encounter.

Do not tell me:

> "You can now run npm install."

You should run the install yourself if your environment supports terminal execution.

Do not tell me:

> "The remaining functionality can be implemented later."

Implement it now.

Do not leave TODO comments standing in for required behavior.

---

# DEFINITION OF DONE

Before finishing, verify every item:

* [ ] `npm install` succeeds
* [ ] `npm start` launches app
* [ ] production build succeeds
* [ ] tests succeed
* [ ] map renders
* [ ] map can pan and zoom
* [ ] Add Patch works
* [ ] temporary insertion location works
* [ ] record form works
* [ ] patches persist
* [ ] patches render on map
* [ ] patch selection works from map
* [ ] patch selection works from list
* [ ] edit works
* [ ] delete works
* [ ] search works
* [ ] filters work
* [ ] Measure works
* [ ] Path Check works
* [ ] nearby-point spatial calculation works
* [ ] GeoJSON export works
* [ ] GeoJSON import works
* [ ] Fit to Patches works
* [ ] demo data works
* [ ] clear demo data works
* [ ] Web Components are genuinely implemented with Lit
* [ ] Web Components are consumed by React
* [ ] UI works on desktop
* [ ] UI remains usable on mobile
* [ ] keyboard cancellation works
* [ ] focus states exist
* [ ] no fake controls
* [ ] no required API key
* [ ] no obvious console errors
* [ ] README accurately describes the project

If any item fails, continue working until it passes.

---

# FINAL RESPONSE AFTER IMPLEMENTATION

When the application is actually complete, give me a concise report containing:

1. What you built.
2. Important architectural choices.
3. Which Web Components were created.
4. Which GIS operations were implemented.
5. Confirmation that tests passed.
6. Confirmation that production build passed.
7. Exact command to run it:

```bash
npm start
```

Do not give me a long tutorial.

The repository itself is the deliverable.

Now build blipmap.