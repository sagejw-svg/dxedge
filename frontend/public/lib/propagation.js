/* ------------------------------------------------------------------ *
 * propagation.js — the HF path cartoon shared by the DXEdge games.
 *
 * One F layer at 300 km, hop geometry and MUF from the secant law, foF2
 * from solar flux and local sun, D-layer absorption with cos(zenith) over
 * f squared, a per-hop cost the low bands feel and 10 m does not, and a
 * K-index penalty in the auroral zone. It is meant to be right about the
 * big things (low angle means long hops, a band is a MUF question, 40 m
 * dies at noon, grayline works) and it is not VOACAP.
 *
 * Written for Skip (frontend/public/skip/), where every number in here is
 * checked against closed forms and against real paths by
 * scripts/test_skip.py. Spot Chaser imports the same module so a station
 * is as loud in one game as it would be in the other.
 * ------------------------------------------------------------------ */

export const R_EARTH = 6371, H_LAYER = 300
export const D2R = Math.PI / 180, R2D = 180 / Math.PI
export const SPREAD_DEG = 3   // a real antenna radiates over a fan of angles, so a hop lands over a range
export 
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }
function int(v) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0 }
function smoothstep(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }

/* DXCC entities with an approximate point each, written from memory: good to a
 * few hundred km, which is all a hop model this coarse can use. Rarity 0 common,
 * 1 semi-rare, 2 rare. */
