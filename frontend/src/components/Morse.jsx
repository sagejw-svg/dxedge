import { useState, useEffect, useRef, useCallback } from 'react'

/* ------------------------------------------------------------------ *
 * Morse Code Trainer - v0.1
 * Adaptive single-character trainer. 100% client side, no backend route.
 * Tone fixed at 570 Hz, 12 WPM character speed with Farnsworth spacing.
 * ------------------------------------------------------------------ */

const TONE_HZ   = 570
const CHAR_WPM  = 12   // element speed inside a character
const EFF_WPM   = 5    // Farnsworth effective speed, drives the gaps
const ANSWER_MS = 4000 // thinking time after the character finishes
const STORE_KEY = 'dxedge_morse_v1'
const STORE_VER = 1

const MORSE = {
  A: '.-',    B: '-...',  C: '-.-.',  D: '-..',   E: '.',     F: '..-.',
  G: '--.',   H: '....',  I: '..',    J: '.---',  K: '-.-',   L: '.-..',
  M: '--',    N: '-.',    O: '---',   P: '.--.',  Q: '--.-',  R: '.-.',
  S: '...',   T: '-',     U: '..-',   V: '...-',  W: '.--',   X: '-..-',
  Y: '-.--',  Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-',
  5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', '/': '-..-.',
  AR: '.-.-.', BT: '-...-',
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const DIGITS  = '0123456789'.split('')
const EXTRAS  = ['.', ',', '?', '/', 'AR', 'BT']

const POOLS = {
  letters: LETTERS,
  alnum:   [...LETTERS, ...DIGITS],
  full:    [...LETTERS, ...DIGITS, ...EXTRAS],
}

const POOL_LABELS = [
  ['letters', 'A-Z'],
  ['alnum',   'A-Z 0-9'],
  ['full',    'full set'],
]

/* --- timing (ARRL Farnsworth model) ------------------------------- */

const DIT = 1.2 / CHAR_WPM
const FARNS_TOTAL = (60 * CHAR_WPM - 37.2 * EFF_WPM) / (CHAR_WPM * EFF_WPM)
const CHAR_GAP_MS = Math.max(3 * DIT, (3 * FARNS_TOTAL) / 19) * 1000

function codeMs(code) {
  let units = 0
  for (const el of code) units += (el === '-' ? 3 : 1) + 1
  return (units - 1) * DIT * 1000
}

/* --- storage ------------------------------------------------------ */

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && parsed.v === STORE_VER ? parsed : null
  } catch {
    return null
  }
}

function saveStore(data) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ ...data, v: STORE_VER, updated: Date.now() }))
  } catch {
    /* quota or private mode: progress just will not persist */
  }
}

function blankStat() {
  return { seen: 0, correct: 0, recentMiss: 0, lastSeen: 0, rtMs: 0 }
}

/* --- adaptive selection ------------------------------------------- *
 * Weight rises with error rate and recent misses, falls as a character
 * is answered correctly. The 0.12 floor keeps well known characters in
 * light rotation instead of dropping them entirely.
 * ------------------------------------------------------------------ */

function weightFor(stat, now) {
  if (!stat || stat.seen === 0) return 4
  const acc = stat.correct / stat.seen
  const confidence = Math.min(stat.seen, 8) / 8
  let w = 0.12 + 5 * (1 - acc) * confidence + 1.6 * stat.recentMiss
  if (stat.seen < 3) w += 1.5
  if ((now - (stat.lastSeen || 0)) / 60000 > 3) w += 0.4
  return Math.max(0.12, w)
}

