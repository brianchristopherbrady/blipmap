import { DEFAULT_REGION_ID, getRegion, UNASSIGNED_REGION_ID, withinBounds } from "../config/regions";

export interface GeocodedPlace {
  label: string;
  lng: number;
  lat: number;
}

export type SearchArea = string;

const cache = new Map<string, GeocodedPlace[]>();
let queue: Promise<unknown> = Promise.resolve();
let lastRequest = 0;

export function geocodePlace(query: string, area: SearchArea = DEFAULT_REGION_ID, signal?: AbortSignal): Promise<GeocodedPlace[]> {
  const text = query.trim();
  if (!text) return Promise.resolve([]);
  const region = area === "anywhere" || area === UNASSIGNED_REGION_ID ? null : getRegion(area);
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", text);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "20");
  url.searchParams.set("addressdetails", "1");
  if (region) {
    if (region.jurisdiction.countryCode) url.searchParams.set("countrycodes", region.jurisdiction.countryCode);
    const [west, south, east, north] = region.boundary.bbox;
    url.searchParams.set("viewbox", [west, north, east, south].join(","));
    url.searchParams.set("bounded", "1");
  }
  const key = url.toString();
  const request = queue.catch(() => undefined).then(async () => {
    signal?.throwIfAborted();
    const cached = cache.get(key);
    if (cached) return cached;
    const delay = Math.max(0, 1100 - (Date.now() - lastRequest));
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    signal?.throwIfAborted();
    lastRequest = Date.now();
    const response = await fetch(key, { signal, headers: { "Accept-Language": "en" } });
    if (!response.ok) throw new Error(response.status === 429 ? "Address search is busy. Try again shortly." : "Address search is unavailable. Please try again.");
    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw new Error("Address search returned an invalid response.");
    const results: GeocodedPlace[] = [];
    for (const item of data) {
      if (!item || typeof item !== "object" || typeof item.display_name !== "string" || !item.display_name.trim()) continue;
      if (!String(item.lon ?? "").trim() || !String(item.lat ?? "").trim()) continue;
      const lng = Number(item.lon);
      const lat = Number(item.lat);
      if (!Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lng) > 180 || Math.abs(lat) > 90) continue;
      if (region && !withinBounds([lng, lat], region.boundary.bbox)) continue;
      results.push({ label: item.display_name, lng, lat });
    }
    signal?.throwIfAborted();
    if (cache.size >= 30) cache.delete(cache.keys().next().value!);
    cache.set(key, results);
    return results;
  });
  queue = request;
  return request;
}