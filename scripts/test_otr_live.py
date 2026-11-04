#!/usr/bin/env python3
"""Listenotr Radio, the schedule-synced virtual live station (/otr/live/).

The day's lineup is a pure function of the Eastern clock, so two listeners —
in any time zone — hear the same episode at the same offset. The page offers
Listen, mute, and volume only. Station breaks sit between shows.

Run:  python3 scripts/test_otr_live.py
"""
import http.server, os, socketserver, subprocess, threading

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "public"))
PORT = 8817
TONE = "/tmp/otr-live-tone.mp3"
CHROME = os.environ.get("OTR_CHROMIUM", "/opt/google/chrome/chrome")
BASE = f"http://127.0.0.1:{PORT}"

HOST_TEST = b"""<!doctype html><html><head><title>host</title></head><body>
<script src="/otr/live/listenotr-radio.js?v=4"></script>
<script>document.addEventListener('DOMContentLoaded', function(){
  var d = document.createElement('div'); d.id = 'otr-live'; document.body.appendChild(d);
});</script></body></html>"""


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def log_message(self, *a):
        pass

    def do_GET(self):
        if self.path.split("?")[0] == "/otr/live/host-test":
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(HOST_TEST)))
            self.end_headers()
            self.wfile.write(HOST_TEST)
            return
        return super().do_GET()


def fulfill_mp3(route):
    data = open(TONE, "rb").read()
    rng = route.request.headers.get("range")
    common = {"Content-Type": "audio/mpeg", "Accept-Ranges": "bytes"}
    if rng and rng.startswith("bytes="):
        spec = rng.split("=", 1)[1]
        a, _, b = spec.partition("-")
        start = int(a) if a else 0
        end = int(b) if b else len(data) - 1
        end = min(end, len(data) - 1)
        if start >= len(data) or start > end:
            route.fulfill(status=416, body=b"", headers={"Content-Range": f"bytes */{len(data)}"})
            return
        chunk = data[start:end + 1]
        route.fulfill(status=206, body=chunk, headers={
            **common,
            "Content-Range": f"bytes {start}-{end}/{len(data)}",
            "Content-Length": str(len(chunk)),
        })
        return
    route.fulfill(status=200, body=data, headers={**common, "Content-Length": str(len(data))})


