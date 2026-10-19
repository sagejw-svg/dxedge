/* Aether, the hand theremin. The instrument itself is the static page at
 * /synth/hand-aether/. This is the DXEdge tab around it, the same shell
 * the Filament tab uses. allow="camera" lets the page ask for the camera
 * from inside the frame. The picture is not uploaded. */

const mono = { fontFamily: 'var(--font-mono)' }
const label = { ...mono, fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase' }

export default function Aether() {
  return (
    <div className="synth-panel">
      <div style={{ marginBottom: 16 }}>
        <div style={{ ...label, marginBottom: 8 }}>aether &middot; hand theremin</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, maxWidth: 660 }}>
          Aether is a two-hand theremin. Your right hand sets pitch and volume,
          distance from the camera sets the filter, and your left hand sets vibrato and reverb.
          A fist mutes. The camera picture stays in this browser.
          Full page at <a href="/synth/hand-aether/">/synth/hand-aether/</a>.
          If you skip the camera, the mouse plays the same instrument.
        </p>
      </div>
      <div style={{
        border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden',
        background: 'var(--bg)', height: 'min(90vh, 1100px)', minHeight: 560,
      }}>
        <iframe
          title="Aether hand theremin"
          src="/synth/hand-aether/"
          allow="autoplay; camera"
          style={{ border: 'none', display: 'block', width: '100%', height: '100%', background: 'var(--bg)' }}
        />
      </div>
    </div>
  )
}
