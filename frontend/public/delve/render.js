/* Delve view.
 *
 * A raycaster with textured floor, ceiling, and walls, a torch that
 * flickers, and colored light where a spell just landed. Each floor has
 * a theme. Sprites are drawn in memory when the page loads. Nothing is
 * fetched from the network.
 */

import { currentFloor, questMarkers, exploredKey, FLOOR_THEMES } from './engine.js';

const LOOK = {
  crypt: { id: 'crypt', mul: [1, 0.9, 0.78], fog: [18, 12, 10], torch: [1.15, 0.7, 0.32], amb: 0.36 },
  cave: { id: 'cave', mul: [0.7, 0.82, 0.68], fog: [12, 18, 14], torch: [0.82, 0.9, 0.5], amb: 0.34 },
  flood: { id: 'flood', mul: [0.55, 0.74, 0.9], fog: [8, 18, 28], torch: [0.5, 0.75, 1.05], amb: 0.32 },
  forge: { id: 'forge', mul: [1.08, 0.58, 0.36], fog: [34, 12, 6], torch: [1.4, 0.42, 0.1], amb: 0.42 },
  camp: { id: 'camp', mul: [1.02, 0.88, 0.7], fog: [22, 16, 12], torch: [1.25, 0.82, 0.4], amb: 0.5 },
};
let look = LOOK.crypt;

const TEX = 128;
const MASK = TEX - 1;
const SW = 112;
const SH = 150;

function hash(x, y, s) {
  const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function put(data, x, y, r, g, b, a) {
  const i = (y * TEX + x) * 4;
  data[i] = r;
  data[i + 1] = g;
  data[i + 2] = b;
  data[i + 3] = a == null ? 255 : a;
}

function makeTex(paint) {
  const data = new Uint8ClampedArray(TEX * TEX * 4);
  paint(data);
  return data;
}

function buildTextures() {
  const stone = makeTex((d) => {
    for (let y = 0; y < TEX; y++) {
      for (let x = 0; x < TEX; x++) {
        const row = (y / 32) | 0;
        const off = (row & 1) ? 16 : 0;
        const mx = (x + off) % 32;
        const my = y % 32;
        const mortar = my < 3 || mx < 3;
        const n = hash(x, y, 2);
        const brick = hash((x + off) / 32 | 0, row, 11);
        if (mortar) put(d, x, y, 54 + n * 16, 46 + n * 10, 38);
        else {
          let shade = 0.78 + n * 0.34 + brick * 0.16;
          if (my < 6) shade *= 1.12;
          if (my > 27) shade *= 0.84;
          if (hash(x, y, 8) > 0.97) shade *= 0.55;
          put(d, x, y, 150 * shade, 122 * shade, 96 * shade);
        }
      }
    }
  });
  const moss = makeTex((d) => {
    for (let y = 0; y < TEX; y++) {
      for (let x = 0; x < TEX; x++) {
        const i = (y * TEX + x) * 4;
        let r = stone[i];
        let g = stone[i + 1];
        let b = stone[i + 2];
        const n = hash(x, y, 9);
        if (n > 0.72) {
          const k = (n - 0.72) / 0.28;
          r = r * (1 - k) + 48 * k;
          g = g * (1 - k) + 110 * k;
          b = b * (1 - k) + 58 * k;
        }
        put(d, x, y, r, g, b);
      }
    }
  });
  const door = makeTex((d) => {
    for (let y = 0; y < TEX; y++) {
      for (let x = 0; x < TEX; x++) {
        const frame = x < 8 || x > 119 || y < 6 || y > 121;
        const band = (y > 28 && y < 40) || (y > 88 && y < 100);
        const plank = (x % 22) < 3;
        const n = hash(x, y, 4);
        const grain = hash(x, (y / 3) | 0, 14);
        if (frame) put(d, x, y, 48 + n * 10, 34, 26);
        else if (band) put(d, x, y, 168 + n * 30, 132, 58);
        else if (plank) put(d, x, y, 70, 46, 32);
        else put(d, x, y, 118 + grain * 40, 74 + grain * 16, 44);
        if (!frame && x > 86 && x < 98 && y > 58 && y < 74) put(d, x, y, 28, 22, 16);
      }
    }
  });
  const gate = makeTex((d) => {
    for (let y = 0; y < TEX; y++) {
      for (let x = 0; x < TEX; x++) {
        const col = x % 16;
        const bar = col < 4 || y < 5 || y > 122;
        const n = hash(x, y, 5);
        if (!bar) put(d, x, y, 22, 20, 22, 230);
        else if (col === 0) put(d, x, y, 210 + n * 20, 214, 196);
        else put(d, x, y, 150 + n * 24, 154, 140);
      }
    }
  });
  const floor = makeTex((d) => {
    for (let y = 0; y < TEX; y++) {
      for (let x = 0; x < TEX; x++) {
        const mx = x % 32;
        const my = y % 32;
        const edge = mx < 2 || my < 2 || mx > 30 || my > 30;
        const lip = mx < 4 || my < 4;
        const n = hash(x, y, 6);
        const tile = hash((x / 32) | 0, (y / 32) | 0, 16);
        if (edge) put(d, x, y, 42, 36, 30);
        else {
          let shade = 0.82 + n * 0.3 + tile * 0.12;
          if (lip) shade *= 1.08;
          if (hash(x, y, 17) > 0.96) shade *= 0.7;
          put(d, x, y, 132 * shade, 108 * shade, 84 * shade);
        }
      }
    }
  });
  const ceil = makeTex((d) => {
    for (let y = 0; y < TEX; y++) {
      for (let x = 0; x < TEX; x++) {
        const beam = (x % 32) < 5;
        const plank = (y % 10) < 1;
        const n = hash(x, y, 3);
        if (beam) put(d, x, y, 86 + n * 18, 58, 40);
        else if (plank) put(d, x, y, 40, 32, 28);
        else put(d, x, y, 58 + n * 16, 46 + n * 8, 36);
      }
    }
  });
  return { stone, moss, door, gate, floor, ceil };
}

function sheet(w, h, paint) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.clearRect(0, 0, w, h);
  paint(g);
  return { w, h, data: g.getImageData(0, 0, w, h).data };
}

function slash(g) {
  g.strokeStyle = 'rgba(255, 220, 160, 0.9)';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(78, 70, 28, -1.1, 0.8);
  g.stroke();
}

function wash(g) {
  g.fillStyle = 'rgba(255, 70, 48, 0.38)';
  g.fillRect(0, 0, SW, SH);
}

