import { useState, useEffect } from 'react'

// Maidenhead grid to lat/lon center
function gridToLatLon(grid) {
  if (!grid || grid.length < 4) return { lat: 32.7, lon: -117.1 }
  const g = grid.toUpperCase()
  const lon = (g.charCodeAt(0) - 65) * 20 - 180 + parseInt(g[2]) * 2 + 1
  const lat = (g.charCodeAt(1) - 65) * 10 - 90  + parseInt(g[3]) * 1 + 0.5
  return { lat, lon }
}

const APRS_SITES = [
  {
    name: 'aprs.fi',
    url: (lat, lon) => `https://aprs.fi/#!lat=${lat.toFixed(2)}&lng=${lon.toFixed(2)}&z=10`,
    desc: 'Primary APRS tracking map - live positions, weather, messages',
    icon: '🗺️',
    canEmbed: true,
  },
  {
    name: 'aprs.rocks',
    url: () => 'https://aprs.rocks',
    desc: 'APRS web client with modern UI',
    icon: '🪨',
    canEmbed: false,
  },
  {
    name: 'FindU',
    url: (lat, lon, call) => call
      ? `https://www.findu.com/cgi-bin/find.cgi?call=${call}`
      : 'https://www.findu.com',
    desc: 'Callsign history, weather, telemetry lookup',
    icon: '🔍',
    canEmbed: false,
  },
  {
    name: 'APRS Direct',
    url: (lat, lon) => `https://www.aprsdirect.com/?lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}&zoom=10`,
    desc: 'Real-time APRS map, alternative to aprs.fi',
    icon: '📡',
    canEmbed: true,
  },
]

