// A mix session is the desk: which devices the keyboard plays, each strip,
// and the shared reverb and delay. It is plain JSON (kind 'dxmix', v 1).
// The page keeps one in localStorage and can download or upload the same file.
// Patches, tempo and the master insert stay on the project. This file does
// not touch the DOM or the audio graph.

import { normalizeStrip, normalizeBus } from './mixer.js';

export const SESSION_SCHEMA = 1;
export const SESSION_KEY = 'dxmix_session';

// Letters match the strip ids already on the rack (mixFLvl, mixCLvl, …).
export const MIX_CHANNELS = [
  { id: 'filament', letter: 'F', name: 'Filament' },
  { id: 'cathode', letter: 'C', name: 'Cathode' },
  { id: 'dekatron', letter: 'D', name: 'Dekatron' },
  { id: 'lattice', letter: 'L', name: 'Lattice' },
  { id: 'thyratron', letter: 'T', name: 'Thyratron' },
  { id: 'gleam', letter: 'G', name: 'Gleam' },
  { id: 'mote', letter: 'M', name: 'Mote' },
  { id: 'heptode', letter: 'H', name: 'Heptode' },
  { id: 'geissler', letter: 'Z', name: 'Geissler' },
  { id: 'pentagrid', letter: 'P', name: 'Pentagrid' },
  { id: 'orthicon', letter: 'O', name: 'Orthicon' },
  { id: 'trochotron', letter: 'X', name: 'Trochotron' },
  { id: 'gyrotron', letter: 'Y', name: 'Gyrotron' },
  { id: 'klystron', letter: 'K', name: 'Klystron' },
  { id: 'phantastron', letter: 'Q', name: 'Phantastron' },
  { id: 'additron', letter: 'N', name: 'Additron' },
  { id: 'rhumbatron', letter: 'R', name: 'Rhumbatron' },
  { id: 'resnatron', letter: 'S', name: 'Resnatron' },
];

const IDS = new Set(MIX_CHANNELS.map(c => c.id));

export function normalizeArmed(list) {
  const out = [];
  const seen = new Set();
  (Array.isArray(list) ? list : []).forEach(id => {
    const s = String(id || '');
    if (!IDS.has(s) || seen.has(s)) return;
    seen.add(s);
    out.push(s);
  });
  return out;
}

// No armed channel: the keyboard follows the device lit on the rail.
// One armed channel plays that device. Several armed channels all play.
export function routeTargets(selected, armed) {
  const list = normalizeArmed(armed);
  if (list.length) return list;
  return [IDS.has(selected) ? selected : 'filament'];
}

export function normalizeSession(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const name = String(src.name == null ? 'Mix' : src.name).trim().slice(0, 40) || 'Mix';
  const incoming = src.channels && typeof src.channels === 'object' ? src.channels : {};
  const channels = {};
  MIX_CHANNELS.forEach(c => { channels[c.id] = normalizeStrip(incoming[c.id]); });
  return {
    v: SESSION_SCHEMA,
    kind: 'dxmix',
    name,
    armed: normalizeArmed(src.armed),
    bus: normalizeBus(src.bus),
    channels,
  };
}

export function saveSession(storage, session) {
  storage.setItem(SESSION_KEY, JSON.stringify(normalizeSession(session)));
}

export function loadSession(storage) {
  try {
    const text = storage.getItem(SESSION_KEY);
    if (!text) return null;
    const raw = JSON.parse(text);
    if (!raw || typeof raw !== 'object') return null;
    return normalizeSession(raw);
  } catch (e) { return null; }
}

export function sessionFileName(session) {
  const raw = session && session.name ? String(session.name) : 'mix';
  const slug = raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'mix';
  return 'mix-' + slug + '.json';
}
