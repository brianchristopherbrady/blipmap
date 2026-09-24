import { expect, test } from "@playwright/test";
import type { Map as MapLibreMap } from "maplibre-gl";

type MapElement = HTMLElement & { _map: MapLibreMap };

for (const width of [1280, 390]) {
  for (const count of [6, 7, 93]) {
    test(`only groups of six or fewer reveal icons, including co-located ${count} reports at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.route("https://sidewalk-sea.cs.washington.edu/**", route => route.fulfill({ json: {
        type: "FeatureCollection",
        features: Array.from({ length: count }, (_, index) => ({
          type: "Feature", geometry: { type: "Point", coordinates: [-122.335, 47.608] },
          properties: { label_cluster_id: 7000 + index, label_type: "SurfaceProblem" },
        })),
      } }));
      await page.goto("/");
      await expect.poll(() => page.evaluate(expected => {
        const map = (document.querySelector("curb-map") as MapElement)?._map;
        return map?.getLayer("patches-clusters") && map.querySourceFeatures("patches")
          .some(feature => feature.properties.point_count === expected);
      }, count)).toBeTruthy();
      await page.evaluate(width => {
        const map = (document.querySelector("curb-map") as MapElement)._map;
        map.jumpTo({ center: [-122.335, 47.608], zoom: map.getMaxZoom(),
          padding: { top: 0, left: 0, right: width >= 600 ? 360 : 0, bottom: width < 600 ? 450 : 0 } });
      }, width);
      await expect.poll(() => page.evaluate(() => (document.querySelector("curb-map") as MapElement)._map.isSourceLoaded("patches"))).toBe(true);
      const target = await page.evaluate(() => {
        const map = (document.querySelector("curb-map") as MapElement)._map;
        const point = map.project([-122.335, 47.608]);
        const rect = map.getCanvas().getBoundingClientRect();
        return { x: point.x + rect.x, y: point.y + rect.y };
      });
      await page.mouse.click(target.x, target.y);
      await expect(page.getByRole("button", { name: "Back to groups", exact: true })).toBeVisible();
      await expect(page.locator("curb-map .patch-marker")).toHaveCount(count <= 6 ? count : 0);
      await expect.poll(() => page.evaluate(async () => {
        const map = (document.querySelector("curb-map") as MapElement)._map;
        const details = await (map.getSource("patch-details") as import("maplibre-gl").GeoJSONSource).getData() as GeoJSON.FeatureCollection;
        return details.features.length;
      })).toBe(count <= 6 ? count : 0);
      if (count > 6) {
        await expect.poll(() => page.evaluate(expected => {
          const map = (document.querySelector("curb-map") as MapElement)._map;
          return map.queryRenderedFeatures(undefined, { layers: ["patches-clusters"] }).some(feature => feature.properties.point_count === expected);
        }, count)).toBe(true);
      }
      await page.getByRole("button", { name: "Back to groups", exact: true }).click();
      await expect(page.locator("curb-map .patch-marker")).toHaveCount(0);
    });
  }

  test(`clusters drill down to issue icons while planning a route at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("https://sidewalk-sea.cs.washington.edu/**", route => route.fulfill({ json: {
      type: "FeatureCollection",
      features: Array.from({ length: 4 }, (_, index) => ({
        type: "Feature", geometry: { type: "Point", coordinates: [-122.335, 47.608] },
        properties: { label_cluster_id: 7500 + index, label_type: "SurfaceProblem" },
      })),
    } }));
    await page.goto("/");
    await expect.poll(() => page.evaluate(() => {
      const map = (document.querySelector("curb-map") as MapElement)?._map;
      return map?.getLayer("patches-clusters") && map.querySourceFeatures("patches")
        .some(feature => feature.properties.point_count === 4);
    })).toBeTruthy();
    await page.getByRole("button", { name: "Route", exact: true }).click();
    await expect(page.getByRole("complementary", { name: "Route planner", exact: true })).toBeVisible();
    await page.evaluate(width => {
      const map = (document.querySelector("curb-map") as MapElement)._map;
      map.jumpTo({ center: [-122.335, 47.608], zoom: map.getMaxZoom(),
        padding: { top: 0, left: 0, right: width >= 600 ? 360 : 0, bottom: width < 600 ? 450 : 0 } });
    }, width);
    await expect.poll(() => page.evaluate(() => (document.querySelector("curb-map") as MapElement)._map.isSourceLoaded("patches"))).toBe(true);
    const target = await page.evaluate(() => {
      const map = (document.querySelector("curb-map") as MapElement)._map;
      const point = map.project([-122.335, 47.608]);
      const rect = map.getCanvas().getBoundingClientRect();
      return { x: point.x + rect.x, y: point.y + rect.y };
    });
    await page.mouse.click(target.x, target.y);
    const groupPanel = page.getByRole("complementary", { name: "Selected group", exact: true });
    await expect(groupPanel).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Route planner", exact: true })).toHaveCount(0);
    await expect(page.locator("curb-map .patch-marker")).toHaveCount(4);
    const marker = page.locator("curb-map .patch-marker").first();
    // The mobile route/group panel intentionally covers the full map area, so
    // only desktop can click through to a marker underneath it here.
    if (width >= 600) {
      await marker.click({ force: true });
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.getByRole("button", { name: "Close patch details" }).click();
    }
    await groupPanel.getByRole("button", { name: "Back to groups", exact: true }).click();
    await expect(page.locator("curb-map .patch-marker")).toHaveCount(0);
    await expect(page.getByRole("complementary", { name: "Route planner", exact: true })).toBeVisible();
  });

  test(`numbered marker size follows zoom and count at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("https://sidewalk-sea.cs.washington.edu/**", route => route.fulfill({ json: {
      type: "FeatureCollection",
      features: Array.from({ length: 26 }, (_, index) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [index === 25 ? -122.329 : -122.335, 47.608] },
        properties: { label_cluster_id: 4000 + index, label_type: "SurfaceProblem" },
      })),
    } }));
    await page.goto("/");
    await expect.poll(() => page.evaluate(() => {
      const map = (document.querySelector("curb-map") as MapElement)?._map;
      return map?.getLayer("patches-clusters") && map.querySourceFeatures("patches")
        .some(feature => feature.properties.point_count === 25);
    })).toBeTruthy();
    const radii: Record<string, number> = {};
    for (const count of [25, 1]) {
      for (const zoom of [14, 18, 22]) {
        await page.evaluate(({ count, zoom, width }) => {
          const map = (document.querySelector("curb-map") as MapElement)._map;
          map.jumpTo({
            center: [count === 1 ? -122.329 : -122.335, 47.608], zoom,
            padding: { top: 0, right: 0, bottom: width < 600 ? 450 : 0, left: 0 },
          });
        }, { count, zoom, width });
        await expect.poll(() => page.evaluate(expectedCount => {
          const map = (document.querySelector("curb-map") as MapElement)._map;
          return map.isSourceLoaded("patches") && map.queryRenderedFeatures(undefined, { layers: ["patches-clusters"] })
            .some(feature => (feature.properties.point_count ?? 1) === expectedCount);
        }, count)).toBeTruthy();
        radii[`${count}-${zoom}`] = await page.evaluate(expectedCount => {
          const map = (document.querySelector("curb-map") as MapElement)._map;
          const feature = map.queryRenderedFeatures(undefined, { layers: ["patches-clusters"] })
            .find(item => (item.properties.point_count ?? 1) === expectedCount)!;
          const center = map.project((feature.geometry as GeoJSON.Point).coordinates as [number, number]);
          let radius = 0;
          for (let offset = 1; offset <= 45; offset++) {
            const hits = map.queryRenderedFeatures([center.x + offset, center.y], { layers: ["patches-clusters"] });
            if (hits.some(hit => hit.properties.cluster_id === feature.properties.cluster_id && hit.properties.id === feature.properties.id)) radius = offset;
          }
          return radius;
        }, count);
        await expect(page.locator("curb-map .patch-marker")).toHaveCount(0);
        if (zoom === 18) await page.screenshot({ path: testInfo.outputPath(`number-size-${count}-${width}.png`) });
      }
    }
    expect(radii["1-14"]).toBeGreaterThanOrEqual(22);
    for (const count of [1, 25]) {
      expect(radii[`${count}-18`]).toBeGreaterThan(radii[`${count}-14`]);
      expect(radii[`${count}-22`]).toBeGreaterThan(radii[`${count}-18`]);
      expect(radii[`${count}-22`]).toBeLessThanOrEqual(40);
    }
    for (const zoom of [14, 18, 22]) expect(radii[`25-${zoom}`]).toBeGreaterThan(radii[`1-${zoom}`]);
  });

  test(`numbered groups narrow progressively with locality at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("https://sidewalk-sea.cs.washington.edu/**", route => route.fulfill({ json: {
      type: "FeatureCollection",
      features: Array.from({ length: 36 }, (_, index) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [
          -122.335 + (index % 6) * 0.00035,
          47.608 + Math.floor(index / 6) * 0.00035,
        ] },
        properties: { label_cluster_id: 3000 + index, label_type: "SurfaceProblem" },
      })),
    } }));
    await page.goto("/");
    await expect.poll(() => page.evaluate(() => {
      const map = (document.querySelector("curb-map") as MapElement)?._map;
      return map?.getLayer("patches-clusters") && map.queryRenderedFeatures(undefined, { layers: ["patches-clusters"] })
        .some(feature => feature.properties.point_count === 36);
    })).toBeTruthy();
    const largestGroups: number[] = [];
    for (const zoom of [14, 16, 17, 19]) {
      await page.evaluate(zoomLevel => {
        const map = (document.querySelector("curb-map") as MapElement)._map;
        map.jumpTo({ center: [-122.334125, 47.608875], zoom: zoomLevel });
      }, zoom);
      await expect.poll(() => page.evaluate(() => {
        const map = (document.querySelector("curb-map") as MapElement)._map;
        return map.isSourceLoaded("patches") && !map.isMoving();
      })).toBeTruthy();
      largestGroups.push(await page.evaluate(() => {
        const map = (document.querySelector("curb-map") as MapElement)._map;
        return Math.max(...map.querySourceFeatures("patches").map(feature => Number(feature.properties.point_count ?? 1)));
      }));
      await expect(page.locator("curb-map .patch-marker")).toHaveCount(0);
      if (zoom === 16) await page.screenshot({ path: testInfo.outputPath(`locality-groups-${width}.png`) });
    }
    expect(largestGroups[0]).toBe(36);
    expect(largestGroups[1]).toBeGreaterThan(4);
    expect(largestGroups[1]).toBeLessThan(largestGroups[0]);
    expect(largestGroups[2]).toBeGreaterThan(1);
    expect(largestGroups[2]).toBeLessThan(largestGroups[1]);
    expect(largestGroups[3]).toBe(1);
  });

  test(`cluster drill-down excludes neighboring issues at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("https://sidewalk-sea.cs.washington.edu/**", route => route.fulfill({ json: {
      type: "FeatureCollection",
      features: Array.from({ length: 30 }, (_, index) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [
          -122.335 + (index < 25 ? (index % 5) * 0.0001 : 0.007 + (index - 25) * 0.0001),
          47.608 + (index < 25 ? Math.floor(index / 5) * 0.0001 : 0),
        ] },
        properties: { label_cluster_id: 2000 + index, label_type: "SurfaceProblem" },
      })),
    } }));
    await page.goto("/");
    await expect.poll(() => page.evaluate(() => {
      const map = (document.querySelector("curb-map") as MapElement)?._map;
      return map?.getLayer("patches-clusters") && map.queryRenderedFeatures(undefined, { layers: ["patches-clusters"] })
        .some(feature => feature.properties.point_count === 25);
    })).toBeTruthy();
    for (const zoom of [16, 18, 14]) {
      await page.evaluate(zoomLevel => (document.querySelector("curb-map") as MapElement)._map.jumpTo({ zoom: zoomLevel }), zoom);
      await expect.poll(() => page.evaluate(() => {
        const map = (document.querySelector("curb-map") as MapElement)._map;
        return map.isSourceLoaded("patches") && map.queryRenderedFeatures(undefined, { layers: ["patches-clusters"] }).length > 0;
      })).toBeTruthy();
      await expect(page.locator("curb-map .patch-marker")).toHaveCount(0);
    }
    if (width < 600) {
      await page.evaluate(() => (document.querySelector("curb-map") as MapElement)._map.setPadding({ top: 0, right: 0, bottom: 450, left: 0 }));
    }
    const target = await page.evaluate(() => {
      const map = (document.querySelector("curb-map") as MapElement)._map;
      const feature = map.queryRenderedFeatures(undefined, { layers: ["patches-clusters"] }).find(item => item.properties.point_count === 25)!;
      const point = map.project((feature.geometry as GeoJSON.Point).coordinates as [number, number]);
      const rect = map.getCanvas().getBoundingClientRect();
      return { x: rect.x + point.x, y: rect.y + point.y, center: map.getCenter().toArray(), zoom: map.getZoom() };
    });
    await page.mouse.click(target.x, target.y);
    const reset = page.getByRole("button", { name: "Back to groups", exact: true });
    await expect(reset).toBeVisible();
    await expect(page.locator("curb-map .patch-marker")).toHaveCount(0);
    const sourceIds = () => page.evaluate(async () => {
      const map = (document.querySelector("curb-map") as MapElement)._map;
      const source = map.getSource("patches") as import("maplibre-gl").GeoJSONSource;
      const data = await source.getData() as GeoJSON.FeatureCollection;
      return data.features.map(feature => feature.properties?.id).sort();
    });
    expect(await sourceIds()).toEqual(Array.from({ length: 25 }, (_, index) => `project-sidewalk-seattle:${2000 + index}`).sort());
    let parentCount = 25;
    while (parentCount > 6) {
      await expect.poll(() => page.evaluate(() => {
        const map = (document.querySelector("curb-map") as MapElement)._map;
        return map.isSourceLoaded("patches") && !map.isMoving();
      })).toBe(true);
      await expect(page.locator("curb-map .patch-marker")).toHaveCount(0);
      const children = await page.evaluate(() => {
        const map = (document.querySelector("curb-map") as MapElement)._map;
        const unique = new Map(map.querySourceFeatures("patches").map(feature => [feature.properties.cluster_id ?? feature.properties.id, feature]));
        return [...unique.values()].map(feature => Number(feature.properties.point_count ?? 1));
      });
      expect(children.reduce((total, count) => total + count, 0)).toBe(parentCount);
      expect(Math.max(...children)).toBeLessThan(parentCount);
      const child = await page.evaluate(() => {
        const map = (document.querySelector("curb-map") as MapElement)._map;
        const feature = map.queryRenderedFeatures(undefined, { layers: ["patches-clusters"] })
          .sort((first, second) => (second.properties.point_count ?? 1) - (first.properties.point_count ?? 1))[0];
        const point = map.project((feature.geometry as GeoJSON.Point).coordinates as [number, number]);
        const rect = map.getCanvas().getBoundingClientRect();
        return { count: Number(feature.properties.point_count ?? 1), x: rect.x + point.x, y: rect.y + point.y };
      });
      parentCount = child.count;
      await page.mouse.click(child.x, child.y);
      await expect.poll(async () => (await sourceIds()).length).toBe(parentCount);
    }
    await expect(page.locator("curb-map .patch-marker")).toHaveCount(parentCount);
    await page.screenshot({ path: testInfo.outputPath(`cluster-focus-${width}.png`) });
    await reset.click();
    await expect(reset).toHaveCount(0);
    await expect.poll(async () => (await sourceIds()).length).toBe(30);
    await expect.poll(() => page.evaluate(expected => {
      const map = (document.querySelector("curb-map") as MapElement)._map;
      return !map.isMoving() && Math.abs(map.getZoom() - expected.zoom) < 0.000001 &&
        map.getCenter().toArray().every((coordinate, index) => Math.abs(coordinate - expected.center[index]) < 0.000001);
    }, target)).toBe(true);
    await expect(page.locator("curb-map .patch-marker")).toHaveCount(0);
    await page.mouse.click(target.x, target.y);
    await expect(reset).toBeVisible();
    await reset.focus();
    await reset.press("Enter");
    await expect(reset).toHaveCount(0);
    await expect.poll(async () => (await sourceIds()).length).toBe(30);
    await expect.poll(() => page.evaluate(() => (document.querySelector("curb-map") as MapElement)._map.isMoving())).toBe(false);
    await page.mouse.click(target.x, target.y);
    await expect(reset).toBeVisible();
    await page.evaluate(() => (document.querySelector("curb-map") as MapElement)._map.jumpTo({ zoom: 13 }));
    await expect(reset).toHaveCount(0);
    await expect.poll(async () => (await sourceIds()).length).toBe(30);
  });

  test(`issue badges remain discoverable and interactive at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await page.route("https://sidewalk-sea.cs.washington.edu/**", route => route.fulfill({ json: {
      type: "FeatureCollection",
      features: ["NoCurbRamp", "SurfaceProblem", "Obstacle"].map((labelType, index) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [-122.335 + (index - 1) * 0.001, 47.608] },
        properties: { label_cluster_id: 901 + index, label_type: labelType },
      })),
    } }));
    await page.goto("/");
    await expect.poll(() => page.evaluate(() => {
      const map = (document.querySelector("curb-map") as MapElement)?._map;
      return map?.getLayer("patches-clusters")
        ? map.queryRenderedFeatures(undefined, { layers: ["patches-clusters"] }).length : 0;
    })).toBeGreaterThan(0);
    if (width < 600) {
      await page.evaluate(() => (document.querySelector("curb-map") as MapElement)._map.setPadding({ top: 0, right: 0, bottom: 450, left: 0 }));
    }
    const cluster = await page.evaluate(() => {
      const map = (document.querySelector("curb-map") as MapElement)._map;
      const feature = map.queryRenderedFeatures(undefined, { layers: ["patches-clusters"] })[0];
      const point = map.project((feature.geometry as GeoJSON.Point).coordinates as [number, number]);
      const rect = map.getCanvas().getBoundingClientRect();
      return { x: rect.x + point.x, y: rect.y + point.y };
    });
    await page.mouse.click(cluster.x, cluster.y);
    const markers = page.locator("curb-map .patch-marker");
    await expect(markers).toHaveCount(3);
    const marker = page.getByRole("button", { name: /^Open issue:.*Sidewalk surface/ });
    await expect(marker).toBeVisible();
    await expect(marker.locator("svg")).toHaveCount(1);
    const appearance = await marker.evaluate(button => {
      const rect = button.getBoundingClientRect();
      const badge = getComputedStyle(button.querySelector(".patch-marker__badge")!);
      return { width: rect.width, height: rect.height, fill: badge.backgroundColor, ink: badge.color, shadow: badge.boxShadow };
    });
    expect(appearance.width).toBeGreaterThanOrEqual(44);
    expect(appearance.height).toBeGreaterThanOrEqual(44);
    expect(appearance.fill).not.toBe(appearance.ink);
    expect(appearance.fill).not.toBe("rgba(0, 0, 0, 0)");
    expect(appearance.shadow).not.toBe("none");
    await marker.hover();
    await page.screenshot({ path: testInfo.outputPath(`markers-light-${width}.png`) });
    await marker.click();
    await expect(page.getByRole("dialog")).toContainText("Sidewalk surface problem");
    await page.keyboard.press("Escape");
    await marker.focus();
    await marker.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await marker.focus();
    await marker.press("Space");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect.poll(() => marker.locator(".patch-marker__badge").evaluate(badge => getComputedStyle(badge).backgroundColor)).not.toBe(appearance.fill);
    await marker.focus();
    await page.screenshot({ path: testInfo.outputPath(`markers-dark-${width}.png`) });
    await page.getByRole("button", { name: "Measure", exact: true }).click();
    await expect(marker).toBeDisabled();
    await marker.evaluate(button => {
      const rect = button.getBoundingClientRect();
      const root = button.getRootNode() as ShadowRoot;
      if (root.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)?.closest(".patch-marker")) {
        throw new Error("Disabled issue marker intercepts drawing clicks");
      }
    });
    await page.keyboard.press("Escape");
    await expect(marker).toBeEnabled();
    await page.getByRole("button", { name: "Back to groups", exact: true }).click();
    await page.getByRole("combobox", { name: "Filter by category" }).selectOption("surface");
    await expect(markers).toHaveCount(0);
    const single = await page.evaluate(() => {
      const map = (document.querySelector("curb-map") as MapElement)._map;
      const feature = map.queryRenderedFeatures(undefined, { layers: ["patches-clusters"] })[0];
      const point = map.project((feature.geometry as GeoJSON.Point).coordinates as [number, number]);
      const rect = map.getCanvas().getBoundingClientRect();
      return { x: rect.x + point.x, y: rect.y + point.y };
    });
    await page.mouse.click(single.x, single.y);
    await expect(markers).toHaveCount(1);
    await page.getByRole("button", { name: "Back to groups", exact: true }).click();
    await page.getByRole("combobox", { name: "Filter by category" }).selectOption("");
    await expect(markers).toHaveCount(0);
    await page.evaluate(() => (document.querySelector("curb-map") as MapElement)._map.jumpTo({ zoom: 13 }));
    await expect(markers).toHaveCount(0);
  });
}