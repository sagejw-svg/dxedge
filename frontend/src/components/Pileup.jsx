/* ------------------------------------------------------------------ *
 * Pileup - v0.1
 * The game is a self-contained page at /pileup/index.html. This is only
 * the DXEdge shell around it, the same pattern as Invaders.jsx and
 * SpotChaser.jsx. It hands the game the operator's callsign and grid.
 * ------------------------------------------------------------------ */

const mono  = { fontFamily: 'var(--font-mono)' }
const label = { ...mono, fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase' }

export default function Pileup({ callsign }) {
  const q = []
  // The header's own callsign default is a placeholder, not the operator's,
  // so it is only passed when they actually set one.
  let userSet = false
  try { userSet = !!localStorage.getItem('dxedge_call') } catch (e) { userSet = false }
  if (userSet && callsign) q.push('call=' + encodeURIComponent(callsign))
  try {
    const grid = localStorage.getItem('dxedge_grid')
    if (grid) q.push('grid=' + encodeURIComponent(grid))
  } catch (e) { /* private mode */ }
  const src = '/pileup/index.html' + (q.length ? '?' + q.join('&') : '')

  return (
    <div className="pileup-panel">
      <div style={{ marginBottom: 16 }}>
        <div style={{ ...label, marginBottom: 8 }}>pileup</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, maxWidth: 660 }}>
          You are the one running the pileup. Call CQ and several stations answer at once, each a
          little off your frequency, at its own speed and strength. Net the one you can hear, narrow
          the filter to push the others out, copy the call and work it. Partial copy counts: type
          what you are sure of with a question mark, such as <code>3KZ?</code>, and only matching
          stations come back. That is the actual contest skill.
        </p>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, maxWidth: 660, marginTop: 8 }}>
          Arrows tune, shift for coarse. <code>[</code> and <code>]</code> set the filter width.
          Enter sends CQ, then logs whatever you have typed. <code>R</code> asks again,
          <code> N</code> nets onto the nearest caller, <code>M</code> mutes. Who shows up depends on
          the band, your grid and the time of day, from the same path model Skip and Spot Chaser use.
          Start on relaxed. Full screen version at <a href="/pileup/">dxedge.net/pileup</a>.
        </p>
      </div>

      <div style={{
        border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden',
        background: 'var(--bg)', height: 'min(84vh, 880px)', minHeight: 520,
      }}>
        <iframe
          title="Pileup"
          src={src}
          allow="fullscreen"
          style={{ border: 'none', display: 'block', width: '100%', height: '100%', background: 'var(--bg)' }}
        />
      </div>

      <div style={{ ...mono, fontSize: 10, color: 'var(--dim)', textAlign: 'center', margin: '9px 0 16px' }}>
        click or tap the game once to give it the keyboard
      </div>
    </div>
  )
}
