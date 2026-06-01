import { useState, useEffect, memo} from 'react'
import { api } from '../api'

const TIER_LABEL = { 1: 'Major', 2: 'Regional', 3: 'Weekly' }
const TIER_COLOR = { 1: '#00ff9d', 2: '#ffd600', 3: '#7a9fff' }

const MODE_ICONS = {
  CW: '—·—',  SSB: '🎙', FT8: 'FT8', FT4: 'FT4',
  RTTY: 'TTY', 'CW/SSB': '—·— 🎙', Various: '★', All: '★' }

function ContestCard({ contest }) {
  const color = contest.is_active
    ? '#00ff9d'
    : contest.is_upcoming
    ? '#ffd600'
    : TIER_COLOR[contest.tier] || '#555'

  const statusLabel = contest.is_active
    ? '🟢 ON AIR NOW'
    : contest.days_away === 0
    ? '⏰ TODAY'
    : contest.days_away === 1
    ? '⏰ TOMORROW'
    : contest.days_away <= 7
    ? `⏰ in ${contest.days_away} day${contest.days_away !== 1 ? 's' : ''}`
    : contest.days_away <= 14
    ? `⏰ next week`
    : `⏰ in ${Math.ceil(contest.days_away / 7)} weeks`
    : ''

  return (
    <div style={{
      background: 'var(--bg1)',
      border: `1px solid ${contest.is_active ? '#00ff9d44' : contest.is_upcoming ? '#ffd60033' : 'var(--border)'}`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 8, padding: '10px 14px',
      display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: contest.is_active ? 'var(--green)' : 'var(--text)' }}>
            {contest.name}
          </span>
          {contest.sponsor && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', marginLeft: 8 }}>
              {contest.sponsor}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          {statusLabel && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color }}>
              {statusLabel}
            </span>
          )}
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9,
            color: TIER_COLOR[contest.tier],
            background: `${TIER_COLOR[contest.tier]}15`,
            border: `1px solid ${TIER_COLOR[contest.tier]}33`,
            padding: '1px 6px', borderRadius: 3
          }}>
            {TIER_LABEL[contest.tier]}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
          📅 {contest.date_str}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
          {MODE_ICONS[contest.mode] || contest.mode} {contest.mode}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
          📻 {contest.bands}
        </span>
      </div>
    </div>
  )
}

const ContestCalendar = memo(function ContestCalendar() {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('all') // 'all'|'active'|'major'|'cw'|'digital'|'ssb'

  useEffect(() => {
    setLoading(true)
    api.get('/contests')
      .then(r => setData(r.contests || []))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = (data || []).filter(c => {
    if (filter === 'active') return c.is_active || c.is_upcoming
    if (filter === 'major')   return c.tier === 1
    if (filter === 'cw')      return c.mode.includes('CW')
    if (filter === 'digital') return ['FT8','FT4','RTTY','PSK31'].some(m => c.mode.includes(m))
    if (filter === 'ssb')     return c.mode.includes('SSB') || c.mode.includes('Phone')
    return true
  })

  const active  = (data || []).filter(c => c.is_active).length
  const upcoming = (data || []).filter(c => c.is_upcoming).length

  const btnStyle = (f) => ({
    fontFamily: 'var(--font-mono)', fontSize: 10,
    background: filter === f ? '#7affb220' : 'var(--bg1)',
    border: `1px solid ${filter === f ? 'var(--teal)' : 'var(--border)'}`,
    color: filter === f ? 'var(--teal)' : 'var(--muted)',
    padding: '5px 12px', borderRadius: 4, cursor: 'pointer'
  })

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase' }}>
            contest calendar
          </span>
          {data && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', marginLeft: 12 }}>
              {active > 0 && <span style={{ color: 'var(--green)' }}>{active} on air · </span>}
              {upcoming > 0 && <span style={{ color: 'var(--yellow)' }}>{upcoming} this week · </span>}
              {data.length} total
            </span>
          )}
        </div>
        <a href="https://www.contestcalendar.com" target="_blank" rel="noreferrer"
          style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', border: '1px solid var(--border)', padding: '3px 8px', borderRadius: 4, textDecoration: 'none' }}>
          contestcalendar.com ↗
        </a>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        <button onClick={() => setFilter('all')}     style={btnStyle('all')}>All</button>
        <button onClick={() => setFilter('active')}  style={btnStyle('active')}>
          {active > 0 ? <span style={{ color: 'var(--green)' }}>🟢 Active / Soon</span> : 'Active / Soon'}
        </button>
        <button onClick={() => setFilter('major')}   style={btnStyle('major')}>Major</button>
        <button onClick={() => setFilter('cw')}      style={btnStyle('cw')}>CW</button>
        <button onClick={() => setFilter('digital')} style={btnStyle('digital')}>Digital</button>
        <button onClick={() => setFilter('ssb')}     style={btnStyle('ssb')}>SSB</button>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', flexWrap: 'wrap' }}>
        {[
          { color: '#00ff9d', label: 'Major (CQ WW, ARRL, etc.)' },
          { color: '#ffd600', label: 'Regional' },
          { color: '#7a9fff', label: 'Weekly / Club' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 3, height: 14, background: l.color, borderRadius: 1 }} />
            <span>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Contest list */}
      {loading && (
        <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--dim)', animation: 'pulse 1.4s infinite' }}>
          fetching contest calendar...
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--dim)' }}>
          no contests match current filter
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {filtered.map((c, i) => (
          <ContestCard key={`${c.name}-${c.start}-${i}`} contest={c} />
        ))}
      </div>

      {data && (
        <p style={{ marginTop: 14, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', textAlign: 'right' }}>
          source: contestcalendar.com · cached 6h · {data.length} contests this week
        </p>
      )}
    </div>
  )
}
)

export default ContestCalendar
