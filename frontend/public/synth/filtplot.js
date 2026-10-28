// Filament filter response plot (0.2 roadmap item, 28 Oct 2026). Our own code.
//
// The curve is not a separate model of the filters. createFilterLab() evaluates voice.worklet.js on the
// page with stand-ins for the AudioWorklet globals it reads at construction (the processor base class,
// registerProcessor and sampleRate; currentFrame is only read in process(), which never runs here) and
// keeps one silent Filament processor. Its fresp() rings slot A, and slot B when it is on, with a small
// impulse through fresh filters at the 2x rate, using the same fcoef() and filter code the voices run.
// A Goertzel pass reads each impulse response at the plot's frequencies. Serial multiplies A and B,
// parallel sums them with their phases at the route's gains, split keeps them apart (A left, B right).
// The lab runs in a worker (filtplot.worker.js), off the audio thread and the page's main thread; the
// page draws with drawFilterPlot().

export const FP_LO = 20, FP_HI = 20000, FP_TOP = 24, FP_BOT = -48;
const N = 16384;                 // impulse response length at the 2x rate (about 0.17 s at 48 kHz)
const M = 160;                   // plot points, log spaced from FP_LO to FP_HI

export async function createFilterLab(sr, tubes, url) {
  const src = await (await fetch(url, { cache: 'no-cache' })).text();
  const reg = {};
  class Stub { constructor() { this.port = { postMessage() {}, onmessage: null }; } }
  // eslint-disable-next-line no-new-func
  new Function('AudioWorkletProcessor', 'registerProcessor', 'sampleRate', 'currentFrame', '"use strict";\n' + src)(
    Stub, (name, cls) => { reg[name] = cls; }, sr, 0);
  if (!reg.filament) throw new Error('filter lab: no Filament processor in the worklet');
  const proc = new reg.filament({ processorOptions: { tubes, patch: {} } });
  const fs = sr * 2, hA = new Float64Array(N), hB = new Float64Array(N);
  const f = new Float64Array(M), cw = new Float64Array(M), sw = new Float64Array(M);
  for (let i = 0; i < M; i++) {
    f[i] = FP_LO * Math.pow(FP_HI / FP_LO, i / (M - 1));
    const w = 2 * Math.PI * f[i] / fs; cw[i] = Math.cos(w); sw[i] = Math.sin(w);
  }
  const reA = new Float64Array(M), imA = new Float64Array(M), reB = new Float64Array(M), imB = new Float64Array(M);
  let patchJ = '';
  return {
    sr, f,
    setPatch(p) { const j = JSON.stringify(p); if (j === patchJ) return false; patchJ = j; proc.setPatch(JSON.parse(j)); return true; },
    // the response at cutoffs cutA and cutB (Hz, before the models' own calibrations, as the voices
    // compute them); dB arrays over f
    response(cutA, cutB) {
      const t0 = performance.now();
      const route = proc.fresp(hA, hB, N, cutA, cutB), gA = proc.frG[0], gB = proc.frG[1];
      const ringA = rings(hA), LA = effLen(hA, ringA, proc.frL[0]);
      goertzel(hA, LA, cw, sw, reA, imA);
      let ringB = false;
      if (route) { ringB = rings(hB); goertzel(hB, effLen(hB, ringB, proc.frL[1]), cw, sw, reB, imB); }
      const a = new Float64Array(M), b = route ? new Float64Array(M) : null, sum = new Float64Array(M);
      for (let i = 0; i < M; i++) {
        const ma = Math.hypot(reA[i], imA[i]);
        a[i] = db(ma);
        if (!route) { sum[i] = a[i]; continue; }
        const mb = Math.hypot(reB[i], imB[i]); b[i] = db(mb);
        if (route === 1) sum[i] = db(ma * mb);
        else if (route === 2) sum[i] = db(Math.hypot(gA * reA[i] + gB * reB[i], gA * imA[i] + gB * imB[i]));
        else sum[i] = a[i];                      // split: no sum; A is the left side
      }
      return { route, f, a, b, sum, ringA, ringB, cutA, cutB, ms: performance.now() - t0 };
    },
  };
}

