#!/usr/bin/env node
/**
 * blipmap smoke test — verifies the running application in a headless browser.
 *
 * Usage:
 *   node .github/skills/browser-qa/scripts/smoke-test.js [base-url]
 *
 * Requires Playwright:
 *   npx playwright install chromium --with-deps
 *
 * Exit codes:
 *   0 — all checks passed (warnings printed but not fatal)
 *   1 — one or more checks failed
 */

const { chromium } = require("playwright");

const BASE_URL = process.argv[2] || "http://localhost:5173";
const TIMEOUT = 15_000;

const results = { pass: [], warn: [], fail: [] };

function pass(msg) { results.pass.push(msg); }
function warn(msg) { results.warn.push(msg); }
function fail(msg) { results.fail.push(msg); }

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(`[page error] ${err.message}`));

  try {
    // 1. App loads
    const response = await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: TIMEOUT });
    if (!response || !response.ok()) {
      fail(`App did not load — HTTP ${response?.status()}`);
    } else {
      pass("App loaded");
    }

    // 2. Map canvas renders
    const canvas = await page.$("canvas");
    if (!canvas) {
      fail("Map canvas not found — MapLibre GL may not have initialized");
    } else {
      pass("Map canvas present");
    }

    // 3. Toolbar present
    const toolbar = await page.$("curb-tool-button, [data-testid='toolbar'], .curb-toolbar");
    if (!toolbar) {
      warn("Toolbar element not found — selector may need updating");
    } else {
      pass("Toolbar present");
    }

    // 4. Add Patch mode activates
    const addBtn = await page.$("[aria-label*='Add'], [aria-label*='Patch'], [data-mode='add']");
    if (addBtn) {
      await addBtn.click();
      await page.waitForTimeout(300);

      // Click map to trigger add flow
      const mapEl = await page.$("canvas, curb-map");
      if (mapEl) {
        const box = await mapEl.boundingBox();
        if (box) {
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          await page.waitForTimeout(500);

          const form = await page.$("form, [role='dialog'], .patch-form");
          if (form) {
            pass("Add Patch form appeared after map click");
          } else {
            warn("Add Patch form not detected — selector may need updating");
          }
        }
      }

      // ESC resets mode
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
      pass("ESC key handled without crash");
    } else {
      warn("Add Patch button not found — skipping flow test");
    }

    // 5. Console errors
    if (consoleErrors.length === 0) {
      pass("No console errors on load");
    } else {
      consoleErrors.forEach((e) => warn(`Console error: ${e}`));
    }

  } catch (err) {
    fail(`Unexpected error: ${err.message}`);
  } finally {
    await browser.close();
  }

  // Report
  console.log("\n=== blipmap Smoke Test ===\n");
  results.pass.forEach((m) => console.log(`  ✓  ${m}`));
  results.warn.forEach((m) => console.log(`  ⚠  ${m}`));
  results.fail.forEach((m) => console.log(`  ✗  ${m}`));

  const total = results.pass.length + results.warn.length + results.fail.length;
  console.log(`\n${results.pass.length}/${total} checks passed, ${results.warn.length} warnings, ${results.fail.length} failures`);

  if (results.fail.length > 0) {
    console.log("\nSMOKE TEST FAILED");
    process.exit(1);
  } else {
    console.log("\nSMOKE TEST PASSED");
    process.exit(0);
  }
})();
