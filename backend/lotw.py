import aiohttp
import logging

logger = logging.getLogger(__name__)

LOTW_URL = "https://lotw.arrl.org/lotwuser/lotwreport.adi"


async def query_lotw(login: str, password: str) -> str:
    """
    Proxy a LoTW query. Credentials are used once and never stored.
    Returns raw ADIF string.
    """
    params = {
        "login": login,
        "password": password,
        "qso_query": "1",
        "qso_qsl": "yes",      # confirmed QSOs only
        "qso_qslsince": "1990-01-01",  # all time
    }

    async with aiohttp.ClientSession(
        timeout=aiohttp.ClientTimeout(total=60)
    ) as session:
        async with session.get(LOTW_URL, params=params) as r:
            if r.status != 200:
                raise Exception(f"LoTW HTTP {r.status}")
            text = await r.text()

            # LoTW returns HTML on auth failure
            if "<html" in text.lower():
                raise Exception("LoTW authentication failed")

            # Verify it looks like ADIF
            if "<eoh>" not in text.lower() and "<eor>" not in text.lower():
                raise Exception("LoTW returned unexpected response format")

            logger.info(f"LoTW fetch for {login}: {len(text)} bytes")
            return text
