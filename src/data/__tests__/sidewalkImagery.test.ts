import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Patch } from "../../types/patch";
import { getMeta } from "../db";
import { resolveSidewalkReports } from "../sidewalkImagery";

vi.mock("../db", () => ({ getMeta: vi.fn() }));

const patch: Patch = {
  id: "project-sidewalk-seattle:12590026", type: "Feature",
  geometry: { type: "Point", coordinates: [-122.3358485407, 47.6058172328] },
  properties: {
    title: "Missing sidewalk", category: "other", severity: "caution", status: "observed", notes: "",
    createdAt: "2026-09-17", updatedAt: "2026-09-17",
    source: {
      provider: "project-sidewalk-seattle", sourceId: "12590026", labelType: "NoSidewalk", importedAt: "2026-09-17",
      averageImageDate: null, averageLabelDate: null, medianSeverity: null, clusterSize: 1,
      agreeCount: null, disagreeCount: null, unsureCount: null,
    },
  },
};
const properties = {
  label_cluster_id: 12590026, label_type: "NoSidewalk", label_ids: [126583],
  labels: [{ label_id: 126583, image_capture_date: "2019-06", pano_url: "javascript:alert(1)" }],
};
const collection = (entries: unknown[] = [properties]) => ({
  type: "FeatureCollection", features: entries.map(value => ({ type: "Feature", properties: value })),
});
const resolve = (value = patch, signal = new AbortController().signal) => resolveSidewalkReports(value, signal);

beforeEach(() => {
  vi.mocked(getMeta).mockResolvedValue(undefined);
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(JSON.stringify(collection()))));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetAllMocks(); });

describe("ephemeral exact Seattle report lookup", () => {
  it("uses the deployed mapping and constructs only the verified fixed-origin report route", async () => {
    expect(await resolve()).toEqual({ total: 1, reports: [{
      labelId: 126583, reportURL: "https://sidewalk-sea.cs.washington.edu/label/126583", imageDate: "2019-06",
    }] });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [input, options] = vi.mocked(fetch).mock.calls[0];
    const url = new URL(String(input));
    expect(url.searchParams.get("includeRawLabels")).toBe("true");
    expect(url.searchParams.get("labelType")).toBe("NoSidewalk");
    const bounds = url.searchParams.get("bbox")!.split(",").map(Number);
    expect(bounds[2] - bounds[0]).toBeCloseTo(0.0002);
    expect(bounds[3] - bounds[1]).toBeCloseTo(0.0002);
    expect(options).toMatchObject({ cache: "no-store", credentials: "omit", redirect: "error" });
  });

  it("uses original snapshot coordinates even after a local move", async () => {
    vi.mocked(getMeta).mockResolvedValue([patch]);
    await resolve({ ...patch, geometry: { type: "Point", coordinates: [0, 0] } });
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain("bbox=-122.335");
  });

  it("deduplicates positive integer IDs, caps three, and ignores supplied hostile URLs", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(collection([{
      ...properties, label_ids: [126583, 126583, 2, 3, 4, 0, -1, 2.5, "5", "https://evil.test", null],
      reportURL: "https://evil.test", imageURL: "javascript:alert(1)",
    }]))));
    const result = await resolve();
    expect(result?.total).toBe(4);
    expect(result?.reports.map(report => report.labelId)).toEqual([126583, 2, 3]);
    expect(JSON.stringify(result)).not.toMatch(/evil|javascript|imageURL|pano_url/);
  });

  it("supports documented raw labels without trusting their URLs or malformed dates", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(collection([{
      ...properties, label_ids: undefined, labels: [{ label_id: 8, image_capture_date: "2019-99", pano_url: "https://evil.test" }],
    }]))));
    expect((await resolve())?.reports).toEqual([{ labelId: 8, reportURL: "https://sidewalk-sea.cs.washington.edu/label/8", imageDate: null }]);
  });

  it.each([
    collection([{ ...properties, label_cluster_id: 123 }]),
    collection([{ ...properties, label_type: "Obstacle" }]),
    collection([properties, properties]), collection([{ ...properties, label_ids: [] }]),
    collection(Array.from({ length: 101 }, () => properties)), null, { features: [] },
  ])("rejects missing, ambiguous, nearby-only or malformed identity", async response => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(response)));
    expect(await resolve()).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not request local, invalid-source, or out-of-Seattle patches", async () => {
    expect(await resolve({ ...patch, properties: { ...patch.properties, source: null } })).toBeNull();
    expect(await resolve({ ...patch, properties: { ...patch.properties, source: { ...patch.properties.source!, sourceId: "../label/1" } } })).toBeNull();
    expect(await resolve({ ...patch, geometry: { type: "Point", coordinates: [0, 0] } })).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["body", "header", "http", "json", "network"])("fails closed on %s errors without retrying", async failure => {
    if (failure === "network") vi.mocked(fetch).mockRejectedValue(new Error("offline"));
    else vi.mocked(fetch).mockResolvedValue(failure === "http" ? new Response("", { status: 503 })
      : failure === "header" ? new Response("{}", { headers: { "content-length": "300000" } })
        : new Response(failure === "body" ? " ".repeat(262145) : "not JSON"));
    expect(await resolve()).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("honors abort before and during lookup", async () => {
    const controller = new AbortController();
    controller.abort();
    expect(await resolve(patch, controller.signal)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    const active = new AbortController();
    vi.mocked(fetch).mockImplementation(() => new Promise(() => undefined));
    const pending = resolve(patch, active.signal);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    active.abort();
    expect(await pending).toBeNull();
    expect(vi.mocked(fetch).mock.calls[0][1]?.signal?.aborted).toBe(true);
  });

  it("times out even if the metadata read stalls", async () => {
    vi.useFakeTimers();
    vi.mocked(getMeta).mockImplementation(() => new Promise(() => undefined));
    const pending = resolve();
    await vi.advanceTimersByTimeAsync(8000);
    expect(await pending).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("times out a stalled source body", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValue(new Response(new ReadableStream()));
    const pending = resolve();
    await vi.advanceTimersByTimeAsync(8000);
    expect(await pending).toBeNull();
    expect(vi.mocked(fetch).mock.calls[0][1]?.signal?.aborted).toBe(true);
  });
});