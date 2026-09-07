// Browser smoke test. Covers what the DOM-free suite cannot: input.js, ui.js,
// render.js and the console layout.
//
//   cd crane-cab-dev && python3 -m http.server 8080 &
//   node test/smoke.mjs
//
// Needs playwright and a Chromium. index.html loads three.js from a CDN; if that
// is blocked, point PAGE at a copy of index.html whose import map is local.
// PAGE overrides the URL, CHROME the executable.
import { chromium } from 'playwright';

const results = [];
const rec = (n, ok, d) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? `  :: ${d}` : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await chromium.launch({
  executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  headless: true,
  args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist',
    '--autoplay-policy=no-user-gesture-required']
});

async function page(vw = 1440, vh = 900, dsf = 1) {
  const p = await b.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: dsf });
  p.__err = [];
  p.on('pageerror', (e) => p.__err.push(String(e)));
  p.on('console', (m) => {
    if (m.type() !== 'error') return;
    const at = (m.location() && m.location().url) || '';
    if (!/favicon|\/audio\//i.test(`${m.text()} ${at}`)) p.__err.push(`console: ${m.text()} @ ${at}`);
  });
  await p.goto(process.env.PAGE || 'http://127.0.0.1:8080/index.html?debug', { waitUntil: 'load' });
  await p.waitForFunction(() => !!window.__cab, null, { timeout: 20000 });
  return p;
}

// 1. Boots and plays a while with no errors.
{
  const p = await page();
  await p.click('#btn-start');
  await sleep(2500);
  await p.keyboard.down('d'); await p.keyboard.down('w'); await sleep(1200);
  await p.keyboard.up('d'); await p.keyboard.up('w');
  await p.keyboard.down('f'); await sleep(900); await p.keyboard.up('f');
  await sleep(600);
  const s = await p.evaluate(() => ({
    fps: window.__cab.state.time.fps,
    radius: window.__cab.state.crane.radius,
    line: window.__cab.state.crane.line,
    node: window.__cab.state.radio.node
  }));
  rec('boots, renders and flies with no page or console errors',
    p.__err.length === 0 && s.radius > 20.4 && s.line > 30.4,
    `${p.__err[0] || 'clean'}; radius ${s.radius.toFixed(2)} line ${s.line.toFixed(2)}`);
  await p.close();
}

// 2. The E-stop must not latch from a card. It used to dog the whole first lift
//    with nothing on screen to say why.
{
  const p = await page();
  await p.keyboard.press(' ');            // on the title card
  await p.click('#btn-start');
  await sleep(400);
  const latchedFromCard = await p.evaluate(() => window.__cab.state.intent.estop);
  await p.keyboard.press(' ');            // now in the seat, it should work
  await sleep(300);
  const latchedInSeat = await p.evaluate(() => window.__cab.state.intent.estop);
  const lampOn = await p.evaluate(() => document.getElementById('l-estop').classList.contains('on'));
  rec('the E-stop ignores a press from the title card, and works in the seat',
    latchedFromCard === false && latchedInSeat === true,
    `from card ${latchedFromCard}, in seat ${latchedInSeat}`);
  rec('and the console has a lamp saying so',
    lampOn === true, `lamp on ${lampOn}`);
  await p.close();
}

// 3. Gauges must not clip. The unit moved into the label so the value is digits.
{
  const p = await page(1280, 800);
  await p.click('#btn-start');
  await sleep(1200);
  const g = await p.evaluate(() => {
    const out = {};
    for (const id of ['g-load', 'g-rated', 'g-radius', 'g-height']) {
      const el = document.getElementById(id);
      out[id] = { text: el.textContent, over: el.scrollWidth > el.clientWidth + 1 };
    }
    out.label = document.getElementById('g-load-label').textContent;
    return out;
  });
  const clipped = Object.entries(g).filter(([k, v]) => v && v.over).map(([k]) => k);
  rec('no gauge value is clipped at 1280px',
    clipped.length === 0, `clipped: ${clipped.join(',') || 'none'}; load reads "${g['g-load'].text}" under "${g.label}"`);
  await p.close();
}