function db(x) { return 20 * Math.log10(Math.max(x, 1e-12)); }
// A filter that is not decaying: the last eighth of the response holds a quarter of the first eighth's energy.
function rings(h) {
  const e = N >> 3; let a = 0, b = 0;
  for (let i = 0; i < e; i++) { a += h[i] * h[i]; b += h[N - e + i] * h[N - e + i]; }
  return a > 0 && b > 0.25 * a;
}
// The length past which the response stays under 1e-5 of its peak: the rest moves the curve by far less
// than a line's width over the plot's 72 dB. A filter that rings is read over half the response: its peak
// is off the top of the plot either way.
function effLen(h, ring, run) {
  let pk = 0; for (let i = 0; i < run; i++) { const v = h[i] < 0 ? -h[i] : h[i]; if (v > pk) pk = v; }
  const th = pk * 1e-5;
  let L = ring ? Math.min(run, N >> 1) : run; while (L > 64 && (h[L - 1] < 0 ? -h[L - 1] : h[L - 1]) < th) L--;
  return Math.min(N, L + 8);
}
// Goertzel at each frequency, with the phase restored so two responses can be summed:
// s_k = x_k + 2 cos(w) s_(k-1) - s_(k-2); X(w) = e^(-jw(L-1)) (s_(L-1) - e^(-jw) s_(L-2)).
// Four frequencies share each pass over the response: each one's recursion waits on its own last
// result, so running four side by side keeps the processor busy (measured about 3x faster).
function goertzel(h, L, cw, sw, re, im) {
  const n = cw.length, S = goertzel.s || (goertzel.s = new Float64Array(8));
  for (let i = 0; i < n; i += 4) {
    const k0 = 2 * cw[i], k1 = i + 1 < n ? 2 * cw[i + 1] : 0, k2 = i + 2 < n ? 2 * cw[i + 2] : 0, k3 = i + 3 < n ? 2 * cw[i + 3] : 0;
    let a1 = 0, a2 = 0, b1 = 0, b2 = 0, c1 = 0, c2 = 0, d1 = 0, d2 = 0;
    for (let j = 0; j < L; j++) {
      const x = h[j];
      const a0 = x + k0 * a1 - a2, b0 = x + k1 * b1 - b2, c0 = x + k2 * c1 - c2, d0 = x + k3 * d1 - d2;
      a2 = a1; a1 = a0; b2 = b1; b1 = b0; c2 = c1; c1 = c0; d2 = d1; d1 = d0;
    }
    S[0] = a1; S[1] = a2; S[2] = b1; S[3] = b2; S[4] = c1; S[5] = c2; S[6] = d1; S[7] = d2;
    for (let q = 0; q < 4 && i + q < n; q++) {
      const c = cw[i + q], sn = sw[i + q], s1 = S[2 * q], s2 = S[2 * q + 1];
      const yr = s1 - c * s2, yi = sn * s2;              // s_(L-1) - e^(-jw) s_(L-2)
      const w = Math.atan2(sn, c) * (L - 1), pr = Math.cos(w), pi = -Math.sin(w);
      re[i + q] = yr * pr - yi * pi; im[i + q] = yr * pi + yi * pr;
    }
  }
}

// ---- drawing ----
export function plotGeom(w, h) { const L = 30, R = 6, T = 8, B = 16; return { L, R, T, B, w, h, iw: w - L - R, ih: h - T - B }; }
export const fX = (f, G) => G.L + Math.log(f / FP_LO) / Math.log(FP_HI / FP_LO) * G.iw;
export const dY = (d, G) => G.T + (FP_TOP - d) / (FP_TOP - FP_BOT) * G.ih;
const GRID_F = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
const fmt = f => f >= 1000 ? (f / 1000) + 'k' : String(f);

