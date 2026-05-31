const SOURCES = [
  {
    category: 'Solar & Space Weather',
    items: [
      {
        name: 'NOAA Space Weather Prediction Center',
        url: 'https://www.swpc.noaa.gov',
        what: 'Solar flux index, K-index, A-index, sunspot number, X-ray flux',
        note: 'Primary real-time solar data source. Free public API.',
        icon: '☀️',
      },
      {
        name: 'NOAA GOES X-Ray Imager',
        url: 'https://www.swpc.noaa.gov/products/goes-x-ray-flux',
        what: 'X-ray flux for solar flare detection',
        icon: '⚡',
      },
    ],
  },
  {
    category: 'DX Cluster & Spots',
    items: [
      {
        name: 'VE7CC DX Cluster',
        url: 'http://dxc.ve7cc.net',
        what: 'Primary DX cluster telnet feed (dxc.ve7cc.net:23)',
        note: 'Live DX spots from ham operators worldwide. First fallback cluster.',
        icon: '📡',
      },
      {
        name: 'W6YX DX Cluster (Stanford University)',
        url: 'http://w6yx.stanford.edu',
        what: 'Secondary DX cluster fallback',
        icon: '📡',
      },
      {
        name: 'W3LPL DX Cluster',
        url: 'http://w3lpl.net',
        what: 'Tertiary DX cluster fallback',
        icon: '📡',
      },
    ],
  },
  {
    category: 'Digital Mode Reception',
    items: [
      {
        name: 'PSKReporter',
        url: 'https://pskreporter.info',
        what: 'FT8/FT4 and other digital mode reception reports globally',
        note: 'Used for Live RX tab and Callsign lookup. Free API at retrieve.pskreporter.info.',
        icon: '📻',
      },
    ],
  },
  {
    category: 'Logbook & DXCC',
    items: [
      {
        name: 'Logbook of the World (LoTW)',
        url: 'https://lotw.arrl.org',
        what: 'Confirmed QSO verification and DXCC needs matrix',
        note: 'Operated by the ARRL. Credentials used once server-side, never stored.',
        icon: '📒',
      },
      {
        name: 'ARRL DXCC Program',
        url: 'https://www.arrl.org/dxcc',
        what: 'DXCC entity list and prefix data (340+ entities)',
        note: 'Entity names, continents, CQ/ITU zones used for spot enrichment.',
        icon: '🌍',
      },
    ],
  },
  {
    category: 'Activations',
    items: [
      {
        name: 'Parks on the Air (POTA)',
        url: 'https://pota.app',
        what: 'Live POTA activator spots',
        note: 'Free public API at api.pota.app. Updated in real time.',
        icon: '🌲',
      },
      {
        name: 'Summits on the Air (SOTA)',
        url: 'https://www.sota.org.uk',
        what: 'Live SOTA summit activator spots',
        note: 'Free public API at api2.sota.org.uk.',
        icon: '⛰️',
      },
    ],
  },
  {
    category: 'Contest Calendar',
    items: [
      {
        name: 'Contest Calendar (WA7BNF)',
        url: 'https://www.contestcalendar.com',
        what: 'Weekly ham radio contest schedule',
        note: 'The most comprehensive publicly available contest calendar. Cached 6 hours.',
        icon: '🏆',
      },
    ],
  },
  {
    category: 'Satellite Tracking',
    items: [
      {
        name: 'SatNOGS Database',
        url: 'https://db.satnogs.org',
        what: 'Ham satellite TLE data (Two-Line Elements) backed by Space-Track.org',
        note: 'Free public API. TLE data cached 6 hours. Powers the Satellites tab pass predictions.',
        icon: '🛰️',
      },
    ],
  },
  {
    category: 'Propagation Tools',
    items: [
      {
        name: 'OpenHamClock',
        url: 'https://openhamclock.com',
        what: 'Full-featured browser-based ham radio dashboard (Tools tab embed)',
        note: 'Free, browser-based. Each user runs their own instance - zero server cost.',
        icon: '🕐',
      },
      {
        name: 'VOACAP / NTIA ITS',
        url: 'https://www.voacap.com',
        what: 'Propagation prediction methodology and ionospheric models',
        note: 'DXEdge implements a self-contained propagation engine inspired by VOACAP principles. We do NOT call voacap.com servers directly.',
        icon: '📶',
      },
    ],
  },
  {
    category: 'Infrastructure',
    items: [
      {
        name: "Let's Encrypt / ISRG",
        url: 'https://letsencrypt.org',
        what: 'Free SSL/TLS certificate authority',
        note: 'Auto-renewing HTTPS certificate for dxedge.net.',
        icon: '🔒',
      },
      {
        name: 'DigitalOcean',
        url: 'https://www.digitalocean.com',
        what: 'Cloud hosting (Ubuntu 24.04 droplet, San Francisco)',
        icon: '🌊',
      },
      {
        name: 'ntfy.sh',
        url: 'https://ntfy.sh',
        what: 'Free push notification delivery for band opening alerts',
        note: 'Open source notification service. No account required to receive alerts.',
        icon: '🔔',
      },
    ],
  },
  {
    category: 'Open Source Libraries',
    items: [
      {
        name: 'FastAPI',
        url: 'https://fastapi.tiangolo.com',
        what: 'Python web framework powering the DXEdge backend',
        icon: '⚡',
      },
      {
        name: 'React',
        url: 'https://react.dev',
        what: 'Frontend UI framework',
        icon: '⚛️',
      },
      {
        name: 'Recharts',
        url: 'https://recharts.org',
        what: 'Chart library used for solar history graphs',
        icon: '📊',
      },
      {
        name: 'Vite',
        url: 'https://vitejs.dev',
        what: 'Frontend build tool',
        icon: '⚡',
      },
      {
        name: 'nginx',
        url: 'https://nginx.org',
        what: 'Web server and reverse proxy',
        icon: '🔧',
      },
      {
        name: 'Docker',
        url: 'https://www.docker.com',
        what: 'Container runtime for deployment',
        icon: '🐳',
      },
      {
        name: 'SQLite',
        url: 'https://www.sqlite.org',
        what: 'Embedded database for spot and solar persistence',
        icon: '💾',
      },
    ],
  },
  {
    category: 'Reference & Inspiration',
    items: [
      {
        name: 'HamTab',
        url: 'https://www.hamtab.net',
        what: 'Modern web-based ham radio dashboard - feature inspiration',
        icon: '🎛️',
      },
      {
        name: 'OpenHamClock Project',
        url: 'https://github.com/openhamclock/hamclock',
        what: 'Open source continuation of HamClock by WB0OEW (SK)',
        icon: '🕐',
      },
      {
        name: 'HamDashboard (VA3HDL)',
        url: 'https://github.com/VA3HDL/hamdashboard',
        what: 'Customizable ham radio dashboard - layout inspiration',
        icon: '📋',
      },
      {
        name: 'ARRL',
        url: 'https://www.arrl.org',
        what: 'American Radio Relay League - DXCC program and LoTW',
        icon: '📻',
      },
    ],
  },
]

