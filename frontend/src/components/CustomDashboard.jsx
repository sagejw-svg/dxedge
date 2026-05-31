import { useState, useCallback, useRef } from 'react'
import ErrorBoundary from './ErrorBoundary'
import Solar from './Solar'
import Bands from './Bands'
import Clocks from './Clocks'
import SolarHistory from './SolarHistory'
import HourlySummary from './HourlySummary'
import Spots from './Spots'
import PSK from './PSK'
import VOACAP from './VOACAP'
import GrayLine from './GrayLine'
import Activations from './Activations'
import ContestCalendar from './ContestCalendar'
import Satellites from './Satellites'

// Widget registry - all available widgets
const WIDGET_REGISTRY = [
  { id: 'clocks',     label: 'World Clocks',         icon: '🕐', desc: 'UTC + 5 selectable timezones' },
  { id: 'solar',      label: 'Solar Conditions',     icon: '☀️', desc: 'SFI, K-index, band conditions' },
  { id: 'history',    label: 'Solar History',        icon: '📈', desc: '48h SFI/K-index trend charts' },
  { id: 'hourly',     label: '24h Propagation',      icon: '🔲', desc: 'Hourly heat map by band' },
  { id: 'spots',      label: 'DX Spots',             icon: '📡', desc: 'Live DX cluster spots' },
  { id: 'psk',        label: 'Live RX (PSKReporter)',icon: '📻', desc: 'FT8/FT4 reception reports' },
  { id: 'predict',    label: 'VOACAP Predict',       icon: '📶', desc: 'Band opening heat map' },
  { id: 'grayline',   label: 'Gray Line Map',        icon: '🌍', desc: 'Live day/night terminator' },
  { id: 'pota',       label: 'POTA/SOTA',            icon: '⛰️', desc: 'Live activations' },
  { id: 'contests',   label: 'Contest Calendar',     icon: '🏆', desc: 'Upcoming and active contests' },
  { id: 'satellites', label: 'Satellites',           icon: '🛰️', desc: 'Ham satellite passes & map' },
]

const DEFAULT_LAYOUT = ['clocks','solar','spots','grayline','psk','history']

function loadLayout() {
  try {
    const saved = localStorage.getItem('dxedge_custom_layout')
    if (saved) {
      const parsed = JSON.parse(saved)
      // Validate - only keep valid widget IDs
      const valid = WIDGET_REGISTRY.map(w => w.id)
      return parsed.filter(id => valid.includes(id))
    }
  } catch {}
  return DEFAULT_LAYOUT
}

function saveLayout(layout) {
  localStorage.setItem('dxedge_custom_layout', JSON.stringify(layout))
}

function WidgetRenderer({ id, grid, callsign, solar, spots, pskSpots, matrix }) {
  switch(id) {
    case 'clocks':     return <Clocks />
    case 'solar':      return solar ? <><Solar data={solar} /><Bands conditions={solar.band_conditions} /></> : null
    case 'history':    return <SolarHistory />
    case 'hourly':     return <HourlySummary grid={grid} />
    case 'spots':      return <Spots spots={spots} needsMatrix={matrix} />
    case 'psk':        return <PSK spots={pskSpots} grid={grid} gridsUsed={[]} onRefresh={() => {}} conditions={solar?.band_conditions} />
    case 'predict':    return <VOACAP grid={grid} />
    case 'grayline':   return <GrayLine grid={grid} />
    case 'pota':       return <Activations />
    case 'contests':   return <ContestCalendar />
    case 'satellites': return <Satellites grid={grid} />
    default:           return null
  }
}

