// Three.js scene. READ state, never write it.
// Phase 0 had placeholder boxes. Phase 1 adds a fuller cab shell, a hook
// sheave, procedural textures, decorative pickup props, and a generic
// stadium-style backdrop for depth. All textures are drawn on <canvas> at
// runtime (no image files, no CDN beyond the Three.js import already in
// index.html) so this stays a dependency-free static folder.
//
// The pickup props are a visual preview: static crates placed at every mission's
// pickup.pos so the deck doesn't look empty. PHASE 3 makes the active mission's
// prop honest - it is hidden once that load is on the hook or has been set down
// somewhere else, and a crate appears wherever the load was released. The other
// missions' props are still all shown at once; Phase 4's mission flow decides
// which deck dressing belongs on screen.
//
// The backdrop is an original, generic tiered bowl with light towers. It is
// deliberately not a depiction of any real, trademarked venue (hard rule 7:
// no copied art). See CLAUDE.md.

import * as THREE from 'three';
import { MISSIONS } from '../data/missions.js';
import { CRANE } from '../data/crane.js';

let renderer, scene, camera;
let hookCam = null;            // looks straight down from the block
let trolley, hook, sheave;
const parts = {};

// PHASE 3. 8a: the box that hangs under the hook block while a load is attached.
// 8b: per-mission pickup props, so the active one can be hidden, plus one crate
// per mission parked at whatever spot its load was released on.
let hangingLoad = null;
const pickupProps = new Map();     // mission id -> [meshes]
const landedCrates = new Map();    // mission id -> mesh
const deckVolumes = new Map();     // mission id -> [meshes] for the collision boxes
const crateTextures = new Map();   // hue -> texture, so one crate is one texture
let landingPad = null;             // the spot the active lift is scored against
let padRing = null;                // recoloured when the load is inside tolerance
let landingMark = null;            // fixed-size approach ring, ticks and beacon
const PAD_AMBER = 0xe0a83a;
const PAD_GREEN = 0x6fbf73;
let loadShadow = null;             // the ground shadow of whatever is on the hook
let ropeMesh = null;               // a drawn rope, not a one pixel line
let contactRing = null;            // expanding ring on touchdown
let contactT = 0;                  // seconds left of the touchdown flash
let wasOnSurface = false;          // render-local edge memory, not a state write
const CONTACT_TIME = 0.45;
const UP = new THREE.Vector3(0, 1, 0);
let MAX_ANISO = 1;   // set once the renderer exists, read by the textures

// ---------- Procedural textures ----------

function canvasTexture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(canvas);
  if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function steelTexture({ base = '#c9b23a', hazard = false } = {}) {
  const tex = canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    // Brushed-metal streaks, subtle.
    for (let i = 0; i < 60; i++) {
      ctx.globalAlpha = 0.05 + Math.random() * 0.05;
      ctx.fillStyle = Math.random() > 0.5 ? '#000' : '#fff';
      ctx.fillRect(Math.random() * s, 0, 1, s);
    }
    ctx.globalAlpha = 1;
    if (hazard) {
      // Generic yellow/black hazard bands at both ends. No lettering, no logo.
      const bandH = s * 0.16;
      for (const y0 of [0, s - bandH]) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, y0, s, bandH);
        ctx.clip();
        for (let x = -bandH * 2; x < s + bandH * 2; x += bandH) {
          ctx.fillStyle = '#181818';
          ctx.beginPath();
          ctx.moveTo(x, y0 - bandH);
          ctx.lineTo(x + bandH, y0 - bandH);
          ctx.lineTo(x + bandH * 2.5, y0 + bandH * 2);
          ctx.lineTo(x + bandH * 1.5, y0 + bandH * 2);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function deckTexture() {
  const tex = canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = '#46463f';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 1400; i++) {
      const x = Math.random() * s, y = Math.random() * s;
      const v = 12 + Math.random() * 22;
      ctx.fillStyle = `rgba(${v | 0},${v | 0},${(v - 2) | 0},0.3)`;
      ctx.fillRect(x, y, 2, 2);
    }
    // Faint site staging outline, generic construction yellow.
    ctx.strokeStyle = 'rgba(255, 205, 60, 0.22)';
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 18]);
    ctx.strokeRect(s * 0.06, s * 0.06, s * 0.88, s * 0.88);
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(100, 100);          // same 20 m per tile across the larger deck
  // The deck is the worst case for aliasing: a tiling texture seen at a grazing
  // angle from 42 m up. Anisotropy is the one line that fixes the shimmer across
  // the whole middle distance. Capped at 4 rather than the maximum, because 16
  // is not free on a phone.
  tex.anisotropy = MAX_ANISO;
  return tex;
}

