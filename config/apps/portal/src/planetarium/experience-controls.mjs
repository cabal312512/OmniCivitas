import { phaseIllumination } from "./experience-math.mjs";

const LABELS = {
  en: {
    shower: "Shower",
    density: "Activity",
    burst: "Burst",
    exposure: "Exposure",
    calm: "Quiet",
    balanced: "Active",
    storm: "Intense",
    phase: "Phase",
    illuminated: "lit",
    surface: "Moon",
    orbit: "Orbit",
    solar: "Solar",
    lunar: "Lunar",
    alignment: "Alignment",
    align: "Align",
    guides: "Guides",
    reset: "Reset view",
    expose: "Expose",
    pause: "Pause",
    play: "Play",
    restart: "Restart",
    inner: "Inner planets",
    outer: "Whole system",
    colour: "Colour",
    glow: "Glow",
    perspective: "Perspective",
    eclipse: "Eclipse model",
    model: "Scale model",
    minute: "min",
    hour: "h",
  },
  zh: {
    shower: "流星群",
    density: "活动强度",
    burst: "爆发",
    exposure: "曝光",
    calm: "宁静",
    balanced: "活跃",
    storm: "密集",
    phase: "月相",
    illuminated: "亮面",
    surface: "月面",
    orbit: "轨道",
    solar: "日食",
    lunar: "月食",
    alignment: "对齐",
    align: "对齐",
    guides: "辅助线",
    reset: "复位视角",
    expose: "曝光",
    pause: "暂停",
    play: "播放",
    restart: "重新曝光",
    inner: "内行星",
    outer: "完整太阳系",
    colour: "色彩",
    glow: "辉光",
    perspective: "视角",
    eclipse: "食相模型",
    model: "比例示意",
    minute: "分钟",
    hour: "小时",
  },
};
const SHOWER_NAMES = {
  en: ["Perseids", "Geminids", "Leonids"],
  zh: ["英仙座流星群", "双子座流星群", "狮子座流星群"],
};

/** The host owns playback and rendering; these controls own no timers. */
export class ExperienceControls {
  constructor(element, { onChange, onAction }) {
    this.element = element;
    this.onChange = onChange;
    this.onAction = onAction;
    this.fields = new Map();
    this.buttons = new Map();
    this.mode = null;
    this.language = "en";
  }

  render(mode, values, language = "en") {
    this.scrubbing = null;
    this.mode = mode;
    this.language = language;
    this.copy = LABELS[language] || LABELS.en;
    this.values = values;
    this.element.replaceChildren();
    this.fields.clear();
    this.buttons.clear();
    this.element.hidden = ![
      "meteors",
      "trails",
      "moon",
      "shadow",
      "orbits",
    ].includes(mode);
    const c = this.copy;
    if (mode === "meteors") {
      this.select(
        "meteorPreset",
        c.shower,
        ["perseids", "geminids", "leonids"].map((value, i) => [
          value,
          (SHOWER_NAMES[language] || SHOWER_NAMES.en)[i],
        ]),
      );
      this.select(
        "meteorRate",
        c.density,
        [
          [1, c.calm],
          [2, c.balanced],
          [3, c.storm],
        ],
        true,
      );
      this.action("burst", c.burst, "✦");
    } else if (mode === "trails") {
      this.range("trailExposure", c.exposure, 0.25, 4, 0.25);
      this.toggle("trailGlow", c.glow);
      this.toggle("trailColor", c.colour);
      this.action("restart", c.restart, "↺");
      this.action("play", c.pause, "Ⅱ");
    } else if (mode === "moon") {
      this.range("phase", c.phase, 0, 1, 0.001);
      this.segments("perspective", c.perspective, [
        ["surface", c.surface],
        ["orbit", c.orbit],
      ]);
      this.toggle("guides", c.guides);
      this.action("reset", c.reset, "↺");
      this.action("play", c.pause, "Ⅱ");
    } else if (mode === "shadow") {
      this.segments("eclipseKind", c.eclipse, [
        ["solar", c.solar],
        ["lunar", c.lunar],
      ]);
      this.range("alignment", c.alignment, -1, 1, 0.002);
      this.toggle("guides", c.guides);
      this.action("align", c.align, "⊙");
      this.action("reset", c.reset, "↺");
      this.action("play", c.pause, "Ⅱ");
      const note = document.createElement("small");
      note.className = "experience-model-note";
      note.textContent = c.model;
      this.element.append(note);
    } else if (mode === "orbits") {
      this.action("inner", c.inner, "⊙");
      this.action("outer", c.outer, "◌");
    }
    this.update(values);
  }

