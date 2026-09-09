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
let lowFpsFor = 0;                 // s the frame rate has been under the floor
let shadowsDropped = false;        // one way: once off, off for the session
const SHADOW_MIN_FPS = 20;         // below this the shadow pass is not affordable
const SHADOW_LOW_FOR = 6;          // s of it before giving up on shadows
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
    ctx.fillStyle = '#4a4a43';
    ctx.fillRect(0, 0, s, s);
    // Broad tonal patches first. A single flat fill plus fine grain reads as felt
    // from 42 m: all the variation is below one pixel by the time it reaches the
    // eye, so the whole deck goes to one value and the site loses its ground.
    for (let i = 0; i < 26; i += 1) {
      const r = s * (0.08 + Math.random() * 0.22);
      // Both circles share a centre. With two different centres this is a cone,
      // not a blob, and tiled a hundred times across the deck it painted the
      // whole site with a repeating field of dark triangular spikes that read as
      // shadows of things that were not there.
      const cx = Math.random() * s;
      const cy = Math.random() * s;
      const light = Math.random() > 0.5;
      // Drawn nine times, once per wrap offset, so a patch that runs off one
      // edge comes back on the other. Without that the patches are clipped at
      // the tile boundary and the repeat shows up as a checkerboard of squares
      // across the whole deck, which is worse than the flat fill it replaced.
      for (let ox = -1; ox <= 1; ox += 1) {
        for (let oy = -1; oy <= 1; oy += 1) {
          const px = cx + ox * s;
          const py = cy + oy * s;
          if (px + r < 0 || px - r > s || py + r < 0 || py - r > s) continue;
          const g = ctx.createRadialGradient(px, py, 0, px, py, r);
          g.addColorStop(0, light ? 'rgba(122,120,106,0.16)' : 'rgba(28,28,26,0.18)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, s, s);
        }
      }
    }
    for (let i = 0; i < 1400; i++) {
      const x = Math.random() * s, y = Math.random() * s;
      const v = 12 + Math.random() * 22;
      ctx.fillStyle = `rgba(${v | 0},${v | 0},${(v - 2) | 0},0.3)`;
      ctx.fillRect(x, y, 2, 2);
    }
    // The dashed yellow rectangle that used to be here was drawn once per tile,
    // so the deck was a hundred identical dashed squares in a grid and read as
    // graph paper rather than as ground. Site markings are painted once over the
    // whole working area now, by siteMarkings(), and do not tile.
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  // 40 m a tile rather than 20. At 20 the repeat was close enough together to
  // read as a pattern from the cab; at 40 it is still under 8 cm a texel, which
  // is more resolution than a deck seen from 42 m can use.
  tex.repeat.set(50, 50);
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

// Painted markings over the working area: hatched keep-clear around the mast
// base, numbered laydown bays, and a haul road. Drawn once across 200 m rather
// than tiled, so nothing repeats, and it is what gives the deck a sense of scale
// and of somebody working on it. Purely paint: the load passes over all of it.
const SITE_SPAN = 200;
function siteMarkings() {
  const S = 1024;
  const perM = S / SITE_SPAN;
  const tex = canvasTexture(S, (c) => {
    c.clearRect(0, 0, S, S);
    const X = (m) => S / 2 + m * perM;
    const Z = (m) => S / 2 + m * perM;

    // Haul road: a band sweeping past the tower, with a dashed centre line.
    c.save();
    c.translate(S / 2, S / 2);
    c.rotate(-0.5);
    c.fillStyle = 'rgba(72,70,62,0.55)';
    c.fillRect(-S, 26 * perM, S * 2, 9 * perM);
    c.strokeStyle = 'rgba(226,214,170,0.30)';
    c.lineWidth = 0.35 * perM;
    c.setLineDash([3 * perM, 3 * perM]);
    c.beginPath();
    c.moveTo(-S, 30.5 * perM);
    c.lineTo(S, 30.5 * perM);
    c.stroke();
    c.restore();

    // Keep clear under the slew circle, hatched.
    c.save();
    c.strokeStyle = 'rgba(232,196,72,0.30)';
    c.lineWidth = 0.3 * perM;
    c.setLineDash([]);
    c.beginPath();
    c.arc(S / 2, S / 2, 11 * perM, 0, Math.PI * 2);
    c.stroke();
    c.lineWidth = 0.22 * perM;
    for (let a = 0; a < 40; a += 1) {
      const t = (a / 40) * Math.PI * 2;
      c.beginPath();
      c.moveTo(S / 2 + Math.cos(t) * 9.2 * perM, S / 2 + Math.sin(t) * 9.2 * perM);
      c.lineTo(S / 2 + Math.cos(t + 0.12) * 11 * perM, S / 2 + Math.sin(t + 0.12) * 11 * perM);
      c.stroke();
    }
    c.restore();

    // Laydown bays. Deterministic, so the site is the same site every session.
    const bays = [
      [-38, 18, 16, 11], [-38, 32, 16, 11], [-18, 34, 14, 10],
      [14, 30, 18, 12], [34, 20, 12, 16], [-44, -14, 13, 15],
      [-26, -34, 20, 12], [8, -40, 16, 11], [40, -34, 12, 14],
      [46, 6, 11, 13]
    ];
    c.font = `${Math.round(2.6 * perM)}px system-ui, sans-serif`;
    c.textBaseline = 'top';
    bays.forEach(([bx, bz, bw, bd], i) => {
      c.strokeStyle = 'rgba(232,196,72,0.34)';
      c.lineWidth = 0.28 * perM;
      c.setLineDash([1.6 * perM, 1.2 * perM]);
      c.strokeRect(X(bx), Z(bz), bw * perM, bd * perM);
      c.setLineDash([]);
      c.fillStyle = 'rgba(232,196,72,0.30)';
      c.fillText(String(i + 1).padStart(2, '0'), X(bx) + 0.7 * perM, Z(bz) + 0.6 * perM);
    });

    // Tyre tracks, so the paint is not the only thing anyone ever did here.
    c.strokeStyle = 'rgba(30,29,26,0.30)';
    c.lineWidth = 0.5 * perM;
    for (let i = 0; i < 14; i += 1) {
      const a0 = (i / 14) * Math.PI * 2;
      c.beginPath();
      c.arc(S / 2, S / 2, (16 + (i % 5) * 7) * perM, a0, a0 + 0.5 + (i % 3) * 0.3);
      c.stroke();
    }
  });
  tex.anisotropy = MAX_ANISO;
  return tex;
}

// A vertical gradient, mapped equirectangular so the top of the image is
// straight up. A flat background colour gives a sky with no direction in it: the
// horizon and the zenith are the same value, nothing tells you which way is up
// when you look out, and the deck's far edge meets the sky at a hard seam. The
// bottom stop matches the fog colour exactly, so the ground fades into the sky
// instead of ending at a line.
const HAZE = '#9fb3c2';          // horizon, and the fog colour
function skyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 256;
  const c = canvas.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0.00, '#3f6f9e');   // zenith
  g.addColorStop(0.42, '#7d9cb8');
  g.addColorStop(0.52, HAZE);        // the horizon band the fog matches
  g.addColorStop(0.60, '#a9b4b8');
  g.addColorStop(1.00, '#6c7175');   // below the horizon, never really seen
  c.fillStyle = g;
  c.fillRect(0, 0, 8, 256);
  const tex = new THREE.CanvasTexture(canvas);
  if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}

