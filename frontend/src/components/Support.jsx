const BTC  = 'bc1q99naj9qx5wg26rxc7q37lzmtaz7dj6t80xdgxl'
const ETH  = '0x450Af17245CD5238d5a826647E2F1bbAd2a982db'
const PP   = 'https://paypal.me/sagejw'

function QRCode({ value, size = 160 }) {
  // Generate QR using a free public API - no key needed
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&bgcolor=0e0e0e&color=7affb2&qzone=2`
  return (
    <img src={url} alt={value} width={size} height={size}
      style={{ borderRadius: 8, display: 'block', border: '1px solid var(--border)' }} />
  )
}

function AddressCard({ icon, label, address, link, color, qrValue }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <div style={{ background: 'var(--bg1)', border: `1px solid ${color}33`, borderTop: `3px solid ${color}`, borderRadius: 10, padding: '18px 18px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{label}</span>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <QRCode value={qrValue || address} size={150} />
        <div style={{ flex: 1, minWidth: 200 }}>
          {address && (
            <>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>address</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color, wordBreak: 'break-all', lineHeight: 1.6, marginBottom: 10, background: 'var(--bg2)', padding: '8px 10px', borderRadius: 5 }}>
                {address}
              </div>
              <button onClick={copy} style={{
                fontFamily: 'var(--font-mono)', fontSize: 11,
                background: copied ? `${color}20` : 'var(--bg2)',
                border: `1px solid ${copied ? color : 'var(--border)'}`,
                color: copied ? color : 'var(--muted)',
                padding: '6px 14px', borderRadius: 5, cursor: 'pointer', marginBottom: 8
              }}>
                {copied ? '✓ copied' : 'copy address'}
              </button>
            </>
          )}
          {link && (
            <a href={link} target="_blank" rel="noreferrer" style={{
              fontFamily: 'var(--font-mono)', fontSize: 12,
              display: 'inline-block',
              background: `${color}15`, border: `1px solid ${color}44`,
              color, padding: '8px 16px', borderRadius: 6, textDecoration: 'none'
            }}>
              {label} ↗
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'

export default function Support() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 }}>
          support dxedge
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, maxWidth: 600 }}>
          DXEdge is free, open source, and runs on a $8/month DigitalOcean server. If it's useful to you, buying me a coffee keeps the lights on and motivates new features. 73 de K6WRJ.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 560 }}>
        <AddressCard
          icon="💳" label="PayPal"
          link={PP} qrValue={PP}
          color="var(--blue)"
        />
        <AddressCard
          icon="₿" label="Bitcoin"
          address={BTC} qrValue={`bitcoin:${BTC}`}
          color="var(--yellow)"
        />
        <AddressCard
          icon="Ξ" label="Ethereum"
          address={ETH} qrValue={`ethereum:${ETH}`}
          color="#7a9fff"
        />
      </div>

      <div style={{ marginTop: 24, padding: '14px 16px', background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10, maxWidth: 560 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>what your support funds</div>
        <ul style={{ paddingLeft: 18, color: 'var(--muted)', fontSize: 12, lineHeight: 2 }}>
          <li>DigitalOcean server hosting (~$8/mo)</li>
          <li>Domain renewal (dxedge.net)</li>
          <li>New features and integrations</li>
          <li>FlexRadio Aurora click-to-tune development</li>
          <li>More ham radio tools and data sources</li>
        </ul>
      </div>
    </div>
  )
}
