import { useState, useEffect, memo} from 'react'
import { api } from '../api'

const BANDS = ['10m','15m','17m','20m','30m','40m','80m']

function scoreToColor(score) {
  if (score >= 0.70) return '#00ff9d'
  if (score >= 0.55) return '#7affb2'
  if (score >= 0.40) return '#beff5a'
  if (score >= 0.28) return '#ffd600'
  if (score >= 0.16) return '#ff9933'
  if (score >= 0.05) return '#ff4d4d'
  return '#1a1a1a'
}

function scoreLabel(score) {
  if (score >= 0.70) return 'excellent'
  if (score >= 0.55) return 'good'
  if (score >= 0.40) return 'fair+'
  if (score >= 0.28) return 'fair'
  if (score >= 0.16) return 'poor+'
  return 'poor'
}

const HourlySummary = memo(function HourlySummary({ grid }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [hovered, setHovered] = useState(null) // {utc, band?}
  const currentUtc = new Date().getUTCHours()

  useEffect(() => {
    setLoading(true)
    api.summary(grid)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [grid])

  if (loading && !data) return (
    <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginTop: 14 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 }}>24h propagation quality</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--dim)', animation: 'pulse 1.4s infinite' }}>computing...</div>
    </div>
  )

  if (!data) return null

  const hovH = hovered ? data.summary[hovered.utc] : null
  const current = data.summary[currentUtc]

  return (
    <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginTop: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase' }}>
            24h propagation quality
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', marginLeft: 10 }}>
            avg across EU · JA · VK · SA · AF
          </span>
        </div>
        {current && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: scoreToColor(current.score), fontWeight: 700 }}>
            now: {scoreLabel(current.score)}
          </span>
        )}
      </div>

      {/* Heat map - bands + overall bar */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ minWidth: 520 }}>

          {/* Hour header */}
          <div style={{ display: 'flex', marginLeft: 36 }}>
            {data.summary.map(h => (
              <div key={h.utc} style={{
                flex: 1, textAlign: 'center',
                fontFamily: 'var(--font-mono)', fontSize: 8,
                color: h.utc === currentUtc ? 'var(--teal)' : 'var(--dim)',
                fontWeight: h.utc === currentUtc ? 700 : 400,
                borderBottom: h.utc === currentUtc ? '2px solid var(--teal)' : '2px solid transparent',
                paddingBottom: 2, marginBottom: 4 }}>
                {h.utc % 6 === 0 ? String(h.utc).padStart(2,'0') : ''}
              </div>
            ))}
          </div>

          {/* Band rows */}
          {BANDS.map(band => (
            <div key={band} style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
              <div style={{
                width: 32, fontFamily: 'var(--font-mono)', fontSize: 10,
                fontWeight: 700, color: 'var(--muted)', textAlign: 'right',
                paddingRight: 6, flexShrink: 0
              }}>{band}</div>
              {data.summary.map(h => {
                const score = h.bands?.[band] ?? 0
                const isCurrent = h.utc === currentUtc
                const isHov = hovered?.utc === h.utc && hovered?.band === band
                return (
                  <div key={h.utc}
                    onMouseEnter={() => setHovered({ utc: h.utc, band })}
                    onMouseLeave={() => setHovered(null)}
                    style={{
                      flex: 1, height: 18,
                      background: scoreToColor(score),
                      opacity: isHov ? 1 : 0.85,
                      border: isCurrent
                        ? '1px solid rgba(122,255,178,0.8)'
                        : isHov ? '1px solid rgba(255,255,255,0.3)' : '1px solid #0a0a0a',
                      cursor: 'default', borderRadius: 1,
                      transition: 'opacity 0.1s' }}
                  />
                )
              })}
            </div>
          ))}

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--border)', margin: '6px 0 6px 36px' }} />

          {/* Overall bar row */}
          <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: 2 }}>
            <div style={{
              width: 32, fontFamily: 'var(--font-mono)', fontSize: 9,
              color: 'var(--dim)', textAlign: 'right', paddingRight: 6,
              flexShrink: 0, paddingBottom: 2
            }}>all</div>
            {data.summary.map(h => {
              const isCurrent = h.utc === currentUtc
              const isHov = hovered?.utc === h.utc && !hovered?.band
              const height = Math.max(8, Math.round(h.score * 36) + 4)
              return (
                <div key={h.utc}
                  onMouseEnter={() => setHovered({ utc: h.utc })}
                  onMouseLeave={() => setHovered(null)}
                  style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
                  <div style={{
                    width: '100%', height,
                    background: scoreToColor(h.score),
                    opacity: isHov ? 1 : 0.8,
                    border: isCurrent ? '1px solid white' : isHov ? '1px solid rgba(255,255,255,0.3)' : 'none',
                    borderRadius: 2,
                    transition: 'height 0.3s ease, opacity 0.1s' }} />
                </div>
              )
            })}
          </div>

          {/* UTC label row */}
          <div style={{ display: 'flex', marginLeft: 36, marginTop: 3 }}>
            {data.summary.map(h => (
              <div key={h.utc} style={{
                flex: 1, textAlign: 'center',
                fontFamily: 'var(--font-mono)', fontSize: 8,
                color: h.utc === currentUtc ? 'var(--teal)' : 'var(--dim)',
                fontWeight: h.utc === currentUtc ? 700 : 400 }}>
                {h.utc % 6 === 0 ? String(h.utc).padStart(2,'0') : ''}
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Tooltip */}
      {hovered && hovH && (
        <div style={{ marginTop: 10, padding: '7px 12px', background: 'var(--bg2)', borderRadius: 6, border: '1px solid var(--border)', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
            {String(hovered.utc).padStart(2,'0')}:00Z
          </span>
          {hovered.band ? (
            <>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--blue)' }}>{hovered.band}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: scoreToColor(hovH.bands?.[hovered.band] ?? 0), fontWeight: 700 }}>
                {scoreLabel(hovH.bands?.[hovered.band] ?? 0)}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
                {Math.round((hovH.bands?.[hovered.band] ?? 0) * 100)}% avg reliability
              </span>
            </>
          ) : (
            <>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: scoreToColor(hovH.score), fontWeight: 700 }}>
                {scoreLabel(hovH.score)}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
                {Math.round(hovH.score * 100)}% overall
              </span>
            </>
          )}
          {hovered.utc === currentUtc && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--teal)', background: '#7affb215', padding: '1px 6px', borderRadius: 3 }}>now</span>
          )}
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
        {[
          { color: '#00ff9d', label: 'Excellent' },
          { color: '#7affb2', label: 'Good' },
          { color: '#beff5a', label: 'Fair+' },
          { color: '#ffd600', label: 'Fair' },
          { color: '#ff9933', label: 'Poor+' },
          { color: '#ff4d4d', label: 'Poor' },
          { color: '#1a1a1a', label: 'Closed' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 10, background: l.color, borderRadius: 1, border: '1px solid #333' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)' }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
)

export default HourlySummary