export const ENTITIES = [
  ['VE','Canada',45.4,-75.7,0],['XE','Mexico',19.4,-99.1,0],['KL7','Alaska',61.2,-149.9,0],['KH6','Hawaii',21.3,-157.8,0],
  ['KP4','Puerto Rico',18.4,-66.1,0],['VP9','Bermuda',32.3,-64.8,1],['TI','Costa Rica',9.9,-84.1,0],['HR','Honduras',14.1,-87.2,1],
  ['TG','Guatemala',14.6,-90.5,1],['YN','Nicaragua',12.1,-86.3,1],['HP','Panama',9.0,-79.5,1],['CO','Cuba',23.1,-82.4,0],
  ['HI','Dominican Rep.',18.5,-69.9,0],['6Y','Jamaica',18.0,-76.8,1],['P4','Aruba',12.5,-70.0,0],['PJ2','Curacao',12.2,-69.0,0],
  ['V3','Belize',17.5,-88.2,1],['FM','Martinique',14.6,-61.0,1],['8P','Barbados',13.1,-59.6,1],['9Y','Trinidad',10.7,-61.5,1],
  ['ZF','Cayman Is.',19.3,-81.4,0],['OX','Greenland',64.2,-51.7,1],['TF','Iceland',64.1,-21.9,0],['FP','St Pierre',46.8,-56.2,2],
  ['PY','Brazil',-15.8,-47.9,0],['PP','Brazil',-15.8,-47.9,0],['PT','Brazil',-15.8,-47.9,0],['PU','Brazil',-15.8,-47.9,0],['PR','Brazil',-15.8,-47.9,0],['PV','Brazil',-15.8,-47.9,0],['PW','Brazil',-15.8,-47.9,0],['ZZ','Brazil',-15.8,-47.9,0],['LU','Argentina',-34.6,-58.4,0],['LO','Argentina',-34.6,-58.4,0],['LP','Argentina',-34.6,-58.4,0],['LQ','Argentina',-34.6,-58.4,0],['LR','Argentina',-34.6,-58.4,0],['LS','Argentina',-34.6,-58.4,0],['LT','Argentina',-34.6,-58.4,0],['LV','Argentina',-34.6,-58.4,0],['AY','Argentina',-34.6,-58.4,0],['AZ','Argentina',-34.6,-58.4,0],['CE','Chile',-33.4,-70.6,0],['CA','Chile',-33.4,-70.6,0],['CB','Chile',-33.4,-70.6,0],['XQ','Chile',-33.4,-70.6,0],['XR','Chile',-33.4,-70.6,0],['CX','Uruguay',-34.9,-56.2,0],
  ['OA','Peru',-12.0,-77.0,1],['HK','Colombia',4.7,-74.1,0],['YV','Venezuela',10.5,-66.9,0],['HC','Ecuador',-0.2,-78.5,1],
  ['CP','Bolivia',-16.5,-68.1,1],['ZP','Paraguay',-25.3,-57.6,1],['PZ','Suriname',5.9,-55.2,1],['8R','Guyana',6.8,-58.2,2],
  ['FY','French Guiana',4.9,-52.3,1],['HC8','Galapagos',-0.7,-90.3,1],['CE0Y','Easter Is.',-27.1,-109.4,2],['VP8','Falkland Is.',-51.7,-57.9,1],
  ['PY0F','Fernando de Noronha',-3.9,-32.4,1],['VP8/G','South Georgia',-54.3,-36.5,2],['CE9','Antarctica',-77.8,166.7,1],
  ['G','England',51.5,-0.1,0],['2E','England',51.5,-0.1,0],['M','England',51.5,-0.1,0],['GB','England',51.5,-0.1,0],['MW','Wales',51.5,-3.2,0],['MM','Scotland',55.9,-3.2,0],['MI','Northern Ireland',54.6,-5.9,0],['GW','Wales',51.5,-3.2,0],['GM','Scotland',55.9,-3.2,0],['EI','Ireland',53.3,-6.3,0],['F','France',48.9,2.3,0],['TM','France',48.9,2.3,0],
  ['DL','Germany',52.5,13.4,0],['DA','Germany',52.5,13.4,0],['DB','Germany',52.5,13.4,0],['DC','Germany',52.5,13.4,0],['DD','Germany',52.5,13.4,0],['DE','Germany',52.5,13.4,0],['DF','Germany',52.5,13.4,0],['DG','Germany',52.5,13.4,0],['DH','Germany',52.5,13.4,0],['DJ','Germany',52.5,13.4,0],['DK','Germany',52.5,13.4,0],['DM','Germany',52.5,13.4,0],['DO','Germany',52.5,13.4,0],['DP','Germany',52.5,13.4,0],['DQ','Germany',52.5,13.4,0],['DR','Germany',52.5,13.4,0],['EA','Spain',40.4,-3.7,0],['EB','Spain',40.4,-3.7,0],['EC','Spain',40.4,-3.7,0],['ED','Spain',40.4,-3.7,0],['EE','Spain',40.4,-3.7,0],['EF','Spain',40.4,-3.7,0],['EG','Spain',40.4,-3.7,0],['EH','Spain',40.4,-3.7,0],['CT','Portugal',38.7,-9.1,0],['I','Italy',41.9,12.5,0],['IK','Italy',41.9,12.5,0],['IZ','Italy',41.9,12.5,0],['IW','Italy',41.9,12.5,0],['IU','Italy',41.9,12.5,0],['IN3','Italy',46.1,11.1,0],['IQ','Italy',41.9,12.5,0],['IR','Italy',41.9,12.5,0],
  ['PA','Netherlands',52.4,4.9,0],['ON','Belgium',50.8,4.4,0],['HB9','Switzerland',46.9,7.4,0],['OE','Austria',48.2,16.4,0],
  ['OK','Czechia',50.1,14.4,0],['SP','Poland',52.2,21.0,0],['HA','Hungary',47.5,19.0,0],['YO','Romania',44.4,26.1,0],
  ['LZ','Bulgaria',42.7,23.3,0],['SV','Greece',38.0,23.7,0],['9A','Croatia',45.8,16.0,0],['S5','Slovenia',46.1,14.5,0],
  ['YU','Serbia',44.8,20.5,0],['OZ','Denmark',55.7,12.6,0],['SM','Sweden',59.3,18.1,0],['LA','Norway',59.9,10.8,0],
  ['OH','Finland',60.2,24.9,0],['ES','Estonia',59.4,24.8,0],['YL','Latvia',56.9,24.1,0],['LY','Lithuania',54.7,25.3,0],
  ['UA','European Russia',55.8,37.6,0],['RA','European Russia',55.8,37.6,0],['RD','European Russia',55.8,37.6,0],['RK','European Russia',55.8,37.6,0],['RN','European Russia',55.8,37.6,0],['RU','European Russia',55.8,37.6,0],['RV','European Russia',55.8,37.6,0],['RW','European Russia',55.8,37.6,0],['RX','European Russia',55.8,37.6,0],['RZ','European Russia',55.8,37.6,0],['R','European Russia',55.8,37.6,0],['UB','European Russia',55.8,37.6,0],['UC','European Russia',55.8,37.6,0],['UD','European Russia',55.8,37.6,0],['UE','European Russia',55.8,37.6,0],['UF','European Russia',55.8,37.6,0],['UG','European Russia',55.8,37.6,0],['UH','European Russia',55.8,37.6,0],['UI','European Russia',55.8,37.6,0],['UR','Ukraine',50.5,30.5,0],['EW','Belarus',53.9,27.6,0],['TA','Turkey',39.9,32.9,0],
  ['4X','Israel',31.8,35.2,0],['5B','Cyprus',35.2,33.4,0],['9H','Malta',35.9,14.5,1],['EA8','Canary Is.',28.1,-15.4,0],
  ['CU','Azores',37.7,-25.7,1],['CT3','Madeira',32.7,-16.9,1],['JW','Svalbard',78.2,15.6,1],['OY','Faroe Is.',62.0,-6.8,1],
  ['ZB2','Gibraltar',36.1,-5.4,1],['LX','Luxembourg',49.6,6.1,1],['TK','Corsica',42.0,9.0,1],['IS0','Sardinia',39.2,9.1,1],
  ['OH0','Aland Is.',60.1,19.9,1],['UA2','Kaliningrad',54.7,20.5,1],['3A','Monaco',43.7,7.4,2],['HV','Vatican',41.9,12.45,2],
  ['ZS','South Africa',-33.9,18.4,0],['5N','Nigeria',9.1,7.4,1],['CN','Morocco',33.6,-7.6,0],['7X','Algeria',36.8,3.1,1],
  ['3V','Tunisia',36.8,10.2,1],['SU','Egypt',30.0,31.2,1],['ST','Sudan',15.6,32.5,2],['ET','Ethiopia',9.0,38.7,2],
  ['5Z','Kenya',-1.3,36.8,1],['5H','Tanzania',-6.8,39.3,1],['9J','Zambia',-15.4,28.3,1],['Z2','Zimbabwe',-17.8,31.0,1],
  ['A2','Botswana',-24.7,25.9,1],['V5','Namibia',-22.6,17.1,1],['D2','Angola',-8.8,13.2,2],['9Q','DR Congo',-4.3,15.3,2],
  ['TR','Gabon',0.4,9.5,2],['TU','Ivory Coast',5.3,-4.0,1],['9G','Ghana',5.6,-0.2,1],['6W','Senegal',14.7,-17.4,1],
  ['D4','Cape Verde',14.9,-23.5,1],['3B8','Mauritius',-20.2,57.5,1],['FR','Reunion',-21.1,55.5,1],['5R','Madagascar',-18.9,47.5,1],
  ['S9','Sao Tome',0.3,6.7,2],['ZD7','St Helena',-15.9,-5.7,2],['ZD8','Ascension',-7.9,-14.4,1],['3Y/B','Bouvet',-54.4,3.4,2],
  ['FT/Z','Kerguelen',-49.3,69.3,2],['TZ','Mali',12.6,-8.0,2],['5T','Mauritania',18.1,-15.9,2],['XT','Burkina Faso',12.4,-1.5,2],
  ['TJ','Cameroon',3.9,11.5,2],['C9','Mozambique',-25.9,32.6,1],['7Q','Malawi',-14.0,33.8,2],['ZD9','Tristan da Cunha',-37.1,-12.3,2],
  ['E3','Eritrea',15.3,38.9,2],['T5','Somalia',2.0,45.3,2],['3DA','Eswatini',-26.3,31.1,2],['C5','The Gambia',13.5,-16.6,2],
  ['JA','Japan',35.7,139.7,0],['7K','Japan',35.7,139.7,0],['7L','Japan',35.7,139.7,0],['7M','Japan',35.7,139.7,0],['7N','Japan',35.7,139.7,0],['8J','Japan',35.7,139.7,0],['HL','South Korea',37.6,127.0,0],['BY','China',39.9,116.4,0],['BV','Taiwan',25.0,121.5,0],
  ['VR','Hong Kong',22.3,114.2,1],['VU','India',28.6,77.2,0],['HS','Thailand',13.8,100.5,0],['9M2','West Malaysia',3.1,101.7,1],
  ['9V','Singapore',1.3,103.8,1],['YB','Indonesia',-6.2,106.8,0],['DU','Philippines',14.6,121.0,0],['3W','Vietnam',21.0,105.8,1],
  ['XW','Laos',17.9,102.6,2],['XU','Cambodia',11.6,104.9,2],['XZ','Myanmar',16.9,96.2,2],['JT','Mongolia',47.9,106.9,1],
  ['UA9','Asiatic Russia',55.0,82.9,0],['UA0','Far East Russia',43.1,131.9,1],['AP','Pakistan',33.7,73.0,1],['4S','Sri Lanka',6.9,79.9,1],
  ['S2','Bangladesh',23.8,90.4,2],['9N','Nepal',27.7,85.3,2],['A5','Bhutan',27.5,89.6,2],['8Q','Maldives',4.2,73.5,1],
  ['UN','Kazakhstan',51.2,71.4,1],['UK','Uzbekistan',41.3,69.3,1],['EX','Kyrgyzstan',42.9,74.6,1],['EY','Tajikistan',38.6,68.8,2],
  ['EZ','Turkmenistan',37.9,58.4,2],['YA','Afghanistan',34.5,69.2,2],['EP','Iran',35.7,51.4,1],['YI','Iraq',33.3,44.4,2],
  ['HZ','Saudi Arabia',24.7,46.7,1],['A4','Oman',23.6,58.4,1],['A6','UAE',24.5,54.4,0],['A7','Qatar',25.3,51.5,1],
  ['A9','Bahrain',26.2,50.6,1],['9K','Kuwait',29.4,48.0,1],['7O','Yemen',15.4,44.2,2],['OD','Lebanon',33.9,35.5,1],
  ['JY','Jordan',31.9,35.9,1],['4L','Georgia',41.7,44.8,1],['EK','Armenia',40.2,44.5,1],['4J','Azerbaijan',40.4,49.9,1],
  ['P5','North Korea',39.0,125.8,2],['VU4','Andaman Is.',11.7,92.7,2],['9M6','East Malaysia',6.0,116.1,1],['V85','Brunei',4.9,114.9,1],
  ['4W','Timor-Leste',-8.6,125.6,2],['JD1/O','Ogasawara',27.1,142.2,1],['XX9','Macao',22.2,113.5,2],['BS7','Scarborough Reef',15.1,117.8,2],
  ['VK','Australia',-33.9,151.2,0],['AX','Australia',-33.9,151.2,0],['VI','Australia',-33.9,151.2,0],['ZL','New Zealand',-41.3,174.8,0],['P2','Papua New Guinea',-9.4,147.2,1],['H4','Solomon Is.',-9.4,160.0,1],
  ['YJ','Vanuatu',-17.7,168.3,1],['3D2','Fiji',-18.1,178.4,1],['A3','Tonga',-21.1,-175.2,1],['5W','Samoa',-13.8,-171.8,1],
  ['KH8','American Samoa',-14.3,-170.7,1],['T2','Tuvalu',-8.5,179.2,2],['T30','West Kiribati',1.4,173.0,2],['T32','East Kiribati',1.9,-157.4,2],
  ['V6','Micronesia',6.9,158.2,1],['V7','Marshall Is.',7.1,171.4,1],['T8','Palau',7.5,134.6,1],['KH2','Guam',13.5,144.8,0],
  ['KH0','Mariana Is.',15.2,145.7,1],['C2','Nauru',-0.5,166.9,2],['E51/S','South Cook Is.',-21.2,-159.8,1],['FO','French Polynesia',-17.5,-149.6,1],
  ['FK','New Caledonia',-22.3,166.4,1],['FW','Wallis and Futuna',-13.3,-176.2,2],['VP6','Pitcairn',-25.1,-130.1,2],['VK9L','Lord Howe',-31.5,159.1,2],
  ['VK9N','Norfolk Is.',-29.0,168.0,1],['VK9X','Christmas Is.',-10.5,105.6,2],['VK9C','Cocos Keeling',-12.2,96.8,2],['ZL7','Chatham Is.',-44.0,-176.5,1],
  ['ZL8','Kermadec',-29.3,-177.9,2],['KH1','Baker and Howland',0.2,-176.5,2],['KH3','Johnston Atoll',16.7,-169.5,2],['KH4','Midway',28.2,-177.4,2],
  ['KH5','Palmyra',5.9,-162.1,2],['KH9','Wake Is.',19.3,166.6,2],['FO/C','Clipperton',10.3,-109.2,2],['FO/M','Marquesas',-9.0,-139.5,2],
  ['FO/A','Austral Is.',-23.4,-149.5,2],['E51/N','North Cook Is.',-10.4,-161.0,2],['ZK3','Tokelau',-9.2,-171.8,2],['T31','Central Kiribati',-3.9,-159.4,2],
  ['VK0M','Macquarie',-54.6,158.9,2],['VK0H','Heard Is.',-53.1,73.5,2],['3D2/R','Rotuma',-12.5,177.1,2],['VP8/O','South Orkney',-60.7,-45.6,2],
]

