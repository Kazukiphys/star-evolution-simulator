const massRange = document.getElementById("massRange");
const massNumber = document.getElementById("massNumber");
const massOutput = document.getElementById("massOutput");
const fateName = document.getElementById("fateName");
const fateDetail = document.getElementById("fateDetail");
const remnantChip = document.getElementById("remnantChip");
const timeline = document.getElementById("timeline");
const lifetimeText = document.getElementById("lifetimeText");
const starVisual = document.getElementById("starVisual");
const playButton = document.getElementById("playButton");
const pauseButton = document.getElementById("pauseButton");
const speedSelect = document.getElementById("speedSelect");
const phaseText = document.getElementById("phaseText");
const seekBar = document.getElementById("seekBar");
const seekStageLabel = document.getElementById("seekStageLabel");
const timeOverlay = document.getElementById("timeOverlay");
const hrGrid = document.getElementById("hrGrid");
const hrReferenceStars = document.getElementById("hrReferenceStars");
const hrTrackFull = document.getElementById("hrTrackFull");
const hrTrackProgress = document.getElementById("hrTrackProgress");
const hrCurrentPoint = document.getElementById("hrCurrentPoint");
const hrPointStage = document.getElementById("hrPointStage");
const hrCaption = document.getElementById("hrCaption");

let currentData = null;
let stageIndex = -1;
let isPlaying = false;
let animationTimer = null;

const HR_BOUNDS = {
  left: 62,
  right: 612,
  top: 28,
  bottom: 314,
  minTemp: 2500,
  maxTemp: 50000,
  minLum: 1e-5,
  maxLum: 1e6
};

const REAL_STARS = [
  { name: "太陽", temp: 5778, lum: 1 },
  { name: "シリウスA", temp: 9940, lum: 25.4 },
  { name: "プロキオンA", temp: 6530, lum: 6.9 },
  { name: "ベガ", temp: 9600, lum: 40.1 },
  { name: "リゲル", temp: 12100, lum: 120000 },
  { name: "ベテルギウス", temp: 3500, lum: 126000 },
  { name: "プロキシマ・ケンタウリ", temp: 3042, lum: 0.0017 },
  { name: "シリウスB", temp: 25200, lum: 0.026 }
];