function drawKind(g, kind, phase) {
  const bob = phase ? 5 : 0;
  if (kind === 'crawler') {
    g.fillStyle = '#3a241c';
    g.beginPath(); g.ellipse(56, 112 + bob, 42, 14, 0, 0, 7); g.fill();
    g.fillStyle = '#c48458';
    g.beginPath(); g.ellipse(56, 98 + bob, 38, 18, 0, 0, 7); g.fill();
    g.fillStyle = '#8a5a38';
    g.beginPath(); g.ellipse(48, 92 + bob, 16, 8, -0.4, 0, 7); g.fill();
    g.fillStyle = '#4a3024';
    for (let i = 0; i < 6; i++) g.fillRect(16 + i * 14 + (phase ? (i & 1) * 5 : 0), 108, 5, 24);
    g.fillStyle = '#ffb060';
    g.beginPath(); g.arc(42, 90, 4, 0, 7); g.arc(66, 90, 4, 0, 7); g.fill();
  } else if (kind === 'spitter') {
    g.fillStyle = '#244034';
    g.fillRect(46, 36, 20, 78);
    g.fillStyle = '#6aaa72';
    g.beginPath(); g.ellipse(56, 40 + bob, 22, 18, 0, 0, 7); g.fill();
    g.fillStyle = '#d6e28a';
    g.beginPath(); g.ellipse(56, 38, 8, 10, 0, 0, 7); g.fill();
    g.fillStyle = '#1c3024';
    g.fillRect(40, 108, 12, 22);
    g.fillRect(60, 108, 12, 22);
    g.strokeStyle = '#9ecf78';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(56, 28); g.lineTo(56 - (phase ? 8 : 0), 8); g.stroke();
  } else if (kind === 'brute') {
    g.fillStyle = '#6a2824';
    g.fillRect(24, 48, 64, 64);
    g.fillStyle = '#c45a4a';
    g.beginPath(); g.arc(56, 42, 22, 0, 7); g.fill();
    g.fillStyle = '#e8d2a4';
    g.fillRect(30, 16 + bob, 8, 26);
    g.fillRect(74, 16 + bob, 8, 26);
    g.fillStyle = '#f0d080';
    g.fillRect(44, 40, 8, 5);
    g.fillRect(64, 40, 8, 5);
    g.fillStyle = '#3a1818';
    g.fillRect(30, 108, 18, 24);
    g.fillRect(64, 108, 18, 24);
    g.fillStyle = '#e7a15a';
    g.fillRect(18, 62, 14, 8);
  } else if (kind === 'wisp') {
    const y = 78 + bob;
    const rad = g.createRadialGradient(56, y, 4, 56, y, 40);
    rad.addColorStop(0, 'rgba(255, 236, 190, 1)');
    rad.addColorStop(0.45, 'rgba(227, 146, 74, 0.9)');
    rad.addColorStop(1, 'rgba(227, 146, 74, 0)');
    g.fillStyle = rad;
    g.beginPath(); g.arc(56, y, 40, 0, 7); g.fill();
    g.fillStyle = '#fff6e0';
    g.beginPath(); g.arc(56, y, 8, 0, 7); g.fill();
  } else if (kind === 'moth') {
    g.fillStyle = 'rgba(214, 196, 168, 0.9)';
    g.beginPath(); g.ellipse(28, 78 + bob, 26, 16, -0.5, 0, 7); g.fill();
    g.beginPath(); g.ellipse(84, 78 + bob, 26, 16, 0.5, 0, 7); g.fill();
    g.fillStyle = '#5a4030';
    g.beginPath(); g.ellipse(56, 86, 10, 22, 0, 0, 7); g.fill();
    g.fillStyle = '#f0d080';
    g.beginPath(); g.arc(50, 74, 3, 0, 7); g.arc(62, 74, 3, 0, 7); g.fill();
  } else if (kind === 'hound') {
    g.fillStyle = '#e6d8c2';
    g.beginPath(); g.ellipse(52, 100, 34, 16, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(86, 78 + bob, 16, 14, 0, 0, 7); g.fill();
    g.fillStyle = '#b7a890';
    const lift = phase ? 6 : 0;
    g.fillRect(24, 104, 7, 26 - lift);
    g.fillRect(40, 106, 7, 24);
    g.fillRect(62, 106 - lift, 7, 24);
    g.fillRect(78, 100, 7, 28);
    g.fillStyle = '#2a2018';
    g.beginPath(); g.arc(94, 74, 3, 0, 7); g.fill();
  } else if (kind === 'chanter') {
    g.fillStyle = '#2a2448';
    g.beginPath();
    g.moveTo(56, 16);
    g.lineTo(96, 132);
    g.lineTo(16, 132);
    g.closePath();
    g.fill();
    g.fillStyle = '#4a3c78';
    g.beginPath(); g.moveTo(56, 28); g.lineTo(78, 70); g.lineTo(34, 70); g.fill();
    g.fillStyle = '#c9b6ff';
    g.beginPath(); g.ellipse(56, 78 + bob, 10, 14, 0, 0, 7); g.fill();
    g.fillStyle = '#9ec4de';
    g.fillRect(46, 96, 20, 5);
  } else if (kind === 'knight') {
    g.fillStyle = '#3a342c';
    g.fillRect(30, 36, 52, 74);
    g.fillStyle = '#5a5148';
    g.fillRect(34, 18, 44, 28);
    g.fillStyle = '#e3924a';
    g.fillRect(40, 28, 32, 7);
    g.fillStyle = '#8a7560';
    g.fillRect(16, 52 + bob, 16, 32);
    g.fillRect(80, 52, 16, 32);
    g.fillStyle = '#1a120c';
    g.fillRect(34, 108, 16, 26);
    g.fillRect(62, 108, 16, 26);
    g.fillStyle = '#e7a15a';
    g.fillRect(50, 64, 12, 22);
    g.strokeStyle = '#c4b09a';
    g.lineWidth = 2;
    g.strokeRect(32, 40, 48, 66);
  } else if (kind === 'warden') {
    g.fillStyle = '#140e0c';
    g.beginPath();
    g.moveTo(56, 8);
    g.lineTo(102, 136);
    g.lineTo(10, 136);
    g.closePath();
    g.fill();
    g.fillStyle = '#3a2418';
    g.fillRect(32, 120, 48, 16);
    g.fillStyle = '#e7a15a';
    g.beginPath(); g.ellipse(56, 42, 18, 20, 0, 0, 7); g.fill();
    g.fillStyle = '#1a120c';
    g.fillRect(44, 36, 7, 10);
    g.fillRect(64, 36, 7, 10);
    g.strokeStyle = '#e7a15a';
    g.lineWidth = 3;
    g.beginPath(); g.arc(56, 78, 12, 0, 7); g.stroke();
  } else if (kind === 'ghost') {
    g.fillStyle = 'rgba(214, 228, 236, 0.28)';
    g.beginPath(); g.ellipse(56, 88, 28, 40, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(236, 244, 248, 0.85)';
    g.beginPath(); g.ellipse(56, 48 + bob, 16, 18, 0, 0, 7); g.fill();
    g.fillStyle = '#1a2830';
    g.beginPath(); g.arc(50, 46, 3, 0, 7); g.arc(62, 46, 3, 0, 7); g.fill();
    g.strokeStyle = 'rgba(220, 236, 244, 0.7)';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(34, 70); g.lineTo(28, 120); g.moveTo(78, 70); g.lineTo(84, 118); g.stroke();
  } else if (kind === 'seal') {
    g.fillStyle = '#120c0a';
    g.beginPath(); g.arc(56, 78, 46, 0, 7); g.fill();
    g.strokeStyle = '#e3924a';
    g.lineWidth = 7;
    g.beginPath(); g.arc(56, 78, 30, 0.4 + phase * 0.2, 5.6); g.stroke();
    g.fillStyle = '#f0c48a';
    g.beginPath(); g.arc(56, 78, 9, 0, 7); g.fill();
    g.strokeStyle = '#f3eadc';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(56, 24); g.lineTo(56, 46);
    g.moveTo(22, 96); g.lineTo(38, 84);
    g.moveTo(90, 96); g.lineTo(74, 84);
    g.stroke();
  }
}

function monsterFrames(kind) {
  const paint = [
    (g) => drawKind(g, kind, 0),
    (g) => drawKind(g, kind, 1),
    (g) => { g.save(); g.translate(16, -6); drawKind(g, kind, 0); g.restore(); slash(g); },
    (g) => { g.save(); g.translate(-12, 3); drawKind(g, kind, 0); g.restore(); wash(g); },
    (g) => { g.save(); g.translate(10, 46); g.transform(1, 0.2, 0, 0.42, 0, 0); drawKind(g, kind, 0); g.restore(); },
  ];
  return paint.map((fn) => sheet(SW, SH, fn));
}

function buildSprites() {
  const monsters = ['crawler', 'spitter', 'brute', 'wisp', 'moth', 'hound', 'chanter', 'knight', 'ghost', 'warden', 'seal'];
  const sprites = {};
  for (const kind of monsters) sprites[kind] = monsterFrames(kind);
  sprites.chest = sheet(96, 128, (g) => {
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.beginPath(); g.ellipse(48, 122, 36, 6, 0, 0, 7); g.fill();
    g.fillStyle = '#3a2416';
    g.fillRect(8, 58, 80, 60);
    g.fillStyle = '#6b4228';
    g.fillRect(8, 58, 80, 16);
    g.fillStyle = '#8d5a34';
    g.beginPath(); g.ellipse(48, 58, 40, 20, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#e7a15a';
    g.fillRect(8, 78, 80, 8);
    g.fillRect(42, 46, 12, 70);
    g.fillStyle = '#f0d7a4';
    g.fillRect(10, 60, 6, 6);
    g.fillRect(80, 60, 6, 6);
    g.fillRect(10, 108, 6, 6);
    g.fillRect(80, 108, 6, 6);
    g.fillStyle = '#a56a32';
    g.fillRect(38, 92, 20, 16);
    g.fillStyle = '#fff6d4';
    g.fillRect(44, 48, 8, 6);
    g.fillRect(14, 64, 14, 3);
  });
  sprites.chestOpen = sheet(96, 128, (g) => {
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.beginPath(); g.ellipse(48, 122, 36, 6, 0, 0, 7); g.fill();
    g.fillStyle = '#2c1c12';
    g.fillRect(8, 78, 80, 40);
    g.fillStyle = '#120e0c';
    g.fillRect(16, 86, 64, 22);
    g.fillStyle = '#e7a15a';
    g.fillRect(34, 92, 28, 8);
    g.fillStyle = '#8d5a34';
    g.save();
    g.translate(48, 70);
    g.transform(1, 0, 0, 0.7, 0, -18);
    g.beginPath(); g.ellipse(0, 0, 40, 18, 0, Math.PI, 0); g.fill();
    g.restore();
    g.fillStyle = '#fff6d4';
    g.fillRect(30, 40, 10, 4);
  });
  sprites.key = sheet(96, 128, (g) => {
    g.strokeStyle = '#e7a15a';
    g.lineWidth = 4;
    g.beginPath(); g.arc(48, 44, 14, 0, 7); g.stroke();
    g.beginPath(); g.moveTo(48, 58); g.lineTo(48, 104); g.stroke();
    g.beginPath(); g.moveTo(48, 88); g.lineTo(62, 88); g.moveTo(48, 98); g.lineTo(60, 98); g.stroke();
  });
  sprites.potion = sheet(96, 128, (g) => {
    g.fillStyle = '#d15a48';
    g.beginPath(); g.ellipse(48, 86, 14, 20, 0, 0, 7); g.fill();
    g.fillStyle = '#f3eadc';
    g.fillRect(43, 58, 10, 16);
    g.fillStyle = '#e7a15a';
    g.fillRect(41, 50, 14, 10);
  });
  sprites.gear = sheet(96, 128, (g) => {
    g.fillStyle = '#4a3424';
    g.beginPath(); g.ellipse(48, 96, 22, 16, 0, 0, 7); g.fill();
    g.fillStyle = '#6a5038';
    g.fillRect(30, 78, 36, 22);
    g.fillStyle = '#e7a15a';
    g.fillRect(40, 84, 16, 5);
    g.strokeStyle = '#f0d7a4';
    g.lineWidth = 4;
    g.beginPath(); g.moveTo(34, 74); g.lineTo(70, 42); g.stroke();
    g.fillStyle = '#cfc6ba';
    g.fillRect(62, 36, 14, 8);
  });
  sprites.lever = sheet(96, 128, (g) => {
    g.fillStyle = '#5a5148';
    g.fillRect(44, 58, 8, 52);
    g.strokeStyle = '#e7a15a';
    g.lineWidth = 6;
    g.beginPath(); g.moveTo(48, 64); g.lineTo(74, 36); g.stroke();
    g.fillStyle = '#e7a15a';
    g.beginPath(); g.arc(74, 36, 6, 0, 7); g.fill();
  });
  sprites.stairsDown = sheet(96, 128, (g) => {
    g.fillStyle = '#2a241e';
    g.fillRect(12, 36, 72, 80);
    g.fillStyle = '#8a7560';
    for (let i = 0; i < 5; i++) g.fillRect(22 + i * 4, 46 + i * 12, 52 - i * 8, 7);
  });
  sprites.stairsUp = sheet(96, 128, (g) => {
    g.fillStyle = '#3a342c';
    g.fillRect(12, 36, 72, 80);
    g.fillStyle = '#c4b09a';
    for (let i = 0; i < 5; i++) g.fillRect(22 + (4 - i) * 4, 46 + i * 12, 20 + i * 8, 7);
  });
  sprites.banner = sheet(96, 128, (g) => {
    g.fillStyle = '#4a3424';
    g.fillRect(10, 6, 8, 118);
    g.fillStyle = '#c4a06a';
    g.fillRect(8, 6, 12, 6);
    g.fillStyle = '#8d2e2e';
    g.beginPath();
    g.moveTo(18, 16);
    g.lineTo(88, 20);
    g.quadraticCurveTo(84, 52, 86, 86);
    g.lineTo(18, 78);
    g.closePath();
    g.fill();
    g.fillStyle = '#6a2020';
    g.fillRect(18, 70, 66, 8);
    g.strokeStyle = '#e7a15a';
    g.lineWidth = 3;
    g.strokeRect(40, 34, 28, 24);
    g.beginPath();
    g.moveTo(54, 38); g.lineTo(54, 54);
    g.moveTo(44, 46); g.lineTo(64, 46);
    g.stroke();
  });
  sprites.bones = sheet(96, 128, (g) => {
    g.strokeStyle = '#e4d2b8';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(24, 96); g.lineTo(48, 78); g.lineTo(74, 100);
    g.moveTo(30, 108); g.lineTo(60, 90);
    g.stroke();
    g.fillStyle = '#f3eadc';
    g.beginPath(); g.arc(24, 96, 6, 0, 7); g.arc(74, 100, 6, 0, 7); g.fill();
  });
  sprites.torch = sheet(96, 128, (g) => {
    g.fillStyle = '#4a3424';
    g.fillRect(42, 70, 12, 46);
    g.fillStyle = '#e7a15a';
    g.beginPath(); g.ellipse(48, 62, 14, 18, 0, 0, 7); g.fill();
    g.fillStyle = '#fff1c4';
    g.beginPath(); g.ellipse(48, 56, 6, 10, 0, 0, 7); g.fill();
  });
  sprites.web = sheet(96, 128, (g) => {
    g.strokeStyle = 'rgba(230, 224, 210, 0.75)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(48, 6); g.lineTo(18, 70); g.lineTo(78, 64); g.closePath();
    g.moveTo(48, 6); g.lineTo(48, 78);
    g.moveTo(20, 40); g.lineTo(76, 36);
    g.stroke();
  });
  sprites.statue = sheet(96, 128, (g) => {
    g.fillStyle = '#6a645c';
    g.fillRect(28, 88, 40, 28);
    g.fillRect(40, 48, 16, 44);
    g.beginPath(); g.arc(48, 40, 14, 0, 7); g.fill();
    g.fillStyle = '#8a847c';
    g.fillRect(30, 108, 36, 8);
  });
  sprites.npc = sheet(96, 128, (g) => {
    g.fillStyle = '#243038';
    g.beginPath(); g.ellipse(48, 96, 26, 28, 0, 0, 7); g.fill();
    g.fillStyle = '#d8b89a';
    g.beginPath(); g.arc(48, 52, 16, 0, 7); g.fill();
    g.fillStyle = '#e7a15a';
    g.fillRect(40, 78, 16, 6);
  });
  sprites.sable = sheet(96, 128, (g) => {
    g.fillStyle = '#3a2418';
    g.fillRect(28, 70, 40, 52);
    g.fillStyle = '#e7a15a';
    g.fillRect(24, 78, 48, 8);
    g.fillStyle = '#d8b89a';
    g.beginPath(); g.arc(48, 46, 16, 0, 7); g.fill();
    g.fillStyle = '#2a1c14';
    g.fillRect(34, 32, 28, 8);
    g.fillStyle = '#1a120c';
    g.fillRect(40, 44, 5, 4);
    g.fillRect(52, 44, 5, 4);
  });
  sprites.nell = sheet(96, 128, (g) => {
    g.fillStyle = '#24382e';
    g.beginPath(); g.moveTo(48, 62); g.lineTo(82, 124); g.lineTo(14, 124); g.closePath(); g.fill();
    g.fillStyle = '#9dcc86';
    g.fillRect(36, 88, 24, 6);
    g.fillStyle = '#e0b090';
    g.beginPath(); g.arc(48, 48, 16, 0, 7); g.fill();
    g.fillStyle = '#6a5038';
    g.beginPath(); g.arc(48, 40, 16, Math.PI, 0); g.fill();
    g.fillStyle = '#1a120c';
    g.fillRect(40, 46, 5, 4);
    g.fillRect(52, 46, 5, 4);
  });
  sprites.pell = sheet(96, 128, (g) => {
    g.fillStyle = '#4a3428';
    g.fillRect(30, 72, 36, 50);
    g.fillStyle = '#c4b09a';
    g.fillRect(22, 80, 12, 28);
    g.fillRect(64, 80, 12, 28);
    g.fillStyle = '#c89878';
    g.beginPath(); g.arc(48, 48, 16, 0, 7); g.fill();
    g.fillStyle = '#120e0c';
    g.fillRect(32, 34, 32, 10);
  });
  sprites.fire = sheet(96, 128, (g) => {
    g.fillStyle = '#5a5148';
    g.beginPath(); g.ellipse(48, 108, 34, 10, 0, 0, 7); g.fill();
    g.fillStyle = '#3a342c';
    g.beginPath(); g.arc(22, 104, 8, 0, 7); g.arc(48, 108, 9, 0, 7); g.arc(74, 104, 8, 0, 7); g.fill();
    g.fillStyle = '#e05a20';
    g.beginPath(); g.moveTo(48, 28); g.lineTo(70, 100); g.lineTo(26, 100); g.closePath(); g.fill();
    g.fillStyle = '#f0a040';
    g.beginPath(); g.moveTo(48, 44); g.lineTo(62, 100); g.lineTo(34, 100); g.closePath(); g.fill();
    g.fillStyle = '#fff1c4';
    g.beginPath(); g.moveTo(48, 62); g.lineTo(56, 100); g.lineTo(40, 100); g.closePath(); g.fill();
  });
  sprites.relic = sheet(96, 128, (g) => {
    g.fillStyle = '#ffb45a';
    g.beginPath();
    g.moveTo(48, 48); g.lineTo(64, 78); g.lineTo(48, 96); g.lineTo(32, 78); g.fill();
    g.fillStyle = '#fff6d4';
    g.fillRect(45, 68, 6, 10);
  });
  sprites.crack = sheet(96, 128, (g) => {
    g.strokeStyle = '#d8c8a8';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(30, 96); g.lineTo(46, 78); g.lineTo(42, 70); g.lineTo(58, 86); g.lineTo(70, 74);
    g.stroke();
  });
  return sprites;
}

function sample(tex, tx, ty) {
  const x = tx & MASK;
  const y = ty & MASK;
  const i = (y * TEX + x) * 4;
  return [tex[i], tex[i + 1], tex[i + 2]];
}

function clampByte(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function shade(r, g, b, dist, lr, lg, lb, side, above, gleam) {
  const amb = above ? look.amb + 0.08 : look.amb;
  let rr = r * (amb + lr) + lr * 26;
  let gg = g * (amb + lg) + lg * 16;
  let bb = b * (amb + lb) + lb * 10;
  if (side) { rr *= 0.76; gg *= 0.76; bb *= 0.76; }
  const reach = gleam ? 18 : 13;
  const t = dist / reach;
  const f = t < 0 ? 0 : t > 1 ? 0.72 : t * t * 0.72;
  return [
    clampByte(rr * (1 - f) + look.fog[0] * f),
    clampByte(gg * (1 - f) + look.fog[1] * f),
    clampByte(bb * (1 - f) + look.fog[2] * f),
  ];
}

function buildLight(cam, game, flick, quality) {
  const grid = new Float32Array(33 * 33 * 3);
  const carry = game.torch ? 1.45 : 1;
  const reach = (game.gleamMs > 0 ? 10 : 7) * carry * (0.99 + (flick - 1) * 0.4);
  const lights = [{
    x: cam.x, y: cam.y,
    r: look.torch[0] * flick, g: look.torch[1] * flick, b: look.torch[2] * flick,
    radius: reach,
  }];
  if (game) {
    const here = currentFloor(game);
    if (here && here.entities) {
      for (const e of here.entities) {
        if (quality !== 'low' && e.kind === 'prop' && e.sub === 'torch' && !e.taken) {
          lights.push({
            x: e.x + 0.5, y: e.y + 0.5,
            r: 0.9 * flick, g: 0.4 * flick, b: 0.1 * flick,
            radius: 2.5,
          });
        }
        if (e.kind === 'prop' && e.sub === 'fire' && !e.taken) {
          lights.push({
            x: e.x + 0.5, y: e.y + 0.5,
            r: 1.25 * flick, g: 0.55 * flick, b: 0.16 * flick,
            radius: 4.4,
          });
        }
      }
    }
  }
  if (game.wardMs > 0) {
    lights.push({ x: cam.x, y: cam.y, r: 0.12, g: 0.42, b: 0.22, radius: 3.6 });
  }
  if (quality !== 'low' && game.lights) {
    for (const L of game.lights) {
      if (L.floor != null && L.floor !== game.floor) continue;
      lights.push(L);
    }
  }
  for (const L of lights) {
    const rad = L.radius || 3;
    const x0 = Math.max(0, (L.x - rad) | 0);
    const x1 = Math.min(32, (L.x + rad) | 0);
    const y0 = Math.max(0, (L.y - rad) | 0);
    const y1 = Math.min(32, (L.y + rad) | 0);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5) - L.x;
        const dy = (y + 0.5) - L.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d >= rad) continue;
        const fall = 1 - d / rad;
        const k = fall * fall;
        const i = (y * 33 + x) * 3;
        grid[i] += L.r * k;
        grid[i + 1] += L.g * k;
        grid[i + 2] += L.b * k;
      }
    }
  }
  return grid;
}

