import { useState } from 'react'

const TOOLS = [
  {
    id: 'openhamclock',
    label: 'OpenHamClock',
    url: 'https://openhamclock.com',
    embed: 'https://openhamclock.com',
    description: 'Full interactive ham radio dashboard - gray line, DX spots, propagation, satellites. Runs entirely in your browser.',
    icon: '🌍',
  },
  {
    id: 'pskreporter_map',
    label: 'PSKReporter Map',
    url: 'https://pskreporter.info/pskmap.html',
    embed: 'https://pskreporter.info/pskmap.html',
    description: 'Live global FT8/FT4 reception map.',
    icon: '📡',
  },
  {
    id: 'voacap',
    label: 'VOACAP Online',
    url: 'https://www.voacap.com/hf/',
    embed: null,
    description: 'Full VOACAP point-to-point prediction tool.',
    icon: '📶',
  },
  {
    id: 'dxsummit',
    label: 'DX Summit',
    url: 'https://www.dxsummit.fi',
    embed: null,
    description: 'Live DX cluster spots from worldwide sources.',
    icon: '🔭',
  },
  {
    id: 'reversebeacon',
    label: 'Reverse Beacon',
    url: 'https://www.reversebeacon.net',
    embed: null,
    description: 'CW skimmer network - who is hearing you.',
    icon: '📻',
  },
  {
    id: 'ng3k',
    label: 'DXpedition Calendar',
    url: 'https://ng3k.com/misc/adxo.html',
    embed: null,
    description: 'Upcoming DXpeditions - entities, bands, dates.',
    icon: '🗓️',
  },
  {
    id: 'qrz',
    label: 'QRZ Callsign Lookup',
    url: 'https://www.qrz.com',
    embed: null,
    description: 'Callsign database, bios, log lookup.',
    icon: '🔍',
  },
  {
    id: 'hamqth',
    label: 'HamQTH',
    url: 'https://www.hamqth.com',
    embed: null,
    description: 'Free callsign database alternative to QRZ.',
    icon: '🔍',
  },
  {
    id: 'dxmaps',
    label: 'DX Maps',
    url: 'https://www.dxmaps.com',
    embed: null,
    description: 'Real-time propagation map from cluster spots.',
    icon: '🗺️',
  },
  {
    id: 'hamspots',
    label: 'HamSpots',
    url: 'https://hamspots.net',
    embed: null,
    description: 'DX spots with DXCC entity filtering.',
    icon: '📌',
  },
]

export default function HamClock() {
  const [activeEmbed, setActiveEmbed] = useState(null)

  const handleLaunch = (tool) => {
    if (tool.embed) {
      setActiveEmbed(activeEmbed?.id === tool.id ? null : tool)
    } else {
      window.open(tool.url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 16 }}>
        ham radio tools & resources
      </div>

      {/* Tool grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, marginBottom: 20 }}>
        {TOOLS.map(tool => {
          const isActive = activeEmbed?.id === tool.id
          return (
            <div key={tool.id}
              onClick={() => handleLaunch(tool)}
              style={{
                background: isActive ? '#7affb215' : 'var(--bg1)',
                border: `1px solid ${isActive ? 'var(--teal)' : 'var(--border)'}`,
                borderRadius: 8, padding: '12px 14px',
                cursor: 'pointer', transition: 'all 0.15s',
                display: 'flex', flexDirection: 'column', gap: 6,
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = '#444' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = 'var(--border)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{tool.icon}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: isActive ? 'var(--teal)' : 'var(--text)' }}>
                    {tool.label}
                  </span>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--dim)' }}>
                  {tool.embed ? (isActive ? '▲ close' : '▼ embed') : '↗ open'}
                </span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', lineHeight: 1.5, margin: 0 }}>
                {tool.description}
              </p>
            </div>
          )
        })}
      </div>

      {/* Embed panel */}
      {activeEmbed && (
        <div style={{ background: 'var(--bg1)', border: '1px solid var(--teal)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>{activeEmbed.icon}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--teal)' }}>{activeEmbed.label}</span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <a href={activeEmbed.url} target="_blank" rel="noreferrer"
                style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--blue)', border: '1px solid var(--border)', padding: '3px 10px', borderRadius: 4, textDecoration: 'none' }}>
                open full ↗
              </a>
              <button onClick={() => setActiveEmbed(null)} style={{
                fontFamily: 'var(--font-mono)', fontSize: 10,
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--muted)', padding: '3px 10px', borderRadius: 4, cursor: 'pointer'
              }}>close ✕</button>
            </div>
          </div>
          <iframe
            src={activeEmbed.embed}
            style={{ width: '100%', height: 700, border: 'none', display: 'block' }}
            title={activeEmbed.label}
            allow="geolocation"
            loading="lazy"
          />
        </div>
      )}
    </div>
  )
}
