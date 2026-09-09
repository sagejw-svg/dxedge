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


// 13. The radio leads every lift, and the controls card never mentioned it. A
//     new operator could see the numbered reply buttons and guess, but T and H
//     were undiscoverable, and sitting through ground's calls with no idea how
//     to answer costs faults for nothing. Both copies of the list have to carry
//     it, since the help card is what you reach for mid-lift.
{
  const p = await page();
  // dt and dd concatenate with nothing between them in textContent, so read the
  // key and its label separately - "T" and "Key the mic", not "TKey the mic".
  const lists = await p.evaluate(() => [...document.querySelectorAll('dl.controls')].map(
    (dl) => [...dl.querySelectorAll('div')].map((d) => {
      const dt = d.querySelector('dt'), dd = d.querySelector('dd');
      return `${dt ? dt.textContent.trim() : ''} = ${dd ? dd.textContent.trim() : ''}`;
    })));
  const covers = (rows) => {
    const t = rows.join(' | ');
    return /1.*4.*Answer ground/i.test(t) && /\bT\b.*mic/i.test(t) && /\bH\b.*Horn/i.test(t) &&
      /\bV\b.*Eyes on the load/i.test(t) && /\bZ\b.*Eyes front/i.test(t) &&
      /Move your head/i.test(t);
  };
  rec('the controls card says how to answer the radio, on the title and the help card',
    lists.length === 2 && lists.every(covers),
    `${lists.length} lists; covered ${JSON.stringify(lists.map(covers))}`);
  await p.close();
}


// 14. A clip that never reached the server is the one failure mode nothing else
//     here can see: the SPA catch-all answers a missing /crane-cab/audio/*.ogg
//     with 200 text/html, res.ok is true, and the HTML used to run straight into
//     decodeAudioData and be swallowed into a call that is mute with a clean
//     console. This serves the page with one clip missing and checks the game
//     says so and keeps playing.
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.__err = [];
  p.__warn = [];
  p.on('pageerror', (e) => p.__err.push(String(e)));
  p.on('console', (m) => { if (m.type() === 'warning') p.__warn.push(m.text()); });
  // Answer this one clip the way a missing file is really answered.
  await p.route('**/audio/RADIO_CHECK.ogg', (route) => route.fulfill({
    status: 200, contentType: 'text/html; charset=utf-8', body: '<!DOCTYPE html><html></html>'
  }));
  await p.goto(process.env.PAGE || 'http://127.0.0.1:8080/index.html?debug', { waitUntil: 'load' });
  await p.waitForFunction(() => !!window.__cab, null, { timeout: 20000 });
  await p.click('#btn-start');
  await sleep(3500);
  const st = await p.evaluate(() => ({
    node: window.__cab.state.radio.node,
    caption: window.__cab.state.radio.caption,
    phase: window.__cab.state.phase
  }));
  const warned = p.__warn.some((w) => /radio clip unavailable/i.test(w));
  rec('a clip the deploy missed is reported, and the lift plays on without it',
    warned && st.phase === 'playing' && st.caption.length > 0 && p.__err.length === 0,
    `warned ${warned} phase ${st.phase} caption "${st.caption}" errors ${JSON.stringify(p.__err)}`);
  await p.close();
}


