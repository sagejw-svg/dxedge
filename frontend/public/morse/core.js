/* ------------------------------------------------------------------ *
 * DXEdge Morse engine - shared logic, no DOM.
 *
 * Imported two ways on purpose, so the React tab and the standalone
 * /morse page can never drift apart:
 *   - bundled:    import { ... } from '../../public/morse/core.js'
 *   - standalone: <script type="module"> import { ... } from './core.js'
 * ------------------------------------------------------------------ */

export const MORSE = {
  A: '.-',    B: '-...',  C: '-.-.',  D: '-..',   E: '.',     F: '..-.',
  G: '--.',   H: '....',  I: '..',    J: '.---',  K: '-.-',   L: '.-..',
  M: '--',    N: '-.',    O: '---',   P: '.--.',  Q: '--.-',  R: '.-.',
  S: '...',   T: '-',     U: '..-',   V: '...-',  W: '.--',   X: '-..-',
  Y: '-.--',  Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-',
  5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', '/': '-..-.',
  '=': '-...-',  '+': '.-.-.',
  AR: '.-.-.', BT: '-...-', SK: '...-.-', KN: '-.--.',
}

/* AR/BT/SK/KN are prosigns. '+' and '=' are their single-key equivalents
 * and are what an operator actually types, so both map to the same code. */
export const PROSIGN_KEYS = { AR: '+', BT: '=', SK: '$', KN: '(' }

export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
export const DIGITS  = '0123456789'.split('')
export const PUNCT   = ['.', ',', '?', '/']
export const PROSIGNS = ['AR', 'BT', 'SK', 'KN']

export const POOLS = {
  letters: LETTERS,
  alnum:   [...LETTERS, ...DIGITS],
  punct:   [...LETTERS, ...DIGITS, ...PUNCT],
  full:    [...LETTERS, ...DIGITS, ...PUNCT, ...PROSIGNS],
}

export const POOL_LABELS = [
  ['letters', 'A-Z'],
  ['alnum',   '+ 0-9'],
  ['punct',   '+ . , ? /'],
  ['full',    '+ prosigns'],
]

/* Koch order: the sequence Ludwig Koch found produces the fastest path to
 * solid copy. Used to introduce characters gradually rather than all at once. */
export const KOCH_ORDER = [
  'K','M','R','S','U','A','P','T','L','O','W','I','.','N','J','E','F','0','Y',
  'V','G','5','/','Q','9','Z','H','3','8','B','?','4','2','7','C','1','D','6','X',
]

export const DEFAULTS = {
  toneHz:    570,
  charWpm:   12,
  effWpm:    5,
  volume:    0.3,
  answerMs:  4000,   // 0 means wait indefinitely
  poolKey:   'letters',
  kochCount: 0,      // 0 = use the whole pool, >0 = first N of KOCH_ORDER
}

export const STORE_KEY = 'dxedge_morse_v1'
export const STORE_VER = 2

/* --- timing ------------------------------------------------------- */

export function ditSeconds(charWpm) {
  return 1.2 / Math.max(1, charWpm)
}

/* ARRL Farnsworth: characters stay at charWpm, the gaps stretch so the
 * overall rate lands at effWpm. Returns { charGapMs, wordGapMs }. */
export function farnsworthGaps(charWpm, effWpm) {
  const dit = ditSeconds(charWpm)
  const eff = Math.min(effWpm, charWpm)
  const total = (60 * charWpm - 37.2 * eff) / (charWpm * eff)
  return {
    charGapMs: Math.max(3 * dit, (3 * total) / 19) * 1000,
    wordGapMs: Math.max(7 * dit, (7 * total) / 19) * 1000,
  }
}

export function codeMs(code, charWpm) {
  const dit = ditSeconds(charWpm)
  let units = 0
  for (const el of code) units += (el === '-' ? 3 : 1) + 1
  return (units - 1) * dit * 1000
}

/* --- text <-> morse ----------------------------------------------- */

export function codeFor(token) {
  return MORSE[token] || null
}

/* Split a string into sendable tokens. Prosign keys expand to their
 * two-letter names so the display can show AR rather than '+'. */
export function tokenize(text) {
  const out = []
  const keyToName = {}
  for (const [name, key] of Object.entries(PROSIGN_KEYS)) keyToName[key] = name
  for (const ch of text.toUpperCase()) {
    if (ch === ' ' || ch === '\n' || ch === '\t') { out.push(' '); continue }
    if (keyToName[ch]) { out.push(keyToName[ch]); continue }
    if (MORSE[ch]) out.push(ch)
  }
  return out
}

/* --- audio -------------------------------------------------------- */

/*
 * Schedules sine-wave CW on the Web Audio clock rather than with timers,
 * so element timing does not drift when the main thread is busy. A 5 ms
 * raised envelope on each element removes the key click that a hard
 * gate produces.
 */
