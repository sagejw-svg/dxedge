// Geissler patches. Schema v1, device 'geissler'.
//
// A generative field: reeds, grazers, stalks and flickers share one meadow.
// The page leaves the shared output tubes alone. ens, out and stereo are
// carried so a host that expects them still finds the fields.

import { DEFAULT as F_DEFAULT, clone } from './patches.js';
import { parameterTable, RACK_API, registerDevice } from './device.js';
import {
  GEISSLER_CORE, CORE_RANGE, normalizeCore, SCALE_IDS, GRID_IDS, TOOLS, SPECIES, ROUTES,
} from './geissler-world.js';

export { RACK_API };
export const GEISSLER_SCHEMA = 1;
export const GEISSLER_ID = 'geissler';

export const GEISSLER_DEFAULT = Object.assign(normalizeCore(GEISSLER_CORE), {
  v: GEISSLER_SCHEMA,
  device: GEISSLER_ID,
  name: 'Glass Meadow',
  cat: 'Field',
  stereo: clone(F_DEFAULT.stereo),
  ens: clone(F_DEFAULT.ens),
  out: clone(F_DEFAULT.out),
  voice: { mode: 'poly' },
});

const CATS = ['Field', 'Night', 'Bloom'];

export function normalizeGeissler(p) {
  const core = normalizeCore(p);
  const out = Object.assign(core, {
    v: GEISSLER_SCHEMA,
    device: GEISSLER_ID,
    name: 'Glass Meadow',
    cat: 'Field',
    stereo: clone(F_DEFAULT.stereo),
    ens: clone(F_DEFAULT.ens),
    out: clone(F_DEFAULT.out),
    voice: { mode: 'poly' },
  });
  if (p && typeof p.name === 'string' && p.name.trim()) out.name = p.name.trim().slice(0, 40);
  if (p && CATS.includes(p.cat)) out.cat = p.cat;
  return out;
}

function patch(name, cat, over) {
  const p = normalizeGeissler(Object.assign({ name, cat }, over || {}));
  p.name = name;
  p.cat = cat;
  return p;
}

export const GEISSLER_FACTORY = [
  patch('Glass Meadow', 'Field', {}),
  patch('Low Hunt', 'Night', {
    seed: 814,
    root: 50,
    scale: 'minor',
    grid: '8',
    tempo: 84,
    birth: 0.38,
    death: 0.46,
    mutation: 0.22,
    food: 0.42,
    season: 48,
    cap: 14,
    capReed: 4,
    capGraze: 4,
    capStalk: 5,
    capFlicker: 3,
    level: 0.78,
  }),
  patch('Pollen Year', 'Bloom', {
    seed: 2401,
    root: 62,
    scale: 'season',
    grid: '16',
    tempo: 126,
    birth: 0.84,
    death: 0.2,
    mutation: 0.28,
    food: 0.9,
    season: 18,
    cap: 20,
    capReed: 6,
    capGraze: 5,
    capStalk: 3,
    capFlicker: 8,
    level: 0.74,
  }),
];

export const GEISSLER_CATS = CATS;

const ENUMS = {
  scale: SCALE_IDS.slice(),
  grid: GRID_IDS.slice(),
  tool: TOOLS.slice(),
  spawn: SPECIES.slice(),
  routeReed: ROUTES.slice(),
  routeGraze: ROUTES.slice(),
  routeStalk: ROUTES.slice(),
  routeFlicker: ROUTES.slice(),
};

export const GEISSLER_PARAMETERS = parameterTable(Object.assign({
  v: GEISSLER_SCHEMA, device: GEISSLER_ID, name: 'Glass Meadow', cat: 'Field',
}, GEISSLER_CORE), CORE_RANGE, ENUMS);

export const geisslerDevice = {
  id: GEISSLER_ID,
  name: 'Geissler',
  vendor: 'DX Edge',
  version: String(GEISSLER_SCHEMA),
  api: RACK_API,
  description: 'Generative ecosystem of reeds, grazers, stalks and flickers',
  instrument: true,
  audioInputs: 0,
  audioOutputs: 1,
  midiInput: true,
  midiOutput: true,
  processor: 'geissler',
  worklet: 'geissler.worklet.js',
  channels: 2,
  oversample: 1,
  parameters: GEISSLER_PARAMETERS,
  normalize: normalizeGeissler,
  factory: GEISSLER_FACTORY,
  defaults: GEISSLER_DEFAULT,
  messages: ['patch', 'tap', 'food', 'spawn', 'herd', 'panic', 'active', 'tempo', 'reseed'],
};

registerDevice(geisslerDevice);