function toLog10(value) {
  return Math.log(value) / Math.log(10);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hrToCanvasPoint(temperature, luminosity) {
  const temp = clamp(temperature, HR_BOUNDS.minTemp, HR_BOUNDS.maxTemp);
  const lum = clamp(luminosity, HR_BOUNDS.minLum, HR_BOUNDS.maxLum);

  const tMin = toLog10(HR_BOUNDS.minTemp);
  const tMax = toLog10(HR_BOUNDS.maxTemp);
  const lMin = toLog10(HR_BOUNDS.minLum);
  const lMax = toLog10(HR_BOUNDS.maxLum);

  const tx = (toLog10(temp) - tMin) / (tMax - tMin);
  const ly = (toLog10(lum) - lMin) / (lMax - lMin);

  return {
    x: HR_BOUNDS.right - tx * (HR_BOUNDS.right - HR_BOUNDS.left),
    y: HR_BOUNDS.bottom - ly * (HR_BOUNDS.bottom - HR_BOUNDS.top)
  };
}

function inferHrStateForStage(phase, mass, mainTemp, mainLum, fate) {
  if (phase.includes("ガス雲")) {
    return { temp: 2800, lum: Math.max(0.02, mainLum * 0.03) };
  }

  if (phase.includes("主系列")) {
    return { temp: mainTemp, lum: mainLum };
  }

  if (phase.includes("赤色巨星")) {
    return { temp: 3800, lum: Math.max(90, mainLum * 120) };
  }

  if (phase.includes("超巨星")) {
    return { temp: 4500, lum: Math.max(3e4, mainLum * 220) };
  }

  if (phase.includes("惑星状星雲")) {
    return { temp: 42000, lum: Math.max(1200, mainLum * 40) };
  }

  if (phase.includes("白色矮星")) {
    return { temp: 22000, lum: 0.01 };
  }

  if (phase.includes("重力崩壊型超新星") || phase.includes("超新星")) {
    return { temp: 30000, lum: Math.max(1e5, mainLum * 300) };
  }

  if (phase.includes("中性子星")) {
    return { temp: 50000, lum: 0.001 };
  }

  if (phase.includes("ブラックホール") || fate === "ブラックホール") {
    return { temp: 45000, lum: 0.00005 };
  }

  if (phase.includes("褐色矮星")) {
    return { temp: 2600, lum: Math.max(1e-5, 0.00012 * Math.max(mass, 0.08)) };
  }

  return { temp: mainTemp, lum: mainLum };
}

function buildHrTrack(data, mass) {
  const safeMass = Math.max(0.08, mass);
  const mainTemp = clamp(5800 * Math.pow(safeMass, 0.52), 2600, 42000);
  const mainLum = Math.max(0.00005, Math.pow(safeMass, 3.5));

  return data.stages.map((stage) => {
    const state = inferHrStateForStage(stage.phase, safeMass, mainTemp, mainLum, data.fate);
    const point = hrToCanvasPoint(state.temp, state.lum);
    return {
      ...state,
      ...point,
      phase: stage.phase
    };
  });
}

function pointsToPolyline(points) {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
}

function setMathLuminosityLabel(label, lum) {
  label.textContent = "";

  const exponent = Math.round(toLog10(lum));
  const base = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
  base.setAttribute("class", "math-font");
  base.textContent = "10";

  const sup = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
  sup.setAttribute("class", "math-font exp-sup");
  sup.setAttribute("dy", "-4");
  sup.textContent = `${exponent}`;

  label.append(base, sup);
}

function renderHrGrid() {
  if (hrGrid.childElementCount > 0) {
    return;
  }

  const tempTicks = [40000, 20000, 10000, 5000, 3000];
  const lumTicks = [1e5, 1e3, 10, 1, 0.01, 1e-4];

  tempTicks.forEach((temp) => {
    const point = hrToCanvasPoint(temp, 1);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(point.x));
    line.setAttribute("x2", String(point.x));
    line.setAttribute("y1", String(HR_BOUNDS.top));
    line.setAttribute("y2", String(HR_BOUNDS.bottom));
    line.setAttribute("class", "hr-grid-line");

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", String(point.x - 16));
    label.setAttribute("y", String(HR_BOUNDS.bottom + 16));
    label.setAttribute("class", "hr-grid-label");
    label.textContent = `${temp}`;

    hrGrid.append(line, label);
  });

  lumTicks.forEach((lum) => {
    const point = hrToCanvasPoint(6000, lum);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(HR_BOUNDS.left));
    line.setAttribute("x2", String(HR_BOUNDS.right));
    line.setAttribute("y1", String(point.y));
    line.setAttribute("y2", String(point.y));
    line.setAttribute("class", "hr-grid-line");

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", "22");
    label.setAttribute("y", String(point.y + 4));
    label.setAttribute("class", "hr-grid-label");
    setMathLuminosityLabel(label, lum);

    hrGrid.append(line, label);
  });
}

function renderHrReferenceStars() {
  if (!hrReferenceStars) {
    return;
  }

  hrReferenceStars.innerHTML = "";

  REAL_STARS.forEach((star) => {
    const point = hrToCanvasPoint(star.temp, star.lum);

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", point.x.toFixed(2));
    circle.setAttribute("cy", point.y.toFixed(2));
    circle.setAttribute("r", "4.2");
    circle.setAttribute("class", "hr-ref-point");

    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = `${star.name}（${Math.round(star.temp)} K, ${star.lum} Lsun）`;
    circle.appendChild(title);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", (point.x + 6).toFixed(2));
    label.setAttribute("y", (point.y - 6).toFixed(2));
    label.setAttribute("class", "hr-ref-label");
    label.textContent = star.name;

    hrReferenceStars.append(circle, label);
  });
}