function grandstandTexture() {
  const tex = canvasTexture(512, (ctx, s) => {
    // Tiers, darkest at the bottom where a real bowl is in its own shade and the
    // concourse is. The old version was sixteen equal stripes with seven hundred
    // bright specks scattered over them, which from the cab was a band of
    // television static wrapped round the horizon: the brightest, busiest thing
    // in the frame, competing with the load.
    const rows = 22;
    for (let i = 0; i < rows; i += 1) {
      const t = i / rows;                       // 0 at the top of the image
      const shade = 0.52 + t * 0.48;            // darker toward the bottom rows
      const base = i % 2 === 0 ? [96, 110, 119] : [84, 97, 105];
      ctx.fillStyle = `rgb(${Math.round(base[0] * shade)},${Math.round(base[1] * shade)},${Math.round(base[2] * shade)})`;
      ctx.fillRect(0, t * s, s, s / rows + 1);
    }
    // Vertical aisles. Structure reads as a stadium; noise reads as noise.
    ctx.fillStyle = 'rgba(24,28,31,0.45)';
    for (let i = 0; i < 18; i += 1) ctx.fillRect((i / 18) * s + 2, 0, 4, s);
    // A handful of pale blocks, not a field of sparks: seats catching the light,
    // low contrast and large enough to survive the mip chain instead of shimmering.
    ctx.globalAlpha = 0.22;
    for (let i = 0; i < 130; i += 1) {
      ctx.fillStyle = Math.random() > 0.5 ? '#b9c3c7' : '#7d868a';
      ctx.fillRect(Math.random() * s, Math.random() * s * 0.86, 5 + Math.random() * 7, 4);
    }
    ctx.globalAlpha = 1;
    // Shaded band along the very bottom, so the bowl meets the deck in shadow
    // rather than at a hard bright line.
    const foot = ctx.createLinearGradient(0, s * 0.84, 0, s);
    foot.addColorStop(0, 'rgba(18,22,25,0)');
    foot.addColorStop(1, 'rgba(18,22,25,0.85)');
    ctx.fillStyle = foot;
    ctx.fillRect(0, s * 0.84, s, s * 0.16);
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(8, 1);
  tex.anisotropy = MAX_ANISO;
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
      const cx = (d.min[0] + d.max[0]) / 2;
      const cz = (d.min[2] + d.max[2]) / 2;
      // Lighter and warmer than the deck it stands on. At 0x6a6f73 a twelve
      // metre scaffold seen from a forty two metre cab was the same value as the
      // ground under it, so the one structure the whole mission is about read as
      // a slightly different patch of grey. Value separation does more here than
      // any amount of detail.
      const vol = new THREE.Mesh(
        new THREE.BoxGeometry(size[0], size[1], size[2]),
        new THREE.MeshLambertMaterial({ map: steelTexture({ base: '#96999b' }) })
      );
      vol.position.set(cx, (d.min[1] + d.max[1]) / 2, cz);
      vol.visible = false;
      scene.add(vol);
      vols.push(vol);

      // Edge protection on the top face, in hazard stripes, on anything tall
      // enough to be a working level rather than a kerb. This is the surface the
      // operator has to put a load on and it was completely unmarked. The plate
      // sits inside the collision box, so it promises nothing the box does not
      // already stop the load with.
      // Only real working levels, not a kerb or a truck bed. At 1.0 the truck's
      // flatbed got edge protection and read as a platform, and filled the hook
      // cam with a white slab on the approach to the pickup.
      if (size[1] >= 2.0) {
        const PLATE = 0.14;
        const plate = new THREE.Mesh(
          new THREE.BoxGeometry(size[0] + 0.06, PLATE, size[2] + 0.06),
          new THREE.MeshLambertMaterial({ map: steelTexture({ base: '#b5ae9c', hazard: true }) })
        );
        plate.position.set(cx, d.max[1] - PLATE / 2, cz);
        plate.visible = false;
        scene.add(plate);
        vols.push(plate);
      }

      // And a hard outline, because a lit box against a lit plane still needs an
      // edge to read as a box at this distance.
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(size[0], size[1], size[2])),
        new THREE.LineBasicMaterial({ color: 0x2a2f33, transparent: true, opacity: 0.65 })
      );
      edges.position.set(cx, (d.min[1] + d.max[1]) / 2, cz);
      edges.visible = false;
      scene.add(edges);
      vols.push(edges);
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

  group.traverse((o) => { o.userData.noShadow = true; });
  scene.add(group);
}