// 15. The head. Two things nothing DOM-free can check: that "eyes on the load"
//     actually points the camera at the load, and that the head can now reach
//     through the glass floor the cab has been carrying since the graphics pass.
//     The yaw sign was reasoned about, and a sign reasoned about is exactly what
//     comes out backwards, so this measures the camera's own forward vector
//     against the block's own world position rather than re-deriving either.
{
  const p = await page();
  await p.click('#btn-start');
  await sleep(600);
  const results = await p.evaluate(async () => {
    const m = await import('./js/render.js');
    const cab = window.__cab;
    const out = [];
    // Close in, far out, and swung off the jib axis both ways.
    const cases = [
      { radius: 6, line: 20, sx: 0, sy: 0 },
      { radius: 40, line: 30, sx: 0, sy: 0 },
      { radius: 20, line: 25, sx: 0.18, sy: 0 },
      { radius: 20, line: 25, sx: -0.18, sy: 0 },
      { radius: 20, line: 25, sx: 0, sy: 0.15 }
    ];
    cab.state.look.tracking = true;
    for (const c of cases) {
      cab.state.crane.radius = c.radius;
      cab.state.crane.line = c.line;
      cab.state.load.swing.x = c.sx;
      cab.state.load.swing.y = c.sy;
      await new Promise((r) => setTimeout(r, 300));   // let the tick aim and the frame draw
      const eye = m._eye();
      const hook = m._hookWorld();
      if (!hook) { out.push({ c, error: 'no hook' }); continue; }
      const to = [hook[0] - eye.pos[0], hook[1] - eye.pos[1], hook[2] - eye.pos[2]];
      const len = Math.hypot(...to);
      const dot = (to[0] * eye.dir[0] + to[1] * eye.dir[1] + to[2] * eye.dir[2]) / len;
      out.push({ c, offBy: +(Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI).toFixed(2),
        pitch: +cab.state.look.pitch.toFixed(3) });
    }
    return out;
  });
  const worst = Math.max(...results.map((r) => r.offBy ?? 999));
  rec('eyes on the load actually points the head at the load',
    results.every((r) => typeof r.offBy === 'number') && worst < 6,
    `worst miss ${worst} deg across ${results.length} attitudes: ` +
    JSON.stringify(results.map((r) => `r${r.c.radius} sx${r.c.sx}: ${r.offBy} deg`)));
  // And the close-in case has to be steeper than the old limit could reach, or
  // the glass floor is still decorative.
  const closeIn = results[0];
  rec('and the head can look through the glass floor, which it could not before',
    closeIn.pitch < -1.2,
    `pitch at 6 m radius on 20 m of rope: ${closeIn.pitch} rad (old floor was -1.2)`);
  await p.close();
}


// 16. Every row added to the controls list pushes "Take the seat" further down
//     a landscape phone, and once it leaves the screen the game cannot be
//     started at all. The head controls tipped it over and the only symptom was
//     a click timing out three checks earlier, which says nothing about why.
{
  const p = await b.newPage({ viewport: { width: 844, height: 390 } });
  await p.goto(process.env.PAGE || 'http://127.0.0.1:8080/index.html?debug', { waitUntil: 'load' });
  await p.waitForFunction(() => !!window.__cab, null, { timeout: 20000 });
  const seen = await p.evaluate(() => {
    const b = document.getElementById('btn-start');
    const r = b.getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: window.innerHeight,
      // What the browser would actually hit at the button's centre.
      hit: (document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) || {}).id || null };
  });
  rec('the start button is on screen and clickable on a landscape phone',
    seen.top >= 0 && seen.bottom <= seen.h && seen.hit === 'btn-start',
    `button at ${seen.top}-${seen.bottom} of ${seen.h}, point hits "${seen.hit}"`);
  await p.close();
}


// 17. The crane bends toward a heavy load, and the rope has to be drawn where
//     the physics hangs it. pendulum.js hangs the load from radius + deflection;
//     if render kept using the trolley's own radius the rope would be visibly
//     beside the load it is holding, which is the sort of thing that reads as a
//     bug rather than as weight.
{
  const p = await page();
  await p.click('#btn-start');
  await sleep(600);
  const seen = await p.evaluate(async () => {
    const m = await import('./js/render.js');
    const cab = window.__cab;
    cab.state.crane.radius = 30;
    cab.state.crane.line = 20;
    cab.state.load.swing.x = 0; cab.state.load.swing.y = 0;
    cab.state.load.attached = true;
    cab.state.load.mass = 1800;
    await new Promise((r) => setTimeout(r, 1500));   // let the structure take up
    // Read the state in the same breath as the drawn position: the attach sets
    // the load swinging, so comparing a drawn hook against a settled hang point
    // would be comparing two different instants.
    const hook = m._hookWorld();
    const c = cab.state.crane;
    const sw = cab.state.load.swing;
    return {
      deflection: c.deflection, radius: c.radius, line: c.line,
      swingY: sw.y, swingX: sw.x,
      drawn: [hook[0], hook[2]]
    };
  });
  // Where the physics says the load hangs, in the jib frame: the bent jib's
  // radius, plus the swing off it.
  const alongJib = seen.radius + seen.deflection + Math.sin(seen.swingY) * seen.line;
  const acrossJib = Math.sin(seen.swingX) * seen.line;
  const wantR = Math.hypot(alongJib, acrossJib);
  const drawnR = Math.hypot(seen.drawn[0], seen.drawn[1]);
  rec('the rope is drawn from where the bent jib actually holds it',
    seen.deflection > 0.15 && Math.abs(drawnR - wantR) < 0.03,
    `trolley ${seen.radius}, bend ${seen.deflection.toFixed(3)}, swing ` +
    `${(seen.swingY * 180 / Math.PI).toFixed(2)} deg; hook drawn at ${drawnR.toFixed(3)}, ` +
    `physics hangs it at ${wantR.toFixed(3)}`);
  await p.close();
}


