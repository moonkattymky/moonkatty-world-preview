import * as THREE from 'three';
import { G, quatFromDir } from './builder.js';
import { groundAt, REGIONS, sd } from './terrain.js';
import { C, rocket, dome } from './base.js';
import { fbm } from './noise.js';
const PI = Math.PI;

function lattice(b, x, y, z, w, h, levels) {
  const sh = h / levels;
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) b.add('ivory', G.box(0.7, h, 0.7), { pos: [x + sx * w / 2, y + h / 2, z + sz * w / 2], color: C.ivory2 });
  for (let i = 1; i <= levels; i++) {
    const yy = y + i * sh;
    for (const [px, pz, ry] of [[0, w / 2, 0], [0, -w / 2, 0], [w / 2, 0, PI / 2], [-w / 2, 0, PI / 2]]) b.add('gold', G.box(w, 0.4, 0.4), { pos: [x + px, yy, z + pz], rot: [0, ry, 0], color: C.goldD });
    if (i % 2) for (const [px, pz, ry] of [[0, w / 2, 0], [0, -w / 2, 0], [w / 2, 0, PI / 2], [-w / 2, 0, PI / 2]]) b.add('ivory', G.box(Math.hypot(w, sh), 0.25, 0.25), { pos: [x + px, yy - sh / 2, z + pz], rot: [0, ry, Math.atan2(sh, w) * (i % 4 === 1 ? 1 : -1)], order: 'YXZ', color: C.ivory2 });
    if (i % 3 === 0) for (const [sx, sz] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) b.add('glow', G.octa(0.35), { pos: [x + sx * w / 2, yy + 0.5, z + sz * w / 2], color: i === levels ? '#ff5533' : C.win, intensity: 5 });
  }
}

function launchComplex(b, beams) {
  const { x, z } = REGIONS.launch; const y = groundAt(x, z);
  b.add('dark', G.cyl(26, 28, 1.2, 8), { pos: [x, y - 0.5, z], color: '#3a4250' });
  b.add('ivory', G.cyl(24, 25, 1.2, 8), { pos: [x, y + 0.2, z], color: C.ivory2 });
  b.add('gold', G.torus(24.6, 0.4, 4, 8), { pos: [x, y + 1.4, z], rot: [PI / 2, 0, PI / 8], color: C.gold });
  rocket(b, x, y + 1.4, z, 3.3, -0.8);
  lattice(b, x + 14, y + 1.4, z - 6, 6, 74, 18);
  for (const yy of [20, 38, 52]) b.add('gold', G.box(9, 1, 1.2), { pos: [x + 9, y + yy, z - 4], rot: [0, 0.4, 0], color: C.goldD });
  // service buildings
  for (let i = 0; i < 5; i++) { const a = -0.6 + i * 0.5; const px = x + Math.cos(a) * 46, pz = z + Math.sin(a) * 46; const yy = groundAt(px, pz); b.add('ivory', G.box(12, 6 + i % 2 * 3, 9), { pos: [px, yy + 3, pz], rot: [0, -a, 0], color: C.ivory }); b.add('gold', G.box(12.4, 0.5, 9.4), { pos: [px, yy + 6.2 + i % 2 * 3, pz], rot: [0, -a, 0], color: C.gold }); for (let k = 0; k < 4; k++) b.add('glow', G.box(1.6, 1.0, 9.5), { pos: [px + Math.cos(-a) * (k * 2.6 - 4), yy + 3.5, pz - Math.sin(-a) * (k * 2.6 - 4)], rot: [0, -a, 0], color: C.win, intensity: 2.2 }); }
  for (let i = 0; i < 3; i++) { const p = { x: x - 40 + i * 14, z: z + 40 }; const yy = groundAt(p.x, p.z); b.add('ivory', G.cyl(5, 5, 14, 16, true).rotateZ(PI / 2).translate(0, 0, 0), { pos: [p.x, yy, p.z], scale: [1, 1, 1], color: C.ivory }); }
}

