const BANDS = ['', '160m', '80m', '40m', '30m', '20m', '17m', '15m', '12m', '10m', '6m']
const MODES = ['', 'FT8', 'FT4', 'SSB', 'CW', 'RTTY']
const CONT_FLAG = { EU: '🌍', AS: '🌏', OC: '🌏', AF: '🌍', SA: '🌎', NA: '🌎' }

function SpotRow({ spot, needed }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '26px 1fr 70px 60px 46px 50px',
      alignItems: 'center', gap: 8, padding: '6px 12px',
      borderBottom: '1px solid var(--border)',
      background: needed ? '#7affb208' : 'transparent',
      borderLeft: needed ? '2px solid var(--teal)' : '2px solid transparent',
      animation: 'fadeIn 0.3s ease both'
    }}>
      <span style={{ fontSize: 14 }}>{CONT_FLAG[spot.continent] || '📡'}</span>
      <div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: needed ? 'var(--teal)' : 'var(--text)' }}>
          {spot.callsign}
        </span>
        {needed && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--teal)', marginLeft: 6, background: '#7affb220', padding: '1px 5px', borderRadius: 3 }}>NEED</span>}
        <div style={{ fontSize: 10, color: 'var(--muted)', fontStyle: 'italic', marginTop: 1 }}>{spot.comment || spot.dxcc || ''}</div>
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--teal)' }}>{spot.freq} kHz</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--yellow)', background: '#ffd60015', padding: '1px 5px', borderRadius: 3, textAlign: 'center' }}>{spot.band}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', textAlign: 'center' }}>{spot.mode}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)' }}>{spot.time_utc}</span>
    </div>
  )
}

export default function Spots({ spots, filter, onFilter, needsMatrix }) {
  const hasNeeds = !!needsMatrix && Object.keys(needsMatrix).length > 0

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filter.band} onChange={e => onFilter({ ...filter, band: e.target.value })}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--bg1)', border: '1px solid var(--border)', color: 'var(--text)', padding: '5px 8px', borderRadius: 5 }}>
          {BANDS.map(b => <option key={b} value={b}>{b || 'all bands'}</option>)}
        </select>
        <select value={filter.mode} onChange={e => onFilter({ ...filter, mode: e.target.value })}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--bg1)', border: '1px solid var(--border)', color: 'var(--text)', padding: '5px 8px', borderRadius: 5 }}>
          {MODES.map(m => <option key={m} value={m}>{m || 'all modes'}</option>)}
        </select>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)' }}>
          {spots.length} spots{hasNeeds ? ' (needs filtered)' : ''}
        </span>
        {hasNeeds && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--teal)', background: '#7affb215', padding: '2px 8px', borderRadius: 3 }}>
            LoTW needs active
          </span>
        )}
      </div>

      {/* Spot list */}
      <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        {/* Column headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '26px 1fr 70px 60px 46px 50px', gap: 8, padding: '5px 12px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
          {['', 'callsign', 'freq', 'band', 'mode', 'utc'].map(h => (
            <span key={h} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 2, textTransform: 'uppercase' }}>{h}</span>
          ))}
        </div>

        {spots.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--dim)' }}>
            no spots yet - cluster connecting...
          </div>
        ) : (
          spots.slice(0, 100).map((s, i) => (
            <SpotRow key={`${s.callsign}-${s.freq}-${i}`} spot={s}
              needed={hasNeeds && needsMatrix && !needsMatrix[s.dxcc]?.[s.band]?.[s.mode]} />
          ))
        )}
      </div>
    </div>
  )
}
