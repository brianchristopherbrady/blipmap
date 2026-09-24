import { expect, test, type Page, type Route } from "@playwright/test";

function routeResponse(profile: string) {
  return {
    metadata: { query: { profile } },
    features: [{
      geometry: { type: "LineString", coordinates: [[-122.335, 47.608], [-122.334, 47.609]] },
      properties: { summary: { distance: 150, duration: 120 }, segments: [{ steps: [
        { instruction: "Turn left onto 1st Avenue", distance: 150, duration: 120 },
      ] }] },
    }],
  };
}

async function prepare(page: Page, profile: string, nearbyBarrier = false, localPhoto?: string) {
  await page.addInitScript(routingProfile => {
    localStorage.setItem("blipmap:profile", JSON.stringify({ routingProfile }));
  }, profile);
  await page.route("https://sidewalk-sea.cs.washington.edu/**", route => route.fulfill({ json: {
    type: "FeatureCollection", features: [{
      type: "Feature", geometry: { type: "Point", coordinates: nearbyBarrier ? [-122.335, 47.608] : [-122.34, 47.70] },
      properties: { label_cluster_id: 901, label_type: "NoCurbRamp", tag_counts: nearbyBarrier ? { ["LongUnbrokenSourceNote".repeat(8)]: 1 } : {} },
    }],
  } }));
  await page.route("https://nominatim.openstreetmap.org/**", route => {
    const start = new URL(route.request().url()).searchParams.get("q") === "Start";
    return route.fulfill({ json: [{ display_name: start ? "Seattle start" : "Seattle end", lon: start ? "-122.335" : "-122.334", lat: start ? "47.608" : "47.609" }] });
  });
  await page.goto("/");
  if (localPhoto) {
    await expect.poll(() => page.evaluate(photo => new Promise<boolean>((resolve, reject) => {
      const request = indexedDB.open("blipmap");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction("patches", "readwrite");
        const store = transaction.objectStore("patches");
        const lookup = store.get("project-sidewalk-seattle:901");
        let found = false;
        lookup.onsuccess = () => {
          if (lookup.result) {
            found = true;
            store.put({ ...lookup.result, properties: { ...lookup.result.properties, photo } });
          }
        };
        transaction.oncomplete = () => { database.close(); resolve(found); };
        transaction.onerror = () => { database.close(); reject(transaction.error); };
      };
    }), localPhoto)).toBe(true);
    await page.reload();
  }
  await page.getByRole("button", { name: "Route", exact: true }).click();
  await page.getByLabel("From", { exact: true }).fill("Start");
  await page.getByRole("button", { name: "Search from address" }).click();
  await page.getByRole("option", { name: "Seattle start", exact: true }).click();
  await page.getByLabel("To", { exact: true }).fill("Finish");
  await page.getByRole("button", { name: "Search to address" }).click();
  await page.getByRole("option", { name: "Seattle end", exact: true }).click();
  await expect(page.getByRole("button", { name: "Get route", exact: true })).toBeEnabled();
}