function crateTexture(hue) {
  const tex = canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = hue;
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, s - 12, s - 12);
    ctx.beginPath();
    ctx.moveTo(6, s / 2); ctx.lineTo(s - 6, s / 2);
    ctx.moveTo(s / 2, 6); ctx.lineTo(s / 2, s - 6);
    ctx.stroke();
  });
  return tex;
}

function grandstandTexture() {
  const tex = canvasTexture(256, (ctx, s) => {
    const rows = 16;
    for (let i = 0; i < rows; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#5b6a72' : '#4d5960';
      ctx.fillRect(0, (i / rows) * s, s, s / rows + 1);
    }
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#c7cfd2' : '#868b8e';
      ctx.fillRect(Math.random() * s, Math.random() * s * 0.92, 2, 3);
    }
    ctx.globalAlpha = 1;
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(10, 1);
  return tex;
}

// ---------- Decorative pickup props (visual preview, not yet hookable) ----------

const CRATE_HUES = ['#8a6a3e', '#6f7b63', '#5a6b7a', '#7a5a4a'];

// Which crate hue belongs to a mission id, matching the order buildPickupProps
// walked the mission list in.
function missionIndex(id) {
  const i = MISSIONS.findIndex((m) => m.id === id);
  return i < 0 ? 0 : i;
}

function crateTextureFor(hue) {
  if (!crateTextures.has(hue)) crateTextures.set(hue, crateTexture(hue));
  return crateTextures.get(hue);
}

function buildPickupProps(scene) {
  MISSIONS.forEach((m, i) => {
    const [sx, sy, sz] = m.load.size;
    const [px, py, pz] = m.pickup.pos;
    const group = [];

    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(sx, sy, sz),
      new THREE.MeshLambertMaterial({ map: crateTextureFor(CRATE_HUES[i % CRATE_HUES.length]) })
    );
    crate.position.set(px, py + sy / 2, pz);
    scene.add(crate);
    group.push(crate);

    // Rigging strap: a flattened ring resting on top, hinting the load can
    // be hooked once Phase 2 wires real pickup.
    const strap = new THREE.Mesh(
      new THREE.TorusGeometry(Math.min(sx, sz) * 0.32, 0.025, 6, 20),
      new THREE.MeshLambertMaterial({ color: 0xdadada })
    );
    strap.rotation.x = Math.PI / 2;
    strap.position.set(px, py + sy + 0.03, pz);
    scene.add(strap);
    group.push(strap);

    // Soft ground shadow decal for props sitting on the deck.
    if (py <= 0.05) {
      const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(Math.max(sx, sz) * 0.7, 20),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 })
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(px, 0.015, pz);
      scene.add(shadow);
      group.push(shadow);
    }

    pickupProps.set(m.id, group);

    // The mission's collision volumes. sensors.js fails the lift on these and
    // nothing drew them: mission 1's load sat on a truck bed that did not exist,
    // mission 2 lands on a scaffold made of nothing, and mission 3 is a shaft cut
    // into a deck drawn as an unbroken plane. A player cannot avoid what they
    // cannot see.
    const vols = [];
    (m.deck || []).forEach((d) => {
      const size = [d.max[0] - d.min[0], d.max[1] - d.min[1], d.max[2] - d.min[2]];
      const vol = new THREE.Mesh(
        new THREE.BoxGeometry(size[0], size[1], size[2]),
        new THREE.MeshLambertMaterial({ map: steelTexture({ base: '#6a6f73' }) })
      );
      vol.position.set(
        (d.min[0] + d.max[0]) / 2,
        (d.min[1] + d.max[1]) / 2,
        (d.min[2] + d.max[2]) / 2
      );
      vol.visible = false;
      scene.add(vol);
      vols.push(vol);
    });
    deckVolumes.set(m.id, vols);

    // A hole in the deck. The deck is one plane, so the opening is painted on
    // rather than cut: the load genuinely disappears into it, which is the whole
    // point of a blind pick.
    if (m.hole) {
      const hw = m.hole.max[0] - m.hole.min[0];
      const hd = m.hole.max[1] - m.hole.min[1];
      const mouth = new THREE.Mesh(
        new THREE.PlaneGeometry(hw, hd),
        new THREE.MeshBasicMaterial({ color: 0x07090a })
      );
      mouth.rotation.x = -Math.PI / 2;
      mouth.position.set(
        (m.hole.min[0] + m.hole.max[0]) / 2, 0.03, (m.hole.min[1] + m.hole.max[1]) / 2
      );
      mouth.visible = false;
      scene.add(mouth);
      vols.push(mouth);
    }

    // The crate this load becomes once it has been set down. Hidden until the
    // mission reports where the release happened.
    const landed = new THREE.Mesh(
      new THREE.BoxGeometry(sx, sy, sz),
      new THREE.MeshLambertMaterial({ map: crateTextureFor(CRATE_HUES[i % CRATE_HUES.length]) })
    );
    landed.visible = false;
    scene.add(landed);
    landedCrates.set(m.id, landed);
  });
}

