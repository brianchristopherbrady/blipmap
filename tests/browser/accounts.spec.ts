import { expect, test, type Page, type Route } from "@playwright/test";

const userId = "10000000-0000-0000-0000-000000000001";
const user = { id: userId, aud: "authenticated", role: "authenticated", email: "person@example.test", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
const favorite = { id: "favorite-1", label: "Private library", lng: -122.33, lat: 47.61 };

async function prepare(page: Page, enabled = true) {
  await page.route("**/src/config/supabase.ts*", async route => {
    const response = await route.fetch();
    const body = (await response.text())
      .replace(/const url = [^;]+;/, `const url = ${JSON.stringify(enabled ? "https://accounts.test" : "")};`)
      .replace(/const key = [^;]+;/, `const key = ${JSON.stringify(enabled ? "sb_publishable_browser_test" : "")};`);
    await route.fulfill({ response, body });
  });
  await page.addInitScript(() => {
    if (!localStorage.getItem("blipmap:profile")) localStorage.setItem("blipmap:profile", JSON.stringify({ displayName: "Guest original", routingProfile: "foot-walk", avoidStairs: true }));
  });
  await page.route("https://sidewalk-sea.cs.washington.edu/**", route => route.fulfill({ json: { type: "FeatureCollection", features: [] } }));
  await page.route("https://accounts.test/auth/v1/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/token")) {
      const expires = Math.floor(Date.now() / 1000) + 3600;
      const token = `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: userId, exp: expires, aud: "authenticated", role: "authenticated" })).toString("base64url")}.test`;
      return route.fulfill({ json: { access_token: token, refresh_token: "test-refresh", token_type: "bearer", expires_in: 3600, expires_at: expires, user } });
    }
    if (url.pathname.endsWith("/signup")) return route.fulfill({ json: user });
    if (url.pathname.endsWith("/user")) return route.fulfill({ json: user });
    return route.fulfill({ json: {} });
  });
  await page.route("https://accounts.test/rest/v1/accessibility_profiles**", route => route.fulfill({ json: route.request().method() === "GET" ? { preferences: { displayName: "Private name", routingProfile: "foot-walk", avoidStairs: true } } : {} }));
  await page.route("https://accounts.test/rest/v1/favorite_locations**", route => route.fulfill({ json: route.request().method() === "GET" ? [favorite] : {} }));
  await page.goto("/");
  await page.getByRole("button", { name: "Account", exact: true }).click();
}

async function signIn(page: Page) {
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("browser-test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Access preferences", exact: true })).toBeEnabled();
}

test("unconfigured accounts preserve guest preferences and fit mobile", async ({ page }, testInfo) => {
  await prepare(page, false);
  await expect(page.getByRole("dialog")).toContainText("Accounts are not configured");
  await page.getByRole("button", { name: "Close account", exact: true }).click();
  const navigation = page.getByRole("navigation", { name: "Account and settings" });
  await expect(navigation.getByRole("button", { name: "Account", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Map tools" }).getByRole("button", { name: "Account", exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 700 });
  for (const name of ["Account", "Settings"]) {
    const bounds = await navigation.getByRole("button", { name, exact: true }).boundingBox();
    expect(bounds!.y).toBeLessThan(56);
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({ path: testInfo.outputPath("top-navigation-mobile.png") });
  await page.setViewportSize({ width: 1280, height: 900 });
  await navigation.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByLabel("Display name (optional)")).toHaveValue("Guest original");
  await page.getByRole("checkbox", { name: "Wheelchair", exact: true }).check();
  await page.getByRole("checkbox", { name: "Cane / crutch", exact: true }).check();
  await expect(page.getByRole("radio", { name: "Foot — regular walking", exact: true })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "No stairs", exact: true })).toBeChecked();
  await page.screenshot({ path: testInfo.outputPath("preferences-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath("preferences-mobile.png") });
  const bounds = await page.getByRole("dialog").boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.height).toBeLessThanOrEqual(844);
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("blipmap:profile")!).mobilityAids)).toEqual(["wheelchair", "cane"]);
});

