/* ------------------------------------------------------------------ *
 * Spot Chaser - v0.1
 * The game itself is a self-contained page at /spot-chaser/index.html,
 * the convention every game here follows. This is the DXEdge shell, and
 * it hands over the header's grid so the distances, bearings and paths
 * are measured from where the operator actually is.
 * ------------------------------------------------------------------ */

const mono  = { fontFamily: 'var(--font-mono)' }
const label = { ...mono, fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase' }

export default function SpotChaser() {
  const grid = (() => { try { return localStorage.getItem('dxedge_grid') } catch { return null } })()
  const src = grid && /^[A-R]{2}[0-9]{2}([A-X]{2})?$/i.test(grid)
    ? `/spot-chaser/index.html?grid=${encodeURIComponent(grid)}`
    : '/spot-chaser/index.html'
  return (
    <div className="spot-chaser-panel">
      <div style={{ marginBottom: 16 }}>
        <div style={{ ...label, marginBottom: 8 }}>spot chaser</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, maxWidth: 680 }}>
          Stations spotted on the air in the last few minutes, from the same DX cluster, POTA and SOTA feeds
          this site already carries. Each one is re-created as a signal you have to tune in: its call in CW,
          in real phonetics, or in genuine BPSK31. It sits a few hundred Hz off the spotted frequency the way
          spots always are, and how loud it arrives comes from the path model, run from your grid to that
          entity on that band at this hour. Copy the call and the reveal tells you the entity, distance,
          bearing and whether the band is really open that way. Nothing is transmitted: every signal is
          synthesized in your browser. Full screen at <a href="/spot-chaser/">dxedge.net/spot-chaser</a>.
        </p>
      </div>

      <div style={{
        border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden',
        background: 'var(--bg)', height: 'min(84vh, 800px)', minHeight: 540,
      }}>
        <iframe
          title="Spot Chaser"
          src={src}
          allow="autoplay; fullscreen"
          style={{ border: 'none', display: 'block', width: '100%', height: '100%', background: 'var(--bg)' }}
        />
      </div>

      <div style={{ ...mono, fontSize: 10, color: 'var(--dim)', textAlign: 'center', margin: '9px 0 16px' }}>
        arrows tune, shift for bigger steps, or click the waterfall to net. click the game once to give it the keyboard
      </div>
    </div>
  )
}
