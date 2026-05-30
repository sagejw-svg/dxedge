from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
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
    logger.info("DXEdge pollers started")
    yield
    for t in tasks:
        t.cancel()
    logger.info("DXEdge pollers stopped")


app = FastAPI(title="DXEdge API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
async def get_lotw(payload: dict):
    login = payload.get("login")
    password = payload.get("password")
    if not login or not password:
        raise HTTPException(400, "login and password required")
    try:
        adif = await query_lotw(login, password)
        return {"adif": adif}
    except Exception as e:
        raise HTTPException(502, f"LoTW error: {e}")


# --- Solar history ---
@app.get("/api/solar/history")
async def get_solar_history(hours: int = 48):
    """Solar readings for the last N hours from DB."""
    return {"readings": load_solar_history(hours=min(hours, 168))}


# --- VOACAP propagation prediction ---
@app.get("/api/voacap")
async def get_voacap(
    grid: str = Query(default="CM95", min_length=4, max_length=6),
    region: str = Query(default="EU"),
):
    solar = cache.get("solar") or {}
    sfi = solar.get("sfi", 140)
    kp  = solar.get("k_index", 2)
    ssn = solar.get("ssn", 120)

    cache_key = f"voacap_{grid.upper()}_{region.upper()}_{round(sfi)}_{round(kp, 1)}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    try:
        result = predict_path(grid, region, sfi, kp, ssn)
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
    for region in target_regions:
        try:
            pred = predict_path(grid, region, sfi, kp, ssn)
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

    def best_for_path(region, max_hours=24):
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

    # Local = NA path (short, within continent)
    local_band, local_hour, local_score = best_for_path("NA")
    # DX = best of EU and JA
    eu_band, eu_hour, eu_score = best_for_path("EU")
    ja_band, ja_hour, ja_score = best_for_path("JA")
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
        return f"{String(h).padStart(2,'0')}:00Z" if False else f"{h:02d}:00Z"

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
    return {
        "status": "ok",
        "solar": cache.get("solar") is not None,
        "spots": len(cache.get("spots") or []),
    }


# Serve React static assets
app.mount("/assets", StaticFiles(directory="/app/frontend/dist/assets"), name="assets")

# Serve React frontend for all non-API routes
@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    return FileResponse("/app/frontend/dist/index.html")
