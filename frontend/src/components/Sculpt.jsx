/* Sculpt, a hand-tracking instrument at /synth/hand-sculpt/.
 * This is the DXEdge shell around that page. The camera picture stays
 * inside the frame: allow="camera" is what lets the page ask for it.
 */

const mono = { fontFamily: 'var(--font-mono)' }
const label = { ...mono, fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase' }

export default function Sculpt() {
  return (
    <div className="synth-panel">
      <div style={{ marginBottom: 16 }}>
        <div style={{ ...label, marginBottom: 8 }}>sculpt &middot; hand orbs</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, maxWidth: 660 }}>
          Sculpt is a field of glowing orbs. Pinch one and move it: across is pan,
          up is pitch, depth is the filter. Twist your wrist for timbre, spread
          your fingers to turn it into grains, and open both hands apart to widen
          the reverb. The camera starts when the page opens. The picture stays in the browser and is not uploaded.
          Full page at <a href="/synth/hand-sculpt/">/synth/hand-sculpt/</a>.
        </p>
      </div>
      <div style={{
        border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden',
        background: 'var(--bg)', height: 'min(90vh, 1100px)', minHeight: 560,
      }}>
        <iframe
          title="Sculpt hand instrument"
          src="/synth/hand-sculpt/index.html"
          allow="camera; autoplay"
          style={{ border: 'none', display: 'block', width: '100%', height: '100%', background: 'var(--bg)' }}
        />
      </div>
    </div>
  )
}
