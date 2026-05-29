/**
 * Parse ADIF text into array of QSO objects.
 * Builds a needs matrix: { DXCC: { band: { mode: 'confirmed'|'worked' } } }
 */

export function parseADIF(adif) {
  const qsos = []
  const records = adif.split(/<eor>/i)
  for (const rec of records) {
    const fields = {}
    const matches = rec.matchAll(/<(\w+)(?::\d+)?(?::[^>]*)?>([^<]*)/gi)
    for (const m of matches) {
      fields[m[1].toUpperCase()] = m[2].trim()
    }
    if (fields.CALL) qsos.push(fields)
  }
  return qsos
}

export function buildNeedsMatrix(qsos) {
  // matrix[dxcc][band][mode] = true (confirmed)
  const matrix = {}
  for (const q of qsos) {
    const dxcc = q.DXCC || q.COUNTRY || q.APP_LOTW_DXCC || ''
    const band = (q.BAND || '').toLowerCase()
    const mode = normalizeMode(q.MODE || '')
    if (!dxcc || !band || !mode) continue
    if (!matrix[dxcc]) matrix[dxcc] = {}
    if (!matrix[dxcc][band]) matrix[dxcc][band] = {}
    matrix[dxcc][band][mode] = true
  }
  return matrix
}

export function normalizeMode(mode) {
  const m = mode.toUpperCase()
  if (['FT8', 'FT4', 'JS8'].includes(m)) return m
  if (['SSB', 'USB', 'LSB', 'FM', 'AM'].includes(m)) return 'SSB'
  if (m === 'CW') return 'CW'
  if (['RTTY', 'PSK31', 'PSK63', 'OLIVIA'].includes(m)) return 'DIGI'
  return m || 'SSB'
}

export function isNeeded(matrix, dxcc, band, mode) {
  if (!matrix || !dxcc) return false
  const normalMode = normalizeMode(mode)
  return !matrix[dxcc]?.[band]?.[normalMode]
}

export function getNeededSpots(spots, matrix) {
  if (!matrix || Object.keys(matrix).length === 0) return spots
  return spots.filter(s => isNeeded(matrix, s.dxcc || s.callsign, s.band, s.mode))
}

export function getDXCCSummary(matrix) {
  const summary = []
  for (const [dxcc, bands] of Object.entries(matrix)) {
    const bandList = Object.keys(bands)
    const modes = [...new Set(bandList.flatMap(b => Object.keys(bands[b])))]
    summary.push({ dxcc, bands: bandList, modes, count: bandList.length })
  }
  return summary.sort((a, b) => a.dxcc.localeCompare(b.dxcc))
}
