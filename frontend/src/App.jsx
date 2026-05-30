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
import Clock from './components/Clock'
import VOACAP from './components/VOACAP'
import HourlySummary from './components/HourlySummary'

const TABS = [
  { id: 'bands',   label: 'Bands' },
  { id: 'spots',   label: 'DX Spots' },
  { id: 'psk',     label: 'Live RX' },
  { id: 'predict', label: 'Predict' },
  { id: 'windows', label: 'DX Windows' },
  { id: 'lotw',    label: 'LoTW' },
]

// Neighboring grids to try if primary returns 0 spots
const GRID_NEIGHBORS = {
  CM95: ['CM95', 'CM96', 'CM85', 'DM04', 'DM05', 'CM94', 'CM86'],
}
function getGridsToTry(grid) {
  const g4 = grid.slice(0, 4).toUpperCase()
  return GRID_NEIGHBORS[g4] || [g4]
}

export default function App() {
  const [tab, setTab] = useState('bands')
  const [solar, setSolar] = useState(null)
  const [spots, setSpots] = useState([])
  const [pskSpots, setPskSpots] = useState([])
  const [pskGridsUsed, setPskGridsUsed] = useState([])
  const [loading, setLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [error, setError] = useState(null)
  const [grid, setGrid] = useState(() => localStorage.getItem('dxedge_grid') || 'CM95')
  const [callsign, setCallsign] = useState(() => localStorage.getItem('dxedge_call') || '')
  const [matrix, setMatrix] = useState(null)
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
        api.spots(),
      ])
      setSolar(solarData)
      setSpots(spotsData.spots || [])
      setLastUpdate(new Date())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchPSK = useCallback(async () => {
    const gridsToTry = getGridsToTry(grid)
    let allSpots = []
    let gridsWithSpots = []

    for (const g of gridsToTry) {
      try {
        const data = await api.psk(g)
        const s = data.spots || []
        if (s.length > 0) {
          allSpots = [...allSpots, ...s]
          gridsWithSpots.push(g)
          // If primary grid has spots, stop. Otherwise keep expanding.
          if (g === gridsToTry[0] && s.length > 5) break
          if (allSpots.length > 50) break
        }
      } catch (e) {
        console.warn(`PSK fetch ${g} failed:`, e.message)
      }
    }

    // Deduplicate by callsign+band keeping best SNR
    const seen = {}
    for (const s of allSpots) {
      const key = `${s.callsign}-${s.band}`
      if (!seen[key] || s.snr > seen[key].snr) seen[key] = s
    }
    setPskSpots(Object.values(seen).sort((a, b) => b.snr - a.snr))
    setPskGridsUsed(gridsWithSpots)
  }, [grid])

  useEffect(() => { fetchData() }, [])
  useEffect(() => {
    intervalRef.current = setInterval(() => fetchData(true), 120000)
    return () => clearInterval(intervalRef.current)
  }, [fetchData])
  useEffect(() => { if (tab === 'psk') fetchPSK() }, [tab, fetchPSK])

  // Auto-refresh PSK when grid changes
  useEffect(() => {
    if (tab === 'psk') fetchPSK()
  }, [grid])

  const handleLoTWSuccess = useCallback((adif) => {
    const qsos = parseADIF(adif)
    const m = buildNeedsMatrix(qsos)
    setMatrix(m)
  }, [])

  const displayedSpots = matrix ? getNeededSpots(spots, matrix) : spots

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 1000, margin: '0 auto', padding: '20px 20px' }}>

      <Header
        callsign={callsign} grid={grid}
        onCallsign={(v) => { setCallsign(v); savePrefs(v, grid) }}
        onGrid={(v) => { setGrid(v); savePrefs(callsign, v) }}
        loading={loading} lastUpdate={lastUpdate}
        onRefresh={() => fetchData()} matrixLoaded={!!matrix}
      />

      <Clock grid={grid} />

      {solar && <Solar data={solar} />}

      {error && (
        <div style={{ background: '#ff6b6b11', border: '1px solid #ff6b6b33', borderRadius: 8, padding: 14, marginBottom: 16 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--red)' }}>{error}</span>
        </div>
      )}

      {!solar && !loading && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <button onClick={() => fetchData()} style={{
            fontFamily: 'var(--font-mono)', fontSize: 14,
            background: 'var(--bg1)', border: '1px solid #7affb244',
            color: 'var(--teal)', padding: '14px 32px', borderRadius: 8
          }}>↺ load propagation data</button>
        </div>
      )}

      {solar && (
        <>
          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                fontFamily: 'var(--font-mono)', fontSize: 12, flex: '0 0 auto',
                background: tab === t.id ? 'var(--bg2)' : 'transparent',
                border: `1px solid ${tab === t.id ? '#7affb244' : 'var(--border)'}`,
                color: tab === t.id ? 'var(--teal)' : 'var(--muted)',
                padding: '8px 18px', borderRadius: 6,
              }}>{t.label}</button>
            ))}
          </div>

          {tab === 'bands'   && <><Bands conditions={solar.band_conditions} /><HourlySummary grid={grid} /></>}
          {tab === 'spots'   && <Spots spots={displayedSpots} needsMatrix={matrix} />}
          {tab === 'psk'     && <PSK spots={pskSpots} grid={grid} gridsUsed={pskGridsUsed} onRefresh={fetchPSK} conditions={solar.band_conditions} />}
          {tab === 'predict' && <VOACAP grid={grid} />}
          {tab === 'windows' && <DXWindows />}
          {tab === 'lotw'    && <LoTW callsign={callsign} onSuccess={handleLoTWSuccess} matrixLoaded={!!matrix} />}
        </>
      )}

      <footer style={{ marginTop: 28, display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {[
          ['pskreporter', 'https://pskreporter.info'],
          ['dx summit',   'https://www.dxsummit.fi'],
          ['hamqsl',      'https://hamqsl.com/solar.html'],
          ['voacap',      'https://voacap.com/hf/'],
          ['ng3k dxped',  'https://ng3k.com/misc/adxo.html'],
          ['reversebeacon','https://www.reversebeacon.net'],
        ].map(([l, u]) => (
          <a key={l} href={u} target="_blank" rel="noreferrer" style={{
            fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--dim)',
            border: '1px solid var(--border)', padding: '5px 12px', borderRadius: 5
          }}>{l} ↗</a>
        ))}
      </footer>
    </div>
  )
}