function pickChar(pool, stats, lastChar) {
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

/* --- component ---------------------------------------------------- */

export default function Morse({ callsign: appCallsign = '' }) {
  const [running, setRunning]   = useState(false)
  const [poolKey, setPoolKey]   = useState('letters')
  const [typed, setTyped]       = useState('')
  const [flash, setFlash]       = useState(null)
  const [stats, setStats]       = useState({})
  const [streak, setStreak]     = useState(0)
  const [session, setSession]   = useState({ asked: 0, hit: 0 })
  const [callsign, setCallsign] = useState(appCallsign || '')
  const [email, setEmail]       = useState('')
  const [idPrompt, setIdPrompt] = useState(false)
  const [audioErr, setAudioErr] = useState('')

  const ctxRef       = useRef(null)
  const timersRef    = useRef([])
  const answerTimer  = useRef(null)
  const promptIdRef  = useRef(0)
  const answeredRef  = useRef(true)
  const currentRef   = useRef(null)
  const askedAtRef   = useRef(0)
  const runningRef   = useRef(false)
  const typedRef     = useRef('')
  const statsRef     = useRef({})
  const poolRef      = useRef(POOLS.letters)
  const inputRef     = useRef(null)
  const askNextRef   = useRef(null)

  const pool = POOLS[poolKey]

  useEffect(() => { statsRef.current = stats }, [stats])
  useEffect(() => { poolRef.current = pool }, [pool])

  /* --- load saved progress --- */
  useEffect(() => {
    const s = loadStore()
    if (s) {
      setStats(s.stats || {})
      if (s.callsign) setCallsign(s.callsign)
      if (s.email) setEmail(s.email)
      if (s.poolKey && POOLS[s.poolKey]) setPoolKey(s.poolKey)
    } else {
      setIdPrompt(true)
    }
  }, [])

  /* --- persist --- */
  useEffect(() => {
    if (Object.keys(stats).length === 0) return
    saveStore({ stats, callsign, email, poolKey })
  }, [stats, callsign, email, poolKey])

  const later = useCallback((fn, ms) => {
    const t = setTimeout(fn, ms)
    timersRef.current.push(t)
    return t
  }, [])

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(t => clearTimeout(t))
    timersRef.current = []
    if (answerTimer.current) { clearTimeout(answerTimer.current); answerTimer.current = null }
  }, [])

  /* --- audio --- */

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) { setAudioErr('This browser has no Web Audio support, so the trainer cannot play tones.'); return null }
      ctxRef.current = new AC()
    }
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume()
    return ctxRef.current
  }, [])

  const playCode = useCallback((code) => {
    const ctx = getCtx()
    if (!ctx) return 0
    const RAMP = 0.005                    // 5 ms envelope, removes key clicks
    let t = ctx.currentTime + 0.06
    for (const el of code) {
      const dur = (el === '-' ? 3 : 1) * DIT
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = TONE_HZ
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.28, t + RAMP)
      gain.gain.setValueAtTime(0.28, t + dur - RAMP)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + dur + 0.02)
      t += dur + DIT
    }
    return codeMs(code)
  }, [getCtx])

  /* --- scoring --- */

  const recordResult = useCallback((char, ok, rtMs) => {
    setStats(prev => {
      const s = { ...(prev[char] || blankStat()) }
      s.seen += 1
      if (ok) {
        s.correct += 1
        s.recentMiss = Math.max(0, s.recentMiss - 1)
        s.rtMs = s.rtMs ? Math.round(s.rtMs * 0.7 + rtMs * 0.3) : Math.round(rtMs)
      } else {
        s.recentMiss = Math.min(4, s.recentMiss + 1)
      }
      s.lastSeen = Date.now()
      return { ...prev, [char]: s }
    })
    setSession(p => ({ asked: p.asked + 1, hit: p.hit + (ok ? 1 : 0) }))
    setStreak(p => (ok ? p + 1 : 0))
  }, [])

  /* --- session engine --- */

  const reinforce = useCallback((char) => {
    setFlash({ char, ok: false })
    const ms = playCode(MORSE[char])
    later(() => {
      setFlash(null)
      later(() => askNextRef.current && askNextRef.current(), CHAR_GAP_MS)
    }, Math.max(1100, ms + 700))
  }, [playCode, later])

  const askNext = useCallback(() => {
    if (!runningRef.current) return
    const char = pickChar(poolRef.current, statsRef.current, currentRef.current)
    const id = ++promptIdRef.current
    currentRef.current = char
    answeredRef.current = false
    typedRef.current = ''
    setTyped('')
    setFlash(null)

    const audioMs = playCode(MORSE[char])
    askedAtRef.current = performance.now() + audioMs

    if (answerTimer.current) clearTimeout(answerTimer.current)
    answerTimer.current = setTimeout(() => {
      // token check: a stale timer must never score the character after it
      if (!runningRef.current || id !== promptIdRef.current || answeredRef.current) return
      answeredRef.current = true
      recordResult(char, false, 0)
      reinforce(char)
    }, audioMs + ANSWER_MS)
  }, [playCode, recordResult, reinforce])

  useEffect(() => { askNextRef.current = askNext }, [askNext])

  const submit = useCallback((value) => {
    const char = currentRef.current
    if (!char || answeredRef.current) return
    answeredRef.current = true
    promptIdRef.current += 1
    if (answerTimer.current) { clearTimeout(answerTimer.current); answerTimer.current = null }

    const ok = value === char
    recordResult(char, ok, Math.max(0, performance.now() - askedAtRef.current))

    if (ok) {
      setFlash({ char, ok: true })
      later(() => {
        setFlash(null)
        later(() => askNextRef.current && askNextRef.current(), Math.max(250, CHAR_GAP_MS - 340))
      }, 340)
    } else {
      reinforce(char)
    }
  }, [recordResult, later, reinforce])

  /* --- start / stop --- */

  const stop = useCallback(() => {
    runningRef.current = false
    promptIdRef.current += 1
    answeredRef.current = true
    setRunning(false)
    clearTimers()
    setFlash(null)
    setTyped('')
    currentRef.current = null
    if (ctxRef.current && ctxRef.current.state === 'running') ctxRef.current.suspend()
  }, [clearTimers])

  const start = useCallback(() => {
    setAudioErr('')
    if (!getCtx()) return
    setIdPrompt(false)
    setSession({ asked: 0, hit: 0 })
    setStreak(0)
    currentRef.current = null
    runningRef.current = true
    setRunning(true)
    if (inputRef.current) inputRef.current.focus()
    later(() => askNextRef.current && askNextRef.current(), 300)
  }, [getCtx, later])

  /* --- keyboard --- */

  useEffect(() => {
    if (!running) return
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Escape') { stop(); return }
      const k = e.key.toUpperCase()
      if (k.length !== 1 || !/[A-Z0-9.,?/]/.test(k)) return
      e.preventDefault()
      const expected = currentRef.current
      if (!expected || answeredRef.current) return
      let buf = typedRef.current + k
      if (buf.length > expected.length) buf = buf.slice(-expected.length)
      typedRef.current = buf
      setTyped(buf)
      if (buf.length >= expected.length) {
        typedRef.current = ''
        submit(buf)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [running, submit, stop])

  /* --- unmount cleanup: switching tabs unmounts this component --- */
  useEffect(() => () => {
    runningRef.current = false
    timersRef.current.forEach(t => clearTimeout(t))
    if (answerTimer.current) clearTimeout(answerTimer.current)
    if (ctxRef.current) { try { ctxRef.current.close() } catch { /* already closed */ } }
  }, [])

  /* --- derived --- */

  const weakest = pool
    .map(c => ({ c, s: stats[c] }))
    .filter(x => x.s && x.s.seen >= 2)
    .map(x => ({ c: x.c, acc: x.s.correct / x.s.seen }))
    .filter(x => x.acc < 0.9)
    .sort((a, b) => a.acc - b.acc)
    .slice(0, 8)

  const totalSeen  = Object.values(stats).reduce((a, s) => a + s.seen, 0)
  const totalHit   = Object.values(stats).reduce((a, s) => a + s.correct, 0)
  const lifetime   = totalSeen ? Math.round((totalHit / totalSeen) * 100) : 0
  const sessionAcc = session.asked ? Math.round((session.hit / session.asked) * 100) : 0

  const mono  = { fontFamily: 'var(--font-mono)' }
  const label = { ...mono, fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase' }
  const btn = (active) => ({
    ...mono, fontSize: 11, padding: '6px 14px', borderRadius: 5,
    border: `1px solid ${active ? 'var(--green)' : 'var(--border)'}`,
    background: active ? 'rgba(0,255,157,.08)' : 'var(--bg1)',
    color: active ? 'var(--green)' : 'var(--muted)',
  })

  const focusInput = () => { if (inputRef.current) inputRef.current.focus() }

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ ...label, marginBottom: 8 }}>morse trainer</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, maxWidth: 640 }}>
          Single characters at {TONE_HZ} Hz, {CHAR_WPM} WPM with Farnsworth spacing. Type what you
          hear. Miss one and it plays again with the answer on screen. The rotation shifts toward
          the characters you keep getting wrong. Progress stays in this browser.
        </p>
      </div>

      {audioErr && (
        <div style={{ ...mono, fontSize: 11, color: 'var(--red)', border: '1px solid var(--border)',
          background: 'var(--bg1)', padding: '8px 12px', borderRadius: 5, marginBottom: 14 }}>
          {audioErr}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <button onClick={running ? stop : start} style={{
          ...mono, fontSize: 12, padding: '8px 20px', borderRadius: 5,
          border: `1px solid ${running ? 'var(--red)' : 'var(--green)'}`,
          background: running ? 'rgba(255,107,107,.08)' : 'rgba(0,255,157,.1)',
          color: running ? 'var(--red)' : 'var(--green)', fontWeight: 600,
        }}>
          {running ? 'Stop session' : 'Start session'}
        </button>

        <div style={{ display: 'flex', gap: 6, marginLeft: 4 }}>
          {POOL_LABELS.map(([k, l]) => (
            <button key={k} onClick={() => { if (!running) setPoolKey(k) }} disabled={running}
              style={{ ...btn(poolKey === k), opacity: running ? 0.4 : 1 }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {idPrompt && !running && (
        <div style={{ border: '1px solid var(--border)', background: 'var(--bg1)', borderRadius: 6,
          padding: 14, marginBottom: 16, maxWidth: 470 }}>
          <div style={{ ...label, marginBottom: 8 }}>optional</div>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.6 }}>
            Label your progress with a callsign. Nothing leaves this device. The email field is held
            for a future multi device sync and can be left blank.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input value={callsign} onChange={e => setCallsign(e.target.value.toUpperCase())}
              placeholder="CALLSIGN" style={{
                ...mono, fontSize: 12, padding: '7px 10px', width: 130, borderRadius: 5,
                background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)' }} />
            <input value={email} onChange={e => setEmail(e.target.value)} type="email"
              placeholder="email (optional)" style={{
                ...mono, fontSize: 12, padding: '7px 10px', width: 200, borderRadius: 5,
                background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)' }} />
            <button onClick={() => setIdPrompt(false)} style={btn(false)}>Done</button>
          </div>
        </div>
      )}

      <div onClick={focusInput} style={{
        position: 'relative', border: '1px solid var(--border)', borderRadius: 8, background: '#000',
        minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 12, overflow: 'hidden', cursor: running ? 'text' : 'default',
      }}>
        {flash ? (
          <div style={{
            ...mono, fontSize: 'clamp(90px, 22vw, 190px)', lineHeight: 1, fontWeight: 700,
            color: flash.ok ? 'var(--green)' : '#fff', animation: 'fadeIn .12s ease-out',
          }}>{flash.char}</div>
        ) : running ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ ...mono, fontSize: 46, color: 'var(--dim)', letterSpacing: 8 }}>
              {typed || '\u00b7'}
            </div>
            <div style={{ ...label, marginTop: 14 }}>listening</div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <div style={{ ...mono, fontSize: 30, color: 'var(--dim)', letterSpacing: 6 }}>
              {'\u00b7\u2212 \u00b7\u2212\u00b7 \u00b7\u2212\u00b7\u2212\u00b7'}
            </div>
            <div style={{ ...label, marginTop: 16 }}>press start, then type what you hear</div>
          </div>
        )}

        {/* offscreen input, raises the soft keyboard on phones */}
        <input ref={inputRef} inputMode="text" autoCapitalize="characters" autoCorrect="off"
          spellCheck={false} aria-label="Morse answer" value=""
          onChange={() => {}} style={{
            position: 'absolute', opacity: 0, width: 1, height: 1, bottom: 0, left: 0, border: 'none' }} />
      </div>

      <div style={{ ...mono, fontSize: 10, color: 'var(--dim)', textAlign: 'center', marginBottom: 18 }}>
        {running ? 'on a phone, tap the panel to raise the keyboard \u00b7 esc stops' : '\u00a0'}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
        gap: 10, marginBottom: 18 }}>
        {[
          ['session',  session.asked ? `${sessionAcc}%` : '--', 'var(--green)'],
          ['streak',   String(streak), streak >= 10 ? 'var(--yellow)' : 'var(--text)'],
          ['sent',     String(session.asked), 'var(--text)'],
          ['lifetime', totalSeen ? `${lifetime}%` : '--', 'var(--teal)'],
          ['reps',     String(totalSeen), 'var(--muted)'],
        ].map(([l, v, c]) => (
          <div key={l} style={{ border: '1px solid var(--border)', background: 'var(--bg1)',
            borderRadius: 6, padding: '10px 12px' }}>
            <div style={label}>{l}</div>
            <div style={{ ...mono, fontSize: 20, color: c, marginTop: 4 }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ border: '1px solid var(--border)', background: 'var(--bg1)', borderRadius: 6, padding: 14 }}>
        <div style={{ ...label, marginBottom: 10 }}>working on</div>
        {weakest.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            {totalSeen < 10
              ? 'Run a session and the characters you miss will collect here.'
              : 'Nothing under 90% right now. Move up a character set.'}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {weakest.map(({ c, acc }) => (
              <div key={c} style={{
                ...mono, fontSize: 12, padding: '6px 10px', borderRadius: 5,
                border: '1px solid var(--border)', background: 'var(--bg2)',
                display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ color: 'var(--text)', fontWeight: 700 }}>{c}</span>
                <span style={{ color: acc < 0.5 ? 'var(--red)' : 'var(--yellow)' }}>{Math.round(acc * 100)}%</span>
                <span style={{ color: 'var(--dim)', fontSize: 10 }}>{MORSE[c]}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ ...mono, fontSize: 10, color: 'var(--dim)', marginTop: 14, textAlign: 'center' }}>
        {callsign ? `${callsign} \u00b7 ` : ''}progress saved in this browser
        {totalSeen > 0 && (
          <button onClick={() => {
            if (!window.confirm('Erase all Morse progress on this device?')) return
            setStats({}); setSession({ asked: 0, hit: 0 }); setStreak(0)
            try { localStorage.removeItem(STORE_KEY) } catch { /* ignore */ }
          }} style={{ ...mono, fontSize: 10, color: 'var(--dim)', background: 'none',
            border: 'none', textDecoration: 'underline', marginLeft: 8 }}>reset</button>
        )}
      </div>
    </div>
  )
}
