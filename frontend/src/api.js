const BASE = '/api'

async function get(path) {
  const r = await fetch(`${BASE}${path}`)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

async function post(path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(err.detail || `HTTP ${r.status}`)
  }
  return r.json()
}

export const api = {
  solar: () => get('/solar'),
  spots: (band, mode) => get(`/spots?limit=200${band ? `&band=${band}` : ''}${mode ? `&mode=${mode}` : ''}`),
  psk: (grid) => get(`/psk?grid=${grid || 'CM95'}`),
  lotw: (login, password) => post('/lotw', { login, password }),
  health: () => get('/health'),
  voacap: (grid, region) => get(`/voacap?grid=${grid || 'CM95'}&region=${region || 'EU'}`),
}

// Added separately to avoid overwrite
