import { useState, useEffect, useRef, useCallback, memo} from 'react'
import { api } from '../api'

const W = 640, H = 320
const WORLD_URL = '/world.json'

function ll2xy(lon, lat) {
  return [(lon + 180) * W / 360, (90 - lat) * H / 180]
}

function gridToLatLon(grid) {
  if (!grid || grid.length < 4) return { lat: 32.7, lon: -117.1 }
  const g = grid.toUpperCase()
  return {
    lat: (g.charCodeAt(1) - 65) * 10 - 90  + parseInt(g[3]) + 0.5,
    lon: (g.charCodeAt(0) - 65) * 20 - 180 + parseInt(g[2]) * 2 + 1 }
}

function azLabel(az) {
  const dirs = ['N','NE','E','SE','S','SW','W','NW','N']
  return dirs[Math.round(az / 45)]
}

function formatTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'UTC'
  }) + 'Z'
}

function elColor(el) {
  if (el >= 60) return '#00ff9d'
  if (el >= 30) return '#7affb2'
  if (el >= 15) return '#ffd600'
  return '#ff9933'
}

function PassCard({ pass, isNext }) {
  const riseTime  = new Date(pass.rise_time)
  const maxTime   = new Date(pass.max_el_time)
  const now       = new Date()
  const inProgress = riseTime <= now && pass.set_time && new Date(pass.set_time) > now
  const minutesAway = Math.round((riseTime - now) / 60000)

  return (
    <div style={{
      background: isNext ? '#7affb210' : 'var(--bg1)',
      border: `1px solid ${isNext ? '#7affb244' : inProgress ? '#ffd60033' : 'var(--border)'}`,
      borderLeft: `3px solid ${inProgress ? '#ffd600' : isNext ? 'var(--teal)' : 'var(--border)'}`,
      borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {inProgress && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--yellow)', background: '#ffd60020', padding: '1px 6px', borderRadius: 3 }}>IN PROGRESS</span>}
          {isNext && !inProgress && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--teal)', background: '#7affb215', padding: '1px 6px', borderRadius: 3 }}>NEXT</span>}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{pass.name}</span>
          {pass.mode && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', background: 'var(--bg2)', padding: '1px 6px', borderRadius: 3 }}>{pass.mode}</span>}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: elColor(pass.max_el), fontWeight: 700 }}>
          {pass.max_el}° max
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {[
          { label: 'rise', time: pass.rise_time, az: pass.rise_az },
          { label: 'max',  time: pass.max_el_time, az: pass.max_el_az },
          { label: 'set',  time: pass.set_time,  az: pass.set_az },
        ].map(item => (
          <div key={item.label}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>{item.label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)' }}>{formatTime(item.time)}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--dim)' }}>{azLabel(item.az)} ({item.az}°)</div>
          </div>
        ))}
      </div>

      {(pass.up || pass.dn) && (
        <div style={{ display: 'flex', gap: 12, marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)' }}>
          {pass.up && <span>↑ {pass.up} MHz</span>}
          {pass.dn && <span>↓ {pass.dn} MHz</span>}
          {pass.notes && <span style={{ color: 'var(--dim)', fontStyle: 'italic' }}>{pass.notes}</span>}
        </div>
      )}

      {!inProgress && minutesAway > 0 && minutesAway < 120 && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>
          in {minutesAway} min
        </div>
      )}
    </div>
  )
}

const Satellites = memo(function Satellites({ grid }) {
  const canvasRef  = useRef(null)
  const worldRef   = useRef(null)
  const [positions, setPositions] = useState([])
  const [passes,    setPasses]    = useState([])
  const [loading,   setLoading]   = useState(false)
  const [worldLoaded, setWorldLoaded] = useState(false)
  const [selected,  setSelected]  = useState(null)
  const [tab,       setTab]       = useState('passes') // passes | map

  // Load world once
  useEffect(() => {
    fetch(WORLD_URL).then(r => r.json()).then(d => { worldRef.current = d; setWorldLoaded(true) })
  }, [])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [posData, passData] = await Promise.all([
        api.get('/satellites/positions'),
        api.get(`/satellites/passes?grid=${grid || 'CM95'}&hours=24`),
      ])
      setPositions(posData.positions || [])
      setPasses(passData.passes || [])
    } catch(e) {
      console.warn('Satellite fetch failed:', e)
    } finally {
      setLoading(false)
    }
  }, [grid])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Redraw map
  useEffect(() => {
    if (!worldLoaded || !canvasRef.current || positions.length === 0) return
    const canvas = canvasRef.current
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width  = W * dpr
    canvas.height = H * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)

    // Background
    ctx.fillStyle = '#0d1b2a'
    ctx.fillRect(0, 0, W, H)

    // Landmasses
    if (worldRef.current) {
      ctx.fillStyle = '#1a2d1a'
      ctx.strokeStyle = '#2a4a2a'
      ctx.lineWidth = 0.5
      for (const rings of worldRef.current) {
        for (const ring of rings) {
          if (ring.length < 3) continue
          ctx.beginPath()
          ring.forEach(([lon, lat], i) => {
            const [x, y] = ll2xy(lon, lat)
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
          })
          ctx.closePath()
          ctx.fill()
          ctx.stroke()
        }
      }
    }

    // Grid lines
    ctx.strokeStyle = '#1a2a3a'; ctx.lineWidth = 0.3
    for (let lon = -150; lon <= 180; lon += 30) {
      const [x] = ll2xy(lon, 0); ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke()
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const [,y] = ll2xy(0, lat); ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke()
    }

    // Observer location
    const { lat: olat, lon: olon } = gridToLatLon(grid || 'CM95')
    const [ox, oy] = ll2xy(olon, olat)
    ctx.beginPath(); ctx.arc(ox, oy, 5, 0, 2*Math.PI)
    ctx.fillStyle = '#7affb2'; ctx.fill()
    ctx.fillStyle = '#7affb2'; ctx.font = 'bold 8px monospace'
    ctx.fillText(grid?.slice(0,4) || 'QTH', ox+7, oy+4)

    // Satellite positions
    for (const sat of positions) {
      const [sx, sy] = ll2xy(sat.lon, sat.lat)
      const isSel = selected === sat.norad
      const isVisible = passes.some(p => {
        const now = Date.now()
        return p.norad === sat.norad &&
               new Date(p.rise_time).getTime() <= now &&
               p.set_time && new Date(p.set_time).getTime() > now
      })

      // Satellite dot
      ctx.beginPath()
      ctx.arc(sx, sy, isSel ? 6 : isVisible ? 5 : 3, 0, 2*Math.PI)
      ctx.fillStyle = isSel ? '#fff' : isVisible ? '#ffd600' : '#7a9fff'
      ctx.fill()
      if (isVisible) {
        ctx.beginPath(); ctx.arc(sx, sy, 9, 0, 2*Math.PI)
        ctx.strokeStyle = '#ffd60066'; ctx.lineWidth = 1; ctx.stroke()
      }

      // Label for selected or visible
      if (isSel || isVisible) {
        ctx.fillStyle = isSel ? '#fff' : '#ffd600'
        ctx.font = `bold ${isSel ? 10 : 9}px monospace`
        ctx.fillText(sat.name, sx + 8, sy - 2)
      }
    }

  }, [positions, passes, worldLoaded, grid, selected])

  const nextPass = passes[0]
  const inProgress = passes.filter(p => {
    const now = Date.now()
    return new Date(p.rise_time).getTime() <= now &&
           p.set_time && new Date(p.set_time).getTime() > now
  })

  const btnStyle = (active) => ({
    fontFamily: 'var(--font-mono)', fontSize: 11,
    background: active ? '#7affb220' : 'var(--bg1)',
    border: `1px solid ${active ? 'var(--teal)' : 'var(--border)'}`,
    color: active ? 'var(--teal)' : 'var(--muted)',
    padding: '6px 14px', borderRadius: 5, cursor: 'pointer'
  })

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase' }}>
            ham satellite tracking
          </span>
          {!loading && passes.length > 0 && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', marginLeft: 12 }}>
              {passes.length} passes · {positions.length} sats tracked
            </span>
          )}
          {inProgress.length > 0 && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--yellow)', background: '#ffd60015', padding: '1px 7px', borderRadius: 3, marginLeft: 8 }}>
              🛰 {inProgress.map(p => p.name).join(', ')} overhead now
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setTab('passes')} style={btnStyle(tab === 'passes')}>Passes</button>
          <button onClick={() => setTab('map')}    style={btnStyle(tab === 'map')}>Map</button>
          <button onClick={fetchAll} disabled={loading} style={{
            fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--bg1)',
            border: `1px solid ${loading ? 'var(--border)' : '#7affb244'}`,
            color: loading ? 'var(--dim)' : 'var(--teal)',
            padding: '6px 12px', borderRadius: 5, cursor: loading ? 'default' : 'pointer'
          }}>
            {loading ? 'loading...' : '↺'}
          </button>
        </div>
      </div>

      {/* Map view */}
      {tab === 'map' && (
        <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ padding: '8px 14px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)' }}>
            <span style={{ color: '#ffd600' }}>● overhead now</span>
            <span style={{ marginLeft: 12, color: '#7a9fff' }}>● tracked sats</span>
            <span style={{ marginLeft: 12, color: '#7affb2' }}>● your location</span>
            <span style={{ marginLeft: 12 }}>click sat for details</span>
          </div>
          <canvas ref={canvasRef} onClick={(e) => {
            // Simple click-to-select satellite
            const rect = e.currentTarget.getBoundingClientRect()
            const scaleX = W / rect.width
            const cx = (e.clientX - rect.left) * scaleX
            const cy = (e.clientY - rect.top) * (H / rect.height)
            let closest = null, minDist = 20
            for (const sat of positions) {
              const [sx, sy] = ll2xy(sat.lon, sat.lat)
              const d = Math.sqrt((cx-sx)**2 + (cy-sy)**2)
              if (d < minDist) { minDist = d; closest = sat.norad }
            }
            setSelected(prev => prev === closest ? null : closest)
          }}
          style={{ width: '100%', aspectRatio: '2/1', display: 'block', cursor: 'crosshair' }} />
          {selected && (() => {
            const sat = positions.find(p => p.norad === selected)
            if (!sat) return null
            return (
              <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700 }}>{sat.name}</span>
                <span style={{ color: 'var(--muted)' }}>lat {sat.lat}° lon {sat.lon}°</span>
                <span style={{ color: 'var(--muted)' }}>alt {sat.alt_km} km</span>
                {sat.up && <span>↑ {sat.up} MHz</span>}
                {sat.dn && <span>↓ {sat.dn} MHz</span>}
                {sat.mode && <span style={{ color: 'var(--dim)' }}>{sat.mode}</span>}
                {sat.notes && <span style={{ color: 'var(--dim)', fontStyle: 'italic' }}>{sat.notes}</span>}
              </div>
            )
          })()}
        </div>
      )}

      {/* Passes list */}
      {tab === 'passes' && (
        <>
          {loading && (
            <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--dim)', animation: 'pulse 1.4s infinite' }}>
              computing passes from {grid?.slice(0,4) || 'CM95'}...
            </div>
          )}
          {!loading && passes.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--dim)' }}>
              no passes found in next 24h · TLE data may be loading
            </div>
          )}
          {passes.slice(0, 20).map((pass, i) => (
            <PassCard key={`${pass.norad}-${pass.rise_time}`} pass={pass} isNext={i === 0} />
          ))}
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', marginTop: 8, textAlign: 'right' }}>
            TLE data from SatNOGS / Space-Track.org · passes ≥5° elevation
          </p>
        </>
      )}
    </div>
  )
}

export default Satellites
