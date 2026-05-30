"""
Simplified HF propagation prediction engine.
Uses real solar data (SFI, K-index) and great circle geometry to estimate
hourly band reliability for point-to-point paths.
Based on ionospheric propagation principles from VOACAP/IONCAP literature.
"""
import math
from datetime import datetime, timezone

# Target regions: (lat, lon, display_name)
REGIONS = {
    'EU':  (51.0,   10.0, 'Europe'),
    'JA':  (36.0,  138.0, 'Japan'),
    'VK':  (-25.0, 134.0, 'Australia/NZ'),
    'AS':  (45.0,   90.0, 'Central Asia'),
    'AF':  ( 0.0,   20.0, 'Africa'),
    'SA':  (-15.0, -60.0, 'South America'),
    'NA':  (45.0,  -75.0, 'NE North America'),
    'UA9': (55.0,   60.0, 'Russia/Siberia'),
}

BANDS = [
    ('10m', 28.5),
    ('12m', 24.9),
    ('15m', 21.2),
    ('17m', 18.1),
    ('20m', 14.2),
    ('30m', 10.1),
    ('40m',  7.1),
    ('80m',  3.75),
]


def maidenhead_to_latlon(grid: str) -> tuple[float, float]:
    g = grid.upper().strip()
    if len(g) < 4:
        return 32.7, -117.1  # Default: San Diego
    lon = (ord(g[0]) - 65) * 20 - 180 + int(g[2]) * 2 + 1.0
    lat = (ord(g[1]) - 65) * 10 - 90  + int(g[3]) * 1 + 0.5
    return lat, lon


def great_circle(lat1, lon1, lat2, lon2) -> tuple[float, float]:
    """Returns (distance_km, azimuth_degrees)"""
    R = 6371.0
    la1, lo1, la2, lo2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = la2 - la1
    dlon = lo2 - lo1
    a = math.sin(dlat/2)**2 + math.cos(la1)*math.cos(la2)*math.sin(dlon/2)**2
    dist = R * 2 * math.asin(math.sqrt(max(0, min(1, a))))
    y = math.sin(dlon) * math.cos(la2)
    x = math.cos(la1)*math.sin(la2) - math.sin(la1)*math.cos(la2)*math.cos(dlon)
    az = math.degrees(math.atan2(y, x)) % 360
    return dist, az


def path_midpoint(lat1, lon1, lat2, lon2) -> tuple[float, float]:
    la1, lo1, la2, lo2 = map(math.radians, [lat1, lon1, lat2, lon2])
    bx = math.cos(la2) * math.cos(lo2 - lo1)
    by = math.cos(la2) * math.sin(lo2 - lo1)
    lat_m = math.atan2(math.sin(la1)+math.sin(la2), math.sqrt((math.cos(la1)+bx)**2+by**2))
    lon_m = lo1 + math.atan2(by, math.cos(la1)+bx)
    return math.degrees(lat_m), math.degrees(lon_m)


def solar_zenith(lat: float, lon: float, utc_hour: float) -> float:
    """Solar zenith angle in degrees"""
    now = datetime.now(timezone.utc)
    doy = now.timetuple().tm_yday
    decl = math.radians(23.45 * math.sin(math.radians((360/365.0)*(doy - 80))))
    hour_angle = math.radians((utc_hour + lon/15.0 - 12.0) * 15.0)
    lat_r = math.radians(lat)
    cos_z = (math.sin(lat_r)*math.sin(decl) +
             math.cos(lat_r)*math.cos(decl)*math.cos(hour_angle))
    return math.degrees(math.acos(max(-1.0, min(1.0, cos_z))))


