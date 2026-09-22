/* ------------------------------------------------------------------ *
 * Old Time Radio
 * A browser radio for the Internet Archive's old-time-radio collection:
 * nine curated channels, build-your-own stations, a skip button, a live
 * audio visualizer, and full-text episode search. The page itself is
 * self-contained at /otr/index.html and reads /otr/catalog.json plus
 * /otr/search.json; this component is only the DXEdge shell around it,
 * like Emulators.jsx and CraneCab.jsx. Catalogue and episode summaries
 * are forked from Rob Dawson / codebox (oldtime.radio, MIT); audio
 * streams direct from archive.org, nothing is hosted here.
 * ------------------------------------------------------------------ */

const mono  = { fontFamily: 'var(--font-mono)' }
const label = { ...mono, fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase' }

export default function Otr() {
  return (
    <div className="otr-panel">
      <div style={{ marginBottom: 16 }}>
        <div style={{ ...label, marginBottom: 8 }}>old time radio</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, maxWidth: 660 }}>
          Thousands of classic radio shows from the 1930s, 40s and 50s, streamed straight from the
          Internet Archive. Pick one of nine channels, build your own station from any shows you like,
          skip anything, and search episodes by plot. Nothing is hosted on DXEdge; the audio plays
          direct from archive.org. Full page version at{' '}
          <a href="/otr/">dxedge.net/otr</a>. The original synchronized broadcast, where everyone
          hears the same show at once, is still running at{' '}
          <a href="https://oldtime.radio" target="_blank" rel="noopener noreferrer">oldtime.radio</a>.
        </p>
      </div>

      <div style={{
        border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden',
        background: 'var(--bg)', height: 'min(86vh, 1000px)', minHeight: 520,
      }}>
        <iframe
          title="Old Time Radio"
          src="/otr/index.html"
          allow="autoplay"
          style={{ border: 'none', display: 'block', width: '100%', height: '100%', background: 'var(--bg)' }}
        />
      </div>

      <div style={{ ...mono, fontSize: 10, color: 'var(--dim)', textAlign: 'center', margin: '9px 0 16px' }}>
        forked from{' '}
        <a href="https://oldtime.radio" target="_blank" rel="noopener noreferrer">oldtime.radio</a>
        {' '}by Rob Dawson / codebox (MIT, <a href="https://github.com/codebox/old-time-radio" target="_blank" rel="noopener noreferrer">source</a>)
        {' '}&middot; audio hosted by the{' '}
        <a href="https://archive.org/details/oldtimeradio" target="_blank" rel="noopener noreferrer">Internet Archive</a>
      </div>
    </div>
  )
}