// 4. The console must fit a landscape phone, lamps included.
{
  const p = await page(844, 390);
  await p.click('#btn-start');
  await sleep(1200);
  const fit = await p.evaluate(() => {
    const lamps = document.querySelector('.lamps').getBoundingClientRect();
    return { lampBottom: Math.round(lamps.bottom), viewport: window.innerHeight };
  });
  rec('the lamp row fits on an 844x390 landscape phone',
    fit.lampBottom <= fit.viewport, `lamps end at ${fit.lampBottom} of ${fit.viewport}`);
  await p.close();
}

// 5. The hook camera inset on a display with a pixel ratio above 1. three
//    multiplies setViewport and setScissor by the pixel ratio itself, so passing
//    it the drawing buffer size double counted it: the inset was drawn entirely
//    off screen and the main view was left scaled by the ratio and cropped to its
//    lower left quarter for every frame after, until a window resize. Invisible
//    on a 1x display, which is why it shipped. Every check above runs at 1x.
{
  const p = await page(1280, 800, 2);
  await p.click('#btn-start');
  await sleep(1500);
  await p.keyboard.press('c');
  await sleep(900);
  const on = await p.evaluate(() => {
    const c = document.querySelector('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    const v = gl.getParameter(gl.VIEWPORT);
    return { buf: [c.width, c.height], vp: [v[0], v[1], v[2], v[3]],
      scissor: gl.getParameter(gl.SCISSOR_BOX), dpr: window.devicePixelRatio,
      wanted: window.__cab.state.intent.hookCam };
  });
  // The last thing render.js does is restore the full view, so the live viewport
  // has to be the whole drawing buffer, whatever the pixel ratio is.
  const full = on.vp[0] === 0 && on.vp[1] === 0 &&
    on.vp[2] === on.buf[0] && on.vp[3] === on.buf[1];
  // And the inset itself has to have been inside the buffer, not past its top.
  const insetOnScreen = on.scissor[1] >= 0 && on.scissor[1] + on.scissor[3] <= on.buf[1] &&
    on.scissor[2] > 0;
  rec('the hook cam inset stays on screen at devicePixelRatio 2 and leaves the main view alone',
    on.dpr === 2 && on.wanted === true && full && insetOnScreen && p.__err.length === 0,
    `dpr ${on.dpr} buffer ${on.buf} viewport ${on.vp} scissor ${on.scissor}`);
  await p.close();
}

// 6. The mic must not be keyed from a card. A T held across the title or the end
//    card used to arrive in the next lift already down, so ground's first word
//    was doubled and the operator started a fault down without touching a
//    control. Both halves matter: the phase guard, and ignoring auto repeat.
{
  const p = await page();
  await p.keyboard.down('t');              // held on the title card
  await p.click('#btn-start');
  await sleep(2500);                       // through ground's first call
  const st = await p.evaluate(() => ({
    ptt: window.__cab.state.intent.ptt,
    faults: window.__cab.state.radio.faults,
    node: window.__cab.state.radio.node,
    caption: window.__cab.state.radio.caption
  }));
  await p.keyboard.up('t');
  rec('a mic held across the title card does not double ground\'s first call',
    st.ptt === false && st.faults === 0 && st.node === 'check',
    `ptt ${st.ptt} faults ${st.faults} node ${st.node} caption "${st.caption}"`);
  await p.close();
}

// 7. The title card has to say which build it is. This is the whole point of the
//    stamp: a cached copy and a fresh one look identical until you read it.
{
  const p = await page();
  const stamp = await p.evaluate(() => {
    const e = document.getElementById('build-stamp');
    return { text: e ? e.textContent.trim() : null, visible: !!(e && e.offsetParent !== null) };
  });
  rec('the title card says which build it is',
    stamp.text && stamp.text.length > 0 && stamp.visible,
    `reads "${stamp.text}", visible ${stamp.visible}`);
  await p.close();
}

await b.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${results.length - bad}/${results.length} checks passed`);
process.exit(bad ? 1 : 0);