/* --- geography ------------------------------------------------------ */
export function gridToLatLon(g) {
  g = (g || '').toUpperCase()
  if (!/^[A-R]{2}[0-9]{2}([A-X]{2})?$/.test(g)) return null
  let lon = (g.charCodeAt(0) - 65) * 20 - 180, lat = (g.charCodeAt(1) - 65) * 10 - 90
  lon += int(g[2]) * 2; lat += int(g[3])
  if (g.length === 6) { lon += (g.charCodeAt(4) - 65) * (2 / 24) + 1 / 24; lat += (g.charCodeAt(5) - 65) * (1 / 24) + 1 / 48 }
  else { lon += 1; lat += 0.5 }
  return { lat, lon }
}
export function gcDist(a, b) {
  const p1 = a.lat * D2R, p2 = b.lat * D2R, dl = (b.lon - a.lon) * D2R
  const h = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)))
}
export function gcBearing(a, b) {
  const p1 = a.lat * D2R, p2 = b.lat * D2R, dl = (b.lon - a.lon) * D2R
  const y = Math.sin(dl) * Math.cos(p2), x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)
  return ((Math.atan2(y, x) * R2D) + 360) % 360
}
/* point a fraction of the way along the great circle from a to b; fractions past 1 keep going round */
export function gcPoint(a, b, frac) {
  const p1 = a.lat * D2R, l1 = a.lon * D2R, p2 = b.lat * D2R, l2 = b.lon * D2R
  const d = gcDist(a, b) / R_EARTH
  if (d < 1e-6) return { lat: a.lat, lon: a.lon }
  const A = Math.sin((1 - frac) * d) / Math.sin(d), B = Math.sin(frac * d) / Math.sin(d)
  const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2)
  const y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2)
  const z = A * Math.sin(p1) + B * Math.sin(p2)
  return { lat: Math.atan2(z, Math.sqrt(x * x + y * y)) * R2D, lon: Math.atan2(y, x) * R2D }
}

