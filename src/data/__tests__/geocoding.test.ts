import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => vi.resetModules());
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const places = [
  { display_name: "Seattle Central Library", lon: "-122.332", lat: "47.606" },
  { display_name: "Japan result", lon: "139.69", lat: "35.68" },
  { display_name: "Invalid", lon: "bad", lat: "47.6" },
];

describe("address search", () => {
  it("defaults to Seattle, requests more matches, and excludes foreign or invalid coordinates", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(places)));
    vi.stubGlobal("fetch", fetchMock);
    const { geocodePlace } = await import("../geocoding");
    expect(await geocodePlace("Library")).toEqual([{ label: "Seattle Central Library", lng: -122.332, lat: 47.606 }]);
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get("countrycodes")).toBe("us");
    expect(url.searchParams.get("bounded")).toBe("1");
    expect(url.searchParams.get("limit")).toBe("20");
    expect(url.searchParams.get("viewbox")).toBe("-122.46,47.78,-122.22,47.48");
    await geocodePlace("Library");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("allows an explicit worldwide search", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(places)));
    vi.stubGlobal("fetch", fetchMock);
    const { geocodePlace } = await import("../geocoding");
    expect(await geocodePlace("Library", "anywhere")).toHaveLength(2);
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.has("bounded")).toBe(false);
  });
  it("uses Portland configuration rather than Seattle bounds", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      ...places, { display_name: "Portland library", lon: "-122.6765", lat: "45.5231" },
    ])));
    vi.stubGlobal("fetch", fetchMock);
    const { geocodePlace } = await import("../geocoding");
    expect(await geocodePlace("Library", "portland")).toEqual([{ label: "Portland library", lng: -122.6765, lat: 45.5231 }]);
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get("viewbox")).toBe("-122.84,45.66,-122.47,45.43");
  });
  it("does not fetch empty or canceled searches", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { geocodePlace } = await import("../geocoding");
    expect(await geocodePlace(" ")).toEqual([]);
    const controller = new AbortController();
    controller.abort();
    await expect(geocodePlace("Library", "seattle", controller.signal)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("reports provider errors rather than treating them as no matches", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 429 })));
    const { geocodePlace } = await import("../geocoding");
    await expect(geocodePlace("Library")).rejects.toThrow("busy");
  });
  it("spaces uncached searches at least one second apart", async () => {
    vi.useFakeTimers();
    const starts: number[] = [];
    vi.stubGlobal("fetch", vi.fn(() => { starts.push(Date.now()); return Promise.resolve(new Response("[]")); }));
    const { geocodePlace } = await import("../geocoding");
    const requests = Promise.all([geocodePlace("First"), geocodePlace("Second")]);
    await vi.runAllTimersAsync();
    await requests;
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(1000);
  });
});