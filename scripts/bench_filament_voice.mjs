#!/usr/bin/env node
// Filament voice bench: runs voice.worklet.js in Node, outside the browser, with Math.random seeded,
// so two versions of the engine can be compared sample for sample and by CPU time.
//
//   node scripts/bench_filament_voice.mjs                 this tree: CPU per case and an output hash
//   node scripts/bench_filament_voice.mjs --ref origin/main [--rounds 4] [--cases cathode|filament|c_plate,...]
//                                                         A/B against a git ref: CPU change per case,
//                                                         and whether the output is bit-identical
//   node scripts/bench_filament_voice.mjs --profile sk12 [--top 12]
//                                                         self time per function for one case, this tree
//   node scripts/bench_filament_voice.mjs --subnormals [--cases ...]
//                                                         every case on this tree: which state fields hold a
//                                                         subnormal at the end of a block (exit 3 if any)
//   --seconds N on any of these renders N seconds instead of 6 (20 or more for steady-state A/B work)
//
// What it measures: the Filament worklet alone (no rack, no browser), 6 s at 48 kHz in 128-frame
// blocks (--seconds to change it), process CPU time (user + system) per render, best of the rounds. Each render runs in a
// fresh child process so one version's JIT state never helps the other. The cases are test 9's
// (8 voices on each filter model, stereo offset, 16 voices), Sallen-Key 12 with its high-pass,
// Poly 24 screaming and driven, SVF 12 morphed, screaming and swept, and the low pass gate in two of its modes at 8 voices, plus wider coverage for the
// equivalence check: LFOs on everything, noise, sync, FM and ring, glide, high resonance, a still
// note with no drift, and patch changes mid-note (stereo offset on, loop tube, model, drive).
// The c_ cases run Cathode, the mono device in the same file, on factory patches (see C_CASES).
// Numbers are relative: headless Chrome in test 9 is the figure the log quotes.
import fs from 'fs'; import vm from 'vm'; import crypto from 'crypto'; import path from 'path';
import os from 'os'; import { spawnSync, execSync } from 'child_process'; import { fileURLToPath } from 'url';

