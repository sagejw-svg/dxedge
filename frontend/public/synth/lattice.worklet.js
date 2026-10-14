// Lattice AudioWorklet. The synthesis lives in lattice-dsp.js. This file is the
// processor the page and an offline render load. 2x oversampling and the
// half-band decimator are inside the engine.

import { createLatticeEngine, postLattice, renderBlock, MIPS, FRAMES, CYCLE } from './lattice-dsp.js';

const TABLE_LEN = MIPS * FRAMES * CYCLE;

class Lattice extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.eng = createLatticeEngine(sampleRate, o.patch || {});
    this.eng.active = o.active !== false;
    if (o.table && o.table.length === TABLE_LEN) this.eng.user = Float32Array.from(o.table);
    this.eng.onMeter = m => this.port.postMessage(m);
    (o.events || []).forEach(e => postLattice(this.eng, e));
    this.port.onmessage = e => { if (e.data) postLattice(this.eng, e.data); };
  }
  process(inputs, outputs) {
    const out = outputs[0];
    if (!out || !out[0]) return true;
    const L = out[0], R = out[1] || out[0];
    const eng = this.eng;
    if (eng.active === false && !eng.soon.length && !eng.queue.length) {
      let busy = false;
      for (let i = 0; i < eng.voices.length; i++) if (eng.voices[i].on) { busy = true; break; }
      if (!busy) {
        L.fill(0); if (R !== L) R.fill(0);
        return true;
      }
    }
    const tmpR = R === L ? new Float32Array(L.length) : R;
    renderBlock(eng, L, tmpR, currentFrame);
    return true;
  }
}

registerProcessor('lattice', Lattice);
