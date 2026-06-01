import { useState, useEffect } from 'react'
import { api } from '../api'

export default function Header({ callsign, grid, onCallsign, onGrid, loading, lastUpdate, onRefresh, matrixLoaded, wsStatus }) {
  const [rec, setRec] = useState(null)

  useEffect(() => {
    if (!grid || grid.length < 4) return
    api.recommendation(grid)
      .then(setRec)
      .catch(() => {})
  }, [grid])

  const localScore = rec?.local?.score || 0
  const dxScore    = rec?.dx?.score    || 0
  const localColor = localScore >= 0.75 ? 'var(--green)' : localScore >= 0.55 ? 'var(--teal)' : localScore >= 0.35 ? 'var(--yellow)' : 'var(--red)'
  const dxColor    = dxScore    >= 0.75 ? 'var(--green)' : dxScore    >= 0.55 ? 'var(--teal)' : dxScore    >= 0.35 ? 'var(--yellow)' : 'var(--red)'

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 3 }}>
            propagation intel
          </div>
          <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: '#eee', letterSpacing: -0.5 }}>
            DXEdge<span style={{ color: 'var(--dim)', fontSize: 13, marginLeft: 6, fontWeight: 400 }}>.net</span>
          </h1>
          {matrixLoaded && (
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--teal)',
              background: '#7affb215', border: '1px solid #7affb233',
              padding: '2px 8px', borderRadius: 3, marginTop: 4,
              display: 'inline-block'
            }}>
              ✓ LoTW needs matrix active
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <button onClick={onRefresh} disabled={loading} style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            background: 'var(--bg1)', border: `1px solid ${loading ? 'var(--border)' : '#7affb244'}`,
            color: loading ? 'var(--dim)' : 'var(--teal)',
            padding: '8px 14px', borderRadius: 6, cursor: loading ? 'default' : 'pointer'
          }}>
            {loading ? 'fetching...' : '↺ refresh'}
          </button>
          {lastUpdate && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)' }}>
              {lastUpdate.toISOString().slice(11, 16)}Z
            </span>
          )}
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9,
            color: wsStatus === 'live' ? 'var(--teal)' : wsStatus === 'reconnecting' ? 'var(--yellow)' : 'var(--dim)',
          }}>
            {wsStatus === 'live' ? '● live' : wsStatus === 'reconnecting' ? '○ reconnecting...' : '○ connecting...'}
          </span>
        </div>
      </div>

      {/* Callsign + Grid inputs */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: 2, textTransform: 'uppercase' }}>callsign</label>
          <input
            value={callsign}
            onChange={e => onCallsign(e.target.value.toUpperCase())}
            placeholder="K6WRJ"
            maxLength={10}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700,
              background: 'var(--bg1)', border: '1px solid var(--border)',
              color: 'var(--text)', padding: '7px 10px', borderRadius: 6,
              width: 110, outline: 'none'
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: 2, textTransform: 'uppercase' }}>
            grid <span style={{ color: 'var(--dim)', fontSize: 8 }}>(for live rx)</span>
          </label>
          <input
            value={grid}
            onChange={e => onGrid(e.target.value.toUpperCase())}
            placeholder="CM95"
            maxLength={6}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700,
              background: 'var(--bg1)', border: '1px solid var(--border)',
              color: 'var(--text)', padding: '7px 10px', borderRadius: 6,
              width: 90, outline: 'none'
            }}
          />
        </div>

        {/* Recommendation sentence */}
        {rec && (
          <div style={{
            flex: 1, background: 'var(--bg1)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '7px 14px',
            display: 'flex', flexDirection: 'column', gap: 4,
            minWidth: 240
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 }}>
              if you had one hour to operate
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)' }}>local</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: localColor }}>
                  {rec.local.band}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)' }}>
                  {rec.local.hour === new Date().getUTCHours() ? 'now' : `${String(rec.local.hour).padStart(2,'0')}:00Z`}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: localColor, background: `${localColor}15`, padding: '1px 5px', borderRadius: 3 }}>
                  {rec.local.score >= 0.75 ? 'excellent' : rec.local.score >= 0.55 ? 'good' : rec.local.score >= 0.35 ? 'fair' : 'marginal'}
                </span>
              </div>
              <div style={{ width: 1, background: 'var(--border)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)' }}>DX to {rec.dx.region}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: dxColor }}>
                  {rec.dx.band}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)' }}>
                  {rec.dx.hour === new Date().getUTCHours() ? 'now' : `${String(rec.dx.hour).padStart(2,'0')}:00Z`}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: dxColor, background: `${dxColor}15`, padding: '1px 5px', borderRadius: 3 }}>
                  {rec.dx.score >= 0.75 ? 'excellent' : rec.dx.score >= 0.55 ? 'good' : rec.dx.score >= 0.35 ? 'fair' : 'marginal'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
