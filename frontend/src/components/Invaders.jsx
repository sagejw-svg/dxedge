/* ------------------------------------------------------------------ *
 * DX Invaders - v0.1
 * The game itself is a self-contained HTML5 canvas page that ships
 * unchanged at /invaders/index.html. This component is only the
 * DXEdge shell around it, the same way the Morse tab wraps its tool.
 * ------------------------------------------------------------------ */

const mono  = { fontFamily: 'var(--font-mono)' }
const label = { ...mono, fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase' }

export default function Invaders({ callsign }) {
  // A callsign the operator typed into the DXEdge header becomes the operator in the game.
  // The header's own placeholder default is not theirs, so it is not passed; the game then
  // uses whatever was set on its title screen, or KK6ZZZ.
  let userSet = false
  try { userSet = !!localStorage.getItem('dxedge_call') } catch (e) { userSet = false }
  const src = '/invaders/index.html' + (userSet && callsign ? '?call=' + encodeURIComponent(callsign) : '')
  return (
    <div className="invaders-panel">
      <div style={{ marginBottom: 16 }}>
        <div style={{ ...label, marginBottom: 8 }}>dx invaders</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, maxWidth: 660 }}>
          Blast the QRM, then grab the DX. Every callsign you catch is a new DXCC entity worked
          this run, out of 340. Set your callsign in the DXEdge header or on the game's title screen
          (no callsign plays as KK6ZZZ). Arrows or WASD move, Space or click fires. On a phone, touch and drag
          to move and hold to fire. Your high score stays on this device. Full screen version at{' '}
          <a href="/invaders/">dxedge.net/invaders</a>.
        </p>
      </div>

      <div style={{
        border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden',
        background: 'var(--bg)', height: 'min(78vh, 760px)', minHeight: 420,
      }}>
        <iframe
          title="DX Invaders"
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