/* --- the sun ---------------------------------------------------------- */
export function declination(date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0)
  const N = (date.getTime() - start) / 86400000
  return 23.44 * Math.sin(2 * Math.PI * (284 + N) / 365) * D2R
}
/* cosine of the solar zenith angle: 1 is sun overhead, 0 is the terminator, negative is night */
export function cosZenith(lat, lon, utcHours, decl) {
  const Hh = (15 * (utcHours - 12) + lon) * D2R
  return Math.sin(lat * D2R) * Math.sin(decl) + Math.cos(lat * D2R) * Math.cos(decl) * Math.cos(Hh)
}

/* --- the ionosphere, as a cartoon ------------------------------------------- */
export function hopLen(thetaDeg, h = H_LAYER) {
  const t = thetaDeg * D2R
  return 2 * R_EARTH * (Math.acos(R_EARTH * Math.cos(t) / (R_EARTH + h)) - t)
}
export function mufFactor(thetaDeg, h = H_LAYER) {
  const sinPhi = R_EARTH * Math.cos(thetaDeg * D2R) / (R_EARTH + h)
  return 1 / Math.sqrt(1 - sinPhi * sinPhi)
}
/* takeoff angle whose hop is a given length, by bisection */
export function angleForHop(km) {
  if (km >= hopLen(0)) return 0
  let lo = 0, hi = 89
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (hopLen(mid) > km) lo = mid; else hi = mid }
  return (lo + hi) / 2
}
/* F2 critical frequency, MHz */
export function foF2(cosZ, lat, sfi, k) {
  const sf = clamp((sfi - 70) / 130, 0, 1.2)
  const fDay = 6 + 7 * sf, fNight = 3.2 + 2.8 * sf
  const s = smoothstep(-0.25, 0.55, cosZ)           // the F layer lingers well past sunset
  let f = fNight + (fDay - fNight) * s
  f *= 1 - 0.22 * (Math.abs(lat) / 90) ** 2         // thinner toward the poles
  f *= 1 + 0.15 * Math.max(0, 1 - Math.abs(lat) / 30) // and fatter in the tropics: the equatorial anomaly, roughly
  if (Math.abs(lat) > 55) f *= 1 - 0.06 * k          // geomagnetic activity hits the auroral zone first
  return f
}
/* the low bands pay per hop even in the dark: ground and residual losses that 160 m
 * feels and 10 m barely notices */
