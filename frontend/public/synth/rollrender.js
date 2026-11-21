// The paper roll on the rack devices other than Filament and Cathode, in the Master strip's render wav (21 Nov 2026).
// Our own code. Each device builds its own node in the render's OfflineAudioContext with the roll's notes
// as its processor events (the way each device's own offline render does), and engine.js puts that node
// on its mixer strip in front of the shared ensemble and output chain, as the device sits live.
// The notes are the ones the roll sends live: on and off with a pitch and a velocity, except Dekatron,
// which the roll strikes with a trig per drum voice (paperroll-ui.js send()), so it gets the same here.
// What a device holds outside its patch comes from its host on the page (`extra`): Mote's loaded sound,
// Klystron's recording, Lattice's dropped table, Orthicon's picture, Heptode's song. Devices that play a
// piece or a world of their own (Trochotron, Heptode) render with that piece stopped: the roll's notes only.

import { voiceForNote } from './drums.js';
import { createDrumNode } from './drums-ui.js';
import { createLatticeNode } from './lattice-ui.js';
import { createThyNode } from './thyratron-ui.js';
import { createGleamNode } from './gleam-ui.js';
import { createMoteNode } from './mote-ui.js';
import { createHeptodeNode } from './heptode-ui.js';
import { createGeisslerNode } from './geissler-ui.js';
import { createPentagridNode } from './pentagrid-ui.js';
import { createOrthiconNode } from './orthicon-ui.js';
import { normalizeTrochotron } from './trochotron.js';
import { createTrochotronNode, pieceOf } from './trochotron-ui.js';
import { createGyrotronNode } from './gyrotron-ui.js';
import { createKlystronNode } from './klystron-ui.js';
import { createPhantastronNode } from './phantastron-ui.js';
import { createAdditronNode } from './additron-ui.js';
import { createRhumbatronNode } from './rhumbatron-ui.js';
import { createResnatronNode } from './resnatron-ui.js';

// id -> (ctx, patch, events in frames, extra) -> node (or Gleam's graph, whose `sum` is its output)
const MAKERS = {
  dekatron: (ctx, patch, ev) => createDrumNode(ctx, { patch, events: drumTrigs(ev), active: true }),
  lattice: (ctx, patch, ev, x) => createLatticeNode(ctx, { patch, events: ev, active: true, table: x.table || null }),
  thyratron: (ctx, patch, ev) => createThyNode(ctx, { patch, events: ev, active: true }),
  gleam: (ctx, patch, ev) => createGleamNode(ctx, { patch, events: ev, active: true }),
  mote: (ctx, patch, ev, x) => createMoteNode(ctx, { patch, events: ev, active: true, buffer: x.buffer || null }),
  heptode: (ctx, patch, ev, x) => createHeptodeNode(ctx, { patch, events: ev, active: true, score: x.score || null, playing: false }),
  geissler: (ctx, patch, ev) => createGeisslerNode(ctx, { patch, events: ev, active: true }),
  pentagrid: (ctx, patch, ev) => createPentagridNode(ctx, { patch, events: ev, active: true }),
  orthicon: (ctx, patch, ev, x) => createOrthiconNode(ctx, { patch, events: ev, active: true, grid: x.grid || null }),
  trochotron: (ctx, patch, ev) => {
    const p = normalizeTrochotron(patch);
    return createTrochotronNode(ctx, { patch: p, notes: pieceOf(p).notes, events: ev, active: true, playing: false });
  },
  gyrotron: (ctx, patch, ev) => createGyrotronNode(ctx, { patch, events: ev, active: true }),
  klystron: (ctx, patch, ev, x) => createKlystronNode(ctx, { patch, events: ev, active: true, buffer: x.buffer || null }),
  phantastron: (ctx, patch, ev) => createPhantastronNode(ctx, { patch, events: ev, active: true }),
  additron: (ctx, patch, ev) => createAdditronNode(ctx, { patch, events: ev, active: true }),
  rhumbatron: (ctx, patch, ev) => createRhumbatronNode(ctx, { patch, events: ev, active: true }),
  resnatron: (ctx, patch, ev) => createResnatronNode(ctx, { patch, events: ev, active: true }),
};

export const ROLL_HOSTED = Object.keys(MAKERS);

// The roll strikes Dekatron with a trig per drum voice; a note with no drum voice and every off are dropped.
export function drumTrigs(ev) {
  const out = [];
  (ev || []).forEach(e => {
    if (!e || e.t !== 'on') return;
    const voice = voiceForNote(e.n);
    if (voice) out.push({ t: 'trig', voice, v: e.v == null ? 0.9 : e.v, at: e.at });
  });
  return out;
}

// A hosted entry for renderOffline, or null when the device is not one this file builds.
// patch: the device's patch as the page has it now; extra: what its host holds outside the patch.
export function rollHosted(dev, events, patch, extra) {
  const make = MAKERS[dev];
  if (!make) return null;
  const x = extra || {};
  return { dev, events: (events || []).slice(), create: (ctx, framed) => make(ctx, JSON.parse(JSON.stringify(patch || {})), framed, x) };
}