// ---------- Generic stadium-style backdrop ----------
// Original tiered bowl + light towers. Not a likeness of any real stadium.

function buildStadiumBackdrop(scene) {
  const group = new THREE.Group();
  const bowlRadiusBottom = 230;
  const bowlRadiusTop = 260;
  const bowlHeight = 46;

  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(bowlRadiusTop, bowlRadiusBottom, bowlHeight, 48, 1, true),
    new THREE.MeshLambertMaterial({ map: grandstandTexture(), side: THREE.BackSide })
  );
  bowl.position.y = bowlHeight / 2;
  group.add(bowl);

  // Rim cap, a plain band suggesting an upper concourse, generic gray.
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(bowlRadiusTop + 3, bowlRadiusTop, 3, 48, 1, true),
    new THREE.MeshLambertMaterial({ color: 0x3d454a, side: THREE.BackSide })
  );
  rim.position.y = bowlHeight + 1.5;
  group.add(rim);

  // Light towers around the rim. Emissive-looking panels via MeshBasicMaterial
  // so they read as lit even without a real light rig.
  const towerCount = 8;
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2c2e });
  const panelMat = new THREE.MeshBasicMaterial({ color: 0xfff6d8 });
  for (let i = 0; i < towerCount; i++) {
    const a = (i / towerCount) * Math.PI * 2;
    const r = bowlRadiusTop - 4;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 30, 8), poleMat);
    pole.position.set(Math.cos(a) * r, bowlHeight + 15, Math.sin(a) * r);
    group.add(pole);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 0.6), panelMat);
    panel.position.set(Math.cos(a) * r, bowlHeight + 30, Math.sin(a) * r);
    panel.lookAt(0, bowlHeight + 30, 0);
    group.add(panel);
  }

  scene.add(group);
}

// ---------- Scene setup ----------

const RING_SEGMENTS = 96;

function ringPoints(radius) {
  const pts = new Float32Array(RING_SEGMENTS * 3);
  for (let i = 0; i < RING_SEGMENTS; i += 1) {
    const a = (i / RING_SEGMENTS) * Math.PI * 2;
    pts[i * 3] = Math.cos(a) * radius;
    pts[i * 3 + 1] = 0.06;
    pts[i * 3 + 2] = Math.sin(a) * radius;
  }
  return pts;
}

function deckRing(radius, color, opacity) {
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(ringPoints(radius), 3));
  const line = new THREE.LineLoop(geom, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  return { line, geom, radius };
}

function setRingRadius(ring, radius) {
  if (Math.abs(radius - ring.radius) < 0.1) return;
  ring.radius = radius;
  ring.geom.attributes.position.array.set(ringPoints(radius));
  ring.geom.attributes.position.needsUpdate = true;
}

