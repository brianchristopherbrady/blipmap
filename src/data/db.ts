import { openDB, type IDBPDatabase, type IDBPTransaction } from "idb";
import type { Patch } from "../types/patch";
import { DEFAULT_REGION_ID, getRegion, getDataset, patchRegion, REGIONS, type DatasetConfig } from "../config/regions";
import type { PhysicalFeature, Observation, Evidence, Verification, CurrentCondition, ModerationEvent, SourceRecord, ImportReport } from "../types/spatial";
import { canonical, deriveCondition, normalizeObservation, observationContent } from "./spatialHistory";

const DB_NAME = "blipmap";
const DB_VERSION = 3;

interface BlipDB {
  patches: { key: string; value: Patch; indexes: { "by-region": string } };
  meta: { key: string; value: unknown };
  physicalFeatures: { key: string; value: PhysicalFeature; indexes: { "by-region": string } };
  observations: { key: string; value: Observation; indexes: { "by-region": string; "by-patch": string } };
  evidence: { key: string; value: Evidence; indexes: { "by-region": string } };
  verifications: { key: string; value: Verification; indexes: { "by-region": string } };
  currentConditions: { key: string; value: CurrentCondition; indexes: { "by-region": string } };
  moderationEvents: { key: string; value: ModerationEvent; indexes: { "by-region": string } };
  sourceRecords: { key: string; value: SourceRecord; indexes: { "by-region": string; "by-source-record": [string, string, string] } };
  importReports: { key: string; value: ImportReport; indexes: { "by-region": string } };
}

const STORES: (keyof BlipDB)[] = ["patches", "meta", "physicalFeatures", "observations", "evidence", "verifications", "currentConditions", "moderationEvents", "sourceRecords", "importReports"];
type WriteTransaction = IDBPTransaction<BlipDB, string[], "readwrite" | "versionchange">;

function regionalPatch(patch: Patch): Patch {
  return { ...patch, properties: { ...patch.properties, regionId: patchRegion(patch) } };
}

async function recordObservation(transaction: WriteTransaction, patch: Patch, recordedAt: string, sourceRecordId?: string, origin = "device-local"): Promise<void> {
  const history = await transaction.objectStore("observations").index("by-patch").getAll(patch.id);
  const regional = history.filter(item => item.regionId === patchRegion(patch)).sort((first, second) => second.revision - first.revision);
  const latest = regional[0];
  const previous = regional.find(item => item.source === origin);
  const provenance = sourceRecordId ?? previous?.sourceRecordId ?? latest?.sourceRecordId ?? null;
  if (previous?.contentKey === observationContent(patch, provenance)) return;
  const normalized = normalizeObservation(patch, (latest?.revision ?? 0) + 1, recordedAt, provenance);
  normalized.observation.source = origin;
  normalized.observation.supersedes = previous?.id ?? null;
  await transaction.objectStore("physicalFeatures").put(normalized.feature);
  await transaction.objectStore("observations").add(normalized.observation);
  for (const evidence of normalized.evidence) await transaction.objectStore("evidence").add(evidence);
  await transaction.objectStore("currentConditions").put(deriveCondition(normalized.feature, [...history, normalized.observation], recordedAt));
}

async function write<T>(label: string, work: (transaction: WriteTransaction) => Promise<T>): Promise<T> {
  try {
    const transaction = (await getDb()).transaction(STORES, "readwrite");
    const [, result] = await Promise.all([transaction.done, work(transaction).catch(error => {
      try { transaction.abort(); } catch {}
      throw error;
    })]);
    return result;
  } catch (error) {
    throw new Error(`${label}: ${error instanceof Error ? error.message : "storage unavailable"}`);
  }
}

let _db: IDBPDatabase<BlipDB> | null = null;

async function getDb(): Promise<IDBPDatabase<BlipDB>> {
  if (_db) return _db;
  _db = await openDB<BlipDB>(DB_NAME, DB_VERSION, {
    async upgrade(db, oldVersion, _newVersion, transaction) {
      if (oldVersion < 1) {
        db.createObjectStore("patches", { keyPath: "id" });
        db.createObjectStore("meta");
      }
      if (oldVersion < 2) {
        let cursor = await transaction.objectStore("patches").openCursor();
        while (cursor) {
          const patch = cursor.value;
          await cursor.update({ ...patch, properties: { ...patch.properties, source: patch.properties.source ?? null } });
          cursor = await cursor.continue();
        }
      }
      if (oldVersion < 3) {
        transaction.objectStore("patches").createIndex("by-region", "properties.regionId");
        for (const name of STORES) {
          if (name === "patches" || name === "meta") continue;
          const store = db.createObjectStore(name, { keyPath: "id" });
          store.createIndex("by-region", "regionId");
        }
        transaction.objectStore("observations").createIndex("by-patch", "patchId");
        transaction.objectStore("sourceRecords").createIndex("by-source-record", ["regionId", "sourceId", "externalId"]);
        const meta = transaction.objectStore("meta");
        const now = new Date().toISOString();
        for (const source of REGIONS.flatMap(region => region.sources)) {
          const snapshot = await meta.get(`${source.storageKey}:sourceSnapshot`) as Patch[] | undefined;
          for (const patch of snapshot ?? []) await recordObservation(transaction, regionalPatch(patch), now, undefined, source.id);
        }
        const backup = await meta.get("patches:clearedBackup") as Patch[] | undefined;
        for (const patch of backup ?? []) await recordObservation(transaction, regionalPatch(patch), now);
        let cursor = await transaction.objectStore("patches").openCursor();
        while (cursor) {
          const patch = regionalPatch(cursor.value);
          await cursor.update(patch);
          await recordObservation(transaction, patch, now);
          cursor = await cursor.continue();
        }
      }
    },
    blocking() {
      _db?.close();
      _db = null;
    },
  });
  return _db;
}

