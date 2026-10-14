// Heptode AudioWorklet. The voice engine lives in heptode-dsp.js.

import { createHeptodeEngine, postHeptode, renderHeptode } from './heptode-dsp.js';

class Heptode extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.eng = createHeptodeEngine(sampleRate, o.patch || {});
    this.eng.active = o.active !== false;
    this.eng.onMeter = m => this.port.postMessage(m);
    if (o.score) postHeptode(this.eng, { t: 'score', score: o.score, bpm: o.score.bpm || 120 });
    if (o.playing) this.eng.playing = true;
    (o.events || []).forEach(e => postHeptode(this.eng, e));
    this.port.onmessage = e => { if (e.data) postHeptode(this.eng, e.data); };
  }
  process(inputs, outputs) {
    const out = outputs[0];
    if (!out || !out[0]) return true;
    renderHeptode(this.eng, out[0], out[1] || out[0]);
    return true;
  }
}

registerProcessor('heptode', Heptode);
