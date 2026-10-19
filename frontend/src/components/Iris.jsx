/* Iris, the camera instrument.
 * The page is self-contained at /synth/iris/. This is the DXEdge shell
 * around it, the same idea as Synth.jsx. allow="camera" lets the frame
 * ask for the webcam. Frames are read locally and are not uploaded.
 */

const mono = { fontFamily: 'var(--font-mono)' }
const label = { ...mono, fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase' }

export default function Iris() {
  return (
    <div className="iris-panel">
      <div style={{ marginBottom: 16 }}>
        <div style={{ ...label, marginBottom: 8 }}>iris &middot; camera score</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, maxWidth: 660 }}>
          Iris plays whatever the camera sees. A scan line turns brightness into pitch,
          hue picks a chord, motion fires notes, and edges stir a texture.
          Nothing is uploaded. Full page at <a href="/synth/iris/">dxedge.net/synth/iris</a>.
          The rest of the rack is on <a href="/synth/">the Filament page</a>.
        </p>
      </div>
      <div style={{
        border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden',
        background: 'var(--bg)', height: 'min(90vh, 1100px)', minHeight: 560,
      }}>
        <iframe
          title="Iris camera synth"
          src="/synth/iris/"
          allow="autoplay; camera"
          style={{ border: 'none', display: 'block', width: '100%', height: '100%', background: 'var(--bg)' }}
        />
      </div>
    </div>
  )
}