def estimate_fof2(sfi: float, zenith: float) -> float:
    """Estimate F2 layer critical frequency (MHz)"""
    if zenith >= 102:
        return max(2.5, 0.003 * sfi + 1.5)
    elif zenith >= 90:
        # Twilight transition
        factor = (102 - zenith) / 12.0
        night = max(2.5, 0.003 * sfi + 1.5)
        cos_z = math.cos(math.radians(80))
        day = max(3.0, 0.009 * math.sqrt(sfi) * (cos_z ** 0.3) * 8 + 2)
        return night + factor * (day - night)
    else:
        cos_z = math.cos(math.radians(zenith))
        return max(3.0, 0.009 * math.sqrt(sfi) * (cos_z ** 0.3) * 8 + 2)


def muf_multiplier(dist_km: float) -> float:
    """MUF multiplication factor for F2 paths"""
    if dist_km < 500:   return 1.6
    if dist_km < 1000:  return 2.0
    if dist_km < 2000:  return 2.8
    if dist_km < 4000:  return 3.5
    if dist_km < 8000:  return 4.2
    return 4.8


def circuit_reliability(freq: float, muf: float, fof2: float,
                        dist_km: float, kp: float) -> float:
    """Estimate reliability (0.0-1.0) for given freq/path/conditions"""
    # Geomagnetic penalty
    geo = max(0.1, 1.0 - max(0, kp - 2) * 0.12)

    luf = max(1.8, fof2 * 0.9)  # Lowest usable frequency

    if freq > muf * 1.05:
        return 0.0  # Above MUF

    if freq < luf:
        ratio = freq / luf
        return max(0.0, ratio ** 2.5) * 0.25 * geo

    # Usable range
    muf_ratio = freq / muf
    if muf_ratio > 0.90:
        rel = max(0.0, 1.0 - (muf_ratio - 0.90) / 0.15) * 0.8
    elif muf_ratio > 0.70:
        rel = 0.85
    elif muf_ratio > 0.50:
        rel = 0.90
    else:
        rel = 0.75  # Too far below MUF, lower layers absorb

    return rel * geo


def predict_path(tx_grid: str, region_code: str,
                 sfi: float, kp: float, ssn: float) -> dict:
    """Full 24-hour prediction for a TX grid to target region."""
    region = REGIONS.get(region_code.upper())
    if not region:
        raise ValueError(f"Unknown region: {region_code}")

    tx_lat, tx_lon = maidenhead_to_latlon(tx_grid)
    rx_lat, rx_lon = region[0], region[1]

    dist_sp, az_sp = great_circle(tx_lat, tx_lon, rx_lat, rx_lon)
    dist_lp = max(0, 40075.0 - dist_sp)
    az_lp = (az_sp + 180) % 360

    mid_lat, mid_lon = path_midpoint(tx_lat, tx_lon, rx_lat, rx_lon)
    muf_mult = muf_multiplier(dist_sp)

    hours = []
    for h in range(24):
        z_tx  = solar_zenith(tx_lat, tx_lon, h)
        z_mid = solar_zenith(mid_lat, mid_lon, h)
        z_rx  = solar_zenith(rx_lat, rx_lon, h)
        worst = max(z_tx, z_mid, z_rx)

        fof2 = estimate_fof2(sfi, worst)
        muf  = fof2 * muf_mult

        bands = {}
        for band, freq in BANDS:
            bands[band] = round(circuit_reliability(freq, muf, fof2, dist_sp, kp), 2)

        # Best band this hour
        best = max(bands, key=bands.get) if bands else '20m'

        hours.append({
            'utc': h,
            'muf': round(muf, 1),
            'fof2': round(fof2, 1),
            'best_band': best if bands[best] > 0.3 else None,
            'bands': bands,
        })

    return {
        'tx_grid': tx_grid.upper(),
        'region': region_code.upper(),
        'region_name': region[2],
        'distance_sp_km': round(dist_sp),
        'azimuth_sp': round(az_sp),
        'distance_lp_km': round(dist_lp),
        'azimuth_lp': round(az_lp),
        'sfi': sfi,
        'kp': kp,
        'ssn': ssn,
        'hours': hours,
    }