export default function APRS({ grid, callsign }) {
  const [activeMap, setActiveMap] = useState('aprs.fi')
  const [lookupCall, setLookupCall] = useState(callsign || '')
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('dxedge_aprsfi_key') || '')
  const [lookupResult, setLookupResult] = useState(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState(null)
  const [showKeyInput, setShowKeyInput] = useState(false)

  const { lat, lon } = gridToLatLon(grid || 'CM95')
  const activeSite = APRS_SITES.find(s => s.name === activeMap)
  const embedUrl = activeSite?.canEmbed ? activeSite.url(lat, lon, lookupCall) : null

  const saveKey = (k) => {
    setApiKey(k)
    localStorage.setItem('dxedge_aprsfi_key', k)
  }

  const doLookup = async () => {
    if (!lookupCall) return
    if (!apiKey) { setShowKeyInput(true); return }
    setLookupLoading(true)
    setLookupError(null)
    setLookupResult(null)
    try {
      const r = await fetch(
        `https://api.aprs.fi/api/get?name=${lookupCall.toUpperCase()}&what=loc&apikey=${apiKey}&format=json`
      )
      const data = await r.json()
      if (data.result === 'ok' && data.entries?.length > 0) {
        setLookupResult(data.entries[0])
      } else {
        setLookupError(data.description || 'No data found')
      }
    } catch (e) {
      setLookupError('Request failed')
    } finally {
      setLookupLoading(false)
    }
  }

  const inputStyle = {
    fontFamily: 'var(--font-mono)', fontSize: 13,
    background: 'var(--bg1)', border: '1px solid var(--border)',
    color: 'var(--text)', padding: '7px 10px', borderRadius: 6, outline: 'none',
  }

  return (
    <div>
      {/* Map selector + callsign lookup row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {/* Map picker */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: 2, textTransform: 'uppercase' }}>map source</label>
          <div style={{ display: 'flex', gap: 5 }}>
            {APRS_SITES.map(s => (
              <button key={s.name} onClick={() => {
                  if (s.canEmbed) setActiveMap(s.name)
                  else window.open(s.url(lat, lon, lookupCall), '_blank')
                }}
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11,
                  background: activeMap === s.name ? '#7affb220' : 'var(--bg1)',
                  border: `1px solid ${activeMap === s.name ? 'var(--teal)' : 'var(--border)'}`,
                  color: activeMap === s.name ? 'var(--teal)' : 'var(--muted)',
                  padding: '6px 12px', borderRadius: 5, cursor: 'pointer'
                }}>
                {s.name} {!s.canEmbed && '↗'}
              </button>
            ))}
          </div>
        </div>

        {/* Callsign lookup */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: 2, textTransform: 'uppercase' }}>callsign lookup</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={lookupCall} onChange={e => setLookupCall(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && doLookup()}
              placeholder="K6WRJ" maxLength={12}
              style={{ ...inputStyle, width: 110, fontWeight: 700, fontSize: 14 }} />
            <button onClick={doLookup} disabled={!lookupCall || lookupLoading} style={{
              fontFamily: 'var(--font-mono)', fontSize: 12,
              background: 'var(--bg1)', border: '1px solid #7affb244',
              color: 'var(--teal)', padding: '7px 14px', borderRadius: 6, cursor: 'pointer'
            }}>
              {lookupLoading ? '...' : 'find'}
            </button>
            <button onClick={() => setShowKeyInput(v => !v)} style={{
              fontFamily: 'var(--font-mono)', fontSize: 10,
              background: apiKey ? '#7affb215' : 'var(--bg1)',
              border: `1px solid ${apiKey ? '#7affb244' : 'var(--border)'}`,
              color: apiKey ? 'var(--teal)' : 'var(--dim)',
              padding: '7px 10px', borderRadius: 6, cursor: 'pointer'
            }}>
              {apiKey ? '🔑 key set' : '🔑 API key'}
            </button>
          </div>
        </div>
      </div>

      {/* API key input */}
      {showKeyInput && (
        <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', marginBottom: 14 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', marginBottom: 8 }}>
            Free API key from <a href="https://aprs.fi/page/api" target="_blank" rel="noreferrer" style={{ color: 'var(--blue)' }}>aprs.fi/page/api ↗</a> — required for callsign lookup
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={apiKey} onChange={e => saveKey(e.target.value)}
              placeholder="your aprs.fi API key"
              style={{ ...inputStyle, flex: 1 }} />
            <button onClick={() => setShowKeyInput(false)} style={{
              fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--bg2)',
              border: '1px solid var(--border)', color: 'var(--muted)',
              padding: '7px 12px', borderRadius: 6, cursor: 'pointer'
            }}>done</button>
          </div>
        </div>
      )}

      {/* Lookup result */}
      {lookupResult && (
        <div style={{ background: 'var(--bg1)', border: '1px solid #7affb233', borderLeft: '3px solid var(--teal)', borderRadius: 8, padding: '12px 16px', marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--teal)', marginBottom: 4 }}>
                {lookupResult.name}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
                {lookupResult.srccall !== lookupResult.name && `via ${lookupResult.srccall}`}
              </div>
            </div>
            {[
              { label: 'lat',     value: `${parseFloat(lookupResult.lat).toFixed(4)}°` },
              { label: 'lon',     value: `${parseFloat(lookupResult.lng).toFixed(4)}°` },
              { label: 'last heard', value: new Date(lookupResult.lasttime * 1000).toISOString().slice(11,16) + 'Z' },
              lookupResult.speed && { label: 'speed',  value: `${lookupResult.speed} kph` },
              lookupResult.course && { label: 'course', value: `${lookupResult.course}°` },
              lookupResult.altitude && { label: 'alt', value: `${lookupResult.altitude}m` },
            ].filter(Boolean).map(item => (
              <div key={item.label}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 1, textTransform: 'uppercase' }}>{item.label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text)' }}>{item.value}</div>
              </div>
            ))}
          </div>
          {lookupResult.comment && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#777', fontStyle: 'italic', marginTop: 8 }}>{lookupResult.comment}</div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <a href={`https://aprs.fi/#!call=a%2F${lookupResult.name}&timerange=3600`}
              target="_blank" rel="noreferrer"
              style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--blue)', border: '1px solid var(--border)', padding: '3px 8px', borderRadius: 4, textDecoration: 'none' }}>
              view on aprs.fi ↗
            </a>
            <a href={`https://www.findu.com/cgi-bin/find.cgi?call=${lookupResult.name}`}
              target="_blank" rel="noreferrer"
              style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--blue)', border: '1px solid var(--border)', padding: '3px 8px', borderRadius: 4, textDecoration: 'none' }}>
              FindU history ↗
            </a>
          </div>
        </div>
      )}

      {lookupError && (
        <div style={{ background: '#ff6b6b11', border: '1px solid #ff6b6b33', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--red)' }}>
          {lookupError} {!apiKey && '— add your aprs.fi API key above'}
        </div>
      )}

      {/* Map embed */}
      <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
          <div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--teal)' }}>
              {activeMap}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', marginLeft: 10 }}>
              {activeSite?.desc}
            </span>
          </div>
          <a href={activeSite?.url(lat, lon, lookupCall)} target="_blank" rel="noreferrer"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--blue)', border: '1px solid var(--border)', padding: '3px 10px', borderRadius: 4, textDecoration: 'none' }}>
            open full ↗
          </a>
        </div>
        {embedUrl ? (
          <iframe src={embedUrl} style={{ width: '100%', height: 520, border: 'none', display: 'block' }}
            title={activeMap} loading="lazy" />
        ) : (
          <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--dim)' }}>
            {activeSite?.name} opens in a new tab
          </div>
        )}
      </div>

      {/* What is APRS */}
      <div style={{ marginTop: 14, padding: '14px 16px', background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 }}>about aprs</div>
        <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7, margin: 0 }}>
          APRS (Automatic Packet Reporting System) is a digital communications system used by amateur radio operators to broadcast real-time data including GPS positions, weather readings, and short messages over the 144.390 MHz simplex frequency. An iGate (internet gateway) receives these RF packets and feeds them to the APRS-IS internet network, making them visible on maps worldwide. Your VHF/UHF radio + a TNC or phone + APRSDroid/Ham Tracker = an APRS station.
        </p>
      </div>
    </div>
  )
}
