import { useState, useEffect } from 'react'
import { api } from '../api'

const ALERT_TYPES = [
  {
    id: '10m_open',
    label: '10m Band Opening',
    desc: 'When SFI ≥ 150 and K-index ≤ 2 — prime 10m conditions',
    icon: '📻',
    color: 'var(--green)',
  },
  {
    id: 'k_storm',
    label: 'Geomagnetic Storm',
    desc: 'When K-index reaches 5+ — HF degradation warning',
    icon: '⚡',
    color: 'var(--red)',
  },
  {
    id: 'sfi_drop',
    label: 'Solar Flux Drop',
    desc: 'When SFI drops significantly — conditions deteriorating',
    icon: '📉',
    color: 'var(--yellow)',
  },
]

export default function Alerts({ callsign: defaultCall }) {
  const [call, setCall]       = useState(defaultCall || '')
  const [topic, setTopic]     = useState('')
  const [alerts, setAlerts]   = useState(['10m_open', 'k_storm'])
  const [status, setStatus]   = useState(null) // null | 'subscribed' | 'error'
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  // Auto-generate topic from callsign
  useEffect(() => {
    if (call) setTopic(`dxedge-${call.toLowerCase()}`)
  }, [call])

  const toggle = (id) => {
    setAlerts(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id])
  }

  const subscribe = async () => {
    try {
      await api.post('/alerts/subscribe', { callsign: call, topic, alerts })
      setStatus('subscribed')
    } catch(e) {
      setStatus('error')
    }
  }

  const unsubscribe = async () => {
    try {
      await fetch(`/api/alerts/subscribe/${encodeURIComponent(topic)}`, { method: 'DELETE' })
      setStatus(null)
    } catch {}
  }

  const sendTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const r = await api.get(`/alerts/test/${encodeURIComponent(topic)}`)
      setTestResult(r.sent ? 'sent' : 'failed')
    } catch {
      setTestResult('failed')
    } finally {
      setTesting(false)
    }
  }

  const ntfySubscribeUrl = `https://ntfy.sh/${topic}`
  const ntfyAppUrl = `ntfy://${topic}`

  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 16 }}>
        push alerts via ntfy.sh
      </div>

      {/* How it works */}
      <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--teal)', marginBottom: 10 }}>How it works</div>
        <ol style={{ paddingLeft: 20, color: 'var(--muted)', fontSize: 13, lineHeight: 2 }}>
          <li>Install the free <a href="https://ntfy.sh" target="_blank" rel="noreferrer" style={{ color: 'var(--blue)' }}>ntfy app</a> on your phone (iOS or Android)</li>
          <li>Enter your callsign below and subscribe</li>
          <li>In the ntfy app, subscribe to your topic (e.g. <code style={{ background: 'var(--bg2)', padding: '1px 5px', borderRadius: 3, fontFamily: 'var(--font-mono)', fontSize: 11 }}>dxedge-k6wrj</code>)</li>
          <li>Receive push notifications when band conditions change</li>
        </ol>
        <p style={{ fontSize: 12, color: 'var(--dim)', fontStyle: 'italic', marginTop: 8 }}>
          No account required. ntfy.sh is free and open source. Your callsign is used only to generate a unique topic name.
        </p>
      </div>

      {/* Setup form */}
      <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: 2, textTransform: 'uppercase' }}>callsign</label>
            <input value={call} onChange={e => setCall(e.target.value.toUpperCase())}
              placeholder="K6WRJ" maxLength={10}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '7px 10px', borderRadius: 6, outline: 'none', width: 120 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: 2, textTransform: 'uppercase' }}>
              ntfy topic <span style={{ color: 'var(--dim)' }}>(auto-generated, editable)</span>
            </label>
            <input value={topic} onChange={e => setTopic(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g,''))}
              placeholder="dxedge-k6wrj" maxLength={64}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 13, background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '7px 10px', borderRadius: 6, outline: 'none', minWidth: 200 }} />
          </div>
        </div>

        {/* Alert type checkboxes */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>alert types</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ALERT_TYPES.map(a => (
              <label key={a.id} onClick={() => toggle(a.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 12px', background: alerts.includes(a.id) ? 'var(--bg2)' : 'transparent', borderRadius: 6, border: `1px solid ${alerts.includes(a.id) ? '#333' : 'transparent'}` }}>
                <div style={{
                  width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                  border: `2px solid ${alerts.includes(a.id) ? a.color : '#444'}`,
                  background: alerts.includes(a.id) ? a.color : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {alerts.includes(a.id) && <span style={{ color: '#000', fontSize: 10, fontWeight: 700 }}>✓</span>}
                </div>
                <span style={{ fontSize: 16 }}>{a.icon}</span>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: alerts.includes(a.id) ? a.color : 'var(--muted)' }}>
                    {a.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--dim)', fontStyle: 'italic' }}>{a.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={subscribe} disabled={!call || !topic || alerts.length === 0} style={{
            fontFamily: 'var(--font-mono)', fontSize: 12,
            background: 'var(--bg1)', border: '1px solid #7affb244',
            color: 'var(--teal)', padding: '8px 16px', borderRadius: 6,
            cursor: (!call || !topic) ? 'default' : 'pointer',
            opacity: (!call || !topic) ? 0.5 : 1
          }}>
            {status === 'subscribed' ? '✓ subscribed' : 'subscribe to alerts'}
          </button>

          {status === 'subscribed' && (
            <>
              <button onClick={sendTest} disabled={testing} style={{
                fontFamily: 'var(--font-mono)', fontSize: 12,
                background: 'var(--bg1)', border: '1px solid var(--border)',
                color: 'var(--muted)', padding: '8px 16px', borderRadius: 6, cursor: 'pointer'
              }}>
                {testing ? 'sending...' : '🔔 send test'}
              </button>
              <button onClick={unsubscribe} style={{
                fontFamily: 'var(--font-mono)', fontSize: 12,
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--dim)', padding: '8px 16px', borderRadius: 6, cursor: 'pointer'
              }}>
                unsubscribe
              </button>
            </>
          )}
        </div>

        {testResult && (
          <div style={{ marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 11,
            color: testResult === 'sent' ? 'var(--green)' : 'var(--red)' }}>
            {testResult === 'sent' ? '✓ test notification sent - check your ntfy app' : '✗ failed to send - check your topic name'}
          </div>
        )}
        {status === 'error' && (
          <div style={{ marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--red)' }}>
            subscription failed - try again
          </div>
        )}
      </div>

      {/* ntfy subscription links */}
      {topic && (
        <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>
            subscribe to topic in ntfy app
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href={ntfyAppUrl} style={{
              fontFamily: 'var(--font-mono)', fontSize: 12,
              background: '#7affb220', border: '1px solid #7affb244',
              color: 'var(--teal)', padding: '8px 14px', borderRadius: 6, textDecoration: 'none'
            }}>
              📱 open ntfy app → {topic}
            </a>
            <a href={ntfySubscribeUrl} target="_blank" rel="noreferrer" style={{
              fontFamily: 'var(--font-mono)', fontSize: 12,
              background: 'var(--bg2)', border: '1px solid var(--border)',
              color: 'var(--muted)', padding: '8px 14px', borderRadius: 6, textDecoration: 'none'
            }}>
              ntfy.sh/{topic} ↗
            </a>
          </div>
          <p style={{ fontSize: 11, color: 'var(--dim)', fontStyle: 'italic', marginTop: 10 }}>
            In the ntfy app: tap + → enter topic name → subscribe. Free, no account needed.
          </p>
        </div>
      )}
    </div>
  )
}
