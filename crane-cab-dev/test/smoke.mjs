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
  await p.keyboard.down('d'); await p.keyboard.down('w'); await sleep(2000);
  await p.keyboard.up('d'); await p.keyboard.up('w');
  await p.keyboard.down('f'); await sleep(1500); await p.keyboard.up('f');
  await sleep(600);
  const s = await p.evaluate(() => ({
    fps: window.__cab.state.time.fps,
    radius: window.__cab.state.crane.radius,
    line: window.__cab.state.crane.line,
    node: window.__cab.state.radio.node
  }));
  // Movement in the commanded direction, not a distance. Software rendering runs
  // the accumulator right at its catch-up cap, so anything that costs a frame
  // here shows up as the crane travelling less per wall-clock second, and a
  // threshold tight enough to be a distance is really a benchmark of the test
  // machine's GPU. What this check is for is that the page boots, renders, takes
  // the keyboard and moves the right axes the right way with a clean console.
  rec('boots, renders and flies with no page or console errors',
    p.__err.length === 0 && s.radius > 20.1 && s.line > 30.1,
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

// 8. The scene has to be lit by something that casts. Everything solid joins the
//    shadow pass and nothing transparent does: a painted pad ring or a pane of
//    cab glass throwing a shadow would be a lie about what is solid, and a
//    twelve metre scaffold that throws none is why the whole site read flat.
{
  const p = await page();
  await p.click('#btn-start');
  await sleep(1500);
  const g = await p.evaluate(async () => {
    const mod = await import('./js/render.js');
    const scene = mod._scene();
    const r = mod._renderer();
    let casters = 0, transparentCasters = 0, lights = 0, shadowLights = 0;
    scene.traverse((o) => {
      if (o.isLight) { lights += 1; if (o.castShadow) shadowLights += 1; }
      if (!o.isMesh) return;
      if (!o.castShadow) return;
      casters += 1;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (mats.some((m) => m && (m.transparent || m.depthWrite === false))) transparentCasters += 1;
    });
    return { casters, transparentCasters, lights, shadowLights,
      enabled: r.shadowMap.enabled, on: mod._shadowsOn(),
      calls: r.info.render.calls, tris: r.info.render.triangles };
  });
  rec('the site casts shadows, and nothing transparent does',
    g.enabled && g.on && g.shadowLights === 1 && g.casters > 20 && g.transparentCasters === 0,
    `${g.casters} casters, ${g.transparentCasters} of them transparent, ${g.shadowLights} of ${g.lights} lights cast`);
  // A budget, not a benchmark. This is a small scene and it should stay one:
  // the cost that matters is the shadow pass and the hook cam's second pass,
  // and both scale with how much is in the scene at all.
  rec('and the scene stays small enough to afford them',
    g.calls <= 90 && g.tris <= 40000,
    `${g.calls} draw calls, ${g.tris} triangles`);
  await p.close();
}

// 9. The deck volumes the lift is scored against have to be drawn, and only the
//    active mission's. A player cannot avoid what they cannot see, and mission
//    2's scaffold was invisible against the deck until it was given its own
//    value and a marked top.
{
  const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
  await p.addInitScript(() => {
    try { localStorage.setItem('craneCab_ach', JSON.stringify({ v: 1, data: { awards: {}, hooks: 0, furthest: 2 } })); } catch {}
  });
  await p.goto(process.env.PAGE || 'http://127.0.0.1:8080/index.html?debug', { waitUntil: 'load' });
  await p.waitForFunction(() => !!window.__cab, null, { timeout: 20000 });
  await p.click('#btn-start');
  await sleep(1800);
  const v = await p.evaluate(async () => {
    const mod = await import('./js/render.js');
    const scene = mod._scene();
    // The scaffold is the only 6 x 12 x 6 box in the world.
    let scaffold = null;
    let others = 0;
    scene.traverse((o) => {
      if (!o.isMesh || !o.geometry || o.geometry.type !== 'BoxGeometry') return;
      const q = o.geometry.parameters;
      if (q.width === 6 && q.height === 12 && q.depth === 6) scaffold = { visible: o.visible, y: o.position.y };
      // mission 3's shaft walls must not be showing during mission 2
      if (q.width === 6 && q.height === 12 && q.depth === 0.5 && o.visible) others += 1;
    });
    return { mission: window.__cab.state.mission.id, scaffold, others };
  });
  rec('the mission\'s deck volumes are drawn, and only that mission\'s',
    v.mission === 2 && v.scaffold && v.scaffold.visible === true && v.others === 0,
    `mission ${v.mission}, scaffold ${JSON.stringify(v.scaffold)}, other missions' volumes showing ${v.others}`);
  await p.close();
}

// 10. And the shadow pass gives up rather than dragging the frame rate down with
//     it. Headless software rendering is a genuinely slow renderer, which makes
//     this the one place the guard can be watched doing its job.
{
  const p = await page();
  await p.click('#btn-start');
  const state = async () => p.evaluate(async () => {
    const m = await import('./js/render.js');
    return { on: m._shadowsOn(), fps: window.__cab.state.time.fps, mapOn: m._renderer().shadowMap.enabled };
  });
  await sleep(4000);
  const early = await state();
  await sleep(9000);
  const late = await state();
  rec('the shadow pass gives up on a renderer that cannot afford it',
    early.on === true && late.on === false && late.mapOn === false && late.fps < 20,
    `at 4 s shadows ${early.on} (${early.fps} fps), at 13 s shadows ${late.on} (${late.fps} fps)`);
  await p.close();
}

// 11. The ground crew has a voice now, and nothing in the DOM-free suite can
//     prove it: that suite has no fetch, no AudioContext and no decoder. This
//     watches the whole path in a real browser - the file comes back, the
//     browser decodes it, a source node is started on the radio bus - and
//     checks the decoded length against the number data/clips.js told the
//     director to size the transmission from. A clip that is re-encoded without
//     regenerating that table would pass every other check and then get cut off
//     mid-word in the cab.
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.__err = [];
  p.on('pageerror', (e) => p.__err.push(String(e)));
  await p.addInitScript(() => {
    // Installed before the game runs, because the context is built on the first
    // gesture and there is no way to reach into it afterwards.
    window.__audio = { decoded: [], started: 0, failed: [] };
    const AC = window.AudioContext || window.webkitAudioContext;
    const realDecode = AC.prototype.decodeAudioData;
    AC.prototype.decodeAudioData = function (data, ...rest) {
      const out = realDecode.call(this, data, ...rest);
      if (out && out.then) {
        out.then((buf) => window.__audio.decoded.push(buf.duration))
           .catch((e) => window.__audio.failed.push(String(e)));
      }
      return out;
    };
    const realStart = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...a) {
      if (this.buffer && this.buffer.duration > 0.3) window.__audio.started += 1;
      return realStart.apply(this, a);
    };
  });
  const fetched = [];
  p.on('response', (r) => { if (/\/audio\/.*\.ogg$/.test(r.url())) fetched.push([r.url().split('/').pop(), r.status()]); });
  await p.goto(process.env.PAGE || 'http://127.0.0.1:8080/index.html?debug', { waitUntil: 'load' });
  await p.waitForFunction(() => !!window.__cab, null, { timeout: 20000 });
  await p.click('#btn-start');
  await sleep(4000);                      // through ground's first call
  const a = await p.evaluate(() => window.__audio);
  const table = await p.evaluate(async () => (await import('./data/clips.js')).CLIP_SECONDS);
  const check = fetched.find(([f]) => f === 'RADIO_CHECK.ogg');
  // The decoded length has to be the one the director sized the call from. OGG
  // granule position is exact, so this is a tight bound, not a fuzzy one.
  const want = table.RADIO_CHECK;
  const got = a.decoded.length ? a.decoded[0] : null;
  rec('the ground crew is audible, and as long as the timing table says',
    !!check && check[1] === 200 && a.started > 0 && a.failed.length === 0 &&
    got !== null && Math.abs(got - want) < 0.05 && p.__err.length === 0,
    `fetched ${JSON.stringify(check)} started ${a.started} decoded ${got} want ${want} ` +
    `failed ${JSON.stringify(a.failed)} errors ${JSON.stringify(p.__err)}`);
  await p.close();
}

