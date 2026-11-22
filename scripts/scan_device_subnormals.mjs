#!/usr/bin/env node
// Device worklet scan: runs each hosted device's AudioWorklet processor in Node (stub worklet globals,
// Math.random seeded), plays every factory patch, and reports which state fields hold a subnormal
// double at the end of a block, plus a hash of the output and the CPU time of the render.
//
//   node scripts/scan_device_subnormals.mjs [--dir frontend/public/synth] [--devices additron,lattice]
//        [--seconds 12] [--rounds 1] [--json out.json]
//
// Why: arithmetic on subnormal doubles (0 < |x| < 2.2e-308) runs many times slower than on normal
// numbers, and nothing in an AudioWorklet flushes them (measured 26 Oct). A filter or envelope that
// decays geometrically toward zero in a released tail sinks into them and stays there, so a silent
// device costs more than a sounding one. Float32Array state cannot hold a double subnormal (they
// round to 0 there), so only plain numbers and Float64Array entries are checked.
//
// Each case: the factory patch, normalized the way the device's UI does it; a four-note chord held
// for 1 s (drums: each voice triggered once), released, the tail, and the same chord again at 75% of
// the run (so a state cut to zero in the tail is proven not to change what plays after it). Generative
// devices with no note input just run. CPU: process time of a render with no scan, best of --rounds. Exit 3 if any case holds a subnormal.
// --dir points at another tree (a git worktree of origin/main, say), so two versions can be compared
// by the printed output hashes: equal hashes mean the output is identical sample for sample.
import path from 'path'; import crypto from 'crypto'; import fs from 'fs'; import { fileURLToPath, pathToFileURL } from 'url';

const ME = fileURLToPath(import.meta.url), REPO = path.resolve(path.dirname(ME), '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const DIR = path.resolve(arg('--dir', path.join(REPO, 'frontend/public/synth')));
const SECONDS = +arg('--seconds', 12);
const SR = 48000, BLOCK = 128, ROUNDS = +arg('--rounds', 1);
const MIN_NORMAL = 2.2250738585072014e-308;

// id in the registry -> the module that registers it, and the worklet file
const DEVICES = {
  dekatron: ['drums.js', 'drums.worklet.js'], thyratron: ['thyratron.js', 'thyratron.worklet.js'],
  lattice: ['lattice.js', 'lattice.worklet.js'], gleam: ['gleam.js', 'gleam.worklet.js'],
  mote: ['mote.js', 'mote.worklet.js'], heptode: ['heptode.js', 'heptode.worklet.js'],
  geissler: ['geissler.js', 'geissler.worklet.js'], pentagrid: ['pentagrid.js', 'pentagrid.worklet.js'],
  orthicon: ['orthicon.js', 'orthicon.worklet.js'], trochotron: ['trochotron.js', 'trochotron.worklet.js'],
  gyrotron: ['gyrotron.js', 'gyrotron.worklet.js'], klystron: ['klystron.js', 'klystron.worklet.js'],
  phantastron: ['phantastron.js', 'phantastron.worklet.js'], additron: ['additron.js', 'additron.worklet.js'],
  rhumbatron: ['rhumbatron.js', 'rhumbatron.worklet.js'], resnatron: ['resnatron.js', 'resnatron.worklet.js'],
};
const want = arg('--devices', '') ? arg('--devices').split(',') : Object.keys(DEVICES);

// Seeded random, reset per case, so a case renders the same on every run and on both trees.
let seed = 1;
Math.random = () => { seed = (seed + 0x6D2B79F5) | 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// Stub AudioWorkletGlobalScope.
const procs = {};
globalThis.sampleRate = SR; globalThis.currentFrame = 0; globalThis.currentTime = 0;
globalThis.registerProcessor = (name, cls) => { procs[name] = cls; };
globalThis.AudioWorkletProcessor = class { constructor() { this.port = { postMessage() {}, onmessage: null }; } };

function scan(root) {
  const hits = new Set(), seen = new Set();
  const walk = (o, p, depth) => {
    if (o == null || depth > 7) return;
    if (typeof o === 'number') { if (o !== 0 && Math.abs(o) < MIN_NORMAL) hits.add(p); return; }
    if (typeof o !== 'object' || seen.has(o)) return;
    seen.add(o);
    if (o instanceof Float64Array) {
      for (let i = 0; i < o.length; i++) { const x = o[i]; if (x !== 0 && Math.abs(x) < MIN_NORMAL) { hits.add(p + '[]'); break; } }
      return;
    }
    if (ArrayBuffer.isView(o)) return;
    if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) walk(o[i], p + '[]', depth + 1); return; }
    if (o instanceof Map) { for (const v of o.values()) walk(v, p + '{}', depth + 1); return; }
    for (const k of Object.keys(o)) { if (k === 'port') continue; walk(o[k], p ? p + '.' + k : k, depth + 1); }
  };
  walk(root, '', 0);
  return hits;
}