function updateHrDiagram(activeIndex) {
  if (!currentData || !Array.isArray(currentData.hrTrack) || currentData.hrTrack.length === 0) {
    hrTrackFull.setAttribute("points", "");
    hrTrackProgress.setAttribute("points", "");
    hrCurrentPoint.setAttribute("cx", "-40");
    hrCurrentPoint.setAttribute("cy", "-40");
    hrPointStage.setAttribute("x", "-40");
    hrPointStage.setAttribute("y", "-40");
    hrCaption.textContent = "再生すると，HR図上の点が進化に合わせて移動します。";
    return;
  }

  hrTrackFull.setAttribute("points", pointsToPolyline(currentData.hrTrack));

  if (activeIndex < 0) {
    hrTrackProgress.setAttribute("points", "");
    hrCurrentPoint.setAttribute("cx", "-40");
    hrCurrentPoint.setAttribute("cy", "-40");
    hrPointStage.setAttribute("x", "-40");
    hrPointStage.setAttribute("y", "-40");
    hrCaption.textContent = "再生すると，HR図上の点が進化に合わせて移動します。";
    return;
  }

  const safeIndex = Math.max(0, Math.min(activeIndex, currentData.hrTrack.length - 1));
  const progress = currentData.hrTrack.slice(0, safeIndex + 1);
  const currentPoint = currentData.hrTrack[safeIndex];

  hrTrackProgress.setAttribute("points", pointsToPolyline(progress));
  hrCurrentPoint.setAttribute("cx", String(currentPoint.x));
  hrCurrentPoint.setAttribute("cy", String(currentPoint.y));
  hrPointStage.setAttribute("x", String(currentPoint.x + 10));
  hrPointStage.setAttribute("y", String(currentPoint.y - 10));
  hrPointStage.textContent = currentPoint.phase;

  const tempText = `${Math.round(currentPoint.temp)} K`;
  const lumText = currentPoint.lum >= 1
    ? `${currentPoint.lum.toFixed(1)} Lsun`
    : `${currentPoint.lum.toExponential(1)} Lsun`;

  hrCaption.textContent = `現在位置: ${currentPoint.phase}（温度 ${tempText}，光度 ${lumText}）`;
}

function buildStageTimings(stages, totalYears, weights) {
  const safeWeights = Array.isArray(weights) && weights.length === stages.length
    ? weights
    : stages.map(() => 1 / stages.length);

  const weightSum = safeWeights.reduce((sum, value) => sum + value, 0) || 1;
  const normalized = safeWeights.map((value) => value / weightSum);

  const stageYears = normalized.map((ratio) => totalYears * ratio);
  const cumulativeYears = [];
  let elapsed = 0;

  for (const years of stageYears) {
    elapsed += years;
    cumulativeYears.push(elapsed);
  }

  return { stageYears, cumulativeYears, totalYears };
}

function clampMass(value) {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(0.1, Math.min(60, value));
}

function formatYears(years) {
  if (years >= 1e8) {
    return `${(years / 1e8).toFixed(2)} 億年`;
  }
  if (years >= 1e4) {
    return `${(years / 1e4).toFixed(2)} 万年`;
  }
  return `${Math.round(years)} 年`;
}

function mainSequenceYears(mass) {
  if (mass < 0.5) {
    return 600e9;
  }
  return 10e9 * Math.pow(mass, -2.5);
}

