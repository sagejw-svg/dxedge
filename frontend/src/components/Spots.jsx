import { useState } from 'react'

const BANDS = ['', '160m', '80m', '40m', '30m', '20m', '17m', '15m', '12m', '10m', '6m']
const MODES = ['', 'FT8', 'FT4', 'SSB', 'CW', 'RTTY']
const CONT_FLAG = { EU: '🌍', AS: '🌏', OC: '🌏', AF: '🌍', SA: '🌎', NA: '🌎' }

function SpotRow({ spot, needed }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '28px 1fr 80px 64px 52px 56px',
      alignItems: 'center', gap: 10, padding: '8px 14px',
      borderBottom: '1px solid var(--border)',
      background: needed ? '#7affb208' : 'transparent',
      borderLeft: needed ? '3px solid var(--teal)' : '3px solid transparent',
      animation: 'fadeIn 0.3s ease both'
    }}>
      <span style={{ fontSize: 16 }}>{CONT_FLAG[spot.continent] || '📡'}</span>
      <div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: needed ? 'var(--teal)' : 'var(--text)' }}>
          {spot.callsign}
        </span>
        {needed && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--teal)', marginLeft: 6, background: '#7affb220', padding: '1px 6px', borderRadius: 3 }}>NEED</span>}
        <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', marginTop: 2 }}>{spot.comment || spot.dxcc || ''}</div>
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--teal)' }}>{spot.freq} kHz</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--yellow)', background: '#ffd60015', padding: '2px 6px', borderRadius: 3, textAlign: 'center' }}>{spot.band}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>{spot.mode}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--dim)' }}>{spot.time_utc}</span>
    </div>
  )
}

export default function Spots({ spots, needsMatrix }) {
  const [filterBand, setFilterBand] = useState('')
  const [filterMode, setFilterMode] = useState('')
  const hasNeeds = !!needsMatrix && Object.keys(needsMatrix).length > 0

  // Client-side filtering - instant, no refetch needed
  const filtered = spots.filter(s => {
    if (filterBand && s.band !== filterBand) return false
    if (filterMode && s.mode?.toUpperCase() !== filterMode.toUpperCase()) return false
    return true
  })

  const selectStyle = {
    fontFamily: 'var(--font-mono)', fontSize: 13,
    background: 'var(--bg1)', border: '1px solid var(--border)',
    color: 'var(--text)', padding: '6px 10px', borderRadius: 6,
    cursor: 'pointer', outline: 'none'
  }

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filterBand} onChange={e => setFilterBand(e.target.value)} style={selectStyle}>
          {BANDS.map(b => <option key={b} value={b}>{b || 'all bands'}</option>)}
        </select>
        <select value={filterMode} onChange={e => setFilterMode(e.target.value)} style={selectStyle}>
          {MODES.map(m => <option key={m} value={m}>{m || 'all modes'}</option>)}
        </select>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>
          {filtered.length} spot{filtered.length !== 1 ? 's' : ''}
          {(filterBand || filterMode) && <span style={{ color: 'var(--yellow)' }}> (filtered)</span>}
        </span>
        {hasNeeds && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--teal)', background: '#7affb215', padding: '3px 10px', borderRadius: 3 }}>
            LoTW needs active
          </span>
        )}
      </div>

      {/* Spot list */}
      <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 80px 64px 52px 56px', gap: 10, padding: '6px 14px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
          {['', 'callsign', 'freq', 'band', 'mode', 'utc'].map(h => (
            <span key={h} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--dim)', letterSpacing: 2, textTransform: 'uppercase' }}>{h}</span>
          ))}
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: 36, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--dim)' }}>
            {spots.length === 0 ? 'no spots yet - cluster connecting...' : 'no spots match current filter'}
          </div>
        ) : (
          filtered.slice(0, 100).map((s, i) => (
            <SpotRow key={`${s.callsign}-${s.freq}-${i}`} spot={s}
              needed={hasNeeds && !!needsMatrix && !needsMatrix[s.dxcc]?.[s.band]?.[s.mode]} />
          ))
        )}
      </div>
    </div>
  )
}