export class CWPlayer {
  constructor(opts = {}) {
    this.toneHz  = opts.toneHz  ?? DEFAULTS.toneHz
    this.charWpm = opts.charWpm ?? DEFAULTS.charWpm
    this.effWpm  = opts.effWpm  ?? DEFAULTS.effWpm
    this.volume  = opts.volume  ?? DEFAULTS.volume
    this.ctx = null
    this.nodes = []
    this.unsupported = false
  }

  set(opts = {}) {
    Object.assign(this, opts)
    if (this.effWpm > this.charWpm) this.effWpm = this.charWpm
  }

  /* Must be called from a user gesture on iOS or the context stays suspended. */
  resume() {
    if (this.unsupported) return null
    if (!this.ctx) {
      const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)
      if (!AC) { this.unsupported = true; return null }
      /* iOS routes plain Web Audio through the ringer channel, so the hardware
       * silent switch mutes it. Declaring the session as playback moves it to
       * the media channel and overrides the switch. iOS 16.4+, ignored elsewhere. */
      try {
        if (typeof navigator !== 'undefined' && navigator.audioSession) {
          navigator.audioSession.type = 'playback'
        }
      } catch { /* not supported, fall through */ }
      this.ctx = new AC()
    }
    if (this.ctx.state === 'suspended') this.ctx.resume()
    return this.ctx
  }

  /*
   * Await a genuinely running context before any scheduling happens.
   * ctx.resume() is asynchronous: while the context is suspended its
   * currentTime is frozen, so anything scheduled at currentTime + delta
   * lands in the past and fires all at once (or not at all) on resume.
   * Call this from the user gesture that starts a session.
   */
  async prime() {
    const ctx = this.resume()
    if (!ctx) return null
    for (let i = 0; i < 3 && ctx.state !== 'running'; i++) {
      try { await ctx.resume() } catch { /* retry */ }
      if (ctx.state !== 'running') await new Promise(r => setTimeout(r, 60))
    }
    return ctx.state === 'running' ? ctx : null
  }

  /* Short beep so the operator can confirm audio without starting a session. */
  testTone(ms = 250) {
    const ctx = this.resume()
    if (!ctx) return 0
    const RAMP = 0.005
    const dur = ms / 1000
    const t = ctx.currentTime + 0.05
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = this.toneHz
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, this.volume), t + RAMP)
    gain.gain.setValueAtTime(Math.max(0.0002, this.volume), t + dur - RAMP)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    this.begin()
    osc.connect(gain).connect(this.master())
    osc.start(t)
    osc.stop(t + dur + 0.02)
    this.nodes.push(osc, gain)
    return ms
  }

  /* True when audio is genuinely playable right now. */
  get ready() {
    return !!this.ctx && this.ctx.state === 'running'
  }

  /*
   * Every element routes through one master gain. Silencing the master is
   * what actually stops a transmission: it is O(1) and cannot be defeated
   * by losing track of individual nodes, which is how a long send used to
   * become unstoppable.
   */
  master() {
    if (!this.ctx) return null
    if (!this._master || this._master.context !== this.ctx) {
      this._master = this.ctx.createGain()
      this._master.connect(this.ctx.destination)
    }
    return this._master
  }

  /* Cancel anything in flight and reopen the master for a new transmission. */
  begin() {
    this.stop()
    const m = this.master()
    if (m) {
      const now = this.ctx.currentTime
      m.gain.cancelScheduledValues(now)
      m.gain.setValueAtTime(1, now)
    }
    return this.ctx
  }

  /* Schedule one code string. Returns its audible length in ms. */
  play(code, startDelayMs = 60) {
    const ctx = this.resume()
    if (!ctx || !code) return 0
    this.begin()
    const master = this.master()
    const dit = ditSeconds(this.charWpm)
    const RAMP = 0.005
    let t = ctx.currentTime + startDelayMs / 1000
    for (const el of code) {
      const dur = (el === '-' ? 3 : 1) * dit
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = this.toneHz
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, this.volume), t + RAMP)
      gain.gain.setValueAtTime(Math.max(0.0002, this.volume), t + dur - RAMP)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      osc.connect(gain).connect(master)
      osc.start(t)
      osc.stop(t + dur + 0.02)
      this.nodes.push(osc, gain)
      t += dur + dit
    }
    return codeMs(code, this.charWpm)
  }

  /*
   * Schedule a whole token list with Farnsworth spacing.
   * Returns { totalMs, marks } where each mark is the ms offset at which
   * that token starts, so a caller can highlight along with the audio.
   */
  playTokens(tokens, startDelayMs = 150) {
    const ctx = this.resume()
    if (!ctx) return { totalMs: 0, marks: [] }
    this.begin()
    const master = this.master()
    const dit = ditSeconds(this.charWpm)
    const { charGapMs, wordGapMs } = farnsworthGaps(this.charWpm, this.effWpm)
    const RAMP = 0.005
    const t0 = ctx.currentTime + startDelayMs / 1000
    let t = t0
    const marks = []

    tokens.forEach((tok, i) => {
      if (tok === ' ') { t += wordGapMs / 1000; marks.push(null); return }
      const code = MORSE[tok]
      if (!code) { marks.push(null); return }
      marks.push((t - t0) * 1000)
      for (const el of code) {
        const dur = (el === '-' ? 3 : 1) * dit
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = this.toneHz
        gain.gain.setValueAtTime(0.0001, t)
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, this.volume), t + RAMP)
        gain.gain.setValueAtTime(Math.max(0.0002, this.volume), t + dur - RAMP)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
        osc.connect(gain).connect(master)
        osc.start(t)
        osc.stop(t + dur + 0.02)
        this.nodes.push(osc, gain)
        t += dur + dit
      }
      t -= dit
      if (i < tokens.length - 1 && tokens[i + 1] !== ' ') t += charGapMs / 1000
    })

    return { totalMs: (t - t0) * 1000, marks }
  }

  /*
   * Kill anything already scheduled. Two independent mechanisms, because a
   * long send schedules hundreds of nodes and any one of them surviving
   * means audio keeps coming:
   *   1. zero the master gain, which silences everything instantly
   *   2. stop and disconnect each node so nothing is left running
   */
  stop() {
    if (this.ctx && this._master) {
      try {
        const now = this.ctx.currentTime
        this._master.gain.cancelScheduledValues(now)
        this._master.gain.setValueAtTime(0, now)
      } catch { /* context closed */ }
    }
    for (const n of this.nodes) {
      try { if (n.stop) n.stop() } catch { /* not started or already stopped */ }
      try { n.disconnect() } catch { /* already disconnected */ }
    }
    this.nodes = []
  }

  close() {
    this.stop()
    this._master = null
    if (this.ctx) { try { this.ctx.close() } catch { /* already closed */ } this.ctx = null }
  }
}