export async function getPatches(regionId?: string): Promise<Patch[]> {
  try {
    const db = await getDb();
    return regionId ? await db.getAllFromIndex("patches", "by-region", regionId) : await db.getAll("patches");
  } catch { throw new Error("Could not load patches from local storage."); }
}

export async function getPatch(id: string): Promise<Patch | undefined> {
  return (await getDb()).get("patches", id);
}

export async function savePatch(patch: Patch): Promise<void> {
  await write("Could not save patch", async transaction => {
    const regional = regionalPatch(patch);
    await recordObservation(transaction, regional, new Date().toISOString());
    await transaction.objectStore("patches").put(regional);
    const source = getDataset(patch.properties.source?.provider ?? "");
    if (source) await transaction.objectStore("meta").delete(`${source.storageKey}:hidden:${patch.id}`);
  });
}

export async function updatePatch(patch: Patch): Promise<void> {
  await savePatch(patch);
}

function sameObservation(first: Patch, second: Patch): boolean {
  const content = (patch: Patch) => [
    patch.geometry.coordinates, patch.properties.title, patch.properties.category,
    patch.properties.severity, patch.properties.status, patch.properties.notes,
    patch.properties.photo ?? null,
  ];
  return JSON.stringify(content(first)) === JSON.stringify(content(second));
}

export async function syncSeattlePatches(patches: Patch[], checkedAt: string): Promise<void> {
  await syncSourcePatches(patches, checkedAt, getRegion(DEFAULT_REGION_ID).sources[0]);
}

export async function syncSourcePatches(patches: Patch[], checkedAt: string, source: DatasetConfig,
  rawRecords?: Map<string, unknown>, sourceVersion: string | null = null, duplicates = 0): Promise<ImportReport> {
  return write("Could not synchronize source data", async transaction => {
      if (!source.license || !source.attribution || source.adapter === "unconfigured") throw new Error("Dataset configuration and license required.");
      const report: ImportReport = { id: crypto.randomUUID(), regionId: source.regionId, sourceId: source.id, importedAt: checkedAt,
        sourceVersion, added: 0, modified: 0, unchanged: 0, apparentRemovals: [], duplicates, rejected: 0 };
      const store = transaction.objectStore("patches");
      const meta = transaction.objectStore("meta");
      const previous = (await meta.get(`${source.storageKey}:sourceSnapshot`) ?? []) as Patch[];
      const previousById = new Map(previous.map(patch => [patch.id, patch]));
      const incomingIds = new Set(patches.map(patch => patch.id));
      if (incomingIds.size !== patches.length) throw new Error("Duplicate source IDs.");
      for (const patch of patches) {
        const incoming = regionalPatch(patch);
        if (!incoming.id || incoming.properties.regionId !== source.regionId || incoming.properties.source?.provider !== source.id) throw new Error("Source region or identity mismatch.");
        const externalId = incoming.properties.source.sourceId;
        const records = await transaction.objectStore("sourceRecords").index("by-source-record").getAll([source.regionId, source.id, externalId]);
        const prior = records.sort((first, second) => second.revision - first.revision)[0];
        const payload = rawRecords?.get(externalId) ?? incoming;
        const contentKey = canonical({ content: rawRecords ? payload : observationContent(incoming, null), sourceVersion });
        let sourceRecordId = prior?.id;
        if (!prior || prior.contentKey !== contentKey) {
          const revision = (prior?.revision ?? 0) + 1;
          sourceRecordId = `${source.regionId}:${source.id}:${externalId}:${revision}`;
          await transaction.objectStore("sourceRecords").add({ id: sourceRecordId, regionId: source.regionId, sourceId: source.id,
            externalId, revision, sourceVersion, importedAt: checkedAt, payload, contentKey, attribution: source.attribution,
            license: source.license.id, previousVersionId: prior?.id ?? null });
          if (prior) report.modified++; else report.added++;
        } else report.unchanged++;
        await recordObservation(transaction, incoming, checkedAt, sourceRecordId, source.id);
        if (await meta.get(`${source.storageKey}:hidden:${incoming.id}`)) continue;
        const current = await store.get(incoming.id);
        const original = previousById.get(incoming.id);
        if (!current) {
          await store.add(incoming);
        } else if (original ? sameObservation(current, original)
          : current.properties.source?.provider === source.id
            && current.properties.updatedAt === current.properties.source.importedAt) {
          await store.put({
            ...incoming,
            properties: {
              ...incoming.properties,
              createdAt: current.properties.createdAt,
              source: incoming.properties.source ? {
                ...incoming.properties.source,
                importedAt: current.properties.source?.importedAt ?? incoming.properties.source.importedAt,
              } : null,
            },
          });
        } else if (current.properties.source && incoming.properties.source) {
          await store.put({
            ...current,
            properties: {
              ...current.properties,
              source: { ...incoming.properties.source, importedAt: current.properties.source.importedAt },
            },
          });
        }
      }
      for (const original of previous) {
        if (incomingIds.has(original.id)) continue;
        report.apparentRemovals.push(original.id);
        await transaction.objectStore("moderationEvents").add({ id: crypto.randomUUID(), regionId: source.regionId,
          observationId: null, action: "source-missing", actorId: null, recordedAt: checkedAt,
          reason: `Absent from source snapshot: ${source.id}, ${original.id}. Not proof of resolution.`, policyVersion: "import-v1" });
      }
      await meta.put(patches.map(regionalPatch), `${source.storageKey}:sourceSnapshot`);
      await meta.put(checkedAt, `${source.storageKey}:lastSuccess`);
      await transaction.objectStore("importReports").add(report);
      return report;
  });
}