const results = [];
let anyHit = false;
for (const id of want) {
  const [mod, wk] = DEVICES[id];
  const dm = await import(pathToFileURL(path.join(DIR, mod)).href);
  const reg = await import(pathToFileURL(path.join(DIR, 'device.js')).href);
  await import(pathToFileURL(path.join(DIR, wk)).href);
  // Dekatron and Lattice register when the page hosts their nodes; their modules export the descriptor.
  const desc = reg.getDevice(id) || Object.values(dm).find(v => v && typeof v === 'object' && v.id === id && v.processor);
  if (!desc) { console.log(id, 'not registered'); continue; }
  const Proc = procs[desc.processor];
  // Thyratron's descriptor (in device.js) carries no factory list; its module exports it.
  const factory = (desc.factory && desc.factory.length) ? desc.factory
    : (Object.entries(dm).find(([k, v]) => /FACTORY$/.test(k) && Array.isArray(v)) || [, []])[1];
  const msgs = desc.messages || [];
  for (const fp of factory) {
    const name = fp.name || '?';
    const patch = desc.normalize ? desc.normalize(fp.patch || fp) : (fp.patch || fp);
    const blocks = Math.ceil(SECONDS * SR / BLOCK);
    // the chord at block 2, released after 1 s, and again at 75% of the run (after the tail), released 1 s later
    const on1 = 2, off1 = on1 + Math.round(SR / BLOCK), on2 = Math.round(blocks * 0.75), off2 = on2 + Math.round(SR / BLOCK);
    const run = (doScan) => {
      seed = 1;
      const proc = new Proc({ processorOptions: { patch, events: [], active: true } });
      const send = m => { if (proc.port.onmessage) proc.port.onmessage({ data: m }); };
      const notes = [48, 55, 60, 64];
      const L = new Float32Array(BLOCK), R = new Float32Array(BLOCK);
      const inL = new Float32Array(BLOCK), inR = new Float32Array(BLOCK);
      const h = crypto.createHash('sha256');
      const fieldBlocks = new Map(); let subBlocks = 0, peak = 0;
      const t0 = process.cpuUsage();
      for (let b = 0; b < blocks; b++) {
        if (b === on1 || b === on2) {
          if (id === 'dekatron') ['kick', 'snare', 'hatC', 'hatO', 'clap', 'tom', 'rim'].forEach(v => send({ t: 'trig', voice: v, v: 0.9 }));
          else if (msgs.includes('on')) notes.forEach(n => send({ t: 'on', n, v: 0.8 }));
        }
        if ((b === off1 || b === off2) && msgs.includes('off')) notes.forEach(n => send({ t: 'off', n }));
        globalThis.currentFrame = b * BLOCK; globalThis.currentTime = b * BLOCK / SR;
        L.fill(0); R.fill(0);
        proc.process([[inL, inR]], [[L, R]], {});
        if (doScan) {
          for (let i = 0; i < BLOCK; i++) {
            if (L[i] === 0) L[i] = 0; if (R[i] === 0) R[i] = 0;    // -0 and +0 are the same sample
            const a = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (a > peak) peak = a;
          }
          h.update(Buffer.from(L.buffer)); h.update(Buffer.from(R.buffer));
          const hits = scan(proc);
          if (hits.size) { subBlocks++; for (const f of hits) fieldBlocks.set(f, (fieldBlocks.get(f) || 0) + 1); }
        }
      }
      const cpu = process.cpuUsage(t0);
      return { ms: (cpu.user + cpu.system) / 1000, hash: h.digest('hex').slice(0, 16), peak, subBlocks, fieldBlocks };
    };
    // the scan and the hash on one pass; CPU on separate passes (best of --rounds) with nothing else in the loop
    const s1 = run(true);
    let ms = Infinity;
    for (let k = 0; k < ROUNDS; k++) ms = Math.min(ms, run(false).ms);
    const r = { id, name, hash: s1.hash, peak: +s1.peak.toFixed(4), cpuPct: +(100 * ms / (SECONDS * 1000)).toFixed(2),
      subPct: +(100 * s1.subBlocks / blocks).toFixed(1), fields: [...s1.fieldBlocks].map(([f, n]) => `${f} ${(100 * n / blocks).toFixed(0)}%`) };
    if (s1.subBlocks) anyHit = true;
    results.push(r);
    console.log(`${id.padEnd(11)} ${name.padEnd(22)} hash ${r.hash} peak ${String(r.peak).padEnd(6)} cpu ${String(r.cpuPct).padStart(6)}%  subnormal blocks ${r.subPct}%${r.fields.length ? '  ' + r.fields.join(', ') : ''}`);
  }
}
if (arg('--json')) fs.writeFileSync(arg('--json'), JSON.stringify(results, null, 1));
process.exit(anyHit ? 3 : 0);
