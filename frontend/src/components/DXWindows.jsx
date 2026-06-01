const WINDOWS = [
  { region: 'EU',    cont: 'EU', bands: ['40m', '20m'], open: [0,  4],  note: 'EU night path on 40m' },
  { region: 'EU',    cont: 'EU', bands: ['20m', '17m'], open: [13, 18], note: 'Primary EU window' },
  { region: 'JA',    cont: 'AS', bands: ['20m', '17m'], open: [1,  6],  note: 'Pacific long path' },
  { region: 'HL/BY', cont: 'AS', bands: ['15m', '17m'], open: [0,  4],  note: 'East Asia overnight' },
  { region: 'VK/ZL', cont: 'OC', bands: ['40m', '20m'], open: [5,  10], note: 'OC morning path' },
  { region: 'AF',    cont: 'AF', bands: ['20m', '17m'], open: [15, 20], note: 'Afternoon Africa' },
  { region: 'SA',    cont: 'SA', bands: ['15m', '10m'], open: [18, 22], note: 'Short path SA' },
  { region: 'UA9/UA0',cont:'AS', bands: ['20m', '40m'], open: [20, 24], note: 'Siberia/Central Asia' },
]

const CONT_FLAG = { EU: '🌍', AS: '🌏', OC: '🌏', AF: '🌍', SA: '🌎', NA: '🌎' }

export default function DXWindows({ grid = 'CM95' }) {
  const utcH = new Date().getUTCHours()

  return (
    <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase' }}>dx windows from {grid.toUpperCase()}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)' }}>{String(utcH).padStart(2, '0')}:00Z now</span>
      </div>

      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '26px 70px 80px 80px 1fr', gap: 10, padding: '4px 12px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
        {['', 'region', 'bands', 'window', 'note'].map(h => (
          <span key={h} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 2, textTransform: 'uppercase' }}>{h}</span>
        ))}
      </div>

      {WINDOWS.map((w, i) => {
        const active = utcH >= w.open[0] && utcH < w.open[1]
        const timeStr = `${String(w.open[0]).padStart(2, '0')}:00-${String(w.open[1]).padStart(2, '0')}:00Z`
        return (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '26px 70px 80px 80px 1fr',
            alignItems: 'center', gap: 10, padding: '7px 12px',
            borderBottom: '1px solid var(--border)',
            background: active ? '#7affb208' : 'transparent',
            borderLeft: active ? '3px solid var(--teal)' : '3px solid transparent'
          }}>
            <span style={{ fontSize: 15 }}>{CONT_FLAG[w.cont] || '📡'}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: active ? 'var(--teal)' : 'var(--text)' }}>{w.region}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--blue)' }}>{w.bands.join('/')}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: active ? 'var(--yellow)' : 'var(--dim)' }}>{timeStr}</span>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>{w.note}</span>
          </div>
        )
      })}
    </div>
  )
}
