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
        <div style={{ ...label, marginBottom: 8 }}>filament &middot; cathode &middot; thyratron &middot; dekatron &middot; lattice &middot; gleam &middot; mote &middot; heptode &middot; geissler &middot; pentagrid &middot; orthicon &middot; trochotron &middot; gyrotron &middot; klystron &middot; phantastron &middot; additron &middot; rhumbatron &middot; resnatron &middot; hexode &middot; anode &middot; sculpt &middot; hand orchestra &middot; aether</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, maxWidth: 660 }}>
          Filament is polyphonic and built around lit tubes that do real
          work: one drives the filters, one sits inside the Valve filter's resonance loop, and a
          push-pull pair runs the output. Cathode is a one-voice semi-modular with a screaming
          high-pass and low-pass pair and a patch panel you wire with cables.
          Lattice is a wavetable instrument. Mote is a granular instrument: load a file, record the mic, or capture the rack.
          Heptode plays MIDI files and lets you reshape each track.
          Geissler is a meadow: reeds, grazers, stalks and flickers play when they meet, eat, breed or die.
          Pentagrid is a shortwave receiver: a dial, Morse, and synthesized band sounds.
          Orthicon paints a picture of sound and scans it back.
          Trochotron grows a piece from a seed: the same seed and the same settings are the same piece.
          Gyrotron is a gravity sequencer: bodies orbit wells and ring notes when they collide or cross.
          Klystron is a talk box: a carrier shaped by a vowel pad, a file, or the microphone, then smeared or frozen as grains.
          Phantastron is a circuit-bent toy: a clocked voice, and wires you drag across a board to bend the clock, the bits, a loop, or the feedback.
          Additron is an additive organ: draw the harmonics, morph two spectra, and send it through a rotary speaker.
          Rhumbatron is a string, a bore, or a plate: drag the bright point to move where the energy enters.
          Resnatron is a patch bay of cavities. Drag a gold jack onto a silver one, or share the bay with a link.
          Play them with the keys on screen, your computer keyboard, or a MIDI keyboard.
          Full page version at <a href="/synth/">dxedge.net/synth</a>.
          Gleam is a touch field on the same rack, and full screen at <a href="/synth/gleam/">/synth/gleam/</a>.
          Two more devices, each on its own page: <a href="/synth/fm/">Hexode</a> (six-operator FM)
          and <a href="/synth/acid/">Anode</a> (acid bass groovebox).
          Sculpt is a hand instrument in 3D: pinch a glowing orb and move it. Full screen at <a href="/synth/hand-sculpt/">/synth/hand-sculpt/</a>.
          <a href="/synth/hand-orchestra/">Hand Orchestra</a> plays chord tones from the fingertips.
          <a href="/synth/hand-aether/">Aether</a> is a two-hand theremin. The camera picture stays in the browser.
        </p>
      </div>

      <div style={{
        border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden',
        background: 'var(--bg)', height: 'min(90vh, 1100px)', minHeight: 560,
      }}>
        <iframe
          title="Filament synthesizer"
          src="/synth/index.html"
          allow="autoplay; midi; microphone"
          style={{ border: 'none', display: 'block', width: '100%', height: '100%', background: 'var(--bg)' }}
        />
      </div>
    </div>
  )
}
