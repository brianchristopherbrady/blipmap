import { afterEach, describe, expect, it, vi } from "vitest";
import { loadProfile, normalizeProfile, saveProfile, type UserProfile } from "../profile";

afterEach(() => vi.unstubAllGlobals());

describe("non-driving saved preferences", () => {
  it.each(["wheelchair", "foot-walk", "foot-hike", "cycling"])("preserves supported mode %s", routingProfile => {
    expect(normalizeProfile({ routingProfile }).routingProfile).toBe(routingProfile);
  });
  it.each(["driving-car", "driving-hgv", "constructor", null, 42])("replaces invalid saved mode %s with a pedestrian mode", routingProfile => {
    expect(normalizeProfile({ routingProfile }).routingProfile).toBe("foot-walk");
    expect(normalizeProfile({ routingProfile, mobilityAid: "wheelchair" }).routingProfile).toBe("wheelchair");
  });
  it("normalizes persisted legacy driving preferences", () => {
    vi.stubGlobal("localStorage", { getItem: () => JSON.stringify({ routingProfile: "driving-car", displayName: "Alex" }) });
    expect(loadProfile()).toMatchObject({ routingProfile: "foot-walk", displayName: "Alex" });
  });
  it("does not persist a driving profile even from an invalid runtime caller", () => {
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { setItem });
    saveProfile({ ...normalizeProfile({}), routingProfile: "driving-car" } as unknown as UserProfile);
    expect(JSON.parse(setItem.mock.calls[0][1]).routingProfile).toBe("foot-walk");
  });
  it.each([null, [], "invalid", { mobilityAid: "constructor", avoidStairs: "false" }])("handles malformed preferences %s", raw => {
    expect(normalizeProfile(raw)).toMatchObject({ mobilityAid: "none", routingProfile: "foot-walk", avoidStairs: false });
  });
});