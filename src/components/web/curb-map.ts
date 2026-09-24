import { LitElement, html, css, unsafeCSS } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import * as maplibregl from "maplibre-gl";
import maplibreCss from "maplibre-gl/dist/maplibre-gl.css?inline";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

maplibregl.setWorkerUrl(maplibreWorkerUrl);
import { MAP_STYLE } from "../../config/map";
import { DEFAULT_REGION_ID, getRegion } from "../../config/regions";
import type { Patch, MapMode } from "../../types/patch";
import { CATEGORY_LABELS, SEVERITY_LABELS, STATUS_LABELS } from "../../types/patch";
import type { Position } from "geojson";
import { createElement, ArrowUpRight, ChartNoAxesColumnIncreasing, Ban, Waves, Footprints, DoorOpen, Construction, CircleCheck, ArrowUpDown, MapPin } from "lucide";

const CATEGORY_ICONS = {
  "curb-ramp": ArrowUpRight,
  stairs: ChartNoAxesColumnIncreasing,
  obstruction: Ban,
  surface: Waves,
  crossing: Footprints,
  entrance: DoorOpen,
  construction: Construction,
  "good-passage": CircleCheck,
  elevator: ArrowUpDown,
  other: MapPin,
};

@customElement("curb-map")
export class CurbMap extends LitElement {
  @property({ type: String }) regionId = DEFAULT_REGION_ID;
  @property({ type: String }) mode: MapMode = "browse";
  @property({ type: Array }) patches: Patch[] = [];
  @property({ type: String }) selectedId: string | null = null;
  @state() private _clusterIds: Set<string> | null = null;
  private _clusterRequest = 0;
  private _clusterOverview: { center: [number, number]; zoom: number } | null = null;

  private _map: maplibregl.Map | null = null;
  private _tempMarker: maplibregl.Marker | null = null;
  private _drawCoords: Position[] = [];
  private _drawFinished = false;
  private _drawMarkers: maplibregl.Marker[] = [];
  private _tooltip: maplibregl.Popup | null = null;
  private _tooltipId: string | null = null;
  private _tooltipTimer: ReturnType<typeof setTimeout> | undefined;
  private _clusterMarkers: maplibregl.Marker[] = [];
  private _patchMarkers = new Map<string, maplibregl.Marker>();
  private _locateMarker: maplibregl.Marker | null = null;
  private _locateTimer: ReturnType<typeof setTimeout> | undefined;
  private _routeMarkers: maplibregl.Marker[] = [];
  private _themeQuery = window.matchMedia("(prefers-color-scheme: dark)");
  private _onThemeChange = () => {
    const map = this._map;
    if (!map) return;
    if (map.isStyleLoaded()) this._applyThemePaint(map);
    else map.once("styledata", () => this._applyThemePaint(map));
  };

  // MapLibre canvas paint can't reference CSS vars directly — resolve them from computed style
  private _themeColor(token: string, fallback: string): string {
    const value = getComputedStyle(this).getPropertyValue(token).trim();
    return value || fallback;
  }

  // Clusters/issue markers are browsable while planning a route, not just in Browse mode.
  private get _canBrowseIssues(): boolean {
    return this.mode === "browse" || this.mode === "route";
  }

