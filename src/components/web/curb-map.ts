import { LitElement, html, css, unsafeCSS } from "lit";
import { customElement, property } from "lit/decorators.js";
import maplibregl from "maplibre-gl";
import maplibreCss from "maplibre-gl/dist/maplibre-gl.css?inline";
import { MAP_STYLE, MAP_CENTER, MAP_ZOOM } from "../../config/map";
import type { Patch, MapMode } from "../../types/patch";
import { CATEGORY_LABELS, SEVERITY_LABELS, STATUS_LABELS } from "../../types/patch";
import type { Position } from "geojson";

@customElement("curb-map")
export class CurbMap extends LitElement {
  @property({ type: String }) mode: MapMode = "browse";
  @property({ type: Array }) patches: Patch[] = [];
  @property({ type: String }) selectedId: string | null = null;

  private _map: maplibregl.Map | null = null;
  private _tempMarker: maplibregl.Marker | null = null;
  private _drawCoords: Position[] = [];
  private _drawMarkers: maplibregl.Marker[] = [];
  private _tooltip: maplibregl.Popup | null = null;
  private _tooltipId: string | null = null;
  private _tooltipTimer: ReturnType<typeof setTimeout> | undefined;
  private _clusterMarkers: maplibregl.Marker[] = [];
  private _locateMarker: maplibregl.Marker | null = null;
  private _locateTimer: ReturnType<typeof setTimeout> | undefined;
  private _routeMarkers: maplibregl.Marker[] = [];

  static styles = [
    unsafeCSS(maplibreCss),
    css`
      :host { display: block; width: 100%; height: 100%; }
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
    `,
  ];

  render() {
    return html`<div id="map"></div>`;
  }

  override firstUpdated() {
    const container = this.shadowRoot!.querySelector<HTMLDivElement>("#map")!;
    const map = new maplibregl.Map({
      container,
      style: MAP_STYLE,
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    map.once("style.load", () => {
      this._setupSources(map);
      this._setupLayers(map);
      this._updatePatches(map);
      this._updateSelected(map);
      this.dispatchEvent(new CustomEvent("curb-map-ready", { bubbles: true, composed: true }));
    });

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

    this._map = map;
  }

  private _setupSources(map: maplibregl.Map) {
    map.addSource("patches", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50,
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
      paint: { "line-color": "#4a7c59", "line-width": 2, "line-dasharray": [4, 2] },
    });

    // Path check buffer — wide translucent stroke
    map.addLayer({
      id: "draw-buffer-layer",
      type: "line",
      source: "draw-line",
      paint: { "line-color": "#4a7c59", "line-width": 32, "line-opacity": 0.08 },
    });

    // Cluster circles
    map.addLayer({
      id: "patches-clusters",
      type: "circle",
      source: "patches",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#4a7c59",
        "circle-radius": ["step", ["get", "point_count"], 16, 10, 20, 30, 24],
        "circle-opacity": 0.85,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#fff",
      },
    });

    // Cluster count labels via DOM markers — no glyphs source required
    const syncClusterMarkers = () => {
      this._clusterMarkers.forEach((m) => m.remove());
      this._clusterMarkers = [];
      const features = map.queryRenderedFeatures(undefined, { layers: ["patches-clusters"] });
      for (const f of features) {
        if (f.geometry.type !== "Point") continue;
        const el = document.createElement("div");
        el.textContent = String(f.properties?.["point_count_abbreviated"] ?? "");
        el.setAttribute("aria-hidden", "true");
        Object.assign(el.style, {
          color: "#fff", fontSize: "11px", fontWeight: "700",
          pointerEvents: "none", userSelect: "none",
        });
        this._clusterMarkers.push(
          new maplibregl.Marker({ element: el, anchor: "center" })
            .setLngLat(f.geometry.coordinates as [number, number])
            .addTo(map)
        );
      }
    };
    map.on("render", () => { if (map.isSourceLoaded("patches")) syncClusterMarkers(); });

    map.addLayer({
      id: "patches-circle",
      type: "circle",
      source: "patches",
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
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#fff",
        "circle-opacity": 0.9,
      },
    });

