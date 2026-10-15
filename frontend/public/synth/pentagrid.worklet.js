// Pentagrid AudioWorklet. The receiver lives in pentagrid-dsp.js.

import { createRadioEngine, postRadio, renderRadio } from './pentagrid-dsp.js';

class Pentagrid extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.eng = createRadioEngine(sampleRate, o.patch || {});
    this.eng.active = o.active !== false;
    this.eng.awake = this.eng.active ? 1 : 0;
    this.eng.onMeter = m => this.port.postMessage(m);
    (o.events || []).forEach(e => postRadio(this.eng, e));
    this.port.onmessage = e => { if (e.data) postRadio(this.eng, e.data); };
  }
  process(inputs, outputs) {
    const out = outputs[0];
    if (!out || !out[0]) return true;
    const L = out[0];
    const R = out[1] || L;
    renderRadio(this.eng, L, R, currentFrame);
    return true;
  }
}

registerProcessor('pentagrid', Pentagrid);
