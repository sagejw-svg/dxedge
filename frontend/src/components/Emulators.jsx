/* ------------------------------------------------------------------ *
 * Emulators
 * A curated, link-checked catalogue of browser-hosted emulators:
 * pocket computers and calculators, home computers, PCs and Macs,
 * mainframes and minis, CPU simulators, microcontroller and circuit
 * sims, cipher machines, fractals, Fourier and DSP tools, cellular
 * automata and physics simulations. The page itself is self-contained at
 * /emulators/index.html and reads /emulators/emulators.json; this
 * component is only the DXEdge shell around it, like CraneCab.jsx.
 * ------------------------------------------------------------------ */

const mono  = { fontFamily: 'var(--font-mono)' }
const label = { ...mono, fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase' }

export default function Emulators() {
  return (
    <div className="emulators-panel">
      <div style={{ marginBottom: 16 }}>
        <div style={{ ...label, marginBottom: 8 }}>emulators</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, maxWidth: 660 }}>
          Computers, calculators, minis, CPUs and circuits that run entirely in a browser tab, plus
          fractal generators, Fourier and signal tools, cellular automata and physics sims: real
          firmware and real math, nothing to install, nothing to break. Every link is opened and checked, and the
          catalogue is swept for link rot weekly. Sort by GitHub stars, ease of use or era, filter by
          category, and each one opens in a new tab. Full page version at{' '}
          <a href="/emulators/">dxedge.net/emulators</a>.
        </p>
      </div>

      <div style={{
        border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden',
        background: 'var(--bg)', height: 'min(82vh, 900px)', minHeight: 480,
      }}>
        <iframe
          title="Emulators"
          src="/emulators/index.html"
          style={{ border: 'none', display: 'block', width: '100%', height: '100%', background: 'var(--bg)' }}
        />
      </div>

      <div style={{ ...mono, fontSize: 10, color: 'var(--dim)', textAlign: 'center', margin: '9px 0 16px' }}>
        each emulator opens on its own site in a new tab; stars are GitHub counts, ease of use is our rating
      </div>
    </div>
  )
}
