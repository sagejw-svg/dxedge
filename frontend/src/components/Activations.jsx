import { useState, useEffect, useCallback, memo} from 'react'
import { api } from '../api'

const BAND_COLOR = {
  '160m':'#ff9933','80m':'#ff9933','40m':'#ffd600',
  '30m':'#ffd600','20m':'#7affb2','17m':'#7affb2',
  '15m':'#00ff9d','12m':'#00ff9d','10m':'#00ff9d','6m':'#a78bfa'
}

function SpotCard({ spot }) {
  const ref  = spot.park_ref
  const name = spot.park_name
  const refUrl = `https://pota.app/#/park/${ref}`

  return (
    <div style={{
      background: 'var(--bg1)', border: '1px solid #7affb233',
      borderLeft: '3px solid var(--teal)',
      borderRadius: 8, padding: '10px 14px',
      display: 'flex', flexDirection: 'column', gap: 5,
      animation: 'fadeIn 0.3s ease both'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
            color: 'var(--teal)',
            background: '#7affb215',
            padding: '1px 6px', borderRadius: 3 }}>{spot.type}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
            {spot.callsign}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {spot.band !== '?' && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: BAND_COLOR[spot.band] || 'var(--muted)',
              background: `${BAND_COLOR[spot.band] || '#888'}15`,
              padding: '2px 7px', borderRadius: 3
            }}>{spot.band}</span>
          )}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>{spot.mode}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--dim)' }}>{spot.freq} kHz</span>
        </div>
      </div>

      <a href={refUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--teal)', opacity: 0.9 }}>
          {ref} {name && <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· {name}</span>}
        </div>
      </a>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {spot.comments && (
          <span style={{ fontSize: 11, color: '#666', fontStyle: 'italic', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: '70%' }}>
            {spot.comments}
          </span>
        )}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--dim)', marginLeft: 'auto' }}>
          {spot.spotter && <span>via {spot.spotter} · </span>}
          {spot.time_utc}
        </span>
      </div>
    </div>
  )
}

const Activations = memo(function Activations() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [lastFetch, setLastFetch] = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get('/activations')
      setData(r)
      setLastFetch(new Date())
    } catch(e) {
      console.warn('Activations fetch failed:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
    const t = setInterval(fetch, 120000) // refresh every 2 min
    return () => clearInterval(t)
  }, [fetch])

  const spots = [...(data?.pota || [])].sort((a, b) =>
    (b.time_utc || '').localeCompare(a.time_utc || ''))

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase' }}>
            live activations
          </span>
          {data && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', marginLeft: 12 }}>
              {data.pota?.length || 0} POTA
            </span>
          )}
        </div>
        <button onClick={fetch} disabled={loading} style={{
          fontFamily: 'var(--font-mono)', fontSize: 11,
          background: 'var(--bg1)', border: `1px solid ${loading ? 'var(--border)' : '#7affb244'}`,
          color: loading ? 'var(--dim)' : 'var(--teal)',
          padding: '6px 12px', borderRadius: 5, cursor: loading ? 'default' : 'pointer'
        }}>↺</button>
      </div>

      {!data && !loading && (
        <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 14 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--teal)', marginBottom: 6 }}>
            POTA — Parks on the Air
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>
            Operators activate from national parks, forests, and other designated areas. Chasers call from home. Free program, huge participation. <a href="https://pota.app" target="_blank" rel="noreferrer" style={{ color: 'var(--blue)' }}>pota.app ↗</a>
          </p>
        </div>
      )}

      {loading && !data && (
        <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--dim)', animation: 'pulse 1.4s infinite' }}>
          fetching activations...
        </div>
      )}

      {spots.length === 0 && data && !loading && (
        <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--dim)' }}>
          no active POTA spots right now
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {spots.map((s, i) => <SpotCard key={`${s.callsign}-${s.park_ref}-${i}`} spot={s} />)}
      </div>

      {lastFetch && (
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--dim)', marginTop: 12, textAlign: 'right' }}>
          refreshed {lastFetch.toISOString().slice(11,16)}Z · updates every 2 min
        </p>
      )}
    </div>
  )
}
)

export default Activations