function classifyEvolution(mass) {
  const msLife = mainSequenceYears(mass);

  if (mass < 0.08) {
    const stages = [
      { phase: "ガス雲の収縮", note: "重力で収縮して原始星になります。" },
      { phase: "褐色矮星", note: "水素核融合が継続せず，低温で暗い天体として残ります。" }
    ];
    const timings = buildStageTimings(stages, msLife, [0.02, 0.98]);

    return {
      fate: "褐色矮星",
      detail: "核融合を安定的に続けられず，長い時間をかけてゆっくり冷えていきます。",
      remnant: `${mass.toFixed(2)} 太陽質量程度`,
      accent: "#ad8f69",
      visual: "radial-gradient(circle at 35% 30%, #ffe9bb 0%, #bc7c38 40%, #4f2b13 100%)",
      lifetime: `主系列に入らないため，${formatYears(msLife)}を超える長い時間で冷却`,
      stages,
      ...timings
    };
  }

  if (mass < 8) {
    const remnantMass = Math.min(1.35, 0.45 + 0.15 * Math.sqrt(mass));
    const stages = [
      { phase: "主系列星", note: `中心で水素を核融合（約 ${formatYears(msLife)}）` },
      { phase: "赤色巨星", note: "中心の水素を使い切り，外層が大きく膨張します。" },
      { phase: "惑星状星雲", note: "外層ガスを宇宙へ放出します。" },
      { phase: "白色矮星", note: "中心核が残り，時間とともに冷えていきます。" }
    ];
    const timings = buildStageTimings(stages, msLife * 1.15, [0.88, 0.09, 0.02, 0.01]);

    return {
      fate: "白色矮星",
      detail: "外層を放出したあと，中心核が地球サイズの高密度天体として残ります。",
      remnant: `${remnantMass.toFixed(2)} 太陽質量程度`,
      accent: "#ffcf66",
      visual: "radial-gradient(circle at 35% 30%, #fffcec 0%, #ffe5a4 45%, #d89c36 100%)",
      lifetime: `主系列星としての寿命: 約 ${formatYears(msLife)}`,
      stages,
      ...timings
    };
  }

  if (mass < 20) {
    const stages = [
      { phase: "大質量主系列星", note: `急速に核融合して進化（約 ${formatYears(msLife)}）` },
      { phase: "超巨星", note: "中心で重元素まで核融合が進みます。" },
      { phase: "重力崩壊型超新星", note: "鉄の核が崩壊し，大爆発が起きます。" },
      { phase: "中性子星", note: "強磁場・高速自転を持つことがあります（パルサー）。" }
    ];
    const timings = buildStageTimings(stages, msLife * 1.08, [0.93, 0.05, 0.015, 0.005]);

    return {
      fate: "中性子星",
      detail: "超新星爆発のあと，原子核レベルまで圧縮された高密度天体が残ります。",
      remnant: "約 1.2 - 2.1 太陽質量",
      accent: "#7fd6ff",
      visual: "radial-gradient(circle at 35% 30%, #d7f7ff 0%, #79d7ff 40%, #2164a1 100%)",
      lifetime: `主系列星としての寿命: 約 ${formatYears(msLife)}（短命）`,
      stages,
      ...timings
    };
  }

  const stages = [
    { phase: "超大質量主系列星", note: `強烈な核融合で短時間で進化（約 ${formatYears(msLife)}）` },
    { phase: "超巨星", note: "中心核が不安定になり，崩壊準備に入ります。" },
    { phase: "超新星 / 直接崩壊", note: "質量が大きいと爆発が弱く，直接崩壊する場合もあります。" },
    { phase: "ブラックホール", note: "事象の地平面を持つコンパクト天体として残ります。" }
  ];
  const timings = buildStageTimings(stages, msLife * 1.05, [0.94, 0.04, 0.015, 0.005]);

  return {
    fate: "ブラックホール",
    detail: "超新星後に重力崩壊が進み，光さえ脱出できない天体になります。",
    remnant: "数太陽質量以上",
    accent: "#ff795e",
    visual: "radial-gradient(circle at 42% 35%, #757575 0%, #2c2c2c 18%, #000 45%, #ff7145 70%, #2a0d08 100%)",
    lifetime: `主系列星としての寿命: 約 ${formatYears(msLife)}（非常に短命）`,
    stages,
    ...timings
  };
}

function formatElapsedLabel(years) {
  return `経過時間: 約 ${formatYears(Math.max(0, years))}`;
}

function updateSeekControls(index) {
  if (!currentData) {
    seekBar.min = "-1";
    seekBar.max = "0";
    seekBar.value = "-1";
    seekStageLabel.value = "未開始";
    return;
  }

  seekBar.min = "-1";
  seekBar.max = String(currentData.stages.length - 1);
  seekBar.value = String(index);

  if (index < 0) {
    seekStageLabel.value = "未開始";
  } else {
    const stage = currentData.stages[index];
    seekStageLabel.value = `${index + 1}/${currentData.stages.length}: ${stage.phase}`;
  }
}

