import * as THREE from "three";
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  ToneMappingEffect,
  ToneMappingMode,
} from "postprocessing";
import { SkyScene, starVector } from "./sky-scene.mjs";
import { SolarScene } from "./solar-scene.mjs";
import { LunarStudio } from "./lunar-studio.mjs";
import { ExperienceControls } from "./experience-controls.mjs";
import {
  phaseThumbnailPath,
  moonCyclePhase,
  eclipseModelPhase,
} from "./experience-math.mjs";
import {
  COPY,
  PLACES,
  PLANETS,
  EVENTS,
  EXPERIENCES,
  MOON_PHASES,
} from "./content.mjs";
import { PlanetariumMusic } from "./music.mjs";
import { SkyNavigation } from "./sky-navigation.mjs";
import { SolarNavigation } from "./solar-navigation.mjs";
import { OrientationHud, orientationAngles } from "./orientation-hud.mjs";
import { DeviceNavigation } from "./device-navigation.mjs";
import {
  DEFAULT_PLAYBACK_RATES,
  playbackRateForView,
  rememberPlaybackRate,
} from "./playback-rates.mjs";
import {
  objectDescription,
  starIdentity,
  POPULAR_STAR_IDS,
} from "./object-descriptions.mjs";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const root = $("#planetarium");
const canvas = $("#planetarium-canvas");
const labels = { language: "en" };
let playbackRates = { ...DEFAULT_PLAYBACK_RATES };
const state = {
  view: "sky",
  time: Date.parse("2025-08-12T22:00:00Z"),
  playing: true,
  speed: DEFAULT_PLAYBACK_RATES.sky,
  direction: 1,
  place: PLACES[0],
  selected: null,
  panel: null,
  tour: false,
  event: null,
  quality: "balanced",
  experience: null,
  followBody: null,
  options: {
    photographic: true,
    atmosphere: false,
    fullSphere: true,
    constellations: true,
    orbits: true,
    meteorShower: false,
    starTrails: false,
  },
};
const text = (key) => COPY[labels.language][key] || COPY.en[key] || key;
const named = (item) =>
  labels.language === "zh"
    ? item.nameZh || item.zh || item.name || item.en
    : item.name || item.en;
const disposers = [];
let renderer,
  composer,
  sky,
  solar,
  lunar,
  camera,
  frame = 0,
  disposed = false,
  lastFrame = 0,
  lastSample = 0,
  lastClock = 0;
let samplePromise = null,
  sampleWanted = false,
  motionPending = false,
  generation = 0,
  lastSnapshot = null,
  lastSolar = null,
  orbitPaths = null,
  transition = null;
let orbitPromise = null;
let savedSkyView = null;
let experienceContext = null,
  experienceRequest = 0,
  music,
  experienceControls,
  studioFollow = true,
  studioElapsed = 0,
  lastExperienceReadout = 0;
const experienceSettings = {
  meteorPreset: "perseids",
  meteorRate: 2,
  trailExposure: 2,
  trailPlaying: true,
  trailGlow: true,
  trailColor: true,
  phase: 0.35,
  lunarPlaying: true,
  perspective: "surface",
  eclipseKind: "solar",
  alignment: 0,
  guides: true,
};
const studioPoseCamera = new THREE.PerspectiveCamera();
const cabal312512StudioPose = {
  position: new THREE.Vector3(),
  target: new THREE.Vector3(),
};
const solarLookTarget = new THREE.Vector3();
let skyNavigation,
  solarNavigation,
  orientationHud,
  deviceNavigation,
  initialSkyPose,
  lastOrientation = 0;
let compassDrag = null,
  compassAxis = "azimuth";
let panelTrigger = null;
let hoverAt = 0,
  lastPointer = null,
  drag = null,
  tourClock = 0,
  tourIndex = 0,
  messageTimer;
const requestPromises = new Map();
let requestId = 0;
const worker = new Worker(new URL("./ephemeris.worker.mjs", import.meta.url), {
  type: "module",
});

function listen(target, event, handler, options) {
  target.addEventListener(event, handler, options);
  disposers.push(() => target.removeEventListener(event, handler, options));
}
function notify(key, permanent = false) {
  const message = $(".planetarium-message");
  message.textContent = text(key);
  message.hidden = false;
  clearTimeout(messageTimer);
  if (!permanent)
    messageTimer = setTimeout(() => (message.hidden = true), 3500);
}
function request(type, extra = {}) {
  if (disposed) return Promise.reject(Error("Disposed"));
  const id = ++requestId;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      requestPromises.delete(id);
      reject(Error("Calculation timeout"));
    }, 12000);
    requestPromises.set(id, { resolve, reject, timeout });
    worker.postMessage({
      id,
      type,
      time: new Date(state.time).toISOString(),
      observer: state.place,
      speed: state.playing ? state.speed * state.direction : 0,
      ...extra,
    });
  });
}
worker.onmessage = ({ data }) => {
  const job = requestPromises.get(data.id);
  if (!job) return;
  clearTimeout(job.timeout);
  requestPromises.delete(data.id);
  data.error ? job.reject(Error(data.error)) : job.resolve(data.result);
};
worker.onerror = () => {
  for (const job of requestPromises.values()) {
    clearTimeout(job.timeout);
    job.reject(Error("Worker unavailable"));
  }
  requestPromises.clear();
  notify("error");
};

function sample() {
  if (state.view === "studio") return Promise.resolve();
  if (disposed) return Promise.resolve();
  sampleWanted = true;
  if (samplePromise) return samplePromise;
  // One in-flight snapshot followed by the latest input, including paused scrubbing.
  samplePromise = (async () => {
    do {
      sampleWanted = false;
      const token = generation;
      const mode = state.view === "solar" ? "solar" : "sky";
      try {
        const result = await request(mode);
        if (disposed || token !== generation) continue;
        if (mode === "solar") {
          lastSolar = result;
          updateSolarFrame(result, 0);
        } else {
          lastSnapshot = result;
          sky.update(result, state.place);
        }
        canvas.dataset.sampleTime = result.time;
      } catch {
        if (!disposed && token === generation) notify("error");
      }
    } while (sampleWanted && !disposed);
  })().finally(() => {
    samplePromise = null;
  });
  return samplePromise;
}

function refreshPlaybackMotion() {
  generation++;
  motionPending = true;
  void sample().finally(() => {
    motionPending = false;
  });
}

function updateSolarFrame(snapshot, dt) {
  const previous = state.followBody
    ? solar.getTarget(state.followBody)?.position.clone()
    : null;
  solar.update(snapshot, dt, state.selected?.id, state.time);
  const next = state.followBody
    ? solar.getTarget(state.followBody)?.position
    : null;
  if (previous && next && !transition) {
    const delta = next.clone().sub(previous);
    solarNavigation.translate(delta);
    solarLookTarget.add(delta);
  }
}

function uiLanguage(language) {
  labels.language = language === "zh" ? "zh" : "en";
  document.documentElement.lang = labels.language === "zh" ? "zh-CN" : "en";
  document.title =
    (labels.language === "zh" ? "天象仪" : "Planetarium") + " · OmniCivitas";
  $$("[data-i18n]").forEach((el) => (el.textContent = text(el.dataset.i18n)));
  $("button[data-language]").textContent =
    labels.language === "en" ? "中文" : "EN";
  $("button[data-language]").setAttribute("aria-label", text("language"));
  $$("[data-tip]").forEach((el) => {
    el.title = text(el.dataset.tip);
    el.setAttribute("aria-label", text(el.dataset.tip));
  });
  $("[data-fullscreen]").title = text("fullscreen");
  $("[data-fullscreen]").setAttribute("aria-label", text("fullscreen"));
  $("[data-reverse]").title = text("reverse");
  $("[data-reverse]").setAttribute("aria-label", text("reverse"));
  $$(".close-button").forEach((el) =>
    el.setAttribute("aria-label", text("close")),
  );
  $("#object-search").placeholder = text("search");
  $("#object-search").setAttribute("aria-label", text("search"));
  $(".time-speed").setAttribute("aria-label", text("timeSpeed"));
  $('.eclipse-timeline input').setAttribute("aria-label", text("eclipseTime"));
  $('.time-speed option[value="86400"]').textContent = text("day");
  $('.time-speed option[value="2592000"]').textContent = text("month");
  renderLocations();
  renderObjects();
  renderExperiences();
  renderMoonPhases();
  experienceControls?.render(
    state.experience,
    experienceSettings,
    labels.language,
  );
  renderGuide();
  updateMusic();
  if (state.experience)
    $(".experience-title").textContent =
      EXPERIENCES.find((item) => item.id === state.experience)?.[
        labels.language
      ] || "";
  if (state.event)
    $(".eclipse-name").textContent =
      EVENTS.find((event) => event.id === state.event.id)?.[labels.language] ||
      "";
  renderObjectCard();
  updateClock(true);
  updatePlay();
  if (state.panel) $(".panel-heading h2").textContent = text(state.panel);
  try {
    localStorage.setItem("ocv.planetarium.language", labels.language);
  } catch {}
  root.dataset.language = labels.language;
}