export function lowBandDb(fMHz) { return 30 / fMHz }
/* D-layer absorption for one pass, dB: with the sun, against the square of the frequency */
export function absorptionDb(cosZ, fMHz, lat, k, flare) {
  let a = 1000 * Math.max(0, cosZ) / (fMHz * fMHz)
  if (flare) a *= 6
  if (Math.abs(lat) > 58 && k >= 3) a += 2 * k
  return a
}
export const GROUND_DB = 5   // ground bounce plus a little spreading per extra hop
export function sUnits(lossDb) { return clamp(9 - (lossDb - 12) / 6, 0, 9.9) }

/* Run one attempt from qth to tgt. Returns hops for drawing and a verdict with the reason.
 * Order of judgement: does the ray come back down at all (MUF), does it come
 * down where the target is (skip zone), and only then is it loud enough. */
export function simulate({ f, theta, D, qth, tgt, utc, decl, sfi, k, flare }) {
  const d = hopLen(theta), dLo = hopLen(Math.min(85, theta + SPREAD_DEG)), dHi = hopLen(Math.max(0, theta - SPREAD_DEG))
  const M = mufFactor(theta)
  let cover = 0
  for (let n = 1; n <= 14; n++) if (D >= n * dLo - 1 && D <= n * dHi + 1) { cover = n; break }
  const hopKm = cover ? D / cover : d
  const hops = []
  let loss = 0, absorbed = 0, ground = 0, low = 0, s = 0, n = 0
  while (n < 14) {
    n++
    const apexS = s + hopKm / 2
    const p = gcPoint(qth, tgt, apexS / D)
    const cz = cosZenith(p.lat, p.lon, utc, decl)
    const muf = foF2(cz, p.lat, sfi, k) * M
    const hop = { n, start: s, apex: apexS, land: s + hopKm, muf, cosZ: cz, lat: p.lat, escaped: f > muf, absorb: 0 }
    hops.push(hop)
    if (hop.escaped) return { hops, verdict: 'muf', hop, mufLow: foF2(cz, p.lat, sfi, k) * mufFactor(3), loss }
    const a = absorptionDb(cz, f, p.lat, k, flare), l = lowBandDb(f)
    hop.absorb = a
    absorbed += a; low += l; loss += a + l
    s += hopKm
    if (cover ? n === cover : s > D) break
    ground += GROUND_DB; loss += GROUND_DB
  }
  if (!cover) return { hops, verdict: 'skip', loss, d, dLo, dHi }
  const S = sUnits(loss)
  return { hops, verdict: S >= 2 ? 'worked' : 'weak', loss, absorbed, ground, low, S, n: cover }
}