def main():
    subprocess.check_call([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-f", "lavfi", "-i", "sine=frequency=440:duration=120",
        "-ar", "22050", "-ac", "1", "-b:a", "32k", TONE,
    ])
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", PORT), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()

    from playwright.sync_api import sync_playwright
    F = []

    def ck(name, cond, detail=""):
        print(("PASS" if cond else "FAIL"), name, ("" if cond else detail))
        if not cond:
            F.append(name)

    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=CHROME,
            args=["--autoplay-policy=no-user-gesture-required", "--no-sandbox", "--disable-dev-shm-usage"],
        )

        def open_page(tz="America/New_York", url=BASE + "/otr/live/", w=1100, h=900):
            ctx = browser.new_context(viewport={"width": w, "height": h}, timezone_id=tz)
            ctx.grant_permissions(["clipboard-read", "clipboard-write"], origin=BASE)
            pg = ctx.new_page()
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.route("https://archive.org/**", fulfill_mp3)
            pg.goto(url)
            pg.wait_for_function("window.__listenotr && __listenotr.booted()", timeout=15000)
            return pg, errs, ctx

        pg, errs, ctx = open_page()
        ck("standalone /otr/live/ boots with no page errors", not errs and pg.evaluate("__listenotr.failed()") == "", (errs, pg.evaluate("__listenotr.failed()")))
        ck("mount point #otr-live is filled", pg.locator("#otr-live .lr-show").inner_text() not in ("", "Tuning the lineup…"))
        ck("a full day of half-hour blocks", pg.evaluate("__listenotr.blocks()") == 48)

        # Eastern wall clock round-trips, including a fraction of a second.
        rt = pg.evaluate("""() => {
          const sod = 20 * 3600 + 125.4;
          const ms = __listenotr.unixFor('2026-11-04', sod);
          const w = __listenotr.wall(ms);
          return { ms, dateKey: w.dateKey, sod: w.sod, delta: Math.abs(w.sod - sod) };
        }""")
        ck("unix time for 8:12:05.4 PM Eastern lands on that Eastern instant", rt["dateKey"] == "2026-11-04" and rt["delta"] < 0.02, rt)

        eight = pg.evaluate("() => __listenotr.onAir(__listenotr.unixFor('2026-11-04', 20*3600))")
        eight30 = pg.evaluate("() => __listenotr.onAir(__listenotr.unixFor('2026-11-04', 20*3600+30*60))")
        nine = pg.evaluate("() => __listenotr.onAir(__listenotr.unixFor('2026-11-04', 21*3600))")
        ck("8:00 PM is the mystery block, Suspense, from the top",
           eight["kind"] == "show" and eight["label"] == "Mystery" and eight["showId"] == "suspense" and eight["offset"] < 0.05, eight)
        ck("8:30 PM is comedy, the Jack Benny Show, from the top",
           eight30["kind"] == "show" and eight30["label"] == "Comedy" and eight30["showId"] == "the-jack-benny-show" and eight30["offset"] < 0.05, eight30)
        ck("9:00 PM is the western, the Lone Ranger, from the top",
           nine["kind"] == "show" and nine["label"] == "Western" and nine["showId"] == "the-lone-ranger" and nine["offset"] < 0.05, nine)

        into = pg.evaluate("() => __listenotr.onAir(__listenotr.unixFor('2026-11-04', 20*3600+125.4))")
        ck("8:02:05.4 PM is 125.4 seconds into the 8:00 episode",
           into["showId"] == eight["showId"] and into["epIndex"] == eight["epIndex"] and abs(into["offset"] - 125.4) < 0.05, into)

        day = pg.evaluate("() => __listenotr.day('2026-11-04')")
        abut = all(day[i]["start"] + day[i]["dur"] == day[i + 1]["start"] for i in range(len(day) - 1))
        covered = day and day[0]["start"] == 0 and day[-1]["start"] + day[-1]["dur"] == 86400
        ck("the day abuts: no gaps, no overlaps, midnight to midnight", abut and covered, (day[0]["start"] if day else None, day[-1]["start"] + day[-1]["dur"] if day else None, len(day)))

        shows = [it for it in day if it["kind"] == "show"]
        breaks = [it for it in day if it["kind"] == "break"]
        ck("a station break follows every show", len(breaks) >= len(shows) and all(it["line"] and "Old Time Radio on listen O T R dot com" in it["line"] for it in breaks), (len(shows), len(breaks)))
        mystery = next(it for it in day if it["kind"] == "show" and it["start"] == 20 * 3600)
        mystery_break = next(it for it in day if it["kind"] == "break" and it["start"] == mystery["start"] + mystery["dur"])
        ck("the break after the 8:00 mystery announces Jack Benny and plays that clip",
           mystery_break["nextShowId"] == "the-jack-benny-show"
           and "Jack Benny" in mystery_break["line"]
           and any("the-jack-benny-show.mp3" in (c.get("url") or "") for c in (mystery_break.get("cues") or [])), mystery_break)
        def break_urls(it):
            return " ".join((c.get("url") or "") for c in (it.get("cues") or []))
        ck("every break plays an up-next line or a station ID from the pack",
           breaks and all(("up-next/" in break_urls(it) or "/idents/" in break_urls(it) or not it.get("cues")) for it in breaks))
        fit = pg.evaluate("""() => {
          const day = __listenotr.day('2026-11-04');
          const bad = [];
          day.forEach(function (it) {
            if (it.kind !== 'break') return;
            var s = 0;
            (it.cues || []).forEach(function (c) { s += c.dur || 0; });
            if (s > it.dur + 0.05) bad.push({ start: it.start, dur: it.dur, sum: s });
          });
          return { badN: bad.length, sample: bad.slice(0, 3) };
        }""")
        ck("no announcer clip is scheduled past the end of its break", fit["badN"] == 0, fit)
        into_mystery = next(it for it in day if it["kind"] == "break" and it.get("nextShowId") == "suspense" and it.get("nextStart") == 20 * 3600)
        cue_urls = [c["url"] for c in (into_mystery.get("cues") or [])]
        ck("the break into the 8 o'clock mystery opens with the jingle, then the voice ID",
           len(cue_urls) >= 2 and cue_urls[0].endswith("jingle.mp3") and "jingle-voice-id.mp3" in cue_urls[1]
           and any("up-next/suspense.mp3" in u for u in cue_urls), cue_urls)

        # Same instant, three zones. The lineup is Eastern, not the listener's zone.
        ms = pg.evaluate("__listenotr.unixFor('2026-11-04', 20*3600+400)")
        la, _, ctx_la = open_page("America/Los_Angeles")
        tk, _, ctx_tk = open_page("Asia/Tokyo")
        a_ny = pg.evaluate("(ms) => __listenotr.onAir(ms)", ms)
        a_la = la.evaluate("(ms) => __listenotr.onAir(ms)", ms)
        a_tk = tk.evaluate("(ms) => __listenotr.onAir(ms)", ms)
        ck("New York, Los Angeles and Tokyo hear the same episode at the same offset", a_ny == a_la == a_tk, (a_ny, a_la, a_tk))

        uniq = pg.evaluate("""() => {
          const seen = {};
          for (let i = 0; i < 21; i++) {
            const key = __listenotr.unixFor('2026-11-04', 20*3600);
            const day = new Date(Date.UTC(2026, 10, 4 + i));
            const dk = day.toISOString().slice(0, 10);
            const a = __listenotr.onAir(__listenotr.unixFor(dk, 20*3600));
            seen[a.showId + ':' + a.epIndex] = 1;
            if (a.showId !== 'suspense' || a.label !== 'Mystery') return { bad: a, dk };
          }
          return { n: Object.keys(seen).length };
        }""")
        ck("8:00 PM stays Suspense, and the episode changes from night to night", isinstance(uniq, dict) and uniq.get("n", 0) >= 6, uniq)

        # Tonight's lineup widget, controls, share link.
        text = pg.inner_text("#lrLineup")
        ck("tonight's lineup lists mystery, comedy and the western",
           "Mystery" in text and "Suspense" in text and "Comedy" in text and "Jack Benny" in text and "Western" in text and "Lone Ranger" in text, text[:400])
        now_row = pg.evaluate("""() => {
          __listenotr.setClock(__listenotr.unixFor('2026-11-04', 20*3600+90));
          const row = document.querySelector('#lrLineup li.now');
          return { kicker: document.querySelector('#lrKicker').textContent, show: document.querySelector('#lrShow').textContent,
                   next: document.querySelector('#lrNext').textContent, row: row ? row.innerText : '' };
        }""")
        ck("now playing, up next and the highlighted lineup row follow the clock",
           now_row["kicker"] == "Now playing" and now_row["show"] == "Suspense" and "Jack Benny" in now_row["next"] and "Mystery" in now_row["row"], now_row)

        controls = pg.evaluate("""() => {
          const root = document.querySelector('#otr-live');
          return {
            buttons: [...root.querySelectorAll('button')].map(b => b.id),
            inputs: [...root.querySelectorAll('input')].map(i => ({ id: i.id, type: i.type, readOnly: i.readOnly })),
            controls: document.querySelector('#lrAudio').controls,
            bar: document.querySelector('#lrBar').tagName
          };
        }""")
        ck("controls are play and share, plus a volume slider — no seek bar",
           controls["buttons"] == ["lrPlay", "lrShare"]
           and controls["controls"] is False
           and controls["bar"] == "DIV"
           and [i["id"] for i in controls["inputs"]] == ["lrVol", "lrLink"]
           and controls["inputs"][0]["type"] == "range"
           and controls["inputs"][1]["readOnly"] is True, controls)

        # Playback seeks to the live offset, snaps forward when the clock moves,
        # holds still while paused, and rejoins live on play. Archive audio is a local tone.
        pg.evaluate("__listenotr.setClock(__listenotr.unixFor('2026-11-04', 20*3600+10))")
        pg.click("#lrPlay")
        pg.wait_for_function("() => { const a = __listenotr.audio(); return !__listenotr.paused() && a.time > 6 && a.time < 16; }", timeout=8000)
        heard = pg.evaluate("__listenotr.audio()")
        ck("listen seeks to the live offset of the scheduled episode",
           "archive.org" in heard["src"] and 6 < heard["time"] < 16 and heard["controls"] is False, heard)

        pg.evaluate("__listenotr.setClock(__listenotr.unixFor('2026-11-04', 20*3600+40))")
        pg.wait_for_function("() => { const t = __listenotr.audio().time; return t > 34 && t < 48; }", timeout=4000)
        ck("a clock jump while listening seeks to the new shared offset", 34 < pg.evaluate("__listenotr.audio().time") < 48)

        ck("once Listen has started, the button is Mute, not Pause",
           pg.evaluate("document.querySelector('#lrPlay').textContent") == "Mute")
        pg.evaluate("document.querySelector('#lrAudio').playbackRate = 1.5")
        pg.wait_for_function("() => Math.abs(__listenotr.audio().rate - 1) < 0.001", timeout=2000)
        ck("live audio stays at 1x even if the rate is changed", abs(pg.evaluate("__listenotr.audio().rate") - 1) < 0.001)

        pg.click("#lrPlay")
        pg.evaluate("__listenotr.setClock(__listenotr.unixFor('2026-11-04', 20*3600+70))")
        pg.wait_for_function("() => { const t = __listenotr.audio().time; return t > 60 && t < 82; }", timeout=4000)
        muted = pg.evaluate("""() => ({
          label: document.querySelector('#lrPlay').textContent,
          paused: __listenotr.paused(),
          muted: __listenotr.muted(),
          elMuted: document.querySelector('#lrAudio').muted,
          elPaused: document.querySelector('#lrAudio').paused
        })""")
        ck("Mute keeps the stream playing on the clock",
           muted["label"] == "Unmute" and muted["muted"] and muted["elMuted"] and not muted["paused"] and not muted["elPaused"], muted)
        pg.click("#lrPlay")
        ck("Unmute stays on that same live moment",
           pg.evaluate("() => !__listenotr.muted() && !__listenotr.paused() && document.querySelector('#lrPlay').textContent === 'Mute' && __listenotr.audio().time > 60"))

        pg.evaluate("__listenotr.pause()")
        held = pg.evaluate("__listenotr.audio().time")
        pg.evaluate("__listenotr.setClock(__listenotr.unixFor('2026-11-04', 20*3600+100))")
        pg.wait_for_timeout(400)
        while_paused = pg.evaluate("() => ({ time: __listenotr.audio().time, paused: __listenotr.paused(), show: document.querySelector('#lrShow').textContent, left: document.querySelector('#lrLeft').textContent })")
        ck("pause holds the audio where it was while the lineup keeps the live clock",
           while_paused["paused"] and abs(while_paused["time"] - held) < 1.5 and while_paused["show"] == "Suspense" and "left" in while_paused["left"], while_paused)

        pg.evaluate("__listenotr.play()")
        pg.wait_for_function("() => { const t = __listenotr.audio().time; return t > 90 && t < 112; }", timeout=4000)
        ck("play rejoins live instead of resuming the paused spot", 90 < pg.evaluate("__listenotr.audio().time") < 112)

        # The bar is an elapsed indicator, not a seek control.
        bar_ui = pg.evaluate("""() => {
          const bar = document.getElementById('lrBar');
          return { tag: bar.tagName, role: bar.getAttribute('role'), pe: getComputedStyle(bar).pointerEvents };
        }""")
        ck("the live progress bar is a read-only elapsed indicator",
           bar_ui["tag"] == "DIV" and bar_ui["role"] == "progressbar" and bar_ui["pe"] == "none", bar_ui)
        before = pg.evaluate("__listenotr.audio().time")
        pg.click("#lrBar", force=True)
        pg.keyboard.press("ArrowRight")
        pg.keyboard.press("ArrowLeft")
        pg.wait_for_timeout(300)
        ck("clicking or arrow keys do not seek the live broadcast", abs(pg.evaluate("__listenotr.audio().time") - before) < 3)
        pg.evaluate("document.querySelector('#lrAudio').currentTime = 4")
        pg.wait_for_function("() => { const t = __listenotr.audio().time; return t > 90 && t < 112; }", timeout=3000)
        ck("a seek from outside the bar is pulled back onto the clock", 90 < pg.evaluate("__listenotr.audio().time") < 112)

        pg.evaluate("__listenotr.volume(0.2)")
        ck("volume is the listener's own", abs(pg.evaluate("__listenotr.volume()") - 0.2) < 0.001)

        benny_at = mystery_break["start"]
        for cue in mystery_break["cues"]:
            if "the-jack-benny-show.mp3" in cue["url"]:
                break
            benny_at += cue["dur"]
        brk_at = benny_at + 0.3
        pg.evaluate("(sod) => __listenotr.setClock(__listenotr.unixFor('2026-11-04', sod))", brk_at)
        pg.wait_for_function("() => __listenotr.audio().src.indexOf('the-jack-benny-show.mp3') >= 0", timeout=8000)
        break_ui = pg.evaluate("() => ({ kicker: document.querySelector('#lrKicker').textContent, ep: document.querySelector('#lrEp').textContent, src: __listenotr.audio().src, time: __listenotr.audio().time })")
        ck("the station break plays the announcer clip from its own offset",
           break_ui["kicker"] == "Station break" and "Jack Benny" in break_ui["ep"] and "the-jack-benny-show.mp3" in break_ui["src"] and break_ui["time"] < 3, break_ui)
        # The break is over on the clock while the announcer file is still playing.
        # The clip must finish, then the episode has to start. Playback must not stay paused.
        pg.evaluate("(sod) => __listenotr.setClock(__listenotr.unixFor('2026-11-04', sod))", mystery_break["start"] + mystery_break["dur"] + 1)
        pg.wait_for_function("""() => {
          const a = __listenotr.audio();
          return !a.paused && !__listenotr.paused() && a.src.indexOf('archive.org') >= 0;
        }""", timeout=12000)
        ck("when the announcer clip ends, the episode starts and playback does not stop",
           not pg.evaluate("__listenotr.audio().paused") and "archive.org" in pg.evaluate("__listenotr.audio().src"))

        pg.evaluate("""() => { try { Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }); } catch (e) {} }""")
        pg.click("#lrShare")
        pg.wait_for_function("() => !document.querySelector('#lrCopied').hidden", timeout=3000)
        copied = pg.evaluate("navigator.clipboard.readText()")
        shown = pg.input_value("#lrLink")
        ck("share link is the live page, with no timestamp to seek to",
           copied == shown == BASE + "/otr/live" and "t=" not in copied, (copied, shown))

        # A host that adds #otr-live after the script (Basic mode) still gets the station.
        host, herrs, hctx = open_page(url=BASE + "/otr/live/host-test")
        ck("a late #otr-live mount receives the same station",
           not herrs and host.evaluate("__listenotr.booted()") and "Suspense" in host.inner_text("#lrLineup"), herrs)

        # Mounted into the real player: Basic shows the station instead of the
        # placeholder, and Advanced keeps a compact Listen Live by the switch.
        basic_ctx = browser.new_context(viewport={"width": 390, "height": 844})
        basic_ctx.add_init_script("localStorage.setItem('otr_mode','basic')")
        basic = basic_ctx.new_page()
        berrs = []
        basic.on("pageerror", lambda e: berrs.append(str(e)))
        basic.goto(BASE + "/otr/")
        basic.wait_for_function("window.__listenotr && __listenotr.booted() && document.querySelector('#otr-live [data-otr-live-player]')", timeout=20000)
        mounted = basic.evaluate("""() => ({
          player: !!document.querySelector('#otr-live [data-otr-live-player]'),
          placeholder: document.getElementById('otr-live-placeholder').hidden,
          ready: document.getElementById('otr-live').getAttribute('data-otr-live'),
          sw: document.documentElement.scrollWidth
        })""")
        ck("Basic hosts the station in #otr-live and hides the placeholder",
           not berrs and mounted["player"] and mounted["placeholder"] and mounted["ready"] == "ready" and mounted["sw"] <= 390,
           (berrs[:3], mounted))
        basic.click("#otrModeAdvanced")
        basic.wait_for_function("() => OTRMode.current()==='advanced' && document.querySelector('#networkChips .station[data-net=listenotr] .st-now') && document.querySelector('#networkChips .station[data-net=listenotr] .st-now').textContent.trim()", timeout=20000)
        adv = basic.evaluate("""() => {
          const cards = [...document.querySelectorAll('#networkChips .station')].map(e => e.dataset.net);
          const card = document.querySelector('#networkChips .station[data-net=listenotr]');
          return {
            mode: OTRMode.current(),
            button: !!document.getElementById('otrAdvLive'),
            first: cards[0],
            name: card.querySelector('.st-name').textContent,
            now: card.querySelector('.st-now').textContent.trim(),
            left: card.querySelector('.st-left .l').textContent,
            next: card.querySelector('.st-next').textContent
          };
        }""")
        ck("Advanced has no Listen Live switch, and Listenotr Radio (Live) leads the station list",
           adv["mode"] == "advanced" and not adv["button"] and adv["first"] == "listenotr"
           and adv["name"].startswith("Listenotr Radio (Live)") and adv["now"] and adv["left"].endswith("left") and adv["next"].startswith("then"), adv)
        basic.locator("#networkChips .station[data-net=listenotr]").click()
        basic.wait_for_function("() => OTRMode.current()==='advanced' && !__listenotr.paused() && __otr.state.network==='listenotr'", timeout=5000)
        ck("choosing Listenotr Radio (Live) plays the synced broadcast and stays on Advanced",
           basic.evaluate("OTRMode.current()") == "advanced" and basic.evaluate("__otr.state.network") == "listenotr" and not basic.evaluate("__listenotr.paused()"))
        def shown(page, ids):
            return page.evaluate("""(ids) => {
              const on = (id) => {
                const el = document.getElementById(id);
                if (!el) return false;
                return getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
              };
              const out = {};
              ids.forEach(id => { out[id] = on(id); });
              return out;
            }""", ids)
        basic.evaluate("document.getElementById('moreBtn').click()")
        live_ui = shown(basic, ["prevBtn", "backBtn", "fwdBtn", "skipBtn", "rateRow", "linkBtn", "moreRandom", "sleepSel", "popBtn2", "vol", "playBtn", "bar"])
        live_ui["play"] = basic.evaluate("document.getElementById('playBtn').textContent")
        live_ui["locked"] = basic.evaluate("document.body.classList.contains('otr-liveclock')")
        PHRASE = "Disabled in live listen mode"
        live_ui["tips"] = basic.evaluate("""(phrase) => {
          const ids = ['prevBtn','backBtn','fwdBtn','skipBtn','linkBtn','moreRandom','bar','rateSel'];
          const out = {};
          ids.forEach(id => {
            const el = document.getElementById(id);
            const wrap = el.closest('.livetip');
            out[id] = {
              shown: getComputedStyle(el).display !== 'none',
              disabled: el.tagName === 'DIV' ? el.getAttribute('aria-disabled') === 'true' : !!el.disabled,
              aria: el.getAttribute('aria-label'),
              title: (wrap && wrap.getAttribute('title')) || el.getAttribute('title'),
              grey: parseFloat(getComputedStyle(el).opacity) < 0.7
            };
          });
          const prev = document.getElementById('prevBtn').closest('.livetip');
          prev.click();
          out.tapped = prev.classList.contains('showtip') && prev.querySelector('.livebubble').textContent === phrase;
          return out;
        }""", PHRASE)
        tips_ok = all(
            live_ui["tips"][i]["shown"] and live_ui["tips"][i]["disabled"]
            and live_ui["tips"][i]["aria"] == PHRASE and live_ui["tips"][i]["title"] == PHRASE
            and live_ui["tips"][i]["grey"]
            for i in ("prevBtn", "backBtn", "fwdBtn", "skipBtn", "linkBtn", "moreRandom", "bar", "rateSel")
        )
        ck("Advanced live greys out speed, skip, seek, surprise and copy-moment with the live tooltip",
           live_ui["locked"] and tips_ok and live_ui["tips"]["tapped"]
           and "Mute" in live_ui["play"] and "Pause" not in live_ui["play"]
           and live_ui["prevBtn"] and live_ui["skipBtn"] and live_ui["rateRow"] and live_ui["linkBtn"] and live_ui["moreRandom"] and live_ui["bar"]
           and live_ui["sleepSel"] and live_ui["popBtn2"] and live_ui["vol"], live_ui)
        basic.evaluate("document.getElementById('moreClose').click()")
        basic.evaluate("__listenotr.setClock(__listenotr.unixFor('2026-11-04', 20*3600+10))")
        basic.wait_for_function("() => { const a = __listenotr.audio(); return !__listenotr.paused() && !a.paused && a.time > 6 && a.time < 16; }", timeout=8000)
        basic.evaluate("document.getElementById('playBtn').click()")
        basic.evaluate("__listenotr.setClock(__listenotr.unixFor('2026-11-04', 20*3600+40))")
        basic.wait_for_function("() => { const a = __listenotr.audio(); return __listenotr.muted() && !__listenotr.paused() && !a.paused && a.time > 34 && a.time < 48; }", timeout=4000)
        ck("Advanced Mute keeps the stream playing on the clock",
           basic.evaluate("() => __listenotr.muted() && !__listenotr.paused() && !document.querySelector('#lrAudio').paused && document.getElementById('playBtn').textContent.indexOf('Unmute') >= 0"))
        basic.locator("#networkChips .station[data-net=nbc]").click()
        basic.wait_for_function("() => __otr.state.network==='nbc' && !document.body.classList.contains('otr-liveclock')", timeout=8000)
        basic.evaluate("if (document.getElementById('morePanel').hidden) document.getElementById('moreBtn').click()")
        back = shown(basic, ["prevBtn", "skipBtn", "rateRow", "linkBtn", "moreRandom", "sleepSel", "popBtn2"])
        back["play"] = basic.evaluate("document.getElementById('playBtn').textContent")
        back["restored"] = basic.evaluate("""() => {
          const prev = document.getElementById('prevBtn');
          const bar = document.getElementById('bar');
          const rate = document.getElementById('rateSel');
          return {
            prevAria: prev.getAttribute('aria-label'),
            prevDisabled: prev.disabled,
            rateDisabled: rate.disabled,
            barAria: bar.getAttribute('aria-label'),
            barPe: getComputedStyle(bar).pointerEvents
          };
        }""")
        ck("a normal station restores speed, skip, surprise, copy-moment and play/pause",
           back["prevBtn"] and back["skipBtn"] and back["rateRow"] and back["linkBtn"] and back["moreRandom"]
           and back["sleepSel"] and back["popBtn2"] and "Mute" not in back["play"]
           and back["restored"]["prevAria"] == "Previous" and not back["restored"]["prevDisabled"]
           and not back["restored"]["rateDisabled"] and back["restored"]["barAria"] != "Disabled in live listen mode"
           and back["restored"]["barPe"] != "none", back)
        basic_ctx.close()

        # Other stations: the seek bar and skip still move playback. Archive audio is the local tone.
        lib, lerrs, lctx = open_page(url=BASE + "/otr/")
        lib.wait_for_function("window.__otr && __otr.ready()", timeout=20000)
        lib.evaluate("window.__otr.startChannel('crime')")
        lib.wait_for_function("() => { const a = document.getElementById('audio'); return !a.paused && a.currentTime > 1 && a.duration > 20; }", timeout=20000)
        spot = lib.evaluate("""() => {
          const a = document.getElementById('audio');
          const r = document.getElementById('bar').getBoundingClientRect();
          const frac = a.duration ? a.currentTime / a.duration : 0;
          return { x: r.x + r.width * (frac > 0.5 ? 0.12 : 0.88), y: r.y + r.height / 2, before: a.currentTime, qi: __otr.state.qi };
        }""")
        lib.mouse.click(spot["x"], spot["y"])
        lib.wait_for_timeout(500)
        sought = lib.evaluate("document.getElementById('audio').currentTime")
        ck("on a normal station the seek bar still seeks", abs(sought - spot["before"]) > 8, (spot["before"], sought))
        lib.click("#skipBtn")
        lib.wait_for_function("(qi) => __otr.state.qi !== qi && !document.getElementById('audio').paused && document.getElementById('audio').duration > 20 && document.getElementById('audio').currentTime > 0.5", arg=spot["qi"], timeout=15000)
        ck("on a normal station skip still moves to the next episode", lib.evaluate("__otr.state.qi") != spot["qi"])
        lib.evaluate("document.activeElement && document.activeElement.blur()")
        t_arrow = lib.evaluate("document.getElementById('audio').currentTime")
        lib.keyboard.press("ArrowRight")
        lib.wait_for_timeout(600)
        ck("on a normal station the right arrow still seeks forward",
           lib.evaluate("document.getElementById('audio').currentTime") - t_arrow > 8, (t_arrow, lib.evaluate("document.getElementById('audio').currentTime")))
        lctx.close()

        phone, _, pctx = open_page(w=390, h=844)
        phone.evaluate("__listenotr.setClock(__listenotr.unixFor('2026-11-04', 21*3600+30))")
        ck("a phone still shows now playing and tonight's lineup",
           phone.locator("#lrShow").inner_text() == "The Lone Ranger" and phone.locator("#lrLineup li").count() >= 8)

        os.makedirs("/tmp/otr-live-shots", exist_ok=True)
        pg.evaluate("__listenotr.setClock(__listenotr.unixFor('2026-11-04', 20*3600+90))")
        pg.screenshot(path="/tmp/otr-live-shots/desktop.png", full_page=True)
        phone.screenshot(path="/tmp/otr-live-shots/phone.png", full_page=True)

        for c in (ctx, ctx_la, ctx_tk, hctx, pctx):
            c.close()
        browser.close()
    srv.shutdown()
    print("\n" + ("ALL PASSED" if not F else f"{len(F)} FAILED: {F}"))
    return 1 if F else 0


if __name__ == "__main__":
    raise SystemExit(main())