function reactorCrater(b, beams) {
  const { x, z } = REGIONS.reactor; const y = groundAt(x, z);
  b.add('glow', G.disc(26, 24), { pos: [x, y + 0.8, z], color: (px, py, pz) => { const t = Math.hypot(px - x, pz - z) / 26; return [6 - 3 * t, 2.4 - 1.3 * t, 0.4]; } });
  beams.push({ x, y: y, z, r: 24, h: 90, color: '#ff8a30', I: 0.55 });
  beams.push({ x, y: y, z, r: 9, h: 160, color: '#ffb050', I: 0.6 });
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * PI * 2; const rr = 92; const px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr; const yy = groundAt(px, pz);
    b.add('ivory', G.box(9, 5, 7), { pos: [px, yy + 2, pz], rot: [0, -a, 0], color: C.ivory });
    b.add('gold', G.box(9.3, 0.5, 7.3), { pos: [px, yy + 4.6, pz], rot: [0, -a, 0], color: C.gold });
    b.add('glow', G.box(7, 1.0, 7.4), { pos: [px, yy + 2.5, pz], rot: [0, -a, 0], color: C.winHot, intensity: 2.5 });
    if (i % 2 === 0) { // pipe down into the crater
      const p0 = new THREE.Vector3(px, yy + 1.5, pz), p1 = new THREE.Vector3(x + Math.cos(a) * 34, y + 6, z + Math.sin(a) * 34); const dv = p1.clone().sub(p0); const L = dv.length();
      b.add('gold', G.cyl(0.8, 0.8, L, 8), { pos: p0.toArray(), quat: quatFromDir(dv), color: C.goldD });
    }
  }
}

function canyon(b, beams) {
  const pts = [[-420, -250], [-470, -120], [-520, 0], [-560, 120], [-610, 260]];
  for (const [px, pz] of pts) { const yy = groundAt(px, pz); beams.push({ x: px, y: yy, z: pz, r: 1.2, h: 50, color: '#3fe0d0', I: 0.32 }); b.add('glow', G.disc(3, 12), { pos: [px, yy + 0.3, pz], color: C.cyan, intensity: 3 }); }
  // crashed lander on the rim
  const L = { x: -455, z: 160 }; const yy = groundAt(L.x, L.z);
  b.add('ivory', G.cyl(4, 5.5, 5, 8), { pos: [L.x, yy, L.z], rot: [0.25, 0.4, 0.15], color: C.ivory });
  b.add('gold', G.cap(4, 12, 4), { pos: [L.x + 1.2, yy + 4.8, L.z + 1], rot: [0.25, 0.4, 0.15], color: C.gold });
  for (let k = 0; k < 4; k++) { const a = k * PI / 2 + 0.4; b.add('gold', G.box(0.5, 6, 0.5), { pos: [L.x + Math.cos(a) * 5, yy + 1.5, L.z + Math.sin(a) * 5], rot: [0.5 * Math.sin(a), 0, 0.5 * Math.cos(a)], color: C.goldD }); }
}

function echo(b, beams) {
  const { x, z } = REGIONS.echo; const y = groundAt(x, z);
  b.add('dark', G.cyl(16, 17, 1, 32), { pos: [x, y - 0.4, z], color: '#2c3644' });
  b.add('glow', G.ring(9, 10, 40), { pos: [x, y + 0.65, z], color: C.cyan, intensity: 3 });
  beams.push({ x, y: y + 0.6, z, r: 4, h: 130, color: '#40e0e0', I: 1.0 });
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * PI * 2; const rr = i % 2 ? 34 : 24; const px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr; const yy = groundAt(px, pz); const h = 16 + (i % 3) * 7;
    b.add('ivory', G.cyl(0.6, 1.4, h, 8), { pos: [px, yy, pz], color: C.ivory });
    b.add('gold', G.torus(1.2, 0.18, 4, 10), { pos: [px, yy + h * 0.3, pz], rot: [PI / 2, 0, 0], color: C.gold });
    b.add('glow', G.octa(1.1), { pos: [px, yy + h + 1.2, pz], scale: [1, 1.6, 1], color: C.cyan, intensity: 5 });
    beams.push({ x: px, y: yy + h, z: pz, r: 0.6, h: 60 + (i % 3) * 25, color: '#50e0e8', I: 1.0 });
  }
}

