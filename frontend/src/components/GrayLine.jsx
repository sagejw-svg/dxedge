import { useState, useEffect, useRef, memo} from 'react'

function solarDeclination() {
  const now = new Date()
  const doy = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000)
  return 23.45 * Math.sin((2 * Math.PI / 365) * (doy - 81))
}

function sunPosition() {
  const now = new Date()
  const utcH = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600
  return { lat: solarDeclination(), lon: (utcH - 12) * 15 }
}

function isNight(lat, lon, sunLat, sunLon) {
  const r = Math.PI / 180
  const cos = Math.sin(lat*r)*Math.sin(sunLat*r) +
              Math.cos(lat*r)*Math.cos(sunLat*r)*Math.cos((lon-sunLon)*r)
  return Math.acos(Math.max(-1, Math.min(1, cos))) > Math.PI / 2
}

function gridToLatLon(grid) {
  if (!grid || grid.length < 4) return { lat: 32.7, lon: -117.1 }
  const g = grid.toUpperCase()
  return {
    lon: (g.charCodeAt(0) - 65) * 20 - 180 + parseInt(g[2]) * 2 + 1,
    lat: (g.charCodeAt(1) - 65) * 10 - 90  + parseInt(g[3]) + 0.5 }
}

const W = 640, H = 320

function ll2xy(lon, lat) {
  return [(lon + 180) * W / 360, (90 - lat) * H / 180]
}

