import type { StyleSpecification } from "maplibre-gl";

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

export const MAP_CENTER: [number, number] = [-122.335, 47.608]; // Seattle
export const MAP_ZOOM = 14;
