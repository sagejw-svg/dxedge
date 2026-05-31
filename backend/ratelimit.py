"""
Simple in-memory rate limiter.
Tracks request counts per IP with a sliding window.
"""
import time
import threading
from collections import defaultdict

class RateLimiter:
    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests   = max_requests
        self.window_seconds = window_seconds
        self._lock          = threading.Lock()
        # ip -> list of timestamps
        self._requests: dict[str, list[float]] = defaultdict(list)

    def is_allowed(self, ip: str) -> tuple[bool, int]:
        """
        Returns (allowed, retry_after_seconds).
        Cleans up old timestamps on each check.
        """
        now = time.time()
        window_start = now - self.window_seconds

        with self._lock:
            # Drop timestamps outside the window
            self._requests[ip] = [
                t for t in self._requests[ip] if t > window_start
            ]
            count = len(self._requests[ip])

            if count >= self.max_requests:
                oldest = self._requests[ip][0]
                retry_after = int(self.window_seconds - (now - oldest)) + 1
                return False, retry_after

            self._requests[ip].append(now)
            return True, 0

    def cleanup(self):
        """Remove IPs with no recent requests. Call periodically."""
        now = time.time()
        window_start = now - self.window_seconds
        with self._lock:
            dead = [ip for ip, ts in self._requests.items()
                    if not any(t > window_start for t in ts)]
            for ip in dead:
                del self._requests[ip]


# LoTW: 5 requests per IP per minute
lotw_limiter = RateLimiter(max_requests=5, window_seconds=60)

# General API limiter - 60 req/min/IP (generous for normal use)
api_limiter = RateLimiter(max_requests=60, window_seconds=60)

# Compute-heavy endpoints - 10 req/min/IP
compute_limiter = RateLimiter(max_requests=10, window_seconds=60)
