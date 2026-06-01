from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import JSONResponse
from ratelimit import lotw_limiter, api_limiter, compute_limiter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import asyncio
import logging
from contextlib import asynccontextmanager

from solar import SolarPoller
from cluster import ClusterPoller
from pskreporter import PSKPoller
from lotw import query_lotw
from cache import cache
from voacap_engine import predict_path, REGIONS
from database import init_db, load_solar_history, load_recent_spots
from pota import fetch_pota, fetch_sota
from contests import fetch_contests
from satellites import fetch_tles, current_positions, predict_passes, grid_to_latlon as sat_grid_to_latlon
from alerts import run_alert_loop
from database import save_subscription, delete_subscription

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)



# --- WebSocket connection manager ---
class SpotBroadcaster:
    def __init__(self):
        self._clients: set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self._clients.add(ws)
        logger.info(f"WS client connected ({len(self._clients)} total)")

    def disconnect(self, ws: WebSocket):
        self._clients.discard(ws)
        logger.info(f"WS client disconnected ({len(self._clients)} remaining)")

    async def broadcast(self, spot: dict):
        if not self._clients:
            return
        import json
        msg = json.dumps({"type": "spot", "data": spot})
        dead = set()
        for ws in self._clients:
            try:
                await ws.send_text(msg)
            except Exception:
                dead.add(ws)
        self._clients -= dead

broadcaster = SpotBroadcaster()

solar_poller = SolarPoller()
cluster_poller = ClusterPoller()
psk_poller = PSKPoller()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start background pollers
    tasks = [
        asyncio.create_task(solar_poller.run()),
        asyncio.create_task(cluster_poller.run()),
        asyncio.create_task(psk_poller.run()),
    ]
    init_db()
    asyncio.create_task(run_alert_loop())
    logger.info("DXEdge pollers started")
    # Register graceful shutdown handler
    import signal
    def _shutdown(sig, frame):
        logger.info(f"Received signal {sig} - shutting down gracefully")
    signal.signal(signal.SIGTERM, _shutdown)
    yield
    for t in tasks:
        t.cancel()
    logger.info("DXEdge pollers stopped")


app = FastAPI(title="DXEdge API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://dxedge.net",
        "https://www.dxedge.net",
        "http://localhost:5173",   # Vite dev server
        "http://localhost:3000",
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)



# --- WebSocket live spots ---
@app.websocket("/ws/spots")
async def ws_spots(websocket: WebSocket):
    await broadcaster.connect(websocket)
    try:
        # Send current spots immediately on connect
        import json
        spots = cache.get("spots") or []
        await websocket.send_text(json.dumps({"type": "init", "data": spots[:100]}))
        # Keep alive - client sends pings
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        broadcaster.disconnect(websocket)
    except Exception:
        broadcaster.disconnect(websocket)


# --- Solar ---
@app.get("/api/solar")
async def get_solar():
    data = cache.get("solar")
    if not data:
        raise HTTPException(503, "Solar data not yet available")
    return data


# --- DX Cluster spots ---
@app.get("/api/spots")
async def get_spots(band: str = None, mode: str = None, limit: int = 100):
    spots = cache.get("spots") or []
    if band:
        spots = [s for s in spots if s.get("band") == band]
    if mode:
        spots = [s for s in spots if s.get("mode", "").upper() == mode.upper()]
    return {"spots": spots[:limit], "total": len(spots)}


# --- PSKReporter ---
@app.get("/api/psk")
async def get_psk(grid: str = Query(default="CM95", min_length=4, max_length=6)):
    grid4 = grid[:4].upper()
    data = cache.get(f"psk_{grid4}")
    if not data:
        # Trigger an immediate fetch for this grid
        data = await psk_poller.fetch_grid(grid4)
        cache.set(f"psk_{grid4}", data, ttl=300)
    return {"grid": grid4, "spots": data}


# --- LoTW proxy ---
@app.post("/api/lotw")
async def get_lotw(payload: dict, request: Request):
    # Rate limit: 5 requests per IP per minute
    ip = request.headers.get("X-Real-IP") or (request.client.host if request.client else "unknown")
    allowed, retry_after = lotw_limiter.is_allowed(ip)
    if not allowed:
        raise HTTPException(429, f"Too many LoTW requests. Try again in {retry_after}s.")

    login = payload.get("login")
    password = payload.get("password")
    if not login or not password:
        raise HTTPException(400, "login and password required")
    try:
        adif = await query_lotw(login, password)
        return {"adif": adif}
    except Exception as e:
        raise HTTPException(502, f"LoTW error: {e}")