function updateMusic(value = music?.getState()) {
  if (!value) return;
  const button = $("button[data-music]");
  button.setAttribute("aria-pressed", String(!value.muted));
  button.setAttribute("aria-label", text(value.muted ? "musicOff" : "musicOn"));
  button.title = text(value.muted ? "musicOff" : "musicOn");
  button.dataset.playing = String(value.playing);
  button.dataset.blocked = String(value.blocked);
  root.dataset.music = value.playing
    ? "playing"
    : value.muted
      ? "muted"
      : "waiting";
  $("[data-music-volume]").value = String(value.volume);
}
function updateDeviceMotion(value = deviceNavigation?.state) {
  if (!value) return;
  $("[data-device-nav]").checked = value.enabled || value.waiting;
  $("[data-device-nav]").disabled = value.waiting;
  root.dataset.deviceMotion = value.enabled
    ? "enabled"
    : value.waiting
      ? "waiting"
      : "disabled";
  if (value.error)
    notify(
      {
        "insecure-context": "motionHttps",
        "permission-denied": "motionDenied",
        "permission-required": "motionDenied",
        "sensor-unavailable": "motionTimeout",
        unavailable: "motionUnavailable",
      }[value.error] || "motionUnavailable",
    );
  if (state.view === "sky") {
    skyNavigation?.syncFromCamera();
    skyNavigation?.setEnabled(!value.enabled && !value.waiting);
  }
}
function renderGuide() {
  const list = $(".controls-guide");
  list.replaceChildren();
  canvas.setAttribute("aria-label", text(state.view === "solar" || state.view === "studio" ? "canvasSolar" : "canvasSky"));
  const pauseLabel = state.view === "studio" || state.experience === "trails" ? "pauseExperienceGuide" : "pauseGuide";
  const rows =
    state.view === "solar" || state.view === "studio"
      ? [
          ["dragGuide", text("leftDrag")],
          ["moveGuide", text("rightDrag")],
          ["forwardGuide", `${text("wheel")} · W S`],
          ["strafeGuide", "A D · Q E"],
          ...(state.view === "solar" ? [["focusGuide", "Double-click · F"]] : []),
          ["reset", "R · Middle-click"],
          [pauseLabel, "Space"],
        ]
      : [
          ["dragGuide", `${text("leftDrag")} · W A S D / ↑ ↓ ← →`],
          ["rollGuide", `${text("rightDrag")} · Q E`],
          ["ringsGuide", text("ringsKeys")],
          ["zoomGuide", text("wheel")],
          ["focusGuide", "Double-click · F"],
          ["reset", "R · Middle-click"],
          [pauseLabel, "Space"],
        ];
  for (const [label, keys] of rows) {
    const row = document.createElement("div"),
      title = document.createElement("span"),
      key = document.createElement("kbd");
    title.textContent = text(label);
    key.textContent = keys;
    row.append(title, key);
    list.append(row);
  }
}
function resetView() {
  transition = null;
  if (state.view === "studio") resetStudioView();
  else if (state.view === "solar") solarOverview();
  else if (state.view === "sky") {
    if (deviceNavigation?.state.enabled && initialSkyPose) {
      camera.quaternion.copy(initialSkyPose.quaternion);
      camera.position
        .set(0, 0, -1)
        .applyQuaternion(camera.quaternion)
        .multiplyScalar(-0.06);
      camera.fov = initialSkyPose.fov;
      camera.updateProjectionMatrix();
      deviceNavigation.calibrate(camera.quaternion);
      skyNavigation.syncFromCamera();
      return;
    }
    skyNavigation.setEnabled(true);
    skyNavigation.reset();
    state.selected = null;
    sky.selectConstellation(null);
    renderObjectCard();
    delete canvas.dataset.selected;
  }
}

function updatePlay() {
  const button = $("[data-play]");
  button.title = text(state.playing ? "pause" : "play");
  button.setAttribute("aria-label", button.title);
  button.innerHTML = state.playing
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 11 7-11 7Z"/></svg>';
  root.dataset.playing = String(state.playing);
  $("[data-reverse]").setAttribute("aria-pressed", String(state.direction < 0));
  const compact = $("[data-experience-play]");
  compact.textContent = state.playing ? "Ⅱ" : "▷";
  compact.setAttribute("aria-label", text(state.playing ? "pause" : "play"));
}
function updateClock(force = false) {
  const current = performance.now();
  if (!force && current - lastClock < 100) return;
  lastClock = current;
  const date = new Date(state.time);
  $(".time-display time").textContent = new Intl.DateTimeFormat(
    labels.language === "zh" ? "zh-CN" : "en-GB",
    {
      day: "2-digit",
      month: labels.language === "zh" ? "2-digit" : "short",
      year: "numeric",
      timeZone: "UTC",
    },
  )
    .format(date)
    .toUpperCase();
  $(".clock-display").replaceChildren(
    document.createTextNode(date.toISOString().slice(11, 19) + " "),
  );
  const utc = document.createElement("small");
  utc.textContent = "UTC";
  $(".clock-display").append(utc);
  $(".location-name").textContent = state.place.en
    ? state.place[labels.language]
    : text("custom");
  canvas.dataset.time = date.toISOString();
  if (state.event) {
    const start = Date.parse(state.event.start),
      end = Date.parse(state.event.end);
    $(".eclipse-timeline input").value = String(
      THREE.MathUtils.clamp(
        ((state.time - start) / (end - start)) * 1000,
        0,
        1000,
      ),
    );
    const phase = state.event.contacts
      .filter((c) => Date.parse(c.time) <= state.time)
      .at(-1);
    $(".eclipse-phase").textContent = phase
      ? phase.label.replaceAll("_", " ").toUpperCase()
      : "";
  }
}

function updatePanelButtons() {
  $$("[data-panel-toggle]").forEach((button) => {
    const time = button.dataset.panelToggle === "time";
    button.setAttribute("aria-controls", time ? "planetarium-time" : "planetarium-panel");
    button.setAttribute(
      "aria-expanded",
      String(time ? !$(".time-popover").hidden : state.panel === button.dataset.panelToggle),
    );
  });
}

function closePanel({ restoreFocus = false } = {}) {
  state.panel = null;
  $("#planetarium-panel").hidden = true;
  updatePanelButtons();
  if (restoreFocus && panelTrigger?.isConnected)
    panelTrigger.focus({ preventScroll: true });
}

function closeTimePopover({ restoreFocus = false } = {}) {
  $(".time-popover").hidden = true;
  updatePanelButtons();
  if (restoreFocus)
    $('[data-panel-toggle="time"]').focus({ preventScroll: true });
}

function showPanel(name) {
  if (name === "time") {
    const pop = $(".time-popover");
    pop.hidden = !pop.hidden;
    $("#sky-datetime").value = new Date(state.time).toISOString().slice(0, 16);
    updatePanelButtons();
    if (!pop.hidden) $("#sky-datetime").focus({ preventScroll: true });
    return;
  }
  const panel = $("#planetarium-panel");
  state.panel = state.panel === name ? null : name;
  panel.hidden = !state.panel;
  $$("[data-panel]").forEach(
    (el) => (el.hidden = el.dataset.panel !== state.panel),
  );
  $(".panel-heading h2").textContent = text(state.panel);
  if (state.panel === "objects") renderObjects();
  if (state.panel === "credits") loadCredits();
  if (state.panel === "location") renderLocations();
  updatePanelButtons();
  if (state.panel) {
    panelTrigger = $(`[data-panel-toggle="${state.panel}"]`);
    (state.panel === "objects" ? $("#object-search") : $("[data-close-panel]"))
      .focus({ preventScroll: true });
  }
}

function renderLocations() {
  const list = $(".location-list");
  list.replaceChildren();
  for (const place of PLACES) {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-pressed", String(state.place.id === place.id));
    const name = document.createElement("span");
    name.textContent = place[labels.language];
    const coord = document.createElement("small");
    coord.textContent = `${Math.abs(place.latitude).toFixed(1)}°${place.latitude >= 0 ? "N" : "S"} · ${Math.abs(place.longitude).toFixed(1)}°${place.longitude >= 0 ? "E" : "W"}`;
    button.append(name, coord);
    button.addEventListener("click", () => changePlace(place));
    list.append(button);
  }
}
function changePlace(place) {
  state.place = place;
  generation++;
  state.event = null;
  $(".eclipse-progress").hidden = true;
  if (state.view === "eclipse") setView("sky");
  $("#location-form [name=latitude]").value = String(place.latitude);
  $("#location-form [name=longitude]").value = String(place.longitude);
  renderLocations();
  updateClock(true);
  sample(true);
}

