/* ------------------------------------------------------------------ *
 * Filament (and Cathode, the second device in its rack)
 * A playable polyphonic tube synthesizer: lit tubes that do real work
 * (V1 drives the filters, V2 sits in the Valve filter's resonance loop,
 * V3/V4 are the output pair), filters with character, and stereo you
 * can play. The page is self-contained at /synth/index.html with its
 * modules beside it (voice.worklet.js runs every voice); this component
 * is only the DXEdge shell around it, like Otr.jsx and Emulators.jsx.
 * allow="midi" lets the page ask for a MIDI keyboard from inside the
 * frame (Chrome, Edge, Firefox; Safari has no Web MIDI).
 * ------------------------------------------------------------------ */

const mono  = { fontFamily: 'var(--font-mono)' }
const label = { ...mono, fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase' }

export default function Synth() {
  return (
    <div className="synth-panel">
      <div style={{ marginBottom: 16 }}>
        <div style={{ ...label, marginBottom: 8 }}>filament &middot; cathode &middot; thyratron &middot; dekatron &middot; lattice &middot; gleam &middot; mote &middot; heptode &middot; geissler &middot; hexode &middot; anode</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, maxWidth: 660 }}>
          Filament is polyphonic and built around lit tubes that do real
          work: one drives the filters, one sits inside the Valve filter's resonance loop, and a
          push-pull pair runs the output. Cathode is a one-voice semi-modular with a screaming
          high-pass and low-pass pair and a patch panel you wire with cables.
          Lattice is a wavetable instrument. Mote is a granular instrument: load a file, record the mic, or capture the rack.
          Heptode plays MIDI files and lets you reshape each track.
          Geissler is a meadow: reeds, grazers, stalks and flickers play when they meet, eat, breed or die.
          Play them with the keys on screen, your computer keyboard, or a MIDI keyboard.
          Full page version at <a href="/synth/">dxedge.net/synth</a>.
          Gleam is a touch field on the same rack, and full screen at <a href="/synth/gleam/">/synth/gleam/</a>.
          Two more devices, each on its own page: <a href="/synth/fm/">Hexode</a> (six-operator FM)
          and <a href="/synth/acid/">Anode</a> (acid bass groovebox).
        </p>
      </div>

      <div style={{
        border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden',
        background: 'var(--bg)', height: 'min(90vh, 1100px)', minHeight: 560,
      }}>
        <iframe
          title="Filament synthesizer"
          src="/synth/index.html"
          allow="autoplay; midi"
          style={{ border: 'none', display: 'block', width: '100%', height: '100%', background: 'var(--bg)' }}
        />
      </div>
    </div>
  )
}