// 18. Which way the head turns. Pitch followed FPS convention and yaw followed
//     drag-the-map, so dragging right turned the view left while dragging down
//     turned it down: the two axes contradicted each other, and the arrow keys
//     made it the first thing a new player would notice.
//
//     Asserted against the world rather than a cross product, because a cross
//     product has a handedness convention to get wrong and this one got it
//     wrong first time round. With the house parked at slew 0 the jib runs along
//     world +x and the seat looks down it, so the operator's right hand points
//     at +z: turning the head right has to raise the view direction's z.
{
  const p = await page();
  await p.click('#btn-start');
  await sleep(600);
  await p.evaluate(() => {
    const s = window.__cab.state;
    s.crane.slew = 0; s.crane.slewVel = 0;
    s.look.yaw = 0; s.look.pitch = 0; s.look.tracking = false;
  });
  await sleep(200);
  const dirAfter = async (key) => {
    await p.evaluate(() => { window.__cab.state.look.yaw = 0; window.__cab.state.look.pitch = 0; });
    await sleep(150);
    await p.keyboard.down(key);
    await sleep(700);
    await p.keyboard.up(key);
    await sleep(150);
    return p.evaluate(async () => (await import('./js/render.js'))._eye().dir);
  };
  const right = await dirAfter('ArrowRight');
  const left = await dirAfter('ArrowLeft');
  const down = await dirAfter('ArrowDown');
  const up = await dirAfter('ArrowUp');
  rec('the arrow keys turn the head the way they point, on both axes',
    right[2] > 0.05 && left[2] < -0.05 && down[1] < -0.05 && up[1] > 0.05,
    `right z ${right[2].toFixed(3)} (want > 0), left z ${left[2].toFixed(3)} (want < 0), ` +
    `down y ${down[1].toFixed(3)} (want < 0), up y ${up[1].toFixed(3)} (want > 0)`);
  await p.close();
}


// 19. The operator has to be able to SEE the load. The cab has a glass floor for
//     exactly that and a frame around it, and the frame's front bar sat square
//     across the line of sight through a band of pitch either side of 57 degrees
//     down - which is where a close pick is. A head bolted to the seat could not
//     get past it and the player had no move available. Leaning fixed that band
//     and moved the problem to the steep end until the lean went out past the
//     frame, which is why this sweeps the whole trolley range and both a short
//     and a long rope rather than checking the one angle that prompted it.
//
//     Raycast, not a screenshot: "is anything solid between the eye and the
//     load" is the actual question, and a picture cannot answer it without a
//     human looking at it.
{
  const p = await page();
  await p.click('#btn-start');
  await sleep(700);
  const out = await p.evaluate(async () => {
    const m = await import('./js/render.js');
    const THREE = await import('three');
    const cab = window.__cab;
    const blocked = [];
    let n = 0;
    // Step 3, not 6: the band that was blocked is narrow (it sat near r=11 and
    // r=26 on a long rope) and a coarser sweep stepped straight over it, so the
    // check passed with the lean removed.
    for (let r = 5; r <= 54; r += 3) {
      for (const line of [12, 38]) {
        cab.state.crane.radius = r; cab.state.crane.line = line; cab.state.crane.slew = 0;
        cab.state.load.swing.x = 0.09; cab.state.load.swing.y = 0;
        cab.state.look.tracking = true;                    // eyes on the load
        await new Promise((z) => setTimeout(z, 60));
        n += 1;
        const eye = m._eye();
        const hook = m._hookWorld();
        const from = new THREE.Vector3(...eye.pos);
        const to = new THREE.Vector3(...hook);
        const hits = new THREE.Raycaster(from, to.clone().sub(from).normalize(), 0.01,
          Math.max(0.5, from.distanceTo(to) - 1))
          .intersectObjects(m._scene().children, true)
          // Cab furniture only, and the glass floor is glass: you can see through it.
          .filter((h) => h.object.type === 'Mesh' && h.object.visible &&
            h.distance < 6 && h.object.material.opacity !== 0.12);
        if (hits.length) blocked.push(`r=${r} line=${line} pitch ${(cab.state.look.pitch * 180 / Math.PI).toFixed(0)}`);
      }
    }
    // And leaning is for looking down, not something he does in the seat.
    cab.state.look.tracking = false;
    cab.state.look.pitch = 0;
    await new Promise((z) => setTimeout(z, 200));
    const seated = cab.state.look.leanX;
    return { n, blocked, seated };
  });
  rec('nothing in the cab stands between the operator and the load',
    out.blocked.length === 0 && out.seated === 0,
    `${out.blocked.length} of ${out.n} sight lines blocked` +
    `${out.blocked.length ? ': ' + JSON.stringify(out.blocked.slice(0, 5)) : ''}; ` +
    `seated lean ${out.seated.toFixed(3)} m`);
  await p.close();
}