function renderObjects() {
  const list = $(".object-list"),
    query = $("#object-search").value.trim().toLocaleLowerCase();
  list.replaceChildren();
  const planets = PLANETS.filter(
    (item) => state.view === "solar" || item.id !== "earth",
  ).map((item) => ({ ...item, kind: "planet" }));
  const figures = (sky?.constellations || []).map((item) => ({
    ...item,
    kind: "constellation",
  }));
  const stars = (sky?.starRows || [])
    .filter((item) => item.name)
    .sort((a, b) => a.mag - b.mag)
    .slice(0, 120)
    .map((item) => {
      const identity = starIdentity(item.id);
      return {
        ...item,
        ...(identity
          ? {
              name: identity.en,
              nameZh: identity.zh,
              aliases: identity.aliases,
            }
          : {}),
        kind: "star",
      };
    });
  const cabal312512FamousStars = new Set(POPULAR_STAR_IDS.map(String));
  const popular = stars.filter((item) =>
    cabal312512FamousStars.has(String(item.id)),
  );
  const otherStars = stars.filter(
    (item) => !cabal312512FamousStars.has(String(item.id)),
  );
  const choices = (
    state.view === "solar"
      ? planets
      : [...popular, ...planets, ...figures, ...otherStars]
  )
    .filter((item) =>
      [
        item.en,
        item.zh,
        item.name,
        item.nameZh,
        item.id,
        ...(item.aliases || []),
      ].some((name) =>
        String(name || "")
          .toLowerCase()
          .includes(query),
      ),
    )
    .slice(0, 30);
  if (state.view === "solar" && !query) {
    const overview = document.createElement("button");
    overview.type = "button";
    overview.textContent = text("overview");
    overview.addEventListener("click", () => solarOverview());
    list.append(overview);
  }
  for (const item of choices) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.objectId = item.id;
    const title = document.createElement("span");
    title.textContent = named(item) || String(item.id);
    const kind = document.createElement("small");
    kind.textContent =
      item.kind === "constellation"
        ? text("constellation")
        : item.kind === "star"
          ? text("star")
          : text(item.id === "moon" ? "satellite" : "planet");
    button.append(title, kind);
    button.addEventListener("click", () => {
      selectObject(item, state.view !== "solar");
      closePanel();
      canvas.focus({ preventScroll: true });
    });
    button.addEventListener("dblclick", () => {
      if (state.view === "solar") selectObject(item, true);
    });
    list.append(button);
  }
}

function renderObjectCard() {
  const card = $(".object-card");
  card.hidden =
    !state.selected || state.view === "eclipse" || state.view === "moon";
  if (!state.selected) return;
  const item = state.selected;
  $(".object-name").textContent = named(item) || String(item.id);
  const description = $(".object-description");
  description.textContent = objectDescription(
    item.kind,
    item.id,
    labels.language,
  );
  description.hidden = !description.textContent;
  $(".object-kind").textContent = text(
    item.kind === "constellation"
      ? "constellation"
      : item.kind === "star"
        ? "star"
        : item.id === "moon"
          ? "satellite"
          : "planet",
  );
  const facts = $(".object-facts");
  facts.replaceChildren();
  const add = (label, value) => {
    const span = document.createElement("span"),
      small = document.createElement("small");
    small.textContent = text(label);
    span.append(small, document.createTextNode(value));
    facts.append(span);
  };
  if (item.kind === "star") add("magnitude", Number(item.mag).toFixed(2));
  else if (item.kind !== "constellation") {
    const planet = PLANETS.find((p) => p.id === item.id);
    if (planet) add("radius", planet.radius);
  }
  if (state.view !== "solar") {
    const body = lastSnapshot?.bodies.find((b) => b.id === item.id);
    if (body) add("altitude", body.altitude.toFixed(1) + "°");
  }
  $("[data-focus-object]").hidden = item.kind !== "planet";
}

function selectObject(item, focus = false) {
  if (item.kind === "star") {
    const identity = starIdentity(item.id);
    if (identity)
      item = {
        ...item,
        name: identity.en,
        nameZh: identity.zh,
        aliases: identity.aliases,
      };
  }
  if (item.kind === "constellation" && item.id === "Ser")
    item = { ...item, name: "Serpens", nameZh: "巨蛇座" };
  if (item.kind === "planet")
    item = { ...PLANETS.find((planet) => planet.id === item.id), ...item };
  state.selected = item;
  sky.selectConstellation(item.kind === "constellation" ? item : null);
  if (state.view === "solar") solar.flashSelection(item.id);
  renderObjectCard();
  canvas.dataset.selected = String(item.id);
  if (focus) {
    if (state.view === "solar") focusSolar(item.id);
    else focusSky(item);
  }
}
function focusSky(item, fov = state.view === "eclipse" ? 2.4 : 38) {
  const direction = sky.directionFor(item);
  if (!direction) return;
  focusSkyDirection(direction, fov);
}
function focusSkyDirection(direction, fov) {
  const end = new THREE.Vector3().copy(direction).multiplyScalar(-0.06);
  transition = {
    kind: "sky",
    started: performance.now(),
    elapsed: 0,
    duration: 1.7,
    start: camera.position.clone(),
    end,
    startQuaternion: camera.quaternion.clone(),
    endQuaternion: new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().lookAt(
        end,
        new THREE.Vector3(),
        new THREE.Vector3(0, 1, 0),
      ),
    ),
    startTarget: solarLookTarget.clone(),
    endTarget: new THREE.Vector3(),
    startFov: camera.fov,
    endFov: fov,
  };
  solarNavigation?.setEnabled(false);
  skyNavigation?.setEnabled(false);
}
function focusSolar(id) {
  const target = solar.getTarget(id);
  if (!target) return;
  state.followBody = id;
  canvas.dataset.focusedBody = id;
  const center = target.position.clone();
  const sunDirection = center.clone().negate().normalize();
  if (sunDirection.lengthSq() < 0.1) sunDirection.set(0.6, 0.4, 1).normalize();
  const side = new THREE.Vector3()
    .crossVectors(new THREE.Vector3(0, 1, 0), sunDirection)
    .normalize();
  const distance = (target.framingRadius || target.radius) * 4.1;
  const offset = sunDirection
    .multiplyScalar(distance * 0.79)
    .addScaledVector(side, distance * 0.52)
    .add(new THREE.Vector3(0, distance * 0.22, 0));
  if (id === "saturn" && target.up)
    offset.addScaledVector(target.up, distance * 0.55);
  transition = {
    kind: "solar",
    targetId: id,
    focusOffset: offset.clone(),
    started: performance.now(),
    elapsed: 0,
    duration: 2.2,
    start: camera.position.clone(),
    end: center.clone().add(offset),
    startTarget: solarLookTarget.clone(),
    endTarget: center,
    startFov: camera.fov,
    endFov: 42,
  };
  solarNavigation.setEnabled(true);
}
function solarOverview() {
  state.selected = null;
  state.followBody = null;
  delete canvas.dataset.focusedBody;
  renderObjectCard();
  const target = solar.getTarget("system");
  if (!target) return;
  transition = {
    kind: "solar",
    started: performance.now(),
    elapsed: 0,
    duration: 2.5,
    start: camera.position.clone(),
    end: new THREE.Vector3(12, 94, 94),
    startTarget: solarLookTarget.clone(),
    endTarget: new THREE.Vector3(),
    startFov: camera.fov,
    endFov: 48,
  };
  solarNavigation.setEnabled(true);
}

async function setView(view, { keepExperience = false } = {}) {
  if (disposed) return;
  if (!keepExperience && state.experience) clearExperience();
  if (state.view === "sky" && camera)
    savedSkyView = {
      position: camera.position.clone(),
      quaternion: camera.quaternion.clone(),
      fov: camera.fov,
    };
  const viewToken = ++generation;
  state.view = view;
  state.speed = playbackRateForView(playbackRates, view, state.speed);
  $(".time-speed").value = String(state.speed);
  closeTimePopover();
  if (view !== "sky") deviceNavigation?.disable();
  await (view === "studio" ? lunar.load() : sky.ready);
  if (disposed || viewToken !== generation) return;
  state.selected = null;
  state.followBody = null;
  sky.selectConstellation(null);
  delete canvas.dataset.focusedBody;
  renderObjectCard();
  transition = null;
  solarNavigation.setEnabled(false);
  skyNavigation?.setEnabled(false);
  $$("button[data-view]").forEach((button) =>
    button.setAttribute(
      "aria-pressed",
      String(
        button.dataset.view ===
          (view === "solar" ? "solar" : view === "studio" ? "studio" : "sky"),
      ),
    ),
  );
  root.dataset.view = view;
  $(".solar-scale-note").hidden = view !== "solar";
  $(".eclipse-progress").hidden = view !== "eclipse" || !state.event;
  sky.setVisible(view !== "solar" && view !== "studio");
  solar.setVisible(view === "solar");
  lunar.setVisible(view === "studio");
  sky.tracking = view !== "solar" && view !== "studio";
  sky.catalogue.matrixAutoUpdate = false;
  camera.near = view === "solar" || view === "studio" ? 0.03 : 0.001;
  camera.far = 1800;
  camera.fov = view === "solar" ? 42 : 56;
  camera.updateProjectionMatrix();
  if (view === "studio") {
    lunar.setMode(state.experience === "shadow" ? "shadow" : "moon");
    lunar.setOptions(experienceSettings);
    resetStudioView(true);
  } else if (view === "solar") {
    solar.setOptions({ orbits: state.options.orbits });
    sky.setVisible(true);
    sky.ground.visible = false;
    if (sky.atmosphereMesh) sky.atmosphereMesh.visible = false;
    sky.catalogue.matrix.identity();
    sky.catalogue.matrixWorldNeedsUpdate = true;
    sky.lines.visible = false;
    sky.highlight.visible = false;
    for (const mesh of sky.bodies.values()) mesh.visible = false;
    sky.corona.visible = false;
    sky.galaxy.material.uniforms.opacity.value = 0.26;
    sky.starMaterial.uniforms.opacity.value = 0.55;
    camera.position.set(12, 94, 94);
    solarLookTarget.set(0, 0, 0);
    camera.lookAt(solarLookTarget);
    solarNavigation.syncFromCamera();
    await sample(true);
    if (disposed || viewToken !== generation || state.view !== view) return;
    solarNavigation.setEnabled(true);
    if (state.options.orbits) loadOrbits();
  } else {
    for (const mesh of sky.bodies.values()) mesh.visible = true;
    sky.corona.visible = true;
    sky.setOptions({
      ...state.options,
      fullSphere: !state.options.atmosphere,
      atmosphere: view === "eclipse" || state.options.atmosphere,
      eclipse: view === "eclipse",
      closeup: view === "moon",
    });
    camera.position.set(-0.026, -0.027, 0.051);
    solarLookTarget.set(0, 0, 0);
    camera.lookAt(0, 0, 0);
    await sample(true);
    if (disposed || viewToken !== generation || state.view !== view) return;
    if (view === "sky" && savedSkyView) {
      camera.position.copy(savedSkyView.position);
      camera.quaternion.copy(savedSkyView.quaternion);
      camera.fov = savedSkyView.fov;
      camera.updateProjectionMatrix();
    }
    skyNavigation?.syncFromCamera();
    skyNavigation?.setEnabled(view === "sky");
  }
  renderObjects();
  renderGuide();
}

