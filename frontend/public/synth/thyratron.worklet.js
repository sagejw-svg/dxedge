// Thyratron AudioWorklet. The voice lives in thyratron-dsp.js. This file is the
// processor the page and an offline render load. 2x oversampling and the
// half-band decimator are inside the engine.

import { createThyEngine, postThy, renderThy } from './thyratron-dsp.js';

class Thyratron extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.eng = createThyEngine(sampleRate, o.patch || {});
    this.eng.active = o.active !== false;
    this.eng.onMeter = m => this.port.postMessage(m);
    (o.events || []).forEach(e => postThy(this.eng, e));
    this.port.onmessage = e => { if (e.data) postThy(this.eng, e.data); };
  }
  process(inputs, outputs) {
    const out = outputs[0];
    if (!out || !out[0]) return true;
    const L = out[0];
    const R = out[1] || L;
    renderThy(this.eng, L, R, currentFrame);
    return true;
  }
}

registerProcessor('thyratron', Thyratron);
