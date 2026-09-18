// Replace with your ORS key from https://openrouteservice.org/dev/#/signup
export const ORS_API_KEY = import.meta.env["VITE_ORS_API_KEY"] ?? "";

export const ORS_BASE = "https://api.openrouteservice.org";

export const ORS_PROFILES = {
  wheelchair:    "wheelchair",
  "foot-walk":   "foot-walking",
  "foot-hike":   "foot-hiking",
  cycling:      "cycling-regular",
} as const;

export type OrsProfileKey = keyof typeof ORS_PROFILES;

export function isNonDrivingProfile(value: unknown): value is OrsProfileKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(ORS_PROFILES, value);
}

export function getNonDrivingProfile(value: unknown): typeof ORS_PROFILES[OrsProfileKey] {
  if (!isNonDrivingProfile(value)) {
    throw new Error("Choose a walking, wheelchair, hiking, or cycling profile. Driving routes are not supported.");
  }
  return ORS_PROFILES[value];
}
