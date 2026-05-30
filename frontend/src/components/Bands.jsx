const C = {
  excellent: { bg: '#00ff9d18', border: '#00ff9d', text: '#00ff9d', bars: 4 },
  good:      { bg: '#7affb218', border: '#7affb2', text: '#7affb2', bars: 3 },
  fair:      { bg: '#ffd60018', border: '#ffd600', text: '#ffd600', bars: 2 },
  poor:      { bg: '#ff6b6b18', border: '#ff6b6b', text: '#ff6b6b', bars: 1 },
}

const NOTES = {
  '160m': 'Night paths only; gray line DX',
  '80m':  'Regional DX at night; EU overnight',
  '40m':  'Reliable workhorse; EU opens ~0000Z',
  '30m':  'WARC; consistent all-day DX',
  '20m':  'Primary DX band; EU 1300-1800Z',
  '17m':  'WARC; EU/AS afternoon',
  '15m':  'SA/EU when open; check noon',
  '12m':  'WARC; try midday when flux high',
  '10m':  'Wide open near solar max; check noon',
  '6m':   'Magic band; sporadic-E spring/summer',
}

function BandRow({ band, condition }) {
  const c = C[condition] || C.poor
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '52px 70px 1fr auto',
      alignItems: 'center', gap: 10, padding: '6px 12px',
      borderRadius: 6, background: c.bg, border: `1px solid ${c.border}22`
    }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{band}</span>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 10, color: c.text,
        background: `${c.border}20`, padding: '2px 6px', borderRadius: 3,
        textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center'
      }}>{condition}</span>
      <span style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>{NOTES[band] || ''}</span>
      <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ width: 4, height: 3 + i * 3, background: i <= c.bars ? c.border : 'var(--bg2)', borderRadius: 1 }} />
        ))}
      </div>
    </div>
  )
}

export default function Bands({ conditions }) {
  if (!conditions) return null
  return (
    <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase' }}>band conditions</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', fontStyle: 'italic' }}>based on solar flux · see 24h chart for time-of-day</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {conditions.map(b => <BandRow key={b.band} {...b} />)}
      </div>
    </div>
  )
}
