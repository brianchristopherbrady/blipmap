---
name: maplibre-rendering
description: "Use when working with MapLibre GL JS in blipmap: managing GeoJSON sources and layers, adding custom marker elements, handling map events, updating patch geometry, fitting the viewport, or debugging tile/render issues."
---

# MapLibre Rendering in blipmap

## When to Use
- Adding a new map layer or source
- Creating or updating custom patch markers
- Wiring map click/hover events to React state
- Implementing fit-to-bounds for patch collections
- Debugging blank map, tile 404s, or layer ordering issues

## Source + Layer Pattern

blipmap keeps patches in a single GeoJSON source that is updated in-place:

```ts
// Add source (once, on map ready)
map.addSource("patches", {
  type: "geojson",
  data: { type: "FeatureCollection", features: [] },
});

// Add layer(s) referencing the source
map.addLayer({
  id: "patches-circle",
  type: "circle",
  source: "patches",
  paint: {
    "circle-radius": 8,
    "circle-color": [
      "match", ["get", "severity"],
      "easy",      "#4a7c59",   // --moss
      "caution",   "#d4732a",   // --warning
      "difficult", "#c0392b",   // --danger
      "#888888"
    ],
    "circle-stroke-width": 2,
    "circle-stroke-color": "#ffffff",
  },
});

// Update when patches change (efficient in-place update)
(map.getSource("patches") as maplibregl.GeoJSONSource).setData({
  type: "FeatureCollection",
  features: patches,  // Patch[] is already GeoJSON Feature[]
});
```

## Custom Markers

For the selected/add-mode marker, use `maplibregl.Marker` with a custom element:

```ts
const el = document.createElement("div");
el.className = "curb-marker curb-marker--temp";
const marker = new maplibregl.Marker({ element: el, anchor: "center" })
  .setLngLat([lng, lat])
  .addTo(map);

// Remove when form is cancelled
marker.remove();
```

Style `.curb-marker` with CSS variables, not inline styles.

## Map Event → React Pattern

`<curb-map>` translates MapLibre events into typed CustomEvents:

```ts
// Inside curb-map.ts (Lit)
map.on("click", (e) => {
  this.dispatchEvent(new CustomEvent("curb-map-click", {
    detail: { lng: e.lngLat.lng, lat: e.lngLat.lat },
    bubbles: true, composed: true,
  }));
});
```

React then receives this through the `@lit/react` wrapper's `onMapClick` prop. Never handle map events directly in React components — always go through the Lit boundary.

## Fit to Patches

```ts
import bbox from "@turf/bbox";
import { featureCollection } from "@turf/helpers";

const box = bbox(featureCollection(patches));
// box: [minLng, minLat, maxLng, maxLat]
map.fitBounds(
  [[box[0], box[1]], [box[2], box[3]]],
  { padding: 60, maxZoom: 17, animate: true }
);
```

If there is exactly one patch, use `map.flyTo({ center, zoom: 16 })` instead.

## Tile Configuration

The basemap tile URL lives **only** in `src/config/map.ts`:

```ts
export const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm-tiles", type: "raster", source: "osm" }],
};
```

Never add tile URLs anywhere else. Never hardcode zoom/center outside `src/config/map.ts`.

## Layer Z-Order

MapLibre renders layers in declaration order (first = bottom). Order:
1. Basemap tiles
2. Path Check buffer polygon (if shown)
3. Measure polyline
4. Patch circles
5. Selected patch halo
6. Temporary add-mode marker (DOM element, always on top)

## Common Mistakes

- Calling `map.addSource` or `map.addLayer` before `map.on("load", ...)` fires — results in silent errors.
- Not calling `marker.remove()` on form cancel — leaves orphaned markers.
- Using `map.on("dblclick")` without `e.preventDefault()` — fights with MapLibre's default double-click zoom.
- Accessing `map.getSource(...)` when the source does not exist yet — check with `map.getSource("patches") !== undefined`.
