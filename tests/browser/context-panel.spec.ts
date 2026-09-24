import { expect, test } from "@playwright/test";
import type { Map as MapLibreMap } from "maplibre-gl";

type MapElement = HTMLElement & { _map: MapLibreMap; mode: string };

for (const viewport of [{ width: 320, height: 700 }, { width: 390, height: 500 }, { width: 390, height: 812 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1728, height: 1000 }, { width: 844, height: 390 }]) {
  test(`drawing actions and results stay reachable at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("https://sidewalk-sea.cs.washington.edu/**", route => route.fulfill({ json: {
      type: "FeatureCollection",
      features: Array.from({ length: 25 }, (_, index) => ({
        type: "Feature", geometry: { type: "Point", coordinates: [-122.335 + index * 0.00001, 47.608] },
        properties: { label_cluster_id: 5000 + index, label_type: "SurfaceProblem" },
      })),
    } }));
    await page.goto("/");
    await expect.poll(() => page.evaluate(() => !!(document.querySelector("curb-map") as MapElement)?._map?.getSource("patches"))).toBe(true);
    await expect.poll(() => page.evaluate(async () => {
      const map = (document.querySelector("curb-map") as MapElement)._map;
      const source = map.getSource("patches") as import("maplibre-gl").GeoJSONSource;
      const data = await source.getData() as GeoJSON.FeatureCollection;
      return data.features.length;
    })).toBe(25);
    await page.getByRole("button", { name: "Check", exact: true }).click();
    const panel = page.getByRole("complementary", { name: "Path Check", exact: true });
    const finish = panel.getByRole("button", { name: "Finish drawing", exact: true });
    await expect(finish).toBeDisabled();
    await expect(page.getByRole("complementary", { name: "Patches", exact: true })).toHaveCount(0);
    const points = await page.evaluate(({ width, height }) => {
      const map = (document.querySelector("curb-map") as MapElement)._map;
      const panel = document.querySelector(".context-panel")!.getBoundingClientRect();
      map.jumpTo({ center: [-122.335, 47.608], zoom: 17,
        padding: { top: 0, left: width > 600 ? 82 : 0, right: width > 600 ? panel.width : 0, bottom: width <= 600 ? height - panel.top : 0 } });
      const rect = map.getCanvas().getBoundingClientRect();
      return [[-122.3355, 47.608], [-122.3345, 47.608]].map(coords => {
        const point = map.project(coords as [number, number]);
        return { x: rect.x + point.x, y: rect.y + point.y };
      });
    }, viewport);
    await page.mouse.click(points[0].x, points[0].y);
    await expect(finish).toBeDisabled();
    await page.mouse.click(points[1].x, points[1].y);
    await expect(finish).toBeEnabled();
    await expect(panel.locator(".path-check-list__item")).toHaveCount(25);
    const firstDistance = await panel.locator(".tool-panel__value").innerText();
    await page.mouse.click(points[0].x, points[0].y);
    await expect(panel.locator(".tool-panel__value")).not.toHaveText(firstDistance);
    await finish.click();
    await expect(panel.getByRole("list", { name: "Nearby patches" })).toBeVisible();
    await expect(panel.locator(".path-check-list__item")).toHaveCount(25);
    await page.mouse.click(points[0].x, points[0].y);
    await expect(panel.getByRole("button", { name: "Path complete", exact: true })).toBeDisabled();
    const last = panel.locator(".path-check-list__item").last();
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
    const exit = panel.getByRole("button", { name: "Exit Path Check" });
    await expect(exit).toBeInViewport();
    await expect(panel.getByRole("button", { name: "Path complete", exact: true })).toBeDisabled();
    const layout = await panel.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, right: rect.right, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    expect(layout.top).toBeGreaterThanOrEqual(56);
    expect(layout.bottom).toBeLessThanOrEqual(viewport.height);
    expect(layout.right).toBeLessThanOrEqual(viewport.width);
    expect(layout.overflow).toBe(false);
    await page.screenshot({ path: testInfo.outputPath(`path-results-${viewport.width}.png`) });
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await page.screenshot({ path: testInfo.outputPath(`path-results-dark-${viewport.width}.png`) });
    await panel.getByRole("button", { name: "Draw again" }).click();
    await expect(finish).toBeDisabled();
    await expect(panel.locator(".path-check-list")).toHaveCount(0);
    await page.mouse.click(points[0].x, points[0].y);
    await page.mouse.click(points[1].x, points[1].y);
    await page.keyboard.press("Enter");
    await expect(panel.getByRole("button", { name: "Path complete", exact: true })).toBeDisabled();
    await exit.click();
    await expect(panel).toHaveCount(0);
    await expect(page.getByRole("complementary", { name: "Patches", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Measure", exact: true }).click();
    await expect(page.getByRole("button", { name: "Finish measurement" })).toBeDisabled();
    await page.mouse.click(points[0].x, points[0].y);
    await page.mouse.click(points[1].x, points[1].y);
    await page.getByRole("button", { name: "Finish measurement" }).click();
    await expect(page.getByRole("button", { name: "Measurement complete" })).toBeDisabled();
    await page.getByRole("button", { name: "Exit measurement" }).click();
    await page.getByRole("button", { name: "Route", exact: true }).click();
    const routePanel = page.getByRole("complementary", { name: "Route planner", exact: true });
    await expect(routePanel.getByRole("button", { name: "Clear route", exact: true })).toBeInViewport();
    await routePanel.getByRole("button", { name: "Clear route", exact: true }).click();
    await routePanel.getByRole("button", { name: "Close route planner" }).click();
    await expect(routePanel).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test("route clearing and exit remain available above scrolled directions", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 812 });
  await page.route("https://sidewalk-sea.cs.washington.edu/**", route => route.fulfill({ json: { type: "FeatureCollection", features: [] } }));
  await page.route("https://nominatim.openstreetmap.org/**", route => {
    const start = new URL(route.request().url()).searchParams.get("q") === "Start";
    return route.fulfill({ json: [{ display_name: start ? "Seattle start" : "Seattle end", lon: start ? "-122.335" : "-122.334", lat: start ? "47.608" : "47.609" }] });
  });
  await page.route("https://api.openrouteservice.org/v2/directions/**", route => route.fulfill({ json: {
    features: [{ geometry: { type: "LineString", coordinates: [[-122.335, 47.608], [-122.334, 47.609]] },
      properties: { summary: { distance: 150, duration: 120 }, segments: [{ steps: Array.from({ length: 30 }, () => ({ instruction: "Continue onto First Avenue", distance: 5, duration: 4 })) }] } }],
  } }));
  await page.goto("/");
  await page.getByRole("button", { name: "Route", exact: true }).click();
  await page.getByLabel("From", { exact: true }).fill("Start");
  await page.getByRole("button", { name: "Search from address" }).click();
  await page.getByRole("option", { name: "Seattle start", exact: true }).click();
  await page.getByLabel("To", { exact: true }).fill("Finish");
  await page.getByRole("button", { name: "Search to address" }).click();
  await page.getByRole("option", { name: "Seattle end", exact: true }).click();
  await page.getByRole("button", { name: "Get route", exact: true }).click();
  await page.getByRole("button", { name: "Show 30 steps" }).click();
  await page.locator(".route-panel__steps li").last().scrollIntoViewIfNeeded();
  const clear = page.getByRole("button", { name: "Clear route", exact: true });
  await expect(clear).toBeInViewport();
  await clear.click();
  await expect(page.locator(".route-panel__result")).toHaveCount(0);
  await expect.poll(() => page.evaluate(async () => {
    const map = (document.querySelector("curb-map") as MapElement)._map;
    const data = await (map.getSource("route-line") as import("maplibre-gl").GeoJSONSource).getData() as GeoJSON.FeatureCollection;
    return data.features.length;
  })).toBe(0);
  await page.getByRole("button", { name: "Close route planner" }).click();
  await expect(page.getByRole("complementary", { name: "Patches", exact: true })).toBeVisible();
});