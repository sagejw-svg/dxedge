/* Delve view.
 *
 * A raycaster: one column per screen x, a textured floor and ceiling,
 * then billboards for whatever stands in the cells. Pictures are built
 * in memory when the page loads. Nothing is loaded from the network.
 */

const TEX = 64;

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
        const row = (y / 16) | 0;
        const off = (row & 1) ? 8 : 0;
        const mx = (x + off) % 16;
        const mortar = (y % 16) < 2 || mx < 2;
        const n = hash(x, y, 2);
        if (mortar) put(d, x, y, 62 + n * 14, 52 + n * 10, 44);
        else {
          const shade = 0.92 + n * 0.32;
          put(d, x, y, 168 * shade, 140 * shade, 112 * shade);
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
        if (hash(x, y, 9) > 0.78) {
          r = 58; g = 92; b = 54;
        }
        put(d, x, y, r, g, b);
      }
    }
  });
  const door = makeTex((d) => {
    for (let y = 0; y < TEX; y++) {
      for (let x = 0; x < TEX; x++) {
        const frame = x < 5 || x > 58 || y < 3 || y > 60;
        const band = y > 28 && y < 36;
        const plank = (x % 13) < 2;
        const n = hash(x, y, 4);
        if (frame) put(d, x, y, 58, 42, 34);
        else if (band) put(d, x, y, 196 + n * 20, 150, 64);
        else if (plank) put(d, x, y, 78, 50, 36);
        else put(d, x, y, 132 + n * 28, 86 + n * 12, 52);
        if (!frame && x > 44 && x < 50 && y > 30 && y < 40) put(d, x, y, 20, 16, 14);
      }
    }
  });
  const gate = makeTex((d) => {
    for (let y = 0; y < TEX; y++) {
      for (let x = 0; x < TEX; x++) {
        const bar = (x % 10) < 3 || y < 3 || y > 60;
        const n = hash(x, y, 5);
        if (bar) put(d, x, y, 186 + n * 30, 190 + n * 20, 176);
        else put(d, x, y, 28, 24, 24);
      }
    }
  });
  const floor = makeTex((d) => {
    for (let y = 0; y < TEX; y++) {
      for (let x = 0; x < TEX; x++) {
        const mortar = (x % 32) < 2 || (y % 32) < 2;
        const n = hash(x, y, 6);
        if (mortar) put(d, x, y, 48, 40, 34);
        else {
          const shade = 0.88 + n * 0.28;
          put(d, x, y, 128 * shade, 106 * shade, 84 * shade);
        }
      }
    }
  });
  const ceil = makeTex((d) => {
    for (let y = 0; y < TEX; y++) {
      for (let x = 0; x < TEX; x++) {
        const beam = (x % 32) < 4;
        const n = hash(x, y, 3);
        if (beam) put(d, x, y, 72 + n * 10, 52, 40);
        else put(d, x, y, 48 + n * 10, 40, 34);
      }
    }
  });
  return { stone, moss, door, gate, floor, ceil };
}

function spriteSheet(paint) {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 96, 128);
  paint(g);
  return g.getImageData(0, 0, 96, 128).data;
}

