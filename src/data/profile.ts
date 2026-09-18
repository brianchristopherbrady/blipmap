import type { OrsProfileKey } from "../config/routing";
import { isNonDrivingProfile } from "../config/routing";

export type MobilityAid = "none" | "wheelchair" | "cane" | "walker" | "visual";

export interface UserProfile {
  mobilityAid: MobilityAid;
  mobilityAids?: Exclude<MobilityAid, "none">[];
  requireStepFree?: boolean;
  minimumWidthM?: number | null;
  maximumInclinePercent?: number | null;
  avoidStairs: boolean;
  avoidSteepSlopes: boolean;
  avoidRoughSurfaces: boolean;
  avoidConstruction: boolean;
  routingProfile: OrsProfileKey;
  displayName: string;
}

const DEFAULT_PROFILE: UserProfile = {
  mobilityAid: "none",
  mobilityAids: [],
  requireStepFree: false,
  minimumWidthM: null,
  maximumInclinePercent: null,
  avoidStairs: false,
  avoidSteepSlopes: false,
  avoidRoughSurfaces: false,
  avoidConstruction: false,
  routingProfile: "foot-walk",
  displayName: "",
};

const KEY = "blipmap:profile";

export function normalizeProfile(raw: unknown): UserProfile {
  const value = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const mobilityAid = typeof value.mobilityAid === "string" && Object.prototype.hasOwnProperty.call(MOBILITY_AID_LABELS, value.mobilityAid)
    ? value.mobilityAid as MobilityAid : DEFAULT_PROFILE.mobilityAid;
  const mobilityAids = Array.isArray(value.mobilityAids)
    ? [...new Set(value.mobilityAids.filter((aid): aid is Exclude<MobilityAid, "none"> =>
      typeof aid === "string" && aid !== "none" && Object.prototype.hasOwnProperty.call(MOBILITY_AID_LABELS, aid)))]
    : mobilityAid === "none" ? [] : [mobilityAid];
  return {
    mobilityAid,
    mobilityAids,
    requireStepFree: value.requireStepFree === true,
    minimumWidthM: typeof value.minimumWidthM === "number" && Number.isFinite(value.minimumWidthM) && value.minimumWidthM > 0 && value.minimumWidthM <= 5 ? value.minimumWidthM : null,
    maximumInclinePercent: typeof value.maximumInclinePercent === "number" && Number.isFinite(value.maximumInclinePercent) && value.maximumInclinePercent > 0 && value.maximumInclinePercent <= 15 ? value.maximumInclinePercent : null,
    routingProfile: isNonDrivingProfile(value.routingProfile) ? value.routingProfile : inferRoutingProfile(mobilityAid),
    displayName: typeof value.displayName === "string" ? value.displayName : "",
    avoidStairs: typeof value.avoidStairs === "boolean" ? value.avoidStairs : DEFAULT_PROFILE.avoidStairs,
    avoidSteepSlopes: typeof value.avoidSteepSlopes === "boolean" ? value.avoidSteepSlopes : DEFAULT_PROFILE.avoidSteepSlopes,
    avoidRoughSurfaces: typeof value.avoidRoughSurfaces === "boolean" ? value.avoidRoughSurfaces : DEFAULT_PROFILE.avoidRoughSurfaces,
    avoidConstruction: typeof value.avoidConstruction === "boolean" ? value.avoidConstruction : DEFAULT_PROFILE.avoidConstruction,
  };
}

export function loadProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    return normalizeProfile(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export function saveProfile(profile: UserProfile): void {
  localStorage.setItem(KEY, JSON.stringify(normalizeProfile(profile)));
}

export const MOBILITY_AID_LABELS: Record<MobilityAid, string> = {
  none: "None",
  wheelchair: "Wheelchair",
  cane: "Cane / crutch",
  walker: "Walker / rollator",
  visual: "Visual impairment",
};

/** Infer the best ORS profile from mobility aid */
export function inferRoutingProfile(aid: MobilityAid): OrsProfileKey {
  if (aid === "wheelchair") return "wheelchair";
  if (aid === "visual") return "foot-walk";
  return "foot-walk";
}
