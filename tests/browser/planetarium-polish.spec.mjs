import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { testDeps } from "../runtime-location.mjs";

const report = path.join(testDeps, "runtime/reports/site-polish");

test("planetarium keeps keyboard focus, native button actions and local experience pause", async ({ page }) => {
  const errors = [], failedAssets = [], api = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.url().includes("/planetarium/") && response.status() >= 400)
      failedAssets.push({ url: response.url(), status: response.status() });
  });
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) api.push(request.url());
  });
  await page.goto("/planetarium/");
  const canvas = page.locator("#planetarium-canvas");
  const root = page.locator("#planetarium");
  await expect(canvas).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  if (await root.getAttribute("data-language") !== "en")
    await page.locator("button[data-language]").click();
  await page.locator("[data-play]").click();
  await expect(root).toHaveAttribute("data-playing", "false");

  const objects = page.locator('[data-panel-toggle="objects"]');
  await objects.focus();
  await page.keyboard.press("Space");
  await expect(objects).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#object-search")).toBeFocused();
  await expect(root).toHaveAttribute("data-playing", "false");
  await page.keyboard.press("Escape");
  await expect(page.locator("#planetarium-panel")).toBeHidden();
  await expect(objects).toHaveAttribute("aria-expanded", "false");
  await expect(objects).toBeFocused();

  const dateButton = page.locator('[data-panel-toggle="time"]');
  await dateButton.focus();
  await page.keyboard.press("Space");
  await expect(page.locator("#sky-datetime")).toBeFocused();
  await page.locator("#sky-datetime").fill("2026-01-02T03:04");
  await page.keyboard.press("Escape");
  await expect(page.locator(".time-popover")).toBeHidden();
  await expect(dateButton).toHaveAttribute("aria-expanded", "false");
  await expect(dateButton).toBeFocused();

  await page.locator('[data-panel-toggle="experiences"]').click();
  await page.locator('[data-experience-id="moon"]').click();
  await expect(root).toHaveAttribute("data-view", "studio", { timeout: 20000 });
  await expect(page.locator(".experience-dock")).toHaveAttribute("aria-busy", "false");
  const quarter = page.locator('[data-moon-phase="2"]');
  await quarter.focus();
  await page.keyboard.press("Space");
  await expect(quarter).toBeFocused();
  await expect(quarter).toHaveAttribute("aria-pressed", "true");
  const localPlay = page.locator('[data-experience-action="play"]');
  await expect(localPlay).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator('[data-experience-controls] input[type="range"]')).toHaveAttribute("aria-valuetext", "50% lit");

  await page.locator('[data-panel-toggle="help"]').focus();
  await page.keyboard.press("Space");
  await expect(page.locator("#planetarium-panel")).toBeVisible();
  await expect(localPlay).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Escape");
  await expect(page.locator("#planetarium-panel")).toBeHidden();
  await expect(root).toHaveAttribute("data-experience", "moon");

  await canvas.focus();
  await page.keyboard.down("Space");
  await page.keyboard.down("Space");
  await page.keyboard.up("Space");
  await expect(localPlay).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Space");
  await expect(localPlay).toHaveAttribute("aria-pressed", "false");
  await quarter.click();
  await page.locator("button[data-language]").click();
  await expect(page.locator('[data-experience-controls] input[type="range"]')).toHaveAttribute("aria-valuetext", "50% 亮面");
  await expect(canvas).toHaveAttribute("aria-label", /左键拖动/);
  await page.locator("button[data-language]").click();

  fs.mkdirSync(report, { recursive: true });
  await page.screenshot({ path: path.join(report, "planetarium-keyboard-moon.png") });
  await page.locator("[data-close-experience]").focus();
  await page.keyboard.press("Space");
  await expect(root).toHaveAttribute("data-view", "sky");
  await expect(canvas).toBeFocused();
  await expect(root).toHaveAttribute("data-playing", "false");
  await page.locator('[data-view="solar"]').focus();
  await page.keyboard.press("Space");
  await expect(root).toHaveAttribute("data-view", "solar");
  await expect(root).toHaveAttribute("data-playing", "false");
  expect(errors).toEqual([]);
  expect(failedAssets).toEqual([]);
  expect(api).toEqual([]);
  fs.writeFileSync(path.join(report, "planetarium-keyboard-runtime.json"), JSON.stringify({ errors, failedAssets, api }, null, 2));
});
