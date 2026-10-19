// Iris AudioWorklet. The voice lives in iris-dsp.js.

import { createIrisEngine, postIris, renderIris } from './iris-dsp.js';

class Iris extends AudioWorkletProcessor {
  constructor() {
    super();
    this.eng = createIrisEngine(sampleRate);
    this.rec = false;
    this.holdL = new Float32Array(4096);
    this.holdR = new Float32Array(4096);
    this.n = 0;
    this.port.onmessage = (ev) => {
      const m = ev.data || {};
      if (m.t === 'rec') {
        this.rec = !!m.on;
        if (!this.rec) {
          this.flush();
          this.port.postMessage({ t: 'rec-done' });
        }
        return;
      }
      postIris(this.eng, m);
    };
  }

  flush() {
    if (!this.n) return;
    const L = this.holdL.slice(0, this.n);
    const R = this.holdR.slice(0, this.n);
    this.n = 0;
    this.port.postMessage({ t: 'rec', L, R });
  }

  process(inputs, outputs) {
    const ch = outputs[0];
    if (!ch || !ch[0]) return true;
    const L = ch[0];
    const R = ch[1] || L;
    renderIris(this.eng, L, R);
    if (this.rec) {
      for (let i = 0; i < L.length; i++) {
        this.holdL[this.n] = L[i];
        this.holdR[this.n] = R === L ? L[i] : R[i];
        this.n++;
        if (this.n >= this.holdL.length) this.flush();
      }
    }
    return true;
  }
}

registerProcessor('iris', Iris);
