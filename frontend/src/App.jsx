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
import React from 'react'
import Clocks from './components/Clocks'
import VOACAP from './components/VOACAP'
import HamClock from './components/HamClock'
import CallsignLookup from './components/CallsignLookup'
import Products from './components/Products'
import SolarHistory from './components/SolarHistory'
import GrayLine from './components/GrayLine'
import Activations from './components/Activations'
import ContestCalendar from './components/ContestCalendar'
import Alerts from './components/Alerts'
import Credits from './components/Credits'
import CustomDashboard from './components/CustomDashboard'
import Feedback from './components/Feedback'
import Support from './components/Support'
import ErrorBoundary from './components/ErrorBoundary'
import APRS from './components/APRS'
import Satellites from './components/Satellites'
import HourlySummary from './components/HourlySummary'

const TABS = [
  // Propagation & operating
  { id: 'bands',    label: 'Bands' },
  { id: 'spots',    label: 'DX Spots' },
  { id: 'psk',      label: 'Live RX' },
  { id: 'predict',  label: 'Predict' },
  { id: 'grayline', label: 'Gray Line' },
  // Activity feeds
  { id: 'pota',     label: 'POTA/SOTA' },
  { id: 'contests', label: 'Contests' },
  { id: 'callsign', label: 'Callsign' },
  // Logbook
  { id: 'lotw',     label: 'LoTW' },
  // Monitoring & alerts
  { id: 'sats',     label: 'Satellites' },
  { id: 'aprs',     label: 'APRS' },
  { id: 'alerts',   label: 'Alerts' },
  // Resources
  { id: 'tools',    label: 'Tools' },
  { id: 'windows',  label: 'DX Windows' },
  { id: 'products', label: 'Gear' },
  { id: 'custom',   label: 'Custom' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'support',  label: 'Support' },
  { id: 'credits',  label: 'Credits' },
]

// Neighboring grids to try if primary returns 0 spots
const GRID_NEIGHBORS = {
  CM95: ['CM95', 'CM96', 'CM85', 'DM04', 'DM05', 'CM94', 'CM86'],
}
function getGridsToTry(grid) {
  const g4 = grid.slice(0, 4).toUpperCase()
  return GRID_NEIGHBORS[g4] || [g4]
}


