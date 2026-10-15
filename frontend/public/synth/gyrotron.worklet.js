// Gyrotron AudioWorklet. The sky and the voices live in gyrotron-dsp.js.
// Processor 'gyrotron'. One stereo output into the rack mixer.

import { createGyrotronEngine, postGyrotron, renderGyrotron } from './gyrotron-dsp.js';

class Gyrotron extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.eng = createGyrotronEngine(sampleRate, o.patch || {});
    this.eng.active = o.active !== false;
    this.eng.onMeter = m => this.port.postMessage(m);
    this.eng.onMidi = m => this.port.postMessage(m);
    (o.events || []).forEach(e => postGyrotron(this.eng, e));
    this.port.onmessage = e => { if (e.data) postGyrotron(this.eng, e.data); };
  }
  process(inputs, outputs) {
    const out = outputs[0];
    if (!out || !out[0]) return true;
    const L = out[0];
    const stereo = !!(out[1] && out[1] !== L);
    const R = stereo ? out[1] : new Float32Array(L.length);
    const eng = this.eng;
    if (eng.active === false && !eng.sounding && !eng.noteQ.length && !eng.queue.length) {
      L.fill(0);
      if (stereo) R.fill(0);
      return true;
    }
    renderGyrotron(eng, L, R);
    if (!stereo) {
      for (let i = 0; i < L.length; i++) L[i] = 0.5 * (L[i] + R[i]);
    }
    return true;
  }
}

registerProcessor('gyrotron', Gyrotron);
