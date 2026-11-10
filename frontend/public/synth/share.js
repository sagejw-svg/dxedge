// A patch as a link and as a file (0.3, share links, 10 Nov 2026). Our own code.
//
// Both carry the same document: { kind: 'dxpatch', v: 1, device, name, patch }. The patch is the
// device's normalized patch, whole, not a difference from today's defaults, so a later change to a
// default never changes what an old link plays. The page runs the device's own normalizer on whatever
// comes back, so a damaged or hand-edited link still loads inside every range.
//
// The link is `?p=` + a two-letter tag + base64url (RFC 4648 section 5, no padding):
//   '1z'  version 1, the JSON deflated (raw deflate, CompressionStream 'deflate-raw')
//   '1j'  version 1, the JSON as UTF-8 bytes (a browser without CompressionStream writes this)
// Reading is capped (the text at MAX_TEXT characters, the inflated JSON at MAX_JSON bytes) so a
// hostile link cannot make the page inflate without end, and the JSON reader drops __proto__,
// constructor and prototype keys before any normalizer sees them.

export const SHARE_KIND = 'dxpatch';
export const SHARE_V = 1;
export const MAX_TEXT = 65536;
export const MAX_JSON = 262144;

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const REV = (() => { const r = new Int16Array(128).fill(-1); for (let i = 0; i < 64; i++) r[ALPHA.charCodeAt(i)] = i; return r; })();

export function b64url(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((i + 1 < bytes.length ? bytes[i + 1] : 0) << 8) | (i + 2 < bytes.length ? bytes[i + 2] : 0);
    out += ALPHA[(n >>> 18) & 63] + ALPHA[(n >>> 12) & 63];
    if (i + 1 < bytes.length) out += ALPHA[(n >>> 6) & 63];
    if (i + 2 < bytes.length) out += ALPHA[n & 63];
  }
  return out;
}

// null for anything that is not clean base64url (a stray character, or a length of 1 mod 4)
export function unb64url(s) {
  if (typeof s !== 'string' || s.length % 4 === 1) return null;
  const out = new Uint8Array(Math.floor(s.length * 3 / 4));
  let o = 0;
  for (let i = 0; i < s.length; i += 4) {
    const v = [0, 1, 2, 3].map(k => { if (i + k >= s.length) return -2; const c = s.charCodeAt(i + k); return c < 128 ? REV[c] : -1; });
    if (v.some(x => x === -1)) return null;
    const n = (v[0] << 18) | (v[1] << 12) | ((v[2] < 0 ? 0 : v[2]) << 6) | (v[3] < 0 ? 0 : v[3]);
    out[o++] = (n >>> 16) & 255;
    if (v[2] >= 0) out[o++] = (n >>> 8) & 255;
    if (v[3] >= 0) out[o++] = n & 255;
  }
  return out.subarray(0, o);
}

// JSON.parse that keeps no key able to reach an object's prototype through a later Object.assign
const BAD_KEY = new Set(['__proto__', 'constructor', 'prototype']);
export function safeJSON(text) {
  try { return JSON.parse(String(text), (k, v) => (BAD_KEY.has(k) ? undefined : v)); } catch (e) { return undefined; }
}

export const canDeflate = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

async function through(bytes, stream, cap) {
  const w = stream.writable.getWriter();
  w.write(bytes).catch(() => {}); w.close().catch(() => {});
  const r = stream.readable.getReader(), parts = [];
  let n = 0;
  for (;;) {
    const { done, value } = await r.read();
    if (done) break;
    n += value.length;
    if (cap && n > cap) { r.cancel().catch(() => {}); return null; }
    parts.push(value);
  }
  const out = new Uint8Array(n); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

export function patchDoc(device, patch) {
  return { kind: SHARE_KIND, v: SHARE_V, device: String(device), name: patch && typeof patch.name === 'string' ? patch.name : '', patch };
}

// The link text for a device's patch (the part after ?p=). deflate: false writes the plain form.
export async function encodePatch(device, patch, opts) {
  const bytes = new TextEncoder().encode(JSON.stringify(patchDoc(device, patch)));
  const deflate = !(opts && opts.deflate === false) && canDeflate();
  if (deflate) {
    try { const z = await through(bytes, new CompressionStream('deflate-raw'), 0); if (z) return '1z' + b64url(z); } catch (e) { /* plain below */ }
  }
  return '1j' + b64url(bytes);
}

// What a link text or a file carries, as { device, patch, name }, before the device's normalizer.
// knownDevice(id) says whether the rack has that device; a bare patch (no wrapper) takes
// fallbackDevice unless it names its own. null when it is not a patch at all.
export function readDoc(raw, knownDevice, fallbackDevice) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (raw.kind === SHARE_KIND) {
    const v = Number(raw.v);
    if (!(v >= 1 && v <= SHARE_V)) return null;
    const p = raw.patch;
    if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
    const d = typeof raw.device === 'string' ? raw.device : (typeof p.device === 'string' ? p.device : '');
    if (!knownDevice(d)) return null;
    return { device: d, patch: p, name: typeof p.name === 'string' ? p.name : String(raw.name || '') };
  }
  if (raw.kind) return null;   // a project (dxrack), a mix session (dxmix) or anything else with a kind is not a patch
  const d = typeof raw.device === 'string' && raw.device ? raw.device : fallbackDevice;
  if (!knownDevice(d)) return null;
  return { device: d, patch: raw, name: typeof raw.name === 'string' ? raw.name : '' };
}

export async function decodePatch(text, knownDevice) {
  if (typeof text !== 'string') return null;
  const s = text.trim();
  if (s.length < 3 || s.length > MAX_TEXT) return null;
  const tag = s.slice(0, 2), bytes = unb64url(s.slice(2));
  if (!bytes) return null;
  let json = null;
  if (tag === '1j') json = bytes.length <= MAX_JSON ? bytes : null;
  else if (tag === '1z') {
    if (!canDeflate()) return null;
    try { json = await through(bytes, new DecompressionStream('deflate-raw'), MAX_JSON); } catch (e) { json = null; }
  }
  if (!json) return null;
  let str;
  try { str = new TextDecoder('utf-8', { fatal: true }).decode(json); } catch (e) { return null; }
  const raw = safeJSON(str);
  if (!raw || raw.kind !== SHARE_KIND) return null;
  return readDoc(raw, knownDevice, '');
}

// A file name for a patch: device and patch name, letters, digits and dashes only.
export function patchFileName(device, name) {
  const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return (slug(device) || 'patch') + '-' + (slug(name) || 'patch') + '.json';
}
