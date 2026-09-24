import { expect, test } from "@playwright/test";
import type { Map as MapLibreMap } from "maplibre-gl";

test("live PBOT inventory imports and renders on desktop and mobile", async ({ page }, testInfo) => {
  test.skip(process.env.BLIPMAP_LIVE_DATA !== "1", "Opt-in network check against the real municipal service.");
  test.setTimeout(240000);
  await page.addInitScript(() => localStorage.setItem("blipmap:region", "portland"));
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator(".records-panel__baseline [role=status]")).toContainText("Last checked", { timeout: 180000 });
  const count = await page.locator("curb-record-card").count();
  expect(count).toBeGreaterThan(0);
  console.log(`Live Portland inventory: ${count} records`);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.locator("curb-map").evaluate(element => {
      const map = (element as unknown as { _map: MapLibreMap })._map;
      return map?.queryRenderedFeatures().filter(feature => feature.source === "patches").length ?? 0;
    }), { timeout: 20000 }).toBeGreaterThan(0);
    await expect.poll(() => page.locator("curb-map").evaluate(element => (element as unknown as { _map: MapLibreMap })._map.areTilesLoaded()), { timeout: 20000 }).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath(`portland-live-${width}.png`) });
  }
  await page.reload();
  await expect(page.locator("curb-record-card")).toHaveCount(count, { timeout: 30000 });
  expect(errors).toEqual([]);
});