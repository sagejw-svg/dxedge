// Shared control size and fine slider editing for the synth pages.
// The choice is one value for the whole site (S, M, L, XL) and it stays in this browser.

export const UI_SIZES = ['s', 'm', 'l', 'xl'];
export const UI_KEY = 'dxedge_ui_size';

export function pickUiSize(saved, width) {
  if (UI_SIZES.includes(saved)) return saved;
  return (width || 0) >= 1600 ? 'l' : 'm';
}

export function readUiSize(storage, width) {
  let saved = null;
  try { saved = storage && storage.getItem(UI_KEY); } catch (e) { saved = null; }
  return pickUiSize(saved, width == null ? (typeof window !== 'undefined' ? window.innerWidth : 1366) : width);
}

export function applyUiSize(size, root) {
  const el = root || document.documentElement;
  const next = UI_SIZES.includes(size) ? size : 'm';
  el.setAttribute('data-ui', next);
  return next;
}

export function mountUiSize(host, storage) {
  if (!host) return null;
  const store = storage || localStorage;
  function paint(size) {
    host.querySelectorAll('[data-ui-size]').forEach(b => {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-ui-size') === size));
    });
  }
  const current = readUiSize(store, window.innerWidth);
  applyUiSize(current);
  paint(current);
  host.addEventListener('click', e => {
    const b = e.target.closest('[data-ui-size]');
    if (!b || !host.contains(b)) return;
    const size = b.getAttribute('data-ui-size');
    if (!UI_SIZES.includes(size)) return;
    try { store.setItem(UI_KEY, size); } catch (err) {}
    applyUiSize(size);
    paint(size);
  });
  return { get: () => document.documentElement.getAttribute('data-ui') };
}

function stepOf(el, fine) {
  const min = Number(el.min);
  const max = Number(el.max);
  const span = (isFinite(max) ? max : 100) - (isFinite(min) ? min : 0);
  const raw = Number(el.step);
  const base = raw > 0 ? raw : (span > 0 ? span / 100 : 1);
  return fine ? base / 5 : base;
}

function nudge(el, dir, fine) {
  const min = isFinite(Number(el.min)) ? Number(el.min) : -Infinity;
  const max = isFinite(Number(el.max)) ? Number(el.max) : Infinity;
  const next = Math.min(max, Math.max(min, Number(el.value) + dir * stepOf(el, fine)));
  const digits = (String(el.step).split('.')[1] || '').length;
  el.value = digits ? String(Number(next.toFixed(Math.min(digits + 1, 6)))) : String(next);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function fineKey(e) {
  if (!e.shiftKey) return;
  const dir = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
  if (!dir) return;
  e.preventDefault();
  e.stopPropagation();
  nudge(e.currentTarget, dir, true);
}

function fineWheel(e) {
  if (document.activeElement !== e.currentTarget) return;
  e.preventDefault();
  e.stopPropagation();
  nudge(e.currentTarget, e.deltaY > 0 ? -1 : 1, e.shiftKey);
}

// Arrow keys already move a range. Shift makes that step smaller, and the wheel
// works once the slider has focus so a scroll of the page does not grab it.
export function bindFineControls(root) {
  const scope = root || document;
  scope.querySelectorAll('input[type="range"]').forEach(el => {
    if (el.dataset.fine === '1') return;
    el.dataset.fine = '1';
    if (!el.title) {
      const label = el.getAttribute('aria-label') || 'Slider';
      el.title = label + '. Arrow keys change it. Hold Shift for a finer step. The mouse wheel works while the slider is focused.';
    }
    el.addEventListener('keydown', fineKey);
    el.addEventListener('wheel', fineWheel, { passive: false });
  });
}