# --- Dashboard (single endpoint for initial page load) ---
@app.get("/api/dashboard")
async def get_dashboard(
    grid: str = Query(default="CM95", min_length=4, max_length=6),
):
    """Single endpoint returning solar + spots + recommendation.
    Replaces three separate calls on page load."""
    from datetime import datetime, timezone

    cache_key = f"dashboard_{grid.upper()}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    solar = cache.get("solar")
    spots = cache.get("spots") or []

    # Recommendation (lightweight - uses cached VOACAP if available)
    rec_key = f"rec_{grid.upper()}_{round(solar.get('sfi',140)) if solar else 140}_{round(solar.get('k_index',2),1) if solar else 2}"
    rec = cache.get(rec_key)

    result = {
        "solar":          solar,
        "spots":          spots[:200],
        "spots_total":    len(spots),
        "recommendation": rec,
        "grid":           grid.upper(),
        "timestamp":      datetime.now(timezone.utc).isoformat(),
    }

    cache.set(cache_key, result, ttl=60)  # 60s - solar updates every 15min, spots stream via WS
    return result

# --- Solar history ---
@app.get("/api/solar/history")
async def get_solar_history(hours: int = 48):
    """Solar readings for the last N hours from DB."""
    return {"readings": load_solar_history(hours=min(hours, 168))}