for (const width of [1280, 390]) {
  test(`original report links keep local photos and route focus at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    let routeRequests = 0;
    await page.route("https://api.openrouteservice.org/v2/directions/**", route => {
      routeRequests++;
      return route.fulfill({ json: routeResponse("foot-walking") });
    });
    const photo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
    await prepare(page, "foot-walk", true, photo);
    let lookups = 0;
    await page.route(/https:\/\/sidewalk-sea\.cs\.washington\.edu\/v3\/api\/labelClusters\?.*includeRawLabels=true/, route => {
      lookups++;
      return route.fulfill({ json: { type: "FeatureCollection", features: [{
        type: "Feature", properties: {
          label_cluster_id: 901, label_type: "NoCurbRamp", label_ids: [126583, 126584, 126585, 126586, 126583],
          labels: [{ label_id: 126583, image_capture_date: "2019-06", pano_url: "https://untrusted.invalid/image" }],
        },
      }] } });
    });
    const remoteImages: string[] = [];
    page.on("request", request => {
      if (/sidewalk-sea|untrusted\.invalid/.test(request.url()) && request.resourceType() === "image") remoteImages.push(request.url());
    });
    await page.getByRole("button", { name: "Get route", exact: true }).click();
    await page.getByRole("button", { name: "Show 1 steps" }).click();
    const barrier = page.locator(".route-panel__barrier-title").filter({ hasText: "Project Sidewalk" }).first();
    await expect(barrier).toBeVisible();
    expect(lookups).toBe(0);
    const summary = await page.locator(".route-panel__summary").innerText();
    await barrier.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Showing 3 of 4 original reports");
    await expect(dialog.getByRole("link", { name: /View original report/ })).toHaveCount(3);
    const report = dialog.getByRole("link", { name: "View original report 126583", exact: true });
    await expect(report).toHaveAttribute("href", "https://sidewalk-sea.cs.washington.edu/label/126583");
    await expect(report).toHaveAttribute("rel", "noopener noreferrer");
    await expect(report).toHaveAttribute("target", "_blank");
    await expect(dialog).toContainText("Imagery date: 2019-06");
    await expect(dialog).toContainText("Inline imagery is not licensed for display here");
    const local = dialog.getByRole("region", { name: "Local photo" }).getByRole("img");
    await expect(local).toHaveAttribute("src", photo);
    await expect.poll(() => local.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(1);
    await expect(dialog.locator("img")).toHaveCount(1);
    await expect(dialog.locator("iframe")).toHaveCount(0);
    await report.focus();
    await expect(report).toBeFocused();
    expect(await report.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`original-reports-${width}.png`) });
    await page.getByRole("button", { name: "Close patch details" }).click();
    await expect(barrier).toBeFocused();
    await expect(page.locator(".route-panel__summary")).toHaveText(summary, { useInnerText: true });
    await expect(page.locator(".route-panel__steps")).toContainText("Turn left onto 1st Avenue");
    await barrier.press("Enter");
    await expect(dialog).toContainText("Showing 3 of 4 original reports");
    await page.keyboard.press("Escape");
    await expect(barrier).toBeFocused();
    expect(lookups).toBe(2);
    expect(routeRequests).toBe(1);
    expect(remoteImages).toEqual([]);
  });

  test(`original report failure and late response remain unavailable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("https://api.openrouteservice.org/v2/directions/**", route => route.fulfill({ json: routeResponse("foot-walking") }));
    await prepare(page, "foot-walk", true);
    let pending: Route | undefined;
    let requests = 0;
    await page.route(/https:\/\/sidewalk-sea\.cs\.washington\.edu\/v3\/api\/labelClusters\?.*includeRawLabels=true/, route => {
      requests++;
      if (requests === 1) { pending = route; return; }
      return route.fulfill({ status: 503, body: "Unavailable" });
    });
    await page.getByRole("button", { name: "Get route", exact: true }).click();
    const barrier = page.locator(".route-panel__barrier-title").filter({ hasText: "Project Sidewalk" }).first();
    await barrier.click();
    await expect(page.getByRole("dialog").getByRole("status")).toContainText("Looking up original reports");
    await expect.poll(() => Boolean(pending)).toBe(true);
    await page.keyboard.press("Escape");
    await expect(barrier).toBeFocused();
    await barrier.press("Space");
    await expect(page.getByRole("heading", { name: "Original imagery unavailable" })).toBeVisible();
    await pending!.fulfill({ json: { type: "FeatureCollection", features: [{
      properties: { label_cluster_id: 901, label_type: "NoCurbRamp", label_ids: [126583] },
    }] } }).catch(() => undefined);
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("link", { name: /View original report/ })).toHaveCount(0);
    await expect(dialog.locator("img, iframe")).toHaveCount(0);
    await expect(dialog).toContainText("no verified link to an original image or panorama");
    await page.keyboard.press("Escape");
    await expect(barrier).toBeFocused();
    expect(requests).toBe(2);
  });

  test(`route barrier details preserve route and disclose unavailable imagery at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    let routeRequests = 0;
    await page.route("https://api.openrouteservice.org/v2/directions/**", route => {
      routeRequests += 1;
      return route.fulfill({ json: routeResponse("foot-walking") });
    });
    await prepare(page, "foot-walk", true);
    await page.getByRole("button", { name: "Get route", exact: true }).click();
    await page.getByRole("button", { name: "Show 1 steps" }).click();
    const barrier = page.locator(".route-panel__barrier-title").filter({ hasText: "Project Sidewalk" }).first();
    await expect(barrier).toBeVisible();
    await expect(barrier).toHaveAttribute("aria-haspopup", "dialog");
    const title = (await barrier.innerText()).trim();
    const summary = await page.locator(".route-panel__summary").innerText();
    const imageRequests: string[] = [];
    page.on("request", request => {
      if (request.resourceType() === "image") imageRequests.push(request.url());
    });
    for (const activation of ["click", "Enter", "Space"]) {
      if (activation === "click") await barrier.click();
      else await barrier.press(activation);
      const dialog = page.getByRole("dialog", { name: title, exact: true });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("heading", { name: title, exact: true })).toBeFocused();
      await expect(dialog.getByRole("heading", { name: "Original imagery unavailable" })).toBeVisible();
      await expect(dialog).toContainText("no verified link to an original image or panorama");
      await expect(dialog).toContainText("Observation data: CC0. Observation data only; excludes imagery.");
      await expect(dialog.getByRole("link", { name: "Project Sidewalk Seattle source information" })).toBeVisible();
      await expect(dialog.getByRole("link", { name: "View original report" })).toHaveCount(0);
      await expect(dialog.locator("img, iframe")).toHaveCount(0);
      expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      if (activation === "click") await page.screenshot({ path: testInfo.outputPath(`barrier-details-${width}.png`) });
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(barrier).toBeFocused();
      await expect(page.getByRole("complementary", { name: "Route planner" })).toBeVisible();
      await expect(page.getByLabel("From", { exact: true })).toHaveValue("Seattle start");
      await expect(page.getByLabel("To", { exact: true })).toHaveValue("Seattle end");
      await expect(page.locator(".route-panel__summary")).toHaveText(summary, { useInnerText: true });
      await expect(page.locator(".route-panel__steps")).toContainText("Turn left onto 1st Avenue");
    }
    expect(routeRequests).toBe(1);
    expect(imageRequests).toEqual([]);
    expect(await barrier.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: testInfo.outputPath(`barrier-return-${width}.png`) });
  });

  test(`readable named and unnamed directions, safe print and barrier flow at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const unsafeName = '<img src=x onerror="alert(1)"> & Pine';
    const longName = "LongUnbrokenProviderName".repeat(12);
    await page.route("https://api.openrouteservice.org/v2/directions/**", route => {
      const response = routeResponse("foot-walking");
      response.features[0].properties.segments[0].steps = [
        { instruction: "Turn right", name: "Pine Street", type: 1, distance: 402, duration: 300 },
        { instruction: "Turn left onto Pine Street", name: "Pine Street", type: 0, distance: 1, duration: 1 },
        { instruction: "Continue straight", name: "-", type: 6, distance: 20, duration: 15 },
        { instruction: "Turn right", name: unsafeName, type: 1, distance: 4, duration: 3 },
        { instruction: "Continue straight", name: longName, type: 6, distance: 2, duration: 1 },
        { instruction: "You have arrived", name: "-", type: 10, distance: 0, duration: 0 },
      ] as typeof response.features[0]["properties"]["segments"][0]["steps"];
      return route.fulfill({ json: response });
    });
    await prepare(page, "foot-walk", true);
    await page.getByRole("button", { name: "Get route", exact: true }).click();
    await page.getByRole("button", { name: "Show 6 steps" }).click();
    const expected = [
      "Turn right (Pine Street) (402 m)",
      "Turn left onto Pine Street (1 m)",
      "Continue straight (street/path name not provided) (20 m)",
      `Turn right (${unsafeName}) (4 m)`,
      `Continue straight (${longName}) (2 m)`,
      "You have arrived",
    ];
    await expect(page.locator(".route-panel__steps li")).toHaveText(expected);
    await expect(page.locator(".route-panel__steps img")).toHaveCount(0);
    await expect(page.locator(".route-panel__imagery-note")).toHaveText("Project Sidewalk reports are based on external imagery. Source images are not imported or attached.");
    const barrier = page.locator(".route-panel__barrier-text").filter({ hasText: "Project Sidewalk" }).first();
    await expect(barrier.locator(".route-panel__note")).toContainText("current conditions are unverified");
    expect(await barrier.evaluate(element => {
      const note = element.querySelector(".route-panel__note")!;
      const bounds = element.getBoundingClientRect();
      const noteBounds = note.getBoundingClientRect();
      return noteBounds.y > bounds.y && Math.abs(noteBounds.x - bounds.x) < 1 && element.scrollWidth <= element.clientWidth;
    })).toBe(true);
    expect(await page.locator(".route-panel").evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`directions-${width}.png`) });
    await page.evaluate(() => {
      const original = window.open.bind(window);
      window.open = (...args: Parameters<typeof window.open>) => {
        const popup = original(...args);
        if (popup) popup.print = () => undefined;
        return popup;
      };
    });
    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("button", { name: /Print directions/ }).click();
    const popup = await popupPromise;
    for (const [index, text] of expected.entries()) {
      await expect(popup.locator("pre")).toContainText(`${index + 1}. ${text}`);
    }
    await expect(popup.locator("img, script")).toHaveCount(0);
    await expect(popup.locator("pre")).toContainText("Source images are not imported or attached.");
    await expect(popup.locator("pre")).toContainText("LongUnbrokenSourceNote".repeat(8));
    await popup.setViewportSize({ width, height: 900 });
    await popup.emulateMedia({ media: "print" });
    expect(await popup.locator("pre").evaluate(element => {
      const bounds = element.getBoundingClientRect();
      const root = document.documentElement;
      return matchMedia("print").matches && element.scrollWidth <= element.clientWidth
        && root.scrollWidth <= root.clientWidth && bounds.left >= 0 && bounds.right <= root.clientWidth;
    })).toBe(true);
    await popup.screenshot({ path: testInfo.outputPath(`print-directions-${width}.png`), fullPage: true });
    await popup.close();
  });
}

