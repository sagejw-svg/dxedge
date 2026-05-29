import { useState } from 'react'

const BAND_ORDER = ['10m', '12m', '15m', '17m', '20m', '30m', '40m', '80m', '160m', '6m']
const C = {
  excellent: '#00ff9d', good: '#7affb2', fair: '#ffd600', poor: '#ff6b6b'
}

function SpotRow({ spot }) {
  const snrColor = spot.snr >= -5 ? 'var(--green)' : spot.snr >= -12 ? 'var(--teal)' : spot.snr >= -18 ? 'var(--yellow)' : 'var(--muted)'
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 54px 46px', alignItems: 'center', gap: 8, padding: '5px 12px', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{spot.callsign}</span>
      <span style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{spot.country || spot.grid || ''}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: snrColor, textAlign: 'right' }}>{spot.snr > 0 ? '+' : ''}{spot.snr} dB</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', textAlign: 'right' }}>{spot.mode}</span>
    </div>
  )
}

function BandGroup({ band, spots, condition }) {
  const [open, setOpen] = useState(true)
  const color = C[condition] || C.poor
  return (
    <div style={{ marginBottom: 8, border: `1px solid ${color}22`, borderRadius: 8, overflow: 'hidden' }}>
      <div onClick={() => setOpen(v => !v)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: `${color}12`, cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{band}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color, background: `${color}20`, padding: '2px 6px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: 1 }}>{condition}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)' }}>{spots.length} spots</span>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--dim)' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 54px 46px', gap: 8, padding: '4px 12px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
            {['callsign', 'country', 'snr', 'mode'].map(h => (
              <span key={h} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 2, textTransform: 'uppercase', textAlign: h === 'snr' || h === 'mode' ? 'right' : 'left' }}>{h}</span>
            ))}
          </div>
          {spots.map((s, i) => <SpotRow key={i} spot={s} />)}
        </div>
      )}
    </div>
  )
}

export default function PSK({ spots, grid, onRefresh, conditions }) {
  const condMap = Object.fromEntries((conditions || []).map(c => [c.band, c.condition]))

  // Group by band
  const byBand = {}
  for (const s of spots) {
    if (!byBand[s.band]) byBand[s.band] = []
    byBand[s.band].push(s)
  }
  const activeBands = BAND_ORDER.filter(b => byBand[b]?.length > 0)
  const total = spots.length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase' }}>pskreporter live rx</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', marginLeft: 10 }}>grid {grid} · last 2h</span>
          {total > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--yellow)', marginLeft: 10 }}>{total} spots</span>}
        </div>
        <button onClick={onRefresh} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, background: 'var(--bg1)', border: '1px solid var(--border)', color: 'var(--teal)', padding: '5px 10px', borderRadius: 5 }}>
          ↺ refresh
        </button>
      </div>

      {activeBands.length === 0 ? (
        <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10, padding: 30, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--dim)' }}>
          no spots found for {grid} in last 2h
        </div>
      ) : (
        activeBands.map(band => (
          <BandGroup key={band} band={band} spots={byBand[band]} condition={condMap[band] || 'fair'} />
        ))
      )}
    </div>
  )
}
