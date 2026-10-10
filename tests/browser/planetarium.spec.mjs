import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { testDeps } from "../runtime-location.mjs";
const report = path.join(testDeps, "runtime/reports", process.env.OCV_PLANETARIUM_REPORT || "planetarium");
const shot = (page, name) =>
  page.screenshot({ path: path.join(report, "experiences-" + name + ".png") });
const wait = (page) => page.waitForTimeout(700);

test("full sky, selection, experiences, music and entrances", async ({
  page,
  request,
}) => {
  const errors = [],
    failedAssets = [],
    network = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (e) => {
    if (e.type() === "error") errors.push(e.text());
  });
  page.on("response", (r) => {
    if (r.url().includes("/planetarium/") && r.status() >= 400)
      failedAssets.push(r.url());
  });
  page.on("request", (r) => network.push(r.url()));
  await page.goto("/planetarium/");
  const canvas = page.locator("#planetarium-canvas"),
    root = page.locator("#planetarium");
  await expect(canvas).toHaveAttribute("data-ready", "true", {
    timeout: 30000,
  });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.locator(".view-switch button")).toHaveCount(2);
  await expect(page.locator("[data-tour]")).toHaveCount(0);
  await expect(page.locator("[data-device-option]")).toBeHidden();
  await expect(root).toHaveAttribute("data-music", "playing");
  await expect(canvas).toHaveAttribute("data-sky-resolution", "4096");
  const initialAz = Number(await canvas.getAttribute("data-view-azimuth"));
  await canvas.focus();
  await page.keyboard.down("q");
  await page.waitForTimeout(650);
  await page.keyboard.up("q");
  await wait(page);
  expect(
    Math.abs(Number(await canvas.getAttribute("data-view-roll"))),
  ).toBeGreaterThan(10);
  await page.keyboard.down("w");
  await page.waitForTimeout(1600);
  await page.keyboard.up("w");
  await wait(page);
  await shot(page, "free-sphere");
  await page.keyboard.press("r");
  await wait(page);
  expect(
    Math.abs(
      Number(await canvas.getAttribute("data-view-azimuth")) - initialAz,
    ),
  ).toBeLessThan(2);
  const compass = page.locator(".gyroscope-viewport");
  const handle = (await canvas.getAttribute("data-control-azimuth"))
    .split(",")
    .map(Number);
  const azimuthBefore = Number(await canvas.getAttribute("data-view-azimuth"));
  const compassElevation = Number(
    await canvas.getAttribute("data-view-elevation"),
  );
  await page.mouse.move(...handle);
  await page.mouse.down();
  await expect(compass).toHaveAttribute("data-axis", "azimuth");
  await page.mouse.move(handle[0] + 25, handle[1] - 8, { steps: 5 });
  await page.mouse.up();
  await wait(page);
  const draggedAzimuth = Number(await canvas.getAttribute("data-view-azimuth"));
  expect(Math.abs(draggedAzimuth - azimuthBefore)).toBeGreaterThan(4);
  expect(Number(await canvas.getAttribute("data-view-elevation"))).toBeCloseTo(
    compassElevation,
    0,
  );
  await page.locator('[data-direction-axis="elevation"]').click();
  await compass.press("ArrowDown");
  await wait(page);
  expect(Number(await canvas.getAttribute("data-view-elevation"))).toBeCloseTo(
    compassElevation - 5,
    0,
  );
  await page.locator('[data-direction-axis="roll"]').click();
  await compass.press("ArrowRight");
  await wait(page);
  expect(Number(await canvas.getAttribute("data-view-roll"))).toBeCloseTo(5, 0);
  expect(Number(await canvas.getAttribute("data-view-azimuth"))).toBeCloseTo(
    draggedAzimuth,
    0,
  );
  const arrow = (await canvas.getAttribute("data-direction-arrow"))
    .split(",")
    .map(Number);
  expect(arrow[1]).toBeCloseTo(
    Math.sin(((compassElevation - 5) * Math.PI) / 180),
    2,
  );
  expect(Math.abs(arrow[2])).toBeGreaterThan(0.03);
  await shot(page, "direction-rings");
  await page.locator("[data-reset-view]").click();
  await wait(page);
  expect(await root.textContent()).not.toContain("cabal312512");
  await page.locator("[data-panel-toggle=help]").click();
  await expect(page.locator(".controls-guide")).toContainText("Q E");
  await page.locator("[data-close-panel]").click();
  await page.mouse.move(800, 480);
  await page.mouse.wheel(0, -1400);
  await expect(canvas).toHaveAttribute("data-sky-resolution", "8192", {
    timeout: 20000,
  });
  await wait(page);
  await shot(page, "zoom-detail");
  await page.locator("[data-reset-view]").click();
  await expect(canvas).toHaveAttribute("data-sky-resolution", "4096", {
    timeout: 7000,
  });
  let hit = null;
  for (const point of [
    [780, 410],
    [742, 407],
    [650, 650],
    [898, 594],
    [405, 490],
    [300, 265],
  ]) {
    await page.mouse.move(...point);
    await page.waitForTimeout(90);
    if (await canvas.getAttribute("data-hover-constellation")) {
      hit = point;
      break;
    }
  }
  expect(hit).not.toBeNull();
  const hovered = await canvas.getAttribute("data-hover-constellation");
  expect(hovered).toBeTruthy();
  await page.locator('[data-panel-toggle="objects"]').click();
  await page.locator("#object-search").fill("Orion");
  await page.locator('[data-object-id="Ori"]').click();
  await expect(canvas).toHaveAttribute("data-selected", "Ori");
  await expect(page.locator(".object-description")).toHaveText(
    /Orion|Betelgeuse|Rigel/,
  );
  await wait(page);
  await shot(page, "constellation-selected");
  await page.locator('[data-panel-toggle="objects"]').click();
  await page.locator("#object-search").fill("Sirius");
  await page.locator('[data-object-id="32349"]').click();
  await page.waitForTimeout(1900);
  await expect(page.locator(".object-name")).toHaveText("Sirius");
  await expect(page.locator(".object-description")).not.toBeEmpty();
  await expect(page.locator(".star-target")).toBeVisible();
  await page.locator("[data-close-object]").click();
  await expect(page.locator(".object-card")).toBeHidden();
  await page.mouse.click(800, 500);
  await expect(page.locator(".object-card")).toBeVisible();
  await expect(page.locator(".object-name")).toHaveText("Sirius");
  await page.locator("button[data-language]").click();
  await expect(page.locator(".object-name")).toHaveText("天狼星");
  await expect(page.locator(".object-description")).toContainText("天狼");
  await shot(page, "famous-star");
  await page.locator("button[data-language]").click();
  await page.getByRole("button", { name: "Solar system", exact: true }).click();
  await page.waitForTimeout(2600);
  await expect(canvas).not.toHaveAttribute("data-focused-body", /.+/);
  const cameraPose = async () =>
    canvas.evaluate((element) => ({
      position: element.dataset.cameraPosition.split(",").map(Number),
      rotation: element.dataset.cameraRotation.split(",").map(Number),
      forward: element.dataset.cameraForward.split(",").map(Number),
      fov: Number(element.dataset.cameraFov),
    }));
  const distance = (a, b) =>
    Math.hypot(...a.map((value, index) => value - b[index]));
  const startPose = await cameraPose();
  await page.mouse.move(780, 480);
  await page.mouse.down();
  await page.mouse.move(870, 515, { steps: 6 });
  await page.mouse.up();
  await wait(page);
  const turnedPose = await cameraPose();
  expect(distance(turnedPose.position, startPose.position)).toBeLessThan(0.001);
  expect(distance(turnedPose.rotation, startPose.rotation)).toBeGreaterThan(
    0.01,
  );
  const cameraRight = (q) => [
    1 - 2 * (q[1] * q[1] + q[2] * q[2]),
    2 * (q[0] * q[1] + q[2] * q[3]),
    2 * (q[0] * q[2] - q[1] * q[3]),
  ];
  expect(
    turnedPose.forward.reduce(
      (sum, v, i) => sum + v * cameraRight(startPose.rotation)[i],
      0,
    ),
  ).toBeLessThan(-0.04);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(825, 540, { steps: 6 });
  await page.mouse.up({ button: "right" });
  await wait(page);
  const movedPose = await cameraPose();
  expect(distance(movedPose.position, turnedPose.position)).toBeGreaterThan(
    0.05,
  );
  expect(distance(movedPose.rotation, turnedPose.rotation)).toBeLessThan(0.001);
  await page.mouse.wheel(0, -180);
  await wait(page);
  const dollyPose = await cameraPose();
  const displacement = dollyPose.position.map(
    (value, index) => value - movedPose.position[index],
  );
  expect(distance(dollyPose.position, movedPose.position)).toBeGreaterThan(
    0.05,
  );
  expect(
    displacement.reduce(
      (sum, value, index) => sum + value * movedPose.forward[index],
      0,
    ) / Math.hypot(...displacement),
  ).toBeGreaterThan(0.99);
  expect(dollyPose.fov).toBe(movedPose.fov);
  await shot(page, "free-solar-camera");
  await page.locator("[data-panel-toggle=objects]").click();
  await page.locator("#object-search").fill("");
  await page.locator("[data-object-id=saturn]").click();
  await expect(canvas).toHaveAttribute("data-selected", "saturn");
  await expect(canvas).not.toHaveAttribute("data-focused-body", /.+/);
  await shot(page, "selection-frame");
  await page.locator("[data-focus-object]").click();
  await page.waitForTimeout(2600);
  await page.mouse.dblclick(800, 500);
  await expect(canvas).toHaveAttribute("data-focused-body", "saturn");
  await shot(page, "saturn");
  await page.mouse.wheel(0, 90);
  await wait(page);
  await expect(canvas).not.toHaveAttribute("data-focused-body", /.+/);
  const experience = async (id) => {
    await page.locator("[data-panel-toggle=experiences]").click();
    await page.locator('[data-experience-id="' + id + '"]').click();
    await expect(root).toHaveAttribute("data-experience", id);
  };
  for (const id of ["orbits", "meteors", "trails", "moon", "shadow"]) {
    const previousPose = await cameraPose();
    const previousTime = await canvas.getAttribute("data-simulation-time");
    await experience(id);
    await page.waitForTimeout(id === "orbits" ? 2600 : 1900);
    await shot(page, id);
    expect(errors).toEqual([]);
    if (id === "orbits") {
      await page.locator('[data-experience-action="inner"]').click();
      await page.waitForTimeout(1700);
      const innerPose = await cameraPose();
      expect(Math.hypot(...innerPose.position)).toBeLessThan(55);
      await shot(page, "inner-orbits");
    }
    if (id === "meteors") {
      const selects = page.locator(".experience-options select");
      await selects.nth(0).selectOption("geminids");
      await selects.nth(1).selectOption("3");
      await expect(canvas).toHaveAttribute("data-meteor-preset", "geminids");
      await expect(canvas).toHaveAttribute("data-meteor-rate", "3");
      await page.waitForTimeout(1800);
      await page.locator('[data-experience-action="burst"]').click();
      await expect
        .poll(() => canvas.getAttribute("data-meteor-active").then(Number))
        .toBeGreaterThan(2);
      await wait(page);
      await shot(page, "meteor-burst");
    }
    if (id === "trails") {
      await page.locator('[data-experience-action="play"]').click();
      await wait(page);
      const stoppedExposure = Number(
        await canvas.getAttribute("data-trail-progress"),
      );
      await wait(page);
      expect(Number(await canvas.getAttribute("data-trail-progress"))).toBe(
        stoppedExposure,
      );
      await page
        .locator('.experience-options input[type="range"]')
        .evaluate((input) => {
          input.value = "4";
          input.dispatchEvent(new Event("input", { bubbles: true }));
        });
      await expect(canvas).toHaveAttribute("data-trail-exposure", "4");
      await page.locator('[data-experience-action="restart"]').click();
      await page.waitForTimeout(7000);
      expect(
        Number(await canvas.getAttribute("data-trail-progress")),
      ).toBeGreaterThan(0.8);
      await shot(page, "long-exposure");
    }
    if (id === "moon") {
      await page.locator('[data-moon-phase="1"]').click();
      await page.waitForTimeout(1900);
      await shot(page, "crescent");
      await page.locator('[data-moon-phase="2"]').click();
      await wait(page);
      expect(
        Number(await canvas.getAttribute("data-lunar-illumination")),
      ).toBeCloseTo(0.5, 1);
      await shot(page, "quarter");
      await page
        .locator('[data-experience-setting="perspective"][data-value="orbit"]')
        .click();
      await page.waitForTimeout(1500);
      await expect(canvas).toHaveAttribute("data-lunar-perspective", "orbit");
      await shot(page, "moon-orbit");
    }
    if (id === "shadow") {
      await page
        .locator('[data-experience-setting="eclipseKind"][data-value="lunar"]')
        .click();
      await wait(page);
      await expect(canvas).toHaveAttribute("data-eclipse-kind", "lunar");
      await shot(page, "lunar-shadow");
      await page
        .locator('.experience-options input[type="range"]')
        .evaluate((input) => {
          input.value = "0.8";
          input.dispatchEvent(new Event("input", { bubbles: true }));
        });
      await expect(canvas).toHaveAttribute("data-eclipse-alignment", "0.8000");
      await page.locator('[data-experience-action="align"]').click();
      await expect(canvas).toHaveAttribute("data-eclipse-alignment", "0.0000");
      await page.locator('[data-experience-action="play"]').click();
      await wait(page);
      expect(
        Number(await canvas.getAttribute("data-eclipse-alignment")),
      ).toBeGreaterThan(0.05);
      await page.locator('[data-experience-action="play"]').click();
      await page.getByRole("button", { name: "Switch to Chinese" }).click();
      await expect(page.locator(".experience-options")).toContainText("对齐");
      await page.locator("button[data-language]").click();
      await page.setViewportSize({ width: 390, height: 844 });
      await wait(page);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(390);
      await shot(page, "mobile-shadow");
      await page.setViewportSize({ width: 1600, height: 1000 });
    }
    await page.locator("[data-close-experience]").click();
    await expect(root).toHaveAttribute("data-view", "solar");
    await wait(page);
    const restoredPose = await cameraPose();
    expect(distance(restoredPose.position, previousPose.position)).toBeLessThan(
      0.003,
    );
    expect(distance(restoredPose.rotation, previousPose.rotation)).toBeLessThan(
      0.003,
    );
    expect(restoredPose.fov).toBe(previousPose.fov);
    expect(await canvas.getAttribute("data-simulation-time")).toBe(
      previousTime,
    );
  }
  await experience("solar-2024-dallas");
  await expect(canvas).toHaveAttribute("data-eclipse", "solar-2024-dallas");
  await page.waitForTimeout(1900);
  await expect(page.locator(".planetarium-controls")).toBeHidden();
  await page.locator(".eclipse-timeline input").evaluate((input) => {
    input.value = "500";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitForTimeout(850);
  await shot(page, "eclipse");
  await page.locator("[data-close-experience]").click();
  await page.getByRole("button", { name: "Sky", exact: true }).click();
  await page.getByRole("button", { name: "Switch to Chinese" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await page.locator("[data-panel-toggle=settings]").click();
  await expect(page.locator("[data-option=atmosphere]")).not.toBeChecked();
  await page.locator("[data-music-volume]").evaluate((input) => {
    input.value = "0.16";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.locator("[data-close-panel]").click();
  await page.locator("button[data-music]").click();
  await expect(root).toHaveAttribute("data-music", "muted");
  await page.locator("button[data-music]").click();
  await expect(root).toHaveAttribute("data-music", "playing");
  await page.setViewportSize({ width: 390, height: 844 });
  await wait(page);
  await expect(page.locator("[data-device-option]")).toBeHidden();
  await shot(page, "mobile");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  expect(
    await page.locator(".planetarium-header").evaluate((el) => el.scrollWidth),
  ).toBeLessThanOrEqual(390);
  const planetariumApiRequests = network.filter((url) =>
    /\/api\/|\/after\//.test(url),
  ).length;
  expect(planetariumApiRequests).toBe(0);
  expect(failedAssets).toEqual([]);
  expect(errors).toEqual([]);
  await page.goto("/maze/display/fold/back/");
  await expect(page.locator("[data-planetarium-corner]")).toHaveAttribute(
    "href",
    "/planetarium/",
  );
  await page.goto("/maze/window/under/");
  await page.locator("[data-ciallo-play]").click();
  const audio = page.locator("[data-ciallo-audio]");
  await expect
    .poll(() => audio.evaluate((el) => el.currentTime))
    .toBeGreaterThan(0);
  expect(await audio.evaluate((el) => el.loop)).toBe(false);
  for (const route of [
    "/",
    "/maze/display/",
    "/maze/cache/l1/l2/",
    "/maze/route/a/b/c/d/e/",
  ]) {
    const r = await request.get(route);
    expect(r.ok()).toBe(true);
    expect(await r.text()).toContain('href="/planetarium/"');
  }
  expect(await (await request.get("/legal/")).text()).toContain("hatmix");
  expect(failedAssets).toEqual([]);
  expect(errors).toEqual([]);
  fs.writeFileSync(
    path.join(report, "runtime-experiences.json"),
    JSON.stringify(
      {
        errors,
        failedAssets,
        apiRequests: planetariumApiRequests,
        mazeApiRequests:
          network.filter((url) => /\/api\/|\/after\//.test(url)).length -
          planetariumApiRequests,
      },
      null,
      2,
    ),
  );
});

test("lunar surface orientation and free camera remain visible on narrow screens", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (event) => {
    if (event.type() === "error") errors.push(event.text());
  });
  await page.goto("/planetarium/");
  const canvas = page.locator("#planetarium-canvas");
  await expect(canvas).toHaveAttribute("data-ready", "true", {
    timeout: 30000,
  });
  await page.locator("[data-panel-toggle=experiences]").click();
  await page.locator('[data-experience-id="moon"]').click();
  await expect(page.locator(".experience-dock")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.waitForTimeout(1200);
  await shot(page, "moon-final");
  await page.locator('[data-moon-phase="2"]').click();
  await wait(page);
  expect(
    Number(await canvas.getAttribute("data-lunar-illumination")),
  ).toBeCloseTo(0.5, 1);
  await shot(page, "quarter-final");
  await page.mouse.move(800, 450);
  await page.mouse.down();
  await page.mouse.move(835, 465, { steps: 4 });
  await page.mouse.up();
  await expect(canvas).toHaveAttribute("data-lunar-following", "false");
  await page.locator('[data-experience-action="reset"]').click();
  await expect(canvas).toHaveAttribute("data-lunar-following", "true");
  await page
    .locator('[data-experience-setting="perspective"][data-value="orbit"]')
    .click();
  await page.waitForTimeout(1200);
  await shot(page, "moon-orbit-final");
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .locator('[data-experience-setting="perspective"][data-value="surface"]')
    .click();
  await page.waitForTimeout(1200);
  await shot(page, "mobile-moon-final");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  expect(errors).toEqual([]);
});

test("phone sensors require explicit activation and follow real event data", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128.0.0.0 Mobile Safari/537.36",
  });
  try {
    await context.addInitScript(() => {
      window.motionPermissionCalls = 0;
      window.DeviceOrientationEvent = class extends Event {
        static async requestPermission() {
          window.motionPermissionCalls++;
          return "granted";
        }
        constructor(type, options) {
          super(type);
          Object.assign(this, options);
        }
      };
    });
    const page = await context.newPage();
    await page.goto("/planetarium/");
    await expect(page.locator("#planetarium-canvas")).toHaveAttribute(
      "data-ready",
      "true",
      { timeout: 30000 },
    );
    await page.locator("[data-panel-toggle=settings]").click();
    await expect(page.locator("[data-device-option]")).toBeVisible();
    expect(await page.evaluate(() => window.motionPermissionCalls)).toBe(0);
    await page.locator("[data-device-nav]").check();
    await expect(page.locator("#planetarium")).toHaveAttribute(
      "data-device-motion",
      "waiting",
    );
    await page.evaluate(() =>
      window.dispatchEvent(
        new DeviceOrientationEvent("deviceorientation", {
          alpha: 10,
          beta: 70,
          gamma: 0,
        }),
      ),
    );
    await expect(page.locator("#planetarium")).toHaveAttribute(
      "data-device-motion",
      "enabled",
    );
    expect(await page.evaluate(() => window.motionPermissionCalls)).toBe(1);
    await page.locator("[data-close-panel]").click();
    const canvas = page.locator("#planetarium-canvas"),
      before = Number(await canvas.getAttribute("data-view-azimuth"));
    await page.evaluate(() =>
      window.dispatchEvent(
        new DeviceOrientationEvent("deviceorientation", {
          alpha: 65,
          beta: 70,
          gamma: 0,
        }),
      ),
    );
    await wait(page);
    expect(
      Math.abs(Number(await canvas.getAttribute("data-view-azimuth")) - before),
    ).toBeGreaterThan(10);
    await shot(page, "phone-motion");
    await page.locator("[data-reset-view]").click();
    await page.locator("[data-panel-toggle=settings]").click();
    await page.locator("[data-device-nav]").uncheck();
    await expect(page.locator("#planetarium")).toHaveAttribute(
      "data-device-motion",
      "disabled",
    );
  } finally {
    await context.close();
  }
});

test("30 days per second stays on continuous orbits and readable sky motion", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/planetarium/");
  const canvas = page.locator("#planetarium-canvas");
  await expect(canvas).toHaveAttribute("data-ready", "true", {
    timeout: 30000,
  });
  await page.getByRole("button", { name: "Solar system", exact: true }).click();
  await page.waitForTimeout(2400);
  await page.locator(".time-speed").selectOption("2592000");
  await page.waitForTimeout(800);
  const sampleFrames = (attribute, count) =>
    page.evaluate(
      async ({ attribute, count }) => {
        const canvas = document.querySelector("#planetarium-canvas");
        const rows = [];
        for (let index = 0; index < count; index++) {
          await new Promise((resolve) => requestAnimationFrame(resolve));
          rows.push({
            vector: (canvas.getAttribute(attribute) || "")
              .split(",")
              .map(Number),
            time: Number(canvas.dataset.simulationTime),
          });
        }
        return rows;
      },
      { attribute, count },
    );
  const orbit = await sampleFrames("data-mercury-position", 100);
  expect(
    orbit.every(
      (row) => row.vector.length === 3 && row.vector.every(Number.isFinite),
    ),
  ).toBe(true);
  const initialRadius = Math.hypot(...orbit[0].vector);
  expect(initialRadius).toBeGreaterThan(0);
  let maximumStep = 0;
  for (let index = 1; index < orbit.length; index++) {
    const row = orbit[index],
      before = orbit[index - 1];
    const radius = Math.hypot(...row.vector);
    expect(radius).toBeGreaterThan(initialRadius * 0.6);
    expect(radius).toBeLessThan(initialRadius * 1.6);
    const step =
      Math.hypot(
        ...row.vector.map((value, axis) => value - before.vector[axis]),
      ) / radius;
    maximumStep = Math.max(maximumStep, step);
  }
  expect(maximumStep).toBeLessThan(0.42);
  expect(orbit.at(-1).time - orbit[0].time).toBeGreaterThan(20 * 86400000);
  await shot(page, "high-speed-orbits");
  await page.getByRole("button", { name: "Sky", exact: true }).click();
  await page.waitForTimeout(1600);
  const sky = await sampleFrames("data-sky-rotation", 100);
  expect(
    sky.every(
      (row) => row.vector.length === 4 && row.vector.every(Number.isFinite),
    ),
  ).toBe(true);
  let maximumSkyStep = 0,
    skyTravel = 0;
  for (let index = 1; index < sky.length; index++) {
    const dot = sky[index].vector.reduce(
      (sum, value, axis) => sum + value * sky[index - 1].vector[axis],
      0,
    );
    const turn = 2 * Math.acos(Math.min(1, Math.abs(dot)));
    maximumSkyStep = Math.max(maximumSkyStep, turn);
    skyTravel += turn;
  }
  expect(maximumSkyStep).toBeLessThan(0.09);
  expect(skyTravel).toBeGreaterThan(0.15);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const pausedTime = Number(await canvas.getAttribute("data-simulation-time"));
  await page.waitForTimeout(750);
  expect(Number(await canvas.getAttribute("data-simulation-time"))).toBe(
    pausedTime,
  );
  expect(errors).toEqual([]);
  fs.writeFileSync(
    path.join(report, "experiences-motion.json"),
    JSON.stringify(
      {
        errors,
        framesPerView: 100,
        maximumRelativeOrbitStep: maximumStep,
        maximumSkyStepRadians: maximumSkyStep,
        skyTravelRadians: skyTravel,
        pausedTime,
      },
      null,
      2,
    ),
  );
});
