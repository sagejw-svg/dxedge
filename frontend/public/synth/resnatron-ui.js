// Resnatron on the page: a bay of cavities and cables you drag.
// Touch and mouse both go through pointer events.

import { getDevice } from './device.js';
import {
  RN_SPEC, RN_ORDER, RN_FACTORY, RN_DEFAULT, normalizeResnatron, shareOf,
} from './resnatron.js';

const WORKLET = new URL('./resnatron.worklet.js', import.meta.url).href;
const CABLE_COL = ['#e0a36a', '#f2d3a2', '#7ec8c3', '#d98b6a', '#c9b6ff', '#e7e2d4'];

export async function createResnatronNode(ctx, { patch, events, active, destination } = {}) {
  if (!ctx.__resnatron) { await ctx.audioWorklet.addModule(WORKLET); ctx.__resnatron = true; }
  const node = new AudioWorkletNode(ctx, 'resnatron', {
    numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
    processorOptions: { patch: normalizeResnatron(patch), events: events || [], active: active !== false },
  });
  if (destination) node.connect(destination);
  return node;
}

export async function renderResnatronBuffer({ patch, events = [], seconds = 1, sampleRate = 48000 } = {}) {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const ev = events.map(e => Object.assign({}, e, { at: Math.round((e.at || 0) * sampleRate) }));
  const node = await createResnatronNode(ctx, { patch, events: ev, active: true, destination: ctx.destination });
  const buf = await ctx.startRendering();
  try { node.disconnect(); } catch (e) { /* the context already dropped it */ }
  return buf;
}

const desc = getDevice('resnatron');
if (desc) {
  desc.messages = ['patch', 'on', 'off', 'bend', 'mw', 'sus', 'panic', 'active'];
  desc.create = async function create(ctx, host) {
    host = host || {};
    return createResnatronNode(ctx, {
      patch: host.patch, events: host.events, active: host.active !== false,
      destination: host.destination,
    });
  };
}

function isRack(engine) {
  return !!(engine && engine.api === 'dxrack/1' && typeof engine.addDevice === 'function');
}

export function createResnatronHost() {
  let node = null;
  let attaching = null;
  const pending = [];
  const meter = { voices: 0, notes: [], cpu: 0, peak: 0 };
  let onMeter = null;
  let patch = normalizeResnatron(RN_DEFAULT);
  function send(m) { if (node) node.port.postMessage(m); else pending.push(m); }
  return {
    meter: () => meter,
    setMeterListener(fn) { onMeter = fn; },
    node: () => node,
    async attach(audioCtx, destination, engine) {
      if (node) return node;
      if (attaching) return attaching;
      const rack = isRack(engine);
      attaching = createResnatronNode(audioCtx, { patch, active: true }).then(made => { node = made; return made; });
      try { node = await attaching; }
      finally { attaching = null; }
      node.port.onmessage = e => {
        const m = e.data;
        if (!m || m.t !== 'meter') return;
        Object.assign(meter, m);
        if (onMeter) onMeter(meter);
      };
      let mixed = false;
      if (rack) {
        try { engine.addDevice('resnatron', node, patch); mixed = true; }
        catch (e) { mixed = false; }
      }
      if (!mixed && destination) node.connect(destination);
      pending.splice(0).forEach(m => node.port.postMessage(m));
      return node;
    },
    setPatch(p) { patch = normalizeResnatron(p); send({ t: 'patch', p: patch }); },
    setActive(on) {
      send({ t: 'active', on: !!on });
      if (!on) { meter.voices = 0; meter.notes = []; meter.peak = 0; }
    },
    noteOn(n, v) { send({ t: 'on', n, v: v == null ? 0.8 : v }); },
    noteOff(n) { send({ t: 'off', n }); },
    bend(v) { send({ t: 'bend', v }); },
    mod(v) { send({ t: 'mw', v }); },
    sustain(on) { send({ t: 'sus', on: !!on }); },
    panic() { send({ t: 'panic' }); meter.voices = 0; meter.notes = []; meter.peak = 0; },
  };
}

function el(tag, attrs, text) {
  const n = document.createElement(tag);
  if (attrs) Object.keys(attrs).forEach(k => n.setAttribute(k, attrs[k]));
  if (text != null) n.textContent = text;
  return n;
}

function jackId(port) { return 'rnJ-' + port.replace(/\./g, '-'); }

