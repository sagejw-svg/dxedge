import { useState, useEffect } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts'
import { api } from '../api'

function kColor(k) {
  if (k >= 5) return '#ff4d4d'
  if (k >= 4) return '#ff9933'
  if (k >= 3) return '#ffd600'
  return '#7affb2'
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#0e0e0e', border: '1px solid #2a2a2a',
      borderRadius: 6, padding: '10px 14px', fontFamily: 'var(--font-mono)',
    }}>
      <div style={{ fontSize: 10, color: '#666', marginBottom: 6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ fontSize: 11, color: p.color, marginBottom: 2 }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  )
}

export default function SolarHistory() {
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(false)
  const [view, setView]       = useState('sfi') // 'sfi' | 'kp' | 'ssn'

  useEffect(() => {
    setLoading(true)
    api.get('/solar/history?hours=48')
      .then(r => {
        const allReadings = (r.readings || []).map(row => ({
          ...row,
          kColor: kColor(row.k_index),
        }))
        // Build smart time labels - show date when day changes
        const readings = allReadings.map((row, i) => {
          const d = new Date(row.timestamp)
          const prev = i > 0 ? new Date(allReadings[i-1].timestamp) : null
          const dayChanged = prev && d.getUTCDate() !== prev.getUTCDate()
          const timeStr = d.toISOString().slice(11, 16) + 'Z'
          const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
          return {
            ...row,
            time: dayChanged ? dateStr : timeStr,
            date: dateStr,
          }
        })
        setData(readings)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginTop: 14 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase', animation: 'pulse 1.4s infinite' }}>loading solar history...</div>
    </div>
  )

  if (!data.length) return null

  const latest = data[data.length - 1]

  const btnStyle = (active) => ({
    fontFamily: 'var(--font-mono)', fontSize: 10,
    background: active ? '#7affb220' : 'var(--bg2)',
    border: `1px solid ${active ? 'var(--teal)' : 'var(--border)'}`,
    color: active ? 'var(--teal)' : 'var(--muted)',
    padding: '4px 12px', borderRadius: 4, cursor: 'pointer'
  })

  return (
    <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginTop: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase' }}>
            solar history · 48h
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', marginLeft: 12 }}>
            SFI {latest?.sfi} · K={latest?.k_index} · SSN {latest?.ssn}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setView('sfi')} style={btnStyle(view === 'sfi')}>SFI</button>
          <button onClick={() => setView('kp')}  style={btnStyle(view === 'kp')}>K-index</button>
          <button onClick={() => setView('ssn')} style={btnStyle(view === 'ssn')}>SSN</button>
        </div>
      </div>

      {/* Charts */}
      {view === 'sfi' && (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
            <XAxis dataKey="time" tick={{ fill: '#444', fontSize: 9, fontFamily: 'monospace' }} interval="preserveStartEnd" />
            <YAxis tick={{ fill: '#444', fontSize: 9, fontFamily: 'monospace' }} domain={['auto', 'auto']} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={150} stroke="#ffd60033" strokeDasharray="4 4" label={{ value: 'excellent', fill: '#ffd60055', fontSize: 8, fontFamily: 'monospace' }} />
            <ReferenceLine y={120} stroke="#7affb233" strokeDasharray="4 4" label={{ value: 'good', fill: '#7affb255', fontSize: 8, fontFamily: 'monospace' }} />
            <Line type="monotone" dataKey="sfi" stroke="#7affb2" dot={false} strokeWidth={1.5} name="SFI" />
          </LineChart>
        </ResponsiveContainer>
      )}

      {view === 'kp' && (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
            <XAxis dataKey="time" tick={{ fill: '#444', fontSize: 9, fontFamily: 'monospace' }} interval="preserveStartEnd" />
            <YAxis tick={{ fill: '#444', fontSize: 9, fontFamily: 'monospace' }} domain={[0, 9]} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={5} stroke="#ff4d4d55" strokeDasharray="4 4" label={{ value: 'storm', fill: '#ff4d4d88', fontSize: 8, fontFamily: 'monospace' }} />
            <ReferenceLine y={3} stroke="#ffd60033" strokeDasharray="4 4" label={{ value: 'unsettled', fill: '#ffd60055', fontSize: 8, fontFamily: 'monospace' }} />
            <Bar dataKey="k_index" name="K-index" fill="#7affb2"
              cell={data.map((d, i) => <cell key={i} fill={kColor(d.k_index)} />)} />
          </BarChart>
        </ResponsiveContainer>
      )}

      {view === 'ssn' && (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
            <XAxis dataKey="time" tick={{ fill: '#444', fontSize: 9, fontFamily: 'monospace' }} interval="preserveStartEnd" />
            <YAxis tick={{ fill: '#444', fontSize: 9, fontFamily: 'monospace' }} domain={['auto', 'auto']} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={150} stroke="#ffd60033" strokeDasharray="4 4" label={{ value: 'solar max', fill: '#ffd60055', fontSize: 8, fontFamily: 'monospace' }} />
            <Line type="monotone" dataKey="ssn" stroke="#ffd600" dot={false} strokeWidth={1.5} name="SSN" />
          </LineChart>
        </ResponsiveContainer>
      )}

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', marginTop: 8, textAlign: 'right' }}>
        source: NOAA SWPC · UTC
      </div>
    </div>
  )
}