// Which meshes take part in the shadow pass. Walking the tree and deciding from
// the material beats setting a flag at every construction site: the rule is that
// solid geometry casts and receives, and anything transparent does not. A crate,
// a scaffold and a hook block are things; a painted pad ring, a plumb decal, a
// touchdown flash and a pane of cab glass are not, and having any of them throw
// a shadow would be a lie about what is solid.
//
// Anything marked userData.noShadow opts out regardless, which is what the
// stadium backdrop uses: it is two hundred metres out, its shadow would land
// nowhere near the working circle, and including it would spend the whole
// shadow map on it.
function shadowy(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (o.userData.noShadow) return;
    const m = o.material;
    if (!m || m.transparent || m.depthWrite === false) return;
    o.castShadow = true;
    o.receiveShadow = true;
  });
}



// Site clutter: containers, pallet stacks and barrier runs, scattered outside the
// trolley stop. Outside deliberately - the load can never reach past maxRadius,
// so nothing here can ever be flown through, and none of it has to pretend to be
// solid. Inside the circle the ground is painted rather than built, for the same
// reason. Two InstancedMeshes, so the whole site is two draw calls.
//
// Seeded, because a site that rearranges itself every time you press start is
// not a place. The same integer gives the same yard on every load.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Where the yard's laydown areas are, in bearings around the tower. Fixed, so
// the site is laid out the same way every session.
const YARD_BEARINGS = [0.35, 1.15, 2.05, 2.9, 3.75, 4.6, 5.5];

