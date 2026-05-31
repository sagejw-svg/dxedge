import { useState, useEffect, useRef } from 'react'
import { api } from '../api'
import { parseADIF, buildNeedsMatrix, getDXCCSummary } from '../adif'

export default function LoTW({ callsign: defaultCallsign, onSuccess, matrixLoaded }) {
  const [lotwCall, setLotwCall] = useState(defaultCallsign || '')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [summary, setSummary] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef(null)

  // Keep callsign in sync if header callsign changes and user hasn't overridden
  useEffect(() => {
    if (defaultCallsign && !lotwCall) setLotwCall(defaultCallsign)
  }, [defaultCallsign])

  // Elapsed timer while loading
  useEffect(() => {
    if (loading) {
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [loading])

  const handleFetch = async () => {
    if (!lotwCall || !password || loading) return
    setLoading(true)
    setError(null)
    setSummary(null)
    try {
      const { adif } = await api.lotw(lotwCall.trim(), password)
      if (!adif) throw new Error('Empty response from LoTW')
      const qsos = parseADIF(adif)
      if (qsos.length === 0) {
        setError('No confirmed QSOs found. Check your callsign or try a longer date range.')
        return
      }
      const matrix = buildNeedsMatrix(qsos)
      const sum = getDXCCSummary(matrix)
      setSummary({ qsos: qsos.length, entities: sum.length, list: sum })
      onSuccess(adif)
      setPassword('')
    } catch (e) {
      const msg = e.message || 'Unknown error'
      if (msg.includes('authentication failed') || msg.includes('502')) {
        setError('Login failed — check your LoTW callsign and password. Note: LoTW password is different from your ARRL website password.')
      } else if (msg.includes('504') || msg.includes('timeout')) {
        setError('LoTW took too long to respond. Try again — this is common for large logs.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700,
    background: '#111', border: '1px solid var(--border)',
    color: 'var(--text)', padding: '10px 12px', borderRadius: 6,
    outline: 'none', width: '100%', WebkitAppearance: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle = {
    fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)',
    letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6,
    display: 'block',
  }

  const canSubmit = lotwCall.trim().length >= 3 && password.length >= 1 && !loading

  return (
    <div>
      <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 14 }}>
          LoTW — Logbook of the World
        </div>

        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 20 }}>
          Load your confirmed QSOs from ARRL Logbook of the World. Your credentials are sent directly to LoTW and never stored on DXEdge servers. Your needs matrix is built locally in the browser.
        </p>

        {/* Important note about LoTW password */}
        <div style={{ background: '#ffd60010', border: '1px solid #ffd60033', borderRadius: 6, padding: '10px 14px', marginBottom: 18 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--yellow)' }}>
            ⚠ Use your <strong>LoTW password</strong> — not your ARRL website password. Get it at{' '}
            <a href="https://lotw.arrl.org/lotwuser/default" target="_blank" rel="noreferrer" style={{ color: 'var(--blue)' }}>
              lotw.arrl.org ↗
            </a>
          </span>
        </div>

        {/* Error display - prominent, at top */}
        {error && (
          <div style={{
            background: '#ff6b6b15', border: '1px solid #ff6b6b55',
            borderRadius: 8, padding: '12px 16px', marginBottom: 16,
            fontFamily: 'var(--font-mono)', fontSize: 12, color: '#ff9999',
            lineHeight: 1.6
          }}>
            ❌ {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 380 }}>
          <div>
            <label style={labelStyle} htmlFor="lotw-callsign">LoTW callsign</label>
            <input
              id="lotw-callsign"
              value={lotwCall}
              onChange={e => setLotwCall(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && canSubmit && handleFetch()}
              placeholder="K6WRJ"
              maxLength={10}
              autoComplete="username"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle} htmlFor="lotw-password">LoTW password</label>
            <input
              id="lotw-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && canSubmit && handleFetch()}
              placeholder="your LoTW password"
              autoComplete="current-password"
              style={inputStyle}
            />
          </div>

          <button
            onClick={handleFetch}
            disabled={!canSubmit}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 14,
              background: loading ? '#0a1a0a' : canSubmit ? '#7affb220' : 'var(--bg2)',
              border: `1px solid ${loading ? '#2a4a2a' : canSubmit ? '#7affb266' : 'var(--border)'}`,
              color: loading ? '#4a8a4a' : canSubmit ? 'var(--teal)' : 'var(--dim)',
              padding: '12px 20px', borderRadius: 8,
              cursor: canSubmit ? 'pointer' : 'default',
              transition: 'all 0.15s',
              marginTop: 4,
            }}
          >
            {loading
              ? `fetching from LoTW... ${elapsed}s`
              : 'load confirmed QSOs'}
          </button>

          {loading && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--dim)', fontStyle: 'italic' }}>
              LoTW can take 15–30 seconds for large logs. Please wait.
            </div>
          )}
        </div>
      </div>

      {/* Success summary */}
      {summary && (
        <div style={{ background: 'var(--bg1)', border: '1px solid #7affb233', borderRadius: 10, padding: 20, marginTop: 14 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 16 }}>
            ✓ needs matrix loaded
          </div>
          <div style={{ display: 'flex', gap: 28, marginBottom: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, color: 'var(--teal)', fontWeight: 700 }}>
                {summary.qsos.toLocaleString()}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', letterSpacing: 2, textTransform: 'uppercase' }}>
                confirmed QSOs
              </div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, color: 'var(--yellow)', fontWeight: 700 }}>
                {summary.entities}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', letterSpacing: 2, textTransform: 'uppercase' }}>
                DXCC confirmed
              </div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, color: 'var(--blue)', fontWeight: 700 }}>
                {Math.max(0, 340 - summary.entities)}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', letterSpacing: 2, textTransform: 'uppercase' }}>
                still needed
              </div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic', lineHeight: 1.6 }}>
            Switch to the DX Spots tab — stations you still need are highlighted in teal.
          </p>
        </div>
      )}
    </div>
  )
}
