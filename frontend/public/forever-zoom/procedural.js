/** Procedural infinite-zoom fallback (no AI credits). */
(function (global) {
  const THEMES = [
    { id: "desk", hues: [28, 35, 210], sat: 0.35, bright: 0.45, grain: 0.18, mode: "wood" },
    { id: "fields", hues: [95, 55, 140], sat: 0.55, bright: 0.5, grain: 0.12, mode: "fields" },
    { id: "plants", hues: [130, 150, 80], sat: 0.6, bright: 0.42, grain: 0.2, mode: "leaves" },
    { id: "cells", hues: [160, 190, 280], sat: 0.65, bright: 0.35, grain: 0.15, mode: "cells" },
    { id: "cosmos", hues: [260, 300, 200], sat: 0.7, bright: 0.25, grain: 0.08, mode: "stars" },
  ];

  function hash(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }
  function noise2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = hash(xi * 374761 + yi * 668265);
    const b = hash((xi + 1) * 374761 + yi * 668265);
    const c = hash(xi * 374761 + (yi + 1) * 668265);
    const d = hash((xi + 1) * 374761 + (yi + 1) * 668265);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, oct = 5) {
    let a = 0, amp = 0.5, f = 1;
    for (let i = 0; i < oct; i++) {
      a += amp * noise2(x * f, y * f);
      f *= 2; amp *= 0.5;
    }
    return a;
  }
  function hsl(h, s, l) {
    h = ((h % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    return [
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255),
    ];
  }

  function render(canvas, themeIndex, seed, zoomFocus) {
    const theme = THEMES[themeIndex % THEMES.length];
    const w = canvas.width, h = canvas.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const img = ctx.createImageData(w, h);
    const data = img.data;
    const fx = (zoomFocus && zoomFocus.x) || 0.5;
    const fy = (zoomFocus && zoomFocus.y) || 0.5;
    const s = seed || 1;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const nx = (x / w - fx) * 3 + fx * 2;
        const ny = (y / h - fy) * 3 + fy * 2;
        let v = 0, hue = theme.hues[0], sat = theme.sat, lit = theme.bright;

        if (theme.mode === "wood") {
          const grain = fbm(nx * 2 + s, ny * 14 + s * 0.3, 4);
          const knot = fbm(nx * 6 + 20, ny * 6 + 10, 3);
          v = grain * 0.75 + knot * 0.25;
          hue = theme.hues[0] + v * 18;
          lit = 0.28 + v * 0.35;
          // notebook
          if (nx > 0.28 && nx < 0.52 && ny > 0.32 && ny < 0.62) {
            hue = 210; sat = 0.22; lit = 0.62 + noise2(nx * 50, ny * 50) * 0.08;
            if ((ny * 40) % 1 < 0.12) lit *= 0.85;
          }
          // mug
          const mdx = nx - 0.68, mdy = ny - 0.42;
          if (mdx * mdx + mdy * mdy * 1.4 < 0.012) {
            hue = 25; sat = 0.55; lit = 0.45 + noise2(nx * 30, ny * 30) * 0.1;
          }
          // pencil
          if (Math.abs(ny - (0.7 + (nx - 0.2) * 0.08)) < 0.012 && nx > 0.2 && nx < 0.75) {
            hue = 48; sat = 0.7; lit = 0.55;
          }
        } else if (theme.mode === "fields") {
          const ridges = Math.sin((nx + fbm(nx, ny, 3)) * 18) * 0.5 + 0.5;
          v = fbm(nx * 1.5, ny * 1.5, 5) * 0.7 + ridges * 0.3;
          hue = theme.hues[Math.floor(v * 3) % 3];
          lit = 0.35 + v * 0.4;
        } else if (theme.mode === "leaves") {
          const veins = Math.abs(Math.sin((nx + ny) * 22 + fbm(nx * 3, ny * 3) * 4));
          v = fbm(nx * 4, ny * 4, 5);
          hue = theme.hues[v > 0.55 ? 1 : 0];
          lit = 0.25 + v * 0.45 - veins * 0.08;
          sat = 0.45 + veins * 0.3;
        } else if (theme.mode === "cells") {
          const cx = Math.floor(nx * 8), cy = Math.floor(ny * 8);
          const cell = hash(cx * 913 + cy * 457 + s * 17);
          const lx = nx * 8 - cx - 0.5, ly = ny * 8 - cy - 0.5;
          const d = Math.sqrt(lx * lx + ly * ly);
          v = 1 - Math.min(1, d * 2.2);
          hue = theme.hues[Math.floor(cell * 3)];
          lit = 0.15 + v * 0.55 + cell * 0.1;
          sat = 0.55 + v * 0.3;
        } else {
          const neb = fbm(nx * 1.2 + s, ny * 1.2, 6);
          const star = hash(Math.floor(nx * 180) * 918 + Math.floor(ny * 180) * 331 + s);
          v = neb;
          hue = theme.hues[Math.floor(neb * 3) % 3];
          lit = 0.08 + neb * 0.35;
          if (star > 0.992) lit = 0.95;
        }

        const g = theme.grain * (hash(x * 12.9898 + y * 78.233 + s) - 0.5);
        lit = Math.max(0, Math.min(1, lit + g));
        const [r, gch, b] = hsl(hue, sat, lit);
        const i = (y * w + x) * 4;
        data[i] = r; data[i + 1] = gch; data[i + 2] = b; data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return { theme, themeIndex: themeIndex % THEMES.length };
  }

  global.ProceduralZoom = { THEMES, render };
})(window);
