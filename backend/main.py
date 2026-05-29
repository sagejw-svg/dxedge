from fastapi import FastAPI, HTTPException, Query
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

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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


# --- Health check ---
@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "solar": cache.get("solar") is not None,
        "spots": len(cache.get("spots") or []),
    }


# Serve React frontend for all non-API routes
@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    return FileResponse("/app/frontend/dist/index.html")