// 12. Full duplex, in the seat. Answering over the top of ground used to garble
//     both stations and cost a fault; now the button lights, the answer waits
//     for the call to finish, and it lands.
{
  const p = await page();
  await p.click('#btn-start');
  await sleep(400);                        // ground is mid radio check
  await p.keyboard.press('1');             // Copy, over the top of it
  const during = await p.evaluate(() => ({
    answered: window.__cab.state.radio.answered,
    lit: !!document.querySelector('#r-replies button.banked'),
    talking: window.__cab.state.radio.groundTimer > 0,
    node: window.__cab.state.radio.node
  }));
  // Waited on, not slept through: headless software rendering runs the clock at
  // roughly half real time and a fixed sleep here is a flake waiting to happen.
  let landed = true;
  await p.waitForFunction(() => window.__cab.state.radio.node !== 'check', null, { timeout: 15000 })
    .catch(() => { landed = false; });
  const after = await p.evaluate(() => ({
    node: window.__cab.state.radio.node,
    faults: window.__cab.state.radio.faults,
    answered: window.__cab.state.radio.answered,
    replied: window.__cab.state.radio.node
  }));
  rec('an answer over the top of ground lights the button, waits, then lands',
    during.answered === 'Copy' && during.lit && during.talking && during.node === 'check' &&
    landed && after.node !== 'check' && after.faults === 0 && after.answered === null,
    `during ${JSON.stringify(during)} after ${JSON.stringify(after)} landed ${landed}`);
  await p.close();
}


await b.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${results.length - bad}/${results.length} checks passed`);
process.exit(bad ? 1 : 0);
