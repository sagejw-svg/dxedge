// 24-bit / 44.1 kHz stereo WAV. Live recording resamples the master worklet's blocks
// (see masterfx.js). Offline render asks the engine for an OfflineAudioContext at
// 44.1 kHz and encodes that buffer directly, so the length is exact.

import { renderOffline } from './engine.js';

const SR = 44100;

function writeStr(view, offset, s) {
  for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
}

function sample24(x) {
  let s = Math.round(Math.max(-1, Math.min(1, x)) * 8388607);
  if (s < 0) s += 16777216;
  return s;
}

// Interleaved little-endian 24-bit PCM. L and R are Float32Array, one frame each index.
export function encodeWav24(L, R) {
  const n = Math.min(L.length, R.length);
  const dataBytes = n * 6;
  const buf = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buf);
  writeStr(v, 0, 'RIFF');
  v.setUint32(4, 36 + dataBytes, true);
  writeStr(v, 8, 'WAVE');
  writeStr(v, 12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);             // PCM
  v.setUint16(22, 2, true);
  v.setUint32(24, SR, true);
  v.setUint32(28, SR * 6, true);
  v.setUint16(32, 6, true);
  v.setUint16(34, 24, true);
  writeStr(v, 36, 'data');
  v.setUint32(40, dataBytes, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    const a = sample24(L[i]), b = sample24(R[i]);
    v.setUint8(o, a & 255); v.setUint8(o + 1, (a >> 8) & 255); v.setUint8(o + 2, (a >> 16) & 255);
    v.setUint8(o + 3, b & 255); v.setUint8(o + 4, (b >> 8) & 255); v.setUint8(o + 5, (b >> 16) & 255);
    o += 6;
  }
  return new Uint8Array(buf);
}

export function wavName(prefix) {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  const stamp = d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  return (prefix || 'filament') + '-' + stamp + '.wav';
}

export function downloadWav(bytes, name) {
  const blob = new Blob([bytes], { type: 'audio/wav' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name || wavName('filament');
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2500);
  return a.download;
}

// Offline render of the current patch (and the master bus) to a 24-bit WAV.
// Capped at 10 minutes. `master` is a master-bus state; omitted means the defaults (everything bypassed).
export async function renderToWav(opts) {
  const seconds = Math.max(0.05, Math.min(600, +opts.seconds || 1));
  const buf = await renderOffline({
    patch: opts.patch,
    events: opts.events || [],
    seconds,
    sampleRate: SR,
    rack: opts.rack !== false,
    mono: !!opts.mono,
    master: opts.master || null,
    masterFx: opts.masterFx !== false,
  });
  const bytes = encodeWav24(buf.getChannelData(0), buf.getChannelData(1));
  return { bytes, frames: buf.length, sampleRate: SR, bits: 24, channels: 2, seconds };
}

export function bytesToB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + 0x8000, bytes.length)));
  return btoa(s);
}
