// PHASE 4. localStorage. Keys are locked: craneCab_hi, craneCab_ach, plus craneCab_settings.
// Every value is JSON with a v field. Migrate on version bump. Never throw on bad JSON.

const KEYS = { hi: 'craneCab_hi', ach: 'craneCab_ach', settings: 'craneCab_settings' };

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

export function load(ctx) {
  const s = read(KEYS.settings, null);
  if (s && s.v === 1) Object.assign(ctx.state.settings, s.data);
}

export function saveSettings(ctx) {
  try { localStorage.setItem(KEYS.settings, JSON.stringify({ v: 1, data: ctx.state.settings })); } catch {}
}
