export default function Header({ callsign, grid, onCallsign, onGrid, loading, lastUpdate, onRefresh, matrixLoaded }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 3 }}>
            propagation intel
          </div>
          <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: '#eee', letterSpacing: -0.5 }}>
            DXEdge<span style={{ color: 'var(--dim)', fontSize: 13, marginLeft: 6, fontWeight: 400 }}>.com</span>
          </h1>
          {matrixLoaded && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--teal)', marginTop: 2 }}>
              LoTW needs matrix loaded
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <button onClick={onRefresh} disabled={loading} style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            background: 'var(--bg1)', border: `1px solid ${loading ? 'var(--border)' : '#7affb244'}`,
            color: loading ? 'var(--dim)' : 'var(--teal)',
            padding: '8px 14px', borderRadius: 6
          }}>
            {loading ? 'fetching...' : '↺ refresh'}
          </button>
          {lastUpdate && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)' }}>
              {lastUpdate.toISOString().slice(11, 16)}Z
            </span>
          )}
        </div>
      </div>

      {/* Callsign + Grid inputs */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: 2, textTransform: 'uppercase' }}>callsign</label>
          <input
            value={callsign}
            onChange={e => onCallsign(e.target.value.toUpperCase())}
            placeholder="K6WRJ"
            maxLength={10}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
              background: 'var(--bg1)', border: '1px solid var(--border)',
              color: 'var(--text)', padding: '6px 10px', borderRadius: 6,
              width: 110, outline: 'none'
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: 2, textTransform: 'uppercase' }}>grid <span style={{ color: 'var(--dim)', fontSize: 8 }}>(for live rx)</span></label>
          <input
            value={grid}
            onChange={e => onGrid(e.target.value.toUpperCase())}
            placeholder="CM95"
            maxLength={6}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
              background: 'var(--bg1)', border: '1px solid var(--border)',
              color: 'var(--text)', padding: '6px 10px', borderRadius: 6,
              width: 90, outline: 'none'
            }}
          />
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', alignSelf: 'flex-end', paddingBottom: 8 }}>
          stored in your browser only
        </div>
      </div>
    </div>
  )
}
