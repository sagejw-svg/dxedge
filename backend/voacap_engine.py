"""
Simplified HF propagation estimator for DXEdge.
Models F2 circuit reliability using solar zenith angles
at TX, path midpoint, and RX to create realistic 24h band predictions.
"""
import math

REGIONS = {
    'EU':   (50.0,  10.0, 'Europe'),
    'AS':   (35.0,  90.0, 'Asia'),
    'AF':   ( 0.0,  20.0, 'Africa'),
    'SA':   (-15.0,-60.0, 'South America'),
    'NA':   (40.0, -95.0, 'North America'),
    'OC':   (-25.0,135.0, 'Oceania'),
    'JA':   (36.0, 138.0, 'Japan'),
    'VK':   (-27.0,133.0, 'Australia'),
    'ZL':   (-41.0,174.0, 'New Zealand'),
}

BANDS = [
    ('80m',  3.5), ('60m',  5.3), ('40m', 7.0), ('30m',10.1),
    ('20m', 14.0), ('17m', 18.0), ('15m', 21.0), ('12m', 24.9),
    ('10m', 28.0), ('6m',  50.0),
]


def maidenhead_to_latlon(grid: str) -> tuple[float, float]:
    g = grid.upper()
    lon = (ord(g[0]) - ord('A')) * 20 - 180 + (ord(g[2]) - ord('0')) * 2 + 1
    lat = (ord(g[1]) - ord('A')) * 10 - 90  + (ord(g[3]) - ord('0'))     + 0.5
    if len(g) >= 6:
        lon += (ord(g[4]) - ord('A') + 0.5) * (2/24)
        lat += (ord(g[5]) - ord('A') + 0.5) * (1/24)
    return lat, lon


def great_circle(lat1, lon1, lat2, lon2) -> tuple[float, float]:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dl = math.radians(lon2 - lon1)
    a = math.sin((phi2-phi1)/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dl/2)**2
    dist = R * 2 * math.asin(math.sqrt(max(0, min(1, a))))
    # Azimuth
    y = math.sin(dl) * math.cos(phi2)
    x = math.cos(phi1)*math.sin(phi2) - math.sin(phi1)*math.cos(phi2)*math.cos(dl)
    az = (math.degrees(math.atan2(y, x)) + 360) % 360
    return dist, az


def path_midpoint(lat1, lon1, lat2, lon2) -> tuple[float, float]:
    phi1, lam1 = math.radians(lat1), math.radians(lon1)
    phi2, lam2 = math.radians(lat2), math.radians(lon2)
    Bx = math.cos(phi2) * math.cos(lam2 - lam1)
    By = math.cos(phi2) * math.sin(lam2 - lam1)
    lat_m = math.degrees(math.atan2(
        math.sin(phi1) + math.sin(phi2),
        math.sqrt((math.cos(phi1)+Bx)**2 + By**2)
    ))
    lon_m = math.degrees(lam1 + math.atan2(By, math.cos(phi1) + Bx))
    return lat_m, lon_m


def solar_zenith(lat: float, lon: float, utc_hour: float) -> float:
    """Solar zenith angle in degrees (0=overhead, >90=below horizon)."""
    doy = 152  # ~June 1
    decl = math.radians(23.45 * math.sin(math.radians(360/365 * (doy - 81))))
    hour_angle = math.radians(15 * (utc_hour + lon/15 - 12))
    lat_r = math.radians(lat)
    cos_z = (math.sin(lat_r)*math.sin(decl) +
             math.cos(lat_r)*math.cos(decl)*math.cos(hour_angle))
    return math.degrees(math.acos(max(-1.0, min(1.0, cos_z))))


