// PHASE 4. localStorage. Keys are locked by the Notion Locked decisions:
// craneCab_hi, craneCab_ach, plus craneCab_settings. Every value is JSON with a
// v field and migrates on bump.
//
// Nothing here may throw and nothing here may trust what it reads. A hand-edited
// key, a truncated write, a value from a future version, an array where an object
// belongs: every one of those degrades to the default for that key and leaves the
// rest alone. The game booting is worth more than any saved record.
//
// It listens for what to persist rather than being called by other systems, so
// nothing imports it but main.js.

import { MISSIONS } from '../data/missions.js';

const KEYS = { hi: 'craneCab_hi', ach: 'craneCab_ach', settings: 'craneCab_settings' };
const V = 1;
// Derived, not written out. Two hardcoded 3s used to cap furthest at the last
// mission that existed when this was written, one of them on the write path, so
// adding a fifth mission would have silently pinned resume progress forever.
const LAST_MISSION = MISSIONS.length - 1;
const UNDATED = '?';         // an award whose stored date did not survive inspection

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    if (parsed.v !== V) return null;              // a future or older shape: ignore, do not crash
    return parsed.data;
  } catch { return null; }
}

// Returns whether it stuck. A refused write used to be swallowed whole while the
// in-memory progress carried on as if it had worked, so in private browsing every
// card claimed unlocks and a personal best and the whole run evaporated on
// refresh with nothing anywhere having said so.
function write(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ v: V, data }));
    return true;
  } catch {
    return false;                                 // full, blocked, or no storage
  }
}

const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);

// A best is only a best if every field survives inspection.
function cleanBest(rec) {
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return null;
  const elapsed = num(rec.elapsed);
  if (elapsed === null || elapsed < 0) return null;
  return {
    elapsed,
    grade: typeof rec.grade === 'string' ? rec.grade.slice(0, 2) : null,
    landingError: num(rec.landingError),
    maxSway: num(rec.maxSway)
  };
}

export function load(ctx) {
  const { state } = ctx;

  const s = read(KEYS.settings);
  if (s && typeof s === 'object') {
    if (typeof s.units === 'string') state.settings.units = s.units === 'metric' ? 'metric' : 'imperial';
    if (typeof s.mute === 'boolean') state.settings.mute = s.mute;
    const sens = num(s.sensitivity);
    if (sens !== null) state.settings.sensitivity = Math.min(3, Math.max(0.1, sens));
    const damp = num(s.damping);
    if (damp !== null) state.settings.damping = Math.min(1, Math.max(0, damp));
  }

  const ach = read(KEYS.ach) || {};
  const out = {};
  if (ach && typeof ach === 'object' && !Array.isArray(ach)) {
    // A key that is present at all means the award was earned. Requiring the
    // value to be a string meant a hand edited or truncated date handed the
    // achievement back to be won a second time. The placeholder has to be
    // truthy: both of the "never re-award" guards are truthiness tests, so an
    // empty string would have left the same hole with more code around it.
    const awards = ach.awards;
    if (awards && typeof awards === 'object' && !Array.isArray(awards)) {
      Object.keys(awards).forEach((k) => {
        if (!k) return;
        out[k] = typeof awards[k] === 'string' && awards[k] ? awards[k] : UNDATED;
      });
    }
    state.progress.hooks = Math.max(0, num(ach.hooks) || 0);
    const f = num(ach.furthest);
    state.progress.furthest = f === null ? 0 : Math.min(LAST_MISSION, Math.max(0, Math.round(f)));
  }
  state.progress.achievements = out;

  const hi = read(KEYS.hi) || {};
  const best = {};
  if (hi && typeof hi === 'object' && !Array.isArray(hi)) {
    Object.keys(hi).forEach((k) => {
      const id = Number(k);
      if (!Number.isInteger(id)) return;
      const rec = cleanBest(hi[k]);
      if (rec) best[id] = rec;
    });
  }
  state.progress.best = best;

}

export function init(ctx) {
  const { state, bus } = ctx;

  bus.on('achievement.earned', (p) => {
    if (!p || typeof p.name !== 'string') return;
    if (state.progress.achievements[p.name]) return;
    state.progress.achievements[p.name] = new Date().toISOString().slice(0, 10);
    persistAch(state);
  });

  bus.on('lift.hooked.count', (p) => {
    const n = p && num(p.hooks);
    if (n === null) return;
    state.progress.hooks = n;
    persistAch(state);
  });

  bus.on('lift.best', (p) => {
    if (!p || !Number.isInteger(p.id)) return;
    const rec = cleanBest(p.record);
    if (!rec) return;
    state.progress.best[p.id] = rec;
    if (!write(KEYS.hi, state.progress.best)) state.progress.savedOk = false;
  });

  bus.on('mission.furthest', (p) => {
    const n = p && num(p.id);
    if (n === null) return;
    if (n <= state.progress.furthest) return;
    state.progress.furthest = Math.min(LAST_MISSION, Math.round(n));
    persistAch(state);
  });

  bus.on('settings.changed', () => saveSettings(ctx));
}

function persistAch(state) {
  const ok = write(KEYS.ach, {
    awards: state.progress.achievements,
    hooks: state.progress.hooks,
    furthest: state.progress.furthest
  });
  if (!ok) state.progress.savedOk = false;
}

export function saveSettings(ctx) {
  if (!write(KEYS.settings, ctx.state.settings)) ctx.state.progress.savedOk = false;
}

// Test seam. The suite has no localStorage, so it drives these directly.
export const _keys = KEYS;
