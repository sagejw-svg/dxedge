"""Forever Zoom API.

Static files live under /forever-zoom/. This router is only the model proxy.
FAL_KEY is read from the process environment (the droplet .env). It is never
written to the repo, logged, or returned to the browser. When the key is
missing, or fal answers 402, the page keeps drawing with its procedural engine.
"""
from __future__ import annotations

import base64
import ipaddress
import json
import logging
import os
import time
from typing import Any, Optional
from urllib.parse import urlsplit

import aiohttp
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from ratelimit import RateLimiter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/forever-zoom", tags=["forever-zoom"])

# Image generation spends credits. Tighter than the general API budget.
generate_limiter = RateLimiter(max_requests=6, window_seconds=60)

THEME_CHAIN = [
    {
        "id": "desk",
        "label": "Desk",
        "prompt": (
            "Photorealistic overhead view of a wooden desk workspace with "
            "notebooks, coffee mug, lamp, scattered pencils, warm afternoon light, "
            "rich wood grain detail, cozy study atmosphere"
        ),
    },
    {
        "id": "fields",
        "label": "Fields",
        "prompt": (
            "Expansive rolling green farmland fields from above, golden hour light, "
            "winding dirt path, hedgerows, distant hills, painterly landscape, "
            "lush meadows with wildflowers"
        ),
    },
    {
        "id": "plants",
        "label": "Plants",
        "prompt": (
            "Extreme close-up of lush green plants and leaves, dew drops, "
            "veins and texture of foliage, botanical macro photography, "
            "sunlight filtering through canopy"
        ),
    },
    {
        "id": "cells",
        "label": "Cells",
        "prompt": (
            "Abstract microscopic view of plant cells, glowing chloroplasts, "
            "organic membrane patterns, scientific beauty, bioluminescent greens "
            "and soft blues, fractal cellular structure"
        ),
    },
    {
        "id": "cosmos",
        "label": "Cosmos",
        "prompt": (
            "Vast cosmic nebula that looks like cells from afar, swirling stars, "
            "deep space clouds of purple and teal, galaxies blooming like flowers, "
            "infinite universe, cinematic astronomy art"
        ),
    },
]

CHEAP_T2I = "fal-ai/flux/schnell"
IMG2IMG = "fal-ai/flux/dev/image-to-image"
FAL_RUN = "https://fal.run/"
COST_T2I_USD = 0.003
COST_I2I_USD = 0.03
MAX_IMAGE_BYTES = 8_000_000
_IMAGE_SIZES = {
    "square_hd",
    "square",
    "landscape_4_3",
    "portrait_4_3",
    "landscape_16_9",
    "portrait_16_9",
}
_CREDIT_WORDS = ("credit", "balance", "payment", "402", "quota", "exhausted")


def fal_key() -> str:
    return os.environ.get("FAL_KEY", "").strip()


def fal_available() -> bool:
    return bool(fal_key())


def client_ip(request: Request) -> str:
    return request.headers.get("X-Real-IP") or (request.client.host if request.client else "unknown")


def credit_exhausted(status: int, body: str) -> bool:
    if status == 402:
        return True
    if status < 400:
        return False
    low = (body or "").lower()
    return any(word in low for word in _CREDIT_WORDS)


def image_host_allowed(url: str) -> bool:
    """fal returns the picture on its own CDN. Anything else is refused."""
    parsed = urlsplit(url or "")
    if parsed.scheme != "https" or parsed.username or parsed.password:
        return False
    host = (parsed.hostname or "").lower().rstrip(".")
    if not host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    if host == "fal.media" or host.endswith(".fal.media"):
        return True
    if host == "fal.ai" or host.endswith(".fal.ai"):
        return True
    return False


class GenerateBody(BaseModel):
    mode: str = Field(description="t2i | img2img")
    theme_index: int = 0
    prompt_override: Optional[str] = Field(default=None, max_length=2000)
    image_data_url: Optional[str] = Field(default=None, max_length=6_000_000)
    strength: float = 0.72
    seed: Optional[int] = None
    image_size: str = "square_hd"


@router.get("/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "fal": fal_available(),
        "themes": [t["id"] for t in THEME_CHAIN],
        "cost": {
            "t2i_usd_approx": COST_T2I_USD,
            "img2img_usd_approx": COST_I2I_USD,
            "model_t2i": CHEAP_T2I,
            "model_img2img": IMG2IMG,
        },
    }


@router.get("/themes")
async def themes() -> dict[str, Any]:
    return {"themes": THEME_CHAIN}


