import { useState, useEffect, useRef, memo} from 'react'

const CLOCK_CONFIGS = [
  { id: 'utc',     label: 'UTC',     tz: 'UTC',                   fixed: true  },
  { id: 'eastern', label: 'Eastern', tz: 'America/New_York',      fixed: true  },
  { id: 'central', label: 'Central', tz: 'America/Chicago',       fixed: true  },
  { id: 'pacific', label: 'Pacific', tz: 'America/Los_Angeles',   fixed: true  },
  { id: 'japan',   label: 'Japan',   tz: 'Asia/Tokyo',            fixed: true  },
  { id: 'custom',  label: 'Custom',  tz: null,                    fixed: false },
]

const ALL_ZONES = [
  { label: 'UTC',          tz: 'UTC'                    },
  { label: 'Honolulu',     tz: 'Pacific/Honolulu'       },
  { label: 'Anchorage',    tz: 'America/Anchorage'      },
  { label: 'Los Angeles',  tz: 'America/Los_Angeles'    },
  { label: 'Denver',       tz: 'America/Denver'         },
  { label: 'Chicago',      tz: 'America/Chicago'        },
  { label: 'New York',     tz: 'America/New_York'       },
  { label: 'London',       tz: 'Europe/London'          },
  { label: 'Paris',        tz: 'Europe/Paris'           },
  { label: 'Moscow',       tz: 'Europe/Moscow'          },
  { label: 'Dubai',        tz: 'Asia/Dubai'             },
  { label: 'Karachi',      tz: 'Asia/Karachi'           },
  { label: 'Delhi',        tz: 'Asia/Kolkata'           },
  { label: 'Bangkok',      tz: 'Asia/Bangkok'           },
  { label: 'Beijing',      tz: 'Asia/Shanghai'          },
  { label: 'Tokyo',        tz: 'Asia/Tokyo'             },
  { label: 'Sydney',       tz: 'Australia/Sydney'       },
  { label: 'Auckland',     tz: 'Pacific/Auckland'       },
]

function getTimeInZone(tz) {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now)
  const p = {}
  parts.forEach(({ type, value }) => { p[type] = value })
  return {
    hours:   parseInt(p.hour),
    minutes: parseInt(p.minute),
    seconds: parseInt(p.second),
    dateStr: `${p.month}/${p.day}`,
    abbr:    new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' })
               .formatToParts(now).find(x => x.type === 'timeZoneName')?.value || tz }
}