/* --- callsign to entity ------------------------------------------------ *
 * Longest-prefix match against the table above, after stripping the
 * portable parts of a call. A spot's own dxcc name is a better answer when
 * the backend supplies one, so entityFor() takes it first and only falls
 * back to the prefix.
 */
/* Entities Skip does not use as DX targets from a US station but that turn up
 * constantly in a spot feed. Kept out of ENTITIES so Skip's target picker is
 * unchanged; both tables are searched when resolving a callsign. */
export const EXTRA_ENTITIES = [
  ['K', 'United States', 39.8, -98.6, 0], ['W', 'United States', 39.8, -98.6, 0], ['N', 'United States', 39.8, -98.6, 0],
  ['AA', 'United States', 39.8, -98.6, 0], ['AB', 'United States', 39.8, -98.6, 0], ['AC', 'United States', 39.8, -98.6, 0],
  ['AD', 'United States', 39.8, -98.6, 0], ['AE', 'United States', 39.8, -98.6, 0], ['AF', 'United States', 39.8, -98.6, 0],
  ['AG', 'United States', 39.8, -98.6, 0], ['AI', 'United States', 39.8, -98.6, 0], ['AJ', 'United States', 39.8, -98.6, 0],
  ['AK', 'United States', 39.8, -98.6, 0], ['AL', 'United States', 39.8, -98.6, 0],
  ['KP2', 'US Virgin Islands', 17.7, -64.8, 1], ['NP2', 'US Virgin Islands', 17.7, -64.8, 1],
  ['NP4', 'Puerto Rico', 18.4, -66.1, 0], ['WP4', 'Puerto Rico', 18.4, -66.1, 0],
  ['NH6', 'Hawaii', 21.3, -157.8, 0], ['WH6', 'Hawaii', 21.3, -157.8, 0], ['AH6', 'Hawaii', 21.3, -157.8, 0],
  ['NL7', 'Alaska', 61.2, -149.9, 0], ['WL7', 'Alaska', 61.2, -149.9, 0], ['AL7', 'Alaska', 61.2, -149.9, 0], ['KL', 'Alaska', 61.2, -149.9, 0],
]