function applyDefaultVisual(data) {
  starVisual.style.background = data.visual;
  starVisual.style.transform = "scale(1)";
  starVisual.style.filter = "brightness(1)";
  starVisual.style.boxShadow = "0 0 26px 10px color-mix(in srgb, var(--accent) 45%, transparent)";
}

function getStageVisual(data, index) {
  const stage = data.stages[index];
  const isFinal = index === data.stages.length - 1;

  if (isFinal) {
    return {
      background: data.visual,
      transform: "scale(0.98)",
      filter: "brightness(1.08)",
      boxShadow: "0 0 34px 12px color-mix(in srgb, var(--accent) 65%, transparent)"
    };
  }

  if (index === 0) {
    return {
      background: "radial-gradient(circle at 35% 30%, #f4e8cb 0%, #cf9f58 45%, #5e3a1f 100%)",
      transform: "scale(0.7)",
      filter: "brightness(0.9)",
      boxShadow: "0 0 18px 7px rgba(232, 167, 88, 0.5)"
    };
  }

  if (stage.phase.includes("赤色巨星") || stage.phase.includes("超巨星")) {
    return {
      background: "radial-gradient(circle at 35% 30%, #ffe3c5 0%, #ff9f61 40%, #8f2f17 100%)",
      transform: "scale(1.22)",
      filter: "brightness(1.15)",
      boxShadow: "0 0 34px 14px rgba(255, 136, 94, 0.62)"
    };
  }

  if (stage.phase.includes("超新星")) {
    return {
      background: "radial-gradient(circle at 50% 50%, #fffef2 0%, #ffe59f 28%, #ff9247 55%, #6e220f 100%)",
      transform: "scale(1.35)",
      filter: "brightness(1.28)",
      boxShadow: "0 0 46px 20px rgba(255, 187, 96, 0.7)"
    };
  }

  if (stage.phase.includes("惑星状星雲")) {
    return {
      background: "radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.9) 0%, rgba(178, 229, 255, 0.75) 32%, rgba(126, 195, 255, 0.25) 50%, rgba(126, 195, 255, 0) 62%)",
      transform: "scale(1.18)",
      filter: "brightness(1.12)",
      boxShadow: "0 0 30px 16px rgba(123, 202, 255, 0.45)"
    };
  }

  return {
    background: "radial-gradient(circle at 35% 30%, #fff9d2 0%, #ffd864 34%, #f39a34 60%, #71340a 100%)",
    transform: "scale(1)",
    filter: "brightness(1.05)",
    boxShadow: "0 0 26px 10px color-mix(in srgb, var(--accent) 45%, transparent)"
  };
}

function renderTimeline(stages) {
  timeline.innerHTML = "";
  stages.forEach((stage, index) => {
    const item = document.createElement("li");
    item.style.setProperty("--i", String(index + 1));

    const title = document.createElement("p");
    title.className = "phase";
    title.textContent = stage.phase;

    const note = document.createElement("p");
    note.className = "note";
    note.textContent = stage.note;

    item.append(title, note);
    timeline.appendChild(item);
  });
}

function updateTimelineHighlight(activeIndex) {
  const items = timeline.querySelectorAll("li");
  items.forEach((item, index) => {
    item.classList.toggle("done", index < activeIndex);
    item.classList.toggle("active", index === activeIndex);
  });
}

function updateControlState() {
  playButton.disabled = isPlaying || !currentData;
  pauseButton.disabled = !isPlaying;

  if (!currentData) {
    playButton.textContent = "進化を再生";
    return;
  }

  if (stageIndex >= currentData.stages.length - 1) {
    playButton.textContent = "もう一度再生";
  } else if (stageIndex >= 0) {
    playButton.textContent = "続きから再生";
  } else {
    playButton.textContent = "進化を再生";
  }
}

function stopAnimation() {
  if (animationTimer) {
    window.clearTimeout(animationTimer);
    animationTimer = null;
  }
  isPlaying = false;
  updateControlState();
}

function getStepDuration() {
  const value = Number(speedSelect.value);
  if (!Number.isFinite(value) || value < 300) {
    return 1300;
  }
  return value;
}

