import { openDB, type IDBPDatabase } from "idb";
import type { Patch } from "../types/patch";

const DB_NAME = "blipmap";
const DB_VERSION = 2;

interface BlipDB {
  patches: { key: string; value: Patch };
  meta: { key: string; value: unknown };
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
    },
    blocking() {
      _db?.close();
      _db = null;
    },
  });
  return _db;
}

export async function getPatches(): Promise<Patch[]> {
  return (await getDb()).getAll("patches");
}

export async function getPatch(id: string): Promise<Patch | undefined> {
  return (await getDb()).get("patches", id);
}

export async function savePatch(patch: Patch): Promise<void> {
  const transaction = (await getDb()).transaction(["patches", "meta"], "readwrite");
  await transaction.objectStore("patches").put(patch);
  if (patch.properties.source) await transaction.objectStore("meta").delete(`seattle:hidden:${patch.id}`);
  await transaction.done;
}

export async function updatePatch(patch: Patch): Promise<void> {
  await (await getDb()).put("patches", patch);
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
  try {
    const transaction = (await getDb()).transaction(["patches", "meta"], "readwrite");
    const work = async () => {
      const store = transaction.objectStore("patches");
      const meta = transaction.objectStore("meta");
      const previous = (await meta.get("seattle:sourceSnapshot") ?? []) as Patch[];
      const previousById = new Map(previous.map(patch => [patch.id, patch]));
      const incomingIds = new Set(patches.map(patch => patch.id));
      for (const incoming of patches) {
        if (await meta.get(`seattle:hidden:${incoming.id}`)) continue;
        const current = await store.get(incoming.id);
        const original = previousById.get(incoming.id);
        if (!current) {
          await store.add(incoming);
        } else if (original ? sameObservation(current, original)
          : current.properties.source?.provider === "project-sidewalk-seattle"
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
        const current = await store.get(original.id);
        if (current && sameObservation(current, original)) await store.delete(original.id);
      }
      await meta.put(patches, "seattle:sourceSnapshot");
      await meta.put(checkedAt, "seattle:lastSuccess");
    };
    await Promise.all([transaction.done, work().catch(error => {
      transaction.abort();
      throw error;
    })]);
  } catch (error) {
    throw new Error(`Could not synchronize Seattle data: ${error instanceof Error ? error.message : "storage unavailable"}`);
  }
}

export async function deletePatch(id: string): Promise<void> {
  const transaction = (await getDb()).transaction(["patches", "meta"], "readwrite");
  const patch = await transaction.objectStore("patches").get(id);
  if (patch?.properties.source) await transaction.objectStore("meta").put(true, `seattle:hidden:${id}`);
  await transaction.objectStore("patches").delete(id);
  await transaction.done;
}

export async function clearPatches(): Promise<void> {
  const transaction = (await getDb()).transaction(["patches", "meta"], "readwrite");
  const patches = await transaction.objectStore("patches").getAll();
  for (const patch of patches) {
    if (patch.properties.source) await transaction.objectStore("meta").put(true, `seattle:hidden:${patch.id}`);
  }
  await transaction.objectStore("patches").clear();
  await transaction.done;
}

export async function getMeta(key: string): Promise<unknown> {
  return (await getDb()).get("meta", key);
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await (await getDb()).put("meta", value, key);
}