function buildSiteClutter(scene) {
  const rand = mulberry32(20260907);
  const INNER = CRANE.maxRadius + 4;     // clear of anything the hook can reach
  const NEAR_OUT = 96;                   // inside the shadow box, so these cast
  const FAR_OUT = 210;                   // out to the bowl, too far for a shadow to be missed

  const place = (count, geom, mat, sizeFor, inner, outer, cast) => {
    const mesh = new THREE.InstancedMesh(geom, mat, count);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < count; i += 1) {
      // Clustered around a handful of bearings rather than scattered evenly. An
      // even scatter over a two hundred metre disc reads as a spilled toy box; a
      // yard has laydown areas with gaps between them, and the gaps are what
      // make the areas look deliberate.
      const bay = YARD_BEARINGS[Math.floor(rand() * YARD_BEARINGS.length)];
      const a = bay + (rand() - 0.5) * 0.55;
      // sqrt keeps the scatter even in area rather than crowding the inner edge.
      const r = Math.sqrt(inner * inner + rand() * (outer * outer - inner * inner));
      const [sx, sy, sz] = sizeFor(rand);
      pos.set(Math.cos(a) * r, sy / 2, Math.sin(a) * r);
      q.setFromAxisAngle(up, rand() * Math.PI * 2);
      scale.set(sx, sy, sz);
      m4.compose(pos, q, scale);
      mesh.setMatrixAt(i, m4);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    // shadowy() runs over the whole scene at the end of init and would turn this
    // back on. Opting out here is what actually keeps the far field out of the
    // shadow pass.
    if (!cast) mesh.userData.noShadow = true;
    scene.add(mesh);
    return mesh;
  };

  const unit = new THREE.BoxGeometry(1, 1, 1);
  const container = new THREE.MeshLambertMaterial({ map: crateTextureFor('#46586b') });
  const containerAlt = new THREE.MeshLambertMaterial({ map: crateTextureFor('#6d5a46') });
  const pallet = new THREE.MeshLambertMaterial({ map: crateTextureFor('#7d6238') });
  const boxSize = (r) => [6 + r() * 6, 2.4 + r() * 0.6, 2.4];
  const stackSize = (r) => [1.6 + r() * 1.6, 0.7 + r() * 1.1, 1.4 + r() * 1.2];

  // Shipping containers and site huts: the big silhouettes that give the yard a
  // skyline of its own. Pallet and material stacks fill in between them.
  place(12, unit, container, boxSize, INNER, NEAR_OUT, true);
  place(9, unit, containerAlt, boxSize, INNER, NEAR_OUT, true);
  place(26, unit, pallet, stackSize, INNER, NEAR_OUT, true);
  // The far field. Past the shadow box, so these are told not to cast rather
  // than being silently dropped from the shadow pass and left looking pasted on
  // to the deck: at that distance nobody misses a shadow, and the pass stays
  // cheap. Four draw calls for the whole yard either way.
  place(20, unit, container, boxSize, NEAR_OUT + 6, FAR_OUT, false);
  place(14, unit, containerAlt, boxSize, NEAR_OUT + 6, FAR_OUT, false);
  place(30, unit, pallet, stackSize, NEAR_OUT + 6, FAR_OUT, false);
}