function renderExperiences() {
  const list = $(".experience-list");
  list.replaceChildren();
  for (const group of ["nightSky", "lunar", "dynamics", "celestialEvents"]) {
    const section = document.createElement("section");
    const heading = document.createElement("h3");
    heading.textContent = text(group);
    section.append(heading);
    for (const item of EXPERIENCES.filter((item) => item.group === group)) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.experienceId = item.id;
      if (item.kind) button.dataset.eventId = item.id;
      button.setAttribute("aria-pressed", String(state.experience === item.id));
      const icon = document.createElement("span");
      icon.className = "experience-icon " + item.icon;
      icon.setAttribute("aria-hidden", "true");
      const name = document.createElement("span");
      name.textContent = item[labels.language];
      button.append(icon, name);
      button.addEventListener("click", () => void openExperience(item.id));
      section.append(button);
    }
    list.append(section);
  }
}
function renderMoonPhases() {
  const list = $(".moon-phases");
  list.replaceChildren();
  MOON_PHASES.forEach((phase, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.moonPhase = index;
    button.title = phase[labels.language];
    button.setAttribute("aria-label", phase[labels.language]);
    button.setAttribute(
      "aria-pressed",
      String(index === Math.round(experienceSettings.phase * 8) % 8),
    );
    const ns = "http://www.w3.org/2000/svg";
    const disc = document.createElementNS(ns, "svg");
    disc.classList.add("phase-disc");
    disc.setAttribute("viewBox", "0 0 24 24");
    disc.setAttribute("aria-hidden", "true");
    const dark = document.createElementNS(ns, "circle");
    dark.setAttribute("cx", "12");
    dark.setAttribute("cy", "12");
    dark.setAttribute("r", "10");
    dark.setAttribute("fill", "#151c27");
    const defs = document.createElementNS(ns, "defs");
    const clip = document.createElementNS(ns, "clipPath");
    const path = document.createElementNS(ns, "path");
    const clipId = `phase-thumbnail-${index}`;
    clip.setAttribute("id", clipId);
    path.setAttribute("d", phaseThumbnailPath(index / 8));
    clip.append(path);
    defs.append(clip);
    const image = document.createElementNS(ns, "image");
    image.setAttribute("href", "/planetarium/assets/moon.jpg");
    image.setAttribute("x", "2");
    image.setAttribute("y", "2");
    image.setAttribute("width", "20");
    image.setAttribute("height", "20");
    image.setAttribute("preserveAspectRatio", "xMidYMid slice");
    image.setAttribute("clip-path", `url(#${clipId})`);
    disc.append(defs, dark, image);
    button.append(disc);
    button.addEventListener("click", () => void selectMoonPhase(index));
    list.append(button);
  });
}
async function selectMoonPhase(index) {
  if (state.view !== "studio" || state.experience !== "moon") return;
  experienceSettings.phase = index / 8;
  experienceSettings.lunarPlaying = false;
  studioElapsed = 0;
  lunar.setOptions(experienceSettings);
  studioFollow = true;
  $(".moon-phases").dataset.phase = index;
  $$("[data-moon-phase]").forEach((button) =>
    button.setAttribute("aria-pressed", String(Number(button.dataset.moonPhase) === index)),
  );
  experienceControls.update(experienceSettings);
}

function resetStudioView(immediate = false) {
  studioFollow = true;
  if (immediate) lunar.update(0);
  const pose = studioPose();
  if (immediate) {
    camera.position.copy(pose.position);
    camera.fov = 42;
    camera.lookAt(pose.target);
    camera.updateProjectionMatrix();
    solarNavigation.syncFromCamera();
  }
  solarNavigation.setEnabled(true);
}

function studioPose() {
  const pose = lunar.defaultPose(
    experienceSettings.perspective,
    cabal312512StudioPose,
  );
  const frameScale = Math.max(1, 0.95 / camera.aspect);
  if (frameScale > 1)
    pose.position.sub(pose.target).multiplyScalar(frameScale).add(pose.target);
  return pose;
}

function changeExperienceSetting(key, value) {
  experienceSettings[key] = value;
  if (key === "meteorPreset") {
    sky.setExperience(experienceSettings);
    focusSkyDirection(sky.meteorRadiantDirection(), 76);
  } else if (key === "phase" || key === "alignment") {
    experienceSettings.lunarPlaying = false;
    if (key === "alignment")
      experienceSettings.phase = eclipseModelPhase(
        value,
        experienceSettings.eclipseKind,
      );
    studioElapsed = key === "alignment" ? Math.asin(value) : 0;
    studioFollow = true;
  } else if (key === "eclipseKind") {
    experienceSettings.phase = eclipseModelPhase(
      experienceSettings.alignment,
      value,
    );
    studioElapsed = Math.asin(experienceSettings.alignment);
    studioFollow = true;
  } else if (key === "perspective") resetStudioView();
  sky.setExperience(experienceSettings);
  if (state.view === "studio") lunar.setOptions(experienceSettings);
  experienceControls.update(experienceSettings);
}

