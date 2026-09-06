// Three.js scene. READ state, never write it.
// Phase 0 had placeholder boxes. Phase 1 adds a fuller cab shell, a hook
// sheave, procedural textures, decorative pickup props, and a generic
// stadium-style backdrop for depth. All textures are drawn on <canvas> at
// runtime (no image files, no CDN beyond the Three.js import already in
// index.html) so this stays a dependency-free static folder.
//
// The pickup props below are a visual preview only: static crates placed at
// every mission's pickup.pos so the deck doesn't look empty. They are not
// hookable yet. Real attach/pendulum physics is Phase 2 (pendulum.js,
// sensors.js) and mission loading is Phase 3/4 (missions.js); until that's
// wired, every mission's prop is shown at once rather than just the active
// one.
//
// The backdrop is an original, generic tiered bowl with light towers. It is
// deliberately not a depiction of any real, trademarked venue (hard rule 7:
// no copied art). See CLAUDE.md.

import * as THREE from 'three';
import { MISSIONS } from '../data/missions.js';
import { CRANE } from '../data/crane.js';

let renderer, scene, camera;
let trolley, ropeGeom, hook, sheave;
const parts = {};

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
  tex.repeat.set(30, 30);
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

function buildPickupProps(scene) {
  MISSIONS.forEach((m, i) => {
    const [sx, sy, sz] = m.load.size;
    const [px, py, pz] = m.pickup.pos;

    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(sx, sy, sz),
      new THREE.MeshLambertMaterial({ map: crateTexture(CRATE_HUES[i % CRATE_HUES.length]) })
    );
    crate.position.set(px, py + sy / 2, pz);
    scene.add(crate);

    // Rigging strap: a flattened ring resting on top, hinting the load can
    // be hooked once Phase 2 wires real pickup.
    const strap = new THREE.Mesh(
      new THREE.TorusGeometry(Math.min(sx, sz) * 0.32, 0.025, 6, 20),
      new THREE.MeshLambertMaterial({ color: 0xdadada })
    );
    strap.rotation.x = Math.PI / 2;
    strap.position.set(px, py + sy + 0.03, pz);
    scene.add(strap);

    // Soft ground shadow decal for props sitting on the deck.
    if (py <= 0.05) {
      const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(Math.max(sx, sz) * 0.7, 20),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 })
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(px, 0.015, pz);
      scene.add(shadow);
    }
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

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8ea3b4);           // hazy morning
  scene.fog = new THREE.Fog(0x8ea3b4, 120, 900);

  camera = new THREE.PerspectiveCamera(70, 1, 0.1, 2000);

  // Light: one sun, one sky fill. Cheap and enough for now.
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.6);
  sun.position.set(80, 140, 60);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd0e0, 0x3a3a34, 0.7));

  // Deck. Textured concrete/asphalt with a grid overlay so height and radius read at a glance.
  const deck = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600),
    new THREE.MeshLambertMaterial({ map: deckTexture() })
  );
  deck.rotation.x = -Math.PI / 2;
  scene.add(deck);
  const grid = new THREE.GridHelper(600, 60, 0x6a6a62, 0x585850);
  grid.position.y = 0.02;
  scene.add(grid);

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

  ropeGeom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const rope = new THREE.Line(ropeGeom, new THREE.LineBasicMaterial({ color: 0x111111 }));
  slewGroup.add(rope);

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
  cabGroup.add(floorGlass);
  bar(1.6, 0.06, 2.1, 0.3, -0.02, 0);     // floor edge frame around the glass

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
  const consoleTex = canvasTexture(64, (c2, s) => {
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
    new THREE.BoxGeometry(0.55, 0.5, 1.5),
    new THREE.MeshLambertMaterial({ map: consoleTex })
  );
  consoleBox.position.set(0.75, 0.65, 0);
  cabGroup.add(consoleBox);

  window.addEventListener('resize', resize);
  resize();
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

const eye = new THREE.Vector3();
const dir = new THREE.Vector3();
const target = new THREE.Vector3();

export function update(ctx) {
  const { state } = ctx;
  const c = state.crane;

  parts.slewGroup.rotation.y = -c.slew;

  setRingRadius(parts.loadRing, state.sensors.maxLoadRadius || CRANE.maxRadius);

  const topY = c.cabHeight + CRANE.hookDrop;
  trolley.position.set(c.radius, topY, 0);
  sheave.position.set(c.radius, topY - 0.5, 0);
  const hookY = topY - c.line;
  hook.position.set(
    c.radius + Math.sin(state.load.swing.y) * c.line,
    hookY,
    Math.sin(state.load.swing.x) * c.line
  );
  const pos = ropeGeom.attributes.position;
  pos.setXYZ(0, c.radius, topY, 0);
  pos.setXYZ(1, hook.position.x, hookY, hook.position.z);
  pos.needsUpdate = true;

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
}
