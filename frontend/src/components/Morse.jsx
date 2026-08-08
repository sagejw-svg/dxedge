import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  MORSE, POOL_LABELS, KOCH_ORDER, DEFAULTS, CWPlayer,
  activePool, pickChar, applyResult, loadStore, saveStore,
  farnsworthGaps, tokenize, alignCopy,
  randomCallsigns, randomGroups, randomWords, randomQSO, LETTERS, DIGITS,
} from '../morse-core'

/* ------------------------------------------------------------------ *
 * Morse trainer - v0.2
 * All logic lives in morse-core, which is the same file the standalone
 * /morse page loads, so the two cannot drift apart.
 * ------------------------------------------------------------------ */

const WAITS = [['2 s', 2000], ['4 s', 4000], ['8 s', 8000], ['no limit', 0]]

const SOURCES = [
  ['callsigns',     () => randomCallsigns(8)],
  ['letter groups', () => randomGroups(10, 5, LETTERS)],
  ['mixed groups',  () => randomGroups(10, 5, [...LETTERS, ...DIGITS])],
  ['ham words',     () => randomWords(12)],
  ['full QSO',      () => randomQSO()],
]

const mono  = { fontFamily: 'var(--font-mono)' }
const label = { ...mono, fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase' }
const card  = { border: '1px solid var(--border)', background: 'var(--bg1)', borderRadius: 6, padding: 14 }

function chip(active) {
  return {
    ...mono, fontSize: 11, padding: '6px 13px', borderRadius: 5,
    border: `1px solid ${active ? 'var(--green)' : 'var(--border)'}`,
    background: active ? 'rgba(0,255,157,.08)' : 'var(--bg1)',
    color: active ? 'var(--green)' : 'var(--muted)',
  }
}

function Slider({ id, text, value, min, max, onChange, onCommit, readout }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', ...mono, fontSize: 11, color: 'var(--muted)' }}>
        <label htmlFor={id}>{text}</label>
        <span style={{ color: 'var(--green)' }}>{readout}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={1} value={value}
        onChange={e => onChange(Number(e.target.value))}
        onMouseUp={onCommit} onTouchEnd={onCommit} onKeyUp={onCommit}
        style={{ width: '100%', accentColor: 'var(--green)' }} />
    </div>
  )
}

