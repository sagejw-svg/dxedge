/* ------------------------------------------------------------------ *
 * Stats
 * Aggregate usage for DXEdge. Answers the questions worth asking about
 * this site: which tabs anyone actually opens, which games get played
 * and finished, what people reach in them, and whether the phone layout
 * is carrying real traffic.
 *
 * Everything here is a count. There are no per-visitor rows to show,
 * because the backend never stores any: no IP addresses, no cookies, no
 * cross-day identity. See backend/usage.py for what is kept and why.
 * ------------------------------------------------------------------ */
import { useState, useEffect } from 'react'

const mono  = { fontFamily: 'var(--font-mono)' }
const label = { ...mono, fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase' }
const card  = { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 8, padding: 14 }

const WINDOWS = [
  { d: 1,   l: 'Today' },
  { d: 7,   l: '7 days' },
  { d: 30,  l: '30 days' },
  { d: 90,  l: '90 days' },
  { d: 365, l: 'Year' },
]

function Num({ n, unit }) {
  const v = n == null ? '-' : (typeof n === 'number' ? Math.round(n).toLocaleString() : n)
  return <span>{v}{unit && n != null ? <span style={{ fontSize: 11, color: 'var(--dim)' }}> {unit}</span> : null}</span>
}

function Stat({ title, value, unit, hint }) {
  return (
    <div style={card}>
      <div style={{ ...label, marginBottom: 6 }}>{title}</div>
      <div style={{ ...mono, fontSize: 26, fontWeight: 700, color: 'var(--green)' }}>
        <Num n={value} unit={unit} />
      </div>
      {hint && <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

/* A bar list. Deliberately not a charting library: these are all "name and
 * a number, sorted", and a div with a width is less code than a dependency. */
function Bars({ title, rows, nameKey, valueKey, empty, fmt }) {
  const max = rows.length ? Math.max(...rows.map(r => Number(r[valueKey]) || 0)) : 0
  return (
    <div style={{ ...card, minWidth: 0 }}>
      <div style={{ ...label, marginBottom: 10 }}>{title}</div>
      {!rows.length && <div style={{ fontSize: 11, color: 'var(--dim)' }}>{empty || 'nothing yet'}</div>}
      {rows.map((r, i) => {
        const v = Number(r[valueKey]) || 0
        const pct = max > 0 ? Math.max(2, (v / max) * 100) : 0
        return (
          <div key={i} style={{ marginBottom: 7 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11, marginBottom: 3 }}>
              <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r[nameKey] || '(none)'}
              </span>
              <span style={{ ...mono, color: 'var(--muted)', flexShrink: 0 }}>{fmt ? fmt(v) : v.toLocaleString()}</span>
            </div>
            <div style={{ height: 4, background: 'var(--bg2)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: pct + '%', background: 'var(--teal)', opacity: 0.75 }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* Daily visitors, drawn as an inline SVG sparkline. */
function Trend({ daily }) {
  if (!daily || daily.length < 2) return null
  const w = 100, h = 28
  const max = Math.max(...daily.map(d => d.visitors), 1)
  const pts = daily.map((d, i) => {
    const x = (i / (daily.length - 1)) * w
    const y = h - (d.visitors / max) * (h - 2) - 1
    return `${x.toFixed(2)},${y.toFixed(2)}`
  }).join(' ')
  return (
    <div style={card}>
      <div style={{ ...label, marginBottom: 8 }}>visitors per day</div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: 56, display: 'block' }}>
        <polyline points={pts} fill="none" stroke="var(--green)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--dim)', marginTop: 4 }}>
        <span>{daily[0].day}</span>
        <span>peak {max}</span>
        <span>{daily[daily.length - 1].day}</span>
      </div>
    </div>
  )
}

export default function Stats() {
  const [days, setDays]   = useState(30)
  const [data, setData]   = useState(null)
  const [err, setErr]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [optOut, setOptOut]   = useState(() => {
    try { return localStorage.getItem('dxedge_stats_opt_out') === '1' } catch (e) { return false }
  })

  useEffect(() => {
    let live = true
    setLoading(true); setErr(null)
    fetch(`/api/stats/summary?days=${days}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => { if (live) { setData(d); setLoading(false) } })
      .catch(e => { if (live) { setErr(String(e.message || e)); setLoading(false) } })
    return () => { live = false }
  }, [days])

  const t = data?.totals || {}
  const today = data?.today || {}
  const dwell = data?.dwell || {}
  const mobileSessions = (data?.devices || []).filter(d => d.mobile).reduce((a, d) => a + d.sessions, 0)
  const allSessions    = (data?.devices || []).reduce((a, d) => a + d.sessions, 0)
  const mobilePct = allSessions ? Math.round((mobileSessions / allSessions) * 100) : null

  // chrome-on-a-phone and chrome-on-a-desktop arrive as separate rows; show
  // them as separate, labelled rows rather than two lines both saying "chrome".
  const devices = (data?.devices || []).map(d => ({
    ...d, name: d.ua + (d.mobile ? ' (phone)' : ''),
  }))

  const games = (data?.games || []).map(g => ({
    ...g,
    completion: g.plays ? Math.round((g.finished / g.plays) * 100) : 0,
  }))

  function toggleOptOut() {
    const next = !optOut
    setOptOut(next)
    try { next ? window.dxstat?.optOut() : window.dxstat?.optIn() } catch (e) {}
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ ...label, marginBottom: 8 }}>usage</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, maxWidth: 680 }}>
          Counts only. No cookies, no IP addresses stored, no identity that survives a day
          or a closed tab. Do Not Track and Global Privacy Control are honoured before
          anything is written. Raw events are kept {90} days, then rolled into daily totals.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {WINDOWS.map(w => (
          <button key={w.d} onClick={() => setDays(w.d)} style={{
            ...mono, fontSize: 11, padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
            background: days === w.d ? 'var(--bg2)' : 'var(--bg1)',
            border: '1px solid ' + (days === w.d ? 'var(--green)' : 'var(--border)'),
            color: days === w.d ? 'var(--green)' : 'var(--muted)',
          }}>{w.l}</button>
        ))}
      </div>

      {loading && <div style={{ ...mono, fontSize: 12, color: 'var(--dim)', padding: '30px 0' }}>loading...</div>}
      {err && <div style={{ ...card, borderColor: '#ff6b6b44', color: 'var(--red, #ff6b6b)', fontSize: 12 }}>
        Stats unavailable: {err}
      </div>}

      {data && !loading && (
        <>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: 12 }}>
            <Stat title="visitors" value={t.visitors} hint={`${today.visitors ?? 0} today`} />
            <Stat title="sessions" value={t.sessions} hint={`${today.sessions ?? 0} today`} />
            <Stat title="avg session" value={dwell.avg_secs != null ? Math.round(dwell.avg_secs / 60) : null} unit="min"
                  hint={dwell.max_secs ? `longest ${Math.round(dwell.max_secs / 60)} min` : null} />
            <Stat title="on phones" value={mobilePct} unit="%" hint={`${mobileSessions} of ${allSessions} sessions`} />
          </div>

          <div style={{ marginBottom: 12 }}><Trend daily={data.daily} /></div>

          <div style={{ display: 'grid', gap: 10, alignItems: 'start',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
            <Bars title="tabs opened" rows={data.tabs} nameKey="tab" valueKey="sessions"
                  empty="no tab opens recorded" />
            <Bars title="games played" rows={games} nameKey="game" valueKey="plays"
                  empty="nobody has started a game" />
            <Bars title="finished %" rows={games.filter(g => g.plays)} nameKey="game" valueKey="completion"
                  fmt={v => v + '%'} empty="no completed games" />
            <Bars title="milestones reached" rows={data.milestones} nameKey="detail" valueKey="hits"
                  empty="none reached" />
            <Bars title="emulators opened" rows={data.emulators} nameKey="slug" valueKey="opens"
                  empty="no emulator opens" />
            <Bars title="referrers" rows={data.referrers} nameKey="host" valueKey="sessions"
                  empty="all direct" />
            <Bars title="entry pages" rows={data.entries} nameKey="path" valueKey="sessions"
                  empty="none" />
            <Bars title="browsers" rows={devices} nameKey="name" valueKey="sessions" empty="none" />
          </div>

          {games.some(g => g.best != null) && (
            <div style={{ ...card, marginTop: 12 }}>
              <div style={{ ...label, marginBottom: 10 }}>best scores</div>
              <div style={{ display: 'grid', gap: 6 }}>
                {games.filter(g => g.best != null).map(g => (
                  <div key={g.game} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ color: 'var(--text)' }}>{g.game}</span>
                    <span style={{ ...mono, color: 'var(--muted)' }}>
                      best {Math.round(g.best)} · avg {g.avg_score != null ? Math.round(g.avg_score) : '-'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ ...card, marginTop: 12, display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              This browser is currently {optOut ? 'excluded from' : 'included in'} the numbers above.
            </div>
            <button onClick={toggleOptOut} style={{
              ...mono, fontSize: 11, padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
              background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--muted)',
            }}>{optOut ? 'Include this browser' : 'Exclude this browser'}</button>
          </div>
        </>
      )}
    </div>
  )
}
