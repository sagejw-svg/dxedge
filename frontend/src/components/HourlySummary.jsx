import { useState, useEffect } from 'react'
import { api } from '../api'

function scoreToColor(score) {
  if (score >= 0.70) return '#00ff9d'
  if (score >= 0.55) return '#7affb2'
  if (score >= 0.40) return '#beff5a'
  if (score >= 0.28) return '#ffd600'
  if (score >= 0.16) return '#ff9933'
  return '#ff4d4d'
}

function scoreLabel(score) {
  if (score >= 0.70) return 'excellent'
  if (score >= 0.55) return 'good'
  if (score >= 0.40) return 'fair+'
  if (score >= 0.28) return 'fair'
  if (score >= 0.16) return 'poor+'
  return 'poor'
}

export default function HourlySummary({ grid }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [hoveredHour, setHoveredHour] = useState(null)
  const currentUtc = new Date().getUTCHours()

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      try {
        const result = await api.summary(grid)
        setData(result)
      } catch(e) {
        console.warn('Summary fetch failed:', e.message)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [grid])

  if (loading && !data) return (
    <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginTop: 14 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>24h propagation quality</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--dim)', animation: 'pulse 1.4s infinite' }}>computing...</div>
    </div>
  )

  if (!data) return null

  const hovered = hoveredHour !== null ? data.summary[hoveredHour] : null
  const current = data.summary[currentUtc]

  return (
    <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginTop: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
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

      {/* Hour blocks */}
      <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
        {data.summary.map(h => {
          const isCurrent = h.utc === currentUtc
          const isHovered = h.utc === hoveredHour
          const color = scoreToColor(h.score)
          const height = Math.max(12, Math.round(h.score * 52) + 8)

          return (
            <div key={h.utc}
              onMouseEnter={() => setHoveredHour(h.utc)}
              onMouseLeave={() => setHoveredHour(null)}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'default' }}
            >
              <div style={{
                width: '100%', height,
                background: color,
                opacity: isHovered ? 1 : isCurrent ? 1 : 0.75,
                borderRadius: 2,
                border: isCurrent ? `2px solid white` : isHovered ? `1px solid ${color}` : 'none',
                transition: 'height 0.3s ease, opacity 0.15s',
                boxSizing: 'border-box',
              }} />
            </div>
          )
        })}
      </div>

      {/* Hour labels - show every 3 hours */}
      <div style={{ display: 'flex', marginTop: 4 }}>
        {data.summary.map(h => (
          <div key={h.utc} style={{
            flex: 1, textAlign: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: h.utc % 6 === 0 ? 9 : 0,
            color: h.utc === currentUtc ? 'var(--teal)' : 'var(--dim)',
            fontWeight: h.utc === currentUtc ? 700 : 400,
            overflow: 'hidden',
          }}>
            {h.utc % 6 === 0 ? String(h.utc).padStart(2,'0') : ''}
          </div>
        ))}
      </div>

      {/* UTC label */}
      <div style={{ textAlign: 'right', marginTop: 2, fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--dim)', letterSpacing: 1 }}>UTC</div>

      {/* Tooltip */}
      {hovered && (
        <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--bg2)', borderRadius: 6, border: '1px solid var(--border)', display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
            {String(hovered.utc).padStart(2,'0')}:00Z
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: scoreToColor(hovered.score), fontWeight: 700 }}>
            {scoreLabel(hovered.score)}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
            {Math.round(hovered.score * 100)}% average reliability
          </span>
          {hovered.utc === currentUtc && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--teal)', background: '#7affb215', padding: '1px 6px', borderRadius: 3 }}>now</span>
          )}
        </div>
      )}

      {/* Color legend */}
      <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
        {[
          { color: '#00ff9d', label: 'Excellent' },
          { color: '#7affb2', label: 'Good' },
          { color: '#beff5a', label: 'Fair+' },
          { color: '#ffd600', label: 'Fair' },
          { color: '#ff9933', label: 'Poor+' },
          { color: '#ff4d4d', label: 'Poor' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 10, background: l.color, borderRadius: 2 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)' }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
