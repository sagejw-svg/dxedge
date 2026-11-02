#!/usr/bin/env node
// Spring reverb bench: runs spring.worklet.js in Node, outside the browser, on a fixed input, so two versions of
// the tank can be compared sample for sample and by CPU time.
//
//   node scripts/bench_spring.mjs                          this tree: CPU per case and an output hash
//   node scripts/bench_spring.mjs --ref origin/main [--rounds 3] [--seconds 20] [--sr 48000] [--cases t9,rel6]
//                                                          A/B against a git ref: CPU per case, and whether the
//                                                          output is bit-identical
//
// The input is our own: an 8-note saw chord (test 9's notes), a short seeded noise burst and silence, repeated
// every 10 s; the rel cases play the chord for 1 s and then leave the tank ringing on silence until the end, which
// is where a state sinking into subnormal numbers shows. `moves` turns every knob mid-render and clears the tank
// three times (Panic's fade). Some silent blocks arrive with no input channel at all, as a disconnected input does.
// CPU is process time per render (user + system) over the seconds rendered, best of the rounds, each render in a
// fresh vm context. Numbers are relative: test 9 in headless Chrome is the figure the log quotes.
import fs from 'fs'; import vm from 'vm'; import crypto from 'crypto'; import path from 'path'; import os from 'os';
import { execSync } from 'child_process'; import { fileURLToPath } from 'url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SR = +arg('--sr', 48000), B = 128, secs = +arg('--seconds', 20), rounds = +arg('--rounds', 3);
const N = Math.floor(secs * SR / B) * B;
const CASES = {
  t9: [{ at: 0, drive: 5, decay: 6, tone: 10, drip: 100 }],     // test 9's spring line
  def: [{ at: 0, drive: 3, decay: 2.5, tone: 5, drip: 40 }],    // the defaults
  moves: [{ at: 0, drive: 0, decay: 0.5, tone: 0, drip: 0 }, { at: 2.3, drive: 10, decay: 6, tone: 10, drip: 100 },
    { at: 4.1, drive: 3, decay: 2.5, tone: 5, drip: 40, clear: true }, { at: 6.2, clear: true }, { at: 8.7, drive: 7, decay: 4, tone: 2, drip: 70 },
    { at: 12.05, clear: true }, { at: 13.3, drive: 1, decay: 1, tone: 8, drip: 15 }],
  rel6: [{ at: 0, drive: 5, decay: 6, tone: 10, drip: 100 }],
  rel2: [{ at: 0, drive: 3, decay: 2.5, tone: 5, drip: 40 }],
};
const names = (arg('--cases', '') || Object.keys(CASES).join(',')).split(',');

function input(rel) {
  const x = new Float32Array(N); let s = 12345;
  const rnd = () => { s = (s * 1103515245 + 12345) >>> 0; return s / 4294967296 - 0.5; };
  const inc = [48, 52, 55, 59, 60, 64, 67, 71].map(n => 440 * Math.pow(2, (n - 69) / 12) / SR), ph = new Float64Array(8);
  for (let i = 0; i < N; i++) {
    const t = i / SR, seg = rel ? (t < 1 ? 0 : 99) : t % 10;
    let v = 0;
    if (seg < 6) for (let k = 0; k < 8; k++) { ph[k] = (ph[k] + inc[k]) % 1; v += (2 * ph[k] - 1) * 0.06; }
    else if (seg < 6.05) v = rnd() * 0.8;
    x[i] = v;
  }
  return x;
}

function render(file, name, X) {
  const procs = {};
  const ctx = { sampleRate: SR, currentFrame: 0, console,
    AudioWorkletProcessor: class { constructor() { this.port = { postMessage() {}, onmessage: null }; } },
    registerProcessor: (n, c) => { procs[n] = c; } };
  vm.createContext(ctx);
  // inside a function with the builtins passed in, as in bench_filament_voice.mjs (a vm context's global lookups
  // are slow and uninlinable; Chrome's worklet scope has no such cost)
  const G = ['Math', 'isFinite', 'NaN', 'Array', 'Object', 'JSON', 'Float32Array', 'Float64Array', 'Int32Array'];
  vm.runInContext(`(function (${G.join(', ')}) {\n${fs.readFileSync(file, 'utf8')}\n})(${G.map(g => 'globalThis.' + g).join(', ')});`, ctx,
    { filename: 'spring.worklet.js', lineOffset: -1 });
  const CF = vm.runInContext('Float32Array', ctx), pr = new procs['filament-spring']();
  const prm = { drive: new CF([3]), decay: new CF([2.5]), tone: new CF([5]), drip: new CF([40]) };
  const ev = CASES[name]; let ei = 0;
  const outL = new Float32Array(N), outR = new Float32Array(N), L = new CF(B), R = new CF(B), I = new CF(B);
  const c0 = process.cpuUsage();
  for (let f = 0; f < N; f += B) {
    while (ei < ev.length && ev[ei].at * SR <= f) {
      const e = ev[ei++]; for (const k of ['drive', 'decay', 'tone', 'drip']) if (k in e) prm[k][0] = e[k];
      if (e.clear) pr.port.onmessage({ data: { t: 'clear' } });
    }
    ctx.currentFrame = f; I.set(X.subarray(f, f + B));
    const silent = !I.some(v => v !== 0);
    pr.process(silent && (f / B) % 3 === 0 ? [[]] : [[I]], [[L, R]], prm);
    outL.set(L, f); outR.set(R, f);
  }
  const cu = process.cpuUsage(c0);
  for (let i = 0; i < N; i++) { if (outL[i] === 0) outL[i] = 0; if (outR[i] === 0) outR[i] = 0; }   // -0 and +0 are one sample
  const hash = crypto.createHash('sha256').update(Buffer.from(outL.buffer)).update(Buffer.from(outR.buffer)).digest('hex').slice(0, 16);
  return { cpu: (cu.user + cu.system) / 1e4 / secs, hash };
}
function best(file, name, X) {
  let b = null;
  for (let r = 0; r < rounds; r++) {
    const o = render(file, name, X);
    if (b && o.hash !== b.hash) throw new Error(`${name}: two renders of ${file} differ`);
    if (!b || o.cpu < b.cpu) b = o;
  }
  return b;
}

const here = path.join(REPO, 'frontend/public/synth/spring.worklet.js'), ref = arg('--ref', null);
let other = null;
if (ref) {
  other = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bench-spring-')), 'spring.worklet.js');
  fs.writeFileSync(other, execSync(`git -C "${REPO}" show ${ref}:frontend/public/synth/spring.worklet.js`));
}
let differ = 0;
for (const name of names) {
  const X = input(name.startsWith('rel'));
  const a = best(here, name, X);
  if (!other) { console.log(`${name.padEnd(6)} ${a.cpu.toFixed(2)}% of real time  ${a.hash}`); continue; }
  const o = best(other, name, X), same = o.hash === a.hash;
  if (!same) differ++;
  console.log(`${name.padEnd(6)} ${ref} ${o.cpu.toFixed(2)}%  this tree ${a.cpu.toFixed(2)}%  (${(100 * (a.cpu / o.cpu - 1)).toFixed(0)}%)  ${same ? 'bit-identical' : 'OUTPUT DIFFERS'}`);
}
if (differ) process.exit(1);
