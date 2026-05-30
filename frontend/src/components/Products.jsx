import { useState } from 'react'

const CATEGORIES = ['All', 'SDR Hardware', 'Radios', 'Raspberry Pi', 'Antennas', 'Accessories', 'Books']

const PRODUCTS = [
  // SDR Hardware
  {
    id: 'rtlsdr-v4',
    category: 'SDR Hardware',
    name: 'RTL-SDR Blog V4',
    tagline: 'The best entry-level SDR dongle',
    description: 'The definitive beginner SDR. USB dongle covering 500 kHz to 1.75 GHz. Version 4 adds a built-in HF upconverter for direct HF sampling - no ham-it-up needed. Works with every SDR application. The Arduino of the RF world.',
    price: '$35',
    link: 'https://www.rtl-sdr.com/rtl-sdr-blog-v4-dongle-initial-release/',
    badge: 'Best Entry Point',
    badgeColor: '#00ff9d',
    specs: ['500 kHz - 1.75 GHz', 'Direct HF sampling', 'USB 2.0', 'Works with all SDR software'],
    icon: '📡',
  },
  {
    id: 'airspy-hf',
    category: 'SDR Hardware',
    name: 'Airspy HF+ Discovery',
    tagline: 'Best-in-class HF/VHF performance',
    description: 'Exceptional dynamic range makes this the go-to for serious HF listening and weak signal work. Covers 0.5 kHz to 31 MHz and 60-260 MHz with outstanding sensitivity. A significant step up from RTL-SDR for HF.',
    price: '$169',
    link: 'https://airspy.com/airspy-hf-discovery/',
    badge: 'HF Champion',
    badgeColor: '#7affb2',
    specs: ['0.5 kHz - 31 MHz', '60-260 MHz VHF', '18-bit ADC', '-143 dBm noise floor'],
    icon: '🔬',
  },
  {
    id: 'hackrf',
    category: 'SDR Hardware',
    name: 'HackRF One',
    tagline: 'Transmit and receive, 1 MHz to 6 GHz',
    description: 'The classic open-source SDR transceiver. Half-duplex transmit and receive from 1 MHz to 6 GHz. Great for RF experimentation, signal analysis, and learning. 20 Msps sample rate. The tool for serious RF exploration.',
    price: '$350',
    link: 'https://greatscottgadgets.com/hackrf/',
    badge: 'TX+RX',
    badgeColor: '#ffd600',
    specs: ['1 MHz - 6 GHz', 'Half-duplex TX/RX', '20 Msps', 'Open source hardware'],
    icon: '⚡',
  },
  {
    id: 'kiwisdr',
    category: 'SDR Hardware',
    name: 'KiwiSDR 2',
    tagline: 'Network-connected HF SDR, share with the world',
    description: 'A complete HF SDR that connects to your network and can be shared publicly. Covers 0-32 MHz with full 30 MHz bandwidth visible simultaneously. Many public KiwiSDR stations exist worldwide. Perfect for remote HF monitoring.',
    price: '$299',
    link: 'https://www.crowdsupply.com/seeed-studio/kiwisdr-2',
    badge: 'Network SDR',
    badgeColor: '#7a9fff',
    specs: ['0-32 MHz', '14-bit ADC', '4 simultaneous users', 'Web browser interface'],
    icon: '🌐',
  },
  {
    id: 'hermes-lite2',
    category: 'SDR Hardware',
    name: 'Hermes-Lite 2',
    tagline: 'Open-source HF SDR transceiver',
    description: 'A 5W HF SDR transceiver based on FPGA technology. Fully open hardware and software. Compatible with many SDR applications including OpenHPSDR. A serious amateur radio transceiver at a fraction of commercial cost.',
    price: '$200-300',
    link: 'https://github.com/softerhardware/Hermes-Lite2',
    badge: 'Open Source TX',
    badgeColor: '#ff9933',
    specs: ['160m-6m HF', '5W output', 'FPGA-based', 'OpenHPSDR compatible'],
    icon: '🛠️',
  },

  // Radios
  {
    id: 'icom-7300',
    category: 'Radios',
    name: 'Icom IC-7300',
    tagline: 'The radio that changed HF forever',
    description: 'The IC-7300 brought direct-sampling SDR technology to an affordable HF transceiver and transformed the market. Excellent receiver, built-in spectrum scope, easy to use. The most popular HF radio of the last decade for good reason.',
    price: '$1,000-1,200',
    link: 'https://www.icomamerica.com/lineup/products/IC-7300/',
    badge: 'Community Favorite',
    badgeColor: '#00ff9d',
    specs: ['HF/50MHz', '100W', 'Real-time spectrum scope', 'USB audio built-in'],
    icon: '📻',
  },
  {
    id: 'flex-aurora',
    category: 'Radios',
    name: 'FlexRadio Aurora',
    tagline: 'Next-gen network SDR transceiver',
    description: 'The Aurora is FlexRadio\'s latest network-connected HF transceiver. Full SDR architecture with SmartSDR software. Network-controllable from anywhere. DXEdge is being built to integrate click-to-tune directly with this radio.',
    price: '$2,500+',
    link: 'https://www.flexradio.com',
    badge: 'On Order',
    badgeColor: '#a78bfa',
    specs: ['HF/6m', 'SmartSDR', 'Network connected', 'DXEdge integration planned'],
    icon: '🚀',
  },
  {
    id: 'xiegu-g90',
    category: 'Radios',
    name: 'Xiegu G90',
    tagline: 'Portable HF with built-in ATU',
    description: 'A surprisingly capable portable HF transceiver at a budget price. 20W, built-in ATU, internal spectrum display. Popular for portable and POTA operations. The price-to-performance ratio is hard to beat for field use.',
    price: '$400-450',
    link: 'https://xiegu.eu/product/g90/',
    badge: 'Best Budget HF',
    badgeColor: '#7affb2',
    specs: ['HF 160m-10m', '20W', 'Built-in ATU', 'Portable friendly'],
    icon: '🎒',
  },

  // Raspberry Pi
  {
    id: 'rpi5',
    category: 'Raspberry Pi',
    name: 'Raspberry Pi 5 (4GB)',
    tagline: 'The best Pi yet for ham radio projects',
    description: 'The Pi 5 is fast enough for serious SDR work - WSJT-X, FT8, Direwolf APRS, JS8Call, even light-duty RemoteHams. The 4GB version hits the sweet spot. Pair with an RTL-SDR V4 for a complete HF monitoring station under $100.',
    price: '$60',
    link: 'https://www.raspberrypi.com/products/raspberry-pi-5/',
    badge: 'Recommended',
    badgeColor: '#00ff9d',
    specs: ['2.4 GHz quad-core', '4GB LPDDR4X', 'PCIe 2.0', 'Active cooler available'],
    icon: '🍓',
  },
  {
    id: 'rpi-pico',
    category: 'Raspberry Pi',
    name: 'Raspberry Pi Pico 2 W',
    tagline: 'Wireless microcontroller for shack automation',
    description: 'The Pico 2 W adds WiFi and Bluetooth to the RP2350 microcontroller. Great for antenna switching, band decoders, CAT interface bridges, keyers, and other shack automation tasks. MicroPython makes it approachable.',
    price: '$7',
    link: 'https://www.raspberrypi.com/products/raspberry-pi-pico-2/',
    badge: 'Shack Automation',
    badgeColor: '#7affb2',
    specs: ['RP2350 dual-core', 'WiFi + BT 5.2', 'MicroPython', '$7 USD'],
    icon: '🔧',
  },
  {
    id: 'rpi-400',
    category: 'Raspberry Pi',
    name: 'Raspberry Pi 400',
    tagline: 'Complete Pi computer in a keyboard',
    description: 'A full Raspberry Pi 4 built into a compact keyboard. No separate case, no wiring - just connect a monitor and go. Makes a great dedicated shack computer for logging, digital modes, or running DXEdge locally.',
    price: '$70',
    link: 'https://www.raspberrypi.com/products/raspberry-pi-400/',
    badge: 'Shack PC',
    badgeColor: '#7a9fff',
    specs: ['Pi 4 internals', 'Built-in keyboard', '4GB RAM', 'All-in-one'],
    icon: '⌨️',
  },

  // Antennas
  {
    id: 'efhw-antenna',
    category: 'Antennas',
    name: 'End-Fed Half Wave (EFHW)',
    tagline: 'No-compromise wire antenna for HF',
    description: 'The EFHW has become the go-to field antenna for portable and home use. A single wire from 40m through 10m with a 49:1 unun. Easy to deploy, works without a tuner on harmonically related bands. Many commercial options or build your own.',
    price: '$50-150',
    link: 'https://myantennas.com/wp/product-category/efhw/',
    badge: 'Field Favorite',
    badgeColor: '#00ff9d',
    specs: ['40m-10m multiband', '49:1 unun', 'Wire antenna', 'Portable friendly'],
    icon: '📶',
  },
  {
    id: 'diamond-x50',
    category: 'Antennas',
    name: 'Diamond X50A',
    tagline: 'The classic dual-band VHF/UHF vertical',
    description: 'The X50A has been a go-to 2m/70cm base antenna for decades. Well-built, reliable, good gain. Works great as an APRS antenna, satellite antenna, or general 2m/70cm station. Hard to go wrong with the Diamond.',
    price: '$60-80',
    link: 'https://www.diamondantenna.net/x50a.html',
    badge: 'Classic Choice',
    badgeColor: '#7affb2',
    specs: ['2m/70cm', '4.5/7.2 dBd gain', 'SO-239 connector', 'Fiberglass radome'],
    icon: '📡',
  },
  {
    id: 'mla30',
    category: 'Antennas',
    name: 'MLA-30+ Loop Antenna',
    tagline: 'Active receive loop for restricted spaces',
    description: 'A magnetic loop receiving antenna with active amplifier for 100 kHz to 30 MHz. Perfect for apartments, condos, or any restricted space. No room for a dipole? The MLA-30+ pulls in surprisingly strong HF signals from a small loop.',
    price: '$35-50',
    link: 'https://www.amazon.com/s?k=MLA-30+loop+antenna',
    badge: 'Restricted Space',
    badgeColor: '#ffd600',
    specs: ['100 kHz - 30 MHz', 'Active amplifier', 'USB powered', 'Small footprint'],
    icon: '🔄',
  },

  // Accessories
  {
    id: 'nanovana',
    category: 'Accessories',
    name: 'NanoVNA V2',
    tagline: 'Pocket-sized antenna and circuit analyzer',
    description: 'A vector network analyzer for $60. Measure antenna SWR, impedance, cable loss, filter response - everything you need for antenna work. The NanoVNA V2 has a larger screen and covers up to 3 GHz. An essential shack instrument.',
    price: '$60-80',
    link: 'https://nanovna.com',
    badge: 'Essential Tool',
    badgeColor: '#00ff9d',
    specs: ['50 kHz - 3 GHz', 'S11/S21 measurements', '4" touchscreen', 'Battery powered'],
    icon: '🔭',
  },
  {
    id: 'rigblaster',
    category: 'Accessories',
    name: 'SignaLink USB',
    tagline: 'Sound card interface for digital modes',
    description: 'The SignaLink USB is the most popular interface for connecting a radio to a computer for digital modes. Plug-and-play with WSJT-X, Fldigi, JS8Call, and virtually every digital mode application. No driver installation required on most systems.',
    price: '$100-120',
    link: 'https://www.tigertronics.com/slusbmain.htm',
    badge: 'Digital Modes',
    badgeColor: '#7affb2',
    specs: ['USB audio', 'PTT control', 'All digital modes', 'No drivers needed'],
    icon: '💻',
  },
  {
    id: 'tnc-pi',
    category: 'Accessories',
    name: 'Mobilinkd TNC4',
    tagline: 'Bluetooth TNC for APRS',
    description: 'A tiny Bluetooth TNC that connects to any radio for APRS packet operations. Works with APRSDroid on Android or APRS apps on iOS. No cables to the radio required (uses audio). Perfect for mobile APRS and emergency comm.',
    price: '$90',
    link: 'https://www.mobilinkd.com/tnc4/',
    badge: 'APRS Ready',
    badgeColor: '#7a9fff',
    specs: ['Bluetooth 4.1', '1200/9600 baud', 'KISS TNC', 'Rechargeable battery'],
    icon: '📱',
  },

  // Books
  {
    id: 'arrl-handbook',
    category: 'Books',
    name: 'ARRL Handbook 2025',
    tagline: 'The definitive amateur radio reference',
    description: 'The ARRL Handbook has been the bible of amateur radio since 1926. Covers everything from basic electronics theory to advanced antenna design, digital modes, and station building. No ham shack bookshelf is complete without it.',
    price: '$50',
    link: 'https://www.arrl.org/arrl-handbook-for-radio-communications',
    badge: 'Essential Reference',
    badgeColor: '#00ff9d',
    specs: ['1400+ pages', 'Annual edition', 'Circuit diagrams', 'Digital download available'],
    icon: '📚',
  },
  {
    id: 'rpi5-radio-book',
    category: 'Books',
    name: 'Raspberry Pi 5 for Radio Amateurs',
    tagline: 'Build ham station utilities with RTL-SDR',
    description: 'A practical guide by Dogan Ibrahim covering RTL-SDR projects on the Raspberry Pi 5. Covers signal reception, WSJT-X setup, APRS, ADS-B aircraft tracking, and building your own ham station utilities. Perfect for the Pi+SDR crowd.',
    price: '$40',
    link: 'https://www.elektor.com/products/raspberry-pi-5-for-radio-amateurs',
    badge: 'Pi + SDR',
    badgeColor: '#ffd600',
    specs: ['Pi 5 focused', 'RTL-SDR projects', 'Code included', '2024 edition'],
    icon: '📖',
  },
]

