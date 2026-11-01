"""Forever Zoom proxy and static page.

The page must answer at /forever-zoom/. Generate must refuse to run without
FAL_KEY, must surface fal's 402, and must not fetch an image URL fal did not
host. The key itself never appears in a response.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

import forever_zoom

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PUBLIC = os.path.join(ROOT, "frontend", "public")


@pytest.fixture
def client(monkeypatch):
    monkeypatch.delenv("FAL_KEY", raising=False)
    forever_zoom.generate_limiter._requests.clear()
    app = FastAPI()
    app.include_router(forever_zoom.router)
    with TestClient(app) as http:
        yield http


def test_health_without_key(client):
    res = client.get("/api/forever-zoom/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["fal"] is False
    assert body["themes"] == ["desk", "fields", "plants", "cells", "cosmos"]
    assert "FAL_KEY" not in res.text
    assert "Key " not in res.text


def test_themes(client):
    res = client.get("/api/forever-zoom/themes")
    assert res.status_code == 200
    ids = [t["id"] for t in res.json()["themes"]]
    assert ids == ["desk", "fields", "plants", "cells", "cosmos"]
    assert all(t["prompt"] for t in res.json()["themes"])


def test_generate_without_key_uses_procedural_signal(client, monkeypatch):
    async def forbidden(session, model, args):
        raise AssertionError("fal was called without a key")

    monkeypatch.setattr(forever_zoom, "fal_run", forbidden)
    res = client.post(
        "/api/forever-zoom/generate",
        json={"mode": "t2i", "theme_index": 0},
        headers={"X-Real-IP": "203.0.113.10"},
    )
    assert res.status_code == 503
    assert "procedural" in res.json()["detail"]


def test_generate_402(client, monkeypatch):
    monkeypatch.setenv("FAL_KEY", "test-key-not-real")

    async def exhausted(session, model, args):
        assert args["prompt"]
        raise HTTPException(402, "fal credits appear exhausted; switch to procedural mode")

    monkeypatch.setattr(forever_zoom, "fal_run", exhausted)
    res = client.post(
        "/api/forever-zoom/generate",
        json={"mode": "t2i", "theme_index": 1},
        headers={"X-Real-IP": "203.0.113.11"},
    )
    assert res.status_code == 402
    assert "procedural" in res.json()["detail"]
    assert "test-key-not-real" not in res.text


def test_generate_refuses_foreign_image_url(client, monkeypatch):
    monkeypatch.setenv("FAL_KEY", "test-key-not-real")
    fetched = {"n": 0}

    async def planted(session, model, args):
        return {"images": [{"url": "http://169.254.169.254/latest/meta-data"}], "seed": 1}

    real_fetch = forever_zoom.fetch_image

    async def counting(session, url):
        fetched["n"] += 1
        return await real_fetch(session, url)

    monkeypatch.setattr(forever_zoom, "fal_run", planted)
    monkeypatch.setattr(forever_zoom, "fetch_image", counting)
    res = client.post(
        "/api/forever-zoom/generate",
        json={"mode": "t2i"},
        headers={"X-Real-IP": "203.0.113.12"},
    )
    assert res.status_code == 502
    assert fetched["n"] == 1
    assert "169.254.169.254" not in res.text
    assert "test-key-not-real" not in res.text


def test_generate_returns_image_without_the_key(client, monkeypatch):
    monkeypatch.setenv("FAL_KEY", "test-key-not-real")

    async def planted(session, model, args):
        assert model == forever_zoom.CHEAP_T2I
        assert "Authorization" not in args
        return {"images": [{"url": "https://v3.fal.media/files/zoom.png"}], "seed": 7}

    async def picture(session, url):
        assert url == "https://v3.fal.media/files/zoom.png"
        return b"\x89PNG\r\n\x1a\n", "image/png"

    monkeypatch.setattr(forever_zoom, "fal_run", planted)
    monkeypatch.setattr(forever_zoom, "fetch_image", picture)
    res = client.post(
        "/api/forever-zoom/generate",
        json={"mode": "t2i", "theme_index": 0, "seed": 3},
        headers={"X-Real-IP": "203.0.113.13"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert body["theme"]["id"] == "desk"
    assert body["model"] == forever_zoom.CHEAP_T2I
    assert body["seed"] == 7
    assert body["image_data_url"].startswith("data:image/png;base64,")
    assert "test-key-not-real" not in res.text
    assert "FAL_KEY" not in res.text


def test_img2img_requires_an_image(client):
    res = client.post(
        "/api/forever-zoom/generate",
        json={"mode": "img2img", "theme_index": 2},
        headers={"X-Real-IP": "203.0.113.14"},
    )
    assert res.status_code == 400


def test_rate_limit(client, monkeypatch):
    monkeypatch.setenv("FAL_KEY", "test-key-not-real")

    async def exhausted(session, model, args):
        raise HTTPException(402, "fal credits appear exhausted; switch to procedural mode")

    monkeypatch.setattr(forever_zoom, "fal_run", exhausted)
    headers = {"X-Real-IP": "203.0.113.15"}
    codes = [
        client.post("/api/forever-zoom/generate", json={"mode": "t2i"}, headers=headers).status_code
        for _ in range(7)
    ]
    assert codes[:6] == [402, 402, 402, 402, 402, 402]
    assert codes[6] == 429


def test_fal_run_maps_402(monkeypatch):
    import asyncio

    monkeypatch.setenv("FAL_KEY", "test-key-not-real")

    class FakeResp:
        status = 402

        async def text(self):
            return '{"detail":"Exhausted balance"}'

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

    class FakeSession:
        def post(self, url, json=None, headers=None, timeout=None):
            assert headers["Authorization"] == "Key test-key-not-real"
            assert url == forever_zoom.FAL_RUN + forever_zoom.CHEAP_T2I
            assert "test-key-not-real" not in url
            return FakeResp()

    with pytest.raises(HTTPException) as caught:
        asyncio.run(forever_zoom.fal_run(FakeSession(), forever_zoom.CHEAP_T2I, {"prompt": "desk"}))
    assert caught.value.status_code == 402
    assert "test-key-not-real" not in str(caught.value.detail)


def test_credit_and_host_helpers():
    assert forever_zoom.credit_exhausted(402, "")
    assert forever_zoom.credit_exhausted(403, "insufficient credits")
    assert not forever_zoom.credit_exhausted(200, "a credit to the artist")
    assert not forever_zoom.credit_exhausted(500, "internal")
    assert forever_zoom.image_host_allowed("https://v3.fal.media/files/a.png")
    assert forever_zoom.image_host_allowed("https://fal.media/files/a.png")
    assert not forever_zoom.image_host_allowed("http://v3.fal.media/a.png")
    assert not forever_zoom.image_host_allowed("https://169.254.169.254/latest/")
    assert not forever_zoom.image_host_allowed("https://evil.example/fal.media/a.png")
    assert not forever_zoom.image_host_allowed("https://user:pass@v3.fal.media/a.png")
    assert not forever_zoom.image_host_allowed("https://fal.media.evil.example/a.png")


def test_page_and_health_flag(monkeypatch):
    monkeypatch.setenv("DXEDGE_DIST", PUBLIC)
    monkeypatch.delenv("FAL_KEY", raising=False)
    import main
    http = TestClient(main.app)
    try:
        page = http.get("/forever-zoom/")
        assert page.status_code == 200
        assert "Forever Zoom" in page.text
        assert "noindex" in page.text
        assert "/forever-zoom/app.js" in page.text
        assert "/forever-zoom/procedural.js" in page.text
        assert "/forever-zoom/style.css" in page.text
        bare = http.get("/forever-zoom", follow_redirects=False)
        assert bare.status_code == 301
        assert bare.headers["location"].endswith("/forever-zoom/")
        script = http.get("/forever-zoom/app.js")
        assert script.status_code == 200
        assert "/api/forever-zoom" in script.text
        assert "generateProcedural" in script.text
        procedural = http.get("/forever-zoom/procedural.js")
        assert procedural.status_code == 200
        assert "ProceduralZoom" in procedural.text
        health = http.get("/api/forever-zoom/health")
        assert health.status_code == 200
        assert health.json()["fal"] is False
        flag = http.get("/api/health")
        assert flag.status_code == 200
        assert flag.json()["forever_zoom"] is True
    finally:
        http.close()


def test_repo_does_not_contain_a_key():
    compose = open(os.path.join(ROOT, "docker-compose.yml"), encoding="utf-8").read()
    assert "FAL_KEY=${FAL_KEY:-}" in compose
    nginx = open(os.path.join(ROOT, "nginx", "nginx.conf"), encoding="utf-8").read()
    assert "location ^~ /forever-zoom/" in nginx
    assert "location /api/forever-zoom/" in nginx
    sw = open(os.path.join(PUBLIC, "sw.js"), encoding="utf-8").read()
    assert "url.pathname.startsWith('/forever-zoom/')" in sw
    app = open(os.path.join(ROOT, "frontend", "src", "App.jsx"), encoding="utf-8").read()
    assert "forever-zoom" not in app
    for dirpath, _, names in os.walk(os.path.join(PUBLIC, "forever-zoom")):
        for name in names:
            text = open(os.path.join(dirpath, name), encoding="utf-8").read()
            assert "FAL_KEY=" not in text
            assert "Key " not in text or name != "index.html"