// st: { knob, live (a response or null), liveMix 0..1, font }
export function drawFilterPlot(fc, st) {
  const c = fc.c, G = plotGeom(fc.w, fc.h);
  c.clearRect(0, 0, G.w, G.h);
  c.fillStyle = '#090909'; c.fillRect(G.L, G.T, G.iw, G.ih);
  c.font = '9px ' + (st.font || 'sans-serif'); c.lineWidth = 1;
  c.textAlign = 'right';
  for (let d = FP_TOP; d >= FP_BOT; d -= 12) {
    const y = Math.round(dY(d, G)) + 0.5;
    c.strokeStyle = d === 0 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.06)';
    c.setLineDash(d === 0 ? [4, 3] : []); c.beginPath(); c.moveTo(G.L, y); c.lineTo(G.L + G.iw, y); c.stroke();
    c.fillStyle = '#7c7c7c'; c.fillText((d > 0 ? '+' : '') + d, G.L - 5, y + 3);
  }
  c.setLineDash([]); c.textAlign = 'center';
  GRID_F.forEach(f => { const x = Math.round(fX(f, G)) + 0.5;
    c.strokeStyle = 'rgba(255,255,255,0.06)'; c.beginPath(); c.moveTo(x, G.T); c.lineTo(x, G.T + G.ih); c.stroke();
    c.fillStyle = '#7c7c7c'; c.fillText(fmt(f), x, G.h - 4); });
  c.textAlign = 'start';
  c.save(); c.beginPath(); c.rect(G.L, G.T - 1, G.iw, G.ih + 2); c.clip();
  const k = st.knob, lv = st.live, mix = lv ? st.liveMix : 0;
  if (k) {
    // the knobs at middle C: bright while nothing plays, a dim guide under a playing note
    curve(c, G, k, 'sum', mix > 0 ? 'rgba(170,170,170,' + (0.55 - 0.25 * mix) + ')' : 'rgba(255,200,120,0.95)', mix > 0 ? 1 : 2, mix > 0 ? 0 : 8, mix > 0 ? [3, 3] : []);
    if (k.route === 3) curve(c, G, k, 'b', mix > 0 ? 'rgba(140,170,190,' + (0.55 - 0.25 * mix) + ')' : 'rgba(130,200,255,0.95)', mix > 0 ? 1 : 2, mix > 0 ? 0 : 8, mix > 0 ? [3, 3] : []);
    else if ((k.route === 1 || k.route === 2) && !mix) { curve(c, G, k, 'a', 'rgba(255,200,120,0.28)', 1, 0, [2, 3]); curve(c, G, k, 'b', 'rgba(130,200,255,0.32)', 1, 0, [2, 3]); }
  }
  if (lv && mix > 0) {
    curve(c, G, lv, 'sum', 'rgba(255,200,120,' + (0.95 * mix) + ')', 2, 8, []);
    if (lv.route === 3) curve(c, G, lv, 'b', 'rgba(130,200,255,' + (0.95 * mix) + ')', 2, 8, []);
    // the live cutoff marks
    mark(c, G, lv.cutA, 'rgba(255,200,120,' + (0.6 * mix) + ')');
    if (lv.route) mark(c, G, lv.cutB, 'rgba(130,200,255,' + (0.6 * mix) + ')');
  } else if (k) {
    mark(c, G, k.cutA, 'rgba(255,200,120,0.35)');
    if (k.route) mark(c, G, k.cutB, 'rgba(130,200,255,0.35)');
  }
  c.restore();
}
function curve(c, G, r, key, col, lw, glow, dash) {
  const d = r[key]; if (!d) return;
  c.beginPath();
  for (let i = 0; i < d.length; i++) { const x = fX(r.f[i], G), y = dY(Math.max(FP_BOT - 6, Math.min(FP_TOP + 6, d[i])), G); if (i) c.lineTo(x, y); else c.moveTo(x, y); }
  c.strokeStyle = col; c.lineWidth = lw; c.setLineDash(dash); c.shadowColor = '#ffb347'; c.shadowBlur = glow; c.stroke(); c.shadowBlur = 0; c.setLineDash([]);
}
function mark(c, G, f, col) {
  if (!(f > 0)) return;
  const x = Math.round(fX(Math.max(FP_LO, Math.min(FP_HI, f)), G)) + 0.5;
  c.strokeStyle = col; c.lineWidth = 1; c.beginPath(); c.moveTo(x, G.T); c.lineTo(x, G.T + G.ih); c.stroke();
}

// the peak of a dB curve and where it is (Hz)
export function peakOf(r, key) { const d = r[key || 'sum']; let j = 0; for (let i = 1; i < d.length; i++) if (d[i] > d[j]) j = i; return { db: d[j], f: r.f[j] }; }
// a dB curve read at frequency hz (linear between the plot points, in log frequency)
export function dbAt(r, key, hz) {
  const d = r[key || 'sum'], f = r.f, n = f.length;
  if (hz <= f[0]) return d[0]; if (hz >= f[n - 1]) return d[n - 1];
  const x = Math.log(hz / f[0]) / Math.log(f[n - 1] / f[0]) * (n - 1), i = Math.floor(x), t = x - i;
  return d[i] + (d[i + 1] - d[i]) * t;
}