export default function Morse() {
  const [mode, setMode]         = useState('drill')
  const [showSet, setShowSet]   = useState(false)
  const [S, setS]               = useState(DEFAULTS)
  const [stats, setStats]       = useState({})
  const [running, setRunning]   = useState(false)
  const [display, setDisplay]   = useState({ kind: 'idle', text: '\u00b7\u2212 \u00b7\u2212\u00b7 \u00b7\u2212\u00b7\u2212\u00b7', msg: 'press start, then type what you hear' })
  const [session, setSession]   = useState({ asked: 0, hit: 0 })
  const [streak, setStreak]     = useState(0)
  const [audioErr, setAudioErr] = useState('')

  const [src, setSrc]           = useState(() => randomCallsigns(8))
  const [ans, setAns]           = useState('')
  const [sent, setSent]         = useState('')
  const [copyState, setCopyState] = useState('')
  const [result, setResult]     = useState(null)

  const playerRef   = useRef(null)
  const timersRef   = useRef([])
  const answerRef   = useRef(null)
  const promptRef   = useRef(0)
  const answeredRef = useRef(true)
  const currentRef  = useRef(null)
  const bufRef      = useRef('')
  const askedAtRef  = useRef(0)
  const runningRef  = useRef(false)
  const statsRef    = useRef({})
  const settRef     = useRef(DEFAULTS)
  const askRef      = useRef(null)
  const inputRef    = useRef(null)
  const loadedRef   = useRef(false)

  if (!playerRef.current) playerRef.current = new CWPlayer(DEFAULTS)

  useEffect(() => { statsRef.current = stats }, [stats])
  useEffect(() => { settRef.current = S; playerRef.current.set(S) }, [S])

  useEffect(() => {
    const s = loadStore()
    if (s) {
      setStats(s.stats || {})
      const merged = { ...DEFAULTS, ...(s.settings || {}) }
      if (merged.effWpm > merged.charWpm) merged.effWpm = merged.charWpm
      setS(merged)
    }
    loadedRef.current = true
  }, [])

  const persist = useCallback((nextStats, nextS) => {
    if (!loadedRef.current) return
    saveStore({ stats: nextStats ?? statsRef.current, settings: nextS ?? settRef.current })
  }, [])

  const later = useCallback((fn, ms) => {
    const t = setTimeout(fn, ms)
    timersRef.current.push(t)
    return t
  }, [])

  const clearAll = useCallback(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    if (answerRef.current) { clearTimeout(answerRef.current); answerRef.current = null }
  }, [])

  const pool = useMemo(() => activePool(S.poolKey, S.kochCount), [S.poolKey, S.kochCount])
  const gaps = useMemo(() => farnsworthGaps(S.charWpm, S.effWpm), [S.charWpm, S.effWpm])

  /* --- drill engine --- */

  const score = useCallback((c, ok, rt) => {
    setStats(prev => {
      const next = { ...prev, [c]: applyResult(prev[c], ok, rt) }
      statsRef.current = next
      persist(next)
      return next
    })
    setSession(p => ({ asked: p.asked + 1, hit: p.hit + (ok ? 1 : 0) }))
    setStreak(p => (ok ? p + 1 : 0))
  }, [persist])

  const reinforce = useCallback((c) => {
    setDisplay({ kind: 'flash', text: c, ok: false })
    const ms = playerRef.current.play(MORSE[c])
    const gap = farnsworthGaps(settRef.current.charWpm, settRef.current.effWpm).charGapMs
    later(() => later(() => askRef.current && askRef.current(), gap), Math.max(1100, ms + 700))
  }, [later])

  const ask = useCallback(() => {
    if (!runningRef.current) return
    const st = settRef.current
    const p = activePool(st.poolKey, st.kochCount)
    const c = pickChar(p, statsRef.current, currentRef.current)
    const id = ++promptRef.current
    currentRef.current = c
    answeredRef.current = false
    bufRef.current = ''
    setDisplay({ kind: 'idle', text: '\u00b7', msg: 'listening' })

    const ms = playerRef.current.play(MORSE[c])
    askedAtRef.current = performance.now() + ms

    if (answerRef.current) clearTimeout(answerRef.current)
    if (st.answerMs > 0) {
      answerRef.current = setTimeout(() => {
        // token guard: a stale timer must never score the character after it
        if (!runningRef.current || id !== promptRef.current || answeredRef.current) return
        answeredRef.current = true
        score(c, false, 0)
        reinforce(c)
      }, ms + st.answerMs)
    }
  }, [score, reinforce])

  useEffect(() => { askRef.current = ask }, [ask])

  const answer = useCallback((value) => {
    const c = currentRef.current
    if (!c || answeredRef.current) return
    answeredRef.current = true
    promptRef.current += 1
    if (answerRef.current) { clearTimeout(answerRef.current); answerRef.current = null }

    const ok = value === c
    score(c, ok, Math.max(0, performance.now() - askedAtRef.current))
    if (ok) {
      setDisplay({ kind: 'flash', text: c, ok: true })
      const gap = Math.max(250, farnsworthGaps(settRef.current.charWpm, settRef.current.effWpm).charGapMs - 340)
      later(() => later(() => askRef.current && askRef.current(), gap), 340)
    } else {
      reinforce(c)
    }
  }, [score, later, reinforce])

  const replay = useCallback(() => {
    const c = currentRef.current
    if (!runningRef.current || !c || answeredRef.current) return
    const st = settRef.current
    const ms = playerRef.current.play(MORSE[c])
    askedAtRef.current = performance.now() + ms
    if (st.answerMs > 0) {
      if (answerRef.current) clearTimeout(answerRef.current)
      const id = promptRef.current
      answerRef.current = setTimeout(() => {
        if (!runningRef.current || id !== promptRef.current || answeredRef.current) return
        answeredRef.current = true
        score(c, false, 0)
        reinforce(c)
      }, ms + st.answerMs)
    }
  }, [score, reinforce])

  const stop = useCallback(() => {
    runningRef.current = false
    promptRef.current += 1
    answeredRef.current = true
    currentRef.current = null
    setRunning(false)
    clearAll()
    playerRef.current.stop()
    setSession(s => {
      if (s.asked) setDisplay({ kind: 'summary', acc: Math.round(s.hit / s.asked * 100), asked: s.asked })
      else setDisplay({ kind: 'idle', text: '\u00b7\u2212 \u00b7\u2212\u00b7 \u00b7\u2212\u00b7\u2212\u00b7', msg: 'press start, then type what you hear' })
      return s
    })
  }, [clearAll])

  const start = useCallback(() => {
    setAudioErr('')
    if (!playerRef.current.resume()) {
      setAudioErr('This browser has no Web Audio support, so the trainer cannot play tones.')
      return
    }
    currentRef.current = null
    setSession({ asked: 0, hit: 0 })
    setStreak(0)
    runningRef.current = true
    setRunning(true)
    if (inputRef.current) inputRef.current.focus()
    later(() => askRef.current && askRef.current(), 300)
  }, [later])

  useEffect(() => {
    if (!running || mode !== 'drill') return
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Escape') { e.preventDefault(); stop(); return }
      if (e.key === ' ') { e.preventDefault(); replay(); return }
      const k = e.key.toUpperCase()
      if (k.length !== 1 || !/[A-Z0-9.,?/]/.test(k)) return
      e.preventDefault()
      const c = currentRef.current
      if (!c || answeredRef.current) return
      const buf = (bufRef.current + k).slice(-c.length)
      bufRef.current = buf
      if (buf.length >= c.length) { bufRef.current = ''; answer(buf) }
      else setDisplay({ kind: 'idle', text: buf, msg: 'listening' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [running, mode, answer, replay, stop])

  useEffect(() => {
    const onHide = () => { if (document.hidden && runningRef.current) stop() }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [stop])

  /* --- unmount: switching DXEdge tabs destroys this component --- */
  useEffect(() => {
    const timers = timersRef.current
    const player = playerRef.current
    return () => {
      runningRef.current = false
      timers.forEach(clearTimeout)
      if (answerRef.current) clearTimeout(answerRef.current)
      player.close()
    }
  }, [])

  /* --- copy practice --- */

  const copyPlay = useCallback(() => {
    const text = src.trim()
    if (!text) { setCopyState('nothing to send'); return }
    if (!playerRef.current.resume()) { setCopyState('no Web Audio support'); return }
    const tokens = tokenize(text)
    if (!tokens.length) { setCopyState('no sendable characters'); return }
    playerRef.current.stop()
    clearAll()
    setSent(text)
    setResult(null)
    const { totalMs } = playerRef.current.playTokens(tokens)
    const n = tokens.filter(t => t !== ' ').length
    setCopyState(`sending ${n} characters \u00b7 ${Math.round(totalMs / 1000)}s`)
    later(() => setCopyState('sent \u00b7 check when ready'), totalMs + 400)
  }, [src, clearAll, later])

  const copyCheck = useCallback(() => {
    if (!sent) { setCopyState('send something first'); return }
    const r = alignCopy(sent, ans)
    setResult(r)
    setStats(prev => {
      const next = { ...prev }
      for (const o of r.ops) {
        const c = o.sent
        if (!c || c === ' ' || !MORSE[c]) continue
        next[c] = applyResult(next[c], o.op === 'hit', 0)
      }
      statsRef.current = next
      persist(next)
      return next
    })
  }, [sent, ans, persist])

  const newSource = useCallback((gen) => {
    playerRef.current.stop()
    clearAll()
    setSrc(gen()); setAns(''); setSent(''); setResult(null); setCopyState('')
  }, [clearAll])

  /* --- derived --- */

  const totalSeen = Object.values(stats).reduce((a, s) => a + s.seen, 0)
  const totalHit  = Object.values(stats).reduce((a, s) => a + s.correct, 0)
  const gridRows = pool.map(c => ({ c, s: stats[c] })).filter(x => x.s && x.s.seen > 0)
    .sort((a, b) => (a.s.correct / a.s.seen) - (b.s.correct / b.s.seen))

  const setField = (patch) => setS(prev => {
    const next = { ...prev, ...patch }
    if (next.effWpm > next.charWpm) next.effWpm = next.charWpm
    settRef.current = next
    return next
  })
  const commit = () => persist(null, settRef.current)
  const pick = (patch) => { setField(patch); setTimeout(commit, 0) }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ ...label, marginBottom: 8 }}>morse trainer</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, maxWidth: 660 }}>
          Adaptive character drill and copy practice with Farnsworth timing and optional Koch
          progression. Everything runs in your browser and progress stays on this device. There is a
          full screen version at <a href="/morse">dxedge.net/morse</a>.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <button onClick={() => { if (running) stop(); setMode('drill') }} style={chip(mode === 'drill')}>Drill</button>
        <button onClick={() => { if (running) stop(); setMode('copy') }} style={chip(mode === 'copy')}>Copy practice</button>
        <button onClick={() => setShowSet(v => !v)} style={{ ...chip(showSet), marginLeft: 'auto' }}>Settings</button>
      </div>

      {audioErr && (
        <div style={{ ...card, ...mono, fontSize: 11, color: 'var(--red)', marginBottom: 14 }}>{audioErr}</div>
      )}

      {showSet && (
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ ...label, marginBottom: 12 }}>sending</div>
          <Slider id="m-tone" text="Tone" min={300} max={1000} value={S.toneHz}
            readout={`${S.toneHz} Hz`} onChange={v => setField({ toneHz: v })} onCommit={commit} />
          <Slider id="m-char" text="Character speed" min={8} max={35} value={S.charWpm}
            readout={`${S.charWpm} wpm`} onChange={v => setField({ charWpm: v })} onCommit={commit} />
          <Slider id="m-eff" text="Effective speed (Farnsworth)" min={4} max={S.charWpm} value={S.effWpm}
            readout={S.effWpm >= S.charWpm ? `off (${S.charWpm} wpm)` : `${S.effWpm} wpm \u00b7 ${Math.round(gaps.charGapMs)} ms gap`}
            onChange={v => setField({ effWpm: v })} onCommit={commit} />
          <Slider id="m-vol" text="Volume" min={0} max={100} value={Math.round(S.volume * 100)}
            readout={`${Math.round(S.volume * 100)}%`} onChange={v => setField({ volume: v / 100 })} onCommit={commit} />

          <div style={{ ...label, margin: '16px 0 8px' }}>answer window</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {WAITS.map(([l, v]) => (
              <button key={l} onClick={() => pick({ answerMs: v })} style={chip(S.answerMs === v)}>{l}</button>
            ))}
          </div>

          <div style={{ ...label, margin: '16px 0 8px' }}>character set</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {POOL_LABELS.map(([k, l]) => (
              <button key={k} onClick={() => pick({ poolKey: k })} style={chip(S.poolKey === k)}>{l}</button>
            ))}
          </div>

          <div style={{ ...label, margin: '16px 0 8px' }}>koch progression</div>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.6 }}>
            Koch order introduces characters in the sequence that reaches solid copy fastest. Leave
            it off to drill the whole set at once.
          </p>
          <Slider id="m-koch" text="Characters in play" min={0} max={39} value={S.kochCount}
            readout={S.kochCount ? `${S.kochCount} of 39` : 'off'}
            onChange={v => setField({ kochCount: v })} onCommit={commit} />
          {S.kochCount > 0 && (
            <div style={{ ...mono, fontSize: 11, color: 'var(--dim)', marginTop: -4, marginBottom: 8 }}>
              {KOCH_ORDER.slice(0, S.kochCount).join(' ')}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <button style={chip(false)} onClick={() => {
              if (!window.confirm('Erase all Morse progress on this device? Settings are kept.')) return
              statsRef.current = {}
              setStats({}); persist({})
              setSession({ asked: 0, hit: 0 }); setStreak(0)
            }}>Reset all progress</button>
            <button style={chip(false)} onClick={() => { settRef.current = DEFAULTS; setS(DEFAULTS); persist(null, DEFAULTS) }}>
              Restore defaults
            </button>
          </div>
        </div>
      )}

      {mode === 'drill' && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
            <button onClick={running ? stop : start} style={{
              ...mono, fontSize: 12, padding: '8px 20px', borderRadius: 5, fontWeight: 600,
              border: `1px solid ${running ? 'var(--red)' : 'var(--green)'}`,
              background: running ? 'rgba(255,107,107,.08)' : 'rgba(0,255,157,.1)',
              color: running ? 'var(--red)' : 'var(--green)',
            }}>{running ? 'Stop session' : 'Start session'}</button>
            <span style={{ ...mono, fontSize: 10, color: 'var(--dim)' }}>{pool.length} characters in rotation</span>
          </div>

          <div onClick={() => { if (running && inputRef.current) inputRef.current.focus() }} style={{
            position: 'relative', border: '1px solid var(--border)', borderRadius: 8, background: '#000',
            minHeight: 250, display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', cursor: running ? 'text' : 'default',
          }}>
            {display.kind === 'flash' ? (
              <div style={{
                ...mono, fontSize: 'clamp(84px, 22vw, 180px)', lineHeight: 1, fontWeight: 700,
                color: display.ok ? 'var(--green)' : '#fff', animation: 'fadeIn .12s ease-out',
              }}>{display.text}</div>
            ) : display.kind === 'summary' ? (
              <div style={{ textAlign: 'center', padding: 18 }}>
                <div style={{ ...mono, fontSize: 46, fontWeight: 700, letterSpacing: 4,
                  color: display.acc >= 90 ? 'var(--green)' : display.acc >= 70 ? 'var(--yellow)' : 'var(--red)' }}>
                  {display.acc >= 90 ? 'FB' : display.acc >= 70 ? 'OK' : 'AGN'}
                </div>
                <div style={{ ...label, marginTop: 14 }}>
                  {display.asked} sent &middot; {display.acc}% copied &middot; press start to go again
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 18 }}>
                <div style={{ ...mono, color: 'var(--dim)', letterSpacing: 6,
                  fontSize: display.text.length <= 2 ? 46 : 28 }}>{display.text}</div>
                <div style={{ ...label, marginTop: 15 }}>{display.msg}</div>
              </div>
            )}
            <input ref={inputRef} inputMode="text" autoCapitalize="characters" autoCorrect="off"
              spellCheck={false} aria-label="Morse answer" value="" onChange={() => {}}
              style={{ position: 'absolute', opacity: 0, width: 1, height: 1, bottom: 0, left: 0, border: 'none' }} />
          </div>

          <div style={{ ...mono, fontSize: 10, color: 'var(--dim)', textAlign: 'center', margin: '9px 0 16px' }}>
            space replays &middot; esc stops &middot; tap the panel on a phone to raise the keyboard
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 9, marginBottom: 16 }}>
            {[
              ['session',  session.asked ? `${Math.round(session.hit / session.asked * 100)}%` : '--', 'var(--green)'],
              ['streak',   String(streak), streak >= 10 ? 'var(--yellow)' : 'var(--text)'],
              ['sent',     String(session.asked), 'var(--text)'],
              ['lifetime', totalSeen ? `${Math.round(totalHit / totalSeen * 100)}%` : '--', 'var(--teal)'],
              ['reps',     String(totalSeen), 'var(--muted)'],
            ].map(([l, v, c]) => (
              <div key={l} style={{ ...card, padding: '9px 11px' }}>
                <div style={label}>{l}</div>
                <div style={{ ...mono, fontSize: 19, color: c, marginTop: 3 }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={card}>
            <div style={{ ...label, marginBottom: 11 }}>per character</div>
            {gridRows.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                Run a session and every character you have seen will show up here.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(46px, 1fr))', gap: 5 }}>
                {gridRows.map(({ c, s }) => {
                  const acc = s.correct / s.seen
                  return (
                    <div key={c} title={`${c}  ${MORSE[c]}  ${s.correct}/${s.seen}${s.rtMs ? `  ~${(s.rtMs / 1000).toFixed(1)}s` : ''}`}
                      style={{
                        ...mono, fontSize: 11, padding: '5px 0', textAlign: 'center', borderRadius: 4,
                        background: 'var(--bg2)', color: 'var(--dim)',
                        border: `1px solid ${acc >= 0.9 ? 'rgba(0,255,157,.35)' : acc >= 0.7 ? 'rgba(255,214,0,.35)' : 'rgba(255,107,107,.4)'}`,
                      }}>
                      <div style={{ color: 'var(--text)', fontWeight: 700 }}>{c}</div>
                      <div style={{ fontSize: 9 }}>{Math.round(acc * 100)}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {mode === 'copy' && (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {SOURCES.map(([l, gen]) => (
              <button key={l} onClick={() => newSource(gen)} style={chip(false)}>{l}</button>
            ))}
          </div>

          <div style={{ ...card, marginBottom: 14 }}>
            <div style={{ ...label, marginBottom: 9 }}>what will be sent</div>
            <textarea value={src} onChange={e => setSrc(e.target.value)} rows={3} spellCheck={false}
              style={{ ...mono, fontSize: 12, width: '100%', padding: '8px 10px', borderRadius: 5,
                background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)',
                resize: 'vertical', lineHeight: 1.7 }} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 11 }}>
              <button onClick={copyPlay} style={{ ...chip(true), fontSize: 12, padding: '8px 20px', fontWeight: 600 }}>Send</button>
              <button onClick={() => { playerRef.current.stop(); clearAll(); setCopyState('stopped') }} style={chip(false)}>Stop</button>
              <span style={{ ...mono, fontSize: 10, color: 'var(--dim)' }}>{copyState}</span>
            </div>
          </div>

          <div style={{ ...card, marginBottom: 14 }}>
            <div style={{ ...label, marginBottom: 9 }}>copy it here</div>
            <textarea value={ans} onChange={e => setAns(e.target.value)} rows={3} spellCheck={false}
              autoCapitalize="characters" autoCorrect="off" placeholder="type what you hear, then check"
              style={{ ...mono, fontSize: 12, width: '100%', padding: '8px 10px', borderRadius: 5,
                background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)',
                resize: 'vertical', lineHeight: 1.7 }} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 11 }}>
              <button onClick={copyCheck} style={{ ...chip(false), fontSize: 12, padding: '8px 20px' }}>Check</button>
              <button onClick={() => { setAns(''); setResult(null) }} style={chip(false)}>Clear</button>
              {result && (
                <span style={{ ...mono, fontSize: 12,
                  color: result.accuracy >= 0.9 ? 'var(--green)' : result.accuracy >= 0.7 ? 'var(--yellow)' : 'var(--red)' }}>
                  {Math.round(result.accuracy * 100)}%  ({result.hits}/{result.total})
                </span>
              )}
            </div>
          </div>

          {result && (
            <div style={card}>
              <div style={{ ...label, marginBottom: 11 }}>where it went wrong</div>
              <div style={{ ...mono, fontSize: 15, lineHeight: 2.1, wordBreak: 'break-all' }}>
                {result.ops.map((o, i) => {
                  if (o.op === 'hit')  return <span key={i} style={{ color: 'var(--green)', padding: '0 1px' }}>{o.sent === ' ' ? '\u00b7' : o.sent}</span>
                  if (o.op === 'sub')  return <span key={i} title={`sent ${o.sent}`} style={{ color: 'var(--red)', textDecoration: 'underline', padding: '0 1px' }}>{o.typed}</span>
                  if (o.op === 'miss') return <span key={i} title="missed" style={{ color: 'var(--yellow)', opacity: .75, padding: '0 1px' }}>{o.sent === ' ' ? '\u00b7' : o.sent}</span>
                  return <span key={i} title="extra" style={{ color: 'var(--blue)', padding: '0 1px' }}>{o.typed}</span>
                })}
              </div>
              <div style={{ ...label, marginTop: 13 }}>
                <span style={{ color: 'var(--green)' }}>green</span> copied &middot;{' '}
                <span style={{ color: 'var(--red)' }}>red</span> wrong &middot;{' '}
                <span style={{ color: 'var(--yellow)' }}>yellow</span> missed &middot;{' '}
                <span style={{ color: 'var(--blue)' }}>blue</span> extra
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