export default function CustomDashboard({ grid, callsign, solar, spots, pskSpots, matrix }) {
  const [layout, setLayout] = useState(loadLayout)
  const [editing, setEditing] = useState(false)
  const [cols, setCols] = useState(() => {
    const saved = localStorage.getItem('dxedge_custom_cols')
    return saved ? parseInt(saved) : 1
  })
  const dragItem = useRef(null)
  const dragOver = useRef(null)

  const updateLayout = useCallback((newLayout) => {
    setLayout(newLayout)
    saveLayout(newLayout)
  }, [])

  const updateCols = (n) => {
    setCols(n)
    localStorage.setItem('dxedge_custom_cols', String(n))
  }

  const toggleWidget = (id) => {
    if (layout.includes(id)) {
      updateLayout(layout.filter(w => w !== id))
    } else {
      updateLayout([...layout, id])
    }
  }

  const resetLayout = () => {
    updateLayout(DEFAULT_LAYOUT)
    setCols(1)
    localStorage.setItem('dxedge_custom_cols', '1')
  }

  // Drag and drop handlers
  const handleDragStart = (e, idx) => {
    dragItem.current = idx
    e.dataTransfer.effectAllowed = 'move'
  }
  const handleDragEnter = (e, idx) => {
    dragOver.current = idx
    e.preventDefault()
  }
  const handleDrop = (e) => {
    e.preventDefault()
    if (dragItem.current === null || dragOver.current === null) return
    if (dragItem.current === dragOver.current) return
    const next = [...layout]
    const [moved] = next.splice(dragItem.current, 1)
    next.splice(dragOver.current, 0, moved)
    updateLayout(next)
    dragItem.current = null
    dragOver.current = null
  }

  const moveUp   = (idx) => { if (idx === 0) return; const n = [...layout]; [n[idx-1], n[idx]] = [n[idx], n[idx-1]]; updateLayout(n) }
  const moveDown = (idx) => { if (idx === layout.length-1) return; const n = [...layout]; [n[idx], n[idx+1]] = [n[idx+1], n[idx]]; updateLayout(n) }

  const activeWidgets = layout.map(id => WIDGET_REGISTRY.find(w => w.id === id)).filter(Boolean)
  const inactiveWidgets = WIDGET_REGISTRY.filter(w => !layout.includes(w.id))

  const btnStyle = (active) => ({
    fontFamily: 'var(--font-mono)', fontSize: 10,
    background: active ? '#7affb220' : 'var(--bg1)',
    border: `1px solid ${active ? 'var(--teal)' : 'var(--border)'}`,
    color: active ? 'var(--teal)' : 'var(--muted)',
    padding: '5px 12px', borderRadius: 4, cursor: 'pointer'
  })

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => setEditing(v => !v)} style={btnStyle(editing)}>
          {editing ? '✓ done editing' : '⚙ customize'}
        </button>
        {editing && (
          <>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)' }}>columns:</span>
            {[1, 2, 3].map(n => (
              <button key={n} onClick={() => updateCols(n)} style={btnStyle(cols === n)}>{n}</button>
            ))}
            <button onClick={resetLayout} style={{
              fontFamily: 'var(--font-mono)', fontSize: 10,
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--dim)', padding: '5px 12px', borderRadius: 4, cursor: 'pointer'
            }}>reset</button>
          </>
        )}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', marginLeft: 'auto' }}>
          {layout.length} widget{layout.length !== 1 ? 's' : ''} · saved automatically
        </span>
      </div>

      {/* Widget picker (edit mode) */}
      {editing && (
        <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12 }}>
            available widgets — drag cards below to reorder
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {WIDGET_REGISTRY.map(w => {
              const active = layout.includes(w.id)
              return (
                <button key={w.id} onClick={() => toggleWidget(w.id)} style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11,
                  background: active ? '#7affb220' : 'var(--bg2)',
                  border: `1px solid ${active ? 'var(--teal)' : 'var(--border)'}`,
                  color: active ? 'var(--teal)' : 'var(--muted)',
                  padding: '7px 12px', borderRadius: 6, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6
                }}>
                  <span>{w.icon}</span>
                  <span>{w.label}</span>
                  {active ? <span style={{ color: '#7affb266' }}>✓</span> : <span style={{ color: '#444' }}>+</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Active widget order list (edit mode) */}
      {editing && layout.length > 0 && (
        <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>
            active layout — drag to reorder
          </div>
          <div onDragOver={e => e.preventDefault()} onDrop={handleDrop}>
            {activeWidgets.map((w, i) => (
              <div key={w.id}
                draggable
                onDragStart={e => handleDragStart(e, i)}
                onDragEnter={e => handleDragEnter(e, i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 6, marginBottom: 4,
                  background: 'var(--bg2)', border: '1px solid var(--border)',
                  cursor: 'grab', userSelect: 'none'
                }}
              >
                <span style={{ color: 'var(--dim)', fontSize: 12 }}>⠿</span>
                <span style={{ fontSize: 16 }}>{w.icon}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', flex: 1 }}>{w.label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--dim)', fontStyle: 'italic' }}>{w.desc}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => moveUp(i)} disabled={i === 0} style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10, background: 'transparent',
                    border: '1px solid var(--border)', color: 'var(--muted)',
                    padding: '2px 6px', borderRadius: 3, cursor: i === 0 ? 'default' : 'pointer',
                    opacity: i === 0 ? 0.3 : 1
                  }}>↑</button>
                  <button onClick={() => moveDown(i)} disabled={i === layout.length-1} style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10, background: 'transparent',
                    border: '1px solid var(--border)', color: 'var(--muted)',
                    padding: '2px 6px', borderRadius: 3, cursor: i === layout.length-1 ? 'default' : 'pointer',
                    opacity: i === layout.length-1 ? 0.3 : 1
                  }}>↓</button>
                  <button onClick={() => toggleWidget(w.id)} style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10, background: 'transparent',
                    border: '1px solid #ff4d4d33', color: '#ff4d4d',
                    padding: '2px 6px', borderRadius: 3, cursor: 'pointer'
                  }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rendered widgets */}
      {layout.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--dim)', marginBottom: 10 }}>no widgets selected</div>
          <button onClick={() => setEditing(true)} style={btnStyle(false)}>⚙ add widgets</button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 16,
        }}>
          {activeWidgets.map((w, i) => (
            <div key={w.id}
              draggable={editing}
              onDragStart={e => editing && handleDragStart(e, i)}
              onDragEnter={e => editing && handleDragEnter(e, i)}
              onDrop={editing ? handleDrop : undefined}
              onDragOver={e => e.preventDefault()}
              style={{
                cursor: editing ? 'grab' : 'default',
                outline: editing ? '2px dashed #333' : 'none',
                outlineOffset: 4, borderRadius: 4,
              }}
            >
              {editing && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', marginBottom: 6, display: 'flex', justifyContent: 'space-between', letterSpacing: 1 }}>
                  <span>{w.icon} {w.label}</span>
                  <button onClick={() => toggleWidget(w.id)} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'transparent', border: 'none', color: '#ff4d4d', cursor: 'pointer' }}>remove</button>
                </div>
              )}
              <ErrorBoundary label={w.label}>
                <WidgetRenderer
                  id={w.id} grid={grid} callsign={callsign}
                  solar={solar} spots={spots} pskSpots={pskSpots} matrix={matrix}
                />
              </ErrorBoundary>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