// ---------- Lattice ----------

// A run of lattice: chords along the length, and a web of diagonals between
// them. The jib, the counter jib and the mast were each a single box, which from
// the cab is a painted plank hanging in the sky - the one object the operator
// looks past all day, and the one that most says "tower crane", drawn as a
// rectangle. Chords are individual meshes because there are only a handful; the
// diagonals are one InstancedMesh, so a fifty five metre jib with twenty five
// bays of web is two draw calls rather than a hundred.
//
// `section` gives the chord positions in the cross section, as [y, z] offsets
// from the run's own axis, which runs along +x from the origin.
function lattice(length, section, bay, mat, webMat) {
  const group = new THREE.Group();
  const CHORD = 0.17;

  section.forEach(([oy, oz]) => {
    const chord = new THREE.Mesh(new THREE.BoxGeometry(length, CHORD, CHORD), mat);
    chord.position.set(length / 2, oy, oz);
    group.add(chord);
  });

  // One diagonal per bay per face, plus a vertical post at each bay line. A face
  // is a pair of chords; every adjacent pair in the section list is one face,
  // and the list wraps so the last chord joins the first.
  const bays = Math.max(1, Math.round(length / bay));
  const step = length / bays;
  const faces = section.length < 2 ? 0 : section.length;
  const perBay = faces * 2;                       // a diagonal and a post per face
  const count = bays * perBay;
  const web = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.10, 0.10), webMat, count);
  web.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const from = new THREE.Vector3(1, 0, 0);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  let i = 0;

  const member = (ax, ay, az, bx, by, bz) => {
    a.set(ax, ay, az);
    b.set(bx, by, bz);
    axis.subVectors(b, a);
    const len = axis.length();
    if (len < 1e-4) return;
    pos.addVectors(a, b).multiplyScalar(0.5);
    q.setFromUnitVectors(from, axis.normalize());
    scale.set(len, 1, 1);
    m4.compose(pos, q, scale);
    web.setMatrixAt(i, m4);
    i += 1;
  };

  for (let bi = 0; bi < bays; bi += 1) {
    const x0 = bi * step;
    const x1 = x0 + step;
    for (let f = 0; f < faces; f += 1) {
      const [y0, z0] = section[f];
      const [y1, z1] = section[(f + 1) % section.length];
      // Alternate the diagonal direction bay to bay, which is what a real web
      // does and what stops it reading as a row of identical slashes.
      if (bi % 2 === 0) member(x0, y0, z0, x1, y1, z1);
      else member(x0, y1, z1, x1, y0, z0);
      member(x1, y0, z0, x1, y1, z1);              // post on the bay line
    }
  }
  web.count = i;
  web.instanceMatrix.needsUpdate = true;
  web.computeBoundingSphere();
  group.add(web);
  return group;
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
  renderer.toneMappingExposure = 1.5;
  // Shadows. Without them a twelve metre scaffold seen from a forty two metre
  // cab is a slightly different shade of grey on a flat plane: the load, the
  // truck, the crates and the crane itself all read as decals rather than as
  // things with height, and the one cue that tells an operator how far the load
  // still has to drop is missing entirely. This is the single biggest thing the
  // view was lacking. shadowMap.autoUpdate stays on because the house slews.
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  MAX_ANISO = Math.min(4, renderer.capabilities.getMaxAnisotropy());

  scene = new THREE.Scene();
  scene.background = skyTexture();
  // Exponential, and dense enough to actually reach the working volume. The old
  // linear fog started at 120 m, which is beyond the whole crane: it did nothing
  // where the player looks, while the deck's hard rectangular edge stayed
  // plainly visible at 300 m and gave the world away as a square.
  scene.fog = new THREE.FogExp2(new THREE.Color(HAZE), 0.0020);

  camera = new THREE.PerspectiveCamera(70, 1, 0.15, 1500);

  // One sun that casts, one sky fill that does not. The sun is low enough in the
  // south east to throw a long shadow across the deck: a crane's own shadow
  // sweeping the site as the house slews is the signature image of the job, and
  // a sun overhead would have given every object a puddle instead.
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.0);
  sun.position.set(86, 96, 62);
  sun.castShadow = true;
  // Wide enough to hold the crane's OWN shadow, which is the point of having one
  // at all: the jib tip is 54 m out and 44 m up, so with the sun at this
  // elevation its shadow lands past 100 m and a tighter box cut it off in
  // mid air. 2048 over 220 m is about 11 cm a texel, which still resolves the
  // load's contact shadow, and that is the cue an operator actually reads.
  const SHADOW_HALF = 110;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -SHADOW_HALF;
  sun.shadow.camera.right = SHADOW_HALF;
  sun.shadow.camera.top = SHADOW_HALF;
  sun.shadow.camera.bottom = -SHADOW_HALF;
  sun.shadow.camera.near = 20;
  sun.shadow.camera.far = 320;
  // normalBias rather than bias: the deck is one enormous plane and a constant
  // bias that hides acne on it detaches the shadow from the foot of the mast.
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.6;
  scene.add(sun);
  scene.add(sun.target);
  parts.sun = sun;
  // Sky fill, warmer off the deck than the old flat grey so shadowed faces read
  // as being in shade rather than as being unlit.
  scene.add(new THREE.HemisphereLight(0xc4d6e6, 0x6a6154, 0.72));

  // Deck. Textured concrete/asphalt with a grid overlay so height and radius read at a glance.
  const deck = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000),
    new THREE.MeshLambertMaterial({ map: deckTexture() })
  );
  deck.rotation.x = -Math.PI / 2;
  deck.receiveShadow = true;
  scene.add(deck);
  const grid = new THREE.GridHelper(600, 60, 0x6a6a62, 0x585850);
  grid.position.y = 0.02;
  // Dialled back. At full strength the ten metre grid was the brightest thing on
  // the deck and every real object had to compete with it.
  grid.material.transparent = true;
  grid.material.opacity = 0.5;
  scene.add(grid);
  // A one metre grid over the working circle. The ten metre grid reads gross
  // position well and tells you nothing about the last few metres, which is
  // exactly where the lift is won or lost.
  const fineGrid = new THREE.GridHelper(80, 80, 0x63635c, 0x5a5a54);
  fineGrid.position.y = 0.024;
  fineGrid.material.transparent = true;
  fineGrid.material.opacity = 0.28;
  scene.add(fineGrid);

  // Painted markings, under the game's own grid overlays so the grid still reads
  // as an instrument rather than as part of the world. Receives shadow
  // explicitly: shadowy() skips transparent materials, and paint sitting bright
  // inside the crane's own shadow is worse than paint that goes dark with it.
  const markings = new THREE.Mesh(
    new THREE.PlaneGeometry(SITE_SPAN, SITE_SPAN),
    new THREE.MeshLambertMaterial({ map: siteMarkings(), transparent: true, depthWrite: false })
  );
  markings.rotation.x = -Math.PI / 2;
  markings.position.y = 0.010;
  markings.receiveShadow = true;
  scene.add(markings);

  buildStadiumBackdrop(scene);
  buildSiteClutter(scene);
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

  const webMat = new THREE.MeshLambertMaterial({ color: 0xa8933a });

  // Mast: a square tower on four corner chords. Built lying along +x by the
  // helper and then stood up, which is why it is rotated rather than described
  // vertically.
  const mastH = state.crane.cabHeight + 4;
  const MAST_HALF = 1.0;
  const mast = lattice(
    mastH,
    [[MAST_HALF, MAST_HALF], [MAST_HALF, -MAST_HALF], [-MAST_HALF, -MAST_HALF], [-MAST_HALF, MAST_HALF]],
    2.6, steel, webMat
  );
  mast.rotation.z = Math.PI / 2;      // +x becomes +y
  scene.add(mast);
  parts.mast = mast;

  // Jib: the usual triangular section, two chords under the trolley rail and one
  // above. The trolley runs between the bottom pair, so the section is set around
  // where the trolley already is rather than the other way round: the rope leaves
  // the sheave at cabHeight + hookDrop and none of that moves.
  const JIB_TOP = 2.9;                // above cabHeight
  const JIB_BOT = 1.25;
  const JIB_HALF = 0.72;
  const jibSection = [[JIB_TOP, 0], [JIB_BOT, JIB_HALF], [JIB_BOT, -JIB_HALF]];
  const jib = lattice(state.crane.jibLength, jibSection, 2.3, steelPlain, webMat);
  jib.position.y = state.crane.cabHeight;
  slewGroup.add(jib);

  const counterJib = lattice(14, jibSection, 2.3, steelPlain, webMat);
  counterJib.position.y = state.crane.cabHeight;
  counterJib.rotation.y = Math.PI;    // runs back the other way
  slewGroup.add(counterJib);

  // Counterweight slab on the tail, which is what makes a tower crane read as
  // balanced rather than as a stick poking out of a tower.
  const cwt = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 2.4, 3.0),
    new THREE.MeshLambertMaterial({ map: steelTexture({ base: '#8d9094' }) })
  );
  cwt.position.set(-12.4, state.crane.cabHeight + 1.4, 0);
  slewGroup.add(cwt);

  // Trolley rail: the pair of runners the trolley actually hangs from, so it is
  // riding on something instead of floating inside the jib.
  [JIB_HALF, -JIB_HALF].forEach((z) => {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(state.crane.jibLength, 0.09, 0.18),
      new THREE.MeshLambertMaterial({ color: 0x4a4a44 })
    );
    rail.position.set(state.crane.jibLength / 2, state.crane.cabHeight + JIB_BOT - 0.13, z);
    slewGroup.add(rail);
  });

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

  // Everything solid in the scene joins the shadow pass, now that it all exists.
  // The hook cam and the backdrop are excluded: one is a camera, the other opts
  // out by userData.
  shadowy(scene);

  window.addEventListener('resize', resize);
  resize();
}

