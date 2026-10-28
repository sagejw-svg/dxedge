// Filament filter response plot: the lab runs here, off the page's main thread, so a slow curve (a
// filter that rings fills the whole response) never holds up the frame loop. One lab per sample rate.
// Our own code.
import { createFilterLab } from './filtplot.js';

const labs = {};
self.onmessage = async e => {
  const m = e.data;
  try {
    const lab = await (labs[m.sr] || (labs[m.sr] = createFilterLab(m.sr, m.tubes, m.url)));
    lab.setPatch(m.patch);
    const r = lab.response(m.cutA, m.cutB);
    const tr = [r.a.buffer, r.sum.buffer]; if (r.b) tr.push(r.b.buffer);
    self.postMessage({ id: m.id, r: { sr: m.sr, route: r.route, f: r.f.slice(), a: r.a, b: r.b, sum: r.sum, ringA: r.ringA, ringB: r.ringB, cutA: r.cutA, cutB: r.cutB, ms: r.ms } }, tr);
  } catch (err) {
    if (labs[m.sr]) labs[m.sr].catch(() => { delete labs[m.sr]; });
    self.postMessage({ id: m.id, err: String((err && err.message) || err) });
  }
};
