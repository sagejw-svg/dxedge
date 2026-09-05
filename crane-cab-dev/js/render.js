// Three.js scene. READ state, never write it.
// Phase 0: placeholder geometry so orientation is visible. Phase 1 replaces
// the boxes with a proper cab shell, jib, trolley, hook block, and deck.

import * as THREE from 'three';

let renderer, scene, camera;
let trolley, ropeGeom, hook;
const parts = {};

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

  // Deck. Grid on a plane so height and radius read at a glance.
  const deck = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600),
    new THREE.MeshLambertMaterial({ color: 0x4a4a45 })
  );
  deck.rotation.x = -Math.PI / 2;
  scene.add(deck);
  const grid = new THREE.GridHelper(600, 60, 0x6a6a62, 0x585850);
  grid.position.y = 0.02;
  scene.add(grid);

  // Slewing group: everything above the slew ring turns together.
  const slewGroup = new THREE.Group();
  scene.add(slewGroup);
  parts.slewGroup = slewGroup;

  const steel = new THREE.MeshLambertMaterial({ color: 0xc9b23a }); // painted yellow, generic

  const mast = new THREE.Mesh(new THREE.BoxGeometry(2, state.crane.cabHeight + 4, 2), steel);
  mast.position.y = (state.crane.cabHeight + 4) / 2;
  scene.add(mast);

  const jib = new THREE.Mesh(new THREE.BoxGeometry(state.crane.jibLength, 1.4, 1.4), steel);
  jib.position.set(state.crane.jibLength / 2, state.crane.cabHeight + 2.5, 0);
  slewGroup.add(jib);

  const counterJib = new THREE.Mesh(new THREE.BoxGeometry(14, 1.2, 1.2), steel);
  counterJib.position.set(-7, state.crane.cabHeight + 2.5, 0);
  slewGroup.add(counterJib);

  trolley = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 1.8), new THREE.MeshLambertMaterial({ color: 0x333333 }));
  slewGroup.add(trolley);

  ropeGeom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const rope = new THREE.Line(ropeGeom, new THREE.LineBasicMaterial({ color: 0x111111 }));
  slewGroup.add(rope);

  hook = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.2, 0.6), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  slewGroup.add(hook);

  // Cab shell. Camera sits inside. A few dark bars suggest the glass frame.
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
  bar(0.08, 0.08, 2.1, 1.0, 2.2, 0);      // header
  bar(2.4, 0.08, 2.1, -0.2, 2.2, 0);      // roof edge
  bar(2.4, 0.06, 2.1, -0.2, -0.02, 0);    // floor edge (floor glass in the real cab)

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

  const topY = c.cabHeight + 1.8;
  trolley.position.set(c.radius, topY, 0);
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

  // Camera: eye height in the seat, looks out along the jib. Drag look-around later.
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