// Test seam. test/smoke.mjs asserts things about the scene graph that a
// screenshot cannot: that a mission's deck volumes exist and are visible, that
// the shadow pass has casters in it, that nothing transparent throws a shadow,
// and that the frame rate guard below actually fires on a slow renderer.
// Reading the scene is not writing state, so hard rule 1 is intact.
export function _scene() { return scene; }
export function _renderer() { return renderer; }
export function _shadowsOn() { return !shadowsDropped; }
// Where the head is pointed and where the block actually is, as plain numbers,
// so smoke.mjs can measure one against the other instead of re-deriving either.
export function _eye() {
  const d = new THREE.Vector3();
  camera.getWorldDirection(d);
  return { pos: camera.position.toArray(), dir: d.toArray() };
}
export function _hookWorld() { return hook ? hook.getWorldPosition(new THREE.Vector3()).toArray() : null; }

// Shadows are the most expensive thing here and the easiest to do without. The
// scene is small - about 45 draw calls and 6000 triangles - so geometry is not
// the risk; a 2048 shadow map plus a second colour pass for the hook cam on a
// weak integrated GPU driving a scaled display is. If the frame rate sits under
// the floor for long enough that it is clearly not a hitch, the shadow pass goes
// and does not come back. One way on purpose: a guard that switches back and
// forth spends its life crossing its own threshold, and a view that keeps
// changing how it is lit is worse than one that is simply flatter.
function dropShadows() {
  shadowsDropped = true;
  renderer.shadowMap.enabled = false;
  if (parts.sun) parts.sun.castShadow = false;
  // Every material was compiled against a shader that samples the shadow map.
  scene.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (let i = 0; i < mats.length; i += 1) mats[i].needsUpdate = true;
  });
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