test("registration, private preferences, favorites and sign-out keep guest data separate", async ({ page }, testInfo) => {
  await prepare(page);
  await page.getByRole("button", { name: "Register", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("browser-test-password");
  const signup = page.waitForRequest(request => request.url().includes("/auth/v1/signup"));
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  expect((await signup).postDataJSON().email).toBe(user.email);
  await expect(page.getByRole("dialog").getByRole("status")).toContainText("Check your email");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await signIn(page);
  await expect(page.getByRole("dialog")).toContainText("Private library");
  await page.screenshot({ path: testInfo.outputPath("account-desktop.png") });
  await page.getByRole("button", { name: "Access preferences", exact: true }).click();
  await expect(page.getByLabel("Display name (optional)")).toHaveValue("Private name");
  await page.getByLabel("Display name (optional)").fill("Cloud change");
  const save = page.waitForRequest(request => request.url().includes("/rest/v1/accessibility_profiles") && request.method() === "POST");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  expect((await save).postDataJSON()).toMatchObject({ user_id: userId, preferences: { displayName: "Cloud change", avoidStairs: true } });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("blipmap:profile")!).displayName)).toBe("Guest original");
  await page.getByRole("button", { name: "Route", exact: true }).click();
  await page.getByLabel("Saved destination").selectOption(favorite.id);
  await expect(page.getByLabel("To", { exact: true })).toHaveValue("Private library");
  await page.route("https://accounts.test/rest/v1/favorite_locations**", route => route.fulfill({ json: route.request().method() === "POST" ? { ...favorite, id: "favorite-2", label: "Second destination" } : {} }));
  const added = page.waitForRequest(request => request.url().includes("favorite_locations") && request.method() === "POST");
  await page.getByRole("button", { name: "Save destination", exact: true }).click();
  expect((await added).postDataJSON()).toMatchObject({ user_id: userId, label: favorite.label, lng: favorite.lng });
  await expect(page.locator(".route-panel").getByRole("status")).toContainText("Destination saved");
  await page.getByRole("button", { name: "Account", exact: true }).click();
  const removed = page.waitForRequest(request => request.url().includes("favorite_locations") && request.method() === "DELETE");
  await page.getByRole("button", { name: "Remove Private library", exact: true }).click();
  expect((await removed).url()).toContain(`user_id=eq.${userId}`);
  await expect(page.getByRole("button", { name: "Remove Private library", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toContainText("Second destination");
  await page.getByRole("button", { name: "Close account", exact: true }).click();
  await expect(page.getByLabel("Saved destination")).toHaveCount(0);
  await page.getByTitle("Mobility settings").click();
  await expect(page.getByLabel("Display name (optional)")).toHaveValue("Guest original");
});

test("failed cloud saves keep drafts and recovery uses the configured redirect", async ({ page }) => {
  await prepare(page);
  await page.getByRole("button", { name: "Forgot password", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  const recovery = page.waitForRequest(request => request.url().includes("/auth/v1/recover"));
  await page.getByRole("button", { name: "Send reset link", exact: true }).click();
  expect(decodeURIComponent((await recovery).url())).toContain("account=recovery");
  await expect(page.getByRole("dialog").getByRole("status")).toContainText("password reset link");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await signIn(page);
  await page.getByRole("button", { name: "Change password", exact: true }).click();
  await page.getByLabel("Password", { exact: true }).fill("new-browser-test-password");
  const update = page.waitForRequest(request => request.url().includes("/auth/v1/user") && request.method() === "PUT");
  await page.getByRole("button", { name: "Update password", exact: true }).click();
  expect((await update).postDataJSON().password).toBe("new-browser-test-password");
  await expect(page.getByRole("dialog").getByRole("status")).toContainText("Password updated");
  await page.getByRole("button", { name: "Access preferences", exact: true }).click();
  await page.getByLabel("Display name (optional)").fill("Unsaved draft");
  await page.route("https://accounts.test/rest/v1/accessibility_profiles**", route => route.fulfill({ status: 503, json: { message: "Unavailable" } }));
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("could not be saved");
  await expect(page.getByLabel("Display name (optional)")).toHaveValue("Unsaved draft");
});

test("a late private response cannot repopulate data after sign-out", async ({ page }) => {
  await prepare(page);
  let pending: Route | undefined;
  await page.route("https://accounts.test/rest/v1/accessibility_profiles**", route => { pending = route; });
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("browser-test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect.poll(() => !!pending).toBe(true);
  await expect(page.getByRole("button", { name: "Access preferences", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await pending!.fulfill({ json: { preferences: { displayName: "Late private name" } } });
  await page.getByRole("button", { name: "Close account", exact: true }).click();
  await page.getByRole("button", { name: "Route", exact: true }).click();
  await page.getByTitle("Mobility settings").click();
  await expect(page.getByLabel("Display name (optional)")).toHaveValue("Guest original");
});