import { DEFAULT_REGION_ID, getRegion } from "../config/regions";
import { refreshRegionBaseline, type RegionSyncResult } from "./regionBaseline";

const source = getRegion(DEFAULT_REGION_ID).sources[0];
export const SEATTLE_BASELINE_URL = source.endpoint!;
export const SEATTLE_REFRESH_MS = source.refreshMs;
export const SEATTLE_RETRY_MS = source.retryMs;
export type SeattleSyncResult = RegionSyncResult;

export function refreshSeattleBaseline(): Promise<SeattleSyncResult> {
  return refreshRegionBaseline(DEFAULT_REGION_ID);
}