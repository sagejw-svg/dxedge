const REPO = 'sagejw-svg/dxedge'

function buildIssueUrl(type, title, body) {
  const params = new URLSearchParams({
    title,
    body,
    labels: type,
    template: '',
  })
  return `https://github.com/${REPO}/issues/new?${params.toString()}`
}

const BUG_TEMPLATE = `**Describe the bug**
A clear description of what went wrong.

**Steps to reproduce**
1. Go to tab '...'
2. Click on '...'
3. See error

**Expected behavior**
What you expected to happen.

**Your setup**
- Browser:
- Device (iPhone/Android/Desktop):
- Grid square (if relevant):

**Additional context**
Any other info, screenshots, etc.`

const FEATURE_TEMPLATE = `**Is your feature request related to a problem?**
A clear description of the problem or gap.

**Describe the solution you'd like**
What would you like to see added or changed?

**Ham radio context**
Why would this be useful for ham operators?

**Additional context**
Any other notes, links, or references.`

export default function Feedback() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 }}>
          feedback & community
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, maxWidth: 640 }}>
          DXEdge is open source and actively developed. Bug reports, feature requests, and ideas are all welcome. GitHub is the best place to track issues and discussions.
        </p>
      </div>

      {/* Primary actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, marginBottom: 28 }}>
        {[
          {
            icon: '🐛',
            title: 'Report a Bug',
            desc: 'Something not working? Open a GitHub issue with details and we\'ll track it down.',
            color: 'var(--red)',
            action: 'Open Bug Report',
            href: buildIssueUrl('bug', '[Bug] ', BUG_TEMPLATE),
          },
          {
            icon: '💡',
            title: 'Request a Feature',
            desc: 'Have an idea for a new widget, integration, or improvement? We\'d love to hear it.',
            color: 'var(--teal)',
            action: 'Open Feature Request',
            href: buildIssueUrl('enhancement', '[Feature] ', FEATURE_TEMPLATE),
          },
          {
            icon: '💬',
            title: 'GitHub Discussions',
            desc: 'General questions, show & tell, propagation chat, and community discussion.',
            color: '#7a9fff',
            action: 'Join Discussion',
            href: `https://github.com/${REPO}/discussions`,
          },
          {
            icon: '📧',
            title: 'Email',
            desc: 'Prefer email? Reach out directly for anything that doesn\'t fit GitHub.',
            color: 'var(--yellow)',
            action: 'Send Email',
            href: 'mailto:james@wilsonhaven.com?subject=DXEdge Feedback',
          },
        ].map(item => (
          <a key={item.title} href={item.href} target="_blank" rel="noreferrer"
            style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'var(--bg1)', border: '1px solid var(--border)',
              borderTop: `3px solid ${item.color}`,
              borderRadius: 8, padding: '16px 16px 14px',
              height: '100%', display: 'flex', flexDirection: 'column', gap: 10,
              transition: 'border-color 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#333'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 22 }}>{item.icon}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                  {item.title}
                </span>
              </div>
              <p style={{ fontSize: 12, color: '#777', lineHeight: 1.6, margin: 0, flex: 1 }}>
                {item.desc}
              </p>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: item.color }}>
                {item.action} ↗
              </div>
            </div>
          </a>
        ))}
      </div>

      {/* GitHub repo links */}
      <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12 }}>
          github — sagejw-svg/dxedge
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { label: 'source code',   href: `https://github.com/${REPO}` },
            { label: 'open issues',   href: `https://github.com/${REPO}/issues` },
            { label: 'discussions',   href: `https://github.com/${REPO}/discussions` },
            { label: 'changelog',     href: `https://github.com/${REPO}/commits/main` },
            { label: 'feature ideas', href: `https://github.com/${REPO}/issues?q=label%3Aenhancement` },
          ].map(l => (
            <a key={l.label} href={l.href} target="_blank" rel="noreferrer" style={{
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: 'var(--blue)', border: '1px solid var(--border)',
              padding: '5px 12px', borderRadius: 5, textDecoration: 'none'
            }}>
              {l.label} ↗
            </a>
          ))}
        </div>
      </div>

      {/* How GitHub works for non-GitHub users */}
      <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>
          new to github?
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7, margin: 0 }}>
          GitHub is free to join. Creating an account takes 2 minutes at{' '}
          <a href="https://github.com/signup" target="_blank" rel="noreferrer" style={{ color: 'var(--blue)' }}>github.com/signup ↗</a>.
          Once you have an account you can submit bug reports, vote on features, and follow development.
          If you'd rather not, the email link above works fine too. 73 de K6WRJ
        </p>
      </div>
    </div>
  )
}
