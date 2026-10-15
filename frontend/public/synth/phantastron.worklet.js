// Phantastron AudioWorklet. The toy voice lives in phantastron-dsp.js.

import { createPhantastronEngine, postPhantastron, renderPhantastron } from './phantastron-dsp.js';

class Phantastron extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.eng = createPhantastronEngine(sampleRate, o.patch || {});
    this.eng.active = o.active !== false;
    this.queue = (o.events || []).filter(e => e && e.at != null).sort((a, b) => a.at - b.at);
    this.eng.onMeter = m => this.port.postMessage(m);
    this.port.onmessage = e => { if (e.data) this.apply(e.data); };
  }
  apply(msg) {
    postPhantastron(this.eng, msg);
  }
  process(inputs, outputs) {
    const out = outputs[0];
    if (!out || !out[0]) return true;
    const L = out[0];
    const R = out[1] || out[0];
    const end = this.eng.played + L.length;
    while (this.queue.length && this.queue[0].at < end) this.apply(this.queue.shift());
    if (!this.eng.active) {
      let busy = false;
      for (let i = 0; i < this.eng.voices.length; i++) {
        if (this.eng.voices[i].stage !== 'off') { busy = true; break; }
      }
      if (!busy) {
        L.fill(0);
        if (R !== L) R.fill(0);
        this.eng.played += L.length;
        return true;
      }
    }
    const t0 = Date.now();
    renderPhantastron(this.eng, L, R);
    const used = Date.now() - t0;
    const blockMs = L.length / this.eng.sr * 1000;
    this.eng.cpu = blockMs > 0 ? Math.min(1, used / blockMs) : 0;
    return true;
  }
}

registerProcessor('phantastron', Phantastron);