function lightAt(grid, x, y) {
  const cx = x | 0;
  const cy = y | 0;
  if (cx < 0 || cy < 0 || cx > 32 || cy > 32) return [0, 0, 0];
  const i = (cy * 33 + cx) * 3;
  return [grid[i], grid[i + 1], grid[i + 2]];
}

const SCALE = {
  crawler: 0.78, spitter: 1.05, brute: 1.2, wisp: 0.9, warden: 1.55,
  moth: 0.78, hound: 1, chanter: 1.12, knight: 1.28, ghost: 1.05, seal: 1.7,
  chest: 0.84, chestOpen: 0.78, key: 0.42, potion: 0.38, lever: 0.72,
  stairsDown: 0.58, stairsUp: 0.58,
  banner: 1.15, bones: 0.55, torch: 0.95, web: 0.9, statue: 1.05, fire: 1.05, gear: 0.5,
  npc: 1.05, sable: 1.08, nell: 1.08, pell: 1.05, relic: 0.5, crack: 0.55,
};

export function paintPortrait(canvas, index, champ) {
  const g = canvas.getContext('2d');
  if (!g) return;
  const w = canvas.width;
  const h = canvas.height;
  const pal = [
    { skin: '#e0b090', hair: '#2a1c14', cloth: '#8a3830', mark: '#e3924a' },
    { skin: '#c89878', hair: '#120e0c', cloth: '#24382e', mark: '#9dcc86' },
    { skin: '#d8b89a', hair: '#6a5038', cloth: '#314454', mark: '#7eb8dc' },
    { skin: '#ecd2b4', hair: '#241830', cloth: '#342c54', mark: '#c9b6ff' },
  ][index] || { skin: '#e0b090', hair: '#2a1c14', cloth: '#8a3830', mark: '#e3924a' };
  g.fillStyle = '#100c0a';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#1c1612';
  g.fillRect(3, 3, w - 6, h - 6);
  g.fillStyle = pal.cloth;
  g.beginPath();
  g.ellipse(w / 2, h * 0.96, w * 0.46, h * 0.32, 0, Math.PI, 0);
  g.fill();
  g.fillStyle = pal.skin;
  g.beginPath();
  g.ellipse(w / 2, h * 0.48, w * 0.26, h * 0.24, 0, 0, 7);
  g.fill();
  g.fillStyle = pal.hair;
  if (index === 3) {
    g.beginPath();
    g.moveTo(w * 0.5, h * 0.05);
    g.lineTo(w * 0.82, h * 0.36);
    g.lineTo(w * 0.18, h * 0.36);
    g.fill();
  } else if (index === 0) {
    g.fillStyle = '#4a4038';
    g.fillRect(w * 0.2, h * 0.16, w * 0.6, h * 0.18);
    g.fillStyle = pal.mark;
    g.fillRect(w * 0.28, h * 0.4, w * 0.44, h * 0.045);
  } else {
    g.beginPath();
    g.ellipse(w / 2, h * 0.3, w * 0.3, h * 0.16, 0, Math.PI, 0);
    g.fill();
  }
  g.fillStyle = '#1a120c';
  g.fillRect(w * 0.34, h * 0.48, w * 0.08, h * 0.03);
  g.fillRect(w * 0.56, h * 0.48, w * 0.08, h * 0.03);
  g.fillStyle = pal.mark;
  g.fillRect(w * 0.36, h * 0.482, 3, 3);
  g.fillRect(w * 0.58, h * 0.482, 3, 3);
  const armor = champ && champ.armor;
  if (armor && armor.def > 0) {
    g.fillStyle = armor.def >= 3 ? '#d7c4a4' : armor.def >= 2 ? '#8d734c' : '#5c4636';
    g.fillRect(w * 0.08, h * 0.7, w * 0.2, h * 0.1);
    g.fillRect(w * 0.72, h * 0.7, w * 0.2, h * 0.1);
    g.fillStyle = pal.mark;
    g.fillRect(w * 0.14, h * 0.73, w * 0.08, h * 0.025);
  }
  const weapon = champ && champ.weapon;
  if (weapon && weapon.atk >= 0) {
    g.strokeStyle = weapon.atk >= 4 ? '#f0d7a4' : pal.mark;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(w * 0.8, h * 0.66);
    g.lineTo(w * 0.92, h * 0.34);
    g.stroke();
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(w * 0.76, h * 0.7);
    g.lineTo(w * 0.84, h * 0.62);
    g.stroke();
  }
  g.strokeStyle = '#e7a15a';
  g.lineWidth = 2;
  g.strokeRect(1, 1, w - 2, h - 2);
  g.strokeStyle = '#3c3229';
  g.strokeRect(4, 4, w - 8, h - 8);
}

