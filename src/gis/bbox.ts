import bbox from "@turf/bbox";
import { featureCollection } from "@turf/helpers";
import type { Patch } from "../types/patch";
import type { BBox } from "geojson";

export function patchesBBox(patches: Patch[]): BBox | null {
  if (patches.length === 0) return null;
  return bbox(featureCollection(patches));
}
