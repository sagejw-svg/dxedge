import { useState, useCallback } from 'react'
import { api } from '../api'

const BAND_COLOR = {
  '160m':'#ff9933','80m':'#ff9933','40m':'#ffd600',
  '30m':'#ffd600','20m':'#7affb2','17m':'#7affb2',
  '15m':'#00ff9d','12m':'#00ff9d','10m':'#00ff9d','6m':'#a78bfa'
}

function snrColor(snr) {
  if (snr >= 0)   return '#00ff9d'
  if (snr >= -10) return '#7affb2'
  if (snr >= -18) return '#ffd600'
  return '#888'
}

function SpotRow({ spot, type }) {
  const primary   = type === 'heard_by' ? spot.receiver : spot.callsign
  const secondary = type === 'heard_by'
    ? (spot.receiver_grid || '')
    : (spot.sender_grid   || '')
  const label = type === 'heard_by' ? 'heard by' : 'heard'

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 60px 64px 52px',
      alignItems: 'center', gap: 10,
      padding: '7px 14px',
      borderBottom: '1px solid var(--border)',
    }}>
      <div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
          {primary}
        </span>
        {secondary && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--dim)', marginLeft: 8 }}>
            {secondary}
          </span>
        )}
        {type === 'heard_by' && spot.country && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', marginLeft: 8, fontStyle: 'italic' }}>
            {spot.flag} {spot.country}
          </span>
        )}
      </div>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 11,
        color: snrColor(spot.snr), textAlign: 'right', fontWeight: 700
      }}>
        {spot.snr > 0 ? '+' : ''}{spot.snr} dB
      </span>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 11,
        color: BAND_COLOR[spot.band] || 'var(--muted)',
        background: `${BAND_COLOR[spot.band] || '#888'}15`,
        padding: '2px 6px', borderRadius: 3, textAlign: 'center'
      }}>
        {spot.band}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>
        {spot.mode}
      </span>
    </div>
  )
}

function Section({ title, spots, type, emptyMsg }) {
  return (
    <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--dim)', letterSpacing: 2, textTransform: 'uppercase' }}>
          {title}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: spots.length > 0 ? 'var(--teal)' : 'var(--dim)' }}>
          {spots.length} station{spots.length !== 1 ? 's' : ''}
        </span>
      </div>
      {/* Column headers */}
      {spots.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 64px 52px', gap: 10, padding: '5px 14px', borderBottom: '1px solid var(--border)' }}>
          {['station','snr','band','mode'].map(h => (
            <span key={h} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 2, textTransform: 'uppercase', textAlign: h === 'snr' ? 'right' : 'left' }}>{h}</span>
          ))}
        </div>
      )}
      {spots.length === 0 ? (
        <div style={{ padding: '28px 14px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--dim)', fontStyle: 'italic' }}>
          {emptyMsg}
        </div>
      ) : (
        spots.map((s, i) => <SpotRow key={i} spot={s} type={type} />)
      )}
    </div>
  )
}

export default function CallsignLookup({ callsign: defaultCall }) {
  const [inputCall, setInputCall] = useState(defaultCall || '')
  const [hours, setHours]         = useState(2)
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [searched, setSearched]   = useState('')

  const doLookup = useCallback(async (call, h) => {
    const c = (call || inputCall).trim().toUpperCase()
    if (!c || c.length < 3) return
    setLoading(true)
    setError(null)
    setSearched(c)
    try {
      const result = await api.get(`/callsign?call=${c}&hours=${h || hours}`)
      setData(result)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [inputCall, hours])

  const handleKey = (e) => {
    if (e.key === 'Enter') doLookup()
  }

  const inputStyle = {
    fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700,
    background: 'var(--bg1)', border: '1px solid var(--border)',
    color: 'var(--text)', padding: '8px 12px', borderRadius: 6,
    outline: 'none', width: 120, textTransform: 'uppercase'
  }

  const selectStyle = {
    fontFamily: 'var(--font-mono)', fontSize: 13,
    background: 'var(--bg1)', border: '1px solid var(--border)',
    color: 'var(--text)', padding: '8px 10px', borderRadius: 6,
    outline: 'none', cursor: 'pointer'
  }

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: 2, textTransform: 'uppercase' }}>callsign</label>
          <input
            value={inputCall}
            onChange={e => setInputCall(e.target.value.toUpperCase())}
            onKeyDown={handleKey}
            placeholder="K6WRJ"
            maxLength={12}
            style={inputStyle}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: 2, textTransform: 'uppercase' }}>time window</label>
          <select value={hours} onChange={e => setHours(Number(e.target.value))} style={selectStyle}>
            <option value={1}>last 1 hour</option>
            <option value={2}>last 2 hours</option>
            <option value={4}>last 4 hours</option>
            <option value={6}>last 6 hours</option>
            <option value={12}>last 12 hours</option>
          </select>
        </div>
        <button onClick={() => doLookup()} disabled={loading || !inputCall} style={{
          fontFamily: 'var(--font-mono)', fontSize: 13,
          background: 'var(--bg1)', border: `1px solid ${loading ? 'var(--border)' : '#7affb244'}`,
          color: loading ? 'var(--dim)' : 'var(--teal)',
          padding: '8px 18px', borderRadius: 6,
          cursor: loading || !inputCall ? 'default' : 'pointer',
          alignSelf: 'flex-end'
        }}>
          {loading ? 'looking up...' : 'look up'}
        </button>

        {/* Quick buttons for common lookups */}
        {defaultCall && defaultCall !== inputCall && (
          <button onClick={() => { setInputCall(defaultCall); doLookup(defaultCall) }} style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            background: 'transparent', border: '1px solid var(--border)',
            color: 'var(--muted)', padding: '8px 12px', borderRadius: 6,
            cursor: 'pointer', alignSelf: 'flex-end'
          }}>
            my call ({defaultCall})
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#ff6b6b11', border: '1px solid #ff6b6b33', borderRadius: 8, padding: 12, marginBottom: 14 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--red)' }}>{error}</span>
        </div>
      )}

      {/* Results */}
      {data && !loading && (
        <>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 14 }}>
            PSKReporter results for {searched} · last {data.hours}h
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Section
              title={`Heard ${searched} (${data.heard_by_count})`}
              spots={data.heard_by}
              type="heard_by"
              emptyMsg={`No stations reported hearing ${searched} in the last ${data.hours}h`}
            />
            <Section
              title={`${searched} heard (${data.hearing_count})`}
              spots={data.hearing}
              type="hearing"
              emptyMsg={`No spots from ${searched} reported in the last ${data.hours}h`}
            />
          </div>

          <p style={{ marginTop: 14, fontSize: 12, color: 'var(--dim)', fontStyle: 'italic' }}>
            Data from PSKReporter · FT8/FT4/digital modes only · cached 5 min
          </p>
        </>
      )}

      {!data && !loading && !error && (
        <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10, padding: 40, textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--dim)', marginBottom: 8 }}>
            enter a callsign to see recent PSKReporter activity
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--dim)', fontStyle: 'italic' }}>
            shows who heard you and what you've been hearing · digital modes only
          </div>
        </div>
      )}
    </div>
  )
}