# --- VOACAP propagation prediction ---
@app.get("/api/voacap")
async def get_voacap(request: Request,
    grid: str = Query(default="CM95", min_length=4, max_length=6),
    region: str = Query(default="EU"),
):
    ip = request.headers.get("X-Real-IP") or (request.client.host if request.client else "unknown")
    allowed, retry = compute_limiter.is_allowed(ip)
    if not allowed:
        raise HTTPException(429, f"Too many requests. Try again in {retry}s.")
    solar = cache.get("solar") or {}
    sfi = solar.get("sfi", 140)
    kp  = solar.get("k_index", 2)
    ssn = solar.get("ssn", 120)

    cache_key = f"voacap_{grid.upper()}_{region.upper()}_{round(sfi)}_{round(kp, 1)}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, predict_path, grid, region, sfi, kp, ssn)
        cache.set(cache_key, result, ttl=3600)
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.get("/api/voacap/summary")
async def get_voacap_summary(
    grid: str = Query(default="CM95", min_length=4, max_length=6),
):
    """24-hour overall propagation quality summary for a grid square.
    Averages reliability across key DX regions and all bands."""
    solar = cache.get("solar") or {}
    sfi = solar.get("sfi", 140)
    kp  = solar.get("k_index", 2)
    ssn = solar.get("ssn", 120)

    cache_key = f"voacap_summary_{grid.upper()}_{round(sfi)}_{round(kp,1)}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    # Key regions to average across
    target_regions = ["EU", "JA", "VK", "SA", "AF"]
    all_predictions = []
    loop = asyncio.get_event_loop()
    for region in target_regions:
        try:
            pred = await loop.run_in_executor(None, predict_path, grid, region, sfi, kp, ssn)
            all_predictions.append(pred)
        except Exception:
            pass

    if not all_predictions:
        raise HTTPException(503, "Prediction unavailable")

    # For each hour: compute per-band average across regions + overall score
    ALL_BANDS = ["10m","15m","17m","20m","30m","40m","80m"]
    summary = []
    for h in range(24):
        region_scores = []
        band_avgs = {b: [] for b in ALL_BANDS}

        for pred in all_predictions:
            hour_data = pred["hours"][h]
            dx_bands = ["40m","30m","20m","17m","15m"]
            dx_vals = [hour_data["bands"].get(b, 0) for b in dx_bands]
            region_scores.append(sum(dx_vals) / len(dx_vals))
            for b in ALL_BANDS:
                band_avgs[b].append(hour_data["bands"].get(b, 0))

        # 75th percentile overall score
        if region_scores:
            region_scores.sort(reverse=True)
            idx = max(0, len(region_scores)//4)
            score = round(region_scores[idx], 3)
        else:
            score = 0

        # Average per band across regions
        bands = {b: round(sum(v)/len(v), 2) if v else 0
                 for b, v in band_avgs.items()}

        summary.append({"utc": h, "score": score, "bands": bands})

    result = {
        "grid": grid.upper(),
        "sfi": sfi,
        "kp": kp,
        "summary": summary,
    }
    cache.set(cache_key, result, ttl=3600)
    return result


@app.get("/api/voacap/regions")
async def get_regions():
    return {"regions": [
        {"code": k, "name": v[2]} for k, v in REGIONS.items()
    ]}



# --- Operating recommendation ---
@app.get("/api/recommendation")
async def get_recommendation(
    grid: str = Query(default="CM95", min_length=4, max_length=6),
):
    """Best band/time for local and DX operating from a grid square."""
    solar = cache.get("solar") or {}
    sfi   = solar.get("sfi", 140)
    kp    = solar.get("k_index", 2)
    ssn   = solar.get("ssn", 120)

    cache_key = f"rec_{grid.upper()}_{round(sfi)}_{round(kp,1)}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    from datetime import datetime, timezone
    now_utc = datetime.now(timezone.utc)
    current_h = now_utc.hour

    BANDS_ORDER = ["10m","12m","15m","17m","20m","30m","40m","80m"]

    def _best_for_path(region):
        try:
            pred = predict_path(grid, region, sfi, kp, ssn)
        except Exception:
            return None, None, 0
        best_score, best_band, best_hour = 0, "20m", current_h
        for h_data in pred["hours"]:
            for band in BANDS_ORDER:
                score = h_data["bands"].get(band, 0)
                if score > best_score:
                    best_score = score
                    best_band  = band
                    best_hour  = h_data["utc"]
        return best_band, best_hour, best_score

    # Run all three path predictions concurrently in thread pool
    loop = asyncio.get_event_loop()
    local_band, local_hour, local_score = await loop.run_in_executor(None, _best_for_path, "NA")
    eu_band,    eu_hour,    eu_score    = await loop.run_in_executor(None, _best_for_path, "EU")
    ja_band,    ja_hour,    ja_score    = await loop.run_in_executor(None, _best_for_path, "JA")
    if ja_score > eu_score:
        dx_band, dx_hour, dx_score = ja_band, ja_hour, ja_score
        dx_region = "JA"
    else:
        dx_band, dx_hour, dx_score = eu_band, eu_hour, eu_score
        dx_region = "EU"

    def hour_label(h):
        diff = (h - current_h) % 24
        if diff == 0:    return "now"
        if diff == 1:    return "in 1h"
        if diff <= 6:    return f"in {diff}h"
        return f"{h:02d}:00Z"

    def quality_word(score):
        if score >= 0.75: return "excellent"
        if score >= 0.55: return "good"
        if score >= 0.35: return "fair"
        return "marginal"

    local_text = (f"Local: {local_band} {quality_word(local_score)} "
                  f"({hour_label(local_hour)})"
                  if local_band else "Local: 40m (check conditions)")
    dx_text    = (f"DX to {dx_region}: {dx_band} {quality_word(dx_score)} "
                  f"({hour_label(dx_hour)})"
                  if dx_band else "DX: 20m (check conditions)")

    result = {
        "grid": grid.upper(),
        "local": {"band": local_band, "hour": local_hour, "score": round(local_score, 2), "text": local_text},
        "dx":    {"band": dx_band,    "hour": dx_hour,    "score": round(dx_score, 2),    "text": dx_text,  "region": dx_region},
        "summary": f"{local_text}  ·  {dx_text}",
        "sfi": sfi, "kp": kp,
    }
    cache.set(cache_key, result, ttl=1800)
    return result

@app.get("/api/health")
async def health():
    from datetime import datetime, timezone
    solar   = cache.get("solar")
    spots   = cache.get("spots") or []
    tles    = cache.get("sat_tles") or {}
    pota    = cache.get("pota_spots") or []
    return {
        "status":       "ok",
        "timestamp":    datetime.now(timezone.utc).isoformat(),
        "solar":        solar is not None,
        "sfi":          solar.get("sfi") if solar else None,
        "k_index":      solar.get("k_index") if solar else None,
        "spots":        len(spots),
        "sat_tles":     len(tles),
        "pota_spots":   len(pota),
        "version":      "2.0",
    }


# Serve React static assets
app.mount("/assets", StaticFiles(directory="/app/frontend/dist/assets"), name="assets")




# --- Push alert subscriptions ---
@app.post("/api/alerts/subscribe")
async def subscribe_alerts(body: dict):
    callsign = (body.get("callsign") or "").upper().strip()
    topic    = (body.get("topic") or "").strip()
    alerts   = body.get("alerts", ["10m_open", "k_storm"])
    if not callsign or not topic:
        raise HTTPException(400, "callsign and topic required")
    if len(topic) > 64 or not topic.replace("-","").replace("_","").isalnum():
        raise HTTPException(400, "invalid topic name")
    save_subscription(callsign, topic, alerts)
    return {"status": "subscribed", "topic": topic, "callsign": callsign}


@app.delete("/api/alerts/subscribe/{topic}")
async def unsubscribe_alerts(topic: str):
    delete_subscription(topic)
    return {"status": "unsubscribed"}


@app.get("/api/alerts/subscriptions")
async def list_subscriptions(callsign: str = Query(default=None)):
    """List alert subscriptions, optionally filtered by callsign."""
    from database import get_subscriptions
    import json
    subs = get_subscriptions()
    if callsign:
        subs = [s for s in subs if s.get("callsign","").upper() == callsign.upper()]
    return {"subscriptions": [
        {
            "callsign": s["callsign"],
            "topic":    s["topic"],
            "alerts":   json.loads(s.get("alerts","[]")),
            "last_sent": s.get("last_sent"),
        } for s in subs
    ]}


@app.get("/api/alerts/test/{topic}")
async def test_alert(topic: str):
    from alerts import send_ntfy
    sent = await send_ntfy(
        topic    = topic,
        title    = "DXEdge Test Alert",
        message  = "Your DXEdge alerts are working! 73 de K6WRJ",
        priority = "default",
        tags     = ["radio_button", "white_check_mark"],
    )
    return {"sent": sent, "topic": topic}


# --- Satellite tracking ---
@app.get("/api/satellites/positions")
async def get_sat_positions():
    tles = await fetch_tles()
    if not tles:
        raise HTTPException(503, "TLE data unavailable")
    return {"positions": current_positions(tles), "count": len(tles)}


@app.get("/api/satellites/passes")
async def get_sat_passes(
    request: Request,
    grid: str = Query(default="CM95", min_length=4, max_length=6),
    hours: int = Query(default=24, ge=1, le=48),
):
    ip = request.headers.get("X-Real-IP") or (request.client.host if request.client else "unknown")
    allowed, retry = compute_limiter.is_allowed(ip)
    if not allowed:
        raise HTTPException(429, f"Too many requests. Try again in {retry}s.")
    cache_key = f"sat_passes_{grid.upper()}_{hours}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    tles = await fetch_tles()
    if not tles:
        raise HTTPException(503, "TLE data unavailable")

    obs_lat, obs_lon = sat_grid_to_latlon(grid)
    passes = predict_passes(tles, obs_lat, obs_lon, hours)
    result = {"passes": passes, "grid": grid.upper(), "obs_lat": obs_lat, "obs_lon": obs_lon}
    cache.set(cache_key, result, ttl=300)  # 5 min cache
    return result

# --- Contest calendar ---
@app.get("/api/contests")
async def get_contests():
    return {"contests": await fetch_contests()}

# --- POTA / SOTA spots ---
@app.get("/api/pota")
async def get_pota():
    return {"spots": await fetch_pota()}

@app.get("/api/sota")
async def get_sota():
    return {"spots": await fetch_sota()}

@app.get("/api/activations")
async def get_activations():
    """Combined POTA + SOTA spots."""
    pota, sota = await asyncio.gather(fetch_pota(), fetch_sota())
    all_spots = pota + sota
    all_spots.sort(key=lambda x: x.get("time_utc",""), reverse=True)
    return {
        "pota": pota,
        "sota": sota,
        "total": len(all_spots),
    }

# --- Callsign spot lookup ---
@app.get("/api/callsign")
async def get_callsign_spots(request: Request,
    call: str = Query(min_length=3, max_length=12),
    hours: int = Query(default=2, ge=1, le=12),
):
    """Recent PSKReporter spots for a specific callsign.
    Returns spots heard BY this call and spots OF this call."""
    import aiohttp
    from xml.etree import ElementTree as ET
    from dxcc import enrich_spot

    call = call.upper().strip()
    cache_key = f"callsign_{call}_{hours}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    PSK_URL = "https://retrieve.pskreporter.info/query"
    window = -(hours * 3600)

    FREQ_TO_BAND = [
        (1800,2000,"160m"),(3500,4000,"80m"),(7000,7300,"40m"),
        (10100,10150,"30m"),(14000,14350,"20m"),(18068,18168,"17m"),
        (21000,21450,"15m"),(24890,24990,"12m"),(28000,29700,"10m"),(50000,54000,"6m"),
    ]
    def hz_to_band(hz):
        khz = hz / 1000
        for lo, hi, band in FREQ_TO_BAND:
            if lo <= khz <= hi: return band
        return None

    def parse_xml(xml_text, mode):
        spots = []
        try:
            root = ET.fromstring(xml_text)
            for rep in root.findall(".//receptionReport"):
                try:
                    freq_hz = int(rep.get("frequency") or 0)
                except ValueError:
                    freq_hz = 0
                band = hz_to_band(freq_hz) if freq_hz else None
                try:
                    snr = int(rep.get("sNR") or -99)
                except ValueError:
                    snr = -99
                spots.append({
                    "callsign":   rep.get("senderCallsign","").upper(),
                    "receiver":   rep.get("receiverCallsign","").upper(),
                    "receiver_grid": rep.get("receiverLocator",""),
                    "sender_grid":   rep.get("senderLocator",""),
                    "freq_hz":    freq_hz,
                    "band":       band or "?",
                    "snr":        snr,
                    "mode":       rep.get("mode","FT8"),
                    "country":    rep.get("senderDXCC","") if mode=="heard_by" else rep.get("receiverCallsign",""),
                    "timestamp":  rep.get("flowStartSeconds",""),
                    "type":       mode,
                })
        except ET.ParseError:
            pass
        return spots

    heard_by = []  # stations that heard this callsign
    hearing  = []  # stations this callsign heard

    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=15)) as session:
        # Who heard this callsign?
        try:
            url = f"{PSK_URL}?senderCallsign={call}&flowStartSeconds={window}&rronly=1"
            async with session.get(url) as r:
                if r.status == 200:
                    heard_by = parse_xml(await r.text(), "heard_by")
        except Exception as e:
            logger.warning(f"PSK senderCallsign {call}: {e}")

        await asyncio.sleep(0.5)  # be polite

        # What has this callsign heard?
        try:
            url = f"{PSK_URL}?receiverCallsign={call}&flowStartSeconds={window}&rronly=1"
            async with session.get(url) as r:
                if r.status == 200:
                    hearing = parse_xml(await r.text(), "hearing")
        except Exception as e:
            logger.warning(f"PSK receiverCallsign {call}: {e}")

    # Enrich heard_by spots
    for s in heard_by:
        enrich_spot(s)

    # Deduplicate heard_by by receiver+band, keep best SNR
    seen = {}
    for s in heard_by:
        key = f"{s['receiver']}-{s['band']}"
        if key not in seen or s["snr"] > seen[key]["snr"]:
            seen[key] = s
    heard_by = sorted(seen.values(), key=lambda x: x["snr"], reverse=True)

    # Deduplicate hearing by callsign+band
    seen2 = {}
    for s in hearing:
        key = f"{s['callsign']}-{s['band']}"
        if key not in seen2 or s["snr"] > seen2[key]["snr"]:
            seen2[key] = s
    hearing = sorted(seen2.values(), key=lambda x: x["snr"], reverse=True)

    result = {
        "callsign": call,
        "hours": hours,
        "heard_by": heard_by[:100],
        "hearing":  hearing[:100],
        "heard_by_count": len(heard_by),
        "hearing_count":  len(hearing),
    }
    cache.set(cache_key, result, ttl=300)  # 5 min cache
    return result


# Serve React frontend for all non-API routes
@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    return FileResponse("/app/frontend/dist/index.html")
