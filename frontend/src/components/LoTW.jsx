import { useState } from 'react'
import { api } from '../api'
import { parseADIF, buildNeedsMatrix, getDXCCSummary } from '../adif'

export default function LoTW({ callsign: defaultCallsign, onSuccess, matrixLoaded }) {
  const [lotwCall, setLotwCall] = useState(defaultCallsign || '')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [summary, setSummary] = useState(null)

  const handleFetch = async () => {
    if (!lotwCall || !password) return
    setLoading(true)
    setError(null)
    try {
      const { adif } = await api.lotw(lotwCall, password)
      const qsos = parseADIF(adif)
      const matrix = buildNeedsMatrix(qsos)
      const sum = getDXCCSummary(matrix)
      setSummary({ qsos: qsos.length, entities: sum.length, list: sum })
      onSuccess(adif)
      setPassword('')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700,
    background: 'var(--bg1)', border: '1px solid var(--border)',
    color: 'var(--text)', padding: '8px 12px', borderRadius: 6,
    outline: 'none', width: '100%'
  }

  const labelStyle = {
    fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)',
    letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4, display: 'block'
  }

  return (
    <div>
      <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 14 }}>
          lotw integration
        </div>

        <p style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic', lineHeight: 1.7, marginBottom: 20 }}>
          Enter your LoTW callsign and password to load confirmed QSOs. Credentials are used once and never stored. Your needs matrix is built in the browser only.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 360 }}>
          <div>
            <label style={labelStyle}>lotw callsign</label>
            <input
              value={lotwCall}
              onChange={e => setLotwCall(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleFetch()}
              placeholder="K6WRJ"
              maxLength={10}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>lotw password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleFetch()}
              placeholder="your LoTW password"
              style={inputStyle}
            />
          </div>

          <button
            onClick={handleFetch}
            disabled={loading || !lotwCall || !password}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 13,
              background: loading ? 'var(--bg2)' : 'var(--bg1)',
              border: `1px solid ${loading ? 'var(--border)' : '#7affb244'}`,
              color: loading ? 'var(--dim)' : 'var(--teal)',
              padding: '10px 18px', borderRadius: 6, cursor: loading ? 'default' : 'pointer',
              marginTop: 4
            }}
          >
            {loading ? 'fetching from LoTW...' : 'load confirmed QSOs'}
          </button>
        </div>

        {error && (
          <div style={{ marginTop: 16, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--red)' }}>
            {error}
          </div>
        )}
      </div>

      {summary && (
        <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginTop: 14 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 16 }}>needs matrix loaded</div>
          <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 26, color: 'var(--teal)', fontWeight: 700 }}>{summary.qsos.toLocaleString()}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', letterSpacing: 2, textTransform: 'uppercase' }}>confirmed QSOs</div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 26, color: 'var(--yellow)', fontWeight: 700 }}>{summary.entities}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', letterSpacing: 2, textTransform: 'uppercase' }}>DXCC confirmed</div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 26, color: 'var(--blue)', fontWeight: 700 }}>{340 - summary.entities}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', letterSpacing: 2, textTransform: 'uppercase' }}>still needed</div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>
            Switch to DX Spots - needed entities are highlighted in green.
          </p>
        </div>
      )}
    </div>
  )
}
