import { expect, test, type Route } from "@playwright/test";

const seattle = { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [-122.335, 47.608] },
  properties: { label_cluster_id: 8123, label_type: "NoCurbRamp" } }] };
const portland = { type: "FeatureCollection", features: [{ id: "portland-local-fixture", type: "Feature",
  geometry: { type: "Point", coordinates: [-122.6765, 45.5231] }, properties: {
    title: "Portland local fixture", category: "surface", severity: "caution", status: "observed", notes: "Synthetic test observation",
  } }] };

for (const width of [390, 1280]) {
  test(`regions isolate records, search and recovery with keyboard access at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    let sourceRequests = 0;
    await page.route("https://www.portlandmaps.com/od/rest/**", route => route.fulfill({ status: 503, body: "Fixture: source offline" }));
    await page.route("https://sidewalk-sea.cs.washington.edu/**", route => { sourceRequests++; return route.fulfill({ json: seattle }); });
    const searches: URL[] = [];
    await page.route("https://nominatim.openstreetmap.org/**", route => {
      searches.push(new URL(route.request().url()));
      return route.fulfill({ json: [
        { display_name: "Portland public place", lon: "-122.6765", lat: "45.5231" },
        { display_name: "Seattle place", lon: "-122.335", lat: "47.608" },
      ] });
    });
    await page.goto("/");
    const records = page.getByRole("complementary", { name: "Patches", exact: true });
    const region = page.getByRole("combobox", { name: "Region", exact: true });
    await expect(region).toHaveValue("seattle");
    await expect(records.getByRole("listitem")).toHaveCount(1);
    await page.locator('input[accept=".geojson,.json"]').setInputFiles({ name: "portland-fixture.geojson", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(portland)) });
    await expect(page.getByRole("status").filter({ hasText: "Imported 1 Patches." })).toBeVisible();
    await expect(records.getByRole("listitem")).toHaveCount(1);
    await region.focus();
    await region.press("ArrowDown");
    await region.press("Enter");
    await expect(region).toHaveValue("portland");
    await expect(page.locator(".records-panel__baseline [role=status]")).toContainText("Portland update unavailable");
    await expect(records.getByRole("listitem")).toHaveCount(1);
    await expect(records).not.toContainText("Missing curb ramp");
    await expect.poll(() => page.evaluate(() => {
      const element = document.querySelector("curb-map") as HTMLElement & { _map: import("maplibre-gl").Map };
      return element?._map?.getCenter().lat;
    })).toBeCloseTo(45.5231, 3);
    const card = records.getByRole("button", { name: "Portland local fixture, caution", exact: true });
    await card.focus();
    await card.press("Enter");
    await expect(page.getByRole("dialog", { name: "Portland local fixture", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(card).toBeFocused();
    await page.getByRole("button", { name: "Route", exact: true }).click();
    await expect(page.getByLabel("Search area")).toHaveValue("portland");
    await page.getByLabel("From", { exact: true }).fill("Public place");
    await page.getByLabel("From", { exact: true }).press("Enter");
    const matches = page.getByRole("listbox", { name: "From address results" });
    await expect(matches.getByRole("option")).toHaveCount(1);
    expect(searches[0].searchParams.get("viewbox")).toBe("-122.84,45.66,-122.47,45.43");
    await matches.getByRole("option").focus();
    await matches.getByRole("option").press("Enter");
    await expect(page.getByLabel("From", { exact: true })).toHaveValue("Portland public place");
    await page.getByRole("button", { name: "Close route planner" }).click();
    page.once("dialog", dialog => dialog.accept());
    await records.getByRole("button", { name: "Clear all patches", exact: true }).click();
    await expect(records.getByRole("listitem")).toHaveCount(0);
    await region.selectOption("seattle");
    await expect(records.getByRole("listitem")).toHaveCount(1);
    await region.selectOption("portland");
    await expect(records.getByRole("listitem")).toHaveCount(0);
    await records.getByRole("button", { name: "Restore patches", exact: true }).click();
    await expect(card).toBeVisible();
    await page.reload();
    await expect(region).toHaveValue("portland");
    await expect(card).toBeVisible();
    expect(sourceRequests).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await expect.poll(() => page.evaluate(() => {
      const element = document.querySelector("curb-map") as HTMLElement & { _map: import("maplibre-gl").Map };
      return element?._map?.areTilesLoaded();
    }), { timeout: 20000 }).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`portland-${width}.png`) });
    expect(errors).toEqual([]);
  });
}

test("a late Seattle download cannot populate the selected Portland region", async ({ page }) => {
  let pending: Route | undefined;
  await page.route("https://www.portlandmaps.com/od/rest/**", route => route.fulfill({ status: 503, body: "Fixture: source offline" }));
  await page.route("https://sidewalk-sea.cs.washington.edu/**", route => { pending = route; });
  await page.goto("/");
  await expect.poll(() => !!pending).toBe(true);
  await page.getByRole("combobox", { name: "Region", exact: true }).selectOption("portland");
  await pending!.fulfill({ json: seattle });
  await expect(page.locator(".records-panel__baseline [role=status]")).toContainText("Portland update unavailable");
  await expect(page.getByRole("complementary", { name: "Patches", exact: true }).getByRole("listitem")).toHaveCount(0);
  await page.getByRole("combobox", { name: "Region", exact: true }).selectOption("seattle");
  await expect(page.getByRole("complementary", { name: "Patches", exact: true }).getByRole("listitem")).toHaveCount(1);
});