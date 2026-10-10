import { defineConfig } from "@playwright/test";
import path from "node:path";
import { testDeps } from "./runtime-location.mjs";

export default defineConfig({
  testDir: "browser",
  testMatch: "planetarium.spec.mjs",
  workers: 1,
  fullyParallel: false,
  timeout: 180000,
  outputDir: path.join(testDeps, "runtime/test-results", process.env.OCV_PLANETARIUM_REPORT || "planetarium"),
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile: path.join(
          testDeps,
          "runtime/reports",
          process.env.OCV_PLANETARIUM_REPORT || "planetarium",
          "browser-experiences.json",
        ),
      },
    ],
  ],
  use: {
    baseURL: process.env.OCV_PLANETARIUM_BASE_URL || "http://127.0.0.1:8080",
    viewport: { width: 1600, height: 1000 },
    headless: true,
    actionTimeout: 10000,
    launchOptions:
      process.platform === "win32" ? { args: ["--use-angle=d3d11"] } : {},
    trace: "retain-on-failure",
  },
});