for (const [profile, providerProfile] of [
  ["foot-walk", "foot-walking"], ["foot-hike", "foot-hiking"],
  ["wheelchair", "wheelchair"], ["cycling", "cycling-regular"],
  ["driving-car", "foot-walking"],
]) {
  test(`${profile} preferences produce ${providerProfile} directions and printout`, async ({ page }, testInfo) => {
    const requests: string[] = [];
    await page.route("https://api.openrouteservice.org/v2/directions/**", route => {
      requests.push(route.request().url());
      return route.fulfill({ json: routeResponse(providerProfile) });
    });
    await prepare(page, profile);
    await page.getByRole("button", { name: "Get route", exact: true }).click();
    await page.getByRole("button", { name: "Show 1 steps" }).click();
    await expect(page.locator(".route-panel__steps")).toContainText("Turn left onto 1st Avenue");
    expect(requests).toEqual([`https://api.openrouteservice.org/v2/directions/${providerProfile}/geojson`]);
    await page.evaluate(() => {
      const original = window.open.bind(window);
      window.open = (...args: Parameters<typeof window.open>) => {
        const popup = original(...args);
        if (popup) popup.print = () => undefined;
        return popup;
      };
    });
    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("button", { name: /Print directions/ }).click();
    const popup = await popupPromise;
    await expect(popup.locator("body")).toContainText(`Travel profile: ${profile === "driving-car" ? "foot-walk" : profile}`);
    await expect(popup.locator("body")).toContainText("Turn left onto 1st Avenue");
    await popup.close();
    if (profile === "cycling") {
      const headerBounds = await page.locator(".app-header").boundingBox();
      const routeBounds = await page.locator(".route-panel").boundingBox();
      expect(routeBounds!.y).toBeGreaterThanOrEqual(headerBounds!.y + headerBounds!.height);
      await page.screenshot({ path: testInfo.outputPath("cycling-desktop.png") });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: testInfo.outputPath("cycling-mobile.png") });
      const bounds = await page.locator(".route-panel").boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    }
  });
}