  label(title) {
    const label = document.createElement("label");
    label.className = "experience-field";
    const name = document.createElement("span");
    name.textContent = title;
    label.append(name);
    this.element.append(label);
    return label;
  }

  select(key, title, options, numeric = false) {
    const label = this.label(title),
      select = document.createElement("select");
    select.setAttribute("aria-label", title);
    for (const [value, name] of options) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = name;
      select.append(option);
    }
    select.addEventListener("change", () =>
      this.onChange(key, numeric ? Number(select.value) : select.value),
    );
    label.append(select);
    this.fields.set(key, select);
  }

  range(key, title, min, max, step) {
    const label = this.label(title),
      input = document.createElement("input"),
      output = document.createElement("output");
    label.classList.add("experience-range");
    input.type = "range";
    input.min = min;
    input.max = max;
    input.step = step;
    input.setAttribute("aria-label", title);
    input.addEventListener("input", () =>
      this.onChange(key, Number(input.value)),
    );
    input.addEventListener("pointerdown", () => {
      this.scrubbing = key;
    });
    const release = () => {
      this.scrubbing = null;
    };
    input.addEventListener("pointerup", release);
    input.addEventListener("pointercancel", release);
    input.addEventListener("lostpointercapture", release);
    input.addEventListener("change", release);
    input.addEventListener("blur", release);
    label.append(output, input);
    this.fields.set(key, input);
    this.fields.set(key + "Output", output);
  }

  action(key, title, icon) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "experience-action";
    button.dataset.experienceAction = key;
    button.setAttribute("aria-label", title);
    button.title = title;
    button.textContent = icon;
    if (["inner", "outer", "burst", "align"].includes(key)) {
      const name = document.createElement("span");
      name.textContent = title;
      button.append(name);
    }
    button.addEventListener("click", () => this.onAction(key));
    this.element.append(button);
    this.buttons.set(key, button);
  }

  toggle(key, title) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "experience-toggle";
    button.textContent = title;
    button.dataset.experienceSetting = key;
    button.addEventListener("click", () =>
      this.onChange(key, !this.values[key]),
    );
    this.element.append(button);
    this.buttons.set(key, button);
  }

  segments(key, title, options) {
    const group = document.createElement("div");
    group.className = "experience-segments";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", title);
    for (const [value, label] of options) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.dataset.experienceSetting = key;
      button.dataset.value = value;
      button.addEventListener("click", () => this.onChange(key, value));
      this.buttons.set(key + ":" + value, button);
      group.append(button);
    }
    this.element.append(group);
  }

  update(values) {
    this.values = values;
    for (const [key, input] of this.fields) {
      if (key.endsWith("Output")) continue;
      if (this.scrubbing !== key) input.value = String(values[key]);
    }
    for (const [key, button] of this.buttons) {
      const [field, value] = key.split(":");
      if (value || ["trailGlow", "trailColor", "guides"].includes(field))
        button.setAttribute(
          "aria-pressed",
          String(value ? values[field] === value : Boolean(values[field])),
        );
    }
    const exposure = this.fields.get("trailExposureOutput");
    if (exposure)
      exposure.value =
        values.trailExposure < 1
          ? `${values.trailExposure * 60} ${this.copy.minute}`
          : `${values.trailExposure} ${this.copy.hour}`;
    if (exposure)
      this.fields.get("trailExposure").setAttribute("aria-valuetext", exposure.value);
    const phase = this.fields.get("phaseOutput");
    if (phase)
      phase.value = `${Math.round(phaseIllumination(values.phase) * 100)}% ${this.copy.illuminated}`;
    if (phase)
      this.fields.get("phase").setAttribute("aria-valuetext", phase.value);
    const alignment = this.fields.get("alignmentOutput");
    if (alignment)
      alignment.value =
        Math.abs(values.alignment) < 0.03
          ? "⊙"
          : `${Math.round(values.alignment * 100)}%`;
    if (alignment)
      this.fields.get("alignment").setAttribute(
        "aria-valuetext",
        Math.abs(values.alignment) < 0.03 ? this.copy.align : alignment.value,
      );
    const play = this.buttons.get("play");
    if (play) {
      const playing =
        this.mode === "trails" ? values.trailPlaying : values.lunarPlaying;
      play.textContent = playing ? "Ⅱ" : "▷";
      play.title =
        this.copy[
          playing ? "pause" : this.mode === "trails" ? "expose" : "play"
        ];
      play.setAttribute("aria-label", play.title);
      play.setAttribute("aria-pressed", String(playing));
    }
  }
}
