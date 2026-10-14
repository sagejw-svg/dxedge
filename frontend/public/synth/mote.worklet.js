// Mote AudioWorklet. The grain engine lives in mote-dsp.js.
// Processor 'mote' plays the buffer. Processor 'mote-capture' records a node
// (the microphone, or the rack output) into a buffer the page then loads.

import { createMoteEngine, postMote, renderMote, setMoteBuffer } from './mote-dsp.js';

// True while the delay or the reverb still holds signal. An idle Mote keeps
// rendering until this falls away, so a freeze-and-release tail is heard and
// recorded instead of being replaced with silence.
function tailEnergy(eng) {
  const mix = eng.P && eng.P.tail && +eng.P.tail.mix;
  if (!(mix > 0) || !eng.delayL) return false;
  let e = Math.abs(eng.delayL.lp) + Math.abs(eng.delayR.lp);
  const lines = [eng.delayL, eng.delayR].concat(eng.fdn || []);
  for (let k = 0; k < lines.length; k++) {
    const buf = lines[k] && lines[k].buf;
    if (!buf) continue;
    const step = Math.max(1, buf.length >> 5);
    for (let i = 0; i < buf.length; i += step) e += Math.abs(buf[i]);
  }
  return e > 1e-4;
}

class Mote extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.eng = createMoteEngine(sampleRate, o.patch || {});
    this.eng.active = o.active !== false;
    if (o.buffer && o.buffer.L) setMoteBuffer(this.eng, o.buffer.L, o.buffer.R || o.buffer.L, o.buffer.sr || sampleRate, o.buffer.name || 'buffer');
    this.eng.onMeter = m => this.port.postMessage(m);
    (o.events || []).forEach(e => postMote(this.eng, e));
    this.port.onmessage = e => { if (e.data) postMote(this.eng, e.data); };
  }
  process(inputs, outputs) {
    const out = outputs[0];
    if (!out || !out[0]) return true;
    const L = out[0];
    // A shared or missing right buffer used to drop the right-hand mix, and
    // with it the delay and reverb, which are written into that buffer.
    const stereo = !!(out[1] && out[1] !== L);
    const R = stereo ? out[1] : new Float32Array(L.length);
    const eng = this.eng;
    if (eng.active === false) {
      let busy = false;
      for (let i = 0; i < eng.grains.length; i++) if (eng.grains[i].on) { busy = true; break; }
      if (!busy && !eng.soon.length && !eng.queue.length && !tailEnergy(eng)) {
        L.fill(0);
        if (stereo) R.fill(0);
        return true;
      }
    }
    renderMote(eng, L, R, currentFrame);
    if (!stereo) {
      for (let i = 0; i < L.length; i++) L[i] = 0.5 * (L[i] + R[i]);
    }
    return true;
  }
}

class MoteCapture extends AudioWorkletProcessor {
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

registerProcessor('mote', Mote);
registerProcessor('mote-capture', MoteCapture);