async def fal_run(session: aiohttp.ClientSession, model: str, args: dict) -> dict:
    headers = {
        "Authorization": f"Key {fal_key()}",
        "Content-Type": "application/json",
    }
    timeout = aiohttp.ClientTimeout(total=150)
    try:
        async with session.post(FAL_RUN + model, json=args, headers=headers, timeout=timeout) as resp:
            text = await resp.text()
            status = resp.status
    except aiohttp.ClientError as exc:
        logger.warning("forever-zoom fal request failed: %s", type(exc).__name__)
        raise HTTPException(502, "fal error") from exc
    if credit_exhausted(status, text):
        raise HTTPException(402, "fal credits appear exhausted; switch to procedural mode")
    if status >= 400:
        logger.warning("forever-zoom fal status %s", status)
        raise HTTPException(502, "fal error")
    try:
        data = json.loads(text)
    except ValueError as exc:
        raise HTTPException(502, "fal error") from exc
    if not isinstance(data, dict):
        raise HTTPException(502, "fal error")
    return data


async def fetch_image(session: aiohttp.ClientSession, url: str) -> tuple[bytes, str]:
    if not image_host_allowed(url):
        logger.warning("forever-zoom refused image host")
        raise HTTPException(502, "fal image url was not from an allowed host")
    timeout = aiohttp.ClientTimeout(total=60)
    try:
        async with session.get(url, timeout=timeout, allow_redirects=False) as resp:
            if resp.status in (301, 302, 303, 307, 308):
                raise HTTPException(502, "fal image url redirected")
            if resp.status != 200:
                raise HTTPException(502, "fal image download failed")
            ctype = (resp.headers.get("Content-Type") or "image/png").split(";", 1)[0].strip().lower()
            if not ctype.startswith("image/"):
                raise HTTPException(502, "fal image had an unexpected type")
            raw = await resp.content.read(MAX_IMAGE_BYTES + 1)
    except aiohttp.ClientError as exc:
        logger.warning("forever-zoom image download failed: %s", type(exc).__name__)
        raise HTTPException(502, "fal image download failed") from exc
    if len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(502, "fal image too large")
    if not raw:
        raise HTTPException(502, "fal image was empty")
    return raw, ctype


@router.post("/generate")
async def generate(body: GenerateBody, request: Request) -> JSONResponse:
    if body.mode not in ("t2i", "img2img"):
        raise HTTPException(400, "mode must be t2i or img2img")
    if body.image_size not in _IMAGE_SIZES:
        raise HTTPException(400, "unsupported image_size")
    if body.seed is not None and not (0 <= body.seed <= 2_147_483_647):
        raise HTTPException(400, "seed out of range")
    if abs(body.theme_index) > 10000:
        raise HTTPException(400, "theme_index out of range")
    if body.mode == "img2img":
        if not body.image_data_url or not body.image_data_url.startswith("data:image/"):
            raise HTTPException(400, "image_data_url required for img2img")

    ip = client_ip(request)
    allowed, retry = generate_limiter.is_allowed(ip)
    if not allowed:
        raise HTTPException(429, f"Too many requests. Try again in {retry}s.")

    if not fal_available():
        raise HTTPException(503, "fal credits/key unavailable; use procedural mode")

    theme = THEME_CHAIN[body.theme_index % len(THEME_CHAIN)]
    prompt = (body.prompt_override or "").strip() or theme["prompt"]
    t0 = time.time()

    try:
        async with aiohttp.ClientSession() as session:
            if body.mode == "t2i":
                args: dict[str, Any] = {
                    "prompt": prompt,
                    "image_size": body.image_size,
                    "num_images": 1,
                    "num_inference_steps": 4,
                    "enable_safety_checker": True,
                    "output_format": "png",
                }
                if body.seed is not None:
                    args["seed"] = body.seed
                result = await fal_run(session, CHEAP_T2I, args)
                cost = COST_T2I_USD
                model = CHEAP_T2I
            else:
                args = {
                    "prompt": prompt,
                    "image_url": body.image_data_url,
                    "strength": max(0.35, min(0.95, body.strength)),
                    "num_inference_steps": 28,
                    "guidance_scale": 3.5,
                    "num_images": 1,
                    "enable_safety_checker": True,
                    "output_format": "png",
                    "acceleration": "regular",
                }
                if body.seed is not None:
                    args["seed"] = body.seed
                result = await fal_run(session, IMG2IMG, args)
                cost = COST_I2I_USD
                model = IMG2IMG

            images = (result or {}).get("images") or []
            if not images or not isinstance(images, list):
                raise HTTPException(502, "fal returned no images")
            first = images[0] if isinstance(images[0], dict) else {}
            url = first.get("url")
            if not url:
                raise HTTPException(502, "fal image missing url")
            raw, ctype = await fetch_image(session, url)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.warning("forever-zoom generate failed: %s", type(exc).__name__)
        raise HTTPException(502, "fal error") from exc

    data_url = f"data:{ctype};base64,{base64.b64encode(raw).decode('ascii')}"
    return JSONResponse(
        {
            "ok": True,
            "theme": theme,
            "theme_index": body.theme_index % len(THEME_CHAIN),
            "prompt": prompt,
            "image_data_url": data_url,
            "seed": (result or {}).get("seed"),
            "elapsed_ms": int((time.time() - t0) * 1000),
            "cost_usd_approx": cost,
            "model": model,
        }
    )