function buildSprites() {
  const sheet = {};
  sheet.crawler = spriteSheet((g) => {
    g.fillStyle = '#a87848';
    g.beginPath(); g.ellipse(48, 96, 36, 16, 0, 0, 7); g.fill();
    g.fillStyle = '#6a4a30';
    for (let i = 0; i < 6; i++) g.fillRect(16 + i * 12, 100, 4, 16);
    g.fillStyle = '#ffb060';
    g.beginPath(); g.arc(36, 90, 4, 0, 7); g.arc(58, 90, 4, 0, 7); g.fill();
  });
  sheet.spitter = spriteSheet((g) => {
    g.fillStyle = '#3e6a48';
    g.fillRect(40, 36, 16, 70);
    g.fillStyle = '#6aaa72';
    g.beginPath(); g.ellipse(48, 36, 18, 16, 0, 0, 7); g.fill();
    g.fillStyle = '#d6e28a';
    g.beginPath(); g.arc(48, 34, 5, 0, 7); g.fill();
    g.fillStyle = '#2a4030';
    g.fillRect(34, 100, 10, 16);
    g.fillRect(52, 100, 10, 16);
  });
  sheet.brute = spriteSheet((g) => {
    g.fillStyle = '#c45a4a';
    g.fillRect(22, 48, 52, 56);
    g.fillStyle = '#8a3030';
    g.beginPath(); g.arc(48, 40, 18, 0, 7); g.fill();
    g.fillStyle = '#e8d2a4';
    g.fillRect(30, 16, 6, 22);
    g.fillRect(60, 16, 6, 22);
    g.fillStyle = '#f0d080';
    g.fillRect(38, 40, 6, 4);
    g.fillRect(52, 40, 6, 4);
    g.fillStyle = '#3a1818';
    g.fillRect(26, 100, 16, 18);
    g.fillRect(54, 100, 16, 18);
  });
  sheet.wisp = spriteSheet((g) => {
    const rad = g.createRadialGradient(48, 70, 4, 48, 70, 36);
    rad.addColorStop(0, 'rgba(255, 220, 150, 1)');
    rad.addColorStop(0.45, 'rgba(227, 146, 74, 0.9)');
    rad.addColorStop(1, 'rgba(227, 146, 74, 0)');
    g.fillStyle = rad;
    g.beginPath(); g.arc(48, 70, 36, 0, 7); g.fill();
    g.fillStyle = '#fff6e0';
    g.beginPath(); g.arc(48, 70, 8, 0, 7); g.fill();
  });
  sheet.moth = spriteSheet((g) => {
    g.fillStyle = 'rgba(196, 176, 150, 0.85)';
    g.beginPath(); g.ellipse(28, 70, 22, 14, -0.4, 0, 7); g.fill();
    g.beginPath(); g.ellipse(68, 70, 22, 14, 0.4, 0, 7); g.fill();
    g.fillStyle = '#6a5038';
    g.beginPath(); g.ellipse(48, 74, 8, 18, 0, 0, 7); g.fill();
    g.fillStyle = '#f0d080';
    g.beginPath(); g.arc(44, 64, 3, 0, 7); g.arc(52, 64, 3, 0, 7); g.fill();
  });
  sheet.hound = spriteSheet((g) => {
    g.fillStyle = '#e4d8c4';
    g.beginPath(); g.ellipse(50, 86, 30, 14, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(74, 70, 14, 12, 0, 0, 7); g.fill();
    g.fillStyle = '#b7a890';
    g.fillRect(28, 92, 6, 20);
    g.fillRect(42, 94, 6, 18);
    g.fillRect(58, 94, 6, 18);
    g.fillRect(70, 90, 6, 22);
    g.fillStyle = '#2a2018';
    g.beginPath(); g.arc(80, 66, 3, 0, 7); g.fill();
    g.strokeStyle = '#2a2018';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(86, 72); g.lineTo(92, 78); g.stroke();
  });
  sheet.chanter = spriteSheet((g) => {
    g.fillStyle = '#3a3058';
    g.beginPath();
    g.moveTo(48, 18);
    g.lineTo(78, 118);
    g.lineTo(18, 118);
    g.closePath();
    g.fill();
    g.fillStyle = '#241c38';
    g.beginPath(); g.arc(48, 40, 14, 0, 7); g.fill();
    g.fillStyle = '#c9b6ff';
    g.beginPath(); g.ellipse(48, 58, 8, 12, 0, 0, 7); g.fill();
    g.fillStyle = '#9ec4de';
    g.fillRect(40, 78, 16, 4);
  });
  sheet.knight = spriteSheet((g) => {
    g.fillStyle = '#4a4038';
    g.fillRect(26, 40, 44, 62);
    g.fillStyle = '#2a241e';
    g.fillRect(30, 18, 36, 28);
    g.fillStyle = '#e3924a';
    g.fillRect(36, 28, 24, 6);
    g.fillStyle = '#8a7560';
    g.fillRect(18, 48, 12, 28);
    g.fillRect(66, 48, 12, 28);
    g.fillStyle = '#1a120c';
    g.fillRect(30, 98, 14, 18);
    g.fillRect(52, 98, 14, 18);
    g.fillStyle = '#e7a15a';
    g.fillRect(44, 62, 8, 16);
  });
  sheet.seal = spriteSheet((g) => {
    g.fillStyle = '#140e0c';
    g.beginPath(); g.arc(48, 70, 40, 0, 7); g.fill();
    g.strokeStyle = '#e3924a';
    g.lineWidth = 6;
    g.beginPath(); g.arc(48, 70, 28, 0.4, 5.4); g.stroke();
    g.fillStyle = '#e7a15a';
    g.beginPath(); g.arc(48, 70, 8, 0, 7); g.fill();
    g.strokeStyle = '#f3eadc';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(48, 22); g.lineTo(48, 40); g.moveTo(20, 78); g.lineTo(34, 70); g.moveTo(76, 78); g.lineTo(62, 70); g.stroke();
  });
  sheet.warden = spriteSheet((g) => {
    g.fillStyle = '#1c1614';
    g.beginPath();
    g.moveTo(48, 8);
    g.lineTo(86, 118);
    g.lineTo(10, 118);
    g.closePath();
    g.fill();
    g.fillStyle = '#3a2418';
    g.fillRect(28, 108, 40, 14);
    g.fillStyle = '#e7a15a';
    g.beginPath(); g.ellipse(48, 36, 16, 18, 0, 0, 7); g.fill();
    g.fillStyle = '#1a120c';
    g.fillRect(38, 32, 6, 8);
    g.fillRect(52, 32, 6, 8);
    g.strokeStyle = '#e7a15a';
    g.lineWidth = 2;
    g.beginPath(); g.arc(48, 70, 10, 0, 7); g.stroke();
  });
  sheet.chest = spriteSheet((g) => {
    g.fillStyle = '#6a4630';
    g.fillRect(22, 58, 52, 36);
    g.fillStyle = '#8a6240';
    g.beginPath(); g.ellipse(48, 58, 26, 12, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#e7a15a';
    g.fillRect(22, 70, 52, 5);
    g.fillRect(44, 74, 8, 10);
  });
  sheet.chestOpen = spriteSheet((g) => {
    g.fillStyle = '#4a3424';
    g.fillRect(22, 70, 52, 28);
    g.fillStyle = '#2a2018';
    g.fillRect(28, 76, 40, 14);
    g.fillStyle = '#e7a15a';
    g.fillRect(40, 80, 16, 6);
  });
  sheet.key = spriteSheet((g) => {
    g.strokeStyle = '#e7a15a';
    g.lineWidth = 4;
    g.beginPath(); g.arc(48, 48, 12, 0, 7); g.stroke();
    g.beginPath(); g.moveTo(48, 60); g.lineTo(48, 100); g.stroke();
    g.beginPath(); g.moveTo(48, 88); g.lineTo(60, 88); g.moveTo(48, 98); g.lineTo(58, 98); g.stroke();
  });
  sheet.potion = spriteSheet((g) => {
    g.fillStyle = '#d15a48';
    g.fillRect(40, 70, 16, 28);
    g.fillStyle = '#f3eadc';
    g.fillRect(44, 56, 8, 16);
    g.fillStyle = '#e7a15a';
    g.fillRect(42, 50, 12, 8);
  });
  sheet.lever = spriteSheet((g) => {
    g.fillStyle = '#5a5148';
    g.fillRect(44, 60, 8, 52);
    g.strokeStyle = '#e7a15a';
    g.lineWidth = 6;
    g.beginPath(); g.moveTo(48, 64); g.lineTo(72, 40); g.stroke();
    g.fillStyle = '#e7a15a';
    g.beginPath(); g.arc(72, 40, 6, 0, 7); g.fill();
  });
  sheet.stairsDown = spriteSheet((g) => {
    g.fillStyle = '#2a241e';
    g.fillRect(16, 40, 64, 72);
    g.fillStyle = '#8a7560';
    for (let i = 0; i < 5; i++) g.fillRect(24 + i * 4, 48 + i * 12, 48 - i * 8, 6);
  });
  sheet.stairsUp = spriteSheet((g) => {
    g.fillStyle = '#3a342c';
    g.fillRect(16, 40, 64, 72);
    g.fillStyle = '#c4b09a';
    for (let i = 0; i < 5; i++) g.fillRect(24 + (4 - i) * 4, 48 + i * 12, 16 + i * 8, 6);
  });
  return sheet;
}

function sample(tex, tx, ty) {
  const x = tx & 63;
  const y = ty & 63;
  const i = (y * TEX + x) * 4;
  return [tex[i], tex[i + 1], tex[i + 2], tex[i + 3]];
}

function fog(r, g, b, dist, gleam, flick, side) {
  // A lantern falloff, not a black fog. Close stone should read as stone.
  let light = (0.5 + 0.9 / (1 + dist * 0.22)) * flick;
  if (gleam) light = Math.min(1.6, light * 1.2 + 0.1);
  if (side) light *= 0.8;
  r *= light * 1.05;
  g *= light;
  b *= light * 0.86;
  const reach = gleam ? 20 : 14;
  const t = Math.min(1, dist / reach);
  const f = t * t * 0.55;
  return [
    r * (1 - f) + 28 * f,
    g * (1 - f) + 20 * f,
    b * (1 - f) + 14 * f,
  ];
}

export function createView() {
  const tex = buildTextures();
  const sprites = buildSprites();
  let image = null;
  const zbuf = new Float32Array(1600);

  function draw(canvas, game, cam) {
    const cssW = canvas.clientWidth | 0;
    const cssH = canvas.clientHeight | 0;
    if (cssW < 16 || cssH < 16) return;
    const dpr = Math.min(1.25, window.devicePixelRatio || 1);
    let w = Math.max(320, Math.min(1280, Math.floor(cssW * dpr)));
    let h = Math.max(180, Math.min(800, Math.floor(cssH * dpr)));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    if (!image || image.width !== w || image.height !== h) image = new ImageData(w, h);
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
    const flick = 0.94 + Math.sin(game.time / 80) * 0.04 + Math.sin(game.time / 31) * 0.03;
    const tiles = game.floors[game.floor].tiles;
    const H = tiles.length;
    const W = tiles[0].length;
    const horizon = (h * 0.46) | 0;

    const rayX0 = dirX - planeX;
    const rayY0 = dirY - planeY;
    const rayX1 = dirX + planeX;
    const rayY1 = dirY + planeY;

    for (let y = 0; y < h; y++) {
      const above = y < horizon;
      const p = above ? (horizon - y) : (y - horizon);
      if (p < 1) {
        const row = y * w * 4;
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
      const row = y * w * 4;
      for (let x = 0; x < w; x++) {
        const tx = (floorX * TEX) & 63;
        const ty = (floorY * TEX) & 63;
        const s = sample(src, tx, ty);
        const cellX = floorX | 0;
        const cellY = floorY | 0;
        let rr = s[0];
        let gg = s[1];
        let bb = s[2];
        if (!above && cellX >= 0 && cellY >= 0 && cellX < W && cellY < H) {
          const t = tiles[cellY][cellX];
          if (t === 4 || t === 5) { rr *= 0.55; gg *= 0.5; bb *= 0.45; }
        }
        const c = fog(rr, gg, bb, rowDistance, gleam, flick * (above ? 0.55 : 1), false);
        const i = row + x * 4;
        data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
        floorX += stepX;
        floorY += stepY;
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
      let drawStart = ((h - lineH) / 2 + (h * 0.46 - h / 2)) | 0;
      let drawEnd = drawStart + lineH;
      if (drawStart < 0) drawStart = 0;
      if (drawEnd > h) drawEnd = h;
      let wallX = side === 0 ? py + dist * rayDirY : px + dist * rayDirX;
      wallX -= Math.floor(wallX);
      let texPick = tex.stone;
      if (tile === 2) texPick = tex.door;
      else if (tile === 3) texPick = tex.gate;
      else if (((mapX * 3 + mapY * 5) & 7) === 0) texPick = tex.moss;
      const tx = (wallX * TEX) & 63;
      for (let y = drawStart; y < drawEnd; y++) {
        const ty = (((y - ((h - lineH) / 2 + (h * 0.46 - h / 2))) * TEX) / lineH) & 63;
        const s = sample(texPick, tx, ty);
        const c = fog(s[0], s[1], s[2], dist, gleam, flick, side === 1);
        const i = (y * w + x) * 4;
        data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
      }
    }

    const list = [];
    const floor = game.floors[game.floor];
    for (const e of floor.entities) {
      if (e.taken) continue;
      if (e.kind === 'monster' && !e.alive) continue;
      if (e.kind === 'chest' && e.opened) {
        list.push({ x: e.x + 0.5, y: e.y + 0.5, sub: 'chestOpen', scale: 0.5 });
        continue;
      }
      const sub = e.kind === 'monster' ? e.sub : e.kind === 'potion' ? 'potion' : e.kind;
      const scale = {
        crawler: 0.72, spitter: 1, brute: 1.15, wisp: 0.85, warden: 1.5,
        moth: 0.7, hound: 0.95, chanter: 1.05, knight: 1.25, seal: 1.65,
        chest: 0.55, key: 0.4, potion: 0.36, lever: 0.7,
      }[sub] || 0.6;
      const bob = (e.sub === 'wisp' || e.sub === 'moth') ? Math.sin(game.time / 180 + e.x) * 0.08 : 0;
      list.push({ x: e.x + 0.5, y: e.y + 0.5 + bob, sub, scale });
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = tiles[y][x];
        if (t === 5) list.push({ x: x + 0.5, y: y + 0.5, sub: 'stairsDown', scale: 0.55 });
        else if (t === 4) list.push({ x: x + 0.5, y: y + 0.5, sub: 'stairsUp', scale: 0.55 });
      }
    }
    const invDet = 1 / (planeX * dirY - dirX * planeY);
    list.sort((a, b) => {
      const da = (a.x - px) * (a.x - px) + (a.y - py) * (a.y - py);
      const db = (b.x - px) * (b.x - px) + (b.y - py) * (b.y - py);
      return db - da;
    });
    for (const sp of list) {
      const sheet = sprites[sp.sub];
      if (!sheet) continue;
      const sx = sp.x - px;
      const sy = sp.y - py;
      const transX = invDet * (dirY * sx - dirX * sy);
      const transY = invDet * (-planeY * sx + planeX * sy);
      if (transY < 0.12) continue;
      const screenX = ((w / 2) * (1 + transX / transY)) | 0;
      const spriteH = Math.abs(h / transY) * sp.scale;
      const spriteW = spriteH * (96 / 128);
      const y0 = ((h - spriteH) / 2 + h * 0.1) | 0;
      const x0 = (screenX - spriteW / 2) | 0;
      const x1 = (x0 + spriteW) | 0;
      for (let stripe = x0; stripe < x1; stripe++) {
        if (stripe < 0 || stripe >= w) continue;
        if (transY >= zbuf[stripe]) continue;
        const tx = (((stripe - x0) * 96) / spriteW) | 0;
        if (tx < 0 || tx >= 96) continue;
        for (let y = Math.max(0, y0); y < Math.min(h, y0 + spriteH); y++) {
          const ty = (((y - y0) * 128) / spriteH) | 0;
          if (ty < 0 || ty >= 128) continue;
          const si = (ty * 96 + tx) * 4;
          const a = sheet[si + 3];
          if (a < 20) continue;
          const c = fog(sheet[si], sheet[si + 1], sheet[si + 2], transY, gleam, flick, false);
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
    const glow = ctx.createRadialGradient(w * 0.5, h * 0.92, 10, w * 0.5, h * 0.95, w * 0.45);
    glow.addColorStop(0, 'rgba(227, 146, 74, 0.18)');
    glow.addColorStop(1, 'rgba(227, 146, 74, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.7);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  function drawMap(canvas, game) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#120f0c';
    ctx.fillRect(0, 0, w, h);
    if (!game) return;
    const map = 33;
    const cell = Math.floor(Math.min(w, h) / map);
    const ox = ((w - cell * map) / 2) | 0;
    const oy = ((h - cell * map) / 2) | 0;
    const tiles = game.floors[game.floor].tiles;
    for (let y = 0; y < map; y++) {
      for (let x = 0; x < map; x++) {
        if (!game.explored.has(game.floor + ':' + x + ',' + y)) continue;
        const t = tiles[y][x];
        let color = '#3a332c';
        if (t === 0) color = '#1a1613';
        else if (t === 2) color = '#8a4038';
        else if (t === 7) color = '#6a5344';
        else if (t === 3) color = '#6a7270';
        else if (t === 6) color = '#3e4a44';
        else if (t === 4 || t === 5) color = '#e7a15a';
        ctx.fillStyle = color;
        ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell);
      }
    }
    const floor = game.floors[game.floor];
    ctx.fillStyle = '#d15a48';
    for (const e of floor.entities) {
      if (e.kind !== 'monster' || !e.alive) continue;
      const key = game.floor + ':' + e.x + ',' + e.y;
      if (!game.explored.has(key)) continue;
      const near = (e.x - game.x) * (e.x - game.x) + (e.y - game.y) * (e.y - game.y) <= 36;
      if (!near) continue;
      ctx.fillRect(ox + e.x * cell, oy + e.y * cell, cell, cell);
    }
    const cx = ox + (game.x + 0.5) * cell;
    const cy = oy + (game.y + 0.5) * cell;
    const ang = game.facing * Math.PI / 2;
    ctx.fillStyle = '#f3eadc';
    ctx.beginPath();
    ctx.moveTo(cx + Math.sin(ang) * cell * 0.9, cy - Math.cos(ang) * cell * 0.9);
    ctx.lineTo(cx + Math.sin(ang + 2.4) * cell * 0.55, cy - Math.cos(ang + 2.4) * cell * 0.55);
    ctx.lineTo(cx + Math.sin(ang - 2.4) * cell * 0.55, cy - Math.cos(ang - 2.4) * cell * 0.55);
    ctx.closePath();
    ctx.fill();
  }

  return { draw, drawMap };
}
