import { ORS_BASE, ORS_API_KEY } from "../config/routing";
import type { OrsProfileKey } from "../config/routing";
import { getNonDrivingProfile } from "../config/routing";
import { routingOptions, type RoutingRequirements } from "../config/accessRequirements";

export interface GeocodedPlace {
  label: string;
  lng: number;
  lat: number;
}

export interface RouteStep {
  instruction: string;
  distanceM: number;
  durationS: number;
  name?: string;
  type?: number;
  wayPoints?: [number, number];
}

export interface RouteResult {
  coordinates: [number, number][];   // GeoJSON LineString coords
  distanceM: number;
  durationS: number;
  steps: RouteStep[];
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
}

/** Nominatim geocoding — no API key required */
export async function geocodePlace(query: string): Promise<GeocodedPlace[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "1");

  const res = await fetch(url.toString(), {
    headers: { "Accept-Language": "en", "User-Agent": "blipmap/1.0" },
  });
  if (!res.ok) throw new Error(`Geocoding failed: ${res.statusText}`);

  const data = await res.json() as Array<{ display_name: string; lon: string; lat: string }>;
  return data.map((r) => ({
    label: r.display_name,
    lng: parseFloat(r.lon),
    lat: parseFloat(r.lat),
  }));
}

/** ORS directions — requires VITE_ORS_API_KEY env variable */
export async function fetchRoute(
  from: [number, number],
  to: [number, number],
  profile: OrsProfileKey = "foot-walk",
  signal?: AbortSignal,
  requirements: RoutingRequirements = { avoidStairs: false, avoidSteepSlopes: false, avoidRoughSurfaces: false, avoidConstruction: false }
): Promise<RouteResult> {
  const orsProfile = getNonDrivingProfile(profile);
  const options = routingOptions({ ...requirements, routingProfile: profile });
  if (!ORS_API_KEY) throw new Error("No ORS API key. Add VITE_ORS_API_KEY to your .env file.");

  const url = `${ORS_BASE}/v2/directions/${orsProfile}/geojson`;

  const res = await fetch(url, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "Authorization": ORS_API_KEY,
    },
    body: JSON.stringify({
      coordinates: [from, to],
      instructions: true,
      language: "en",
      units: "m",
      geometry_simplify: false,
      options,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Routing failed (${res.status}): ${body || res.statusText}`);
  }

  const geojson = await res.json();
  const returnedProfile = geojson.metadata?.query?.profile;
  if (returnedProfile !== undefined && returnedProfile !== orsProfile) {
    throw new Error("The route provider returned a different travel profile. This route cannot be used.");
  }
  const feature = geojson.features?.[0];
  if (!feature) throw new Error("No route returned.");

  const coords: [number, number][] = feature.geometry.coordinates;
  const summary = feature.properties.summary;
  const segments: Array<{ steps: Array<{
    instruction: string;
    distance: number;
    duration: number;
    name?: string;
    type?: number;
    way_points?: [number, number];
  }> }>
    = feature.properties.segments ?? [];

  const steps: RouteStep[] = segments.flatMap((seg) =>
    seg.steps.map((s) => ({
      instruction: s.instruction,
      distanceM: Math.round(s.distance),
      durationS: Math.round(s.duration),
      name: s.name,
      type: s.type,
      wayPoints: s.way_points,
    }))
  );

  const allLngs = coords.map((c) => c[0]);
  const allLats = coords.map((c) => c[1]);

  return {
    coordinates: coords,
    distanceM: Math.round(summary.distance),
    durationS: Math.round(summary.duration),
    steps,
    bbox: [Math.min(...allLngs), Math.min(...allLats), Math.max(...allLngs), Math.max(...allLats)],
  };
}

export function formatDuration(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h} h ${rem} min` : `${h} h`;
}