export function mountResnatronPanel(container, hooks) {
  container.innerHTML = '';
  const play = el('section', { class: 'mod', id: 'mRnBay', 'data-full': '' });
  play.dataset.dev = 'resnatron';
  play.dataset.tab = 'play';
  const head = el('h3');
  head.innerHTML = '<span class="pilot"></span>Patch bay';
  const bar = el('div', { class: 'rn-bar' });
  const link = el('button', { type: 'button', class: 'btn small', id: 'rnLink' }, 'copy link');
  const unplug = el('button', { type: 'button', class: 'btn small', id: 'rnUnplug' }, 'unplug all');
  const level = el('input', { type: 'range', id: 'rnLevel', min: '0', max: '1', step: '0.01', 'aria-label': 'Level' });
  const levelLab = el('label', { class: 'rn-level' });
  levelLab.append(document.createTextNode('level '), level);
  bar.append(link, unplug, levelLab);
  const starters = el('div', { class: 'rn-bar', id: 'rnStarters' });
  RN_FACTORY.forEach(fp => {
    const b = el('button', { type: 'button', class: 'chip', 'data-rn-factory': fp.name }, fp.name);
    b.addEventListener('click', () => {
      if (hooks.wake) hooks.wake();
      apply(normalizeResnatron(fp));
    });
    starters.appendChild(b);
  });
  const bay = el('div', { id: 'rnBay' });
  const grid = el('div', { class: 'rn-grid', id: 'rnMods' });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('id', 'rnCables');
  svg.setAttribute('class', 'rn-cables');
  svg.setAttribute('aria-hidden', 'true');
  bay.append(grid, svg);
  const stat = el('div', { class: 'note', id: 'rnStat' }, 'Drag a gold jack onto a silver one. One cable lands on each input. Click a patched input to pull it.');
  play.append(head, bar, starters, bay, stat);
  container.appendChild(play);

  const controls = [];
  RN_ORDER.forEach(id => {
    const spec = RN_SPEC[id];
    const card = el('div', { class: 'rn-mod', 'data-mod': id });
    card.appendChild(el('b', { class: 'rn-name' }, spec.name));
    Object.keys(spec.params).forEach(key => {
      const meta = spec.params[key];
      const cid = 'rnP-' + id + '-' + key;
      if (meta.type === 'choice') {
        const sel = el('select', { id: cid, 'aria-label': spec.name + ' ' + key });
        meta.choices.forEach(c => sel.appendChild(el('option', { value: c }, c)));
        sel.addEventListener('change', () => commit(p => { p[id][key] = sel.value; }));
        sel.addEventListener('keydown', e => e.stopPropagation());
        const lab = el('label', { class: 'rn-field' });
        lab.append(el('span', {}, key), sel);
        card.appendChild(lab);
        controls.push({ id, key, el: sel, kind: 'choice' });
      } else if (meta.type === 'bool') {
        const b = el('button', { type: 'button', class: 'chip', id: cid, 'aria-pressed': 'false' }, key);
        b.addEventListener('click', () => commit(p => { p[id][key] = !p[id][key]; }));
        card.appendChild(b);
        controls.push({ id, key, el: b, kind: 'bool' });
      } else {
        const input = el('input', {
          type: 'range', id: cid, min: String(meta.min), max: String(meta.max),
          step: meta.type === 'int' ? '1' : (meta.max - meta.min > 20 ? '0.01' : '0.001'),
          'aria-label': spec.name + ' ' + key,
        });
        const val = el('b', { class: 'rn-val' }, '');
        input.addEventListener('input', () => {
          commit(p => { p[id][key] = meta.type === 'int' ? Math.round(+input.value) : +input.value; });
        });
        input.addEventListener('keydown', e => e.stopPropagation());
        const lab = el('label', { class: 'rn-field' });
        lab.append(el('span', {}, key), input, val);
        card.appendChild(lab);
        controls.push({ id, key, el: input, val, kind: meta.type });
      }
    });
    const jacks = el('div', { class: 'rn-jacks' });
    spec.outs.forEach(p => jacks.appendChild(jackEl(id, p, 'out')));
    spec.ins.forEach(p => jacks.appendChild(jackEl(id, p, 'in')));
    card.appendChild(jacks);
    grid.appendChild(card);
  });

  function jackEl(mod, port, kind) {
    const name = mod + '.' + port;
    const b = el('button', {
      type: 'button',
      class: 'rn-jack ' + kind,
      id: jackId(name),
      'data-port': name,
      'data-kind': kind,
      'aria-label': RN_SPEC[mod].name + ' ' + port,
    }, port);
    return b;
  }

  let arm = null;
  let drag = null;

  function current() { return normalizeResnatron(hooks.patch()); }
  function apply(next) {
    const p = hooks.patch();
    Object.keys(p).forEach(k => { if (!Object.prototype.hasOwnProperty.call(next, k)) delete p[k]; });
    Object.keys(next).forEach(k => { p[k] = next[k]; });
    if (hooks.edited) hooks.edited();
    hooks.host.setPatch(p);
    sync();
  }
  function commit(mutator) {
    const p = hooks.patch();
    mutator(p);
    apply(normalizeResnatron(p));
  }

  function center(node) {
    const a = node.getBoundingClientRect();
    const b = bay.getBoundingClientRect();
    return { x: a.left - b.left + a.width / 2, y: a.top - b.top + a.height / 2 };
  }
  function draw() {
    const w = bay.clientWidth;
    const h = bay.clientHeight;
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const cables = current().cables;
    cables.forEach((c, i) => {
      const a = document.getElementById(jackId(c.from));
      const b = document.getElementById(jackId(c.to));
      if (!a || !b) return;
      const p0 = center(a);
      const p1 = center(b);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const mid = (p0.y + p1.y) / 2;
      path.setAttribute('d', 'M ' + p0.x + ' ' + p0.y + ' C ' + p0.x + ' ' + mid + ', ' + p1.x + ' ' + mid + ', ' + p1.x + ' ' + p1.y);
      path.setAttribute('stroke', CABLE_COL[i % CABLE_COL.length]);
      path.setAttribute('stroke-width', '2.5');
      path.setAttribute('fill', 'none');
      svg.appendChild(path);
    });
    if (drag && drag.from) {
      const a = document.getElementById(jackId(drag.from));
      if (a) {
        const p0 = center(a);
        const box = bay.getBoundingClientRect();
        const x = drag.x - box.left;
        const y = drag.y - box.top;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M ' + p0.x + ' ' + p0.y + ' L ' + x + ' ' + y);
        path.setAttribute('stroke', '#f2d3a2');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-dasharray', '4 3');
        svg.appendChild(path);
      }
    }
    grid.querySelectorAll('.rn-jack').forEach(j => {
      j.classList.toggle('armed', j.dataset.port === arm);
      j.classList.toggle('patched', cables.some(c => c.from === j.dataset.port || c.to === j.dataset.port));
    });
  }
  function sync() {
    const p = current();
    if (document.activeElement !== level) level.value = String(p.level);
    controls.forEach(c => {
      if (document.activeElement === c.el) return;
      const v = p[c.id][c.key];
      if (c.kind === 'bool') {
        c.el.setAttribute('aria-pressed', String(!!v));
      } else if (c.kind === 'choice') c.el.value = v;
      else {
        c.el.value = String(v);
        if (c.val) c.val.textContent = typeof v === 'number' && !Number.isInteger(v) ? (Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2)) : String(v);
      }
    });
    stat.textContent = p.cables.length
      ? p.cables.length + (p.cables.length === 1 ? ' cable. ' : ' cables. ') + p.name + '. Drag a gold jack onto a silver one.'
      : 'No cables. The bay is quiet until you patch an output into Out. Drag a gold jack onto a silver one.';
    starters.querySelectorAll('[data-rn-factory]').forEach(b => {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-rn-factory') === p.name && JSON.stringify(normalizeResnatron(RN_FACTORY.find(f => f.name === p.name) || {})) === JSON.stringify(p)));
    });
    draw();
  }

  level.addEventListener('input', () => commit(p => { p.level = +level.value; }));
  level.addEventListener('keydown', e => e.stopPropagation());
  link.addEventListener('click', () => {
    const share = shareOf(current());
    const url = new URL(location.href);
    url.searchParams.set('rn', share);
    try { history.replaceState(null, '', url); } catch (e) { /* keep the string */ }
    const text = url.toString();
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {});
    if (hooks.toast) hooks.toast('Link copied. Same cables, same patch.');
  });
  unplug.addEventListener('click', () => {
    if (!current().cables.length) return;
    commit(p => { p.cables = []; });
    if (hooks.toast) hooks.toast('Every cable pulled.');
  });

  bay.addEventListener('pointerdown', e => {
    const jack = e.target.closest && e.target.closest('.rn-jack');
    if (!jack || !bay.contains(jack)) return;
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    try { jack.setPointerCapture(e.pointerId); } catch (err) { /* already captured */ }
    const kind = jack.dataset.kind;
    const port = jack.dataset.port;
    let from = null;
    if (kind === 'out') from = port;
    else {
      const hit = current().cables.find(c => c.to === port);
      if (hit) from = hit.from;
    }
    drag = { id: e.pointerId, port, kind, from, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, moved: false };
    if (hooks.wake) hooks.wake();
  });
  bay.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 5) drag.moved = true;
    drag.x = e.clientX;
    drag.y = e.clientY;
    draw();
  });
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const jack = under && under.closest ? under.closest('.rn-jack') : null;
    const port = jack ? jack.dataset.port : null;
    const kind = jack ? jack.dataset.kind : null;
    if (d.moved && d.from) {
      if (kind === 'in') commit(p => {
        p.cables = (p.cables || []).filter(c => c.to !== port);
        p.cables.push({ from: d.from, to: port });
      });
      else if (d.kind === 'in') commit(p => { p.cables = (p.cables || []).filter(c => c.to !== d.port); });
      else draw();
      return;
    }
    if (d.kind === 'out') arm = arm === d.port ? null : d.port;
    else if (d.kind === 'in') {
      if (arm) {
        const from = arm;
        arm = null;
        commit(p => {
          p.cables = (p.cables || []).filter(c => c.to !== d.port);
          p.cables.push({ from, to: d.port });
        });
        return;
      }
      if (current().cables.some(c => c.to === d.port)) {
        commit(p => { p.cables = (p.cables || []).filter(c => c.to !== d.port); });
        return;
      }
    }
    draw();
  }
  bay.addEventListener('pointerup', endDrag);
  bay.addEventListener('pointercancel', e => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    draw();
  });
  if (window.ResizeObserver) new ResizeObserver(() => draw()).observe(bay);
  window.addEventListener('resize', () => draw());
  sync();
  return { sync, draw };
}

export { shareOf, normalizeResnatron };
