import { useState, useEffect } from 'react'

const ALL_ZONES = [
  { label: 'UTC',      tz: 'UTC',                    abbr: 'UTC'  },
  { label: 'Los Angeles', tz: 'America/Los_Angeles', abbr: 'PDT'  },
  { label: 'Denver',   tz: 'America/Denver',          abbr: 'MDT'  },
  { label: 'Chicago',  tz: 'America/Chicago',         abbr: 'CDT'  },
  { label: 'New York', tz: 'America/New_York',        abbr: 'EDT'  },
  { label: 'London',   tz: 'Europe/London',           abbr: 'BST'  },
  { label: 'Paris',    tz: 'Europe/Paris',            abbr: 'CEST' },
  { label: 'Moscow',   tz: 'Europe/Moscow',           abbr: 'MSK'  },
  { label: 'Dubai',    tz: 'Asia/Dubai',              abbr: 'GST'  },
  { label: 'Tokyo',    tz: 'Asia/Tokyo',              abbr: 'JST'  },
  { label: 'Sydney',   tz: 'Australia/Sydney',        abbr: 'AEST' },
  { label: 'Auckland', tz: 'Pacific/Auckland',        abbr: 'NZST' },
]

const DEFAULT_ZONES = ['UTC', 'America/Los_Angeles', 'Asia/Tokyo']

function gridToLatLon(grid) {
  if (!grid || grid.length < 4) return null
  const g = grid.toUpperCase()
  const lon = (g.charCodeAt(0) - 65) * 20 - 180 + (parseInt(g[2]) * 2) + 1
  const lat = (g.charCodeAt(1) - 65) * 10 - 90  + (parseInt(g[3]) * 1) + 0.5
  return { lat, lon }
}

function getSunTimes(lat, lon) {
  const now = new Date()
  const J = 2440588 + now.getTime() / 86400000
  const n = Math.floor(J - 2451545.0009 - lon / 360 + 0.5)
  const Jstar = n + 0.0009 - lon / 360
  const M = (357.5291 + 0.98560028 * Jstar) % 360
  const C = 1.9148 * Math.sin(M * Math.PI/180) + 0.02 * Math.sin(2*M*Math.PI/180)
  const lam = (M + C + 180 + 102.9372) % 360
  const Jtransit = 2451545 + Jstar + 0.0053 * Math.sin(M*Math.PI/180) - 0.0069 * Math.sin(2*lam*Math.PI/180)
  const sinDec = Math.sin(lam*Math.PI/180) * Math.sin(23.45*Math.PI/180)
  const cosH = (Math.sin(-0.83*Math.PI/180) - Math.sin(lat*Math.PI/180)*sinDec) / (Math.cos(lat*Math.PI/180)*Math.cos(Math.asin(sinDec)))
  if (Math.abs(cosH) > 1) return null
  const H = Math.acos(cosH) * 180/Math.PI
  const Jrise = Jtransit - H/360
  const Jset  = Jtransit + H/360
  const toUTC = j => {
    const d = new Date((j - 2440588) * 86400000)
    return d.toISOString().slice(11,16) + 'Z'
  }
  return { rise: toUTC(Jrise), set: toUTC(Jset) }
}

function isGrayLine(lat, lon) {
  const now = new Date()
  const times = getSunTimes(lat, lon)
  if (!times) return false
  const utcMins = now.getUTCHours() * 60 + now.getUTCMinutes()
  const parse = s => parseInt(s.slice(0,2))*60 + parseInt(s.slice(3,5))
  const rise = parse(times.rise)
  const set  = parse(times.set)
  const WINDOW = 30
  return Math.abs(utcMins - rise) < WINDOW || Math.abs(utcMins - set) < WINDOW
}

function formatTime(tz) {
  return new Date().toLocaleTimeString('en-US', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  })
}

function getAbbr(tz) {
  const s = new Date().toLocaleTimeString('en-US', { timeZone: tz, timeZoneName: 'short' })
  return s.split(' ').pop()
}

export default function Clock({ grid }) {
  const [time, setTime] = useState(new Date())
  const [zones, setZones] = useState(() => {
    const saved = localStorage.getItem('dxedge_clock_zones')
    return saved ? JSON.parse(saved) : DEFAULT_ZONES
  })
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const toggleZone = (tz) => {
    const next = zones.includes(tz)
      ? zones.filter(z => z !== tz)
      : zones.length < 6 ? [...zones, tz] : zones
    setZones(next)
    localStorage.setItem('dxedge_clock_zones', JSON.stringify(next))
  }

  const pos = gridToLatLon(grid)
  const sunTimes = pos ? getSunTimes(pos.lat, pos.lon) : null
  const grayLine = pos ? isGrayLine(pos.lat, pos.lon) : false

  const activeZones = ALL_ZONES.filter(z => zones.includes(z.tz))

  return (
    <div style={{ marginBottom: 18 }}>
      {/* Clock row */}
      <div style={{
        background: 'var(--bg1)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 0,
        flexWrap: 'wrap', position: 'relative'
      }}>
        {activeZones.map((z, i) => {
          const isUtc = z.tz === 'UTC'
          const t = formatTime(z.tz)
          const abbr = getAbbr(z.tz)
          return (
            <div key={z.tz} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '4px 16px',
              borderRight: i < activeZones.length - 1 ? '1px solid var(--border)' : 'none',
              minWidth: 100
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: isUtc ? 'var(--teal)' : 'var(--muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 }}>
                {abbr || z.abbr}
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: isUtc ? 22 : 16,
                fontWeight: 700,
                color: isUtc ? 'var(--text)' : 'var(--muted)',
                letterSpacing: isUtc ? 1 : 0,
                lineHeight: 1
              }}>{t}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', marginTop: 2 }}>{z.label}</span>
            </div>
          )
        })}

        {/* Gray line + sun times */}
        {sunTimes && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 16px', borderRight: '1px solid var(--border)', minWidth: 90 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 }}>
              {grayLine ? '🌅 gray line' : 'sun'}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: grayLine ? 'var(--yellow)' : 'var(--dim)', fontWeight: grayLine ? 700 : 400 }}>
              ↑{sunTimes.rise}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--dim)' }}>
              ↓{sunTimes.set}
            </span>
          </div>
        )}

        {/* Edit button */}
        <div style={{ marginLeft: 'auto', paddingLeft: 12 }}>
          <button onClick={() => setEditing(v => !v)} style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            background: editing ? 'var(--bg2)' : 'transparent',
            border: '1px solid var(--border)', color: 'var(--dim)',
            padding: '4px 10px', borderRadius: 4
          }}>
            {editing ? 'done' : 'zones'}
          </button>
        </div>
      </div>

      {/* Zone picker */}
      {editing && (
        <div style={{
          background: 'var(--bg1)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '14px 16px', marginTop: 8,
          display: 'flex', flexWrap: 'wrap', gap: 8
        }}>
          <div style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>
            select up to 6 time zones
          </div>
          {ALL_ZONES.map(z => {
            const active = zones.includes(z.tz)
            return (
              <button key={z.tz} onClick={() => toggleZone(z.tz)} style={{
                fontFamily: 'var(--font-mono)', fontSize: 11,
                background: active ? '#7affb220' : 'var(--bg2)',
                border: `1px solid ${active ? 'var(--teal)' : 'var(--border)'}`,
                color: active ? 'var(--teal)' : 'var(--muted)',
                padding: '5px 12px', borderRadius: 5
              }}>
                {z.label} <span style={{ color: 'var(--dim)', fontSize: 9 }}>({z.abbr})</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