export function init(ctx, canvas) {
  const { state } = ctx;

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  // Without tone mapping the sunlit yellow steel clips to a flat block of colour
  // and loses all its form. ACES costs a few instructions per pixel and is the
  // difference between painted steel in sun and a yellow cutout.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.45;
  MAX_ANISO = Math.min(4, renderer.capabilities.getMaxAnisotropy());

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8ea3b4);           // hazy morning
  // Exponential, and dense enough to actually reach the working volume. The old
  // linear fog started at 120 m, which is beyond the whole crane: it did nothing
  // where the player looks, while the deck's hard rectangular edge stayed
  // plainly visible at 300 m and gave the world away as a square.
  scene.fog = new THREE.FogExp2(0x8ea3b4, 0.0022);

  camera = new THREE.PerspectiveCamera(70, 1, 0.15, 1500);

  // Light: one sun, one sky fill. Cheap and enough for now.
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.45);
  sun.position.set(80, 140, 60);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd0e0, 0x4a4a44, 0.75));

  // Deck. Textured concrete/asphalt with a grid overlay so height and radius read at a glance.
  const deck = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000),
    new THREE.MeshLambertMaterial({ map: deckTexture() })
  );
  deck.rotation.x = -Math.PI / 2;
  scene.add(deck);
  const grid = new THREE.GridHelper(600, 60, 0x6a6a62, 0x585850);
  grid.position.y = 0.02;
  scene.add(grid);
  // A one metre grid over the working circle. The ten metre grid reads gross
  // position well and tells you nothing about the last few metres, which is
  // exactly where the lift is won or lost.
  const fineGrid = new THREE.GridHelper(80, 80, 0x63635c, 0x5a5a54);
  fineGrid.position.y = 0.024;
  fineGrid.material.transparent = true;
  fineGrid.material.opacity = 0.4;
  scene.add(fineGrid);

  buildStadiumBackdrop(scene);
  buildPickupProps(scene);

  // PHASE 2B reach rings. Grey ring at the trolley stop, amber ring at the radius
  // where the chart runs out for the load on the hook. Both are painted on the
  // deck around the mast so the operator can see how far out the load may go.
  parts.stopRing = deckRing(CRANE.maxRadius, 0x8a8f93, 0.55);
  parts.loadRing = deckRing(CRANE.maxRadius, 0xe0a83a, 0.9);
  scene.add(parts.stopRing.line, parts.loadRing.line);

  // Slewing group: everything above the slew ring turns together.
  const slewGroup = new THREE.Group();
  scene.add(slewGroup);
  parts.slewGroup = slewGroup;

  const steelTex = steelTexture({ base: '#c9b23a', hazard: true });
  steelTex.repeat.set(4, 1);
  const steel = new THREE.MeshLambertMaterial({ map: steelTex });
  const steelPlain = new THREE.MeshLambertMaterial({ map: steelTexture({ base: '#c9b23a' }) });

  const mast = new THREE.Mesh(new THREE.BoxGeometry(2, state.crane.cabHeight + 4, 2), steel);
  mast.position.y = (state.crane.cabHeight + 4) / 2;
  scene.add(mast);

  const jib = new THREE.Mesh(new THREE.BoxGeometry(state.crane.jibLength, 1.4, 1.4), steelPlain);
  jib.position.set(state.crane.jibLength / 2, state.crane.cabHeight + 2.5, 0);
  slewGroup.add(jib);

  const counterJib = new THREE.Mesh(new THREE.BoxGeometry(14, 1.2, 1.2), steelPlain);
  counterJib.position.set(-7, state.crane.cabHeight + 2.5, 0);
  slewGroup.add(counterJib);

  const darkMetal = new THREE.MeshLambertMaterial({ map: steelTexture({ base: '#2b2b2b' }) });

  trolley = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 1.8), darkMetal);
  slewGroup.add(trolley);

  // Sheave: the small pulley wheel the rope runs over on the underside of the trolley.
  sheave = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.18, 14),
    new THREE.MeshLambertMaterial({ color: 0x151515 })
  );
  sheave.rotation.z = Math.PI / 2;
  slewGroup.add(sheave);

  // The rope. A THREE.Line is one pixel wide on every WebGL platform no matter
  // what linewidth says, so thirty metres of hoist rope came out as a hairline
  // that all but vanished against the deck at the exact moment - a delicate set
  // down - when the operator most needs to see it. A thin lit cylinder is the
  // same single draw call and actually reads.
  ropeMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 1, 6, 1, true),
    new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
  );
  slewGroup.add(ropeMesh);

  // The ground shadow of whatever is on the hook. Static props already had a
  // shadow decal and the one thing the player is actually flying did not, which
  // left height almost unreadable from 42 m up. It spreads and fades with
  // height, so the gap between load and shadow reads as altitude and the offset
  // between them reads as swing.
  loadShadow = new THREE.Mesh(
    new THREE.CircleGeometry(1, 24),
    new THREE.MeshBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false
    })
  );
  loadShadow.rotation.x = -Math.PI / 2;
  loadShadow.visible = false;
  slewGroup.add(loadShadow);

  // Touchdown. Until now the only sign the load had landed was a lamp on the
  // console, which is not where the operator is looking at the moment it
  // matters. A ring that expands and fades out from the load's footprint puts
  // the news where the eyes already are.
  contactRing = new THREE.Mesh(
    new THREE.RingGeometry(0.86, 1, 40),
    new THREE.MeshBasicMaterial({
      color: 0xe8e2d2, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false
    })
  );
  contactRing.rotation.x = -Math.PI / 2;
  contactRing.visible = false;
  slewGroup.add(contactRing);

  // Hook block (mass at the bottom of the rope) plus an open hook arc below it.
  const hookGroup = new THREE.Group();
  slewGroup.add(hookGroup);
  hook = hookGroup;
  const hookBlock = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), darkMetal);
  hookBlock.position.y = 0.3;
  hookGroup.add(hookBlock);
  const hookArc = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.06, 8, 16, Math.PI * 1.35),
    new THREE.MeshLambertMaterial({ color: 0x1a1a1a })
  );
  hookArc.rotation.z = Math.PI * 0.6;
  hookArc.position.y = -0.15;
  hookGroup.add(hookArc);

  // PHASE 3 item 8a. A unit box scaled to load.size, hung as a child of the hook
  // group so it tracks the hook exactly (including swing) with no extra maths.
  // Its top face sits at the hook block bottom, which is the hook group origin.
  hangingLoad = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial({ map: crateTextureFor(CRATE_HUES[0]) })
  );
  hangingLoad.visible = false;
  hookGroup.add(hangingLoad);

  // Cab shell. Camera sits inside. Fuller enclosure: pillars, header, roof
  // plate, a glass floor pane, a seat, and a console box.
  const cabGroup = new THREE.Group();
  cabGroup.position.set(1.6, state.crane.cabHeight, 1.9);
  slewGroup.add(cabGroup);
  parts.cabGroup = cabGroup;

  const frameMat = new THREE.MeshLambertMaterial({ color: 0x1c2124 });
  const bar = (w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameMat);
    m.position.set(x, y, z);
    cabGroup.add(m);
  };
  bar(0.08, 2.2, 0.08, 1.0, 1.1, -1.0);   // front right pillar
  bar(0.08, 2.2, 0.08, 1.0, 1.1, 1.0);    // front left pillar
  bar(0.08, 2.2, 0.08, -0.4, 1.1, -1.0);  // rear right pillar
  bar(0.08, 2.2, 0.08, -0.4, 1.1, 1.0);   // rear left pillar
  bar(0.08, 0.08, 2.1, 1.0, 2.2, 0);      // header

  // Solid roof plate (the earlier build only had a thin roof-edge bar).
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 2.1), frameMat);
  roof.position.set(0.3, 2.24, 0);
  cabGroup.add(roof);

  // Glass floor pane, faint and translucent, for looking straight down at the load.
  const floorGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 2.0),
    new THREE.MeshBasicMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.12, side: THREE.DoubleSide })
  );
  floorGlass.rotation.x = -Math.PI / 2;
  floorGlass.position.set(0.3, -0.01, 0);
  floorGlass.material.depthWrite = false;
  cabGroup.add(floorGlass);

  // An actual frame, four bars around the perimeter. What was here was a solid
  // 1.6 x 2.1 slab sitting 10 mm under the glass, so the pane you look through
  // to watch the load had an opaque floor behind it: from the seat, straight
  // down was black. Looking down at the load is the entire job.
  bar(1.6, 0.06, 0.09, 0.3, -0.02, -1.005);
  bar(1.6, 0.06, 0.09, 0.3, -0.02, 1.005);
  bar(0.09, 0.06, 2.1, -0.455, -0.02, 0);
  bar(0.09, 0.06, 2.1, 1.055, -0.02, 0);

  // Seat, roughly under and behind the camera eye point.
  const seatMat = new THREE.MeshLambertMaterial({ color: 0x2f2f2f });
  const seatBase = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.55), seatMat);
  seatBase.position.set(-0.55, 0.95, 0);
  cabGroup.add(seatBase);
  const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.55), seatMat);
  seatBack.position.set(-0.8, 1.3, 0);
  cabGroup.add(seatBack);

  // Console box under the glass, ahead of the camera. A couple of faint
  // canvas-drawn indicator lights, generic, no branding.
  const consoleTex = canvasTexture(256, (c2, s) => {
    c2.fillStyle = '#141414';
    c2.fillRect(0, 0, s, s);
    c2.fillStyle = '#3fae55';
    c2.fillRect(s * 0.15, s * 0.4, s * 0.15, s * 0.15);
    c2.fillStyle = '#c98f2b';
    c2.fillRect(s * 0.42, s * 0.4, s * 0.15, s * 0.15);
    c2.fillStyle = '#a33';
    c2.fillRect(s * 0.68, s * 0.4, s * 0.15, s * 0.15);
  });
  const consoleBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.36, 0.85),
    new THREE.MeshLambertMaterial({ map: consoleTex })
  );
  // Off to the operator's right, on the armrest line, not straight ahead. Dead
  // centre it filled the whole forward-and-down view: with the floor opened up
  // above, this is the other half of being able to see the load.
  consoleBox.position.set(0.55, 0.55, 0.62);
  cabGroup.add(consoleBox);

  // The roof plate blocks the sun completely, so everything in here was an
  // unlit surface: a black box with the console lamps invisible inside it.
  const cabLamp = new THREE.PointLight(0xffd9a0, 0.45, 4.5);
  cabLamp.position.set(0.3, 1.9, 0);
  cabGroup.add(cabLamp);

  // Landing pad. Ground calls the load onto a spot the player otherwise cannot
  // see: the console has no distance-to-landing readout, so without this the
  // last position information is a radio call. Sized to the mission tolerance
  // in update(), because that is the circle the lift is graded on.
  // The landing. Everything here is built once and only moved and scaled later.
  //
  // Three problems with drawing only a tolerance-sized ring: it is 0.3 to 0.4 m
  // across, which is a handful of pixels at fifty metres of slant range; the
  // load itself completely covers it on the way down; and sitting flat on the
  // deck at the same height as the grid it z-fought both the grid and its own
  // fill. So: the honest tolerance ring stays, at true size, and everything else
  // is there to let the player find it and judge the approach.
  landingPad = new THREE.Group();

  padRing = new THREE.Mesh(
    new THREE.RingGeometry(0.92, 1, 48),
    new THREE.MeshBasicMaterial({
      color: PAD_AMBER, transparent: true, opacity: 0.9,
      side: THREE.DoubleSide, depthWrite: false
    })
  );
  padRing.rotation.x = -Math.PI / 2;
  landingPad.add(padRing);

  const padFill = new THREE.Mesh(
    new THREE.CircleGeometry(0.92, 32),
    new THREE.MeshBasicMaterial({
      color: PAD_AMBER, transparent: true, opacity: 0.18,
      side: THREE.DoubleSide, depthWrite: false
    })
  );
  padFill.rotation.x = -Math.PI / 2;
  padFill.position.y = -0.008;      // below the ring, so the two never z-fight
  landingPad.add(padFill);
  landingPad.visible = false;
  scene.add(landingPad);

  // A fixed-size approach mark around it, in world metres rather than tolerances,
  // so the spot can be found from across the site. Not scaled with the pad.
  landingMark = new THREE.Group();
  const approach = new THREE.Mesh(
    new THREE.RingGeometry(3.4, 3.6, 48),
    new THREE.MeshBasicMaterial({
      color: PAD_AMBER, transparent: true, opacity: 0.4,
      side: THREE.DoubleSide, depthWrite: false
    })
  );
  approach.rotation.x = -Math.PI / 2;
  landingMark.add(approach);

  // Four ticks pointing in at the centre. These stay visible when the load is
  // directly over the pad and hiding it.
  const tickMat = new THREE.MeshBasicMaterial({
    color: PAD_AMBER, transparent: true, opacity: 0.55, depthWrite: false
  });
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2;
    const tick = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.16), tickMat);
    tick.rotation.x = -Math.PI / 2;
    tick.rotation.z = -a;
    tick.position.set(Math.cos(a) * 4.5, 0, Math.sin(a) * 4.5);
    landingMark.add(tick);
  }

  // A soft column over the spot, so it can be seen over the load and from the
  // far side of the slew circle.
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 9, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: PAD_AMBER, transparent: true, opacity: 0.10,
      side: THREE.DoubleSide, depthWrite: false
    })
  );
  beacon.position.y = 4.5;
  landingMark.add(beacon);

  landingMark.visible = false;
  scene.add(landingMark);

  // Hook cam. A second camera looking straight down from the block, drawn into a
  // corner viewport. Cheaper than a render target and it is one extra scene
  // traversal, which is why it is off by default and forced off on the blind
  // shaft: the whole point of that mission is not having it.
  hookCam = new THREE.PerspectiveCamera(58, 1, 0.3, 400);
  scene.add(hookCam);

  window.addEventListener('resize', resize);
  resize();
}

