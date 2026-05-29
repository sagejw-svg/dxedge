import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from './api'
import { parseADIF, buildNeedsMatrix, getNeededSpots } from './adif'
import Solar from './components/Solar'
import Bands from './components/Bands'
import Spots from './components/Spots'
import PSK from './components/PSK'
import DXWindows from './components/DXWindows'
import LoTW from './components/LoTW'
import Header from './components/Header'

const TABS = [
  { id: 'bands',   label: 'Bands' },
  { id: 'spots',   label: 'DX Spots' },
  { id: 'psk',     label: 'Live RX' },
  { id: 'windows', label: 'DX Windows' },
  { id: 'lotw',    label: 'LoTW' },
]

export default function App() {
  const [tab, setTab] = useState('bands')
  const [solar, setSolar] = useState(null)
  const [spots, setSpots] = useState([])
  const [pskSpots, setPskSpots] = useState([])
  const [loading, setLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [error, setError] = useState(null)
  const [grid, setGrid] = useState(() => localStorage.getItem('dxedge_grid') || 'CM95')
  const [callsign, setCallsign] = useState(() => localStorage.getItem('dxedge_call') || '')
  const [matrix, setMatrix] = useState(null)
  const [spotFilter, setSpotFilter] = useState({ band: '', mode: '' })
  const intervalRef = useRef(null)

  const savePrefs = useCallback((call, gr) => {
    localStorage.setItem('dxedge_call', call)
    localStorage.setItem('dxedge_grid', gr)
  }, [])

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const [solarData, spotsData] = await Promise.all([
        api.solar(),
        api.spots(spotFilter.band, spotFilter.mode),
      ])
      setSolar(solarData)
      setSpots(spotsData.spots || [])
      setLastUpdate(new Date())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [spotFilter])

  const fetchPSK = useCallback(async () => {
    try {
      const data = await api.psk(grid)
      setPskSpots(data.spots || [])
    } catch (e) {
      console.warn('PSK fetch failed:', e.message)
    }
  }, [grid])

  // Initial load
  useEffect(() => { fetchData() }, [])

  // Auto-refresh every 2 minutes
  useEffect(() => {
    intervalRef.current = setInterval(() => fetchData(true), 120000)
    return () => clearInterval(intervalRef.current)
  }, [fetchData])

  // Fetch PSK when tab switches to psk
  useEffect(() => {
    if (tab === 'psk') fetchPSK()
  }, [tab, fetchPSK])

  const handleLoTWSuccess = useCallback((adif) => {
    const qsos = parseADIF(adif)
    const m = buildNeedsMatrix(qsos)
    setMatrix(m)
    localStorage.setItem('dxedge_matrix_time', new Date().toISOString())
  }, [])

  const displayedSpots = matrix ? getNeededSpots(spots, matrix) : spots

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 800, margin: '0 auto', padding: '16px 14px' }}>

      <Header
        callsign={callsign}
        grid={grid}
        onCallsign={(v) => { setCallsign(v); savePrefs(v, grid) }}
        onGrid={(v) => { setGrid(v); savePrefs(callsign, v) }}
        loading={loading}
        lastUpdate={lastUpdate}
        onRefresh={() => fetchData()}
        matrixLoaded={!!matrix}
      />

      {solar && <Solar data={solar} />}

      {error && (
        <div style={{ background: '#ff6b6b11', border: '1px solid #ff6b6b33', borderRadius: 8, padding: 12, marginBottom: 14 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--red)' }}>{error}</span>
        </div>
      )}

      {!solar && !loading && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <button onClick={() => fetchData()} style={{
            fontFamily: 'var(--font-mono)', fontSize: 13,
            background: 'var(--bg1)', border: '1px solid #7affb244',
            color: 'var(--teal)', padding: '14px 32px', borderRadius: 8
          }}>
            ↺ load propagation data
          </button>
        </div>
      )}

      {solar && (
        <>
          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 14, overflowX: 'auto' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                fontFamily: 'var(--font-mono)', fontSize: 11, flex: '0 0 auto',
                background: tab === t.id ? 'var(--bg2)' : 'transparent',
                border: `1px solid ${tab === t.id ? '#7affb244' : 'var(--border)'}`,
                color: tab === t.id ? 'var(--teal)' : 'var(--muted)',
                padding: '7px 14px', borderRadius: 6,
              }}>{t.label}</button>
            ))}
          </div>

          {tab === 'bands'   && <Bands conditions={solar.band_conditions} />}
          {tab === 'spots'   && <Spots spots={displayedSpots} filter={spotFilter} onFilter={setSpotFilter} needsMatrix={matrix} />}
          {tab === 'psk'     && <PSK spots={pskSpots} grid={grid} onRefresh={fetchPSK} conditions={solar.band_conditions} />}
          {tab === 'windows' && <DXWindows />}
          {tab === 'lotw'    && <LoTW callsign={callsign} onSuccess={handleLoTWSuccess} matrixLoaded={!!matrix} />}
        </>
      )}

      <footer style={{ marginTop: 24, display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {[
          ['pskreporter', 'https://pskreporter.info'],
          ['dxheat', 'https://dxheat.com'],
          ['hamqsl', 'https://hamqsl.com/solar.html'],
          ['voacap', 'https://voacap.com/hf/'],
          ['ng3k dxped', 'https://ng3k.com/misc/adxo.html'],
        ].map(([l, u]) => (
          <a key={l} href={u} target="_blank" rel="noreferrer" style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--dim)',
            border: '1px solid var(--border)', padding: '4px 10px', borderRadius: 5
          }}>{l} ↗</a>
        ))}
      </footer>
    </div>
  )
}
