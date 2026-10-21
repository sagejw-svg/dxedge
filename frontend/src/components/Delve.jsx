/* ------------------------------------------------------------------ *
 * Delve
 * The game is a self-contained page at /delve/index.html, the same
 * shape as the other games. This is the shell on the home tab.
 * ------------------------------------------------------------------ */

const mono = { fontFamily: 'var(--font-mono)' }
const label = { ...mono, fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase' }

export default function Delve() {
  return (
    <div className="delve-panel">
      <div style={{ marginBottom: 16 }}>
        <div style={{ ...label, marginBottom: 8 }}>delve</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, maxWidth: 680 }}>
          A first-person grid dungeon for a party of four. Walk with W and S, turn with A and D,
          strafe with Q and E. The arrow keys match the turns and the steps. Space swings the front
          rank, Z X C V send one champion, and H lists every key. Seven floors, a warden on the fifth
          stair, a map that fills in as you see it, and a save that stays in this browser. Full screen
          at <a href="/delve/">dxedge.net/delve</a>.
        </p>
      </div>

      <div style={{
        border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden',
        background: 'var(--bg)', height: 'min(88vh, 920px)', minHeight: 640,
      }}>
        <iframe
          title="Delve"
          src="/delve/index.html"
          allow="fullscreen"
          style={{ border: 'none', display: 'block', width: '100%', height: '100%', background: 'var(--bg)' }}
        />
      </div>

      <div style={{ ...mono, fontSize: 10, color: 'var(--dim)', textAlign: 'center', margin: '9px 0 16px' }}>
        W forward, S back, A D turn, Q E strafe. Space swings the front rank. Z X C V attack one champion. H lists keys. Click the game once so the keys land in it.
      </div>
    </div>
  )
}
