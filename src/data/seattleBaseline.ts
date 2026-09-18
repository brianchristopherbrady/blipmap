import { convertSeattleBaseline } from "../gis/seattleBaseline";
import { getMeta, setMeta, syncSeattlePatches } from "./db";

export const SEATTLE_BASELINE_URL = "https://sidewalk-sea.cs.washington.edu/v3/api/labelClusters?filetype=geojson&bbox=-122.34,47.60,-122.33,47.61&labelType=NoCurbRamp,Obstacle,SurfaceProblem,NoSidewalk";

export const SEATTLE_REFRESH_MS = 24 * 60 * 60 * 1000;
export const SEATTLE_RETRY_MS = 60 * 60 * 1000;

export interface SeattleSyncResult {
  lastSuccess: string | null;
  refreshed: boolean;
  retryPending: boolean;
}

let activeSync: Promise<SeattleSyncResult> | null = null;

export function refreshSeattleBaseline(): Promise<SeattleSyncResult> {
  if (!activeSync) {
    const run = async (): Promise<SeattleSyncResult> => {
      if (typeof navigator !== "undefined" && navigator.locks) {
        return await navigator.locks.request("blipmap:seattle-sync", refreshIfDue);
      }
      return refreshIfDue();
    };
    activeSync = run().finally(() => { activeSync = null; });
  }
  return activeSync;
}

async function refreshIfDue(): Promise<SeattleSyncResult> {
  const now = Date.now();
  const storedSuccess = await getMeta("seattle:lastSuccess");
  const lastSuccess = typeof storedSuccess === "string" && Number.isFinite(Date.parse(storedSuccess))
    ? storedSuccess : null;
  const successAge = lastSuccess ? now - Date.parse(lastSuccess) : Infinity;
  if (successAge >= 0 && successAge < SEATTLE_REFRESH_MS) {
    return { lastSuccess, refreshed: false, retryPending: false };
  }
  const lastAttempt = await getMeta("seattle:lastAttempt");
  const attemptAge = typeof lastAttempt === "number" ? now - lastAttempt : Infinity;
  if (attemptAge >= 0 && attemptAge < SEATTLE_RETRY_MS) {
    return { lastSuccess, refreshed: false, retryPending: true };
  }
  await setMeta("seattle:lastAttempt", now);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(SEATTLE_BASELINE_URL, { signal: controller.signal, cache: "no-cache" });
    if (!response.ok) {
      throw new Error(response.status === 429
        ? "Project Sidewalk is preparing data. Please try again later."
        : `Project Sidewalk request failed (${response.status}).`);
    }
    const checkedAt = new Date().toISOString();
    const result = convertSeattleBaseline(await response.json(), checkedAt);
    if (!result.patches.length) throw new Error("No usable Seattle barriers were returned. Existing patches are unchanged.");
    if (result.skipped) throw new Error("Seattle data format changed or contains invalid records. Keeping the cached baseline.");
    await syncSeattlePatches(result.patches, checkedAt);
    return { lastSuccess: checkedAt, refreshed: true, retryPending: false };
  } catch (error) {
    if (controller.signal.aborted) throw new Error("Seattle data request timed out. Please try again.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}