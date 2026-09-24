import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMeta, setMeta, syncSourcePatches } from "../db";
import { refreshSeattleBaseline, SEATTLE_REFRESH_MS, SEATTLE_RETRY_MS } from "../seattleBaseline";

vi.mock("../db", () => ({ getMeta: vi.fn(), setMeta: vi.fn(), syncSourcePatches: vi.fn() }));

const response = { type: "FeatureCollection", features: [{
  type: "Feature", geometry: { type: "Point", coordinates: [-122.335, 47.608] },
  properties: { label_cluster_id: 123, label_type: "NoCurbRamp", median_severity: 3 },
}] };
let metadata: Map<string, unknown>;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-17T12:00:00Z"));
  metadata = new Map();
  vi.mocked(getMeta).mockImplementation(async key => metadata.get(key));
  vi.mocked(setMeta).mockImplementation(async (key, value) => { metadata.set(key, value); });
  vi.mocked(syncSourcePatches).mockImplementation(async (_patches, date) => {
    metadata.set("seattle:lastSuccess", date);
    return { id: "fixture", regionId: "seattle", sourceId: "project-sidewalk-seattle", importedAt: date, sourceVersion: null,
      added: 1, modified: 0, unchanged: 0, apparentRemovals: [], duplicates: 0, rejected: 0 };
  });
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(JSON.stringify(response))));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("automatic Seattle refresh", () => {
  it("fetches on first use and coalesces concurrent callers", async () => {
    const [first, second] = await Promise.all([refreshSeattleBaseline(), refreshSeattleBaseline()]);
    expect(first).toEqual(second);
    expect(first.refreshed).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(syncSourcePatches).toHaveBeenCalledTimes(1);
  });
  it("uses the cache until the daily refresh deadline, including across calls", async () => {
    await refreshSeattleBaseline();
    vi.advanceTimersByTime(SEATTLE_REFRESH_MS - 1);
    expect((await refreshSeattleBaseline()).refreshed).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect((await refreshSeattleBaseline()).refreshed).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("backs off failures and retries after one hour without advancing success", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
    await expect(refreshSeattleBaseline()).rejects.toThrow("offline");
    expect(metadata.has("seattle:lastSuccess")).toBe(false);
    expect((await refreshSeattleBaseline()).retryPending).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(SEATTLE_RETRY_MS);
    expect((await refreshSeattleBaseline()).refreshed).toBe(true);
  });
  it("does not synchronize partial or empty results", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ ...response, features: [] })));
    await expect(refreshSeattleBaseline()).rejects.toThrow("No usable");
    vi.advanceTimersByTime(SEATTLE_RETRY_MS);
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ ...response, features: [...response.features, null] })));
    await expect(refreshSeattleBaseline()).rejects.toThrow("invalid records");
    expect(syncSourcePatches).not.toHaveBeenCalled();
  });

  it.each([429, 500])("keeps cached data on provider HTTP %s", async status => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("", { status }));
    await expect(refreshSeattleBaseline()).rejects.toThrow();
    expect(syncSourcePatches).not.toHaveBeenCalled();
    expect(metadata.has("seattle:lastSuccess")).toBe(false);
  });

  it("times out a stalled request and releases the single-flight guard", async () => {
    vi.mocked(fetch).mockImplementationOnce((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
    }));
    const pending = expect(refreshSeattleBaseline()).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(60000);
    await pending;
    vi.advanceTimersByTime(SEATTLE_RETRY_MS);
    expect((await refreshSeattleBaseline()).refreshed).toBe(true);
  });
});