const GrayLine = memo(function GrayLine({ grid }) {
  const canvasRef   = useRef(null)
  const worldRef    = useRef(null) // cached world polygons
  const [sunPos, setSunPos] = useState(sunPosition())
  const [time, setTime]     = useState(new Date())
  const [loaded, setLoaded] = useState(false)

  // Load world data once
  useEffect(() => {
    fetch('/world.json')
      .then(r => r.json())
      .then(data => { worldRef.current = data; setLoaded(true) })
      .catch(() => { worldRef.current = []; setLoaded(true) })
  }, [])

  // Update every 30s, pause when hidden
  useEffect(() => {
    const update = () => {
      if (!document.hidden) {
        setSunPos(sunPosition())
        setTime(new Date())
      }
    }
    const t = setInterval(update, 30000)
    return () => clearInterval(t)
  }, [])

  // Redraw when sunPos or world data changes
  useEffect(() => {
    if (!loaded || !canvasRef.current) return
    const canvas = canvasRef.current
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width  = W * dpr
    canvas.height = H * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    draw(ctx, sunPos, worldRef.current, grid)
  }, [sunPos, loaded, grid])

  function draw(ctx, sun, polys, grid) {
    const { lat: sLat, lon: sLon } = sun

    // Ocean background - daytime color
    ctx.fillStyle = '#0d1b2a'
    ctx.fillRect(0, 0, W, H)

    // Draw land masses first (lighter so night overlay shows)
    if (polys?.length) {
      ctx.fillStyle = '#1a2d1a'
      ctx.strokeStyle = '#2a3d2a'
      ctx.lineWidth = 0.5
      for (const rings of polys) {
        for (const ring of rings) {
          if (ring.length < 3) continue
          ctx.beginPath()
          for (let i = 0; i < ring.length; i++) {
            const [x, y] = ll2xy(ring[i][0], ring[i][1])
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
          }
          ctx.closePath()
          ctx.fill()
          ctx.stroke()
        }
      }
    }

    // Night overlay - pixel chunks
    const STEP = 4
    ctx.save()
    for (let x = 0; x < W; x += STEP) {
      for (let y = 0; y < H; y += STEP) {
        const lon = (x / W) * 360 - 180
        const lat = 90 - (y / H) * 180
        if (isNight(lat, lon, sLat, sLon)) {
          ctx.fillStyle = 'rgba(0,0,20,0.60)'
          ctx.fillRect(x, y, STEP, STEP)
        }
      }
    }
    ctx.restore()

    // Redraw land outlines on top of night overlay (so coasts stay crisp)
    if (polys?.length) {
      ctx.strokeStyle = '#3a5a3a'
      ctx.lineWidth = 0.7
      for (const rings of polys) {
        for (const ring of rings) {
          if (ring.length < 3) continue
          ctx.beginPath()
          for (let i = 0; i < ring.length; i++) {
            const [x, y] = ll2xy(ring[i][0], ring[i][1])
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
          }
          ctx.closePath()
          ctx.stroke()
        }
      }
    }

    // Grid lines
    ctx.strokeStyle = '#1a2a3a'
    ctx.lineWidth = 0.4
    for (let lon = -150; lon <= 180; lon += 30) {
      const [x] = ll2xy(lon, 0)
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const [, y] = ll2xy(0, lat)
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
    }
    // Equator slightly brighter
    ctx.strokeStyle = '#1e3a4a'; ctx.lineWidth = 0.8
    const [, eqY] = ll2xy(0, 0)
    ctx.beginPath(); ctx.moveTo(0, eqY); ctx.lineTo(W, eqY); ctx.stroke()

    // Gray line (terminator)
    ctx.beginPath()
    ctx.strokeStyle = 'rgba(255,214,0,0.7)'
    ctx.lineWidth = 1.5
    let first = true
    for (let step = 0; step <= 361; step++) {
      const lon = step - 180
      const HA  = (lon - sLon) * Math.PI / 180
      const termLat = (180 / Math.PI) * Math.atan2(-Math.cos(HA), Math.tan(sLat * Math.PI / 180))
      const clamped = Math.max(-85, Math.min(85, termLat))
      const [x, y] = ll2xy(lon, clamped)
      first ? (ctx.moveTo(x, y), first = false) : ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Sub-solar glow
    const [sx, sy] = ll2xy(sLon, sLat)
    for (const [r, a] of [[16,'rgba(255,214,0,0.06)'],[10,'rgba(255,214,0,0.12)'],[5,'rgba(255,214,0,0.6)']]) {
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, 2*Math.PI)
      ctx.fillStyle = a; ctx.fill()
    }

    // User grid
    if (grid?.length >= 4) {
      const { lat: glat, lon: glon } = gridToLatLon(grid)
      const [gx, gy] = ll2xy(glon, glat)
      ctx.beginPath(); ctx.arc(gx, gy, 5, 0, 2*Math.PI)
      ctx.fillStyle = '#7affb2'; ctx.fill()
      ctx.fillStyle = '#7affb2'
      ctx.font = 'bold 9px monospace'
      ctx.fillText(grid.slice(0,4), gx + 7, gy + 4)
    }

    // Longitude labels
    ctx.fillStyle = '#2a3a4a'
    ctx.font = '8px monospace'
    ctx.textAlign = 'center'
    for (let lon = -150; lon <= 150; lon += 30) {
      const [x] = ll2xy(lon, 0)
      ctx.fillText(`${lon}°`, x, H - 3)
    }
  }

  const utcStr = time.toISOString().slice(11, 19) + ' UTC'

  // Gray line proximity check
  const isGray = (() => {
    if (!grid || grid.length < 4) return false
    try {
      const { lat: glat, lon: glon } = gridToLatLon(grid)
      const HA = (glon - sunPos.lon) * Math.PI / 180
      const termLat = (180/Math.PI) * Math.atan2(-Math.cos(HA), Math.tan(sunPos.lat * Math.PI / 180))
      return Math.abs(glat - termLat) < 4
    } catch { return false }
  })()

  return (
    <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase' }}>gray line</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)' }}>{utcStr}</span>
          {isGray && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--yellow)', background: '#ffd60018', padding: '1px 6px', borderRadius: 3 }}>
              🌅 gray line near {grid?.slice(0,4)}
            </span>
          )}
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)' }}>
          ☀️ {Math.round(sunPos.lat)}°, {Math.round(sunPos.lon)}°
        </span>
      </div>

      <canvas ref={canvasRef}
        style={{ width: '100%', height: 'auto', display: 'block', aspectRatio: '2/1' }} />

      <div style={{ padding: '6px 14px', display: 'flex', gap: 16, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <span style={{ color: '#1a2d1a', background: '#3a5a3a', padding: '1px 4px', borderRadius: 2 }}>land</span>
        <span>■ night</span>
        <span style={{ color: '#ffd600' }}>— terminator</span>
        <span style={{ color: '#ffd600' }}>● sun</span>
        <span style={{ color: '#7affb2' }}>● {grid?.slice(0,4) || 'your grid'}</span>
        <span style={{ marginLeft: 'auto' }}>updates every 30s</span>
      </div>
    </div>
  )
}

export default GrayLine
