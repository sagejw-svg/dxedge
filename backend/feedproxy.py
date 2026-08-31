"""Same-origin feed proxy for the standalone /cyber/ and /aethersdr/ pages.

Those pages fetched every live feed through https://api.allorigins.win, a free
third party CORS proxy. On 2026-08-31 it started returning 408 and 503, which
took out every live panel on both pages: CISA KEV, NVD, EPSS, solar, and all
news tabs. It also meant every visitor's feed requests were routed through a
third party that had no reason to see them.

This endpoint replaces it with a same-origin fetch, and is deliberately narrow:

- HTTPS only, and only to hosts in ALLOWED_HOSTS. An arbitrary-URL proxy is an
  SSRF primitive, so the allowlist is the whole point. Do not widen it to a
  suffix match: "evil-cisa.gov" and "cisa.gov.attacker.net" must not pass.
- Redirects ARE followed, but every hop is re-validated against the allowlist
  before it is fetched. Refusing them outright was too blunt: several real feeds
  (The Register, Google News) answer 302 on their canonical URL. Chasing them
  blindly would let an allowlisted host bounce us somewhere internal, so each
  Location goes through validate() exactly like the original URL, and the chain
  is capped at MAX_REDIRECTS.
- Response size and read timeout are capped.
- Responses are cached server side, so upstreams see one request per TTL rather
  than one per visitor, which is also what keeps NVD from rate limiting us.

Deployment note: when this module first shipped, the pages kept failing because
/api/feed returned the SPA index.html. The cause was not here. deploy.yml passed
the rebuild flag as `envs: BACKEND_CHANGED=<value>`, but appleboy/ssh-action's
`envs` input takes a list of variable NAMES to forward, not NAME=value pairs. So
the flag arrived empty, the workflow always took the "frontend only" branch, and
the backend container was never rebuilt. If a backend change ever appears not to
take effect, check that branch in the deploy log before suspecting the code.
"""
import logging
from urllib.parse import urlparse

import aiohttp
import yarl
from cache import cache

logger = logging.getLogger(__name__)

# Exact hostname matches only. Every entry here is a feed one of the two
# standalone pages actually renders. Adding a host means accepting that the
# server will fetch arbitrary paths on it, so add deliberately.
ALLOWED_HOSTS = frozenset({
    # cyber page
    "www.cisa.gov",
    "services.nvd.nist.gov",
    "api.first.org",
    "www.hamqsl.com",
    "krebsonsecurity.com",
    "feeds.feedburner.com",
    "www.bleepingcomputer.com",
    "www.darkreading.com",
    "www.theregister.com",
    "www.securityweek.com",
    "news.google.com",
    # aethersdr page
    "github.com",
    "www.flexradio.com",
    "www.rtl-sdr.com",
    "hackaday.com",
})

MAX_BYTES = 4 * 1024 * 1024
MAX_REDIRECTS = 3
TIMEOUT_S = 15
DEFAULT_TTL = 900

# Sent upstream so we look like a browser. Several of these feeds 403 a bare
# aiohttp user agent.
UA = "Mozilla/5.0 (compatible; DXEdgeFeedProxy/1.0; +https://dxedge.net)"


class FeedProxyError(Exception):
    """Raised with a message safe to show a visitor."""

    def __init__(self, message: str, status: int = 502):
        super().__init__(message)
        self.message = message
        self.status = status


def validate(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise FeedProxyError("only https urls are allowed", 400)
    if parsed.hostname is None or parsed.hostname.lower() not in ALLOWED_HOSTS:
        raise FeedProxyError("host not in the feed allowlist", 403)
    return url


async def fetch_feed(url: str, ttl: int = DEFAULT_TTL) -> tuple[str, str]:
    """Return (body, content_type). Raises FeedProxyError on failure."""
    validate(url)

    key = f"feedproxy:{url}"
    cached = cache.get(key)
    if cached:
        return cached

    timeout = aiohttp.ClientTimeout(total=TIMEOUT_S)
    current = url
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            for _hop in range(MAX_REDIRECTS + 1):
                # encoded=True stops aiohttp re-quoting a URL that is already
                # percent-encoded. Without it the NVD query, whose date params
                # contain %3A and %20, gets double-encoded into %253A / %2520
                # and NVD answers with an error page instead of JSON.
                async with session.get(
                    yarl.URL(current, encoded=True),
                    headers={"User-Agent": UA, "Accept": "*/*"},
                    allow_redirects=False,
                ) as resp:
                    if resp.status in (301, 302, 303, 307, 308):
                        location = resp.headers.get("Location")
                        if not location:
                            raise FeedProxyError("redirect with no Location", 502)
                        # Resolve a relative Location against the current URL,
                        # then run the result through the same allowlist check.
                        # This is what stops a redirect escaping the allowlist.
                        nxt = str(yarl.URL(current).join(yarl.URL(location)))
                        validate(nxt)
                        current = nxt
                        continue

                    if resp.status != 200:
                        raise FeedProxyError(f"upstream returned {resp.status}", 502)

                    # StreamReader.read(n) returns AT MOST n bytes, not exactly
                    # n, so one call silently truncates a large body. The CISA
                    # KEV catalog is over 1.5MB and came back cut mid-string.
                    # Read to EOF, enforcing the cap as we go.
                    chunks = []
                    total = 0
                    async for chunk in resp.content.iter_chunked(65536):
                        total += len(chunk)
                        if total > MAX_BYTES:
                            raise FeedProxyError("upstream response too large", 502)
                        chunks.append(chunk)

                    body = b"".join(chunks)
                    content_type = resp.headers.get("Content-Type", "text/plain")
                    text = body.decode("utf-8", errors="replace")
                    result = (text, content_type)
                    cache.set(key, result, ttl=ttl)
                    return result

            raise FeedProxyError("too many redirects", 502)
    except FeedProxyError:
        raise
    except aiohttp.ClientError as e:
        logger.warning("feed proxy client error for %s: %s", current, e)
        raise FeedProxyError("could not reach upstream feed", 502)
    except TimeoutError:
        logger.warning("feed proxy timeout for %s", current)
        raise FeedProxyError("upstream feed timed out", 504)