export function createView() {
  const tex = buildTextures();
  const sprites = buildSprites();
  let image = null;
  let zbuf = new Float32Array(2048);
  let quality = 'medium';
  let motion = 'smooth';
  let titleGame = null;

  function setQuality(q) {
    quality = q === 'low' || q === 'high' ? q : 'medium';
  }
  function setMotion(m) {
    motion = m === 'step' ? 'step' : 'smooth';
  }

  function draw(canvas, game, cam) {
    const cssW = canvas.clientWidth | 0;
    const cssH = canvas.clientHeight | 0;
    if (cssW < 16 || cssH < 16) return;
    const caps = quality === 'low' ? [720, 420] : quality === 'high' ? [1440, 820] : [1100, 660];
    const dpr = quality === 'high' ? Math.min(1.35, window.devicePixelRatio || 1) : 1;
    const w = Math.max(320, Math.min(caps[0], Math.floor(cssW * dpr)));
    const h = Math.max(160, Math.min(caps[1], Math.floor(cssH * dpr)));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    if (!image || image.width !== w || image.height !== h) image = new ImageData(w, h);
    if (zbuf.length < w) zbuf = new Float32Array(w);
    const data = image.data;
    const px = cam.x;
    const py = cam.y;
    const ang = cam.ang;
    const dirX = Math.sin(ang);
    const dirY = -Math.cos(ang);
    const planeScale = 0.72;
    const planeX = Math.sin(ang + Math.PI / 2) * planeScale;
    const planeY = -Math.cos(ang + Math.PI / 2) * planeScale;
    const gleam = game.gleamMs > 0;
    const fireCells = new Set();
    const hereEnts = (currentFloor(game) && currentFloor(game).entities) || [];
    for (const e of hereEnts) {
      if (e.kind === 'prop' && e.sub === 'fire' && !e.taken) fireCells.add(e.x + ',' + e.y);
    }
    const t = game.time || 0;
    let flick = 1 + Math.sin(t / 1600) * 0.012 + Math.sin(t / 2400) * 0.008;
    const themeName = game.inHub ? 'camp' : ((currentFloor(game) && currentFloor(game).theme) || FLOOR_THEMES[game.floor] || 'crypt');
    look = LOOK[themeName] || LOOK.crypt;
    const tiles = currentFloor(game).tiles;
    const H = tiles.length;
    const W = tiles[0].length;
    const horizon = (h * 0.46) | 0;
    const faceDx = [0, 1, 0, -1];
    const faceDy = [-1, 0, 1, 0];
    const face = (game.facing | 0) & 3;
    const aheadX = game.x + faceDx[face];
    const aheadY = game.y + faceDy[face];
    const glowTile = aheadX >= 0 && aheadY >= 0 && aheadX < W && aheadY < H && tileUsable(game, tiles, aheadX, aheadY);
    const grid = buildLight(cam, game, flick, quality);
    const rayX0 = dirX - planeX;
    const rayY0 = dirY - planeY;
    const rayX1 = dirX + planeX;
    const rayY1 = dirY + planeY;
    const floorStep = quality === 'low' ? 2 : 1;

    for (let y = 0; y < h; y++) {
      const above = y < horizon;
      const p = above ? (horizon - y) : (y - horizon);
      const row = y * w * 4;
      if (p < 1) {
        for (let x = 0; x < w; x++) {
          const i = row + x * 4;
          data[i] = 12; data[i + 1] = 10; data[i + 2] = 9; data[i + 3] = 255;
        }
        continue;
      }
      const rowDistance = (0.5 * h) / p;
      const stepX = rowDistance * (rayX1 - rayX0) / w;
      const stepY = rowDistance * (rayY1 - rayY0) / w;
      let floorX = px + rowDistance * rayX0;
      let floorY = py + rowDistance * rayY0;
      const src = above ? tex.ceil : tex.floor;
      for (let x = 0; x < w; x += floorStep) {
        const tx = (floorX * TEX) & MASK;
        const ty = (floorY * TEX) & MASK;
        const s = sample(src, tx, ty);
        let rr = s[0] * look.mul[0];
        let gg = s[1] * look.mul[1];
        let bb = s[2] * look.mul[2];
        if (!above && look.id === 'forge' && ((tx + ty * 3) & 31) === 0) {
          rr = 210; gg = 72; bb = 16;
        }
        if (!above && look.id === 'flood' && (ty & 15) < 2) {
          bb = Math.min(255, bb + 36);
          gg = Math.min(255, gg + 10);
        }
        if (!above) {
          const cellX = floorX | 0;
          const cellY = floorY | 0;
          if (cellX >= 0 && cellY >= 0 && cellX < W && cellY < H) {
            const tile = tiles[cellY][cellX];
            if (tile === 4 || tile === 5) {
              const fx = floorX - cellX;
              const fy = floorY - cellY;
              const rim = fx < 0.1 || fy < 0.1 || fx > 0.9 || fy > 0.9;
              const step = fy > 0.18 && fy < 0.82 && fx > 0.22 && fx < 0.78 && ((fy * 4) % 1) < 0.22;
              if (tile === 5) {
                if (rim) { rr = 214; gg = 148; bb = 64; }
                else if (step) { rr = 168; gg = 118; bb = 72; }
                else { rr = 24; gg = 16; bb = 12; }
              } else if (rim) { rr = 196; gg = 164; bb = 112; }
              else if (step) { rr = 150; gg = 124; bb = 86; }
              else { rr = 92; gg = 74; bb = 54; }
            }
            if (fireCells.has(cellX + ',' + cellY)) {
              const fx = floorX - cellX - 0.5;
              const fy = floorY - cellY - 0.5;
              const d = Math.sqrt(fx * fx + fy * fy);
              if (d < 0.42) {
                const hot = d < 0.16;
                rr = hot ? 255 : 210;
                gg = hot ? 170 : 72;
                bb = hot ? 60 : 18;
              }
            }
            if (glowTile && cellX === aheadX && cellY === aheadY) {
              rr = Math.min(255, rr + 34);
              gg = Math.min(255, gg + 16);
              bb = Math.min(255, bb + 4);
            }
          }
        }
        const lit = lightAt(grid, floorX, floorY);
        const c = shade(rr, gg, bb, rowDistance, lit[0], lit[1], lit[2], false, above, gleam);
        const i = row + x * 4;
        data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
        if (floorStep === 2 && x + 1 < w) {
          data[i + 4] = c[0]; data[i + 5] = c[1]; data[i + 6] = c[2]; data[i + 7] = 255;
        }
        floorX += stepX * floorStep;
        floorY += stepY * floorStep;
      }
    }

    for (let x = 0; x < w; x++) {
      const cameraX = 2 * x / w - 1;
      const rayDirX = dirX + planeX * cameraX;
      const rayDirY = dirY + planeY * cameraX;
      let mapX = px | 0;
      let mapY = py | 0;
      const deltaX = Math.abs(1 / (rayDirX || 1e-8));
      const deltaY = Math.abs(1 / (rayDirY || 1e-8));
      let stepX, stepY, sideX, sideY;
      if (rayDirX < 0) { stepX = -1; sideX = (px - mapX) * deltaX; }
      else { stepX = 1; sideX = (mapX + 1 - px) * deltaX; }
      if (rayDirY < 0) { stepY = -1; sideY = (py - mapY) * deltaY; }
      else { stepY = 1; sideY = (mapY + 1 - py) * deltaY; }
      let side = 0;
      let tile = 0;
      for (let n = 0; n < 48; n++) {
        if (sideX < sideY) { sideX += deltaX; mapX += stepX; side = 0; }
        else { sideY += deltaY; mapY += stepY; side = 1; }
        if (mapY < 0 || mapX < 0 || mapY >= H || mapX >= W) { tile = 0; break; }
        tile = tiles[mapY][mapX];
        if (tile === 0 || tile === 2 || tile === 3) break;
      }
      let dist = side === 0 ? (sideX - deltaX) : (sideY - deltaY);
      if (dist < 0.03) dist = 0.03;
      zbuf[x] = dist;
      const lineH = (h / dist) | 0;
      const wallShift = h * 0.46 - h / 2;
      let drawStart = ((h - lineH) / 2 + wallShift) | 0;
      let drawEnd = drawStart + lineH;
      if (drawStart < 0) drawStart = 0;
      if (drawEnd > h) drawEnd = h;
      let wallX = side === 0 ? py + dist * rayDirY : px + dist * rayDirX;
      wallX -= Math.floor(wallX);
      let texPick = tex.stone;
      if (tile === 2) texPick = tex.door;
      else if (tile === 3) texPick = tex.gate;
      else if (((mapX * 3 + mapY * 5) & 7) === 0) texPick = tex.moss;
      const tx = (wallX * TEX) & MASK;
      const lit = lightAt(grid, mapX + 0.5, mapY + 0.5);
      const span = Math.max(1, drawEnd - drawStart);
      const facingDoor = mapX === aheadX && mapY === aheadY && (tile === 2 || tile === 3);
      for (let y = drawStart; y < drawEnd; y++) {
        const ty = (((y - ((h - lineH) / 2 + wallShift)) * TEX) / lineH) & MASK;
        const s = sample(texPick, tx, ty);
        const v = (y - drawStart) / span;
        const vg = 0.78 + 0.34 * (1 - Math.min(1, Math.abs(v - 0.62) * 1.6));
        const c = shade(s[0] * look.mul[0] * vg, s[1] * look.mul[1] * vg, s[2] * look.mul[2] * vg, dist, lit[0], lit[1], lit[2], side === 1, false, gleam);
        if (facingDoor) {
          c[0] = clampByte(c[0] + 42);
          c[1] = clampByte(c[1] + 22);
          c[2] = clampByte(c[2] + 6);
        }
        const i = (y * w + x) * 4;
        data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
      }
    }

    const list = [];
    const floor = currentFloor(game);
    const usable = {
      chest: 1, lever: 1, key: 1, potion: 1, gear: 1, npc: 1, sable: 1, nell: 1, pell: 1,
      relic: 1, crack: 1, torch: 1, fire: 1,
    };
    const onGround = {
      chest: 1, chestOpen: 1, key: 1, potion: 1, gear: 1, lever: 1,
      banner: 1, bones: 1, torch: 1, web: 1, statue: 1, fire: 1,
      npc: 1, sable: 1, nell: 1, pell: 1, relic: 1, crack: 1,
    };
    const labels = [];
    for (const e of floor.entities) {
      if (e.taken) continue;
      if (e.kind === 'monster' && !e.alive && !(e.anim === 'death' && e.animMs > 0)) continue;
      if (e.kind === 'chest' && e.opened) {
        list.push({
          x: e.x + 0.5, y: e.y + 0.5, sub: 'chestOpen', scale: SCALE.chestOpen,
          ground: true, cellX: e.x, cellY: e.y,
        });
        continue;
      }
      let sub = e.kind === 'monster' ? e.sub
        : e.kind === 'prop' ? e.sub
        : e.kind === 'potion' ? 'potion'
        : e.kind === 'item' ? ((e.item && (e.item.type === 'potion' || e.item.type === 'food' || e.item.type === 'drink')) ? 'potion' : 'gear')
        : e.kind === 'npc' ? (e.id || 'npc')
        : e.kind === 'relic' ? 'relic'
        : e.kind === 'mark' ? 'crack'
        : e.kind;
      if (e.kind === 'npc' && !sprites[sub]) sub = 'npc';
      let wx = e.x + 0.5;
      let wy = e.y + 0.5;
      if (motion === 'smooth' && e.moveMs > 0 && e.fromX != null) {
        const k = Math.min(1, e.moveMs / 150);
        wx += (e.fromX - e.x) * k;
        wy += (e.fromY - e.y) * k;
      }
      if (e.sub === 'wisp' || e.sub === 'moth' || e.sub === 'ghost') wy += Math.sin(t / 180 + e.x) * 0.08;
      const scale = (SCALE[sub] || 0.6) * (e.anim === 'death' ? 0.92 : 1);
      list.push({
        x: wx, y: wy, sub, scale, ent: e.kind === 'monster' ? e : null,
        ground: !!onGround[sub],
        highlight: !!usable[sub] && e.x === aheadX && e.y === aheadY,
        cellX: e.x, cellY: e.y,
        name: e.kind === 'npc' ? e.name : '',
      });
    }
    if (quality !== 'low' && game.particles) {
      for (const p of game.particles) {
        if (p.floor != null && p.floor !== game.floor) continue;
        if (p.life <= 0) continue;
        list.push({ x: p.x, y: p.y, particle: p, scale: 0.18 });
      }
    }
    const invDet = 1 / (planeX * dirY - dirX * planeY);
    list.sort((a, b) => {
      const da = (a.x - px) * (a.x - px) + (a.y - py) * (a.y - py);
      const db = (b.x - px) * (b.x - px) + (b.y - py) * (b.y - py);
      return db - da;
    });
    for (const sp of list) {
      const sx = sp.x - px;
      const sy = sp.y - py;
      const transX = invDet * (dirY * sx - dirX * sy);
      const transY = invDet * (-planeY * sx + planeX * sy);
      if (transY < 0.12) continue;
      const screenX = ((w / 2) * (1 + transX / transY)) | 0;
      if (sp.particle) {
        const life = Math.max(0, Math.min(1, sp.particle.life / 400));
        const size = Math.max(2, Math.abs(h / transY) * 0.05 * (0.4 + life));
        const y0 = ((h / 2) + h * 0.08) | 0;
        const lit = [sp.particle.r, sp.particle.g, sp.particle.b];
        const x0 = (screenX - size) | 0;
        const x1 = (screenX + size) | 0;
        for (let stripe = x0; stripe <= x1; stripe++) {
          if (stripe < 0 || stripe >= w || transY >= zbuf[stripe]) continue;
          for (let y = (y0 - size) | 0; y <= (y0 + size); y++) {
            if (y < 0 || y >= h) continue;
            const i = (y * w + stripe) * 4;
            data[i] = clampByte(data[i] * (1 - life) + lit[0] * 255 * life);
            data[i + 1] = clampByte(data[i + 1] * (1 - life) + lit[1] * 255 * life);
            data[i + 2] = clampByte(data[i + 2] * (1 - life) + lit[2] * 255 * life);
          }
        }
        continue;
      }
      const frame = pickFrame(sprites[sp.sub], sp.ent, t);
      if (!frame) continue;
      const lit = lightAt(grid, sp.x, sp.y);
      const spriteH = Math.abs(h / transY) * sp.scale;
      const spriteW = spriteH * (frame.w / frame.h);
      const feetY = horizon + (0.5 * h) / transY;
      const y0 = sp.ground ? feetY - spriteH : ((h - spriteH) / 2 + h * 0.08);
      if (sp.ground) {
        const rx = Math.max(5, spriteW * 0.34);
        const ry = Math.max(2, rx * 0.28);
        paintEllipse(data, w, h, screenX, feetY, rx, ry, transY, zbuf, 'shadow');
        if (sp.highlight) paintEllipse(data, w, h, screenX, feetY, rx * 1.35, ry * 1.55, transY, zbuf, 'ring');
      }
      if (sp.name && transY < 10) labels.push({ x: screenX, y: Math.max(16, y0 - 6), text: sp.name });
      const x0 = (screenX - spriteW / 2) | 0;
      const x1 = (x0 + spriteW) | 0;
      const glint = sp.sub === 'chest' || sp.sub === 'chestOpen';
      const pulse = 0.62 + 0.38 * Math.sin(t / 80);
      for (let stripe = x0; stripe < x1; stripe++) {
        if (stripe < 0 || stripe >= w) continue;
        if (transY >= zbuf[stripe]) continue;
        const tx = (((stripe - x0) * frame.w) / spriteW) | 0;
        if (tx < 0 || tx >= frame.w) continue;
        const yStart = y0 < 0 ? 0 : y0;
        const yEnd = y0 + spriteH > h ? h : (y0 + spriteH) | 0;
        for (let y = yStart; y < yEnd; y++) {
          const ty = (((y - y0) * frame.h) / spriteH) | 0;
          if (ty < 0 || ty >= frame.h) continue;
          const si = (ty * frame.w + tx) * 4;
          const a = frame.data[si + 3];
          if (a < 16) {
            if (sp.highlight && spriteEdge(frame, tx, ty)) {
              const i = (y * w + stripe) * 4;
              data[i] = clampByte(data[i] * 0.35 + 210);
              data[i + 1] = clampByte(data[i + 1] * 0.35 + 130);
              data[i + 2] = clampByte(data[i + 2] * 0.35 + 48);
            }
            continue;
          }
          let sr = frame.data[si];
          let sg = frame.data[si + 1];
          let sb = frame.data[si + 2];
          if (glint && sr > 236 && sg > 210 && sb > 170) {
            sr *= pulse; sg *= pulse; sb *= pulse;
          }
          if (sp.highlight) {
            sr = Math.min(255, sr + 28);
            sg = Math.min(255, sg + 14);
          }
          const c = shade(sr, sg, sb, transY, lit[0], lit[1], lit[2], false, false, gleam);
          const i = (y * w + stripe) * 4;
          const aa = a / 255;
          data[i] = data[i] * (1 - aa) + c[0] * aa;
          data[i + 1] = data[i + 1] * (1 - aa) + c[1] * aa;
          data[i + 2] = data[i + 2] * (1 - aa) + c[2] * aa;
        }
      }
    }

    const ctx = canvas.getContext('2d');
    ctx.putImageData(image, 0, 0);
    if (labels.length) {
      ctx.font = '15px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (const lab of labels) {
        const tw = ctx.measureText(lab.text).width;
        ctx.fillStyle = 'rgba(16, 12, 10, 0.82)';
        ctx.fillRect(lab.x - tw / 2 - 6, lab.y - 14, tw + 12, 20);
        ctx.fillStyle = '#e7a15a';
        ctx.fillText(lab.text, lab.x, lab.y);
      }
    }
    const glowA = 0.2 + Math.sin(t / 1600) * 0.012;
    const glow = ctx.createRadialGradient(w * 0.5, h * 0.9, 8, w * 0.5, h * 0.92, w * 0.55);
    glow.addColorStop(0, 'rgba(255, 176, 90, ' + glowA + ')');
    glow.addColorStop(1, 'rgba(255, 140, 50, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    if (gleam) {
      const pale = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.5);
      pale.addColorStop(0, 'rgba(220, 230, 255, 0.08)');
      pale.addColorStop(1, 'rgba(220, 230, 255, 0)');
      ctx.fillStyle = pale;
      ctx.fillRect(0, 0, w, h);
    }
    if (quality !== 'low' && game.lights) {
      for (const L of game.lights) {
        if (L.floor != null && L.floor !== game.floor) continue;
        const sx = L.x - px;
        const sy = L.y - py;
        const transX = invDet * (dirY * sx - dirX * sy);
        const transY = invDet * (-planeY * sx + planeX * sy);
        if (transY < 0.2 || transY > 9) continue;
        const screenX = (w / 2) * (1 + transX / transY);
        const screenY = h * 0.48;
        const rad = Math.abs(h / transY) * 0.9;
        const blob = ctx.createRadialGradient(screenX, screenY, 4, screenX, screenY, rad);
        const alpha = Math.max(0, Math.min(0.45, L.life / 800));
        blob.addColorStop(0, 'rgba(' + (L.r * 255 | 0) + ',' + (L.g * 255 | 0) + ',' + (L.b * 255 | 0) + ',' + alpha + ')');
        blob.addColorStop(1, 'rgba(' + (L.r * 255 | 0) + ',' + (L.g * 255 | 0) + ',' + (L.b * 255 | 0) + ',0)');
        ctx.fillStyle = blob;
        ctx.fillRect(0, 0, w, h);
      }
    }
    const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.32, w / 2, h / 2, w * 0.72);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  function ensureTitle() {
    if (titleGame) return titleGame;
    const tiles = [];
    for (let y = 0; y < 33; y++) tiles.push(new Array(33).fill(0));
    for (let x = 1; x <= 12; x++) {
      tiles[8][x] = 1;
      tiles[7][x] = 1;
      tiles[9][x] = 1;
    }
    titleGame = {
      floor: 0,
      floors: [{
        tiles,
        entities: [
          { kind: 'monster', sub: 'knight', alive: true, x: 5, y: 8, anim: 'idle' },
          { kind: 'monster', sub: 'moth', alive: true, x: 7, y: 7, anim: 'idle' },
          { kind: 'chest', x: 8, y: 9, opened: false },
          { kind: 'prop', sub: 'torch', x: 3, y: 8 },
          { kind: 'prop', sub: 'banner', x: 4, y: 7 },
          { kind: 'prop', sub: 'bones', x: 6, y: 9 },
          { kind: 'prop', sub: 'statue', x: 9, y: 8 },
          { kind: 'prop', sub: 'web', x: 10, y: 7 },
        ],
      }],
      time: 0,
      gleamMs: 0,
      wardMs: 0,
      lights: [{ x: 4.2, y: 8.2, r: 1, g: 0.36, b: 0.08, life: 1, radius: 4.5, floor: 0 }],
      particles: [],
    };
    return titleGame;
  }

  function paintTitle(canvas) {
    const scene = ensureTitle();
    scene.time = performance.now();
    const prevQ = quality;
    const prevM = motion;
    if (quality === 'low') quality = 'medium';
    motion = 'smooth';
    const sway = Math.sin(scene.time / 1400) * 1.15;
    draw(canvas, scene, {
      x: 2.6 + sway,
      y: 8.5 + Math.sin(scene.time / 900) * 0.12,
      ang: Math.PI / 2 + Math.sin(scene.time / 2200) * 0.06,
    });
    quality = prevQ;
    motion = prevM;
  }

  function drawMap(canvas, game) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#120f0c';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#6a5038';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);
    if (!game) return;
    const tiles = currentFloor(game).tiles;
    const floor = currentFloor(game);
    let x0 = 0;
    let y0 = 0;
    let x1 = 32;
    let y1 = 32;
    if (game.inHub) {
      x0 = 11; y0 = 12; x1 = 22; y1 = 20;
    }
    const spanX = x1 - x0 + 1;
    const spanY = y1 - y0 + 1;
    const cell = Math.floor(Math.min(w / spanX, h / spanY));
    const ox = ((w - cell * spanX) / 2) | 0;
    const oy = ((h - cell * spanY) / 2) | 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!game.explored.has(exploredKey(game, x, y))) continue;
        const tile = tiles[y][x];
        let color = '#3a332c';
        if (tile === 0) color = '#1a1613';
        else if (tile === 2) color = '#8a4038';
        else if (tile === 7) color = '#6a5344';
        else if (tile === 3) color = '#6a7270';
        else if (tile === 6) color = '#3e4a44';
        else if (tile === 4 || tile === 5) color = '#e7a15a';
        ctx.fillStyle = color;
        ctx.fillRect(ox + (x - x0) * cell, oy + (y - y0) * cell, cell, cell);
      }
    }
    const mxOf = (x) => ox + (x - x0) * cell;
    const myOf = (y) => oy + (y - y0) * cell;
    for (const e of floor.entities) {
      if (e.taken) continue;
      if (!game.explored.has(exploredKey(game, e.x, e.y))) continue;
      if (e.kind === 'monster' && e.alive) {
        const near = (e.x - game.x) * (e.x - game.x) + (e.y - game.y) * (e.y - game.y) <= 36;
        if (!near && !game.inHub) continue;
        ctx.fillStyle = '#d15a48';
        ctx.fillRect(mxOf(e.x), myOf(e.y), cell, cell);
      } else if (e.kind === 'npc') {
        ctx.fillStyle = '#9ec4de';
        ctx.fillRect(mxOf(e.x) + 1, myOf(e.y) + 1, Math.max(2, cell - 2), Math.max(2, cell - 2));
      } else if (e.kind === 'prop' && e.sub === 'fire') {
        ctx.fillStyle = '#e3924a';
        ctx.beginPath();
        ctx.arc(mxOf(e.x) + cell / 2, myOf(e.y) + cell / 2, Math.max(2, cell * 0.35), 0, 7);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#e7a15a';
    for (const m of questMarkers(game)) {
      const onThis = game.inHub ? !!m.hub : m.floor === game.floor;
      if (!onThis) continue;
      const mx = mxOf(m.x) + cell / 2;
      const my = myOf(m.y) + cell / 2;
      ctx.beginPath();
      ctx.moveTo(mx, my - cell * 0.46);
      ctx.lineTo(mx + cell * 0.36, my);
      ctx.lineTo(mx, my + cell * 0.46);
      ctx.lineTo(mx - cell * 0.36, my);
      ctx.closePath();
      ctx.fill();
    }
    const cx = mxOf(game.x) + cell / 2;
    const cy = myOf(game.y) + cell / 2;
    const ang = game.facing * Math.PI / 2;
    ctx.fillStyle = '#f3eadc';
    ctx.beginPath();
    ctx.moveTo(cx + Math.sin(ang) * cell * 0.9, cy - Math.cos(ang) * cell * 0.9);
    ctx.lineTo(cx + Math.sin(ang + 2.4) * cell * 0.55, cy - Math.cos(ang + 2.4) * cell * 0.55);
    ctx.lineTo(cx + Math.sin(ang - 2.4) * cell * 0.55, cy - Math.cos(ang - 2.4) * cell * 0.55);
    ctx.closePath();
    ctx.fill();
  }

  return {
    draw, drawMap, paintTitle, paintPortrait,
    setQuality, setMotion,
    quality: () => quality,
    motion: () => motion,
  };
}

