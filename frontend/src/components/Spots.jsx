import { useState, useMemo } from 'react'

const BANDS = ['', '160m', '80m', '40m', '30m', '20m', '17m', '15m', '12m', '10m', '6m']
const MODES = ['', 'FT8', 'FT4', 'SSB', 'CW', 'RTTY']
const CONT_FLAG = { EU: '🌍', AS: '🌏', OC: '🌏', AF: '🌍', SA: '🌎', NA: '🌎' }

const BAND_ORDER = ['160m','80m','40m','30m','20m','17m','15m','12m','10m','6m']

function SortHeader({ label, field, sort, onSort, style }) {
  const active = sort.field === field
  const icon = !active ? '⇅' : sort.dir === 'asc' ? '↑' : '↓'
  return (
    <span onClick={() => onSort(field)} style={{
      fontFamily: 'var(--font-mono)', fontSize: 10, color: active ? 'var(--teal)' : 'var(--dim)',
      letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer',
      userSelect: 'none', display: 'flex', alignItems: 'center', gap: 3,
      ...style
    }}>
      {label}
      <span style={{ fontSize: 9, opacity: active ? 1 : 0.4 }}>{icon}</span>
    </span>
  )
}

function SpotRow({ spot, needed }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '28px 1fr 80px 64px 52px 56px',
      alignItems: 'center', gap: 10, padding: '8px 14px',
      borderBottom: '1px solid var(--border)',
      background: needed ? '#7affb208' : 'transparent',
      borderLeft: needed ? '3px solid var(--teal)' : '3px solid transparent',
      animation: 'fadeIn 0.2s ease both'
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
  const [sort, setSort] = useState({ field: 'time_utc', dir: 'desc' })
  const hasNeeds = !!needsMatrix && Object.keys(needsMatrix).length > 0

  const handleSort = (field) => {
    setSort(prev => ({
      field,
      dir: prev.field === field && prev.dir === 'asc' ? 'desc' : 'asc'
    }))
  }

  const filtered = useMemo(() => {
    let result = spots.filter(s => {
      if (filterBand && s.band !== filterBand) return false
      if (filterMode && s.mode?.toUpperCase() !== filterMode.toUpperCase()) return false
      return true
    })

    result = [...result].sort((a, b) => {
      let av, bv
      switch (sort.field) {
        case 'callsign':
          av = a.callsign || ''; bv = b.callsign || ''
          break
        case 'freq':
          av = a.freq || 0; bv = b.freq || 0
          break
        case 'band':
          av = BAND_ORDER.indexOf(a.band); bv = BAND_ORDER.indexOf(b.band)
          if (av < 0) av = 99; if (bv < 0) bv = 99
          break
        case 'mode':
          av = a.mode || ''; bv = b.mode || ''
          break
        case 'time_utc':
          av = a.time_utc || ''; bv = b.time_utc || ''
          break
        case 'dxcc':
          av = a.dxcc || a.comment || ''; bv = b.dxcc || b.comment || ''
          break
        default:
          return 0
      }
      if (av < bv) return sort.dir === 'asc' ? -1 : 1
      if (av > bv) return sort.dir === 'asc' ?  1 : -1
      return 0
    })

    return result
  }, [spots, filterBand, filterMode, sort])

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
        {sort.field !== 'time_utc' && (
          <button onClick={() => setSort({ field: 'time_utc', dir: 'desc' })} style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, background: 'transparent',
            border: '1px solid var(--border)', color: 'var(--muted)',
            padding: '4px 10px', borderRadius: 4, cursor: 'pointer'
          }}>reset sort</button>
        )}
      </div>

      {/* Spot list */}
      <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        {/* Sortable column headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 80px 64px 52px 56px', gap: 10, padding: '8px 14px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
          <span />
          <SortHeader label="callsign" field="callsign" sort={sort} onSort={handleSort} />
          <SortHeader label="freq"     field="freq"     sort={sort} onSort={handleSort} />
          <SortHeader label="band"     field="band"     sort={sort} onSort={handleSort} />
          <SortHeader label="mode"     field="mode"     sort={sort} onSort={handleSort} />
          <SortHeader label="utc"      field="time_utc" sort={sort} onSort={handleSort} />
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
