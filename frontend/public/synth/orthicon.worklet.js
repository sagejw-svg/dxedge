// Orthicon AudioWorklet. The spectral engine lives in orthicon-dsp.js.
// Processor 'orthicon' scans the spectrogram. Processor 'orthicon-capture'
// records a node (the microphone, or the rack output) into a buffer the page
// then analyses.

import { createOrthiconEngine, postOrthicon, renderOrthicon, setOrthiconGrid, COLS, ROWS } from './orthicon-dsp.js';

class Orthicon extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.eng = createOrthiconEngine(sampleRate, o.patch || {});
    this.eng.active = o.active !== false;
    if (o.grid && o.grid.length === COLS * ROWS) setOrthiconGrid(this.eng, o.grid);
    this.eng.onMeter = m => this.port.postMessage(m);
    (o.events || []).forEach(e => postOrthicon(this.eng, e));
    this.port.onmessage = e => { if (e.data) postOrthicon(this.eng, e.data); };
  }
  process(inputs, outputs) {
    const out = outputs[0];
    if (!out || !out[0]) return true;
    const L = out[0];
    const stereo = !!(out[1] && out[1] !== L);
    const R = stereo ? out[1] : new Float32Array(L.length);
    const eng = this.eng;
    if (eng.active === false && !eng.voices.length) {
      L.fill(0);
      if (stereo) R.fill(0);
      return true;
    }
    renderOrthicon(eng, L, R, currentFrame);
    if (!stereo) {
      for (let i = 0; i < L.length; i++) L[i] = 0.5 * (L[i] + R[i]);
    }
    return true;
  }
}

class OrthiconCapture extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    const seconds = Math.max(0.05, Math.min(8, +o.seconds || 3));
    this.max = Math.max(1, Math.round(seconds * sampleRate));
    this.L = new Float32Array(this.max);
    this.R = new Float32Array(this.max);
    this.n = 0;
    this.done = false;
    this.port.onmessage = e => { if (e.data && e.data.t === 'stop') this.finish(); };
  }
  finish() {
    if (this.done) return;
    this.done = true;
    const L = this.L.slice(0, this.n);
    const R = this.R.slice(0, this.n);
    this.port.postMessage({ t: 'done', sr: sampleRate, n: this.n, L, R });
  }
  process(inputs, outputs) {
    const out = outputs[0];
    if (out && out[0]) {
      out[0].fill(0);
      if (out[1]) out[1].fill(0);
    }
    if (this.done) return false;
    const input = inputs[0];
    const ch0 = input && input[0];
    if (!ch0 || !ch0.length) return true;
    const ch1 = (input && input[1]) || ch0;
    const take = Math.min(ch0.length, this.max - this.n);
    this.L.set(ch0.subarray(0, take), this.n);
    this.R.set(ch1.subarray(0, take), this.n);
    this.n += take;
    if (this.n >= this.max) this.finish();
    return true;
  }
}

registerProcessor('orthicon', Orthicon);
registerProcessor('orthicon-capture', OrthiconCapture);