export default function Credits() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 }}>
          data sources & acknowledgements
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, maxWidth: 680 }}>
          DXEdge is built on the generous work of individuals, organizations, and open source projects in the amateur radio community. None of this works without them. Links go directly to each source. If you find DXEdge useful, consider supporting these projects.
        </p>
      </div>

      {SOURCES.map(section => (
        <div key={section.category} style={{ marginBottom: 24 }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)',
            letterSpacing: 3, textTransform: 'uppercase',
            borderBottom: '1px solid var(--border)', paddingBottom: 6, marginBottom: 10
          }}>
            {section.category}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {section.items.map(item => (
              <a key={item.name} href={item.url} target="_blank" rel="noreferrer"
                style={{ textDecoration: 'none' }}>
                <div style={{
                  background: 'var(--bg1)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '12px 16px',
                  display: 'flex', gap: 14, alignItems: 'flex-start',
                  transition: 'border-color 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#333'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--blue)' }}>
                        {item.name} ↗
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 3 }}>
                      {item.what}
                    </div>
                    {item.note && (
                      <div style={{ fontSize: 11, color: 'var(--dim)', fontStyle: 'italic', marginTop: 4, lineHeight: 1.5 }}>
                        {item.note}
                      </div>
                    )}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      ))}

      <div style={{ marginTop: 28, padding: '16px 20px', background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>
          about dxedge
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>
          DXEdge was built by <strong style={{ color: 'var(--text)' }}>James Wilson K6WRJ</strong> (CM95ku, San Diego CA) over a single day in a hospital observation unit while waiting for a cardiac stress test on May 29, 2026. Built entirely from an iPhone using Claude (Anthropic). The heart was fine.
        </p>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginTop: 8 }}>
          Source code: <a href="https://github.com/sagejw-svg/dxedge" target="_blank" rel="noreferrer" style={{ color: 'var(--blue)' }}>github.com/sagejw-svg/dxedge</a> · 
          Support: <a href="https://paypal.me/sagejw" target="_blank" rel="noreferrer" style={{ color: 'var(--blue)', marginLeft: 4 }}>paypal.me/sagejw</a>
        </p>
        <p style={{ fontSize: 12, color: 'var(--dim)', fontStyle: 'italic', marginTop: 8 }}>
          73 de K6WRJ
        </p>
      </div>
    </div>
  )
}
