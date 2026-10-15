// Additron AudioWorklet. The additive organ lives in additron-dsp.js.

import { createAdditronEngine, postAdditron, renderAdditron } from './additron-dsp.js';

class Additron extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.eng = createAdditronEngine(sampleRate, o.patch || {});
    this.eng.active = o.active !== false;
    this.queue = (o.events || []).filter(e => e && e.at != null).sort((a, b) => a.at - b.at);
    this.eng.onMeter = null;
    this.port.onmessage = e => { if (e.data) postAdditron(this.eng, e.data); };
  }
  process(inputs, outputs) {
    const out = outputs[0];
    if (!out || !out[0]) return true;
    const L = out[0];
    const stereo = !!(out[1] && out[1] !== L);
    const R = stereo ? out[1] : new Float32Array(L.length);
    const end = this.eng.played + L.length;
    while (this.queue.length && this.queue[0].at < end) postAdditron(this.eng, this.queue.shift());
    if (this.eng.active === false) {
      let busy = false;
      const voices = this.eng.voices;
      for (let i = 0; i < voices.length; i++) if (!voices[i].dead) { busy = true; break; }
      if (!busy) {
        L.fill(0);
        if (stereo) R.fill(0);
        this.eng.played += L.length;
        this.eng.sounding = 0;
        return true;
      }
    }
    const t0 = Date.now();
    renderAdditron(this.eng, L, R);
    if (!stereo) {
      for (let i = 0; i < L.length; i++) L[i] = 0.5 * (L[i] + R[i]);
    }
    const used = Date.now() - t0;
    const blockMs = L.length / this.eng.sr * 1000;
    const cpu = blockMs > 0 ? Math.min(1, used / blockMs) : 0;
    if (this.eng.meterN >= 2048) {
      this.eng.meterN = 0;
      this.port.postMessage({
        t: 'meter',
        voices: this.eng.sounding,
        peak: this.eng.peak,
        cpu,
        level: this.eng.P.level,
      });
    }
    return true;
  }
}

registerProcessor('additron', Additron);