function rover(b, x, z, yaw) {
  const y = groundAt(x, z) + 0.6;
  const off = (dx, dy, dz) => [x + Math.cos(yaw) * dx + Math.sin(yaw) * dz, y + dy, z - Math.sin(yaw) * dx + Math.cos(yaw) * dz];
  b.add('ivory', G.box(2.4, 1.1, 4.2), { pos: off(0, 0.9, 0), rot: [0, yaw, 0], color: C.ivory });
  b.add('gold', G.box(2.5, 0.25, 4.3), { pos: off(0, 0.45, 0), rot: [0, yaw, 0], color: C.gold });
  b.add('glow', G.box(2.0, 0.45, 0.1), { pos: off(0, 1.1, 2.12), rot: [0, yaw, 0], color: C.win, intensity: 2.5 });
  b.add('ivory', G.box(1.8, 0.7, 1.6), { pos: off(0, 1.8, -0.8), rot: [0, yaw, 0], color: C.ivory2 });
  for (const dz of [-1.4, 0, 1.4]) for (const dx of [-1.35, 1.35]) b.add('dark', G.cyl(0.5, 0.5, 0.45, 10).rotateZ(PI / 2).translate(0, 0, 0), { pos: off(dx, 0.0, dz), rot: [0, yaw, 0], color: '#3a3f48' });
  b.add('gold', G.cyl(0.04, 0.04, 1.6, 4), { pos: off(0.6, 2.1, -1.2), color: C.gold });
}

// Glowing gold-lit roads from the hub toward each chapter region (as on the world map)
function roads(b) {
  const targets = [REGIONS.canyon, REGIONS.reactor, REGIONS.launch, REGIONS.echo].map(r => ({ x: r.x * 0.86, z: r.z * 0.86 }));
  for (const [ti, T] of targets.entries()) {
    const a0 = Math.atan2(T.z, T.x); const start = { x: Math.cos(a0) * 46, z: Math.sin(a0) * 46 };
    const len = Math.hypot(T.x - start.x, T.z - start.z); const n = Math.ceil(len / 5);
    const P = [];
    for (let i = 0; i <= n; i++) { const t = i / n; const nx = -(T.z - start.z) / len, nz = (T.x - start.x) / len; const w = fbm(t * 3 + ti * 7, ti * 3.3, 2) * 40 * Math.sin(PI * t); P.push({ x: start.x + (T.x - start.x) * t + nx * w, z: start.z + (T.z - start.z) * t + nz * w }); }
    const strip = (offset, width, lift, group, color, I) => {
      const pos = []; const col = new THREE.Color(color);
      for (let i = 0; i < P.length - 1; i++) {
        const A = P[i], B = P[i + 1]; const dx = B.x - A.x, dz = B.z - A.z, l = Math.hypot(dx, dz); const nx = -dz / l, nz = dx / l;
        const q = (p, o) => { const px = p.x + nx * o, pz = p.z + nz * o; return [px, groundAt(px, pz) + lift + Math.min(0.6, Math.hypot(px, pz) / 1500), pz]; };
        const a1 = q(A, offset - width / 2), a2 = q(A, offset + width / 2), b1 = q(B, offset - width / 2), b2 = q(B, offset + width / 2);
        pos.push(...a1, ...b1, ...a2, ...a2, ...b1, ...b2);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
      b.add(group, g, { color, intensity: I });
    };
    strip(0, 5, 0.06, 'dark', '#4a4d55', 1);
    strip(-2.4, 0.22, 0.12, 'glow', C.gold2, 2.2);
    strip(2.4, 0.22, 0.12, 'glow', C.gold2, 2.2);
  }
}

export function buildWorld(b, beams) {
  launchComplex(b, beams); reactorCrater(b, beams); canyon(b, beams); echo(b, beams); roads(b);
  const r1 = sd(-30, 2); rover(b, r1.x, r1.z, 1.2);
  rover(b, -300, 60, 0.4);
  const r3 = sd(28, -2); rover(b, r3.x, r3.z, -0.6);
}