export default function Products() {
  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')

  const filtered = PRODUCTS.filter(p => {
    const matchesCat = activeCategory === 'All' || p.category === activeCategory
    const matchesSearch = !search || 
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase()) ||
      p.tagline.toLowerCase().includes(search.toLowerCase())
    return matchesCat && matchesSearch
  })

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6 }}>
          ham radio gear worth knowing about
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic', lineHeight: 1.6 }}>
          Curated hardware and books for SDR, HF, and Raspberry Pi projects. Opinions are K6WRJ's own. Not sponsored.
        </p>
      </div>

      {/* Search + Category filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="search products..."
          style={{
            fontFamily: 'var(--font-mono)', fontSize: 12,
            background: 'var(--bg1)', border: '1px solid var(--border)',
            color: 'var(--text)', padding: '7px 12px', borderRadius: 6,
            outline: 'none', width: 180
          }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)} style={{
              fontFamily: 'var(--font-mono)', fontSize: 11,
              background: activeCategory === cat ? '#7affb220' : 'var(--bg1)',
              border: `1px solid ${activeCategory === cat ? 'var(--teal)' : 'var(--border)'}`,
              color: activeCategory === cat ? 'var(--teal)' : 'var(--muted)',
              padding: '5px 12px', borderRadius: 5, cursor: 'pointer'
            }}>{cat}</button>
          ))}
        </div>
      </div>

      {/* Product grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {filtered.map(product => (
          <a key={product.id} href={product.link} target="_blank" rel="noreferrer"
            style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'var(--bg1)', border: '1px solid var(--border)',
              borderRadius: 10, padding: 16, height: '100%',
              display: 'flex', flexDirection: 'column', gap: 10,
              transition: 'border-color 0.15s, background 0.15s',
            }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#333'
                e.currentTarget.style.background = 'var(--bg2)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.background = 'var(--bg1)'
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>{product.icon}</span>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                      {product.name}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)', letterSpacing: 1, textTransform: 'uppercase' }}>
                      {product.category}
                    </div>
                  </div>
                </div>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
                  color: product.badgeColor, background: `${product.badgeColor}18`,
                  padding: '2px 7px', borderRadius: 3, whiteSpace: 'nowrap',
                  border: `1px solid ${product.badgeColor}33`
                }}>
                  {product.badge}
                </span>
              </div>

              {/* Tagline */}
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>
                {product.tagline}
              </div>

              {/* Description */}
              <p style={{ fontSize: 12, color: '#777', lineHeight: 1.6, margin: 0, flex: 1 }}>
                {product.description}
              </p>

              {/* Specs */}
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {product.specs.map(s => (
                  <span key={s} style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9,
                    background: 'var(--bg2)', border: '1px solid var(--border)',
                    color: 'var(--dim)', padding: '2px 6px', borderRadius: 3
                  }}>{s}</span>
                ))}
              </div>

              {/* Price + link */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--teal)' }}>
                  {product.price}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--dim)' }}>
                  view ↗
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--dim)' }}>
          no products match "{search}"
        </div>
      )}

      <p style={{ marginTop: 20, fontSize: 11, color: 'var(--dim)', fontStyle: 'italic' }}>
        Prices approximate and subject to change. Links go to manufacturer or retailer sites. No affiliate relationships. 73 de K6WRJ
      </p>
    </div>
  )
}