function tileUsable(game, tiles, x, y) {
  const tile = tiles[y][x];
  if (tile === 2 || tile === 3 || tile === 4 || tile === 5) return true;
  const here = currentFloor(game);
  const ents = here && here.entities;
  if (!ents) return false;
  return ents.some(e => e.x === x && e.y === y && !e.taken && (
    (e.kind === 'chest' && !e.opened) || e.kind === 'lever' || e.kind === 'key' || e.kind === 'potion'
    || e.kind === 'item'
    || e.kind === 'npc' || e.kind === 'relic' || e.kind === 'mark'
    || (e.kind === 'prop' && (e.sub === 'torch' || e.sub === 'fire'))
  ));
}

function spriteEdge(frame, tx, ty) {
  const fw = frame.w;
  const fh = frame.h;
  const d = frame.data;
  for (let oy = -2; oy <= 2; oy++) {
    for (let ox = -2; ox <= 2; ox++) {
      if (!ox && !oy) continue;
      const x = tx + ox;
      const y = ty + oy;
      if (x < 0 || y < 0 || x >= fw || y >= fh) continue;
      if (d[(y * fw + x) * 4 + 3] >= 16) return true;
    }
  }
  return false;
}

function paintEllipse(data, w, h, cx, cy, rx, ry, z, zbuf, mode) {
  if (rx < 1 || ry < 1) return;
  const x0 = Math.max(0, (cx - rx) | 0);
  const x1 = Math.min(w - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, (cy - ry) | 0);
  const y1 = Math.min(h - 1, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (z >= zbuf[x]) continue;
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      const d2 = nx * nx + ny * ny;
      if (d2 > 1) continue;
      const i = (y * w + x) * 4;
      const k = 1 - d2;
      if (mode === 'shadow') {
        const s = 1 - 0.62 * k * k;
        data[i] *= s;
        data[i + 1] *= s;
        data[i + 2] *= s;
      } else if (d2 > 0.42) {
        const a = (d2 - 0.42) / 0.58;
        data[i] = clampByte(data[i] * (1 - a) + 232 * a);
        data[i + 1] = clampByte(data[i + 1] * (1 - a) + 148 * a);
        data[i + 2] = clampByte(data[i + 2] * (1 - a) + 60 * a);
      }
    }
  }
}

function pickFrame(sheetOrFrames, ent, time) {
  if (!sheetOrFrames) return null;
  if (!Array.isArray(sheetOrFrames)) return sheetOrFrames;
  const anim = ent && ent.anim;
  if (anim === 'attack') return sheetOrFrames[2];
  if (anim === 'hurt') return sheetOrFrames[3];
  if (anim === 'death') return sheetOrFrames[4];
  const phase = ((time / 280 + ((ent && ent.x) || 0) * 3) | 0) & 1;
  return sheetOrFrames[phase];
}