function AnalogClock({ label, tz, isUtc, customTz, onCustomChange }) {
  const activeTz = tz || customTz || 'UTC'
  const t = getTimeInZone(activeTz)

  const SIZE = 88
  const CX = SIZE / 2
  const CY = SIZE / 2
  const R = SIZE / 2 - 4

  // Angles
  const secAngle  = t.seconds * 6 - 90
  const minAngle  = (t.minutes + t.seconds / 60) * 6 - 90
  const hourAngle = ((t.hours % 12) + t.minutes / 60) * 30 - 90

  const hand = (angle, length, width, color) => {
    const rad = angle * Math.PI / 180
    return {
      x2: CX + Math.cos(rad) * length,
      y2: CY + Math.sin(rad) * length,
      style: { stroke: color, strokeWidth: width, strokeLinecap: 'round' }
    }
  }

  const secH  = hand(secAngle,  R * 0.85, 1,   '#ff4d4d')
  const minH  = hand(minAngle,  R * 0.75, 1.8, '#e0e0e0')
  const hourH = hand(hourAngle, R * 0.55, 2.5, '#ffffff')

  // Tick marks
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const a = (i * 6 - 90) * Math.PI / 180
    const isHour = i % 5 === 0
    const inner = R * (isHour ? 0.82 : 0.90)
    const outer = R * 0.97
    return {
      x1: CX + Math.cos(a) * inner, y1: CY + Math.sin(a) * inner,
      x2: CX + Math.cos(a) * outer, y2: CY + Math.sin(a) * outer,
      isHour
    }
  })

  // Hour numbers at 12, 3, 6, 9
  const numbers = [12, 3, 6, 9].map(n => {
    const a = (n * 30 - 90) * Math.PI / 180
    return { n, x: CX + Math.cos(a) * R * 0.68, y: CY + Math.sin(a) * R * 0.68 + 1 }
  })

  const timeStr = `${String(t.hours).padStart(2,'0')}:${String(t.minutes).padStart(2,'0')}:${String(t.seconds).padStart(2,'0')}`
  const isUtcClock = activeTz === 'UTC' || isUtc

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      minWidth: 100, userSelect: 'none'
    }}>
      {/* Clock face */}
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {/* Face */}
        <circle cx={CX} cy={CY} r={R}
          fill="#0a0a0a"
          stroke={isUtcClock ? 'var(--teal)' : '#333'}
          strokeWidth={isUtcClock ? 1.5 : 1} />

        {/* Ticks */}
        {ticks.map((t, i) => (
          <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            stroke={t.isHour ? '#555' : '#2a2a2a'} strokeWidth={t.isHour ? 1.2 : 0.6} />
        ))}

        {/* Numbers */}
        {numbers.map(({ n, x, y }) => (
          <text key={n} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
            fill={isUtcClock ? '#7affb2' : '#555'}
            fontSize="7" fontFamily="var(--font-mono)" fontWeight="600">
            {n}
          </text>
        ))}

        {/* Hands */}
        <line x1={CX} y1={CY} x2={hourH.x2} y2={hourH.y2} {...hourH.style} />
        <line x1={CX} y1={CY} x2={minH.x2}  y2={minH.y2}  {...minH.style}  />
        <line x1={CX} y1={CY} x2={secH.x2}  y2={secH.y2}  {...secH.style}  />

        {/* Counter-weight for second hand */}
        {(() => {
          const a = (secAngle + 180) * Math.PI / 180
          return <line x1={CX} y1={CY} x2={CX + Math.cos(a)*R*0.2} y2={CY + Math.sin(a)*R*0.2}
            stroke="#ff4d4d" strokeWidth={2} strokeLinecap="round" />
        })()}

        {/* Center dot */}
        <circle cx={CX} cy={CY} r={2.5} fill="#ff4d4d" />
        <circle cx={CX} cy={CY} r={1}   fill="#fff" />

        {/* Digital time inside - bottom of face */}
        <text x={CX} y={CY + R * 0.42}
          textAnchor="middle" dominantBaseline="middle"
          fill={isUtcClock ? 'var(--teal)' : '#666'}
          fontSize="8.5" fontFamily="var(--font-mono)" fontWeight="700"
          letterSpacing="0.5">
          {timeStr}
        </text>
      </svg>

      {/* Label and date */}
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
        color: isUtcClock ? 'var(--teal)' : '#888',
        marginTop: 4, letterSpacing: 1 }}>
        {label !== 'Custom' ? label : (customTz
          ? ALL_ZONES.find(z => z.tz === customTz)?.label || 'Custom'
          : 'Custom')}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9,
        color: '#444', marginTop: 1 }}>
        {t.abbr} · {t.dateStr}
      </div>

      {/* Custom timezone dropdown */}
      {!tz && (
        <select value={customTz || 'UTC'} onChange={e => onCustomChange(e.target.value)}
          style={{
            marginTop: 5, fontFamily: 'var(--font-mono)', fontSize: 9,
            background: 'var(--bg2)', border: '1px solid var(--border)',
            color: '#888', padding: '2px 4px', borderRadius: 4,
            width: 96, outline: 'none', cursor: 'pointer'
          }}>
          {ALL_ZONES.map(z => (
            <option key={z.tz} value={z.tz}>{z.label}</option>
          ))}
        </select>
      )}
    </div>
  )
}

const Clocks = memo(function Clocks() {
  const [, forceUpdate] = useState(0)
  const [customTz, setCustomTz] = useState(
    () => localStorage.getItem('dxedge_custom_tz') || 'Europe/London'
  )

  // Tick every second
  useEffect(() => {
    const t = setInterval(() => forceUpdate(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const handleCustom = (tz) => {
    setCustomTz(tz)
    localStorage.setItem('dxedge_custom_tz', tz)
  }

  return (
    <div style={{
      background: 'var(--bg1)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '14px 16px', marginBottom: 16,
      overflowX: 'auto', WebkitOverflowScrolling: 'touch'
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)',
        letterSpacing: 3, textTransform: 'uppercase', marginBottom: 14 }}>
        world clocks
      </div>
      <div style={{
        display: 'flex', gap: 16, justifyContent: 'space-between',
        minWidth: 620
      }}>
        {CLOCK_CONFIGS.map(cfg => (
          <AnalogClock key={cfg.id}
            label={cfg.label}
            tz={cfg.tz}
            isUtc={cfg.id === 'utc'}
            customTz={!cfg.fixed ? customTz : null}
            onCustomChange={handleCustom}
          />
        ))}
      </div>
    </div>
  )
}

export default Clocks