const ME = fileURLToPath(import.meta.url), REPO = path.resolve(path.dirname(ME), '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };

const base = () => ({ osc1: { wave: 'saw', level: 0.8 }, osc2: { level: 0 }, sub: { level: 0 }, noise: { level: 0 },
  v1: { tube: '12AU7', drive: 0, bias: 0 }, drift: 0,
  filt: { model: 'valve12', cutoff: 20000, res: 0, keytrack: 0, env: 0, vel: 0, drive: 3, sag: 3 },
  envA: { a: 0.001, d: 0.1, s: 1, r: 0.01, vel: 0 }, envF: { a: 0.001, d: 0.1, s: 0, r: 0.1 },
  lfo1: { pitch: 0, cutoff: 0, pw: 0, amp: 0 }, voice: { mode: 'poly', count: 8, level: 0.8 },
  stereo: { pan: 'center', spread: 0 },
  out: { tube: '12AU7', topology: 'se', drive: 0, bias: 0, sag: 0, spkOn: false, roomOn: false, wOn: false } });
function big(model, extra) {    // test 9's patch
  const p = base(); Object.assign(p.osc2, { wave: 'pulse', level: 0.6, fine: 7 });
  Object.assign(p.sub, { level: 0.3 }); Object.assign(p.filt, { model, cutoff: 1500, res: 0.5 }); p.drift = 1.5;
  if (extra) extra(p); return p;
}
const CASES = {
  ladder24: big('ladder24'),
  valve12: big('valve12'),
  diode18: big('diode18'),
  sk12: big('sk12'),
  sk12hp: big('sk12', p => { p.filt.hp = 300; p.filt.res = 0.95; }),
  poly24: big('poly24'),
  poly24hot: big('poly24', p => { p.filt.res = 1; p.filt.drive = 9; p.v1.drive = 6; }),
  svf12: big('svf12'),
  svf12hot: big('svf12', p => { p.filt.morph = 1.4; p.filt.res = 1; p.filt.drive = 9; p.filt.offset = 0.4; p.lfo1 = { rate: 3, cutoff: 1, wave: 'tri' }; }),
  lpg: big('lpg', p => { p.envA = { a: 0.001, d: 0.2, s: 0.3, r: 0.4, vel: 0.6 }; p.filt.lag = 0.5; }),
  lpgmodes: big('lpg', p => { p.filt.gate = 'lp'; p.filt.res = 1; p.filt.offset = 0.4; p.envA = { a: 0.001, d: 0.1, s: 0, r: 0.1 }; p.filt.lag = 2; }),
  offset: big('valve12', p => { p.filt.offset = 0.5; }),
  uni16: big('valve12', p => { p.voice = { unison: 2, count: 8 }; }),
  lfo: big('valve12', p => { p.lfo1 = { rate: 4, pitch: 20, cutoff: 1, pw: 0.3, amp: 0.4, wave: 'tri' }; p.lfo2 = { rate: 0.7, cutoff: 0.5, pan: 0.5, phase: 90, wave: 'sh' }; p.noise = { level: 0.2, color: 'pink' }; }),
  sync: big('ladder24', p => { p.osc2.sync = true; p.osc2.semi = 7; p.filt.res = 0.95; p.osc1.wave = 'tri'; }),
  fm: big('valve12', p => { p.osc2 = { wave: 'sine', level: 0.5, fm: 0.5, ring: 0.3 }; p.filt.res = 0.97; p.voice.glide = 0.1; }),
  still: big('valve12', p => { p.drift = 0; p.filt.res = 0.8; }),
  // both envelopes at sustain 0 on 4 voices: notes released, struck again and stolen after the
  // envelopes have run down toward 0 (the ENV_FLOOR path; see voice.worklet.js)
  pluck: big('sk12', p => { p.envA = { a: 0.001, d: 0.3, s: 0, r: 0.5, vel: 0.5 }; p.envF = { a: 0.001, d: 0.2, s: 0, r: 0.3 };
    p.filt.env = 0.6; p.voice.count = 4; }),
  change: big('valve12', p => { p.drift = 0; }),
};
const EV = [48, 52, 55, 59, 60, 64, 67, 71].map(n => ({ at: 0, t: 'on', n, v: 0.8 }));
// Cathode (the mono device in the same worklet file): factory patches by name, a held line with glide,
// bends and the mod wheel. 'c_plate' is test 9's Cathode line; the rest cover each modulation path
// into the two filters (none, EG 2, MG, a patched audio-rate source, key tracking) and patch changes.
const C_CASES = {
  c_plate: 'Plate Screamer', c_init: 'Init', c_wind: 'Night Wind', c_growl: 'Growl FM', c_reed: 'Hollow Reed',
  c_trill: 'Trill Gate', c_kick: 'Filter Kick', c_change: 'Plate Screamer',
};
const C_EV = [{ at: 0, t: 'on', n: 60, v: 0.8 }, { at: 48000 * 1.5, t: 'on', n: 67, v: 0.7 }, { at: 48000 * 2, t: 'off', n: 67 },
  { at: 48000 * 2.5, t: 'bend', v: 0.4 }, { at: 48000 * 3, t: 'mw', v: 0.6 }, { at: 48000 * 3.5, t: 'bend', v: 0 },
  { at: 48000 * 4, t: 'off', n: 60 }, { at: 48000 * 4.2, t: 'on', n: 55, v: 0.9 }];

// one render of one case from one synth directory: { cpu (% of real time), hash }
async function one(dir, name) {
  const { normalize } = await import(path.join(dir, 'patches.js'));
  const { normalizeC, C_FACTORY } = await import(path.join(dir, 'cathode.js'));
  const { tubeData } = await import(path.join(dir, 'rack.js'));
  const procs = {};
  const ctx = { sampleRate: 48000, currentFrame: 0, console,
    AudioWorkletProcessor: class { constructor() { this.port = { postMessage() {}, onmessage: null }; } },
    registerProcessor: (n, c) => { procs[n] = c; } };
  vm.createContext(ctx);
  // seeded (mulberry32); imul comes in as a parameter for the same reason as the wrapper below
  vm.runInContext(`Math.random = ((a, imul) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = imul(a ^ a >>> 15, 1 | a);
    t = t + imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; })(12345, Math.imul)`, ctx);
  // The worklet runs inside a function here, not as a top-level script. A vm context's global object
  // is contextified (an interceptor sits in front of it), so as a top-level script every read of a
  // top-level function, class or const (tdx, DIO_B, SK_IP) and of a builtin (Math) is a slow lookup
  // that V8 cannot inline, on every call. Chrome's AudioWorkletGlobalScope has no interceptor, so the
  // bench used to blame any per-sample path that called one: measured 24 Oct, Diode 18's filter call
  // took 7x and Sallen-Key 12's 10x the time of Ladder 24's (which reads no globals), and about the
  // same as it once wrapped, which is what test 9 shows in headless Chrome. The builtins come in as
  // parameters; the per-block globals (sampleRate, currentFrame, registerProcessor) stay global.
  // lineOffset keeps profile line numbers on the file's own lines. The arithmetic is unchanged: every
  // case hashes the same either way.
  const G = ['Math', 'isFinite', 'NaN', 'Array', 'Object', 'JSON', 'Date', 'Set', 'Float32Array', 'Float64Array', 'Int32Array'];
  const src = fs.readFileSync(path.join(dir, 'voice.worklet.js'), 'utf8');
  vm.runInContext(`(function (${G.join(', ')}) {\n${src}\n})(${G.map(g => 'globalThis.' + g).join(', ')});`, ctx,
    { filename: 'voice.worklet.js', lineOffset: -1 });
  const events = EV.map(e => Object.assign({}, e));
  if (name === 'pluck') events.push({ at: 48000 * 2.5, t: 'off', n: 52 }, { at: 48000 * 2.5, t: 'off', n: 59 },
    { at: 48000 * 4, t: 'on', n: 62, v: 0.9 }, { at: 48000 * 4.5, t: 'on', n: 74, v: 0.5 }, { at: 48000 * 5, t: 'on', n: 76, v: 0.7 });
  if (name === 'lfo' || name === 'fm') events.push({ at: 48000 * 3, t: 'off', n: 60 }, { at: 48000 * 3.5, t: 'on', n: 62, v: 0.6 });
  if (name === 'change') {
    const c = o => JSON.parse(JSON.stringify(o));
    const q1 = c(CASES.change); q1.filt.offset = 0.5; q1.filt.cutoff = 900;
    const q2 = c(q1); q2.filt.tube = '12AX7'; q2.filt.res = 0.9;
    const q3 = c(q2); q3.filt.model = 'ladder24'; q3.filt.offset = 0;
    const q4 = c(q3); q4.filt.drive = 7;
    events.push({ at: 48000, t: 'patch', p: normalize(q1) }, { at: 96000, t: 'patch', p: normalize(q2) }, { at: 144000, t: 'patch', p: normalize(q3) },
      { at: 192000, t: 'patch', p: normalize(q4) }, { at: 200000, t: 'off', n: 48 }, { at: 210000, t: 'on', n: 50, v: 0.5 });
    events.sort((a, b) => a.at - b.at);
  }
  let pr;
  if (C_CASES[name]) {
    const cp = n => normalizeC(JSON.parse(JSON.stringify(C_FACTORY.find(p => p.name === n) || {})));
    const cev = C_EV.map(e => Object.assign({}, e));
    if (name === 'c_change') {
      const q1 = cp('Plate Screamer'); q1.hpf.a = 0.3; q1.lpf.peak = 0.95;
      const q2 = cp('Night Wind'), q3 = cp('Growl FM');
      cev.push({ at: 48000, t: 'patch', p: q1 }, { at: 48000 * 2.2, t: 'patch', p: q2 }, { at: 48000 * 3.7, t: 'patch', p: q3 });
      cev.sort((a, b) => a.at - b.at);
    }
    pr = new procs.cathode({ processorOptions: { tubes: tubeData(), patch: cp(C_CASES[name]), events: cev, active: true } });
  } else pr = new procs.filament({ processorOptions: { tubes: tubeData(), patch: normalize(CASES[name]), events, active: true } });
  const secs = +(arg('--seconds', 6)), N = secs * 48000, B = 128, CF = vm.runInContext('Float32Array', ctx);
  const outL = new Float32Array(N), outR = new Float32Array(N), L = new CF(B), R = new CF(B);
  const c0 = process.cpuUsage();
  if (scanSub) {
    for (let f = 0; f < N; f += B) { ctx.currentFrame = f; pr.process([], [[L, R]]); outL.set(L, f); outR.set(R, f); subScan(pr, 'proc', new Set()); }
  } else for (let f = 0; f < N; f += B) { ctx.currentFrame = f; pr.process([], [[L, R]]); outL.set(L, f); outR.set(R, f); }
  const cu = process.cpuUsage(c0);
  // -0 and +0 are the same sample: count them as one, so a state stopped at 0 (where it used to sink
  // through the subnormals as a tiny negative number and come out as -0) is not "output differs"
  for (let i = 0; i < N; i++) { if (outL[i] === 0) outL[i] = 0; if (outR[i] === 0) outR[i] = 0; }
  const hash = crypto.createHash('sha256').update(Buffer.from(outL.buffer)).update(Buffer.from(outR.buffer)).digest('hex').slice(0, 16);
  return { cpu: (cu.user + cu.system) / 1e4 / secs, hash, sub: scanSub ? Object.fromEntries(SUB) : undefined };
}
// --subnormals: after every block, walk the processor's state (voices, filters, oscillators,
// decimators) and count, per field, the blocks that end with a value between 0 and the smallest
// normal double. Arithmetic on subnormals is about 19x slower in Chrome's audio thread (measured
// 26 Oct), and nothing there flushes them, so a state that decays toward 0 should stop at 0.
const scanSub = process.argv.includes('--scan'), SUB = new Map(), MINN = 2.2250738585072014e-308;
const isSub = x => typeof x === 'number' && x !== 0 && x < MINN && x > -MINN;
const bump = k => SUB.set(k, (SUB.get(k) || 0) + 1);
function subScan(o, pre, seen) {
  if (!o || typeof o !== 'object' || seen.has(o)) return; seen.add(o);
  if (ArrayBuffer.isView(o)) { for (let i = 0; i < o.length; i++) if (isSub(o[i])) { bump(pre + '[]'); break; } return; }
  // the per-block mix buffers are rewritten each block; the patch and event queue are inputs
  for (const k of Object.keys(o)) {
    if (k === 'P' || k === 'port' || k === 'events' || k === 'pendingPatch' || k === 'L2' || k === 'R2') continue;
    const x = o[k], q = Array.isArray(o) ? pre + '[]' : pre + '.' + k;
    if (isSub(x)) bump(q); else if (x && typeof x === 'object') subScan(x, q, seen);
  }
}

const SEC = arg('--seconds', null) ? ['--seconds', arg('--seconds', null)] : [];
if (process.argv[2] === '--one') {
  console.log(JSON.stringify(await one(process.argv[3], process.argv[4])));
} else if (process.argv.includes('--subnormals')) {
  const want = arg('--cases', null), NAMES = Object.keys(CASES).concat(Object.keys(C_CASES))
    .filter(n => !want || want.split(',').some(w => n === w || (w === 'cathode' && C_CASES[n]) || (w === 'filament' && CASES[n])));
  let bad = 0;
  for (const name of NAMES) {
    const p = spawnSync(process.execPath, [ME, '--one', path.join(REPO, 'frontend/public/synth'), name, '--scan', ...SEC], { encoding: 'utf8' });
    if (p.status !== 0) { console.error(p.stderr); process.exit(1); }
    const sub = JSON.parse(p.stdout).sub, ks = Object.keys(sub).sort((a, b) => sub[b] - sub[a]);
    if (ks.length) bad++;
    console.log(name.padEnd(10) + (ks.length ? ks.map(k => `${k} (${sub[k]} blocks)`).join(', ') : 'no subnormals'));
  }
  process.exit(bad ? 3 : 0);
} else if (arg('--profile', null)) {
  // self time per function (name:line), from V8's sampling profiler, for one case on this tree
  const name = arg('--profile', null), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'filament-prof-'));
  const p = spawnSync(process.execPath, ['--cpu-prof', '--cpu-prof-dir', tmp, ME, '--one', path.join(REPO, 'frontend/public/synth'), name, ...SEC], { encoding: 'utf8' });
  if (p.status !== 0) { console.error(p.stderr); process.exit(1); }
  const prof = JSON.parse(fs.readFileSync(path.join(tmp, fs.readdirSync(tmp)[0]), 'utf8'));
  const byId = new Map(prof.nodes.map(n => [n.id, n])), self = new Map();
  for (const id of prof.samples) {
    const cf = byId.get(id).callFrame, k = `${cf.functionName || '(anonymous)'}:${cf.lineNumber + 1} ${path.basename(cf.url)}`;
    self.set(k, (self.get(k) || 0) + 1);
  }
  const total = prof.samples.length;
  console.log(`${name}: ${JSON.parse(p.stdout).cpu.toFixed(1)}% of real time, ${total} samples`);
  for (const [k, c] of [...self].sort((x, y) => y[1] - x[1]).slice(0, +arg('--top', 12))) console.log(`  ${(100 * c / total).toFixed(1).padStart(5)}%  ${k}`);
  fs.rmSync(tmp, { recursive: true, force: true });
} else {
  const ref = arg('--ref', null), rounds = +arg('--rounds', ref ? 4 : 2);
  const trees = [{ label: 'this tree', dir: path.join(REPO, 'frontend/public/synth') }];
  let tmp = null;
  if (ref) {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'filament-bench-'));
    execSync(`git -C "${REPO}" archive "${ref}" frontend/public/synth | tar -x -C "${tmp}"`);
    trees.unshift({ label: ref, dir: path.join(tmp, 'frontend/public/synth') });
  }
  const best = {};
  const want = arg('--cases', null), NAMES = Object.keys(CASES).concat(Object.keys(C_CASES))
    .filter(n => !want || want.split(',').some(w => n === w || (w === 'cathode' && C_CASES[n]) || (w === 'filament' && CASES[n])));
  for (let r = 0; r < rounds; r++) for (const name of NAMES) for (const t of trees) {
    const p = spawnSync(process.execPath, [ME, '--one', t.dir, name, ...SEC], { encoding: 'utf8' });
    if (p.status !== 0) { console.error(p.stderr); process.exit(1); }
    const x = JSON.parse(p.stdout), k = t.label + '|' + name;
    if (!best[k] || x.cpu < best[k].cpu) best[k] = { cpu: x.cpu, hash: x.hash };
    if (best[k].hash !== x.hash) best[k].unstable = true;
  }
  let differ = 0;
  for (const name of NAMES) {
    const row = trees.map(t => best[t.label + '|' + name]);
    let line = name.padEnd(10) + row.map((b, i) => `${trees[i].label}: ${b.cpu.toFixed(1)}%`).join('   ');
    if (row.length === 2) {
      const same = row[0].hash === row[1].hash;
      if (!same) differ++;
      line += `   ${(100 * (row[1].cpu - row[0].cpu) / row[0].cpu).toFixed(1).padStart(6)}%   ${same ? 'identical output' : 'OUTPUT DIFFERS'}`;
    } else line += `   hash ${row[0].hash}`;
    if (row.some(b => b.unstable)) line += '   (not deterministic run to run)';
    console.log(line);
  }
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(differ ? 2 : 0);
}