// WebSocket hook for live spots
function useLiveSpots(onSpot) {
  const wsRef = React.useRef(null)
  const reconnectRef = React.useRef(null)

  const connect = React.useCallback(() => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${proto}://${window.location.host}/ws/spots`)

    ws.onopen = () => {
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current)
        reconnectRef.current = null
      }
    }

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        onSpot(msg)
      } catch {}
    }

    ws.onclose = () => {
      reconnectRef.current = setTimeout(connect, 5000)
    }

    ws.onerror = () => ws.close()

    // Keepalive ping every 30s
    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send('ping')
    }, 30000)

    wsRef.current = { ws, ping }
  }, [onSpot])

  React.useEffect(() => {
    connect()
    return () => {
      if (wsRef.current) {
        clearInterval(wsRef.current.ping)
        wsRef.current.ws.close()
      }
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
    }
  }, [connect])
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
  const [rec, setRec] = useState(null)
  const [wsStatus, setWsStatus] = useState('connecting') // connecting|live|reconnecting
  const intervalRef = useRef(null)

  const savePrefs = useCallback((call, gr) => {
    localStorage.setItem('dxedge_call', call)
    localStorage.setItem('dxedge_grid', gr)
  }, [])

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      // Single dashboard call replaces solar + spots + recommendation
      const dash = await api.dashboard(grid)
      if (dash.solar)  setSolar(dash.solar)
      if (dash.spots?.length > 0 && spots.length === 0) setSpots(dash.spots)
      if (dash.recommendation) setRec(dash.recommendation)
      setLastUpdate(new Date())
    } catch (e) {
      // Fallback to individual calls if dashboard fails
      try {
        const solarData = await api.solar()
        setSolar(solarData)
        setLastUpdate(new Date())
      } catch (e2) {
        setError(e2.message)
      }
    } finally {
      setLoading(false)
    }
  }, [grid, spots.length])

  // WebSocket live spot feed
  const handleWsMessage = useCallback((msg) => {
    if (msg.type === 'init') {
      setSpots(msg.data || [])
    } else if (msg.type === 'spot') {
      setSpots(prev => {
        // Deduplicate: remove same callsign+band
        const filtered = prev.filter(
          s => !(s.callsign === msg.data.callsign && s.band === msg.data.band)
        )
        return [msg.data, ...filtered].slice(0, 500)
      })
    }
  }, [])

  useLiveSpots(handleWsMessage)

  const fetchPSK = useCallback(async () => {
    const gridsToTry = getGridsToTry(grid)

    // Fetch all grids in parallel
    const results = await Promise.allSettled(
      gridsToTry.map(g => api.psk(g).then(d => ({ grid: g, spots: d.spots || [] })))
    )

    let allSpots = []
    let gridsWithSpots = []
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.spots.length > 0) {
        allSpots = [...allSpots, ...r.value.spots]
        gridsWithSpots.push(r.value.grid)
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
        loading={loading} lastUpdate={lastUpdate} rec={rec} wsStatus={wsStatus}
        onRefresh={() => fetchData()} matrixLoaded={!!matrix}
      />

      <Clocks />

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
          {/* Grouped tab bar */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {TAB_GROUPS.map(group => (
                <div key={group.label} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--dim)',
                    letterSpacing: 2, textTransform: 'uppercase', paddingLeft: 2 }}>
                    {group.label}
                  </span>
                  <div style={{ display: 'flex', gap: 3, background: 'var(--bg1)',
                    border: '1px solid var(--border)', borderRadius: 7, padding: '3px' }}>
                    {group.tabs.map(t => {
                      const isActive = tab === t.id
                      return (
                        <button key={t.id} onClick={() => setTab(t.id)} title={t.label} style={{
                          fontFamily: 'var(--font-mono)', fontSize: 11, flexShrink: 0,
                          background: isActive ? '#7affb220' : 'transparent',
                          border: `1px solid ${isActive ? '#7affb244' : 'transparent'}`,
                          color: isActive ? 'var(--teal)' : 'var(--muted)',
                          padding: '5px 10px', borderRadius: 5, cursor: 'pointer',
                          whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                          <span style={{ fontSize: 12 }}>{t.icon}</span>
                          <span style={{ display: window.innerWidth < 500 ? 'none' : undefined }}>
                            {t.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {tab === 'bands'   && <><Bands conditions={solar.band_conditions} /><SolarHistory /><HourlySummary grid={grid} /></>}
          {tab === 'spots'   && <Spots spots={displayedSpots} needsMatrix={matrix} />}
          {tab === 'psk'     && <PSK spots={pskSpots} grid={grid} gridsUsed={pskGridsUsed} onRefresh={fetchPSK} conditions={solar.band_conditions} />}
          {tab === 'predict' && <VOACAP grid={grid} />}
          {tab === 'grayline' && <GrayLine grid={grid} />}
          {tab === 'pota'     && <Activations />}
          {tab === 'contests' && <ContestCalendar />}
          {tab === 'sats'     && <Satellites grid={grid} />}
          {tab === 'aprs'     && <APRS grid={grid} callsign={callsign} />}
          {tab === 'alerts'   && <Alerts callsign={callsign} />}
          {tab === 'custom'   && <CustomDashboard grid={grid} callsign={callsign} solar={solar} spots={displayedSpots} pskSpots={pskSpots} matrix={matrix} />}
          {tab === 'feedback' && <Feedback />}
          {tab === 'support'  && <Support />}
          {tab === 'credits'  && <Credits />}
          {tab === 'windows' && <DXWindows />}
          {tab === 'lotw'    && <LoTW callsign={callsign} onSuccess={handleLoTWSuccess} matrixLoaded={!!matrix} />}
          {tab === 'tools'   && <HamClock />}
          {tab === 'callsign' && <CallsignLookup callsign={callsign} />}
          {tab === 'products' && <Products />}
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
