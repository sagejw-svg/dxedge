import { useState, useEffect, useCallback, memo} from 'react'
import { api } from '../api'

const REGIONS = [
  { code: 'EU',  name: 'Europe'         },
  { code: 'JA',  name: 'Japan'          },
  { code: 'VK',  name: 'Australia/NZ'   },
  { code: 'AS',  name: 'Central Asia'   },
  { code: 'AF',  name: 'Africa'         },
  { code: 'SA',  name: 'South America'  },
  { code: 'NA',  name: 'NE North America'},
  { code: 'UA9', name: 'Russia/Siberia' },
]

const BANDS_ORDER = ['10m','12m','15m','17m','20m','30m','40m','80m']

function relColor(r) {
  if (r >= 0.75) return '#00ff9d'
  if (r >= 0.55) return '#7affb2'
  if (r >= 0.35) return '#ffd600'
  if (r >= 0.15) return '#ff9933'
  return '#1a1a1a'
}

function relText(r) {
  if (r >= 0.75) return '#000'
  if (r >= 0.35) return '#000'
  return '#555'
}

function HeatMap({ hours, currentUtc }) {
  if (!hours || hours.length === 0) return null

  const cellW = 28
  const cellH = 28

  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ minWidth: 700 }}>
        {/* Hour headers */}
        <div style={{ display: 'flex', marginLeft: 44 }}>
          {hours.map(h => (
            <div key={h.utc} style={{
              width: cellW, textAlign: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 9,
              color: h.utc === currentUtc ? 'var(--teal)' : 'var(--dim)',
              fontWeight: h.utc === currentUtc ? 700 : 400,
              borderBottom: h.utc === currentUtc ? '2px solid var(--teal)' : '2px solid transparent',
              paddingBottom: 2, marginBottom: 4 }}>{String(h.utc).padStart(2,'0')}</div>
          ))}
        </div>

        {/* Band rows */}
        {BANDS_ORDER.map(band => (
          <div key={band} style={{ display: 'flex', alignItems: 'center', marginBottom: 3 }}>
            <div style={{
              width: 40, fontFamily: 'var(--font-mono)', fontSize: 12,
              fontWeight: 700, color: 'var(--muted)', textAlign: 'right',
              paddingRight: 6, flexShrink: 0
            }}>{band}</div>
            {hours.map(h => {
              const r = h.bands[band] ?? 0
              const isCurrent = h.utc === currentUtc
              return (
                <div key={h.utc} title={`${band} ${h.utc}Z: ${Math.round(r*100)}% (MUF ${h.muf} MHz)`}
                  style={{
                    width: cellW, height: cellH,
                    background: relColor(r),
                    border: isCurrent ? '2px solid var(--teal)' : '1px solid #0a0a0a',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-mono)', fontSize: 9,
                    color: r > 0.1 ? relText(r) : 'transparent',
                    cursor: 'default', flexShrink: 0,
                    borderRadius: 2 }}>
                  {r > 0.1 ? Math.round(r*100) : ''}
                </div>
              )
            })}
          </div>
        ))}

        {/* MUF row */}
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 6 }}>
          <div style={{ width: 40, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', textAlign: 'right', paddingRight: 6, flexShrink: 0 }}>MUF</div>
          {hours.map(h => (
            <div key={h.utc} style={{
              width: cellW, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 8,
              color: h.utc === currentUtc ? 'var(--teal)' : 'var(--dim)',
              flexShrink: 0 }}>{h.muf}</div>
          ))}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 14, marginTop: 14, flexWrap: 'wrap' }}>
          {[
            { color: '#00ff9d', label: 'Excellent (≥75%)' },
            { color: '#7affb2', label: 'Good (55-74%)' },
            { color: '#ffd600', label: 'Fair (35-54%)' },
            { color: '#ff9933', label: 'Marginal (15-34%)' },
            { color: '#1a1a1a', label: 'Closed (<15%)' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 14, height: 14, background: l.color, borderRadius: 2, border: '1px solid #333' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)' }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const VOACAP = memo(function VOACAP({ grid }) {
  const [txGrid, setTxGrid] = useState(grid || 'CM95')
  const [region, setRegion] = useState('EU')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  // Sync txGrid with prop only on initial mount
  useEffect(() => {
    setTxGrid(prev => prev === 'CM95' && grid ? grid : prev)
  }, [grid])

  const currentUtc = new Date().getUTCHours()

  const fetchPrediction = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.voacap(txGrid, region)
      setData(result)
    } catch(e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [grid, region])

  useEffect(() => { fetchPrediction() }, [fetchPrediction, txGrid])

  const bestNow = data?.hours?.[currentUtc]?.best_band
  const mufNow = data?.hours?.[currentUtc]?.muf

  const selectStyle = {
    fontFamily: 'var(--font-mono)', fontSize: 13,
    background: 'var(--bg1)', border: '1px solid var(--border)',
    color: 'var(--text)', padding: '6px 12px', borderRadius: 6,
    outline: 'none', cursor: 'pointer'
  }

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: 2, textTransform: 'uppercase' }}>from grid</label>
          <input
            value={txGrid}
            onChange={e => setTxGrid(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0,6))}
            onBlur={() => { if (txGrid.length >= 4) fetchPrediction() }}
            onKeyDown={e => e.key === 'Enter' && txGrid.length >= 4 && fetchPrediction()}
            placeholder="CM95"
            maxLength={6}
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700,
              color: 'var(--teal)', padding: '6px 12px',
              background: 'var(--bg1)', border: '1px solid #7affb244',
              borderRadius: 6, outline: 'none', width: 90,
              WebkitAppearance: 'none' }}
          />
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--dim)', alignSelf: 'flex-end', paddingBottom: 6 }}>→</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: 2, textTransform: 'uppercase' }}>to region</label>
          <select value={region} onChange={e => setRegion(e.target.value)} style={selectStyle}>
            {REGIONS.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
          </select>
        </div>
        <div style={{ alignSelf: 'flex-end' }}>
          <button onClick={fetchPrediction} disabled={loading} style={{
            fontFamily: 'var(--font-mono)', fontSize: 12,
            background: 'var(--bg1)', border: `1px solid ${loading ? 'var(--border)' : '#7affb244'}`,
            color: loading ? 'var(--dim)' : 'var(--teal)',
            padding: '6px 14px', borderRadius: 6, cursor: loading ? 'default' : 'pointer'
          }}>
            {loading ? 'computing...' : '↺ refresh'}
          </button>
        </div>
      </div>

      {/* Path info + current conditions */}
      {data && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'short path', value: `${data.distance_sp_km.toLocaleString()} km`, sub: `${data.azimuth_sp}°` },
            { label: 'long path',  value: `${data.distance_lp_km.toLocaleString()} km`, sub: `${data.azimuth_lp}°` },
            { label: 'best band now', value: bestNow || '—', sub: `MUF ${mufNow} MHz` },
            { label: 'sfi / k',    value: `${data.sfi}`, sub: `K=${data.kp}` },
          ].map(item => (
            <div key={item.label} style={{
              background: 'var(--bg1)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '10px 16px', minWidth: 110
            }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: item.label === 'best band now' ? 'var(--teal)' : 'var(--text)' }}>{item.value}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{item.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ background: '#ff6b6b11', border: '1px solid #ff6b6b33', borderRadius: 8, padding: 14, marginBottom: 14 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--red)' }}>{error}</span>
        </div>
      )}

      {/* Heat map */}
      {loading && !data && (
        <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10, padding: 40, textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--dim)', letterSpacing: 3, animation: 'pulse 1.4s infinite' }}>COMPUTING PROPAGATION...</div>
        </div>
      )}

      {data && !loading && (
        <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase' }}>
                band reliability · 24h forecast
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', marginLeft: 12 }}>
                {grid} → {data.region_name}
              </span>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--dim)' }}>
              current UTC: {String(currentUtc).padStart(2,'0')}:00Z ↓
            </span>
          </div>
          <HeatMap hours={data.hours} currentUtc={currentUtc} />
          <p style={{ marginTop: 14, fontSize: 12, color: 'var(--dim)', fontStyle: 'italic', lineHeight: 1.6 }}>
            Prediction uses real-time NOAA solar data (SFI={data.sfi}, K={data.kp}). Values show estimated circuit reliability %. Current UTC hour highlighted. Hover cells for detail.
          </p>
        </div>
      )}
    </div>
  )
}
)

export default VOACAP
