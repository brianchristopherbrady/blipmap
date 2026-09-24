import type { StyleSpecification } from "maplibre-gl";
import { DEFAULT_REGION_ID, getRegion } from "./regions";

// Only place tile URLs may live — swap here for a production provider
export const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution:
        "© <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors",
    },
  },
  layers: [{ id: "osm-tiles", type: "raster", source: "osm", minzoom: 0, maxzoom: 19 }],
};

export const MAP_CENTER = getRegion(DEFAULT_REGION_ID).map.center;
export const MAP_ZOOM = getRegion(DEFAULT_REGION_ID).map.zoom;
