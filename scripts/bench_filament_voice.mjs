#!/usr/bin/env node
// Filament voice bench: runs voice.worklet.js in Node, outside the browser, with Math.random seeded,
// so two versions of the engine can be compared sample for sample and by CPU time.
//
//   node scripts/bench_filament_voice.mjs                 this tree: CPU per case and an output hash
//   node scripts/bench_filament_voice.mjs --ref origin/main [--rounds 4]
//                                                         A/B against a git ref: CPU change per case,
//                                                         and whether the output is bit-identical
//
// What it measures: the Filament worklet alone (no rack, no browser), 6 s at 48 kHz in 128-frame
// blocks, process CPU time (user + system) per render, best of the rounds. Each render runs in a
// fresh child process so one version's JIT state never helps the other. The cases are test 9's
// four (8 voices, Ladder 24 and Valve 12, stereo offset, 16 voices) plus wider coverage for the
// equivalence check: LFOs on everything, noise, sync, FM and ring, glide, high resonance, a still
// note with no drift, and patch changes mid-note (stereo offset on, loop tube, model, drive).
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
  offset: big('valve12', p => { p.filt.offset = 0.5; }),
  uni16: big('valve12', p => { p.voice = { unison: 2, count: 8 }; }),
  lfo: big('valve12', p => { p.lfo1 = { rate: 4, pitch: 20, cutoff: 1, pw: 0.3, amp: 0.4, wave: 'tri' }; p.lfo2 = { rate: 0.7, cutoff: 0.5, pan: 0.5, phase: 90, wave: 'sh' }; p.noise = { level: 0.2, color: 'pink' }; }),
  sync: big('ladder24', p => { p.osc2.sync = true; p.osc2.semi = 7; p.filt.res = 0.95; p.osc1.wave = 'tri'; }),
  fm: big('valve12', p => { p.osc2 = { wave: 'sine', level: 0.5, fm: 0.5, ring: 0.3 }; p.filt.res = 0.97; p.voice.glide = 0.1; }),
  still: big('valve12', p => { p.drift = 0; p.filt.res = 0.8; }),
  change: big('valve12', p => { p.drift = 0; }),
};
const EV = [48, 52, 55, 59, 60, 64, 67, 71].map(n => ({ at: 0, t: 'on', n, v: 0.8 }));

// one render of one case from one synth directory: { cpu (% of real time), hash }
async function one(dir, name) {
  const { normalize } = await import(path.join(dir, 'patches.js'));
  const { tubeData } = await import(path.join(dir, 'rack.js'));
  const procs = {};
  const ctx = { sampleRate: 48000, currentFrame: 0, console,
    AudioWorkletProcessor: class { constructor() { this.port = { postMessage() {}, onmessage: null }; } },
    registerProcessor: (n, c) => { procs[n] = c; } };
  vm.createContext(ctx);
  vm.runInContext(`Math.random = (a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; })(12345)`, ctx);
  vm.runInContext(fs.readFileSync(path.join(dir, 'voice.worklet.js'), 'utf8'), ctx, { filename: 'voice.worklet.js' });
  const events = EV.map(e => Object.assign({}, e));
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
  const pr = new procs.filament({ processorOptions: { tubes: tubeData(), patch: normalize(CASES[name]), events, active: true } });
  const secs = 6, N = secs * 48000, B = 128, CF = vm.runInContext('Float32Array', ctx);
  const outL = new Float32Array(N), outR = new Float32Array(N), L = new CF(B), R = new CF(B);
  const c0 = process.cpuUsage();
  for (let f = 0; f < N; f += B) { ctx.currentFrame = f; pr.process([], [[L, R]]); outL.set(L, f); outR.set(R, f); }
  const cu = process.cpuUsage(c0);
  const hash = crypto.createHash('sha256').update(Buffer.from(outL.buffer)).update(Buffer.from(outR.buffer)).digest('hex').slice(0, 16);
  return { cpu: (cu.user + cu.system) / 1e4 / secs, hash };
}

if (process.argv[2] === '--one') {
  console.log(JSON.stringify(await one(process.argv[3], process.argv[4])));
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
  for (let r = 0; r < rounds; r++) for (const name of Object.keys(CASES)) for (const t of trees) {
    const p = spawnSync(process.execPath, [ME, '--one', t.dir, name], { encoding: 'utf8' });
    if (p.status !== 0) { console.error(p.stderr); process.exit(1); }
    const x = JSON.parse(p.stdout), k = t.label + '|' + name;
    if (!best[k] || x.cpu < best[k].cpu) best[k] = { cpu: x.cpu, hash: x.hash };
    if (best[k].hash !== x.hash) best[k].unstable = true;
  }
  let differ = 0;
  for (const name of Object.keys(CASES)) {
    const row = trees.map(t => best[t.label + '|' + name]);
    let line = name.padEnd(9) + row.map((b, i) => `${trees[i].label}: ${b.cpu.toFixed(1)}%`).join('   ');
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