function applyStage(index) {
  const stage = currentData.stages[index];
  const visual = getStageVisual(currentData, index);

  starVisual.style.background = visual.background;
  starVisual.style.transform = visual.transform;
  starVisual.style.filter = visual.filter;
  starVisual.style.boxShadow = visual.boxShadow;

  phaseText.textContent = `現在: ${stage.phase} - ${stage.note}`;
  timeOverlay.textContent = formatElapsedLabel(currentData.cumulativeYears[index]);
  updateTimelineHighlight(index);
  updateSeekControls(index);
  updateHrDiagram(index);
}

function applyPreStageState() {
  applyDefaultVisual(currentData);
  phaseText.textContent = "再生すると，恒星の生成から最終形態まで順番に観察できます。";
  timeOverlay.textContent = formatElapsedLabel(0);
  updateTimelineHighlight(-1);
  updateSeekControls(-1);
  updateHrDiagram(-1);
}

function tickAnimation() {
  if (!isPlaying || !currentData) {
    return;
  }

  stageIndex += 1;
  applyStage(stageIndex);

  if (stageIndex >= currentData.stages.length - 1) {
    stopAnimation();
    phaseText.textContent = `観察完了: ${currentData.fate} になりました。`;
    return;
  }

  animationTimer = window.setTimeout(tickAnimation, getStepDuration());
}

function startAnimation() {
  if (!currentData) {
    return;
  }

  if (stageIndex >= currentData.stages.length - 1) {
    stageIndex = -1;
    updateTimelineHighlight(-1);
    updateSeekControls(-1);
  }

  if (isPlaying) {
    return;
  }

  isPlaying = true;
  updateControlState();
  tickAnimation();
}

function pulseVisual() {
  starVisual.classList.remove("pulse");
  void starVisual.offsetWidth;
  starVisual.classList.add("pulse");
}

function updateFromMass(rawMass, preserveNumberInput = false) {
  const mass = clampMass(rawMass);
  const data = classifyEvolution(mass);
  data.hrTrack = buildHrTrack(data, mass);

  stopAnimation();
  stageIndex = -1;
  currentData = data;

  massOutput.value = mass.toFixed(1);
  massRange.value = mass.toFixed(1);
  if (!preserveNumberInput) {
    massNumber.value = mass.toFixed(1);
  }

  fateName.textContent = data.fate;
  fateDetail.textContent = data.detail;
  remnantChip.textContent = `残骸質量: ${data.remnant}`;
  lifetimeText.textContent = data.lifetime;

  document.documentElement.style.setProperty("--accent", data.accent);

  renderTimeline(data.stages);
  applyPreStageState();
  updateControlState();
  pulseVisual();
}

massRange.addEventListener("input", (event) => {
  updateFromMass(Number(event.target.value));
});

massNumber.addEventListener("input", (event) => {
  const rawMass = event.target.value.trim();
  if (rawMass === "" || !Number.isFinite(Number(rawMass))) {
    return;
  }
  updateFromMass(Number(rawMass), true);
});

massNumber.addEventListener("change", (event) => {
  updateFromMass(Number(event.target.value));
});

playButton.addEventListener("click", () => {
  startAnimation();
});

pauseButton.addEventListener("click", () => {
  stopAnimation();
  if (currentData && stageIndex >= 0 && stageIndex < currentData.stages.length - 1) {
    phaseText.textContent = "一時停止中: 続きから再生できます。";
  }
});

speedSelect.addEventListener("change", () => {
  if (!isPlaying) {
    return;
  }
  window.clearTimeout(animationTimer);
  animationTimer = window.setTimeout(tickAnimation, getStepDuration());
});

seekBar.addEventListener("input", (event) => {
  if (!currentData) {
    return;
  }

  stopAnimation();

  const nextIndex = Math.max(-1, Math.min(currentData.stages.length - 1, Number(event.target.value)));
  stageIndex = nextIndex;

  if (nextIndex < 0) {
    applyPreStageState();
  } else {
    applyStage(nextIndex);
  }

  updateControlState();
});

updateFromMass(1);
renderHrGrid();
renderHrReferenceStars();
