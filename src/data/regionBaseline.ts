import { getRegion, type DatasetConfig } from "../config/regions";
import { getMeta, setMeta, syncSourcePatches } from "./db";
import { sourceAdapter } from "./sourceAdapters";

export interface RegionSyncResult {
  lastSuccess: string | null;
  refreshed: boolean;
  retryPending: boolean;
  available: boolean;
}

const active = new Map<string, Promise<RegionSyncResult>>();

async function refreshIfDue(source: DatasetConfig): Promise<RegionSyncResult> {
  const now = Date.now();
  const stored = await getMeta(`${source.storageKey}:lastSuccess`);
  const lastSuccess = typeof stored === "string" && Number.isFinite(Date.parse(stored)) ? stored : null;
  const age = lastSuccess ? now - Date.parse(lastSuccess) : Infinity;
  if (age >= 0 && age < source.refreshMs) return { lastSuccess, refreshed: false, retryPending: false, available: true };
  const attempted = await getMeta(`${source.storageKey}:lastAttempt`);
  const attemptAge = typeof attempted === "number" ? now - attempted : Infinity;
  if (attemptAge >= 0 && attemptAge < source.retryMs) return { lastSuccess, refreshed: false, retryPending: true, available: true };
  await setMeta(`${source.storageKey}:lastAttempt`, now);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const adapter = sourceAdapter(source);
    const { raw, sourceVersion } = await adapter.fetch(controller.signal);
    const checkedAt = new Date().toISOString();
    const batch = adapter.normalize(raw, checkedAt, sourceVersion);
    if (!batch.complete) throw new Error("Partial snapshots cannot be synchronized.");
    await syncSourcePatches(batch.patches, checkedAt, source, batch.rawRecords, batch.sourceVersion, batch.duplicates);
    return { lastSuccess: checkedAt, refreshed: true, retryPending: false, available: true };
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`${source.name} request timed out. Please try again.`);
    throw error;
  } finally { clearTimeout(timeout); }
}

function refreshSource(source: DatasetConfig): Promise<RegionSyncResult> {
  const key = `${source.regionId}:${source.id}`;
  const existing = active.get(key);
  if (existing) return existing;
  const run = async () => typeof navigator !== "undefined" && navigator.locks
    ? navigator.locks.request(`blipmap:${key}:sync`, () => refreshIfDue(source)) : refreshIfDue(source);
  const request = run().finally(() => active.delete(key));
  active.set(key, request);
  return request;
}

export async function refreshRegionBaseline(regionId: string): Promise<RegionSyncResult> {
  const region = getRegion(regionId);
  const sources = region.features.automaticImports ? region.sources.filter(source => source.adapter !== "unconfigured" && source.endpoint && source.license) : [];
  if (!sources.length) return { lastSuccess: null, refreshed: false, retryPending: false, available: false };
  const results = await Promise.all(sources.map(refreshSource));
  const checked = results.map(result => result.lastSuccess).filter((date): date is string => date !== null).sort();
  return { lastSuccess: checked.length === results.length ? checked[0] : null,
    refreshed: results.some(result => result.refreshed), retryPending: results.some(result => result.retryPending), available: true };
}