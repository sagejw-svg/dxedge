import { useState, useEffect, useRef } from 'react'

// Equirectangular world map as simple SVG paths
// We'll draw the terminator (gray line) as a computed curve

function solarDeclination() {
  const now = new Date()
  const doy = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000)
  return 23.45 * Math.sin((2 * Math.PI / 365) * (doy - 81))
}

function sunPosition() {
  const now = new Date()
  const utcH = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600
  const decl = solarDeclination()
  // Sub-solar longitude: sun is overhead at this longitude at current UTC time
  const lon = (utcH - 12) * 15
  return { lat: decl, lon }
}

function isNight(lat, lon, sunLat, sunLon) {
  // Great circle distance to sub-solar point > 90 degrees = night
  const toRad = d => d * Math.PI / 180
  const lat1 = toRad(lat), lat2 = toRad(sunLat)
  const dLon = toRad(lon - sunLon)
  const cos = Math.sin(lat1) * Math.sin(lat2) + Math.cos(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return Math.acos(Math.max(-1, Math.min(1, cos))) > Math.PI / 2
}

const W = 600, H = 300

// Pre-computed simplified world land masses (SVG paths in equirectangular 0-600 x 0-300)
// Longitude -180..180 -> x 0..600, Latitude 90..-90 -> y 0..300
function ll2xy(lon, lat) {
  return [(lon + 180) * (W / 360), (90 - lat) * (H / 180)]
}

export default function GrayLine({ grid }) {
  const canvasRef = useRef(null)
  const [sunPos, setSunPos] = useState(sunPosition())
  const [time, setTime] = useState(new Date())

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

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    canvas.width  = W * dpr
    canvas.height = H * dpr
    ctx.scale(dpr, dpr)
    draw(ctx)
  }, [sunPos, grid])

  function draw(ctx) {
    const { lat: sunLat, lon: sunLon } = sunPos

    // Background - daytime color
    ctx.fillStyle = '#0d1b2a'
    ctx.fillRect(0, 0, W, H)

    // Draw night overlay pixel by pixel (chunked for performance)
    // Use 3px blocks for speed
    const STEP = 3
    ctx.save()
    for (let x = 0; x < W; x += STEP) {
      for (let y = 0; y < H; y += STEP) {
        const lon = (x / W) * 360 - 180
        const lat = 90 - (y / H) * 180
        if (isNight(lat, lon, sunLat, sunLon)) {
          ctx.fillStyle = 'rgba(0,0,0,0.55)'
          ctx.fillRect(x, y, STEP, STEP)
        }
      }
    }
    ctx.restore()

    // Grid lines
    ctx.strokeStyle = '#1a2a3a'
    ctx.lineWidth = 0.5
    for (let lon = -150; lon <= 180; lon += 30) {
      const [x] = ll2xy(lon, 0)
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, H)
      ctx.stroke()
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const [, y] = ll2xy(0, lat)
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
      ctx.stroke()
    }

    // Equator
    ctx.strokeStyle = '#1e3a4a'
    ctx.lineWidth = 1
    const [, eqY] = ll2xy(0, 0)
    ctx.beginPath()
    ctx.moveTo(0, eqY)
    ctx.lineTo(W, eqY)
    ctx.stroke()

    // Gray line (terminator) - draw as a smooth curve
    ctx.beginPath()
    ctx.strokeStyle = '#ffd60088'
    ctx.lineWidth = 1.5
    let first = true
    for (let step = 0; step <= 360; step++) {
      const lon = step - 180
      // Find the latitude where solar zenith = 90
      const toRad = d => d * Math.PI / 180
      const toDeg = r => r * 180 / Math.PI
      const cosH = -Math.tan(toRad(sunLat)) * Math.tan(toRad(0)) // simplified
      // For each longitude, find the terminator latitude
      const dLon = toRad(lon - sunLon)
      const sinZ = Math.cos(toRad(sunLat)) * Math.cos(dLon)
      const terminatorLat = toDeg(Math.asin(Math.max(-1, Math.min(1, sinZ))))
      // Actually need: cos(90) = sin(lat)*sin(decl) + cos(lat)*cos(decl)*cos(HA)
      // 0 = sin(lat)*sin(decl) + cos(lat)*cos(decl)*cos(HA)
      // tan(lat) = -cos(HA)/tan(decl)
      const HA = toRad(lon - sunLon)
      const termLat = isNaN(sunLat) ? 0 :
        toDeg(Math.atan2(-Math.cos(HA), Math.tan(toRad(sunLat))))

      const [x, y] = ll2xy(lon, Math.max(-85, Math.min(85, termLat)))
      if (first) { ctx.moveTo(x, y); first = false }
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Sub-solar point (sun)
    const [sx, sy] = ll2xy(sunLon, sunLat)
    ctx.beginPath()
    ctx.arc(sx, sy, 5, 0, 2 * Math.PI)
    ctx.fillStyle = '#ffd600'
    ctx.fill()
    ctx.strokeStyle = '#ffd60088'
    ctx.lineWidth = 1
    ctx.stroke()
    // Sun glow
    ctx.beginPath()
    ctx.arc(sx, sy, 10, 0, 2 * Math.PI)
    ctx.strokeStyle = '#ffd60033'
    ctx.lineWidth = 2
    ctx.stroke()

    // User's grid square position
    if (grid && grid.length >= 4) {
      const g = grid.toUpperCase()
      try {
        const glon = (g.charCodeAt(0) - 65) * 20 - 180 + parseInt(g[2]) * 2 + 1
        const glat = (g.charCodeAt(1) - 65) * 10 - 90 + parseInt(g[3]) + 0.5
        const [gx, gy] = ll2xy(glon, glat)
        ctx.beginPath()
        ctx.arc(gx, gy, 4, 0, 2 * Math.PI)
        ctx.fillStyle = '#7affb2'
        ctx.fill()
        ctx.fillStyle = '#7affb2'
        ctx.font = 'bold 9px monospace'
        ctx.fillText(grid.slice(0,4), gx + 6, gy + 4)
      } catch {}
    }

    // Axis labels - longitudes
    ctx.fillStyle = '#334'
    ctx.font = '8px monospace'
    ctx.textAlign = 'center'
    for (let lon = -150; lon <= 150; lon += 30) {
      const [x] = ll2xy(lon, 0)
      ctx.fillText(lon + '°', x, H - 2)
    }
  }

  const utcStr = time.toISOString().slice(11, 19) + ' UTC'
  const isGray = (() => {
    if (!grid || grid.length < 4) return false
    const g = grid.toUpperCase()
    try {
      const glon = (g.charCodeAt(0) - 65) * 20 - 180 + parseInt(g[2]) * 2 + 1
      const glat = (g.charCodeAt(1) - 65) * 10 - 90 + parseInt(g[3]) + 0.5
      const toRad = d => d * Math.PI / 180
      const { lat: sLat, lon: sLon } = sunPos
      const HA = toRad(glon - sLon)
      const termLat = (180 / Math.PI) * Math.atan2(-Math.cos(HA), Math.tan(toRad(sLat)))
      return Math.abs(glat - termLat) < 4
    } catch { return false }
  })()

  return (
    <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginTop: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
        <div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase' }}>gray line</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', marginLeft: 12 }}>{utcStr}</span>
          {isGray && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--yellow)', background: '#ffd60018', padding: '1px 6px', borderRadius: 3, marginLeft: 10 }}>🌅 gray line near {grid.slice(0,4)}</span>}
        </div>
        <div style={{ display: 'flex', gap: 14, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)' }}>
          <span>☀️ sub-solar {Math.round(sunPos.lat)}°, {Math.round(sunPos.lon)}°</span>
          <span style={{ color: '#7affb2' }}>● {grid?.slice(0,4) || 'grid'}</span>
        </div>
      </div>
      <div style={{ position: 'relative' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: 'auto', display: 'block', aspectRatio: '2/1' }} />
      </div>
      <div style={{ padding: '6px 14px', display: 'flex', gap: 16, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', borderTop: '1px solid var(--border)' }}>
        <span>■ night</span>
        <span style={{ color: '#ffd60088' }}>— terminator</span>
        <span style={{ color: '#ffd600' }}>● sun</span>
        <span style={{ color: '#7affb2' }}>● your grid</span>
        <span style={{ marginLeft: 'auto' }}>updates every 30s</span>
      </div>
    </div>
  )
}
