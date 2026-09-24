import { expect, test } from "@playwright/test";

for (const viewport of [{ width: 640, height: 400 }, { width: 427, height: 267 }, { width: 320, height: 200 }]) {
  test(`toolbar and records remain reachable in zoom-equivalent ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.route("https://sidewalk-sea.cs.washington.edu/**", route => route.fulfill({ json: {
      type: "FeatureCollection", features: Array.from({ length: 12 }, (_, index) => ({
        type: "Feature", geometry: { type: "Point", coordinates: [-122.335 + index * 0.0001, 47.608] },
        properties: { label_cluster_id: 8000 + index, label_type: "NoCurbRamp" },
      })),
    } }));
    await page.goto("/");
    const toolbar = page.getByRole("navigation", { name: "Map tools" });
    const records = page.getByRole("complementary", { name: "Patches", exact: true });
    await expect(records.getByRole("listitem")).toHaveCount(12);
    for (const surface of [toolbar, records]) {
      const rect = await surface.boundingBox();
      expect(rect).not.toBeNull();
      expect(rect!.y).toBeGreaterThanOrEqual(56);
      expect(rect!.y + rect!.height).toBeLessThanOrEqual(viewport.height + 1);
      expect(rect!.x).toBeGreaterThanOrEqual(0);
      expect(rect!.x + rect!.width).toBeLessThanOrEqual(viewport.width + 1);
    }
    for (const name of ["Browse", "Patch", "Measure", "Check", "Route", "Fit", "Export", "Locate", "Import", "Browse"]) {
      const button = toolbar.getByRole("button", { name, exact: true });
      await button.scrollIntoViewIfNeeded();
      await expect(button).toBeInViewport();
      await button.click({ trial: true });
    }
    const last = records.getByRole("listitem").last().getByRole("button");
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
    await last.click({ trial: true });
    const search = records.getByRole("searchbox", { name: "Search patches" });
    await search.scrollIntoViewIfNeeded();
    await search.fill("Missing curb");
    await expect(search).toHaveValue("Missing curb");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath(`zoom-layout-${viewport.width}.png`) });
    await toolbar.getByRole("button", { name: "Check", exact: true }).click();
    const exit = page.getByRole("button", { name: "Exit Path Check" });
    await exit.scrollIntoViewIfNeeded();
    await exit.click();
    await expect(records).toBeVisible();
  });
}