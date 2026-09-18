import { describe, it, expect } from "vitest";
import { measurePath, formatDistance } from "../measure";

describe("measurePath", () => {
  it("returns zero for fewer than 2 points", () => {
    expect(measurePath([]).meters).toBe(0);
    expect(measurePath([[-122.335, 47.608]]).meters).toBe(0);
    expect(measurePath([]).segmentMeters).toHaveLength(0);
  });

  it("returns a positive distance for two distinct points", () => {
    const result = measurePath([[-122.335, 47.608], [-122.334, 47.609]]);
    expect(result.meters).toBeGreaterThan(0);
    expect(result.segmentMeters).toHaveLength(1);
    expect(result.segmentMeters[0]).toBeGreaterThan(0);
  });

  it("accumulates multiple segments correctly", () => {
    const result = measurePath([
      [-122.335, 47.608],
      [-122.334, 47.609],
      [-122.333, 47.610],
    ]);
    expect(result.segmentMeters).toHaveLength(2);
    const sum = result.segmentMeters[0] + result.segmentMeters[1];
    expect(result.meters).toBeCloseTo(sum, 5);
  });

  it("label uses meters below 1 km", () => {
    const result = measurePath([[-122.335, 47.608], [-122.3351, 47.6081]]);
    expect(result.label).toMatch(/m$/);
  });
});

describe("formatDistance", () => {
  it("formats sub-1000 m correctly", () => {
    expect(formatDistance(248)).toBe("248 m");
    expect(formatDistance(12)).toBe("12 m");
    expect(formatDistance(999)).toBe("999 m");
  });

  it("formats 1 km and above in km", () => {
    expect(formatDistance(1000)).toBe("1.00 km");
    expect(formatDistance(1400)).toBe("1.40 km");
    expect(formatDistance(2500)).toBe("2.50 km");
  });
});
