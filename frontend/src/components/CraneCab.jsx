/* ------------------------------------------------------------------ *
 * Crane Cab - Phase 0
 * A self-contained Three.js browser game that ships unchanged at
 * /crane-cab/index.html. This component is only the DXEdge shell
 * around it, the same way the Invaders and Morse tabs wrap their tools.
 * ------------------------------------------------------------------ */

const mono  = { fontFamily: 'var(--font-mono)' }
const label = { ...mono, fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase' }

export default function CraneCab() {
  return (
    <div className="cranecab-panel">
      <div style={{ marginBottom: 16 }}>
        <div style={{ ...label, marginBottom: 8 }}>crane cab</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, maxWidth: 660 }}>
          You are in the seat of a flat-top tower crane. Ground talks first, keep the load quiet.
          Entertainment only, not operator training. Generic crane, no manufacturer names or logos.
          This is an early Phase 0 build, so the console gauges are still placeholders. Full screen
          version at <a href="/crane-cab/">dxedge.net/crane-cab</a>.
        </p>
      </div>

      <div style={{
        border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden',
        background: 'var(--bg)', height: 'min(78vh, 760px)', minHeight: 420,
      }}>
        <iframe
          title="Crane Cab"
          src="/crane-cab/index.html"
          allow="fullscreen"
          style={{ border: 'none', display: 'block', width: '100%', height: '100%', background: 'var(--bg)' }}
        />
      </div>

      <div style={{ ...mono, fontSize: 10, color: 'var(--dim)', textAlign: 'center', margin: '9px 0 16px' }}>
        click or tap the game once to give it the keyboard, F3 toggles the debug overlay
      </div>
    </div>
  )
}
