// Trochotron AudioWorklet. The voice and the score clock live in trochotron-dsp.js.

import { createTrochotronEngine, postTrochotron, renderTrochotron, takeEdges, armScore } from './trochotron-dsp.js';

class Trochotron extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.eng = createTrochotronEngine(sampleRate, o.patch || {});
    this.eng.active = o.active !== false;
    this.eng.notes = o.notes || [];
    armScore(this.eng, this.eng.notes, false);
    this.eng.playing = !!o.playing;
    this.queue = (o.events || []).filter(e => e && e.at != null).sort((a, b) => a.at - b.at);
    this.eng.onMeter = m => this.port.postMessage(m);
    this.port.onmessage = e => { if (e.data) this.apply(e.data); };
  }
  apply(msg) {
    postTrochotron(this.eng, msg);
    const edges = takeEdges(this.eng);
    if (edges) this.port.postMessage({ t: 'edges', edges });
  }
  process(inputs, outputs) {
    const out = outputs[0];
    if (!out || !out[0]) return true;
    const L = out[0];
    const R = out[1] || out[0];
    const end = this.eng.played + L.length;
    while (this.queue.length && this.queue[0].at < end) this.apply(this.queue.shift());
    if (!this.eng.active && !this.eng.playing) {
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
    renderTrochotron(this.eng, L, R);
    const used = Date.now() - t0;
    const blockMs = L.length / this.eng.sr * 1000;
    this.eng.cpu = blockMs > 0 ? Math.min(1, used / blockMs) : 0;
    const edges = takeEdges(this.eng);
    if (edges) this.port.postMessage({ t: 'edges', edges });
    return true;
  }
}

registerProcessor('trochotron', Trochotron);
