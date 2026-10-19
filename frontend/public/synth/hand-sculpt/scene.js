// A small WebGL view of the orb field and the hand skeleton.
// Column-major 4x4 matrices, one lit sphere, additive glow, and line bones.

import { HAND_BONES } from './hands.js';

function mul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return o;
}

function perspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2);
  const o = new Float32Array(16);
  o[0] = f / aspect;
  o[5] = f;
  o[10] = (far + near) / (near - far);
  o[11] = -1;
  o[14] = (2 * far * near) / (near - far);
  return o;
}

function lookAt(eye, target, up) {
  const zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
  let zl = Math.hypot(zx, zy, zz) || 1;
  const fz = [zx / zl, zy / zl, zz / zl];
  let xx = up[1] * fz[2] - up[2] * fz[1];
  let xy = up[2] * fz[0] - up[0] * fz[2];
  let xz = up[0] * fz[1] - up[1] * fz[0];
  let xl = Math.hypot(xx, xy, xz) || 1;
  xx /= xl; xy /= xl; xz /= xl;
  const yx = fz[1] * xz - fz[2] * xy;
  const yy = fz[2] * xx - fz[0] * xz;
  const yz = fz[0] * xy - fz[1] * xx;
  const o = new Float32Array(16);
  o[0] = xx; o[1] = yx; o[2] = fz[0];
  o[4] = xy; o[5] = yy; o[6] = fz[1];
  o[8] = xz; o[9] = yz; o[10] = fz[2];
  o[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  o[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  o[14] = -(fz[0] * eye[0] + fz[1] * eye[1] + fz[2] * eye[2]);
  o[15] = 1;
  return o;
}

function modelOf(x, y, z, s) {
  const o = new Float32Array(16);
  o[0] = s; o[5] = s; o[10] = s; o[15] = 1;
  o[12] = x; o[13] = y; o[14] = z;
  return o;
}

function sphereMesh(stacks, slices) {
  const pos = [];
  const idx = [];
  for (let i = 0; i <= stacks; i++) {
    const phi = (i / stacks) * Math.PI;
    for (let j = 0; j <= slices; j++) {
      const theta = (j / slices) * Math.PI * 2;
      pos.push(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));
    }
  }
  const row = slices + 1;
  for (let i = 0; i < stacks; i++) {
    for (let j = 0; j < slices; j++) {
      const a = i * row + j;
      idx.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
    }
  }
  return { pos: new Float32Array(pos), idx: new Uint16Array(idx) };
}

const VERT = `
attribute vec3 aPos;
uniform mat4 uMVP;
varying vec3 vN;
void main() {
  vN = aPos;
  gl_Position = uMVP * vec4(aPos, 1.0);
}
`;

const FRAG = `
precision mediump float;
varying vec3 vN;
uniform vec3 uColor;
uniform float uAlpha;
uniform float uGlow;
void main() {
  vec3 n = normalize(vN);
  float lambert = clamp(dot(n, normalize(vec3(0.35, 0.7, 0.6))), 0.0, 1.0);
  float rim = pow(1.0 - clamp(dot(n, vec3(0.0, 0.15, 1.0)), 0.0, 1.0), 1.6);
  vec3 col = uColor * (0.16 + 0.9 * lambert) + uColor * rim * (0.45 + uGlow);
  gl_FragColor = vec4(col, uAlpha);
}
`;

const LINE_VERT = `
attribute vec3 aPos;
uniform mat4 uMVP;
uniform float uPoint;
void main() {
  gl_Position = uMVP * vec4(aPos, 1.0);
  gl_PointSize = uPoint;
}
`;

const LINE_FRAG = `
precision mediump float;
uniform vec3 uColor;
uniform float uAlpha;
void main() {
  gl_FragColor = vec4(uColor, uAlpha);
}
`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(log || 'shader');
  }
  return sh;
}

function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link');
  return p;
}

function gridLines() {
  const lines = [];
  const y = -1.15;
  for (let i = -4; i <= 4; i++) {
    const x = i * 0.45;
    lines.push(-1.8, y, x, 1.8, y, x);
    lines.push(x, y, -1.8, x, y, 1.8);
  }
  return new Float32Array(lines);
}

