// Fader readouts (graphics, 2 Nov; shared 4 Nov). A fader paints its value into a small recessed amber
// window (`.fread`, styled in desk.css) and into aria-valuetext. The hook sits on the input's own value
// setter, so a drag, a patch load, a project, a song or an engine sync all repaint it with no change at
// the callers. Display only: nothing here reads or writes a patch.

export const FREAD_FMT = {
  lvl: v => { if (v <= 0.0005) return 'off'; const d = 20 * Math.log10(v); return (Math.abs(d) < 0.05 ? '0.0' : d > -10 ? d.toFixed(1) : String(Math.round(d))) + ' dB'; },
  pan: v => Math.abs(v) < 0.005 ? 'C' : (v < 0 ? 'L' : 'R') + Math.round(Math.abs(v) * 100),
  pct: v => Math.round(v * 100) + '%',
  sec: v => v.toFixed(2) + ' s',
  ms: v => v < 0.9995 ? Math.round(v * 1000) + ' ms' : v.toFixed(2) + ' s',
  tempo: v => Math.round(v) + '%',
  bpm: v => Math.round(v) + ' BPM',
  hz: v => v < 999.5 ? Math.round(v) + ' Hz' : (v < 9995 ? (v / 1000).toFixed(1) : String(Math.round(v / 1000))) + ' kHz',
  rate: v => (v < 9.995 ? v.toFixed(2) : v.toFixed(1)) + '/s',
  int: v => String(Math.round(v)),
  morph: v => v <= 0.005 ? 'A' : v >= 0.995 ? 'B' : Math.round(v * 100) + '% B',
};

let VALUE = null;   // looked up on first use, so this module can load where there is no DOM

export function hookFader(inp, out, fmt) {
  if (!inp || !out || inp.__fread) return;
  if (!VALUE) VALUE = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  inp.__fread = true;
  let last = null;
  const paint = () => {
    const t = fmt(+VALUE.get.call(inp));
    if (t === last) return;
    last = t;
    out.textContent = t;
    inp.setAttribute('aria-valuetext', t);
  };
  Object.defineProperty(inp, 'value', { configurable: true, enumerable: true,
    get() { return VALUE.get.call(this); }, set(v) { VALUE.set.call(this, v); paint(); } });
  inp.addEventListener('input', paint);
  inp.addEventListener('change', paint);
  paint();
}

// Make the window, put it right after the fader (inside the fader's label) and hook it.
export function addFread(inp, fmt, id) {
  const out = document.createElement('output');
  out.className = 'fread';
  out.setAttribute('aria-hidden', 'true');
  if (id) out.id = id;
  else if (inp.id) out.id = inp.id + 'V';
  inp.insertAdjacentElement('afterend', out);
  hookFader(inp, out, fmt);
  return out;
}