    map.addLayer({
      id: "patches-selected",
      type: "circle",
      source: "patches",
      filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "id"], ""]],
      paint: {
        "circle-radius": 14,
        "circle-color": "transparent",
        "circle-stroke-width": 3,
        "circle-stroke-color": "#4a7c59",
      },
    });

    map.on("click", "patches-clusters", (e) => {
      if (this.mode !== "browse") return;
      const features = map.queryRenderedFeatures(e.point, { layers: ["patches-clusters"] });
      if (!features.length) return;
      const clusterId = features[0].properties?.["cluster_id"] as number;
      const src = map.getSource("patches") as maplibregl.GeoJSONSource;
      src.getClusterExpansionZoom(clusterId).then((zoom) => {
        const center = (features[0].geometry as GeoJSON.Point).coordinates as [number, number];
        map.easeTo({ center, zoom });
      }).catch(() => {});
    });

    map.on("click", "patches-circle", (e) => {
      if (this.mode !== "browse") return;
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
        if (this.mode !== "browse") return;
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
          : "Zoom in to explore";
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
        map.getCanvas().style.cursor = this.mode === "browse" ? "" : "crosshair";
        this._tooltipTimer = setTimeout(() => this.dismissTooltip(), 150);
      });
    }
  }

  dismissTooltip() {
    clearTimeout(this._tooltipTimer);
    this._tooltip?.remove();
    this._tooltip = null;
    this._tooltipId = null;
  }

  private _handleClick(e: maplibregl.MapMouseEvent, map: maplibregl.Map) {
    const { lng, lat } = e.lngLat;

    if (this.mode === "add") {
      this.clearTempMarker();
      const el = Object.assign(document.createElement("div"), {
        style: `width:18px;height:18px;border-radius:50%;background:#4a7c59;
                border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3);`,
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
      style: `width:9px;height:9px;border-radius:50%;background:#4a7c59;
              border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.25);`,
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
    if (this._drawCoords.length < 2) return;
    this.dispatchEvent(new CustomEvent("curb-path-complete", {
      detail: { coords: [...this._drawCoords] },
      bubbles: true,
      composed: true,
    }));
  }

  clearDraw() {
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
    this._map?.flyTo({ center: coords, zoom: 16 });
  }

  showRoute(coords: [number, number][], from: [number, number], to: [number, number], bbox?: [number, number, number, number]): void {
    const map = this._map;
    if (!map) return;
    this.clearRoute();

    (map.getSource("route-line") as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: [{ type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: {} }],
    });

    const makePin = (color: string, label: string) => {
      const el = document.createElement("div");
      Object.assign(el.style, {
        width: "20px", height: "20px", borderRadius: "50%",
        background: color, border: "3px solid #fff",
        boxShadow: "0 2px 8px rgba(0,0,0,.3)",
      });
      el.setAttribute("aria-label", label);
      return el;
    };

    this._routeMarkers.push(
      new maplibregl.Marker({ element: makePin("#3b7dd8", "Start"), anchor: "center" }).setLngLat(from).addTo(map),
      new maplibregl.Marker({ element: makePin("#c0392b", "End"), anchor: "center" }).setLngLat(to).addTo(map),
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
          background: "#3b7dd8", border: "3px solid #fff",
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
    src.setData({
      type: "FeatureCollection",
      features: this.patches.map((p) => ({ ...p, properties: { ...p.properties, id: p.id } })),
    });
  }

  private _updateSelected(map: maplibregl.Map) {
    if (!map.getLayer("patches-selected")) return;
    map.setFilter("patches-selected", ["all", ["!", ["has", "point_count"]], ["==", ["get", "id"], this.selectedId ?? ""]]);
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has("mode") || changed.has("patches")) this.dismissTooltip();
    const map = this._map;
    if (!map?.getSource("patches")) return;
    if (changed.has("patches")) this._updatePatches(map);
    if (changed.has("selectedId")) this._updateSelected(map);
    if (changed.has("mode") && this.mode === "browse") {
      this.clearDraw();
      this.clearTempMarker();
      this.clearRoute();
    }
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.dismissTooltip();
    clearTimeout(this._locateTimer);
    this._locateMarker?.remove();
    this._routeMarkers.forEach((m) => m.remove());
    this._clusterMarkers.forEach((m) => m.remove());
    this._clusterMarkers = [];
    this._map?.remove();
    this._map = null;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "curb-map": CurbMap;
  }
}