// Whether the inset is up: the operator asked for it and the mission allows it.
// Read from state, like everything else in here.
function hookCamWanted(state) {
  if (!state.intent.hookCam) return false;
  const m = MISSIONS.find((x) => x.id === state.mission.id);
  return !m || m.hookCam !== false;
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

const SHEAVE_DROP = 0.45;   // the rope leaves the sheave, not the middle of the trolley
const ropeTop = new THREE.Vector3();
const ropeVec = new THREE.Vector3();
const viewSize = new THREE.Vector2();
const eye = new THREE.Vector3();
const dir = new THREE.Vector3();
const target = new THREE.Vector3();

export function update(ctx, dt) {
  const { state } = ctx;
  const c = state.crane;

  parts.slewGroup.rotation.y = -c.slew;

  setRingRadius(parts.loadRing, state.sensors.maxLoadRadius || CRANE.maxRadius);

  const topY = c.cabHeight + CRANE.hookDrop;
  trolley.position.set(c.radius, topY + 0.4, 0);
  sheave.position.set(c.radius, topY - SHEAVE_DROP, 0);
  const hookY = topY - c.line;
  hook.position.set(
    c.radius + Math.sin(state.load.swing.y) * c.line,
    hookY,
    Math.sin(state.load.swing.x) * c.line
  );
  // The hook block hangs plumb below the rope, so it leans with the swing. Left
  // axis aligned it read as broken: the rope leaned and the block did not.
  hook.rotation.z = state.load.swing.y;
  hook.rotation.x = -state.load.swing.x;

  // Rope from the sheave to the hook, as a scaled and aimed cylinder.
  ropeTop.set(c.radius, topY - SHEAVE_DROP, 0);
  ropeVec.subVectors(hook.position, ropeTop);
  const ropeLen = ropeVec.length();
  if (ropeLen > 0.01) {
    ropeMesh.position.copy(ropeTop).addScaledVector(ropeVec, 0.5);
    ropeMesh.scale.set(1, ropeLen, 1);
    ropeVec.multiplyScalar(1 / ropeLen);
    ropeMesh.quaternion.setFromUnitVectors(UP, ropeVec);
    ropeMesh.visible = true;
  } else {
    ropeMesh.visible = false;
  }

  // PHASE 3 item 8a. The hanging load.
  const load = state.load;
  if (load.attached) {
    const [sx, sy, sz] = load.size;
    // Same hue as the crate that was sitting at this mission's pickup. It used
    // to be hardcoded to the first hue, so on mission 1 you hooked a green crate
    // and a brown one came up on the rope.
    const wantHue = CRATE_HUES[missionIndex(state.mission.id) % CRATE_HUES.length];
    if (hangingLoad.userData.hue !== wantHue) {
      hangingLoad.material.map = crateTextureFor(wantHue);
      hangingLoad.material.needsUpdate = true;
      hangingLoad.userData.hue = wantHue;
    }
    hangingLoad.scale.set(sx || 1, sy || 1, sz || 1);
    // pendulum.js clamps the load at whatever it is resting on, so read that
    // rather than hanging the box a fixed distance under the block. This is what
    // stops a landed crate sinking into the deck as the rope keeps paying out.
    hangingLoad.position.y = (load.bottomY + (sy || 1) / 2) - hookY;
    hangingLoad.visible = true;

    // Touchdown edge. render.js keeps its own memory of the last frame, which is
    // reading state, not writing it.
    if (load.onSurface && !wasOnSurface) contactT = CONTACT_TIME;
    wasOnSurface = load.onSurface;

    // Shadow on the deck. Spreads and fades with height above it.
    const bottom = Math.max(0, load.bottomY);
    const spread = 1 + bottom * 0.035;
    loadShadow.position.set(hook.position.x, 0.04, hook.position.z);
    loadShadow.scale.setScalar(Math.max(sx || 1, sz || 1) * 0.6 * spread);
    loadShadow.material.opacity = 0.32 / spread;
    loadShadow.visible = true;
  } else {
    hangingLoad.visible = false;
    loadShadow.visible = false;
    wasOnSurface = false;
  }

  if (contactT > 0) {
    contactT = Math.max(0, contactT - dt);
    const k = 1 - contactT / CONTACT_TIME;                 // 0 at the touch, 1 at the end
    const [sx, , sz] = load.size;
    const foot = Math.max(sx || 1, sz || 1) * 0.55;
    contactRing.position.set(hook.position.x, 0.06, hook.position.z);
    contactRing.scale.setScalar(foot * (0.6 + k * 1.6));
    contactRing.material.opacity = 0.5 * (1 - k);
    contactRing.visible = true;
  } else if (contactRing.visible) {
    contactRing.visible = false;
  }

  // PHASE 3 item 8b. The active mission's deck dressing follows the load: the
  // preview crate at the pickup goes away once the load is off it, and a crate
  // appears wherever the load was set down. Read only, no state is written.
  const m = state.mission;
  const active = pickupProps.get(m.id);
  if (active) {
    const lifted = load.attached || !!m.landedAt;
    for (let i = 0; i < active.length; i += 1) active[i].visible = !lifted;
  }
  if (m.landingPos && m.id !== null && !m.landedAt) {
    const tol = m.landingTol > 0 ? m.landingTol : 0.5;
    // 0.05 clears the grid, which sits at 0.02. At 0.02 the pad, the grid and
    // the pad's own fill were three coplanar surfaces on the most important
    // object on screen, and all three shimmered.
    landingPad.position.set(m.landingPos[0], m.landingPos[1] + 0.05, m.landingPos[2]);
    landingPad.scale.setScalar(tol);
    landingPad.visible = true;
    landingMark.position.set(m.landingPos[0], m.landingPos[1] + 0.035, m.landingPos[2]);
    landingMark.visible = true;

    // Green once the load is actually inside the tolerance it is graded on.
    // This is the question the operator is asking on the way down, and until now
    // nothing on screen or on the console answered it.
    let over = false;
    if (load.attached) {
      // hook.position is in the jib frame; slewGroup is rotated by -slew, so a
      // local point lands in the world as (x cos - z sin, x sin + z cos). Same
      // transform sensors.js uses for the load AABB.
      const cs = Math.cos(c.slew);
      const sn = Math.sin(c.slew);
      const worldX = hook.position.x * cs - hook.position.z * sn;
      const worldZ = hook.position.x * sn + hook.position.z * cs;
      over = Math.hypot(worldX - m.landingPos[0], worldZ - m.landingPos[2]) < tol;
    }
    padRing.material.color.setHex(over ? PAD_GREEN : PAD_AMBER);
  } else {
    landingPad.visible = false;
    landingMark.visible = false;
  }

  // The active mission's collision volumes, and only that mission's.
  deckVolumes.forEach((vols, id) => {
    const show = id === m.id;
    for (let i = 0; i < vols.length; i += 1) vols[i].visible = show;
  });

  const landed = landedCrates.get(m.id);
  if (landed) {
    if (m.landedAt && !load.attached) {
      const [sx, sy, sz] = load.size;
      landed.scale.set(sx || 1, sy || 1, sz || 1);
      landed.position.set(m.landedAt[0], m.landedAt[1] + (sy || 1) / 2, m.landedAt[2]);
      landed.visible = true;
    } else {
      landed.visible = false;
    }
  }

  // Camera: eye height in the seat, looks out along the jib. Look-around
  // deltas are applied to state.look by crane.js; this only reads it.
  eye.set(0.2, 1.35, 0);
  parts.cabGroup.localToWorld(eye);
  camera.position.copy(eye);
  const yaw = -c.slew + state.look.yaw;
  const pitch = state.look.pitch;
  dir.set(
    Math.cos(pitch) * Math.cos(yaw),
    Math.sin(pitch),
    -Math.cos(pitch) * Math.sin(yaw)
  );
  target.copy(eye).add(dir);
  camera.lookAt(target);

  renderer.render(scene, camera);

  // The inset, last, over the top of the main view.
  if (state.mission.id !== null && hookCamWanted(state)) {
    // getSize reports CSS pixels, which is what setViewport and setScissor take:
    // three multiplies both by the pixel ratio itself. domElement.width is the
    // drawing buffer, already multiplied, so using it put the inset off screen
    // on any display with devicePixelRatio above 1 and left the main view
    // scaled by the ratio for every frame afterwards.
    renderer.getSize(viewSize);
    const w = viewSize.x;
    const h = viewSize.y;
    const size = Math.round(Math.min(w, h) * 0.26);
    const pad = Math.round(size * 0.09);
    // Top left. WebGL viewport coordinates start at the bottom, and the console
    // dock covers the bottom 148 css pixels, so a bottom-left inset was drawn
    // underneath it and could not be seen at all.
    const vy = h - size - pad;
    hangingLoad.visible = false;              // looking down through it is useless
    hookCam.position.set(hook.position.x, hookY - 0.35, hook.position.z);
    parts.slewGroup.localToWorld(hookCam.position);
    hookCam.up.set(Math.cos(-c.slew), 0, -Math.sin(-c.slew));
    hookCam.lookAt(hookCam.position.x, hookCam.position.y - 10, hookCam.position.z);
    renderer.clearDepth();
    renderer.setScissorTest(true);
    renderer.setScissor(pad, vy, size, size);
    renderer.setViewport(pad, vy, size, size);
    renderer.render(scene, hookCam);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, w, h);
    hangingLoad.visible = load.attached;
  }
}
