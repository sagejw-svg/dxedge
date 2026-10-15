// A project is the rack's document: both device patches, the mixer, the tempo
// and which device the keyboard plays. It is plain JSON (kind 'dxrack', v 1).
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
import { normalizeStrip } from './mixer.js';
import { clampTempo, normalizeSig } from './transport.js';

export const PROJECT_SCHEMA = 1;
export const PROJECT_KEY = 'dxrack_project';

export function normalizeProject(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const device = src.device === 'cathode' || src.device === 'dekatron' || src.device === 'lattice' || src.device === 'thyratron' || src.device === 'gleam' || src.device === 'mote' || src.device === 'heptode' || src.device === 'geissler' || src.device === 'pentagrid' ? src.device : 'filament';
  const name = String(src.name == null ? 'Untitled' : src.name).trim().slice(0, 40) || 'Untitled';
  const mixerIn = src.mixer && typeof src.mixer === 'object' ? src.mixer : {};
  const ids = new Set(['filament', 'cathode']);
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
  return {
    v: PROJECT_SCHEMA, kind: 'dxrack', name,
    tempo: clampTempo(src.tempo == null ? 120 : src.tempo),
    timeSig: normalizeSig(src.timeSig),
    device,
    mixer,
    devices,
  };
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
