// A project is the rack's document: both device patches, the mixer, the tempo,
// which device the keyboard plays and the paper roll. It is plain JSON (kind 'dxrack', v 1).
// The page keeps one in localStorage and can download or upload the same file.
//
// These functions do not touch the DOM or the audio graph. The page applies a
// project by handing the patches to the devices and the mixer and tempo to the host.

import { normalize } from './patches.js';
import { normalizeC } from './cathode.js';
import { normalizeMote } from './mote.js';
import { normalizeHeptode } from './heptode.js';
import { normalizeGeissler } from './geissler.js';
import { normalizePentagrid } from './pentagrid.js';
import { normalizeOrthicon } from './orthicon.js';
import { normalizeTrochotron } from './trochotron.js';
import { normalizeGyrotron } from './gyrotron.js';
import { normalizeKlystron } from './klystron.js';
import { normalizePhantastron } from './phantastron.js';
import { normalizeAdditron } from './additron.js';
import { normalizeRhumbatron } from './rhumbatron.js';
import { normalizeResnatron } from './resnatron.js';
import { normalizeStrip, normalizeBus } from './mixer.js';
import { normalizeArmed, MIX_CHANNELS } from './mixsession.js';
import { clampTempo, normalizeSig } from './transport.js';
import { normalizeRoll, normalizeChain } from './paperroll.js';

export const PROJECT_SCHEMA = 1;
export const PROJECT_KEY = 'dxrack_project';

// The paper roll in the project (17 Nov 2026): its pattern, the device it plays ('lit' is the device lit on
// the rail) and its run switch. Optional: a project saved before 17 Nov has no roll, and loading one leaves
// the roll as it is. A file's dest is a plain device id or 'lit'; the strip checks it against the rack again
// when it applies the project. Since 18 Nov a roll may also carry `chain` (song mode: rolls by name, each
// with a copy of its pattern), still v 1.
export function normalizeProjectRoll(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
  const dest = typeof r.dest === 'string' && /^[a-z][a-z0-9]{0,31}$/.test(r.dest) ? r.dest : 'lit';
  const out = { pat: normalizeRoll(r.pat), dest, run: r.run === true };
  // the chain (18 Nov): optional too; a project saved before has none and leaves the chain as it is
  if (r.chain && typeof r.chain === 'object' && !Array.isArray(r.chain)) out.chain = normalizeChain(r.chain);
  return out;
}

export function normalizeProject(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const device = src.device === 'cathode' || src.device === 'dekatron' || src.device === 'lattice' || src.device === 'thyratron' || src.device === 'gleam' || src.device === 'mote' || src.device === 'heptode' || src.device === 'geissler' || src.device === 'pentagrid' || src.device === 'orthicon' || src.device === 'trochotron' || src.device === 'gyrotron' || src.device === 'klystron' || src.device === 'phantastron' || src.device === 'additron' || src.device === 'rhumbatron' || src.device === 'resnatron' ? src.device : 'filament';
  const name = String(src.name == null ? 'Untitled' : src.name).trim().slice(0, 40) || 'Untitled';
  const mixerIn = src.mixer && typeof src.mixer === 'object' ? src.mixer : {};
  // Every rack strip, as a mix session does: a strip the file does not carry (a project saved before
  // that device existed) loads at its defaults instead of keeping the page's mute or solo (review R1120-1).
  const ids = new Set(['filament', 'cathode'].concat(MIX_CHANNELS.map(c => c.id)));
  Object.keys(mixerIn).forEach(k => { if (k && String(k).length < 40) ids.add(String(k)); });
  const mixer = {};
  ids.forEach(id => { mixer[id] = normalizeStrip(mixerIn[id]); });
  const devs = src.devices && typeof src.devices === 'object' ? src.devices : {};
  const fil = devs.filament && devs.filament.patch;
  const cat = devs.cathode && devs.cathode.patch;
  const devices = {
    filament: { patch: normalize(fil) },
    cathode: { patch: normalizeC(cat) },
  };
  if (devs.mote) devices.mote = { patch: normalizeMote(devs.mote.patch) };
  if (devs.heptode) devices.heptode = { patch: normalizeHeptode(devs.heptode.patch) };
  if (devs.geissler) devices.geissler = { patch: normalizeGeissler(devs.geissler.patch) };
  if (devs.pentagrid) devices.pentagrid = { patch: normalizePentagrid(devs.pentagrid.patch) };
  if (devs.orthicon) devices.orthicon = { patch: normalizeOrthicon(devs.orthicon.patch) };
  if (devs.trochotron) devices.trochotron = { patch: normalizeTrochotron(devs.trochotron.patch) };
  if (devs.gyrotron) devices.gyrotron = { patch: normalizeGyrotron(devs.gyrotron.patch) };
  if (devs.klystron) devices.klystron = { patch: normalizeKlystron(devs.klystron.patch) };
  if (devs.phantastron) devices.phantastron = { patch: normalizePhantastron(devs.phantastron.patch) };
  if (devs.additron) devices.additron = { patch: normalizeAdditron(devs.additron.patch) };
  if (devs.rhumbatron) devices.rhumbatron = { patch: normalizeRhumbatron(devs.rhumbatron.patch) };
  if (devs.resnatron) devices.resnatron = { patch: normalizeResnatron(devs.resnatron.patch) };
  const out = {
    v: PROJECT_SCHEMA, kind: 'dxrack', name,
    tempo: clampTempo(src.tempo == null ? 120 : src.tempo),
    timeSig: normalizeSig(src.timeSig),
    device,
    mixer,
    armed: normalizeArmed(src.armed),
    bus: normalizeBus(src.bus),
    devices,
  };
  const roll = normalizeProjectRoll(src.roll);
  if (roll) out.roll = roll;
  return out;
}

export function saveLocal(storage, project) {
  storage.setItem(PROJECT_KEY, JSON.stringify(normalizeProject(project)));
}

export function loadLocal(storage) {
  try {
    const text = storage.getItem(PROJECT_KEY);
    if (!text) return null;
    const raw = JSON.parse(text);
    if (!raw || typeof raw !== 'object') return null;
    return normalizeProject(raw);
  } catch (e) { return null; }
}

export function projectFileName(project) {
  const raw = project && project.name ? String(project.name) : 'project';
  const slug = raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'project';
  return 'filament-' + slug + '.json';
}
