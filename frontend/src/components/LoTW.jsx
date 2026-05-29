import { useState } from 'react'
import { api } from '../api'
import { parseADIF, buildNeedsMatrix, getDXCCSummary } from '../adif'

export default function LoTW({ callsign, onSuccess, matrixLoaded }) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [summary, setSummary] = useState(null)

  const handleFetch = async () => {
    if (!callsign || !password) return
    setLoading(true)
    setError(null)
    try {
      const { adif } = await api.lotw(callsign, password)
      const qsos = parseADIF(adif)
      const matrix = buildNeedsMatrix(qsos)
      const sum = getDXCCSummary(matrix)
      setSummary({ qsos: qsos.length, entities: sum.length, list: sum })
      onSuccess(adif)
      setPassword('') // clear password immediately
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12 }}>
          lotw integration
        </div>

        <p style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', lineHeight: 1.7, marginBottom: 16 }}>
          Enter your LoTW password to load your confirmed QSOs. Your credentials are used once to fetch ADIF data and are never stored. The needs matrix is built in your browser only.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 320 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: 2, textTransform: 'uppercase' }}>callsign</label>
            <input value={callsign} readOnly style={{
              fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
              background: 'var(--bg2)', border: '1px solid var(--border)',
              color: 'var(--muted)', padding: '7px 10px', borderRadius: 6, outline: 'none'
            }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: 2, textTransform: 'uppercase' }}>lotw password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleFetch()}
              placeholder="your LoTW password"
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 13,
                background: 'var(--bg1)', border: '1px solid var(--border)',
                color: 'var(--text)', padding: '7px 10px', borderRadius: 6, outline: 'none'
              }}
            />
          </div>

          <button
            onClick={handleFetch}
            disabled={loading || !callsign || !password}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 12,
              background: loading ? 'var(--bg2)' : 'var(--bg1)',
              border: `1px solid ${loading ? 'var(--border)' : '#7affb244'}`,
              color: loading ? 'var(--dim)' : 'var(--teal)',
              padding: '9px 16px', borderRadius: 6, marginTop: 4
            }}
          >
            {loading ? 'fetching from LoTW...' : 'load confirmed QSOs'}
          </button>
        </div>

        {error && (
          <div style={{ marginTop: 14, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--red)' }}>
            {error}
          </div>
        )}
      </div>

      {summary && (
        <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginTop: 12 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12 }}>needs matrix loaded</div>
          <div style={{ display: 'flex', gap: 20, marginBottom: 14 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, color: 'var(--teal)', fontWeight: 700 }}>{summary.qsos.toLocaleString()}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: 2, textTransform: 'uppercase' }}>confirmed QSOs</div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, color: 'var(--yellow)', fontWeight: 700 }}>{summary.entities}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: 2, textTransform: 'uppercase' }}>DXCC confirmed</div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, color: 'var(--blue)', fontWeight: 700 }}>{340 - summary.entities}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: 2, textTransform: 'uppercase' }}>still needed</div>
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
            DX Spots tab now highlights needed entities in green. Switch to DX Spots to see your needs.
          </p>
        </div>
      )}
    </div>
  )
}
