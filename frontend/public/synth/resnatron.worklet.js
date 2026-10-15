// Resnatron AudioWorklet. The patch bay lives in resnatron-dsp.js.

import { createResnatronEngine, postResnatron, renderResnatron } from './resnatron-dsp.js';

class Resnatron extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.eng = createResnatronEngine(sampleRate, o.patch || {});
    this.eng.active = o.active !== false;
    this.eng.onMeter = m => this.port.postMessage(m);
    this.queue = (o.events || []).filter(e => e && e.at != null).sort((a, b) => a.at - b.at);
    this.port.onmessage = e => { if (e.data) postResnatron(this.eng, e.data); };
  }
  process(inputs, outputs) {
    const out = outputs[0];
    if (!out || !out[0]) return true;
    const L = out[0];
    const R = out[1] || out[0];
    const end = this.eng.played + L.length;
    while (this.queue.length && this.queue[0].at < end) postResnatron(this.eng, this.queue.shift());
    const t0 = Date.now();
    renderResnatron(this.eng, L, R);
    const used = Date.now() - t0;
    const blockMs = L.length / this.eng.sr * 1000;
    this.eng.cpu = blockMs > 0 ? Math.min(1, used / blockMs) : 0;
    return true;
  }
}

registerProcessor('resnatron', Resnatron);
