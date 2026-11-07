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

// Canvas lettering in the house face (graphics, 7 Nov). Panels paint their canvas text with the page's
// --font-mono stack, the face of every chip, knob and readout, never the browser's sans-serif. Looked up
// once, after the page's style is in, so a frame loop can call it freely.
let HOUSE = '';
export function houseFont() {
  if (!HOUSE && typeof document !== 'undefined' && document.body) {
    HOUSE = (getComputedStyle(document.body).getPropertyValue('--font-mono') || '').trim();
  }
  return HOUSE || 'ui-monospace, monospace';
}

// A recessed amber readout window drawn on a canvas, the `.fread` finish in desk.css: near-black glass,
// a dark rim, a faint lit edge under it, and warm text with a soft glow. x, y is the top left; s is the
// canvas's pixels per CSS pixel; align 'center' puts x at the window's middle. Returns the window's width.
export function canvasReadout(c, text, x, y, s, size, align) {
  const fs = (size || 11) * s;
  c.save();
  c.font = fs + 'px ' + houseFont();
  c.textAlign = 'left'; c.textBaseline = 'middle';
  const padX = 6 * s, hgt = Math.round(fs * 1.6), wid = Math.ceil(c.measureText(text).width + padX * 2), r = 3 * s;
  if (align === 'center') x = Math.round(x - wid / 2);
  const g = c.createLinearGradient(0, y, 0, y + hgt);
  g.addColorStop(0, '#050403'); g.addColorStop(1, '#0d0a06');
  c.beginPath();
  if (c.roundRect) c.roundRect(x, y, wid, hgt, r); else c.rect(x, y, wid, hgt);
  c.fillStyle = g; c.fill();
  c.lineWidth = Math.max(1, s); c.strokeStyle = '#000'; c.stroke();
  c.strokeStyle = 'rgba(255,236,210,0.10)';
  c.beginPath(); c.moveTo(x + r, y + hgt + s * 0.5); c.lineTo(x + wid - r, y + hgt + s * 0.5); c.stroke();
  c.fillStyle = '#ffd08a'; c.shadowColor = 'rgba(255,170,60,0.45)'; c.shadowBlur = 5 * s;
  c.fillText(text, x + padX, y + hgt / 2 + s * 0.5);
  c.restore();
  return wid;
}

// An engraved caption on a canvas: spaced capitals, a dark cut under light letters, like the section
// names on the panels. Returns the caption's width.
export function canvasEngrave(c, text, x, y, s, opt) {
  const o = opt || {};
  c.save();
  c.font = (o.bold === false ? '' : '600 ') + ((o.size || 10) * s) + 'px ' + houseFont();
  c.textAlign = o.align || 'left'; c.textBaseline = 'middle';
  if ('letterSpacing' in c) c.letterSpacing = ((o.spacing == null ? 2 : o.spacing) * s) + 'px';
  const t = String(text).toUpperCase();
  c.fillStyle = 'rgba(0,0,0,0.75)';
  c.fillText(t, x, y + s);
  c.fillStyle = o.color || 'rgba(236, 214, 188, 0.88)';
  c.fillText(t, x, y);
  const wid = c.measureText(t).width;
  if ('letterSpacing' in c) c.letterSpacing = '0px';
  c.restore();
  return wid;
}

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
