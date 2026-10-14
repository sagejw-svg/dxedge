// Dekatron AudioWorklet. The synthesis lives in drums-dsp.js; this file is the processor
// the page (and an offline render) loads. 2x oversampling and the half-band decimator are
// inside the engine. Messages match drumDevice.messages in drums.js.

import { createDrumEngine, postDrum, renderDrum } from './drums-dsp.js';

class Dekatron extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.eng = createDrumEngine(sampleRate, o.patch || {});
    this.eng.active = o.active !== false;
    this.eng.onMeter = m => this.port.postMessage(m);
    this.eng.onStep = (step, length) => this.port.postMessage({ t: 'step', step, length, playing: !!this.eng.playing || !!this.eng.armed });
    (o.events || []).forEach(e => postDrum(this.eng, e));
    this.port.onmessage = e => { if (e.data) postDrum(this.eng, e.data); };
  }
  process(inputs, outputs) {
    const out = outputs[0];
    if (!out || !out[0]) return true;
    const L = out[0], R = out[1] || out[0];
    const eng = this.eng;
    // Asleep: the rack moved on, the pattern is stopped and every voice has finished.
    // A waiting drum machine should cost nothing.
    if (eng.active === false && !eng.playing && !eng.soon.length && !eng.queue.length) {
      let busy = false;
      const vs = eng.voices;
      for (const k in vs) if (vs[k].on) { busy = true; break; }
      if (!busy) {
        L.fill(0); if (R !== L) R.fill(0);
        return true;
      }
    }
    const tmpR = R === L ? new Float32Array(L.length) : R;
    renderDrum(eng, L, tmpR, currentFrame);
    if (R === L) { /* mono sink: the left channel already holds the render */ }
    return true;
  }
}

registerProcessor('dekatron', Dekatron);