test("switching travel mode cancels old requests and clears old directions", async ({ page }) => {
  let pending: Route | null = null;
  const requests: string[] = [];
  await page.route("https://api.openrouteservice.org/v2/directions/**", route => {
    requests.push(route.request().url());
    if (route.request().url().includes("/foot-walking/")) { pending = route; return; }
    return route.fulfill({ json: routeResponse("cycling-regular") });
  });
  await prepare(page, "foot-walk");
  await page.getByRole("button", { name: "Get route", exact: true }).click();
  await expect.poll(() => Boolean(pending)).toBe(true);
  await page.getByTitle("Mobility settings").click();
  await page.getByRole("radio", { name: "Bicycle", exact: true }).check();
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.locator(".route-panel__profile-badge")).toContainText("cycling");
  await (pending as unknown as Route).fulfill({ json: routeResponse("foot-walking") }).catch(() => undefined);
  await expect(page.getByRole("button", { name: /Print directions/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Get route", exact: true }).click();
  await expect(page.getByRole("button", { name: /Print directions/ })).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[1]).toContain("/cycling-regular/");
  await page.getByTitle("Mobility settings").click();
  await page.getByRole("radio", { name: "Foot — regular walking", exact: true }).check();
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("button", { name: /Print directions/ })).toHaveCount(0);
});