/* --- adaptive selection ------------------------------------------- */

export function blankStat() {
  return { seen: 0, correct: 0, recentMiss: 0, lastSeen: 0, rtMs: 0 }
}

/*
 * Weight rises with error rate and recent misses and decays as a
 * character is answered correctly. The 0.12 floor keeps solid characters
 * in light rotation instead of dropping them out entirely.
 */
export function weightFor(stat, now = Date.now()) {
  if (!stat || stat.seen === 0) return 4
  const acc = stat.correct / stat.seen
  const confidence = Math.min(stat.seen, 8) / 8
  let w = 0.12 + 5 * (1 - acc) * confidence + 1.6 * stat.recentMiss
  if (stat.seen < 3) w += 1.5
  if ((now - (stat.lastSeen || 0)) / 60000 > 3) w += 0.4
  return Math.max(0.12, w)
}

export function activePool(poolKey, kochCount) {
  const base = POOLS[poolKey] || POOLS.letters
  if (!kochCount) return base
  const allowed = new Set(KOCH_ORDER.slice(0, kochCount))
  const sub = base.filter(c => allowed.has(c))
  return sub.length >= 2 ? sub : base.slice(0, 2)
}

export function pickChar(pool, stats, lastChar) {
  const now = Date.now()
  const candidates = pool.length > 1 ? pool.filter(c => c !== lastChar) : pool
  const weights = candidates.map(c => weightFor(stats[c], now))
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i]
    if (r <= 0) return candidates[i]
  }
  return candidates[candidates.length - 1]
}

export function applyResult(stat, ok, rtMs) {
  const s = { ...(stat || blankStat()) }
  s.seen += 1
  if (ok) {
    s.correct += 1
    s.recentMiss = Math.max(0, s.recentMiss - 1)
    s.rtMs = s.rtMs ? Math.round(s.rtMs * 0.7 + rtMs * 0.3) : Math.round(rtMs)
  } else {
    s.recentMiss = Math.min(4, s.recentMiss + 1)
  }
  s.lastSeen = Date.now()
  return s
}

/* --- storage ------------------------------------------------------ */

export function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw)
    if (!p) return null
    if (p.v === 1) return { ...p, v: STORE_VER, settings: { ...DEFAULTS } }  // migrate v1 stats forward
    return p.v === STORE_VER ? p : null
  } catch {
    return null
  }
}

export function saveStore(data) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ ...data, v: STORE_VER, updated: Date.now() }))
    return true
  } catch {
    return false   // quota or private mode: progress just will not persist
  }
}

/* --- practice text generators ------------------------------------- */