  static styles = [
    unsafeCSS(maplibreCss),
    css`
      :host { display: block; position: relative; width: 100%; height: 100%; }
      #map { width: 100%; height: 100%; }
      .patch-tooltip .maplibregl-popup-content {
        background: var(--paper-raised);
        color: var(--ink);
        border: 1px solid var(--line);
        border-radius: var(--radius-sm);
        box-shadow: var(--shadow-float);
        font-family: inherit;
        font-size: 0.8rem;
        line-height: 1.5;
        padding: 10px 12px;
        overflow-wrap: anywhere;
      }
      .patch-tooltip .maplibregl-popup-tip { border-top-color: var(--paper-raised); }
      .patch-tooltip strong { display: block; }
      .patch-marker {
        width: 44px;
        height: 44px;
        padding: 4px;
        border: 0;
        background: transparent;
        cursor: pointer;
        display: grid;
        place-items: center;
      }
      .patch-marker__badge {
        box-sizing: border-box;
        width: 36px;
        height: 36px;
        display: grid;
        place-items: center;
        background: var(--paper-raised);
        color: var(--ink);
        border: 3px solid var(--warning);
        border-radius: 50%;
        box-shadow: 0 0 0 1px var(--ink), 0 0 0 3px var(--paper-raised), var(--shadow-float);
        transition: transform var(--motion-fast) var(--motion-easing);
      }
      .patch-marker[data-severity="easy"] .patch-marker__badge { border-color: var(--moss); }
      .patch-marker[data-severity="difficult"] .patch-marker__badge { border-color: var(--danger); }
      .patch-marker svg { width: 20px; height: 20px; pointer-events: none; }
      .patch-marker:hover, .patch-marker:focus-visible, .patch-marker[aria-pressed="true"] { z-index: 1; }
      .patch-marker:hover .patch-marker__badge { transform: scale(1.12); }
      .patch-marker:active .patch-marker__badge { transform: scale(0.95); }
      .patch-marker:focus-visible { outline: 3px solid var(--ink); outline-offset: 2px; border-radius: 50%; }
      .patch-marker[aria-pressed="true"] .patch-marker__badge { outline: 3px solid var(--moss); outline-offset: 4px; }
      .patch-marker:disabled { pointer-events: none; }
      @media (prefers-reduced-motion: reduce) {
        .patch-marker__badge { transition: none; }
      }
    `,
  ];

  render() {
    return html`<div id="map"></div>`;
  }

  override firstUpdated() {
    const container = this.shadowRoot!.querySelector<HTMLDivElement>("#map")!;
    const region = getRegion(this.regionId);
    const map = new maplibregl.Map({
      container,
      style: MAP_STYLE,
      center: region.map.center,
      zoom: region.map.zoom,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: region.units }), "bottom-left");

    map.once("style.load", () => {
      this._setupSources(map);
      this._setupLayers(map);
      this._applyThemePaint(map);
      this._updatePatches(map);
      this._updateSelected(map);
      this.dispatchEvent(new CustomEvent("curb-map-ready", { bubbles: true, composed: true }));
    });
    this._themeQuery.addEventListener("change", this._onThemeChange);

    map.on("click", (e) => this._handleClick(e, map));

    map.on("dblclick", (e) => {
      if (this.mode === "measure" || this.mode === "path-check") {
        e.preventDefault();
        this.finishDrawing();
      }
    });

    map.on("mousemove", () => {
      const drawing = this.mode === "add" || this.mode === "measure" || this.mode === "path-check";
      map.getCanvas().style.cursor = drawing ? "crosshair" : "";
    });
    map.on("movestart", () => this.dismissTooltip());
    map.on("zoomend", () => {
      if (this._clusterOverview && map.getZoom() <= this._clusterOverview.zoom && map.getZoom() < map.getMaxZoom()) this._clearClusterFocus();
    });

