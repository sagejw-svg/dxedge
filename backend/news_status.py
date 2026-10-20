"""Print which news provider is ready. Never prints a key or the password."""
from __future__ import annotations

import base64
import json
import os
import urllib.request


def main() -> int:
    password = os.environ.get("NEWS_PASSWORD") or ""
    token = base64.b64encode(f"edge:{password}".encode()).decode()
    request = urllib.request.Request(
        "http://127.0.0.1:8000/api/news/status",
        headers={"Authorization": "Basic " + token},
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            data = json.load(response)
    except Exception as exc:
        print("news status check failed", type(exc).__name__)
        return 1
    provider = data.get("provider") if isinstance(data, dict) else {}
    if not isinstance(provider, dict):
        provider = {}
    providers = provider.get("providers") if isinstance(provider.get("providers"), dict) else {}
    anthropic = (providers.get("anthropic") or {}).get("ready")
    xai = (providers.get("xai") or {}).get("ready")
    print(
        "news status provider name=%s ready=%s anthropic=%s xai=%s"
        % (provider.get("name"), provider.get("ready"), anthropic, xai)
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
