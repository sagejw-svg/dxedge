/* ------------------------------------------------------------------ *
 * Skip - v0.1
 * A propagation game. The game itself is a self-contained page at
 * /skip/index.html; this is the DXEdge shell around it, like Invaders.jsx.
 * The header's grid is handed over in the query string when one has been
 * saved, so the DX targets are measured from where the operator actually is.
 * ------------------------------------------------------------------ */

const mono  = { fontFamily: 'var(--font-mono)' }
const label = { ...mono, fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase' }

export default function Skip() {
  const grid = (() => { try { return localStorage.getItem('dxedge_grid') } catch { return null } })()
  const src = grid && /^[A-R]{2}[0-9]{2}([A-X]{2})?$/i.test(grid) ? `/skip/index.html?grid=${encodeURIComponent(grid)}` : '/skip/index.html'
  return (
    <div className="skip-panel">
      <div style={{ marginBottom: 16 }}>
        <div style={{ ...label, marginBottom: 8 }}>skip</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, maxWidth: 660 }}>
          A DX station calls from its real distance and bearing. You see the path side-on: the curve of the
          earth, the F layer, and the day/night terminator where it really is. Pick a band and a takeoff angle,
          key, and watch the hops land, fall short, punch through the layer, or get eaten by the D layer on the
          daylit side. The verdict says why. The sun is today's SFI and K from this site, and one round is one
          full day, so grayline sweeps through while you play. A cartoon ionosphere, not VOACAP, but right about
          the big things. Full screen at <a href="/skip/">dxedge.net/skip</a>.
        </p>
      </div>

      <div style={{
        border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden',
        background: 'var(--bg)', height: 'min(82vh, 760px)', minHeight: 520,
      }}>
        <iframe
          title="Skip"
          src={src}
          allow="fullscreen"
          style={{ border: 'none', display: 'block', width: '100%', height: '100%', background: 'var(--bg)' }}
        />
      </div>

      <div style={{ ...mono, fontSize: 10, color: 'var(--dim)', textAlign: 'center', margin: '9px 0 16px' }}>
        keys 1 to 9 pick the band, arrows set the angle, space keys. click the game once to give it the keyboard
      </div>
    </div>
  )
}