function experienceAction(action) {
  if (action === "burst") sky.meteorBurst();
  else if (action === "restart") {
    sky.restartExposure();
    experienceSettings.trailPlaying = true;
    sky.setExperience(experienceSettings);
    experienceControls.update(experienceSettings);
  } else if (action === "align") changeExperienceSetting("alignment", 0);
  else if (action === "reset") resetStudioView();
  else if (action === "play") {
    const key = state.experience === "trails" ? "trailPlaying" : "lunarPlaying";
    experienceSettings[key] = !experienceSettings[key];
    sky.setExperience(experienceSettings);
    experienceControls.update(experienceSettings);
  } else if (action === "inner" || action === "outer") {
    state.followBody = null;
    state.selected = null;
    delete canvas.dataset.focusedBody;
    renderObjectCard();
    transition = {
      kind: "solar",
      started: performance.now(),
      elapsed: 0,
      duration: 1.5,
      start: camera.position.clone(),
      end:
        action === "inner"
          ? new THREE.Vector3(5, 32, 35)
          : new THREE.Vector3(12, 94, 94),
      startTarget: solarLookTarget.clone(),
      endTarget: new THREE.Vector3(),
      startFov: camera.fov,
      endFov: 48,
    };
    solarNavigation.setEnabled(true);
  }
}
function clearExperience() {
  experienceRequest++;
  const previous = experienceContext;
  experienceContext = null;
  state.experience = null;
  state.event = null;
  state.tour = false;
  state.options.meteorShower = false;
  state.options.starTrails = false;
  if (previous) {
    state.time = previous.time;
    state.place = previous.place;
    state.playing = previous.playing;
    state.speed = previous.speed;
    state.direction = previous.direction;
    Object.assign(state.options, previous.options);
  }
  $(".time-speed").value = String(state.speed);
  $(".experience-dock").hidden = true;
  experienceControls.render(null, experienceSettings, labels.language);
  $(".eclipse-progress").hidden = true;
  delete root.dataset.experience;
  delete canvas.dataset.eclipse;
  updatePlay();
  updateClock(true);
  return previous;
}
function endExperience() {
  const returnFocus = $(".experience-dock").contains(document.activeElement);
  const previous = clearExperience();
  if (returnFocus) canvas.focus({ preventScroll: true });
  const token = experienceRequest;
  void setView(previous?.view === "solar" ? "solar" : "sky").then(() => {
    if (
      disposed ||
      token !== experienceRequest ||
      state.experience ||
      !previous?.pose
    )
      return;
    camera.position.copy(previous.pose.position);
    camera.quaternion.copy(previous.pose.quaternion);
    camera.fov = previous.pose.fov;
    camera.updateProjectionMatrix();
    (state.view === "solar" ? solarNavigation : skyNavigation).syncFromCamera();
  });
  applyOptions();
  renderExperiences();
}
async function openExperience(id) {
  const item = EXPERIENCES.find((item) => item.id === id);
  if (!item) return;
  const original = state.experience ? clearExperience() : null;
  const token = ++experienceRequest;
  experienceContext = original || {
    view: state.view,
    time: state.time,
    place: state.place,
    playing: state.playing,
    speed: state.speed,
    direction: state.direction,
    options: { ...state.options },
    pose: {
      position: camera.position.clone(),
      quaternion: camera.quaternion.clone(),
      fov: camera.fov,
    },
  };
  state.experience = id;
  root.dataset.experience = id;
  $(".experience-title").textContent = item[labels.language];
  $(".experience-dock").hidden = false;
  $(".experience-dock").setAttribute("aria-busy", "true");
  $(".moon-phases").hidden = id !== "moon";
  $("[data-replay-experience]").hidden = !item.kind;
  $("[data-experience-play]").hidden = !item.kind;
  studioElapsed = 0;
  if (id === "moon") {
    experienceSettings.perspective = "surface";
    experienceSettings.lunarPlaying = true;
  } else if (id === "shadow") {
    experienceSettings.perspective = "orbit";
    experienceSettings.alignment = 0;
    experienceSettings.phase = eclipseModelPhase(
      0,
      experienceSettings.eclipseKind,
    );
    experienceSettings.lunarPlaying = false;
  }
  experienceControls.render(id, experienceSettings, labels.language);
  closePanel();
  canvas.focus({ preventScroll: true });
  const view = item.kind
    ? "eclipse"
    : id === "moon" || id === "shadow"
      ? "studio"
      : id === "orbits"
        ? "solar"
        : "sky";
  await setView(view, { keepExperience: true });
  if (disposed || token !== experienceRequest) return;
  $(".experience-dock").setAttribute("aria-busy", "false");
  state.options.meteorShower = id === "meteors";
  state.options.starTrails = id === "trails";
  if (["meteors", "trails", "moon", "shadow"].includes(id)) {
    state.playing = false;
    state.options.constellations = false;
    state.options.atmosphere = false;
    updatePlay();
  }
  if (id === "orbits") {
    state.options.orbits = true;
    state.tour = false;
    solarOverview();
  }
  applyOptions();
  sky.setExperience(experienceSettings);
  experienceControls.update(experienceSettings);
  renderExperiences();
  if (id === "meteors") focusSkyDirection(sky.meteorRadiantDirection(), 76);
  if (id === "trails") focusSkyDirection(sky.motionPole.clone(), 68);
  if (item.kind) await openEclipse(id);
}
async function openEclipse(id) {
  const token = ++generation;
  try {
    const event = await request("preset", { eventId: id });
    if (disposed || token !== generation) return;
    state.event = event;
    state.place = { ...event.observer, en: "Dallas", zh: "达拉斯" };
    const peak = Date.parse(event.peak);
    const lead = event.kind === "solar" ? 12 * 60000 : 65 * 60000;
    state.time = peak - lead;
    state.playing = true;
    state.direction = 1;
    state.speed = event.kind === "solar" ? 180 : 600;
    $(".eclipse-progress").hidden = false;
    $(".eclipse-name").textContent = EVENTS.find((e) => e.id === id)[
      labels.language
    ];
    const ticks = $(".eclipse-contacts");
    ticks.replaceChildren();
    for (const contact of event.contacts) {
      const tick = document.createElement("i");
      tick.style.left =
        ((Date.parse(contact.time) - Date.parse(event.start)) /
          (Date.parse(event.end) - Date.parse(event.start))) *
          100 +
        "%";
      tick.title = contact.label;
      ticks.append(tick);
    }
    updatePlay();
    updateClock(true);
    renderExperiences();
    await sample(true);
    if (disposed || token !== generation || state.view !== "eclipse") return;
    trackEclipse(true);
    closePanel();
    canvas.dataset.eclipse = id;
  } catch {
    if (!disposed) notify("error");
  }
}
function trackEclipse(focus = false) {
  if (!lastSnapshot || !state.event) return;
  const id = state.event.kind === "solar" ? "sun" : "moon";
  const body = lastSnapshot.bodies.find((b) => b.id === id);
  if (!body) return;
  const planet = { ...PLANETS.find((p) => p.id === id), kind: "planet" };
  if (focus) {
    state.selected = planet;
    renderObjectCard();
    focusSky(planet, 1.9);
  } else if (!transition) {
    const direction = sky.bodies.get(id)?.position.clone().normalize();
    if (direction) {
      camera.position.copy(direction).multiplyScalar(-0.06);
      camera.lookAt(0, 0, 0);
    }
  }
}

async function loadOrbits() {
  if (orbitPaths) {
    solar.setOptions({ orbitPaths, orbits: state.options.orbits });
    return;
  }
  try {
    orbitPromise ||= request("orbits", { samples: 48 });
    orbitPaths = await orbitPromise;
    if (!disposed)
      solar.setOptions({ orbitPaths, orbits: state.options.orbits });
  } catch {
    orbitPromise = null;
    notify("error");
  }
}
async function loadCredits() {
  const list = $(".credits-list");
  if (list.childElementCount) return;
  try {
    const response = await fetch("/planetarium/credits.json");
    if (!response.ok) throw Error("Credits unavailable");
    const data = await response.json();
    for (const credit of data.credits) {
      const article = document.createElement("article"),
        heading = document.createElement("h3"),
        author = document.createElement("p"),
        link = document.createElement("a");
      heading.textContent = credit.title;
      author.textContent = credit.author + " · " + credit.license;
      link.href = credit.sourceUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.dataset.i18n = "source";
      link.textContent = text("source");
      article.append(heading, author, link);
      if (credit.noticeUrl) {
        const notice = document.createElement("a");
        notice.href = credit.noticeUrl;
        notice.dataset.i18n = "license";
        notice.textContent = text("license");
        article.append(notice);
      }
      list.append(article);
    }
  } catch {
    notify("error");
  }
}

function resize() {
  if (!renderer || disposed) return;
  const width = root.clientWidth,
    height = root.clientHeight;
  const limit = state.quality === "high" ? 4_200_000 : 2_200_000;
  const pixelRatio = Math.min(
    devicePixelRatio || 1,
    state.quality === "high" ? 1.8 : 1.4,
    Math.sqrt(limit / (width * height)),
  );
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height, false);
  composer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  canvas.dataset.pixelRatio = pixelRatio.toFixed(2);
}
function updateTransition(dt) {
  if (!transition) return;
  const t = transition;
  if (t.kind === "solar" && t.targetId) {
    const movingTarget = solar.getTarget(t.targetId);
    if (movingTarget) {
      t.endTarget.copy(movingTarget.position);
      t.end.copy(movingTarget.position).add(t.focusOffset);
    }
  }
  t.elapsed = (performance.now() - t.started) / 1000;
  const progress = Math.min(1, t.elapsed / t.duration);
  const smooth = progress * progress * (3 - 2 * progress);
  if (t.kind === "sky") {
    camera.quaternion.slerpQuaternions(
      t.startQuaternion,
      t.endQuaternion,
      smooth,
    );
    camera.position
      .set(0, 0, -1)
      .applyQuaternion(camera.quaternion)
      .multiplyScalar(-0.06);
  } else camera.position.lerpVectors(t.start, t.end, smooth);
  solarLookTarget.lerpVectors(t.startTarget, t.endTarget, smooth);
  camera.fov = THREE.MathUtils.lerp(t.startFov, t.endFov, smooth);
  camera.updateProjectionMatrix();
  if (t.kind !== "sky") camera.lookAt(solarLookTarget);
  if (progress === 1) {
    transition = null;
    if (state.view === "solar") {
      solarNavigation.syncFromCamera();
      solarNavigation.setEnabled(true);
    } else {
      skyNavigation.syncFromCamera();
      skyNavigation.setEnabled(state.view === "sky");
    }
  }
}