export function createScene(canvas) {
  const gl = canvas.getContext('webgl', { antialias: true, alpha: false, premultipliedAlpha: false });
  if (!gl) return { ok: false, error: 'webgl' };
  let prog, lineProg, mesh, grid, sphereBuf, sphereIdx, lineBuf, view, proj;
  try {
    prog = program(gl, VERT, FRAG);
    lineProg = program(gl, LINE_VERT, LINE_FRAG);
    mesh = sphereMesh(14, 18);
    sphereBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereBuf);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.pos, gl.STATIC_DRAW);
    sphereIdx = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereIdx);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.idx, gl.STATIC_DRAW);
    grid = gridLines();
    lineBuf = gl.createBuffer();
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }

  const eye = [0, 0.35, 3.35];
  view = lookAt(eye, [0, 0.05, 0], [0, 1, 0]);

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(2, canvas.clientWidth);
    const h = Math.max(2, canvas.clientHeight);
    const W = Math.floor(w * dpr);
    const H = Math.floor(h * dpr);
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
    proj = perspective(0.82, W / H, 0.08, 30);
  }

  function drawSphere(mvp, color, alpha, glow) {
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereBuf);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
    gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'uMVP'), false, mvp);
    gl.uniform3fv(gl.getUniformLocation(prog, 'uColor'), color);
    gl.uniform1f(gl.getUniformLocation(prog, 'uAlpha'), alpha);
    gl.uniform1f(gl.getUniformLocation(prog, 'uGlow'), glow);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereIdx);
    gl.drawElements(gl.TRIANGLES, mesh.idx.length, gl.UNSIGNED_SHORT, 0);
  }

  function drawLines(mvp, data, color, alpha, mode, pointSize) {
    gl.useProgram(lineProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    const loc = gl.getAttribLocation(lineProg, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
    gl.uniformMatrix4fv(gl.getUniformLocation(lineProg, 'uMVP'), false, mvp);
    gl.uniform3fv(gl.getUniformLocation(lineProg, 'uColor'), color);
    gl.uniform1f(gl.getUniformLocation(lineProg, 'uAlpha'), alpha);
    gl.uniform1f(gl.getUniformLocation(lineProg, 'uPoint'), pointSize || 1);
    gl.drawArrays(mode, 0, data.length / 3);
  }

  function project(x, y, z) {
    const vp = mul(proj, view);
    const cx = vp[0] * x + vp[4] * y + vp[8] * z + vp[12];
    const cy = vp[1] * x + vp[5] * y + vp[9] * z + vp[13];
    const cw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
    if (!cw) return null;
    return {
      x: (cx / cw * 0.5 + 0.5) * canvas.clientWidth,
      y: (1 - (cy / cw * 0.5 + 0.5)) * canvas.clientHeight,
    };
  }

  function frame({ orbs, hands, particles, time }) {
    resize();
    const vp = mul(proj, view);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.031, 0.031, 0.031, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    drawLines(vp, grid, [0.45, 0.28, 0.12], 0.18, gl.LINES, 1);

    const labels = [];
    for (let i = 0; i < orbs.length; i++) {
      const o = orbs[i];
      const bob = o.grabbed ? 0 : Math.sin(time * 0.8 + i) * 0.025;
      const s = (o.kind === 'grain' ? 0.11 : 0.15) * (o.grabbed ? 1.18 : 1);
      const model = modelOf(o.x, o.y + bob, o.z, s);
      const mvp = mul(vp, model);
      const glow = o.grabbed ? 1.2 : 0.35 + o.spread * 0.8;
      gl.depthMask(false);
      const shell = modelOf(o.x, o.y + bob, o.z, s * (1.85 + o.spread * 0.8));
      drawSphere(mul(vp, shell), o.color, 0.09 + o.spread * 0.08, glow);
      gl.depthMask(true);
      drawSphere(mvp, o.color, 0.92, glow);
      const at = project(o.x, o.y + bob + s * 1.6, o.z);
      if (at) labels.push({ id: o.id, name: o.name, x: at.x, y: at.y, grabbed: o.grabbed });
    }

    for (let h = 0; h < hands.length; h++) {
      const pts = hands[h];
      if (!pts || pts.length < 21) continue;
      const data = new Float32Array(HAND_BONES.length * 6);
      let n = 0;
      for (let b = 0; b < HAND_BONES.length; b++) {
        const a = pts[HAND_BONES[b][0]];
        const c = pts[HAND_BONES[b][1]];
        data[n++] = a.x; data[n++] = a.y; data[n++] = a.z;
        data[n++] = c.x; data[n++] = c.y; data[n++] = c.z;
      }
      const joints = new Float32Array(21 * 3);
      for (let i = 0; i < 21; i++) {
        joints[i * 3] = pts[i].x;
        joints[i * 3 + 1] = pts[i].y;
        joints[i * 3 + 2] = pts[i].z;
      }
      const col = h === 0 ? [1.0, 0.78, 0.45] : [0.55, 1.0, 0.75];
      gl.depthMask(false);
      drawLines(vp, data, col, 0.9, gl.LINES, 1);
      drawLines(vp, joints, col, 1, gl.POINTS, 7);
      gl.depthMask(true);
    }

    if (particles && particles.length) {
      const data = new Float32Array(particles.length * 3);
      for (let i = 0; i < particles.length; i++) {
        data[i * 3] = particles[i].x;
        data[i * 3 + 1] = particles[i].y;
        data[i * 3 + 2] = particles[i].z;
      }
      gl.depthMask(false);
      drawLines(vp, data, [1.0, 0.82, 0.45], 0.85, gl.POINTS, 4);
      gl.depthMask(true);
    }
    return labels;
  }

  resize();
  return { ok: true, gl, frame, resize, project };
}
