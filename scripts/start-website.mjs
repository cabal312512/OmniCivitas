import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolveRuntimePaths } from "./runtime-paths.mjs";

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const cabal312512CoreGroups = [
  ["postgres", "redis"],
  ["gateway"],
  ["next"],
  ["portal", "edge"],
];

export function websiteAddress(document, fallbackPort = 8080) {
  const binding = document.services?.edge?.ports?.find(
    (port) => Number(port.target) === 8080,
  );
  const port = Number(binding?.published || fallbackPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw Error("The published website port is invalid.");
  let host = binding?.host_ip || "127.0.0.1";
  if (host === "0.0.0.0" || host === "::") host = "127.0.0.1";
  if (host.includes(":")) host = "[" + host + "]";
  return "http://" + host + ":" + port;
}

function runNode(file, args = []) {
  const result = spawnSync(process.execPath, [file, ...args], {
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error || result.status !== 0)
    throw result.error || Error(path.basename(file) + " failed.");
}

async function waitForReady(base, attempts = 40) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const reply = await fetch(base + "/health/ready", {
        signal: AbortSignal.timeout(2000),
      });
      if (reply.ok) return;
    } catch {}
    await wait(1500);
  }
  throw Error(
    "The website did not become ready. Existing containers and data were kept; inspect civilization:status.",
  );
}

export async function startWebsite({
  checkOnly = false,
  openBrowser = true,
  startRunner = true,
} = {}) {
  const runtime = resolveRuntimePaths();
  const { dockerCall, composeCall } = await import("./docker-child.mjs");
  if (checkOnly) {
    console.log(
      JSON.stringify(
        {
          projectRoot: runtime.projectRoot,
          mode: "cached Docker core",
          groups: cabal312512CoreGroups,
          builds: false,
          pulls: false,
          openBrowser,
          startRunner,
        },
        null,
        2,
      ),
    );
    return;
  }
  const engineAvailable = () => {
    try {
      return (
        dockerCall(["info", "--format", "{{.OSType}}"], {
          allowFailure: true,
          timeout: 5000,
        }).stdout.trim() === "linux"
      );
    } catch {
      return false;
    }
  };
  if (!engineAvailable()) {
    runNode(path.join(runtime.projectRoot, "scripts/start-docker.mjs"));
    console.log("Waiting for Docker Engine...");
    for (let attempt = 0; !engineAvailable(); attempt++) {
      if (attempt >= 90)
        throw Error(
          "Docker did not start. Open Docker Desktop and retry this launcher. No image was pulled or built.",
        );
      await wait(1500);
    }
  }
  if (process.platform === "win32") {
    const guard = spawnSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        path.join(runtime.projectRoot, "scripts/Confirm-DockerStorage.ps1"),
      ],
      { stdio: "inherit", windowsHide: true },
    );
    if (guard.error || guard.status !== 0)
      throw (
        guard.error ||
        Error("Docker storage verification failed; no containers were started.")
      );
  }
  const document = JSON.parse(
    composeCall(["config", "--format", "json"]).stdout,
  );
  for (const name of cabal312512CoreGroups.flat()) {
    const image = document.services?.[name]?.image;
    if (!image) throw Error("Core image is not declared: " + name);
    if (
      dockerCall(["image", "inspect", image], { allowFailure: true }).status !==
      0
    )
      throw Error(
        "Missing local image for " +
          name +
          ". Complete the documented installation/build first; this launcher never downloads or builds images automatically.",
      );
  }
  for (const group of cabal312512CoreGroups) {
    const reply = composeCall(
      [
        "up",
        "-d",
        "--no-deps",
        "--no-build",
        "--pull",
        "never",
        "--wait",
        "--wait-timeout",
        "90",
        ...group,
      ],
      { timeout: 120000 },
    );
    console.log((reply.stdout + reply.stderr).trim());
  }
  const base = websiteAddress(document, runtime.config.ports?.web || 8080);
  await waitForReady(base);
  if (startRunner) {
    const runnerScript = path.join(
      runtime.projectRoot,
      "scripts/after-runner.mjs",
    );
    const child = spawn(process.execPath, [runnerScript], {
      cwd: runtime.projectRoot,
      detached: true,
      windowsHide: true,
      stdio: "ignore",
      env: {
        ...process.env,
        OCV_BASE_URL: process.env.OCV_BASE_URL || base,
        NODE_OPTIONS: "--max-old-space-size=384",
      },
    });
    await new Promise((resolve, reject) => {
      child.once("spawn", resolve);
      child.once("error", reject);
    });
    child.unref();
    console.log(
      "Shared task dispatcher requested; its existing lease prevents duplicate workers.",
    );
  }
  if (openBrowser && process.platform === "win32") {
    const reply = spawnSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "Start-Process -FilePath $env:OCV_OPEN_WEBSITE",
      ],
      {
        env: { ...process.env, OCV_OPEN_WEBSITE: base },
        windowsHide: true,
        stdio: "inherit",
      },
    );
    if (reply.error || reply.status !== 0)
      console.log("Open this URL in your browser: " + base);
  }
  console.log("OmniCivitas is ready: " + base);
  fs.mkdirSync(runtime.reportRoot, { recursive: true });
  fs.writeFileSync(
    path.join(runtime.reportRoot, "website-launch.json"),
    JSON.stringify(
      {
        startedAt: new Date().toISOString(),
        url: base,
        groups: cabal312512CoreGroups,
        pulledImages: false,
        builtImages: false,
        runnerRequested: startRunner,
      },
      null,
      2,
    ),
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  startWebsite({
    checkOnly: process.argv.includes("--check"),
    openBrowser: !process.argv.includes("--no-open"),
    startRunner: !process.argv.includes("--no-runner"),
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
