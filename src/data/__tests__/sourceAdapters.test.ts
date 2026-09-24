import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRegion } from "../../config/regions";
import { sourceAdapter } from "../sourceAdapters";
import { validateGeoJSON } from "../../gis/importValidate";

const source = getRegion("seattle").sources[0];
const row = { type: "Feature", geometry: { type: "Point", coordinates: [-122.335, 47.608] },
  properties: { label_cluster_id: 987, label_type: "NoCurbRamp", median_severity: 3, avg_label_date: "2020-01-01" } };
const fixture = { type: "FeatureCollection", features: [row] };
beforeEach(() => { vi.resetModules(); vi.stubGlobal("indexedDB", new IDBFactory()); });
afterEach(() => vi.unstubAllGlobals());

describe("source adapters", () => {
  it("normalizes known source data and preserves raw evidence, timestamps, license and version", async () => {
    const batch = sourceAdapter(source).normalize(fixture, "2026-09-21", "fixture-v1");
    expect(batch.rawRecords.get("987")).toEqual(row);
    expect(batch.patches[0].properties.source?.averageLabelDate).toBe("2020-01-01");
    const database = await import("../db");
    const first = await database.syncSourcePatches(batch.patches, batch.importedAt, source, batch.rawRecords, batch.sourceVersion);
    const second = await database.syncSourcePatches(batch.patches, "2026-09-22", source, batch.rawRecords, batch.sourceVersion);
    expect(first.added).toBe(1);
    expect(second).toMatchObject({ added: 0, modified: 0, unchanged: 1 });
    expect(await database.getObservationHistory(batch.patches[0].id)).toHaveLength(1);
    const { openDB } = await import("idb");
    const db = await openDB("blipmap");
    const records = await db.getAll("sourceRecords");
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ payload: row, license: "CC0", attribution: "Project Sidewalk", sourceVersion: "fixture-v1" });
    db.close();
  });
  it("deduplicates identical records but rejects conflicts and partial or out-of-region snapshots", () => {
    const adapter = sourceAdapter(source);
    expect(adapter.normalize({ ...fixture, features: [row, row] }, "2026-09-21").duplicates).toBe(1);
    expect(() => adapter.normalize({ ...fixture, features: [row, { ...row, properties: { ...row.properties, median_severity: 1 } }] }, "2026-09-21")).toThrow("Conflicting");
    expect(() => adapter.normalize({ ...fixture, features: [row, null] }, "2026-09-21")).toThrow("invalid records");
    expect(() => adapter.normalize({ ...fixture, features: [{ ...row, geometry: { type: "Point", coordinates: [-122.6765, 45.5231] } }] }, "2026-09-21")).toThrow();
  });
  it("does not fetch an unconfigured source or regions without a dataset", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const adapter = sourceAdapter({ ...getRegion("portland").sources[0], adapter: "unconfigured", endpoint: null, license: null });
    await expect(adapter.fetch(new AbortController().signal)).rejects.toThrow("not configured");
    expect(() => adapter.normalize(fixture, "2026-09-21")).toThrow("not configured");
    const { refreshRegionBaseline } = await import("../regionBaseline");
    expect(await refreshRegionBaseline("unassigned")).toMatchObject({ available: false, refreshed: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("validates geographic input and does not trust an imported region label", () => {
    const result = validateGeoJSON({ type: "FeatureCollection", features: [
      { ...row, geometry: { type: "Point", coordinates: [Infinity, 47] } },
      { ...row, geometry: { type: "Point", coordinates: [181, 47] } },
      { ...row, geometry: { type: "Point", coordinates: [-122.6765, 45.5231] }, properties: { regionId: "seattle" } },
    ] });
    expect(result.skipped).toBe(2);
    expect(result.patches[0].properties.regionId).toBe("portland");
  });
});