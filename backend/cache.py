import time
from typing import Any, Optional


class Cache:
    def __init__(self):
        self._store: dict[str, tuple[Any, float]] = {}

    def set(self, key: str, value: Any, ttl: int = 900):
        self._store[key] = (value, time.time() + ttl)

    def get(self, key: str) -> Optional[Any]:
        if key not in self._store:
            return None
        value, expires = self._store[key]
        if time.time() > expires:
            del self._store[key]
            return None
        return value

    def delete(self, key: str):
        self._store.pop(key, None)

    def keys(self):
        return list(self._store.keys())


cache = Cache()