// The vertical part of the rope, L cos(tilt). The hook hangs this far below the
// sheave, not a whole line length: it is offset sideways by L sin of each swing
// angle, and what is left over is the drop. Same three lines as pendulum.js,
// which owns the model; a shared copy would be one system importing another.
function ropeDrop(state) {
  const sx = Math.sin(state.load.swing.x);
  const sy = Math.sin(state.load.swing.y);
  return state.crane.line * Math.sqrt(Math.max(0, 1 - sx * sx - sy * sy));
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

  // The load bends the jib down and the mast forward toward it, so everything
  // that hangs off the jib sits a little further out and a little lower than the
  // trolley was commanded to. pendulum.js already hangs the load from that
  // deflected point; drawing it anywhere else would put the rope visibly beside
  // the load it is holding. The droop is the sag that goes with the lean, kept
  // proportional so the two move together; on a 55 m jib it is under a degree
  // and reads as weight rather than as damage.
  const bend = c.deflection || 0;
  const droop = bend * 2.2;
  const topY = c.cabHeight + CRANE.hookDrop - droop;
  const jibR = c.radius + bend;
  trolley.position.set(jibR, topY + 0.4, 0);
  sheave.position.set(jibR, topY - SHEAVE_DROP, 0);
  // The drop is the vertical part of the rope, L cos(tilt). Hanging the hook a
  // whole line length down while also offsetting it sideways drew a rope longer
  // than the rope is, and held the load at one height right through an arc.
  const hookY = topY - ropeDrop(state);
  hook.position.set(
    jibR + Math.sin(state.load.swing.y) * c.line,
    hookY,
    Math.sin(state.load.swing.x) * c.line
  );
  // The hook block hangs plumb below the rope, so it leans with the swing. Left
  // axis aligned it read as broken: the rope leaned and the block did not.
  hook.rotation.z = state.load.swing.y;
  hook.rotation.x = -state.load.swing.x;

  // Rope from the sheave to the hook, as a scaled and aimed cylinder.
  ropeTop.set(jibR, topY - SHEAVE_DROP, 0);
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

  // Frame rate guard, checked before the frame rather than after so a dropped
  // shadow pass takes effect on this frame. state.time.fps is main.js's rolling
  // average, so a single slow frame cannot trip it.
  if (!shadowsDropped && state.phase === 'playing') {
    const fps = state.time.fps;
    if (fps > 0 && fps < SHADOW_MIN_FPS) lowFpsFor += dt;
    else lowFpsFor = 0;
    if (lowFpsFor >= SHADOW_LOW_FOR) dropShadows();
  }

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
