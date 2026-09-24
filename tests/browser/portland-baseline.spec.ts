import { expect, test } from "@playwright/test";
import type { Map as MapLibreMap } from "maplibre-gl";

const endpoint = "https://www.portlandmaps.com/od/rest/services/COP_OpenData_Transportation/MapServer/61/query*";
const record = { attributes: { OBJECTID: 137, NonAssetID: "0001-0000158", ADAWarnings: "N" }, geometry: { x: -122.6932492348886, y: 45.518015216712406 } };

for (const width of [390, 1280]) {
  test(`Portland municipal issues load, render, disclose provenance and persist at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => localStorage.setItem("blipmap:region", "portland"));
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    let downloads = 0;
    await page.route(endpoint, route => {
      downloads++;
      const url = new URL(route.request().url());
      expect(url.searchParams.get("where")).toBe("ADAWarnings='N'");
      return route.fulfill({ json: url.searchParams.has("returnIdsOnly")
        ? { objectIdFieldName: "OBJECTID", objectIds: [137] }
        : { spatialReference: { wkid: 4326 }, features: [record] } });
    });
    await page.goto("/");
    await expect(page.locator(".records-panel__baseline [role=status]")).toContainText("Last checked");
    await expect(page.locator("curb-record-card")).toHaveCount(1);
    await expect.poll(() => page.locator("curb-map").evaluate(element => Boolean((element as unknown as { _map: MapLibreMap })._map))).toBe(true);
    await page.locator("curb-map").evaluate((element, coordinates) => {
      (element as unknown as { _map: MapLibreMap })._map.jumpTo({ center: coordinates });
    }, [record.geometry.x, record.geometry.y] as [number, number]);
    await expect.poll(() => page.locator("curb-map").evaluate(element => {
      const map = (element as unknown as { _map: MapLibreMap })._map;
      return map?.queryRenderedFeatures().filter(feature => feature.source === "patches").length ?? 0;
    })).toBeGreaterThan(0);
    const card = page.getByRole("button", { name: "Detectable warning absent in city inventory (PBOT), caution", exact: true });
    await card.focus();
    await card.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Municipal inventory, not a live inspection");
    await expect(dialog).toContainText("0001-0000158");
    await expect(dialog).toContainText("not a missing-ramp report");
    await expect(dialog).not.toContainText("Imagery-based report");
    await expect(dialog).not.toContainText("Agree votes");
    await expect(dialog.getByRole("link", { name: "Source use terms" })).toHaveAttribute("href", /LayerID=52778/);
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`portland-source-${width}.png`) });
    await page.keyboard.press("Escape");
    await expect(card).toBeFocused();
    await page.reload();
    await expect(card).toBeVisible();
    await expect(page.locator(".records-panel__baseline [role=status]")).toContainText("Last checked");
    expect(downloads).toBe(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    expect(errors).toEqual([]);
  });
}

test("failed municipal refresh retains imported records and source evidence", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-22T12:00:00Z") });
  await page.addInitScript(() => localStorage.setItem("blipmap:region", "portland"));
  let unavailable = false;
  await page.route(endpoint, route => {
    if (unavailable) return route.fulfill({ json: { error: { code: 500, message: "Fixture service unavailable" } } });
    return route.fulfill({ json: new URL(route.request().url()).searchParams.has("returnIdsOnly")
      ? { objectIdFieldName: "OBJECTID", objectIds: [137] }
      : { spatialReference: { wkid: 4326 }, features: [record] } });
  });
  await page.goto("/");
  await expect(page.locator("curb-record-card")).toHaveCount(1);
  await expect(page.locator(".records-panel__baseline [role=status]")).toContainText("Last checked");
  unavailable = true;
  await page.clock.setSystemTime(new Date("2026-09-30T12:00:00Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator(".records-panel__baseline [role=status]")).toContainText("Portland update unavailable");
  await expect(page.locator("curb-record-card")).toHaveCount(1);
  const evidence = await page.evaluate(() => new Promise<unknown[]>((resolve, reject) => {
    const request = indexedDB.open("blipmap");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const read = database.transaction("sourceRecords").objectStore("sourceRecords").getAll();
      read.onsuccess = () => { database.close(); resolve(read.result); };
      read.onerror = () => { database.close(); reject(read.error); };
    };
  }));
  expect(evidence).toHaveLength(1);
  expect(evidence[0]).toMatchObject({ payload: record, license: "Portland data policy", attribution: "City of Portland, Bureau of Transportation" });
});