const ALL_ENTITIES = [...ENTITIES, ...EXTRA_ENTITIES]
const BY_PREFIX = ALL_ENTITIES.slice().sort((a, b) => b[0].length - a[0].length)
const BY_NAME = new Map(ALL_ENTITIES.map(e => [e[1].toUpperCase(), e]))

/* A US call carries its region in the digit, and a path to W1 is nothing like a
 * path to W6, so place the big country by call area rather than at its centroid.
 * Rough centres of the ten districts. */
const US_AREA = {
  0: [41.5, -96.0], 1: [42.5, -71.5], 2: [40.9, -74.0], 3: [39.9, -75.6], 4: [34.5, -83.5],
  5: [32.5, -97.0], 6: [36.5, -119.5], 7: [44.0, -114.0], 8: [40.5, -82.5], 9: [41.0, -88.5],
}

/* A call like SV9/S53R is in SV9; DF9ZV/P is in DF. Take whichever part
 * carries the prefix: the shorter side when it is a real prefix, else the
 * side that is not a bare P, M, QRP or a digit. */
export function callPrefixPart(call) {
  const parts = String(call || '').toUpperCase().split('/')
  if (parts.length === 1) return parts[0]
  const junk = /^(P|M|MM|AM|QRP|A|B|\d{1,2})$/
  const real = parts.filter(p => p && !junk.test(p))
  if (!real.length) return parts[0]
  if (real.length === 1) return real[0]
  return real.reduce((a, b) => (a.length <= b.length ? a : b))
}

export function entityForCall(call) {
  const c = callPrefixPart(call)
  if (!c) return null
  for (const e of BY_PREFIX) if (c.startsWith(e[0])) return e
  return null
}

export function entityForName(name) {
  return BY_NAME.get(String(name || '').toUpperCase()) || null
}

/* Prefer the spot's own DXCC name, fall back to the callsign's prefix. */
export function entityFor(call, dxccName) {
  return entityForName(dxccName) || entityForCall(call)
}

/* Where to put a spotted station on the globe: its entity, refined by US call
 * area when that is what it is. Returns null when the prefix is not in the
 * table, which is the honest answer for a game that then says so. */
export function locateCall(call, dxccName) {
  const e = entityFor(call, dxccName)
  if (!e) return null
  const out = { prefix: e[0], name: e[1], lat: e[2], lon: e[3], rarity: e[4], area: null }
  if (out.name === 'United States') {
    /* W1AW/0 is W1AW operating in the zero call area, so a trailing digit
     * after the slash wins over the digit in the base call. */
    const parts = String(call || '').toUpperCase().split('/')
    const suffix = parts.length > 1 ? parts[parts.length - 1] : ''
    const c = /^\d$/.test(suffix) ? suffix : callPrefixPart(call)
    const m = c.match(/\d/)
    if (m && US_AREA[m[0]]) {
      out.lat = US_AREA[m[0]][0]
      out.lon = US_AREA[m[0]][1]
      out.area = m[0]
    }
  }
  return out
}

/* The best a station can sound from here right now: the loudest arrival over
 * takeoff angles a normal wire or beam actually radiates at. Returns the same
 * shape simulate() does, plus the angle that won. */
export function bestPath(opts) {
  let best = null
  for (let theta = 3; theta <= 45; theta += 1) {
    const r = simulate({ ...opts, theta })
    if (r.verdict === 'skip') continue
    if (!best || (r.S || 0) > (best.S || 0)) { best = r; best.theta = theta }
  }
  if (best) return best
  return { ...simulate({ ...opts, theta: 12 }), theta: 12 }
}
