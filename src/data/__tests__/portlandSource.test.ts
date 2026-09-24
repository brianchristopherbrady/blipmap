import { afterEach, describe, expect, it, vi } from "vitest";
import { getRegion, type DatasetConfig } from "../../config/regions";
import { sourceAdapter } from "../sourceAdapters";

const config: DatasetConfig = { ...getRegion("portland").sources[0], adapter: "portland-curb-ramps", endpoint: "https://www.portlandmaps.com/od/rest/services/COP_OpenData_Transportation/MapServer/61/query",
  validationBounds: getRegion("portland").boundary.bbox, attribution: "City of Portland, Bureau of Transportation", license: { id: "City of Portland Data Distribution Policy", url: null, scope: "As-is public data" } };
const record = (id: number) => ({ attributes: { OBJECTID: id, NonAssetID: `test-${id}`, ADAWarnings: "N" }, geometry: { x: -122.6765, y: 45.5231 } });
const snapshot = (features: unknown[]) => ({ spatialReference: { wkid: 4326 }, features });
afterEach(() => vi.unstubAllGlobals());

describe("Portland ArcGIS adapter", () => {
  it("retrieves every ID in bounded batches with WGS84 coordinates and no credentials", async () => {
    const ids = Array.from({ length: 501 }, (_, index) => index + 1);
    const fetchMock = vi.fn(async (input: string) => {
      const url = new URL(input);
      if (url.searchParams.get("returnIdsOnly")) return Response.json({ objectIdFieldName: "OBJECTID", objectIds: ids });
      expect(url.searchParams.get("objectIds")!.split(",").length).toBeLessThanOrEqual(200);
      return Response.json(snapshot(url.searchParams.get("objectIds")!.split(",").map(id => record(Number(id)))));
    });
    vi.stubGlobal("fetch", fetchMock);
    const adapter = sourceAdapter(config);
    const controller = new AbortController();
    const result = await adapter.fetch(controller.signal);
    const batch = adapter.normalize(result.raw, "2026-09-22");
    expect(batch.patches).toHaveLength(501);
    expect(batch.rawRecords.get("test-1")).toEqual(record(1));
    expect(batch.sourceVersion).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ credentials: "omit", signal: controller.signal }));
    const first = new URL(fetchMock.mock.calls[0][0]);
    expect(first.searchParams.get("where")).toBe("ADAWarnings='N'");
    expect(first.searchParams.get("geometry")).toBe(config.validationBounds!.join(","));
    expect(new URL(fetchMock.mock.calls[1][0]).searchParams.get("outSR")).toBe("4326");
  });
  it("rejects transfer limits, missing records, wrong CRS and duplicate object IDs", async () => {
    for (const page of [
      { ...snapshot([record(1)]), exceededTransferLimit: true }, snapshot([]),
      { ...snapshot([record(1)]), spatialReference: { wkid: 3857 } }, snapshot([record(2)]),
    ]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ objectIdFieldName: "OBJECTID", objectIds: [1] })).mockResolvedValueOnce(Response.json(page)));
      await expect(sourceAdapter(config).fetch(new AbortController().signal)).rejects.toThrow();
    }
  });
  it("rejects oversized, errored and incomplete ID responses and respects cancellation", async () => {
    for (const raw of [{ error: { message: "Unavailable" } }, { objectIdFieldName: "OBJECTID", objectIds: [1, 1] },
      { objectIdFieldName: "OBJECTID", objectIds: [1], exceededTransferLimit: true }, { data: "x".repeat(2 * 1024 * 1024) }]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(raw)));
      await expect(sourceAdapter(config).fetch(new AbortController().signal)).rejects.toThrow();
    }
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("Aborted", "AbortError")));
    await expect(sourceAdapter(config).fetch(AbortSignal.abort())).rejects.toThrow("Aborted");
  });
  it("deduplicates stable IDs and rejects conflicts, partial snapshots, invalid codes and empty results", () => {
    const adapter = sourceAdapter(config);
    expect(adapter.normalize(snapshot([record(1), record(1)]), "2026-09-22").duplicates).toBe(1);
    for (const raw of [snapshot([]), snapshot([null]), { ...snapshot([record(1)]), exceededTransferLimit: true },
      snapshot([record(1), { ...record(1), geometry: { x: -122.68, y: 45.52 } }]),
      snapshot([{ ...record(1), attributes: { ...record(1).attributes, ADAWarnings: "U" } }])]) {
      expect(() => adapter.normalize(raw, "2026-09-22")).toThrow();
    }
  });
});