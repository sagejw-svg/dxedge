(() => {
  const API_BASE = (location.pathname.includes('/forever-zoom') ? '/api/forever-zoom' : '/api');
  const SIZE = 1024;
  const ZOOM_FACTOR = 2.4;
  const PREP_ZOOM = 1.85; // visual zoom before swap

  const view = document.getElementById("view");
  const fx = document.getElementById("fx");
  const vctx = view.getContext("2d", { willReadFrequently: true });
  const fctx = fx.getContext("2d");
  const stage = document.getElementById("stage");
  const crosshair = document.getElementById("crosshair");
  const logEl = document.getElementById("log");
  const toast = document.getElementById("toast");
  const statusBadge = document.getElementById("statusBadge");
  const themeBadge = document.getElementById("themeBadge");
  const hudDepth = document.getElementById("hudDepth");
  const hudCost = document.getElementById("hudCost");
  const modeSelect = document.getElementById("modeSelect");

  const state = {
    themes: [],
    themeIndex: 0,
    depth: 0,
    spent: 0,
    focus: { x: 0.5, y: 0.5 },
    busy: false,
    falOk: false,
    engine: "none", // ai | procedural
    journey: { version: 1, startedAt: null, steps: [] },
    recording: false,
    mediaRecorder: null,
    chunks: [],
    seed: Math.floor(Math.random() * 1e9),
  };

  function log(msg) {
    const t = new Date().toLocaleTimeString();
    logEl.textContent = `[${t}] ${msg}`;
  }
  function showToast(msg, ms = 2800) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove("show"), ms);
  }
  function setBusy(b) {
    state.busy = b;
    document.getElementById("btnZoom").disabled = b || state.depth < 0;
    document.getElementById("btnPng").disabled = !view.width;
    document.getElementById("btnVideo").disabled = !view.width;
    document.getElementById("btnJson").disabled = state.journey.steps.length === 0;
    document.getElementById("btnStart").disabled = b;
  }
  function updateHud() {
    const theme = state.themes[state.themeIndex] || { label: "—" };
    themeBadge.textContent = theme.label || theme.id || "—";
    hudDepth.textContent = `Depth ${state.depth} · ${state.engine}`;
    hudCost.textContent = `$${state.spent.toFixed(3)} spent (approx)`;
  }

  function canvasToDataUrl(c, type = "image/png", quality) {
    return c.toDataURL(type, quality);
  }

  function cropCenterDataUrl(normX, normY, scale = ZOOM_FACTOR) {
    const sw = Math.floor(SIZE / scale);
    const sh = sw;
    const sx = Math.max(0, Math.min(SIZE - sw, Math.floor(normX * SIZE - sw / 2)));
    const sy = Math.max(0, Math.min(SIZE - sh, Math.floor(normY * SIZE - sh / 2)));
    const tmp = document.createElement("canvas");
    tmp.width = SIZE;
    tmp.height = SIZE;
    const t = tmp.getContext("2d");
    t.imageSmoothingEnabled = true;
    t.imageSmoothingQuality = "high";
    t.drawImage(view, sx, sy, sw, sh, 0, 0, SIZE, SIZE);
    return { dataUrl: tmp.toDataURL("image/png"), sx, sy, sw, sh };
  }

  async function animateZoom(normX, normY, duration = 900) {
    return new Promise((resolve) => {
      const start = performance.now();
      const from = 1;
      const to = PREP_ZOOM;
      function frame(now) {
        const t = Math.min(1, (now - start) / duration);
        const e = 1 - Math.pow(1 - t, 3);
        const z = from + (to - from) * e;
        // draw zoomed view into fx overlay
        fctx.clearRect(0, 0, SIZE, SIZE);
        const sw = SIZE / z;
        const sh = sw;
        const sx = normX * SIZE - sw / 2;
        const sy = normY * SIZE - sh / 2;
        fctx.drawImage(view, sx, sy, sw, sh, 0, 0, SIZE, SIZE);
        fx.classList.add("show");
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
  }

  function drawImageUrl(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        vctx.clearRect(0, 0, SIZE, SIZE);
        vctx.drawImage(img, 0, 0, SIZE, SIZE);
        fx.classList.remove("show");
        fctx.clearRect(0, 0, SIZE, SIZE);
        resolve();
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  async function fetchHealth() {
    try {
      const r = await fetch(`${API_BASE}/health`);
      const j = await r.json();
      state.falOk = !!j.fal;
      statusBadge.textContent = j.fal ? "fal ready" : "procedural only";
      statusBadge.className = "badge " + (j.fal ? "ok" : "warn");
      if (j.cost) {
        log(`AI t2i ~$${j.cost.t2i_usd_approx}/step, img2img ~$${j.cost.img2img_usd_approx}/step`);
      }
      return j;
    } catch (e) {
      statusBadge.textContent = "offline proxy";
      statusBadge.className = "badge err";
      state.falOk = false;
      return null;
    }
  }

  async function loadThemes() {
    try {
      const r = await fetch(`${API_BASE}/themes`);
      const j = await r.json();
      state.themes = j.themes || [];
    } catch {
      state.themes = [
        { id: "desk", label: "Desk" },
        { id: "fields", label: "Fields" },
        { id: "plants", label: "Plants" },
        { id: "cells", label: "Cells" },
        { id: "cosmos", label: "Cosmos" },
      ];
    }
  }

  function wantAi() {
    const m = modeSelect.value;
    if (m === "procedural") return false;
    if (m === "ai") return true;
    return state.falOk; // auto
  }

  async function generateAi(mode, themeIndex, imageDataUrl) {
    const body = {
      mode,
      theme_index: themeIndex,
      strength: 0.7,
      seed: state.seed + themeIndex * 17 + state.depth,
      image_data_url: imageDataUrl || null,
    };
    const r = await fetch(`${API_BASE}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const err = new Error(j.detail || r.statusText || "generate failed");
      err.status = r.status;
      err.payload = j;
      throw err;
    }
    return j;
  }

  function generateProcedural(themeIndex) {
    const off = document.createElement("canvas");
    off.width = SIZE;
    off.height = SIZE;
    const meta = ProceduralZoom.render(off, themeIndex, state.seed + state.depth * 99, state.focus);
    return {
      ok: true,
      theme: { id: meta.theme.id, label: meta.theme.id[0].toUpperCase() + meta.theme.id.slice(1) },
      theme_index: themeIndex,
      image_data_url: off.toDataURL("image/png"),
      cost_usd_approx: 0,
      model: "procedural",
      engine: "procedural",
    };
  }

  async function startJourney() {
    setBusy(true);
    state.depth = 0;
    state.themeIndex = 0;
    state.spent = 0;
    state.seed = Math.floor(Math.random() * 1e9);
    state.focus = { x: 0.5, y: 0.5 };
    state.journey = {
      version: 1,
      startedAt: new Date().toISOString(),
      seed: state.seed,
      steps: [],
    };
    crosshair.style.left = "50%";
    crosshair.style.top = "50%";
    log("Starting journey…");
    try {
      let result;
      if (wantAi()) {
        try {
          result = await generateAi("t2i", 0, null);
          state.engine = "ai";
        } catch (e) {
          if (modeSelect.value === "ai") throw e;
          log(`AI unavailable (${e.message}); procedural fallback`);
          showToast("fal unavailable — using procedural");
          result = generateProcedural(0);
          state.engine = "procedural";
          state.falOk = false;
          statusBadge.textContent = "procedural fallback";
          statusBadge.className = "badge warn";
        }
      } else {
        result = generateProcedural(0);
        state.engine = "procedural";
      }
      await drawImageUrl(result.image_data_url);
      state.themeIndex = result.theme_index || 0;
      state.spent += result.cost_usd_approx || 0;
      state.journey.steps.push({
        depth: 0,
        themeIndex: state.themeIndex,
        themeId: (result.theme && result.theme.id) || "desk",
        focus: { ...state.focus },
        engine: state.engine,
        model: result.model,
        cost_usd_approx: result.cost_usd_approx || 0,
        image_data_url: result.image_data_url,
        at: new Date().toISOString(),
      });
      updateHud();
      log(`Scene: ${(result.theme && result.theme.label) || "desk"} via ${state.engine}`);
      document.getElementById("btnZoom").disabled = false;
      document.getElementById("btnPng").disabled = false;
      document.getElementById("btnVideo").disabled = false;
      document.getElementById("btnJson").disabled = false;
    } catch (e) {
      showToast(String(e.message || e));
      log(`Start failed: ${e.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  async function zoomIn() {
    if (state.busy || state.journey.steps.length === 0) return;
    setBusy(true);
    const focus = { ...state.focus };
    log(`Zooming into (${focus.x.toFixed(2)}, ${focus.y.toFixed(2)})…`);
    try {
      await animateZoom(focus.x, focus.y);
      const crop = cropCenterDataUrl(focus.x, focus.y, ZOOM_FACTOR);
      const nextTheme = (state.themeIndex + 1) % Math.max(1, state.themes.length || 5);
      let result;
      if (wantAi() && state.engine !== "forced-procedural") {
        try {
          result = await generateAi("img2img", nextTheme, crop.dataUrl);
          state.engine = "ai";
        } catch (e) {
          if (modeSelect.value === "ai") throw e;
          log(`AI step failed (${e.message}); procedural`);
          showToast("AI step failed — procedural");
          result = generateProcedural(nextTheme);
          state.engine = "procedural";
          if (e.status === 402) {
            state.falOk = false;
            statusBadge.textContent = "credits out";
            statusBadge.className = "badge err";
          }
        }
      } else {
        result = generateProcedural(nextTheme);
        state.engine = "procedural";
      }
      await drawImageUrl(result.image_data_url);
      state.themeIndex = result.theme_index != null ? result.theme_index : nextTheme;
      state.depth += 1;
      state.spent += result.cost_usd_approx || 0;
      state.journey.steps.push({
        depth: state.depth,
        themeIndex: state.themeIndex,
        themeId: (result.theme && result.theme.id) || String(state.themeIndex),
        focus,
        engine: state.engine,
        model: result.model,
        cost_usd_approx: result.cost_usd_approx || 0,
        image_data_url: result.image_data_url,
        at: new Date().toISOString(),
      });
      updateHud();
      log(`Depth ${state.depth}: ${(result.theme && (result.theme.label || result.theme.id)) || nextTheme}`);
    } catch (e) {
      fx.classList.remove("show");
      showToast(String(e.message || e));
      log(`Zoom failed: ${e.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  function savePng() {
    const a = document.createElement("a");
    a.href = canvasToDataUrl(view);
    a.download = `forever-zoom-depth-${state.depth}.png`;
    a.click();
    log("PNG saved");
  }

  function saveJson() {
    // Store journey without giant duplicates optionally — keep images for replay
    const blob = new Blob([JSON.stringify(state.journey, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `forever-zoom-journey-${Date.now()}.json`;
    a.click();
    log(`Journey JSON saved (${state.journey.steps.length} steps)`);
  }

  async function toggleRecord() {
    if (state.recording) {
      state.mediaRecorder.stop();
      return;
    }
    const stream = view.captureStream(30);
    const chunks = [];
    let recorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
    } catch {
      recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    }
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      state.recording = false;
      document.getElementById("btnVideo").textContent = "Record WebM";
      const blob = new Blob(chunks, { type: "video/webm" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `forever-zoom-${Date.now()}.webm`;
      a.click();
      log("WebM saved");
    };
    state.mediaRecorder = recorder;
    state.chunks = chunks;
    state.recording = true;
    document.getElementById("btnVideo").textContent = "Stop recording";
    recorder.start(200);
    log("Recording WebM… zoom around, then Stop");
    showToast("Recording — zoom, then Stop recording");
  }

  async function replayJourney(data) {
    if (!data || !data.steps || !data.steps.length) {
      showToast("Invalid journey file");
      return;
    }
    setBusy(true);
    state.journey = data;
    state.seed = data.seed || state.seed;
    state.spent = data.steps.reduce((s, x) => s + (x.cost_usd_approx || 0), 0);
    for (let i = 0; i < data.steps.length; i++) {
      const step = data.steps[i];
      state.depth = step.depth;
      state.themeIndex = step.themeIndex;
      state.focus = step.focus || { x: 0.5, y: 0.5 };
      state.engine = step.engine || "replay";
      crosshair.style.left = `${(state.focus.x * 100).toFixed(2)}%`;
      crosshair.style.top = `${(state.focus.y * 100).toFixed(2)}%`;
      if (step.image_data_url) {
        if (i > 0) await animateZoom(state.focus.x, state.focus.y, 700);
        await drawImageUrl(step.image_data_url);
      }
      updateHud();
      await new Promise((r) => setTimeout(r, 350));
    }
    document.getElementById("btnZoom").disabled = false;
    document.getElementById("btnPng").disabled = false;
    document.getElementById("btnVideo").disabled = false;
    document.getElementById("btnJson").disabled = false;
    setBusy(false);
    log(`Replayed ${data.steps.length} steps`);
  }

  function pointerToNorm(ev) {
    const rect = stage.getBoundingClientRect();
    const x = (ev.clientX - rect.left) / rect.width;
    const y = (ev.clientY - rect.top) / rect.height;
    return {
      x: Math.max(0.05, Math.min(0.95, x)),
      y: Math.max(0.05, Math.min(0.95, y)),
    };
  }

  stage.addEventListener("pointerdown", (ev) => {
    const n = pointerToNorm(ev);
    state.focus = n;
    crosshair.style.left = `${n.x * 100}%`;
    crosshair.style.top = `${n.y * 100}%`;
  });
  stage.addEventListener("wheel", (ev) => {
    ev.preventDefault();
    if (ev.deltaY > 0) return;
    zoomIn();
  }, { passive: false });

  document.getElementById("btnStart").onclick = startJourney;
  document.getElementById("btnZoom").onclick = zoomIn;
  document.getElementById("btnPng").onclick = savePng;
  document.getElementById("btnVideo").onclick = toggleRecord;
  document.getElementById("btnJson").onclick = saveJson;
  document.getElementById("loadJson").onchange = async (ev) => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    try {
      const text = await f.text();
      await replayJourney(JSON.parse(text));
    } catch (e) {
      showToast("Could not load journey JSON");
    }
    ev.target.value = "";
  };

  (async function init() {
    await loadThemes();
    await fetchHealth();
    updateHud();
    // procedural preview so the page isn't blank
    const preview = generateProcedural(0);
    await drawImageUrl(preview.image_data_url);
    state.engine = "preview";
    log("Ready — click New journey");
  })();
})();