test("no non-driving route shows an error without requesting a car route", async ({ page }) => {
  const requests: string[] = [];
  await page.route("https://api.openrouteservice.org/v2/directions/**", route => {
    requests.push(route.request().url());
    return route.fulfill({ status: 404, body: "No accessible route found" });
  });
  await prepare(page, "wheelchair");
  await page.getByRole("button", { name: "Get route", exact: true }).click();
  await expect(page.locator(".route-panel [role=alert]")).toContainText("Routing failed");
  await expect(page.getByRole("button", { name: /Print directions/ })).toHaveCount(0);
  expect(requests).toEqual(["https://api.openrouteservice.org/v2/directions/wheelchair/geojson"]);
});

test("walking with multiple aids respects no stairs and invalidates routes on requirement changes", async ({ page }) => {
  const requests: Record<string, unknown>[] = [];
  await page.route("https://api.openrouteservice.org/v2/directions/**", route => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ json: routeResponse("foot-walking") });
  });
  await prepare(page, "foot-walk");
  await page.getByTitle("Mobility settings").click();
  await page.getByRole("checkbox", { name: "Wheelchair", exact: true }).check();
  await page.getByRole("checkbox", { name: "Cane / crutch", exact: true }).check();
  await page.getByRole("checkbox", { name: "No stairs", exact: true }).check();
  await expect(page.getByRole("radio", { name: "Foot — regular walking", exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await page.getByRole("button", { name: "Get route", exact: true }).click();
  await expect(page.getByRole("button", { name: /Print directions/ })).toBeVisible();
  expect(requests[0].options).toEqual({ avoid_features: ["steps"] });
  await page.getByTitle("Mobility settings").click();
  await page.getByRole("checkbox", { name: "No active construction", exact: true }).check();
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("button", { name: /Print directions/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Get route", exact: true }).click();
  await expect(page.locator(".route-panel [role=alert]")).toContainText("cannot enforce");
  expect(requests).toHaveLength(1);
});