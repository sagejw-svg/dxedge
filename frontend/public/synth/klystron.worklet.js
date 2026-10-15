// Klystron AudioWorklet. The vocoder and the grains live in klystron-dsp.js.

import { createKlystronEngine, postKlystron, renderKlystron, setKlystronBuffer } from './klystron-dsp.js';

class Klystron extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.eng = createKlystronEngine(sampleRate, o.patch || {});
    this.eng.active = o.active !== false;
    if (o.buffer && o.buffer.L) setKlystronBuffer(this.eng, o.buffer.L, o.buffer.sr || sampleRate, o.buffer.name || 'buffer');
    this.eng.onMeter = m => this.port.postMessage(m);
    (o.events || []).forEach(e => postKlystron(this.eng, e));
    this.port.onmessage = e => { if (e.data) postKlystron(this.eng, e.data); };
  }
  process(inputs, outputs) {
    const out = outputs[0];
    if (!out || !out[0]) return true;
    const L = out[0];
    const stereo = !!(out[1] && out[1] !== L);
    const R = stereo ? out[1] : new Float32Array(L.length);
    const input = inputs[0];
    const ch = input && input[0];
    const ch1 = input && input[1];
    let mod = null;
    if (ch && ch.length) {
      if (ch1 && ch1 !== ch) {
        mod = new Float32Array(ch.length);
        const n = Math.min(ch.length, L.length);
        for (let i = 0; i < n; i++) mod[i] = 0.5 * (ch[i] + ch1[i]);
      } else mod = ch;
    }
    renderKlystron(this.eng, L, R, mod, currentFrame);
    if (!stereo) {
      for (let i = 0; i < L.length; i++) L[i] = 0.5 * (L[i] + R[i]);
    }
    return true;
  }
}

registerProcessor('klystron', Klystron);
