function Gauge({ label, value, max, color }) {
  const pct = Math.min(100, Math.max(0, ((value || 0) / max) * 100))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: 2, textTransform: 'uppercase' }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color, fontWeight: 700 }}>{value ?? '?'}</span>
      </div>
      <div style={{ height: 3, background: 'var(--bg)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.8s' }} />
      </div>
    </div>
  )
}

export default function Solar({ data }) {
  const sfi = data.sfi
  const k = data.k_index
  const sfiColor = sfi >= 150 ? 'var(--green)' : sfi >= 120 ? 'var(--teal)' : sfi >= 90 ? 'var(--yellow)' : 'var(--red)'
  const kColor = k <= 1 ? 'var(--green)' : k <= 3 ? 'var(--yellow)' : 'var(--red)'
  const aColor = data.a_index <= 7 ? 'var(--green)' : data.a_index <= 20 ? 'var(--yellow)' : 'var(--red)'

  return (
    <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase' }}>solar indices</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)' }}>{data.source}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14 }}>
        <Gauge label="SFI"   value={sfi}          max={300} color={sfiColor} />
        <Gauge label="K-idx" value={k}            max={9}   color={kColor} />
        <Gauge label="A-idx" value={data.a_index} max={100} color={aColor} />
        <Gauge label="SSN"   value={data.ssn}     max={300} color="var(--blue)" />
      </div>
      {data.x_class && (
        <div style={{ marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--red)' }}>
          ⚡ {data.x_class}-class solar flare activity detected
        </div>
      )}
      {data.summary && (
        <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', lineHeight: 1.6 }}>{data.summary}</p>
      )}
    </div>
  )
}
