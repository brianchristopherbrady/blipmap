import { expect, test, type Route } from "@playwright/test";

for (const width of [390, 1280]) {
  test(`restore cleared patches and indicators after reload at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("https://sidewalk-sea.cs.washington.edu/**", route => route.fulfill({ json: {
      type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [-122.335, 47.608] },
        properties: { label_cluster_id: 6001, label_type: "NoCurbRamp" } }],
    } }));
    await page.goto("/");
    const records = page.getByRole("complementary", { name: "Patches", exact: true });
    await expect(records.getByRole("listitem")).toHaveCount(1);
    page.once("dialog", dialog => dialog.accept());
    await records.getByRole("button", { name: "Clear all patches", exact: true }).click();
    await expect(records.getByRole("listitem")).toHaveCount(0);
    await page.reload();
    await expect(records.getByRole("listitem")).toHaveCount(0);
    await records.getByRole("button", { name: "Restore patches", exact: true }).click();
    await expect(records.getByRole("listitem")).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => {
      const element = document.querySelector("curb-map") as HTMLElement & { _map: import("maplibre-gl").Map };
      return element._map.queryRenderedFeatures(undefined, { layers: ["patches-clusters"] }).length;
    })).toBeGreaterThan(0);
    const target = await page.evaluate(width => {
      const element = document.querySelector("curb-map") as HTMLElement & { _map: import("maplibre-gl").Map };
      const map = element._map;
      map.jumpTo({ center: [-122.335, 47.608], zoom: 17,
        padding: { top: 0, left: 0, right: width >= 600 ? 360 : 0, bottom: width < 600 ? 450 : 0 } });
      const point = map.project([-122.335, 47.608]);
      const rect = map.getCanvas().getBoundingClientRect();
      return { x: rect.x + point.x, y: rect.y + point.y };
    }, width);
    await page.mouse.click(target.x, target.y);
    await expect(page.locator("curb-map .patch-marker")).toHaveCount(1);
    await expect(page.locator("curb-map .patch-marker svg")).toHaveCount(1);
    await page.reload();
    await expect(records.getByRole("listitem")).toHaveCount(1);
  });

  test(`Seattle search shows all returned matches and switching search area rebounds to Portland at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("https://sidewalk-sea.cs.washington.edu/**", route => route.fulfill({ json: { type: "FeatureCollection", features: [] } }));
    const requests: URL[] = [];
    await page.route("https://nominatim.openstreetmap.org/**", route => {
      const url = new URL(route.request().url());
      requests.push(url);
      return route.fulfill({ json: [
        ...Array.from({ length: 8 }, (_, index) => ({ display_name: `Library ${index + 1}, Seattle, Washington`, lon: "-122.332", lat: "47.606" })),
        { display_name: "Library in Portland", lon: "-122.68", lat: "45.52" },
      ] });
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Route", exact: true }).click();
    await expect(page.getByLabel("Search area")).toHaveValue("seattle");
    await page.getByLabel("From", { exact: true }).fill("Library");
    expect(requests).toHaveLength(0);
    await page.getByRole("button", { name: "Search from address" }).click();
    const results = page.getByRole("listbox", { name: "From address results" });
    await expect(results.getByRole("option")).toHaveCount(8);
    expect(requests[0].searchParams.get("bounded")).toBe("1");
    expect(requests[0].searchParams.get("countrycodes")).toBe("us");
    await expect(page.getByRole("option", { name: "Library in Portland" })).toHaveCount(0);
    const last = results.getByRole("option").last();
    await last.focus();
    await last.press("Enter");
    await expect(page.getByLabel("From", { exact: true })).toHaveValue("Library 8, Seattle, Washington");
    await page.getByLabel("Search area").selectOption("portland");
    await page.getByLabel("To", { exact: true }).fill("Library");
    await page.getByLabel("To", { exact: true }).press("Enter");
    await expect(page.getByRole("option", { name: "Library in Portland" })).toBeVisible();
    expect(requests[1].searchParams.get("viewbox")).toBe("-122.84,45.66,-122.47,45.43");
    await page.screenshot({ path: testInfo.outputPath(`address-results-${width}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}

test("editing and clearing search fields discard late results and expose failures", async ({ page }) => {
  let pending: Route | undefined;
  await page.route("https://sidewalk-sea.cs.washington.edu/**", route => route.fulfill({ json: { type: "FeatureCollection", features: [] } }));
  await page.route("https://nominatim.openstreetmap.org/**", async route => {
    const query = new URL(route.request().url()).searchParams.get("q");
    if (query === "Old address") { pending = route; return; }
    await route.fulfill(query === "Fail" ? { status: 503, body: "Unavailable" } : { json: [] });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Route", exact: true }).click();
  await page.getByLabel("From", { exact: true }).fill("Old address");
  await page.getByRole("button", { name: "Search from address" }).click();
  await expect.poll(() => !!pending).toBe(true);
  await page.getByRole("button", { name: "Clear route", exact: true }).click();
  await pending!.fulfill({ json: [{ display_name: "Stale address", lon: "-122.335", lat: "47.608" }] }).catch(() => undefined);
  await expect(page.getByRole("option", { name: "Stale address", exact: true })).toHaveCount(0);
  await page.getByLabel("From", { exact: true }).fill("No match");
  await page.getByRole("button", { name: "Search from address" }).click();
  await expect(page.getByText("No matching addresses in the Seattle area.", { exact: true })).toBeVisible();
  await page.getByLabel("From", { exact: true }).fill("Fail");
  await page.getByRole("button", { name: "Search from address" }).click();
  await expect(page.getByText("Address search is unavailable. Please try again.", { exact: true })).toBeVisible();
});