export async function deletePatch(id: string): Promise<void> {
  await write("Could not hide patch", async transaction => {
    const patch = await transaction.objectStore("patches").get(id);
    if (!patch) return;
    const source = getDataset(patch.properties.source?.provider ?? "");
    if (source) await transaction.objectStore("meta").put(true, `${source.storageKey}:hidden:${id}`);
    await transaction.objectStore("moderationEvents").add({ id: crypto.randomUUID(), regionId: patchRegion(patch), observationId: null,
      action: "local-hide", actorId: null, recordedAt: new Date().toISOString(), reason: `Hidden from this device's active view: ${id}`, policyVersion: "local-v1" });
    await transaction.objectStore("patches").delete(id);
  });
}

export async function clearPatches(regionId?: string): Promise<void> {
  await write("Could not clear patches", async transaction => {
  const store = transaction.objectStore("patches");
  const patches = regionId ? await store.index("by-region").getAll(regionId) : await store.getAll();
  const meta = transaction.objectStore("meta");
  const previous = (await meta.get("patches:clearedBackup") ?? []) as Patch[];
  await meta.put([...new Map([...previous, ...patches].map(patch => [patch.id, patch])).values()], "patches:clearedBackup");
  for (const patch of patches) {
    const source = getDataset(patch.properties.source?.provider ?? "");
    if (source) await meta.put(true, `${source.storageKey}:hidden:${patch.id}`);
    await store.delete(patch.id);
  }
  });
}

export async function getMeta(key: string): Promise<unknown> {
  return (await getDb()).get("meta", key);
}

export async function restorePatches(regionId?: string): Promise<number> {
  return write("Could not restore patches", async transaction => {
      const meta = transaction.objectStore("meta");
      const store = transaction.objectStore("patches");
      const baseline: Patch[] = [];
      for (const source of REGIONS.flatMap(region => region.sources).filter(source => !regionId || source.regionId === regionId)) {
        baseline.push(...(await meta.get(`${source.storageKey}:sourceSnapshot`) ?? []) as Patch[]);
      }
      const backup = (await meta.get("patches:clearedBackup") ?? []) as Patch[];
      const candidates = new Map([...baseline, ...backup].filter(patch => !regionId || patchRegion(patch) === regionId).map(patch => [patch.id, regionalPatch(patch)]));
      let restored = 0;
      for (const patch of candidates.values()) {
        if (await store.get(patch.id)) continue;
        await store.add(patch);
        const source = getDataset(patch.properties.source?.provider ?? "");
        if (source) await meta.delete(`${source.storageKey}:hidden:${patch.id}`);
        restored++;
      }
      await meta.put(backup.filter(patch => regionId && patchRegion(patch) !== regionId), "patches:clearedBackup");
      return restored;
  });
}

export async function getObservationHistory(patchId: string): Promise<Observation[]> {
  const history = await (await getDb()).getAllFromIndex("observations", "by-patch", patchId);
  return history.sort((first, second) => first.revision - second.revision);
}

export async function getImportReports(regionId: string): Promise<ImportReport[]> {
  const reports = await (await getDb()).getAllFromIndex("importReports", "by-region", regionId);
  return reports.sort((first, second) => first.importedAt.localeCompare(second.importedAt));
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await (await getDb()).put("meta", value, key);
}