// 21. James alt-tabbed out of the game with a key down and Z stopped working
//     for the rest of the session: the head stayed leaned out over the glass and
//     nothing brought it back. The keyup that would have unlatched Z went to
//     whatever took the focus. blur cleared the three latches that existed when
//     it was written and not the two added with the head controls, which is the
//     failure mode of one boolean per key. Now it is one set, cleared wholesale.
{
  const p = await page();
  await p.click('#btn-start');
  await sleep(1200);
  const look = () => p.evaluate(() => ({
    pitch: +window.__cab.state.look.pitch.toFixed(3),
    tracking: window.__cab.state.look.tracking
  }));

  // Alt-tab away with Z held. The keyup never arrives.
  await p.keyboard.down('z');
  await p.evaluate(() => window.dispatchEvent(new Event('blur')));
  // Look down over the sill again, the way you would for a tight pick.
  await p.keyboard.down('ArrowDown'); await sleep(900); await p.keyboard.up('ArrowDown');
  const leaned = await look();
  await p.keyboard.press('z'); await sleep(250);
  const afterZ = await look();

  // Same trap for V, which latches the same way. V is a toggle, so the proof is
  // that the press after the blur still flips it, not which way it lands: the
  // keydown before the blur has already flipped it once.
  await p.keyboard.down('v');
  await p.evaluate(() => window.dispatchEvent(new Event('blur')));
  await sleep(120);
  const beforeV = await look();
  await p.keyboard.press('v'); await sleep(250);
  const afterV = await look();

  rec('a key held across an alt-tab does not kill the head controls',
    leaned.pitch < -0.6 && Math.abs(afterZ.pitch + 0.35) < 0.01 &&
    afterV.tracking !== beforeV.tracking,
    `leaned to ${leaned.pitch}, Z brought it back to ${afterZ.pitch}, ` +
    `V after its own blur ${beforeV.tracking} -> ${afterV.tracking}`);
  await p.close();
}

// 22. The board on the after-action card. It is the one part of the card built
//     from a list rather than a number, so it is the one that can render empty
//     and still look fine.
{
  const p = await page();
  await p.evaluate(() => {
    const cab = window.__cab;
    cab.state.mission.result = 'win';
    cab.state.mission.landedAt = [22, 0, 12];
    cab.state.mission.landingPos = [22, 0, 12];
    cab.state.mission.landingTol = 0.4;
    cab.bus.emit('lift.win', { id: 0 });
  });
  await sleep(300);
  const board = await p.evaluate(() => {
    const rows = [...document.querySelectorAll('#ec-board-list li')];
    return {
      rows: rows.length,
      count: (document.getElementById('ec-board-count') || {}).textContent || '',
      named: rows.every((li) => (li.querySelector('b') || {}).textContent),
      described: rows.every((li) => (li.querySelector('span') || {}).textContent),
      fresh: rows.filter((li) => li.classList.contains('fresh')).length
    };
  });
  rec('the after-action card shows the whole board, with what was just unlocked',
    board.rows >= 15 && board.named && board.described &&
    /Board: \d+ of \d+/.test(board.count) && board.fresh >= 1,
    `${board.rows} rows, summary "${board.count}", ${board.fresh} marked new`);
  await p.close();
}


await b.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${results.length - bad}/${results.length} checks passed`);
process.exit(bad ? 1 : 0);
