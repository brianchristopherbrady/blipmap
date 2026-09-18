import type { UserProfile } from "../data/profile";

export type RoutingRequirements = Pick<UserProfile, "avoidStairs" | "avoidSteepSlopes" | "avoidRoughSurfaces" | "avoidConstruction" | "requireStepFree" | "minimumWidthM" | "maximumInclinePercent">;

export function routingOptions(profile: RoutingRequirements & Pick<UserProfile, "routingProfile">): Record<string, unknown> {
  const wheelchair = profile.routingProfile === "wheelchair";
  const unsupported: string[] = [];
  if (wheelchair && profile.maximumInclinePercent != null && ![3, 6, 10, 15].includes(profile.maximumInclinePercent)) {
    unsupported.push("this incline limit (supported limits are 3%, 6%, 10% and 15%)");
  }
  if (profile.requireStepFree) unsupported.push("guaranteed step-free crossings");
  if (profile.avoidConstruction) unsupported.push("avoid construction");
  if (!wheelchair) {
    if (profile.avoidSteepSlopes || profile.maximumInclinePercent != null) unsupported.push("slope limits");
    if (profile.avoidRoughSurfaces) unsupported.push("smooth surfaces");
    if (profile.minimumWidthM != null) unsupported.push("minimum path width");
  }
  if (unsupported.length) {
    throw new Error(`The selected routing service cannot enforce these requirements for this travel mode: ${unsupported.join(", ")}. No route was generated. Your requirements have not been changed.`);
  }
  const options: Record<string, unknown> = {};
  if (profile.avoidStairs || profile.requireStepFree || wheelchair) options.avoid_features = ["steps"];
  if (wheelchair) {
    const restrictions: Record<string, number | string> = {};
    if (profile.minimumWidthM != null) restrictions.minimum_width = profile.minimumWidthM;
    if (profile.maximumInclinePercent != null || profile.avoidSteepSlopes) {
      restrictions.maximum_incline = profile.avoidSteepSlopes
        ? Math.min(profile.maximumInclinePercent ?? 3, 3) : profile.maximumInclinePercent!;
    }
    if (profile.avoidRoughSurfaces) restrictions.smoothness_type = "excellent";
    if (Object.keys(restrictions).length) options.profile_params = { restrictions };
  }
  return options;
}