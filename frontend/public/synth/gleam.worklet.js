// Gleam AudioWorklet. The voices live in gleam-dsp.js. Output 0 is the stereo
// mix (pan included). Outputs 1..8 are the same voices, one each, used only
// when the page asks for per-orb HRTF.

import { VOICE_COUNT, createGleamEngine, postGleam, renderGleam } from './gleam-dsp.js';

class Gleam extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.eng = createGleamEngine(sampleRate, o.patch || {});
    this.eng.active = o.active !== false;
    this.eng.hrtf = !!(o.patch && o.patch.hrtf);
    this.eng.onMeter = m => this.port.postMessage(m);
    this.slots = [];
    for (let i = 0; i < VOICE_COUNT; i++) this.slots.push(new Float32Array(128));
    this.wetL = new Float32Array(128);
    this.wetR = new Float32Array(128);
    (o.events || []).forEach(e => postGleam(this.eng, e));
    this.port.onmessage = e => { if (e.data) postGleam(this.eng, e.data); };
  }
  process(inputs, outputs) {
    const mix = outputs[0];
    if (!mix || !mix[0]) return true;
    const L = mix[0];
    const R = mix[1] || L;
    const n = L.length;
    const eng = this.eng;
    let busy = eng.soon.length || eng.queue.length;
    if (!busy) {
      const vs = eng.voices;
      for (let i = 0; i < vs.length; i++) if (vs[i].alive) { busy = true; break; }
      if (Math.abs(eng.dampL) > 1e-5 || Math.abs(eng.dampR) > 1e-5) busy = true;
    }
    if (!eng.active && !busy) {
      L.fill(0);
      if (R !== L) R.fill(0);
      const wet = outputs[VOICE_COUNT + 1];
      if (wet && wet[0]) { wet[0].fill(0); if (wet[1]) wet[1].fill(0); }
      return true;
    }
    if (this.slots[0].length !== n) {
      for (let i = 0; i < VOICE_COUNT; i++) this.slots[i] = new Float32Array(n);
      this.wetL = new Float32Array(n);
      this.wetR = new Float32Array(n);
    }
    const tmpR = R === L ? new Float32Array(n) : R;
    renderGleam(eng, L, tmpR, eng.hrtf ? this.slots : null, currentFrame, this.wetL, this.wetR);
    if (R !== L && tmpR !== R) R.set(tmpR);
    const wet = outputs[VOICE_COUNT + 1];
    if (wet && wet[0]) {
      wet[0].set(this.wetL);
      if (wet[1]) wet[1].set(this.wetR);
    }
    if (eng.hrtf) {
      for (let s = 0; s < VOICE_COUNT; s++) {
        const out = outputs[s + 1];
        if (!out || !out[0]) continue;
        out[0].set(this.slots[s]);
        if (out[1]) out[1].set(this.slots[s]);
      }
    }
    return true;
  }
}

registerProcessor('gleam', Gleam);