def f2_layer_strength(zenith: float, sfi: float) -> float:
    """
    F2 layer electron density proxy (0-1 scale).
    Peaks at solar noon, drops at night but never zero (residual ionization).
    """
    if zenith >= 105:
        # Deep night - residual only
        night_floor = max(0.05, (sfi - 60) / 400)
        return night_floor
    elif zenith >= 90:
        # Twilight - transition from night floor to day value
        factor = (105 - zenith) / 15.0
        night_floor = max(0.05, (sfi - 60) / 400)
        day_val = max(0.25, (sfi - 60) / 200)
        return night_floor + factor * (day_val - night_floor)
    else:
        # Daytime - cosine-based model
        cos_z = math.cos(math.radians(zenith))
        base = max(0.25, (sfi - 60) / 200)
        return base + (1.0 - base) * (cos_z ** 0.4)


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

    # Geomagnetic penalty (K-index)
    geo_penalty = max(0.05, 1.0 - max(0, kp - 2) * 0.18)

    # Distance factor: long paths have more hops and absorption
    dist_factor = max(0.35, 1.0 - max(0, dist_sp - 2000) / 20000)

    hours = []
    for h in range(24):
        z_tx  = solar_zenith(tx_lat, tx_lon, h)
        z_mid = solar_zenith(mid_lat, mid_lon, h)
        z_rx  = solar_zenith(rx_lat,  rx_lon,  h)

        # F2 strength at each key point
        f2_tx  = f2_layer_strength(z_tx,  sfi)
        f2_mid = f2_layer_strength(z_mid, sfi)
        f2_rx  = f2_layer_strength(z_rx,  sfi)

        # Combined path F2 - weakest link in the chain
        # Midpoint weighted most (that's where the reflection happens)
        f2_path = (f2_tx * 0.25 + f2_mid * 0.50 + f2_rx * 0.25)

        # MUF estimate: F2 path strength maps to critical frequency
        # At SFI=120 with full sun, foF2 ~ 8 MHz -> MUF for 9000km ~ 30 MHz
        # Scale: f2_path=1.0 -> MUF=28 MHz (great conditions)
        #        f2_path=0.5 -> MUF=14 MHz (moderate)
        #        f2_path=0.1 -> MUF=5 MHz (night/poor)
        muf = max(3.0, f2_path * 28.0 * (sfi / 150) ** 0.5)

        # LUF (D-layer absorption cutoff) rises with solar activity during day
        if z_mid < 90:
            cos_z_mid = math.cos(math.radians(z_mid))
            luf = 2.0 + cos_z_mid * 4.0 * (sfi / 150) ** 0.5
        else:
            luf = 1.5  # night - D layer gone

        bands = {}
        for band, freq in BANDS:
            if freq > muf * 1.08:
                # Above MUF - no propagation
                rel = 0.0
            elif freq > muf * 0.95:
                # Just at MUF - marginal
                rel = max(0.0, 1.0 - (freq/muf - 0.95) / 0.13) * 0.25
            elif freq > muf * 0.75:
                # Near MUF - optimal window
                t = (freq - muf * 0.75) / (muf * 0.20)
                rel = 0.45 + t * 0.30  # 0.45-0.75
            elif freq > muf * 0.50:
                # Moderate - well-established path
                t = (freq - muf * 0.50) / (muf * 0.25)
                rel = 0.30 + t * 0.15  # 0.30-0.45
            elif freq < luf:
                # Below LUF - D-layer absorption
                ratio = freq / luf if luf > 0 else 0
                rel = max(0.0, ratio ** 2) * 0.15
            else:
                # Low MUF ratio - some absorption but path exists
                rel = 0.20

            rel *= geo_penalty * dist_factor
            bands[band] = round(min(0.99, rel), 2)

        best = max(bands, key=bands.get) if bands else '20m'

        hours.append({
            'utc':        h,
            'muf':        round(muf, 1),
            'fof2':       round(f2_path * 8.0, 1),  # approx foF2
            'best_band':  best if bands[best] > 0.15 else None,
            'bands':      bands,
        })

    return {
        'tx_grid':         tx_grid.upper(),
        'region':          region_code.upper(),
        'region_name':     region[2],
        'distance_sp_km':  round(dist_sp),
        'azimuth_sp':      round(az_sp),
        'distance_lp_km':  round(dist_lp),
        'azimuth_lp':      round(az_lp),
        'sfi':             sfi,
        'kp':              kp,
        'ssn':             ssn,
        'hours':           hours,
    }