const PREFIXES = ['K','W','N','AA','AB','KC','KD','KE','KI','KK','KM','WA','WB','NA','ND',
                  'VE','VA','G','M','DL','DK','F','I','EA','PA','ON','OH','SM','LA','OZ',
                  'JA','JH','VK','ZL','PY','LU','CE','ZS','UA','RA','SP','OK','HA','YO']
const SUFFIX_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function randOf(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function randInt(n) { return Math.floor(Math.random() * n) }

export function randomCallsign() {
  const p = randOf(PREFIXES)
  const digit = String(randInt(10))
  const len = 1 + randInt(3)
  let suffix = ''
  for (let i = 0; i < len; i++) suffix += SUFFIX_LETTERS[randInt(26)]
  return p + digit + suffix
}

export const HAM_WORDS = ['CQ','DE','QTH','QSL','QRZ','QRM','QRN','QSB','QRP','RST','TNX',
  'FB','OM','YL','ES','HR','UR','RIG','ANT','PWR','WX','TEMP','NAME','RPT','AGN','PSE',
  '73','88','GM','GA','GE','K','R','BK','SK','DX','WPM','WATTS','DIPOLE','VERT','BEAM']

export function randomGroups(count = 10, size = 5, chars = LETTERS) {
  const out = []
  for (let i = 0; i < count; i++) {
    let g = ''
    for (let j = 0; j < size; j++) g += chars[randInt(chars.length)]
    out.push(g)
  }
  return out.join(' ')
}

export function randomCallsigns(count = 8) {
  return Array.from({ length: count }, randomCallsign).join(' ')
}

export function randomWords(count = 12) {
  return Array.from({ length: count }, () => randOf(HAM_WORDS)).join(' ')
}

export function randomQSO() {
  const me = randomCallsign()
  const dx = randomCallsign()
  const rst = `5${3 + randInt(7)}${9}`
  const names = ['JIM','BOB','TOM','ANN','SUE','KEN','RAY','DAN','JOE','MEG','HAL','LIZ']
  const qths = ['CA','TX','OH','FL','NY','WA','CO','ME','AZ','OR','IL','GA']
  return [
    `CQ CQ DE ${me} ${me} K`,
    `${me} DE ${dx} ${dx} K`,
    `${dx} DE ${me} GM ES TNX FER CALL UR RST ${rst} ${rst}`,
    `NAME HR IS ${randOf(names)} ${randOf(names)} QTH ${randOf(qths)} ${randOf(qths)}`,
    `HW CPY? ${dx} DE ${me} K`,
  ].join(' = ')
}

/* --- copy-mode scoring -------------------------------------------- */

export function normalizeCopy(s) {
  return String(s || '').toUpperCase().replace(/\s+/g, ' ').trim()
}

/*
 * Character-level alignment (Needleman-Wunsch, unit costs) so that one
 * dropped character shifts the rest by one position instead of scoring
 * everything after it wrong. Returns per-position ops for the diff view.
 */
export function alignCopy(sent, typed) {
  const a = normalizeCopy(sent)
  const b = normalizeCopy(typed)
  const n = a.length, m = b.length
  const d = Array.from({ length: n + 1 }, () => new Int32Array(m + 1))
  for (let i = 0; i <= n; i++) d[i][0] = i
  for (let j = 0; j <= m; j++) d[0][j] = j
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const sub = d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      d[i][j] = Math.min(sub, d[i - 1][j] + 1, d[i][j - 1] + 1)
    }
  }
  const ops = []
  let i = n, j = m
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) {
      ops.push({ op: a[i - 1] === b[j - 1] ? 'hit' : 'sub', sent: a[i - 1], typed: b[j - 1] })
      i--; j--
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      ops.push({ op: 'miss', sent: a[i - 1], typed: null }); i--
    } else {
      ops.push({ op: 'extra', sent: null, typed: b[j - 1] }); j--
    }
  }
  ops.reverse()
  const hits = ops.filter(o => o.op === 'hit').length
  return { ops, hits, total: n, accuracy: n ? hits / n : 0 }
}


/* --- screen wake lock --------------------------------------------- *
 * A drill runs for minutes with no touch input, so the phone would
 * otherwise sleep mid-session. Best effort: unsupported browsers and
 * denied requests both just no-op.
 * ------------------------------------------------------------------ */

let _wakeLock = null

export async function acquireWakeLock() {
  try {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return false
    if (_wakeLock) return true
    _wakeLock = await navigator.wakeLock.request('screen')
    _wakeLock.addEventListener('release', () => { _wakeLock = null })
    return true
  } catch {
    return false
  }
}

export function releaseWakeLock() {
  try { if (_wakeLock) _wakeLock.release() } catch { /* already gone */ }
  _wakeLock = null
}