    this._map = map;
  }

  private _setupSources(map: maplibregl.Map) {
    map.addSource("patches", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
      cluster: true,
      maxzoom: 23,
      clusterMaxZoom: 22,
      clusterRadius: 100,
    });
    map.addSource("patch-details", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addSource("draw-line", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addSource("route-line", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }

  private _setupLayers(map: maplibregl.Map) {
    // Route line drawn below all other overlays
    map.addLayer({
      id: "route-casing",
      type: "line",
      source: "route-line",
      paint: { "line-color": "#fff", "line-width": 8, "line-opacity": 0.7 },
    });
    map.addLayer({
      id: "route-line-layer",
      type: "line",
      source: "route-line",
      paint: { "line-color": "#3b7dd8", "line-width": 5 },
    });

    map.addLayer({
      id: "draw-line-layer",
      type: "line",
      source: "draw-line",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#0060ff", "line-width": 4, "line-dasharray": [3, 2] },
    });

    // Path check buffer — wide translucent stroke
    map.addLayer({
      id: "draw-buffer-layer",
      type: "line",
      source: "draw-line",
      paint: { "line-color": "#0060ff", "line-width": 32, "line-opacity": 0.08 },
    });

    // Cluster circles
    map.addLayer({
      id: "patches-clusters",
      type: "circle",
      source: "patches",
      paint: {
        "circle-color": "#4a7c59",
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"],
          12, ["interpolate", ["linear"], ["coalesce", ["get", "point_count"], 1], 1, 22, 12, 26, 25, 29, 100, 34],
          18, ["interpolate", ["linear"], ["coalesce", ["get", "point_count"], 1], 1, 26, 12, 30, 25, 33, 100, 38],
          22, ["interpolate", ["linear"], ["coalesce", ["get", "point_count"], 1], 1, 28, 12, 32, 25, 35, 100, 38],
        ],
        "circle-opacity": 0.85,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#fff",
      },
    });
    // Actual paint colors are set from resolved CSS tokens in _applyThemePaint below.

    // Cluster count labels via DOM markers — no glyphs source required
    const syncClusterMarkers = () => {
      this._clusterMarkers.forEach((m) => m.remove());
      this._clusterMarkers = [];
      const features = map.queryRenderedFeatures(undefined, { layers: ["patches-clusters"] });
      for (const f of features) {
        if (f.geometry.type !== "Point") continue;
        const el = document.createElement("div");
        el.textContent = String(f.properties?.["point_count_abbreviated"] ?? 1);
        el.setAttribute("aria-hidden", "true");
        Object.assign(el.style, {
          color: this._themeColor("--on-accent", "#fff"),
          fontSize: `${Math.min(15, Math.max(13, 13 + (map.getZoom() - 12) / 3))}px`, fontWeight: "700",
          pointerEvents: "none", userSelect: "none",
        });
        this._clusterMarkers.push(
          new maplibregl.Marker({ element: el, anchor: "center" })
            .setLngLat(f.geometry.coordinates as [number, number])
            .addTo(map)
        );
      }
    };
    map.on("render", () => {
      if (map.isSourceLoaded("patches")) {
        syncClusterMarkers();
        this._syncPatchMarkers(map);
      }
    });

    map.addLayer({
      id: "patches-circle",
      type: "circle",
      source: "patch-details",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-radius": 8,
        "circle-color": [
          "match", ["get", "severity"],
          "easy", "#4a7c59",
          "caution", "#d4732a",
          "difficult", "#c0392b",
          "#888",
        ],
        "circle-stroke-width": 0,
        "circle-stroke-color": "#fff",
        "circle-opacity": 0,
      },
    });

    map.addLayer({
      id: "patches-selected",
      type: "circle",
      source: "patch-details",
      filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "id"], ""]],
      paint: {
        "circle-radius": 24,
        "circle-color": "transparent",
        "circle-stroke-width": 3,
        "circle-stroke-color": "#4a7c59",
      },
    });

    map.on("click", "patches-clusters", (e) => {
      if (!this._canBrowseIssues) return;
      const features = map.queryRenderedFeatures(e.point, { layers: ["patches-clusters"] });
      if (!features.length) return;
      const clusterId = features[0].properties?.["cluster_id"] as number;
      const src = map.getSource("patches") as maplibregl.GeoJSONSource;
      const request = ++this._clusterRequest;
      const patches = this.patches;
      const count = Number(features[0].properties?.["point_count"] ?? 1);
      const leavesPromise = features[0].properties?.["point_count"]
        ? src.getClusterLeaves(clusterId, count, 0)
        : Promise.resolve([features[0]]);
      const zoomPromise = count > 6
        ? src.getClusterExpansionZoom(clusterId)
        : Promise.resolve(Math.max(map.getZoom() + 1, 15));
      Promise.all([leavesPromise, zoomPromise]).then(([leaves, zoom]) => {
        if (request !== this._clusterRequest || this._map !== map || !this._canBrowseIssues || this.patches !== patches) return;
        this._clusterOverview ??= { center: map.getCenter().toArray(), zoom: map.getZoom() };
        this._clusterIds = new Set(leaves.map(leaf => String(leaf.properties?.["id"])));
        this.dispatchEvent(new CustomEvent<{ ids: string[] | null }>("curb-group-change", {
          detail: { ids: [...this._clusterIds] }, bubbles: true, composed: true,
        }));
        this.dismissTooltip();
        this._updatePatches(map);
        const center = (features[0].geometry as GeoJSON.Point).coordinates as [number, number];
        map.easeTo({ center, zoom: Math.min(map.getMaxZoom(), zoom) });
      }).catch(() => {});
    });

    map.on("click", "patches-circle", (e) => {
      if (!this._canBrowseIssues) return;
      const id = e.features?.[0]?.properties?.["id"] as string | undefined;
      if (!id) return;
      this.dismissTooltip();
      map.getCanvas().focus();
      this.dispatchEvent(new CustomEvent<{ id: string }>("curb-record-select", {
        detail: { id },
        bubbles: true,
        composed: true,
      }));
    });

    for (const layer of ["patches-circle", "patches-clusters"]) {
      map.on("mousemove", layer, (event) => {
        if (!this._canBrowseIssues) return;
        map.getCanvas().style.cursor = "pointer";
        const feature = event.features?.[0];
        if (!feature || feature.geometry.type !== "Point") return;
        const patch = this.patches.find((item) => item.id === feature.properties?.["id"]);
        const tooltipId = patch?.id ?? `cluster-${feature.properties?.["cluster_id"]}`;
        clearTimeout(this._tooltipTimer);
        if (this._tooltipId === tooltipId) return;
        this.dismissTooltip();
        const content = document.createElement("div");
        content.setAttribute("role", "tooltip");
        const title = document.createElement("strong");
        title.textContent = patch?.properties.title ?? `${feature.properties?.["point_count"]} patches`;
        const summary = document.createElement("span");
        summary.textContent = patch
          ? `${CATEGORY_LABELS[patch.properties.category]} · ${SEVERITY_LABELS[patch.properties.severity]} · ${STATUS_LABELS[patch.properties.status]}`
          : "Click to show this group's issues";
        content.append(title, summary);
        content.addEventListener("mouseenter", () => clearTimeout(this._tooltipTimer));
        content.addEventListener("mouseleave", () => this.dismissTooltip());
        this._tooltip = new maplibregl.Popup({
          closeButton: false, closeOnClick: true, focusAfterOpen: false,
          anchor: "bottom", offset: 18, maxWidth: "260px", className: "patch-tooltip",
        }).setLngLat(feature.geometry.coordinates as [number, number]).setDOMContent(content).addTo(map);
        this._tooltipId = tooltipId;
      });
      map.on("mouseleave", layer, () => {
        map.getCanvas().style.cursor = this._canBrowseIssues ? "" : "crosshair";
        this._tooltipTimer = setTimeout(() => this.dismissTooltip(), 150);
      });
    }
  }

  // Canvas layers can't read CSS custom properties, so re-resolve and repaint on theme change
  private _applyThemePaint(map: maplibregl.Map) {
    const moss = this._themeColor("--moss", "#4a7c59");
    const warning = this._themeColor("--warning", "#d4732a");
    const danger = this._themeColor("--danger", "#c0392b");
    const route = this._themeColor("--route", "#3b7dd8");
    const draw = this._themeColor("--draw", "#0060ff");
    const paperRaised = this._themeColor("--paper-raised", "#fff");

    map.setPaintProperty("route-casing", "line-color", paperRaised);
    map.setPaintProperty("route-line-layer", "line-color", route);
    map.setPaintProperty("draw-line-layer", "line-color", draw);
    map.setPaintProperty("draw-buffer-layer", "line-color", draw);
    map.setPaintProperty("patches-clusters", "circle-color", moss);
    map.setPaintProperty("patches-clusters", "circle-stroke-color", paperRaised);
    map.setPaintProperty("patches-circle", "circle-color", [
      "match", ["get", "severity"],
      "easy", moss,
      "caution", warning,
      "difficult", danger,
      "#888",
    ]);
    map.setPaintProperty("patches-circle", "circle-stroke-color", paperRaised);
    map.setPaintProperty("patches-selected", "circle-stroke-color", moss);
  }

  dismissTooltip() {
    clearTimeout(this._tooltipTimer);
    this._tooltip?.remove();
    this._tooltip = null;
    this._tooltipId = null;
  }

  returnToGroups() {
    this._clearClusterFocus(true);
  }

  private _clearClusterFocus(restoreView = false) {
    this._clusterRequest++;
    if (!this._clusterIds) return;
    const overview = this._clusterOverview;
    this._clusterIds = null;
    this.dispatchEvent(new CustomEvent<{ ids: string[] | null }>("curb-group-change", {
      detail: { ids: null }, bubbles: true, composed: true,
    }));
    this._clusterOverview = null;
    const map = this._map;
    if (!map) return;
    this._updatePatches(map);
    if (restoreView && overview) {
      map.getCanvas().focus();
      map.easeTo(overview);
    }
  }

  private _syncPatchMarkers(map: maplibregl.Map) {
    const visible = new Set<string>();
    const patches = new Map(this.patches.map(patch => [patch.id, patch]));
    for (const feature of map.queryRenderedFeatures(undefined, { layers: ["patches-circle"] })) {
      const id = feature.properties?.["id"] as string;
      const patch = patches.get(id);
      if (!patch || visible.has(id) || feature.geometry.type !== "Point") continue;
      visible.add(id);
      let marker = this._patchMarkers.get(id);
      if (!marker) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "patch-marker";
        button.addEventListener("click", event => {
          event.stopPropagation();
          if (!this._canBrowseIssues) return;
          this.dismissTooltip();
          this.dispatchEvent(new CustomEvent<{ id: string }>("curb-record-select", {
            detail: { id }, bubbles: true, composed: true,
          }));
        });
        marker = new maplibregl.Marker({ element: button, anchor: "center" })
          .setLngLat(feature.geometry.coordinates as [number, number]).addTo(map);
        this._patchMarkers.set(id, marker);
      }
      const button = marker.getElement() as HTMLButtonElement;
      const { category, severity, title } = patch.properties;
      if (button.dataset.category !== category) {
        const badge = document.createElement("span");
        badge.className = "patch-marker__badge";
        badge.setAttribute("aria-hidden", "true");
        badge.append(createElement(CATEGORY_ICONS[category]));
        button.replaceChildren(badge);
        button.dataset.category = category;
      }
      button.dataset.severity = severity;
      button.setAttribute("aria-label", `Open issue: ${title}. ${CATEGORY_LABELS[category]}. ${SEVERITY_LABELS[severity]}.`);
      button.setAttribute("aria-pressed", String(this.selectedId === id));
      button.title = `${CATEGORY_LABELS[category]}: ${title} (${SEVERITY_LABELS[severity]})`;
      button.disabled = !this._canBrowseIssues;
      marker.setLngLat(feature.geometry.coordinates as [number, number]);
    }
    for (const [id, marker] of this._patchMarkers) {
      if (!visible.has(id)) {
        marker.remove();
        this._patchMarkers.delete(id);
      }
    }
  }

  private _handleClick(e: maplibregl.MapMouseEvent, map: maplibregl.Map) {
    const { lng, lat } = e.lngLat;

    if (this.mode === "add") {
      this.clearTempMarker();
      const el = Object.assign(document.createElement("div"), {
        style: `width:18px;height:18px;border-radius:50%;background:${this._themeColor("--moss", "#4a7c59")};
                border:3px solid ${this._themeColor("--paper-raised", "#fff")};box-shadow:0 2px 8px rgba(0,0,0,.3);`,
      });
      this._tempMarker = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([lng, lat]).addTo(map);
      this.dispatchEvent(new CustomEvent("curb-map-click", {
        detail: { lng, lat },
        bubbles: true,
        composed: true,
      }));
      return;
    }

    if (this.mode === "measure" || this.mode === "path-check") {
      if (this._drawFinished) return;
      this._drawCoords.push([lng, lat]);
      this._addVertex(map, [lng, lat]);
      this._updateLine(map);
      this.dispatchEvent(new CustomEvent("curb-measure-change", {
        detail: { coords: [...this._drawCoords] },
        bubbles: true,
        composed: true,
      }));
    }
  }

  private _addVertex(map: maplibregl.Map, coords: [number, number]) {
    const el = Object.assign(document.createElement("div"), {
      style: `width:10px;height:10px;border-radius:50%;background:${this._themeColor("--draw", "#0060ff")};
              border:2px solid ${this._themeColor("--paper-raised", "#fff")};box-shadow:0 1px 4px rgba(0,0,0,.25);`,
    });
    this._drawMarkers.push(
      new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat(coords).addTo(map)
    );
  }

  private _updateLine(map: maplibregl.Map) {
    if (this._drawCoords.length < 2) return;
    (map.getSource("draw-line") as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: [{ type: "Feature", geometry: { type: "LineString", coordinates: this._drawCoords }, properties: {} }],
    });
  }

  finishDrawing() {
    if (this._drawCoords.length < 2 || this._drawFinished) return;
    this._drawFinished = true;
    this.dispatchEvent(new CustomEvent("curb-path-complete", {
      detail: { coords: [...this._drawCoords] },
      bubbles: true,
      composed: true,
    }));
  }

  clearDraw() {
    this._drawFinished = false;
    this._drawCoords = [];
    this._drawMarkers.forEach((m) => m.remove());
    this._drawMarkers = [];
    const src = this._map?.getSource("draw-line") as maplibregl.GeoJSONSource | undefined;
    src?.setData({ type: "FeatureCollection", features: [] });
  }

  clearTempMarker() {
    this._tempMarker?.remove();
    this._tempMarker = null;
  }

  flyTo(coords: [number, number]) {
    const map = this._map;
    if (!map) return;
    // Never zoom back OUT to 16 — selecting a patch inside an already
    // drilled-down cluster group (zoomed in past 16) would otherwise fly the
    // camera back out, tripping the zoomend listener that clears cluster
    // focus and silently closes the "Selected group" panel underneath the
    // user.
    map.flyTo({ center: coords, zoom: Math.max(map.getZoom(), 16) });
  }

  showRoute(coords: [number, number][], from: [number, number], to: [number, number], bbox?: [number, number, number, number]): void {
    const map = this._map;
    if (!map) return;
    this.clearRoute();

    (map.getSource("route-line") as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: [{ type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: {} }],
    });

    const paperRaised = this._themeColor("--paper-raised", "#fff");
    const makePin = (color: string, label: string) => {
      const el = document.createElement("div");
      Object.assign(el.style, {
        width: "20px", height: "20px", borderRadius: "50%",
        background: color, border: `3px solid ${paperRaised}`,
        boxShadow: "0 2px 8px rgba(0,0,0,.3)",
      });
      el.setAttribute("aria-label", label);
      return el;
    };

    this._routeMarkers.push(
      new maplibregl.Marker({ element: makePin(this._themeColor("--route", "#3b7dd8"), "Start"), anchor: "center" }).setLngLat(from).addTo(map),
      new maplibregl.Marker({ element: makePin(this._themeColor("--danger", "#c0392b"), "End"), anchor: "center" }).setLngLat(to).addTo(map),
    );

    if (bbox) {
      map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 60, maxZoom: 17 });
    }
  }

  clearRoute(): void {
    this._routeMarkers.forEach((m) => m.remove());
    this._routeMarkers = [];
    const src = this._map?.getSource("route-line") as maplibregl.GeoJSONSource | undefined;
    src?.setData({ type: "FeatureCollection", features: [] });
  }

  locateMe(): void {
    if (!this._map || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { longitude, latitude, accuracy } = pos.coords;
        this._locateMarker?.remove();
        clearTimeout(this._locateTimer);

        // Blue dot marker
        const dot = document.createElement("div");
        Object.assign(dot.style, {
          width: "16px", height: "16px", borderRadius: "50%",
          background: this._themeColor("--route", "#3b7dd8"), border: `3px solid ${this._themeColor("--paper-raised", "#fff")}`,
          boxShadow: "0 1px 6px rgba(0,0,0,.35)",
        });
        dot.setAttribute("aria-label", "Your location");

        this._locateMarker = new maplibregl.Marker({ element: dot, anchor: "center" })
          .setLngLat([longitude, latitude])
          .addTo(this._map!);

        this._map!.flyTo({ center: [longitude, latitude], zoom: 16 });

        this.dispatchEvent(new CustomEvent("curb-map-center", {
          detail: { lng: longitude, lat: latitude, accuracy },
          bubbles: true, composed: true,
        }));

        // Remove locate marker after 20 s so it doesn't clutter the map
        this._locateTimer = setTimeout(() => {
          this._locateMarker?.remove();
          this._locateMarker = null;
        }, 20_000);
      },
      () => {
        this.dispatchEvent(new CustomEvent("curb-locate-error", { bubbles: true, composed: true }));
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  fitToPatches(patches: Patch[], padding = 64) {
    if (!this._map || patches.length === 0) return;
    if (patches.length === 1) {
      this.flyTo(patches[0].geometry.coordinates as [number, number]);
      return;
    }
    const lngs = patches.map((p) => p.geometry.coordinates[0]);
    const lats = patches.map((p) => p.geometry.coordinates[1]);
    this._map.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding, maxZoom: 17 }
    );
  }

  private _updatePatches(map: maplibregl.Map) {
    const src = map.getSource("patches") as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    // embed id in properties so layer expressions can access it
    const data: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: this.patches.filter(patch => !this._clusterIds || this._clusterIds.has(patch.id))
        .map((p) => ({ ...p, properties: { ...p.properties, id: p.id } })),
    };
    src.setData(data);
    const details = map.getSource("patch-details") as maplibregl.GeoJSONSource;
    const showDetails = this._clusterIds !== null && this._clusterIds.size <= 6;
    details.setData(showDetails ? data : { type: "FeatureCollection", features: [] });
    map.setLayoutProperty("patches-clusters", "visibility", showDetails ? "none" : "visible");
  }

  private _updateSelected(map: maplibregl.Map) {
    if (!map.getLayer("patches-selected")) return;
    map.setFilter("patches-selected", ["all", ["!", ["has", "point_count"]], ["==", ["get", "id"], this.selectedId ?? ""]]);
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has("mode") || changed.has("patches")) this.dismissTooltip();
    const map = this._map;
    if (!map?.getSource("patches")) return;
    if (changed.has("mode")) this._clusterRequest++;
    if (changed.has("patches") ||
      (changed.has("selectedId") && this.selectedId && !this._clusterIds?.has(this.selectedId))) {
      this._clearClusterFocus();
    }
    if (changed.has("patches")) this._updatePatches(map);
    if (changed.has("selectedId")) this._updateSelected(map);
    if (changed.has("mode") || changed.has("selectedId")) this._syncPatchMarkers(map);
    if (changed.has("mode")) {
      this.clearDraw();
      this.clearTempMarker();
      if (this.mode === "browse") this.clearRoute();
    }
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._themeQuery.removeEventListener("change", this._onThemeChange);
    this.dismissTooltip();
    clearTimeout(this._locateTimer);
    this._locateMarker?.remove();
    this._routeMarkers.forEach((m) => m.remove());
    this._clusterMarkers.forEach((m) => m.remove());
    this._clusterMarkers = [];
    this._patchMarkers.forEach(marker => marker.remove());
    this._patchMarkers.clear();
    this._map?.remove();
    this._map = null;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "curb-map": CurbMap;
  }
}
