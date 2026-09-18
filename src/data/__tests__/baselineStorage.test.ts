import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { openDB } from "idb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Patch } from "../../types/patch";
import { convertSeattleBaseline } from "../../gis/seattleBaseline";

const firstDate = "2026-09-17T00:00:00Z";
const secondDate = "2026-09-18T00:00:00Z";
function report(id = 123, severity = 3): Patch {
  return convertSeattleBaseline({ type: "FeatureCollection", features: [{
    type: "Feature", geometry: { type: "Point", coordinates: [-122.335, 47.608] },
    properties: { label_cluster_id: id, label_type: "NoCurbRamp", median_severity: severity },
  }] }, firstDate).patches[0];
}

function patch(id: string, title = "Missing curb ramp"): Patch {
  return {
    id, type: "Feature", geometry: { type: "Point", coordinates: [-122.335, 47.608] },
    properties: {
      title, category: "curb-ramp", severity: "difficult", status: "observed", notes: "Local notes",
      createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
    },
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("indexedDB", new IDBFactory());
});
afterEach(() => vi.unstubAllGlobals());

describe("baseline storage", () => {
  it("migrates version 1 without changing local content or seed completion", async () => {
    const oldDb = await openDB("blipmap", 1, {
      upgrade(database) {
        database.createObjectStore("patches", { keyPath: "id" });
        database.createObjectStore("meta");
      },
    });
    const local = patch("local", "My local observation");
    await oldDb.put("patches", local);
    await oldDb.put("meta", true, "seedCompleted");
    oldDb.close();
    const database = await import("../db");
    expect(await database.getPatches()).toEqual([{ ...local, properties: { ...local.properties, source: null } }]);
    expect(await database.getMeta("seedCompleted")).toBe(true);
    const migrated = await openDB("blipmap");
    expect(migrated.version).toBe(2);
    migrated.close();
  });

  it("updates source records but keeps local edits across repeated refreshes", async () => {
    const database = await import("../db");
    const initial = report();
    await database.syncSeattlePatches([initial, report(124)], firstDate);
    const edited = { ...initial, properties: { ...initial.properties, title: "Locally corrected title" } };
    await database.updatePatch(edited);
    await database.syncSeattlePatches([report(123, 1), report(124, 1)], secondDate);
    const local = await database.getPatch(initial.id);
    expect(local?.properties.title).toBe("Locally corrected title");
    expect(local?.properties.severity).toBe("difficult");
    expect(local?.properties.source?.medianSeverity).toBe(1);
    expect((await database.getPatch(report(124).id))?.properties.severity).toBe("caution");
    expect(await database.getPatches()).toHaveLength(2);
    expect(await database.getMeta("seattle:lastSuccess")).toBe(secondDate);
  });

  it("preserves unrelated patches while adding baseline records", async () => {
    const database = await import("../db");
    await database.savePatch(patch("local"));
    await database.syncSeattlePatches([report()], firstDate);
    expect(await database.getPatches()).toHaveLength(2);
  });

  it("rolls back the complete batch when an insert fails", async () => {
    const database = await import("../db");
    const invalid = { ...report(124), id: null } as unknown as Patch;
    await expect(database.syncSeattlePatches([report(), invalid], firstDate)).rejects.toThrow("Could not synchronize");
    expect(await database.getPatches()).toEqual([]);
    expect(await database.getMeta("seattle:lastSuccess")).toBeUndefined();
  });

  it("removes withdrawn source-owned records but keeps local corrections", async () => {
    const database = await import("../db");
    await database.syncSeattlePatches([report(123), report(124)], firstDate);
    const edited = report(124);
    edited.properties.notes = "Checked locally";
    await database.updatePatch(edited);
    await database.syncSeattlePatches([report(125)], secondDate);
    expect(await database.getPatch(report(123).id)).toBeUndefined();
    expect(await database.getPatch(report(124).id)).toEqual(edited);
    expect(await database.getPatches()).toHaveLength(2);
  });

  it("preserves deletions on refresh and re-enables refresh on undo", async () => {
    const database = await import("../db");
    const initial = report();
    await database.syncSeattlePatches([initial], firstDate);
    await database.deletePatch(initial.id);
    await database.syncSeattlePatches([initial], secondDate);
    expect(await database.getPatches()).toEqual([]);
    await database.savePatch(initial);
    await database.syncSeattlePatches([report(123, 1)], secondDate);
    expect((await database.getPatch(initial.id))?.properties.severity).toBe("caution");
  });

  it("keeps cleared baseline records hidden on the next refresh", async () => {
    const database = await import("../db");
    await database.syncSeattlePatches([report()], firstDate);
    await database.clearPatches();
    await database.syncSeattlePatches([report()], secondDate);
    expect(await database.getPatches()).toEqual([]);
  });

  it("upgrades prior manual imports without overwriting edits", async () => {
    const database = await import("../db");
    const edited = report(124);
    edited.properties.updatedAt = secondDate;
    edited.properties.notes = "My correction";
    await database.savePatch(report(123));
    await database.savePatch(edited);
    await database.syncSeattlePatches([report(123, 1), report(124, 1)], secondDate);
    expect((await database.getPatch(report(123).id))?.properties.severity).toBe("caution");
    expect((await database.getPatch(edited.id))?.properties.notes).toBe("My correction");
  });
});