function tourStep() {
  if (state.view === "solar") {
    const ids = ["earth", "saturn", "jupiter", "mars", "moon", "neptune"];
    const id = ids[tourIndex++ % ids.length];
    selectObject({ ...PLANETS.find((p) => p.id === id), kind: "planet" }, true);
  } else {
    const visible = sky.constellations;
    if (!visible.length) return;
    const figure = visible[tourIndex++ % visible.length];
    selectObject({ ...figure, kind: "constellation" }, true);
  }
}
function animate(now) {
  if (disposed) return;
  frame = requestAnimationFrame(animate);
  if (document.hidden) {
    lastFrame = now;
    return;
  }
  const elapsed = Math.min(0.1, (now - (lastFrame || now)) / 1000);
  const dt = Math.min(0.05, elapsed);
  lastFrame = now;
  if (state.playing && !motionPending) {
    state.time += elapsed * 1000 * state.speed * state.direction;
    if (state.event && state.view === "eclipse") {
      state.time = THREE.MathUtils.clamp(
        state.time,
        Date.parse(state.event.start),
        Date.parse(state.event.end),
      );
      if (
        state.time === Date.parse(state.event.end) ||
        state.time === Date.parse(state.event.start)
      ) {
        state.playing = false;
        updatePlay();
      }
    }
    const year = new Date(state.time).getUTCFullYear();
    if (year < 1600 || year > 2400) {
      state.time = Date.parse(
        year < 1600 ? "1600-01-01T00:00:00Z" : "2400-12-31T23:59:00Z",
      );
      state.playing = false;
      updatePlay();
    }
  }
  if (now - lastSample > 650) {
    lastSample = now;
    if (state.playing) sample();
  }
  updateClock();
  updateTransition(dt);
  if (!transition) {
    if (state.view === "solar" || state.view === "studio")
      solarNavigation.update(elapsed);
    if (state.view === "sky") {
      if (deviceNavigation?.state.enabled) deviceNavigation.update(dt);
      else skyNavigation.update(elapsed);
    }
  }
  if (state.view === "solar" && lastSolar) {
    updateSolarFrame(lastSolar, motionPending ? 0 : elapsed);
  }
  if (state.view === "studio") {
    if (experienceSettings.lunarPlaying) {
      if (state.experience === "moon")
        experienceSettings.phase = moonCyclePhase(
          experienceSettings.phase,
          elapsed,
        );
      else {
        studioElapsed += elapsed * 0.3;
        experienceSettings.alignment = Math.sin(studioElapsed);
        experienceSettings.phase = eclipseModelPhase(
          experienceSettings.alignment,
          experienceSettings.eclipseKind,
        );
      }
      lunar.setOptions(experienceSettings);
    }
    lunar.update(elapsed);
    if (studioFollow) {
      const pose = studioPose();
      const blend = 1 - Math.exp(-elapsed * 5.5);
      camera.position.lerp(pose.position, blend);
      studioPoseCamera.position.copy(camera.position);
      studioPoseCamera.lookAt(pose.target);
      camera.quaternion.slerp(studioPoseCamera.quaternion, blend);
      solarNavigation.syncFromCamera();
    }
    canvas.dataset.lunarPhase = experienceSettings.phase.toFixed(6);
    canvas.dataset.lunarIllumination = lunar.summary.illumination.toFixed(4);
    canvas.dataset.lunarPerspective = experienceSettings.perspective;
    canvas.dataset.lunarFollowing = String(studioFollow);
    canvas.dataset.eclipseKind = experienceSettings.eclipseKind;
    canvas.dataset.eclipseAlignment = experienceSettings.alignment.toFixed(4);
  }
  if (state.experience && now - lastExperienceReadout > 100) {
    lastExperienceReadout = now;
    experienceControls.update(experienceSettings);
    if (state.experience === "moon") {
      const nearest = Math.round(experienceSettings.phase * 8) % 8;
      $$("[data-moon-phase]").forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(Number(button.dataset.moonPhase) === nearest),
        ),
      );
    }
    if (state.experience === "trails") {
      canvas.dataset.trailProgress = sky
        .experienceState()
        .trailProgress.toFixed(4);
      canvas.dataset.trailExposure = String(experienceSettings.trailExposure);
    }
    if (state.experience === "meteors") {
      canvas.dataset.meteorPreset = experienceSettings.meteorPreset;
      canvas.dataset.meteorRate = String(experienceSettings.meteorRate);
    }
  }
  camera.updateMatrixWorld();
  if (state.view === "solar" || state.view === "studio") {
    canvas.dataset.cameraPosition = camera.position
      .toArray()
      .map((value) => value.toFixed(6))
      .join(",");
    canvas.dataset.cameraRotation = camera.quaternion
      .toArray()
      .map((value) => value.toFixed(8))
      .join(",");
    canvas.dataset.cameraForward = camera
      .getWorldDirection(new THREE.Vector3())
      .toArray()
      .map((value) => value.toFixed(6))
      .join(",");
    canvas.dataset.cameraFov = String(camera.fov);
  }
  solar.updateSelection(camera);
  if (state.view !== "studio")
    sky.updateCamera(camera, elapsed, state.time, {
      playing: state.playing,
      speed: state.speed * state.direction,
      frozen: motionPending,
    });
  else sky.updateGalaxyDetail(camera.fov, elapsed);
  const selectedStar = $(".star-target");
  selectedStar.hidden = true;
  if (state.view === "sky" && state.selected?.kind === "star") {
    const direction = sky.directionFor(state.selected);
    if (
      direction &&
      direction.dot(camera.getWorldDirection(new THREE.Vector3())) > 0
    ) {
      const point = direction.multiplyScalar(400).project(camera);
      if (Math.abs(point.x) < 1 && Math.abs(point.y) < 1) {
        selectedStar.hidden = false;
        selectedStar.style.left = ((point.x + 1) * root.clientWidth) / 2 + "px";
        selectedStar.style.top = ((1 - point.y) * root.clientHeight) / 2 + "px";
      }
    }
  }
  if (state.view === "eclipse" && state.event) {
    trackEclipse();
    // Disc billboards follow the camera after the smooth tracking update.
    for (const id of ["sun", "moon"])
      sky.bodies.get(id)?.quaternion.copy(camera.quaternion);
    sky.corona?.quaternion.copy(camera.quaternion);
  }
  if (state.tour) {
    tourClock += dt;
    if (tourClock > 11) {
      tourClock = 0;
      tourStep();
    }
  }
  if (
    lastPointer &&
    state.view === "sky" &&
    state.options.constellations &&
    now - hoverAt > 40 &&
    !drag
  ) {
    hoverAt = now;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(lastPointer.ndc, camera);
    const figure = sky.nearest(ray.ray.direction, camera, true);
    sky.highlightConstellation(figure);
    canvas.dataset.hoverConstellation = figure?.id || "";
    const label = $(".constellation-label");
    label.hidden = !figure;
    if (figure) {
      label.textContent = named(figure);
      const anchor = sky.constellationAnchor(figure, camera);
      label.hidden = !anchor;
      if (anchor) {
        const point = anchor.project(camera);
        label.style.left =
          THREE.MathUtils.clamp(
            (point.x * 0.5 + 0.5) * root.clientWidth,
            65,
            root.clientWidth - 65,
          ) + "px";
        label.style.top =
          THREE.MathUtils.clamp(
            (-point.y * 0.5 + 0.5) * root.clientHeight - 18,
            90,
            root.clientHeight - 130,
          ) + "px";
      }
    }
  }
  composer.render(dt);
  $(".orientation-hud").hidden = state.view !== "sky";
  if (state.view === "sky") {
    const box = $(".gyroscope-viewport").getBoundingClientRect();
    orientationHud.render(camera, {
      x: box.left,
      y: box.top,
      width: box.width,
      height: box.height,
    });
    if (now - lastOrientation > 80) {
      lastOrientation = now;
      const angles = orientationAngles(camera);
      for (const key of ["azimuth", "elevation", "roll"])
        $(`[data-angle=${key}]`).value = angles[key].toFixed(1) + "°";
      const projected = orientationHud.projectControls(box);
      for (const [name, point] of Object.entries(projected.cardinals)) {
        const label = $(`[data-cardinal="${name}"]`);
        label.style.left = point.x - box.left + "px";
        label.style.top = point.y - box.top + "px";
      }
      for (const [axis, point] of Object.entries(projected.handles)) {
        canvas.dataset["control" + axis[0].toUpperCase() + axis.slice(1)] =
          `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
      }
      canvas.dataset.directionArrow = `${orientationHud.viewDirection.x.toFixed(4)},${orientationHud.viewDirection.y.toFixed(4)},${orientationHud.viewDirection.z.toFixed(4)}`;
      $(".view-direction").textContent = [
        "N",
        "NE",
        "E",
        "SE",
        "S",
        "SW",
        "W",
        "NW",
      ][Math.round(angles.azimuth / 45) % 8];
      canvas.dataset.viewAzimuth = angles.azimuth.toFixed(1);
      canvas.dataset.viewElevation = angles.elevation.toFixed(1);
      canvas.dataset.viewRoll = angles.roll.toFixed(1);
      $(".gyroscope-viewport").setAttribute(
        "aria-valuenow",
        String(Math.round(angles[compassAxis])),
      );
    }
  }
  canvas.dataset.frames = String(Number(canvas.dataset.frames || 0) + 1);
  if (state.view === "solar") {
    const mercury = solar.getTarget("mercury");
    if (mercury)
      canvas.dataset.mercuryPosition = mercury.position
        .toArray()
        .map((value) => value.toFixed(5))
        .join(",");
  }
  canvas.dataset.simulationTime = String(Math.round(state.time));
  if (state.view === "sky")
    canvas.dataset.skyRotation = sky.skyQuaternion
      .toArray()
      .map((value) => value.toFixed(6))
      .join(",");
}

function bind() {
  const cabal312512Compass = $(".gyroscope-viewport");
  const selectCompassAxis = (axis) => {
    compassAxis = axis;
    orientationHud.setActiveControl(axis);
    cabal312512Compass.dataset.axis = axis;
    cabal312512Compass.setAttribute(
      "aria-valuemin",
      axis === "azimuth" ? "0" : axis === "elevation" ? "-90" : "-180",
    );
    cabal312512Compass.setAttribute(
      "aria-valuemax",
      axis === "azimuth" ? "359" : axis === "elevation" ? "90" : "180",
    );
    cabal312512Compass.setAttribute(
      "aria-label",
      text(
        axis === "azimuth"
          ? "azimuthShort"
          : axis === "elevation"
            ? "altitudeShort"
            : "rollShort",
      ),
    );
    $$("[data-direction-axis]").forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.directionAxis === axis),
      ),
    );
  };
  const adjustCompass = (angles) => {
    if (state.view !== "sky") return;
    if (deviceNavigation?.state.enabled || deviceNavigation?.state.waiting)
      deviceNavigation.disable();
    skyNavigation.setEnabled(true);
    skyNavigation.setOrientation(angles);
  };
  $$("[data-direction-axis]").forEach((button) =>
    listen(button, "click", () => {
      selectCompassAxis(button.dataset.directionAxis);
      cabal312512Compass.focus({ preventScroll: true });
    }),
  );
  selectCompassAxis("azimuth");
  listen(cabal312512Compass, "pointerdown", (event) => {
    if (
      compassDrag || event.button !== 0 || state.view !== "sky" ||
      event.ctrlKey || event.metaKey || event.altKey
    ) return;
    const box = cabal312512Compass.getBoundingClientRect();
    const control = orientationHud.pickControl(
      event.clientX,
      event.clientY,
      box,
    );
    if (!control) return;
    event.preventDefault();
    cabal312512Compass.focus({ preventScroll: true });
    selectCompassAxis(control.axis);
    compassDrag = {
      pointerId: event.pointerId,
      axis: control.axis,
      angle: control.angle,
      x: event.clientX,
      y: event.clientY,
    };
    cabal312512Compass.setPointerCapture(event.pointerId);
    adjustCompass({ [control.axis]: control.angle });
  });
  listen(cabal312512Compass, "pointermove", (event) => {
    if (!compassDrag || compassDrag.pointerId !== event.pointerId || state.view !== "sky") return;
    const box = cabal312512Compass.getBoundingClientRect();
    const angle = orientationHud.dragControl(
      compassDrag.axis,
      event.clientX,
      event.clientY,
      box,
      compassDrag.angle,
      compassDrag,
    );
    adjustCompass({ [compassDrag.axis]: angle });
    compassDrag.angle = angle;
    compassDrag.x = event.clientX;
    compassDrag.y = event.clientY;
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
    listen(cabal312512Compass, type, (event) => {
      if (compassDrag?.pointerId === event.pointerId) compassDrag = null;
    });
  listen(cabal312512Compass, "keydown", (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || state.view !== "sky")
      return;
    if (
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    )
      return;
    event.preventDefault();
    const angles = orientationAngles(camera);
    adjustCompass({
      [compassAxis]:
        angles[compassAxis] +
        (["ArrowRight", "ArrowUp"].includes(event.key) ? 5 : -5),
    });
  });
  $$("button[data-view]").forEach((button) =>
    listen(button, "click", () => setView(button.dataset.view)),
  );
  $$("[data-panel-toggle]").forEach((button) =>
    listen(button, "click", () => showPanel(button.dataset.panelToggle)),
  );
  updatePanelButtons();
  $('[data-option="orbits"]').checked = state.options.orbits;
  listen($("[data-close-panel]"), "click", () => closePanel({ restoreFocus: true }));
  listen($("[data-close-object]"), "click", () => {
    state.selected = null;
    sky.selectConstellation(null);
    renderObjectCard();
    canvas.focus({ preventScroll: true });
  });
  listen($("[data-close-experience]"), "click", endExperience);
  listen($("[data-reset-view]"), "click", resetView);
  listen($("[data-replay-experience]"), "click", () => {
    if (state.event) void openEclipse(state.event.id);
  });
  listen($("[data-experience-play]"), "click", () => {
    state.playing = !state.playing;
    updatePlay();
    refreshPlaybackMotion();
  });
  listen($("button[data-music]"), "click", () => music.toggleMuted());
  listen($("[data-music-volume]"), "input", (event) =>
    music.setVolume(Number(event.target.value)),
  );
  listen($("[data-device-nav]"), "change", async (event) => {
    if (!deviceNavigation.mobile || state.view !== "sky") {
      event.target.checked = false;
      return;
    }
    if (event.target.checked) await deviceNavigation.enable();
    else deviceNavigation.disable();
  });
  listen($("[data-focus-object]"), "click", () => {
    if (state.selected && state.selected.kind === "planet") {
      const item = state.selected;
      if (state.view !== "solar")
        setView("solar").then(() => {
          if (!disposed && state.view === "solar") selectObject(item, true);
        });
      else focusSolar(item.id);
    }
  });
  listen($("button[data-language]"), "click", () =>
    uiLanguage(labels.language === "en" ? "zh" : "en"),
  );
  listen($("[data-play]"), "click", () => {
    state.playing = !state.playing;
    updatePlay();
    refreshPlaybackMotion();
  });
  listen($("[data-reverse]"), "click", () => {
    state.direction *= -1;
    state.playing = true;
    updatePlay();
    refreshPlaybackMotion();
    $("[data-reverse]").setAttribute(
      "aria-pressed",
      String(state.direction < 0),
    );
  });
  listen($(".time-speed"), "change", (event) => {
    const speed = Number(event.target.value);
    if (!Number.isFinite(speed) || speed <= 0) return;
    state.speed = speed;
    playbackRates = rememberPlaybackRate(playbackRates, state.view, speed);
    refreshPlaybackMotion();
  });
  listen($("[data-now]"), "click", () => {
    state.time = Date.now();
    state.event = null;
    $(".eclipse-progress").hidden = true;
    generation++;
    if (state.view === "eclipse") setView("sky");
    sample(true);
    updateClock(true);
  });
  listen($("#time-form"), "submit", (event) => {
    event.preventDefault();
    const date = new Date($("#sky-datetime").value + "Z");
    if (
      !Number.isFinite(date.getTime()) ||
      date.getUTCFullYear() < 1600 ||
      date.getUTCFullYear() > 2400
    ) {
      notify("invalidDate");
      return;
    }
    state.time = date.getTime();
    state.event = null;
    $(".eclipse-progress").hidden = true;
    generation++;
    if (state.view === "eclipse") setView("sky");
    sample(true);
    updateClock(true);
    closeTimePopover({ restoreFocus: true });
  });
  listen($("#location-form"), "submit", (event) => {
    event.preventDefault();
    const latitude = Number(event.target.latitude.value),
      longitude = Number(event.target.longitude.value);
    if (
      Number.isFinite(latitude) &&
      Math.abs(latitude) <= 90 &&
      Number.isFinite(longitude) &&
      Math.abs(longitude) <= 180
    )
      changePlace({ latitude, longitude, elevation: 0 });
  });
  listen($("#object-search"), "input", renderObjects);
  listen($("[data-constellations]"), "click", () => {
    state.options.constellations = !state.options.constellations;
    applyOptions();
  });
  $$("[data-option]").forEach((input) =>
    listen(input, "change", () => {
      state.options[input.dataset.option] = input.checked;
      applyOptions();
    }),
  );
  listen($("[data-quality]"), "change", (event) => {
    state.quality = event.target.value;
    sky
      .setQuality(state.quality)
      .then(() => {
        if (!disposed)
          canvas.dataset.skyResolution = String(
            sky.galaxy.material.uniforms.map.value.image.width,
          );
      })
      .catch(() => {
        if (!disposed) notify("error");
      });
    resize();
  });
  listen($(".eclipse-timeline input"), "input", (event) => {
    if (!state.event) return;
    state.playing = false;
    state.time =
      Date.parse(state.event.start) +
      ((Date.parse(state.event.end) - Date.parse(state.event.start)) *
        Number(event.target.value)) /
        1000;
    updatePlay();
    updateClock(true);
    sample();
  });
  listen($("[data-fullscreen]"), "click", async () => {
    try {
      document.fullscreenElement
        ? await document.exitFullscreen()
        : await root.requestFullscreen();
    } catch {}
  });
  listen(canvas, "contextmenu", (event) => {
    if (!event.ctrlKey && !event.metaKey && !event.altKey) event.preventDefault();
  });
  // Cancel sensor control before navigation handles this same first gesture.
  for (const type of ["pointerdown", "wheel"])
    listen(canvas, type, (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey || state.view !== "sky") return;
      const device = deviceNavigation?.state;
      if (device?.enabled || device?.waiting) deviceNavigation.disable();
      if (transition) {
        skyNavigation.syncFromCamera();
        transition = null;
        skyNavigation.setEnabled(true);
        state.tour = false;
      }
    }, { capture: true, passive: true });
  listen(
    canvas,
    "wheel",
    (event) => {
      if (state.view === "eclipse" || state.view === "moon")
        event.preventDefault();
    },
    { passive: false },
  );
  listen(canvas, "pointerdown", (event) => {
    if (
      state.view === "eclipse" || state.view === "moon" ||
      event.ctrlKey || event.metaKey || event.altKey
    ) return;
    if (event.button === 1) {
      event.preventDefault();
      resetView();
      return;
    }
    if (drag) drag.multi = true;
    else drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, multi: false };
    transition = null;
    if (state.view === "solar" || state.view === "studio")
      solarNavigation.setEnabled(true);
    if (state.view === "sky") skyNavigation.setEnabled(true);
  });
  for (const type of ["pointercancel", "lostpointercapture"])
    listen(canvas, type, () => {
      drag = null;
    });
  listen(window, "blur", () => {
    drag = null;
    compassDrag = null;
  });
  listen(canvas, "pointermove", (event) => {
    const rect = canvas.getBoundingClientRect();
    lastPointer = {
      ndc: new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      ),
    };
  });
  listen(canvas, "pointerleave", () => {
    lastPointer = null;
    $(".constellation-label").hidden = true;
    sky.highlightConstellation(null);
    canvas.dataset.hoverConstellation = "";
  });
  listen(
    window,
    "pointerup",
    (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const multi = drag.multi;
      const distance = Math.hypot(
        event.clientX - drag.x,
        event.clientY - drag.y,
      );
      drag = null;
      if (
        multi || distance > 5 || event.target !== canvas || event.button !== 0 ||
        event.ctrlKey || event.metaKey || event.altKey
      ) return;
      if (state.view === "studio") return;
      const rect = canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, camera);
      const item =
        state.view === "solar"
          ? (() => {
              const id = solar.pick(ray);
              return id
                ? { ...PLANETS.find((p) => p.id === id), kind: "planet" }
                : null;
            })()
          : (() => {
              const pointObject = sky.nearest(ray.ray.direction, camera);
              if (pointObject?.kind === "star" && pointObject.name)
                return pointObject;
              const figure = state.options.constellations
                ? sky.nearest(ray.ray.direction, camera, true)
                : null;
              return figure
                ? { ...figure, kind: "constellation" }
                : pointObject;
            })();
      if (item) selectObject(item, false);
    },
    { capture: true },
  );
  listen(canvas, "dblclick", (event) => {
    if (state.view === "sky") {
      if (state.selected) selectObject(state.selected, true);
      return;
    }
    if (state.view !== "solar") return;
    const rect = canvas.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(
      new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      camera,
    );
    const id = solar.pick(ray);
    if (id)
      selectObject(
        { ...PLANETS.find((item) => item.id === id), kind: "planet" },
        true,
      );
  });
  listen(window, "keydown", (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "Escape") {
      if (!$(".time-popover").hidden) closeTimePopover({ restoreFocus: true });
      else if (state.panel) closePanel({ restoreFocus: true });
      else if (state.experience) endExperience();
      else return;
      event.preventDefault();
      state.tour = false;
      return;
    }
    if (event.target?.closest?.('button, a, input, select, textarea, summary, [contenteditable="true"], [role="textbox"]')) return;
    if (event.code === "Space") {
      event.preventDefault();
      if (event.repeat) return;
      if (state.view === "studio" || state.experience === "trails") {
        experienceAction("play");
        return;
      }
      state.playing = !state.playing;
      updatePlay();
      refreshPlaybackMotion();
    }
  });
  listen(window, "resize", resize);
  listen(document, "fullscreenchange", resize);
  listen(document, "visibilitychange", () => {
    lastFrame = 0;
  });
  listen(canvas, "webglcontextlost", (event) => {
    event.preventDefault();
    cancelAnimationFrame(frame);
    notify("contextLost", true);
  });
  listen(window, "pagehide", (event) => {
    if (event.persisted) {
      cancelAnimationFrame(frame);
    } else dispose();
  });
  listen(window, "pageshow", (event) => {
    if (event.persisted && !disposed) {
      lastFrame = 0;
      frame = requestAnimationFrame(animate);
    }
  });
}

function applyOptions() {
  $$("[data-option]").forEach(
    (input) => (input.checked = !!state.options[input.dataset.option]),
  );
  $("[data-constellations]").setAttribute(
    "aria-pressed",
    String(state.options.constellations),
  );
  sky.setOptions({
    ...state.options,
    fullSphere: !state.options.atmosphere,
    atmosphere: state.view === "eclipse" || state.options.atmosphere,
    eclipse: state.view === "eclipse",
    closeup: state.view === "moon",
  });
  solar.setOptions({ orbits: state.options.orbits });
  if (state.options.orbits && state.view === "solar") loadOrbits();
  if (!state.options.constellations) {
    sky.highlightConstellation(null);
    $(".constellation-label").hidden = true;
  }
}

function dispose() {
  if (disposed) return;
  disposed = true;
  cancelAnimationFrame(frame);
  clearTimeout(messageTimer);
  worker.terminate();
  for (const job of requestPromises.values()) {
    clearTimeout(job.timeout);
    job.reject(Error("Disposed"));
  }
  requestPromises.clear();
  disposers.forEach((dispose) => dispose());
  solarNavigation?.dispose();
  skyNavigation?.dispose();
  orientationHud?.dispose();
  deviceNavigation?.dispose();
  sky?.dispose();
  solar?.dispose();
  lunar?.dispose();
  composer?.dispose();
  renderer?.dispose();
  music?.dispose();
}

async function initialize() {
  try {
    $$("button[data-view]").forEach((button) => (button.disabled = true));
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x03050b);
    const scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(56, 1, 0.001, 1800);
    camera.position.set(-0.026, -0.027, 0.051);
    camera.lookAt(0, 0, 0);
    composer = new EffectComposer(renderer, {
      frameBufferType: THREE.HalfFloatType,
    });
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(
      new EffectPass(
        camera,
        new BloomEffect({
          intensity: 0.32,
          luminanceThreshold: 1.1,
          luminanceSmoothing: 0.35,
          mipmapBlur: true,
        }),
        new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }),
      ),
    );
    sky = new SkyScene(scene, renderer);
    solar = new SolarScene(scene, {
      renderer,
      onSelect: (id) =>
        selectObject({ ...PLANETS.find((p) => p.id === id), kind: "planet" }),
    });
    solar.setVisible(false);
    lunar = new LunarStudio(scene, { renderer });
    lunar.setVisible(false);
    experienceControls = new ExperienceControls(
      $("[data-experience-controls]"),
      {
        onChange: changeExperienceSetting,
        onAction: experienceAction,
      },
    );
    let language = "en";
    try {
      language = localStorage.getItem("ocv.planetarium.language") || "en";
    } catch {}
    uiLanguage(language);
    music = new PlanetariumMusic({ onChange: updateMusic });
    void music.start();
    skyNavigation = new SkyNavigation(camera, canvas, {
      onInteraction: () => {
        if (transition) skyNavigation.syncFromCamera();
        transition = null;
        state.tour = false;
      },
      onFocus: () => {
        if (state.selected) selectObject(state.selected, true);
      },
      onReset: () => {
        transition = null;
        state.selected = null;
        sky.selectConstellation(null);
        renderObjectCard();
        delete canvas.dataset.selected;
      },
    });
    solarNavigation = new SolarNavigation(camera, canvas, {
      onInteraction: () => {
        if (transition) solarNavigation.syncFromCamera();
        transition = null;
        state.tour = false;
        state.followBody = null;
        if (state.view === "studio") studioFollow = false;
        delete canvas.dataset.focusedBody;
      },
      onFocus: () => {
        if (state.selected?.kind === "planet") focusSolar(state.selected.id);
      },
      onReset: resetView,
    });
    orientationHud = new OrientationHud(renderer);
    deviceNavigation = new DeviceNavigation(camera, {
      onChange: updateDeviceMotion,
      onInteraction: () => {
        transition = null;
        skyNavigation.syncFromCamera();
      },
    });
    bind();
    $("[data-device-option]").hidden = !deviceNavigation.mobile;
    updateDeviceMotion();
    resize();
    updatePlay();
    await Promise.all([sky.ready, sample(true)]);
    if (disposed) return;
    renderObjects();
    const initialDirection = starVector(286, 12).transformDirection(
      sky.catalogue.matrix,
    );
    camera.position.copy(initialDirection).multiplyScalar(-0.06);
    camera.lookAt(0, 0, 0);
    skyNavigation.syncFromCamera({ rememberReset: true });
    initialSkyPose = { quaternion: camera.quaternion.clone(), fov: camera.fov };
    $(".planetarium-loading").classList.add("ready");
    setTimeout(() => {
      if (!disposed) $(".planetarium-loading").hidden = true;
    }, 750);
    canvas.dataset.ready = "true";
    canvas.dataset.skyResolution = "4096";
    $$("button[data-view]").forEach((button) => (button.disabled = false));
    root.dataset.view = "sky";
    frame = requestAnimationFrame(animate);
  } catch (error) {
    console.error("Planetarium initialization failed", error);
    $(".planetarium-loading").hidden = true;
    notify("error", true);
    dispose();
  }
}
initialize();
