// Gyrotron patches. Schema v1, device 'gyrotron'.
//
// A gyrotron is a vacuum tube whose electrons spiral in a magnetic field and
// hand their energy to a cavity. Here the bodies are those electrons and the
// wells are the cavities: a collision or an orbit crossing rings a note.

import { parameterTable, RACK_API, registerDevice } from './device.js';
import { writeSMF } from './smf.js';
import {
  GYRO_CORE, CORE_RANGE, normalizeCore, SCALE_IDS, TOOLS, ROUTES, runWorld,
} from './gyrotron-world.js';

export { RACK_API };
export const GYRO_SCHEMA = 1;
export const GYRO_ID = 'gyrotron';

const CATS = ['Orbit', 'Night', 'Sling'];

export function normalizeGyrotron(p) {
  const core = normalizeCore(p);
  const out = Object.assign(core, {
    v: GYRO_SCHEMA,
    device: GYRO_ID,
    name: 'Copper Orbit',
    cat: 'Orbit',
  });
  if (p && typeof p.name === 'string' && p.name.trim()) out.name = p.name.trim().slice(0, 40);
  if (p && CATS.indexOf(p.cat) >= 0) out.cat = p.cat;
  return out;
}

function patch(name, cat, over) {
  const p = normalizeGyrotron(Object.assign({ name, cat }, over || {}));
  p.name = name;
  p.cat = cat;
  return p;
}

export const GYRO_DEFAULT = normalizeGyrotron(GYRO_CORE);

export const GYRO_FACTORY = [
  patch('Copper Orbit', 'Orbit', {}),
  patch('Cold Periapsis', 'Night', {
    seed: 814,
    root: 50,
    key: 9,
    scale: 'minor',
    gravity: 0.38,
    pull: 0.05,
    drag: 0.16,
    bodyCount: 4,
    wellCount: 1,
    decay: 0.72,
    tone: 0.4,
    fold: 0.12,
    space: 0.34,
    timbre: 0.32,
    level: 0.8,
  }),
  patch('Sling Chorus', 'Sling', {
    seed: 2401,
    root: 62,
    key: 2,
    scale: 'dorian',
    gravity: 0.9,
    pull: 0.55,
    drag: 0.02,
    bodyCount: 7,
    wellCount: 3,
    decay: 0.28,
    tone: 0.78,
    fold: 0.48,
    space: 0.16,
    timbre: 0.7,
    drift: 0.22,
    level: 0.76,
  }),
];

export const GYRO_CATS = CATS;

const ENUMS = {
  scale: SCALE_IDS.slice(),
  tool: TOOLS.slice(),
  route: ROUTES.slice(),
};

// whole numbers: the ones normalizeCore rounds (gyrotron-world.js)
export const GYRO_PARAMETERS = parameterTable(Object.assign({
  v: GYRO_SCHEMA, device: GYRO_ID, name: 'Copper Orbit', cat: 'Orbit',
}, GYRO_CORE), CORE_RANGE, ENUMS, ['seed', 'bodyCount', 'wellCount', 'root', 'key', 'voices']);

export function midiOf(patch, seconds) {
  const run = runWorld(patch || {}, seconds || 4);
  const decay = run && patch && patch.decay != null ? +patch.decay : 0.42;
  const dur = 0.12 + Math.max(0, Math.min(1, decay)) * 0.7;
  const hit = [];
  const cross = [];
  run.events.forEach(e => {
    const midi = Math.max(0, Math.min(127, Math.round(e.midi)));
    const vel = Math.max(1, Math.min(127, Math.round((e.gain == null ? 0.7 : e.gain) * 110)));
    const bucket = e.kind === 'cross' ? cross : hit;
    bucket.push({ time: e.at, data: [0x90, midi, vel] });
    bucket.push({ time: e.at + dur, data: [0x80, midi, 0] });
  });
  const parts = [];
  if (hit.length) parts.push({ name: 'Gyrotron hits', ch: 0, events: hit });
  if (cross.length) parts.push({ name: 'Gyrotron crossings', ch: 1, events: cross });
  if (!parts.length) parts.push({ name: 'Gyrotron', ch: 0, events: [] });
  return writeSMF({ bpm: 120, parts });
}

export const gyrotronDevice = {
  id: GYRO_ID,
  name: 'Gyrotron',
  vendor: 'DX Edge',
  version: String(GYRO_SCHEMA),
  api: RACK_API,
  description: 'Gravity sequencer of orbiting bodies and wells',
  instrument: true,
  audioInputs: 0,
  audioOutputs: 1,
  midiInput: true,
  midiOutput: true,
  processor: 'gyrotron',
  worklet: 'gyrotron.worklet.js',
  channels: 2,
  oversample: 1,
  parameters: GYRO_PARAMETERS,
  normalize: normalizeGyrotron,
  factory: GYRO_FACTORY,
  defaults: GYRO_DEFAULT,
  messages: ['patch', 'on', 'off', 'bend', 'mw', 'panic', 'active', 'gesture', 'reseed'],
};

registerDevice(gyrotronDevice);
