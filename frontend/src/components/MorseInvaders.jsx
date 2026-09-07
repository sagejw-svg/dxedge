/* ------------------------------------------------------------------ *
 * Morse Invaders - v0.1
 * The game is a self-contained page at /morse-invaders/index.html that
 * imports the Morse trainer's CW engine from /morse/core.js, so both
 * play through one synthesizer. This component is only the DXEdge
 * shell around it, the same way Invaders.jsx wraps DX Invaders.
 * ------------------------------------------------------------------ */

const mono  = { fontFamily: 'var(--font-mono)' }
const label = { ...mono, fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase' }

export default function MorseInvaders() {
  return (
    <div className="morse-invaders-panel">
      <div style={{ marginBottom: 16 }}>
        <div style={{ ...label, marginBottom: 8 }}>morse invaders</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, maxWidth: 660 }}>
          Characters fall and each one is sent in code as it appears. Type it before it reaches the noise
          floor. Start with two Koch characters and add one every wave, or pick your own set. Groups arrive
          at six characters and callsigns at ten. A new character stays on screen until you have copied it
          four times, then you are on your ears. Speed, spacing and progress stay on this device. Full screen
          version at <a href="/morse-invaders/">dxedge.net/morse-invaders</a>.
        </p>
      </div>

      <div style={{
        border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden',
        background: 'var(--bg)', height: 'min(82vh, 820px)', minHeight: 480,
      }}>
        <iframe
          title="Morse Invaders"
          src="/morse-invaders/index.html"
          allow="autoplay; fullscreen; screen-wake-lock"
          style={{ border: 'none', display: 'block', width: '100%', height: '100%', background: 'var(--bg)' }}
        />
      </div>

      <div style={{ ...mono, fontSize: 10, color: 'var(--dim)', textAlign: 'center', margin: '9px 0 16px' }}>
        click or tap the game once to give it the keyboard
      </div>
    </div>
  )
}
