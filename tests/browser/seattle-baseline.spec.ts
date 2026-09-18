import { expect, test, type Page, type Route } from "@playwright/test";
import type { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import type { Patch } from "../../src/types/patch";
import { MAP_STYLE } from "../../src/config/map";

const baseline = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [-122.335, 47.608] },
      properties: {
        label_cluster_id: 8001, label_type: "NoCurbRamp", median_severity: 3,
        cluster_size: 2, agree_count: 9, disagree_count: 1, unsure_count: 0,
        avg_image_capture_date: "2019-05-01T00:00:00Z", avg_label_date: "2021-02-02T16:32:13Z",
      },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [-122.336, 47.608] },
      properties: { label_cluster_id: 8002, label_type: "SurfaceProblem", median_severity: 1 },
    },
  ],
};

async function storedPatches(page: Page): Promise<Patch[]> {
  return page.evaluate(() => new Promise<Patch[]>((resolve, reject) => {
    const openRequest = indexedDB.open("blipmap");
    openRequest.onerror = () => reject(openRequest.error);
    openRequest.onsuccess = () => {
      const database = openRequest.result;
      const readRequest = database.transaction("patches").objectStore("patches").getAll();
      readRequest.onsuccess = () => { database.close(); resolve(readRequest.result); };
      readRequest.onerror = () => { database.close(); reject(readRequest.error); };
    };
  }));
}

async function mapPatchCount(page: Page): Promise<number> {
  return page.locator("curb-map").evaluate(element => {
    const map = (element as unknown as { _map: MapLibreMap })._map;
    const source = map?.getSource("patches") as GeoJSONSource | undefined;
    const data = source?.serialize().data;
    return typeof data === "object" && data.type === "FeatureCollection" ? data.features.length : -1;
  });
}

test("Seattle is automatic by default, preserves edits, and persists across reload", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  let requests = 0;
  await page.route("https://sidewalk-sea.cs.washington.edu/v3/api/labelClusters?*", route => {
    requests++;
    return route.fulfill({ json: baseline });
  });
  await page.goto("/");
  await expect(page.locator("curb-record-card")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Import Seattle baseline", exact: true })).toHaveCount(0);
  await expect(page.locator(".records-panel__baseline [role=status]")).toContainText("Last checked");
  await expect.poll(() => mapPatchCount(page)).toBe(2);
  const imported = (await storedPatches(page)).find(patch => patch.id === "project-sidewalk-seattle:8001")!;
  await page.getByRole("button", { name: /Missing curb ramp \(Project Sidewalk\)/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "External source" })).toBeVisible();
  await expect(dialog).toContainText("2019");
  await expect(dialog).toContainText("Validation totals may include human and AI judgments");
  await page.screenshot({ path: testInfo.outputPath("desktop-source.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("mobile-source.png") });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: /Missing curb ramp \(Project Sidewalk\)/ })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Edit Patch", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Local correction");
  await page.getByRole("button", { name: /Save/ }).click();
  await expect(page.getByLabel("Title", { exact: true })).not.toBeVisible();
  const edited = (await storedPatches(page)).find(patch => patch.id === imported.id)!;
  expect(edited.properties.source).toEqual(imported.properties.source);
  expect(edited.properties.title).toBe("Local correction");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.reload();
  await expect(page.locator("curb-record-card")).toHaveCount(2);
  await expect(page.locator(".records-panel__baseline [role=status]")).toContainText("Last checked");
  const after = await storedPatches(page);
  expect(after.find(patch => patch.id === imported.id)).toEqual(edited);
  expect(after.some(patch => patch.id.startsWith("seed-"))).toBe(false);
  expect(requests).toBe(1);
  expect(errors).toEqual([]);
});

test("Seattle patches render while basemap tile requests are still pending", async ({ page }, testInfo) => {
  const pendingTiles: Route[] = [];
  const raster = MAP_STYLE.sources.osm;
  if (raster.type !== "raster" || !raster.tiles?.length) throw new Error("Expected raster basemap configuration");
  const tileHost = new URL(raster.tiles[0]).hostname;
  await page.route(url => url.hostname === tileHost, route => { pendingTiles.push(route); });
  await page.route("https://sidewalk-sea.cs.washington.edu/v3/api/labelClusters?*", route => route.fulfill({ json: baseline }));
  try {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("curb-record-card")).toHaveCount(2);
    await expect.poll(() => mapPatchCount(page)).toBe(2);
    await expect.poll(() => page.locator("curb-map").evaluate(element => {
      const map = (element as unknown as { _map: MapLibreMap })._map;
      return map.queryRenderedFeatures().filter(feature => feature.source === "patches").length;
    })).toBeGreaterThan(0);
    expect(pendingTiles.length).toBeGreaterThan(0);
    await page.screenshot({ path: testInfo.outputPath("patches-without-tiles.png") });
  } finally {
    await Promise.all(pendingTiles.map(route => route.abort().catch(() => undefined)));
  }
});

test("failed initial download retries automatically after an hour", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-17T12:00:00Z") });
  let failed = true;
  let requests = 0;
  await page.route("https://sidewalk-sea.cs.washington.edu/v3/api/labelClusters?*", route => {
    requests++;
    return failed ? route.fulfill({ status: 500, body: "Service unavailable" }) : route.fulfill({ json: baseline });
  });
  await page.goto("/");
  await expect(page.locator(".records-panel__baseline [role=status]")).toContainText("Seattle update unavailable");
  expect(await storedPatches(page)).toEqual([]);
  await page.clock.fastForward(5 * 60 * 1000);
  expect(requests).toBe(1);
  failed = false;
  await page.clock.fastForward(60 * 60 * 1000);
  await expect(page.locator("curb-record-card")).toHaveCount(2);
  await expect(page.locator(".records-panel__baseline [role=status]")).toContainText("Last checked");
  expect(requests).toBe(2);
});

test("daily refresh updates existing reports without user interaction and keeps cache on failure", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-17T12:00:00Z") });
  let revision = 0;
  let requests = 0;
  await page.route("https://sidewalk-sea.cs.washington.edu/v3/api/labelClusters?*", route => {
    requests++;
    if (revision === 2) return route.abort("internetdisconnected");
    const data = structuredClone(baseline);
    if (revision === 1) data.features[1].properties.median_severity = 3;
    return route.fulfill({ json: data });
  });
  await page.goto("/");
  await expect(page.locator("curb-record-card")).toHaveCount(2);
  await expect(page.locator(".records-panel__baseline [role=status]")).toContainText("Last checked");
  const initial = await storedPatches(page);
  expect(initial.find(patch => patch.id.endsWith(":8002"))?.properties.severity).toBe("caution");
  revision = 1;
  await page.clock.fastForward(24 * 60 * 60 * 1000);
  await expect.poll(async () => (await storedPatches(page)).find(patch => patch.id.endsWith(":8002"))?.properties.severity).toBe("difficult");
  expect(requests).toBe(2);
  const updated = await storedPatches(page);
  expect(updated).toHaveLength(2);
  revision = 2;
  await page.clock.fastForward(24 * 60 * 60 * 1000);
  await expect(page.locator(".records-panel__baseline [role=status]")).toContainText("Seattle update unavailable");
  expect(await storedPatches(page)).toEqual(updated);
  await page.reload();
  await expect(page.locator("curb-record-card")).toHaveCount(2);
  await expect(page.locator(".records-panel__baseline [role=status]")).toContainText("Update pending");
  expect(requests).toBe(3);
});