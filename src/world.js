import * as THREE from 'three';
import { G, quatFromDir } from './builder.js';
import { groundAt, REGIONS, sd } from './terrain.js';
import { C, rocket, dome } from './base.js';
import { fbm } from './noise.js';
const PI = Math.PI;

function lattice(b, x, y, z, w, h, levels) {
  const sh = h / levels;
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) b.add('ivory', G.box(0.7, h, 0.7), { pos: [x + sx * w / 2, y + h / 2, z + sz * w / 2], color: C.ivory2 });
  for (let i = 0; i < levels; i++) {
    const yy = y + (i + 0.5) * sh;
    for (const [px, pz, ry] of [[0, w / 2, 0], [0, -w / 2, PI], [w / 2, 0, PI / 2], [-w / 2, 0, -PI / 2]]) b.add('lattice', new THREE.PlaneGeometry(w, sh), { pos: [x + px, yy, z + pz], rot: [0, ry, 0], color: i % 4 === 3 ? C.gold : '#ffffff' });
    if (i % 3 === 2) { b.add('gold', G.box(w + 0.9, 0.45, w + 0.9), { pos: [x, yy + sh / 2, z], color: C.goldD }); for (const [sx, sz] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) b.add('glow', G.octa(0.35), { pos: [x + sx * w / 2, yy + sh / 2 + 0.5, z + sz * w / 2], color: i >= levels - 2 ? '#ff5533' : C.win, intensity: 5 }); }
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
  for (let i = 0; i < 5; i++) { const a = -0.6 + i * 0.5; const px = x + Math.cos(a) * 46, pz = z + Math.sin(a) * 46; const yy = groundAt(px, pz); b.add('tex', G.box(12, 6 + i % 2 * 3, 9), { region: 'panel', pos: [px, yy + 3, pz], rot: [0, -a, 0], color: '#ffffff' }); b.add('gold', G.box(12.4, 0.5, 9.4), { pos: [px, yy + 6.2 + i % 2 * 3, pz], rot: [0, -a, 0], color: C.gold }); for (let k = 0; k < 4; k++) b.add('glow', G.box(1.6, 1.0, 9.5), { pos: [px + Math.cos(-a) * (k * 2.6 - 4), yy + 3.5, pz - Math.sin(-a) * (k * 2.6 - 4)], rot: [0, -a, 0], color: C.win, intensity: 2.2 }); }
  for (let i = 0; i < 3; i++) { const p = { x: x - 40 + i * 14, z: z + 40 }; const yy = groundAt(p.x, p.z); b.add('ivory', G.cyl(5, 5, 14, 16).rotateZ(PI / 2).translate(0, 0, 0), { pos: [p.x, yy, p.z], scale: [1, 1, 1], color: C.ivory }); }
}

function reactorCrater(b, beams, bn, bf) { // pass 19: a real reactor complex on the crater floor (was a floating disc + floating pipes)
  const { x, z } = REGIONS.reactor; const y = groundAt(x, z);
  // far LOD (world/aerial maps): one simple drum + glowing pool
  bf.add('tex', G.cyl(20, 21, 8.7, 16), { region: 'reactorWall', pos: [x, y, z], color: '#ffffff' }); bf.add('glow', G.disc(12, 16), { pos: [x, y + 8.75, z], color: C.winHot, intensity: 4 });
  // stepped core drum on the flat floor
  bn.add('dark', G.cyl(25, 26.5, 1.2, 48), { pos: [x, y - 0.6, z], color: '#3a4250' });
  bn.add('gold', G.torus(25.6, 0.35, 4, 48), { pos: [x, y + 0.55, z], rot: [PI / 2, 0, 0], color: C.gold });
  bn.add('tex', G.cyl(20, 21, 4.2, 40, true), { region: 'reactorWall', pos: [x, y + 0.5, z], color: '#ffffff', ao: [y, y + 6] });
  bn.add('ivory', G.ring(14.5, 20.2, 40), { pos: [x, y + 4.7, z], color: C.ivory2 });
  bn.add('gold', G.torus(20.1, 0.4, 4, 40), { pos: [x, y + 4.7, z], rot: [PI / 2, 0, 0], color: C.gold });
  bn.add('tex', G.cyl(13.5, 14.5, 3.2, 36, true), { region: 'reactorWall', pos: [x, y + 4.7, z], color: '#ffffff', ao: [y + 4.5, y + 9] });
  bn.add('ivory', G.torus(13.6, 0.9, 5, 36), { pos: [x, y + 7.9, z], rot: [PI / 2, 0, 0], color: C.ivory });
  bn.add('gold', G.torus(12.7, 0.22, 4, 36), { pos: [x, y + 8.5, z], rot: [PI / 2, 0, 0], color: C.gold2 });
  // molten core pool + glowing pit wall
  bn.add('glow', G.cyl(12.6, 11.8, 2.2, 36, true), { pos: [x, y + 6.0, z], flip: true, color: (px, py) => { const t = THREE.MathUtils.clamp((py - y - 6.0) / 2.2, 0, 1); const k = 1.6 - 0.7 * t; return [k, k * 0.2, k * 0.02]; } });
  bn.add('glow', G.disc(11.9, 36), { pos: [x, y + 6.1, z], color: (px, py, pz) => { const t = Math.hypot(px - x, pz - z) / 12; return [5.5 - 2.5 * t, 2.2 - 1.2 * t, 0.35]; } });
  // buttress fins between the tiers + deck lights
  for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; bn.add('ivory', G.box(1.2, 3.6, 4.2), { pos: [x + Math.cos(a) * 18.6, y + 2.3, z + Math.sin(a) * 18.6], rot: [0, -a, 0], color: C.ivory });
    bn.add('glow', G.box(0.5, 0.25, 0.5), { pos: [x + Math.cos(a + 0.26) * 17.2, y + 4.9, z + Math.sin(a + 0.26) * 17.2], color: i % 2 ? C.winHot : C.win, intensity: 4 }); }
  beams.push({ x, y: y + 6, z, r: 11, h: 90, color: '#ff8a30', I: 0.5 });
  beams.push({ x, y: y + 6, z, r: 4.5, h: 170, color: '#ffb050', I: 0.6 });
  // cooling towers ringing the core (tapered ivory stacks, gold bands, glowing crowns)
  for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2 + 0.3; const px = x + Math.cos(a) * 33, pz = z + Math.sin(a) * 33; const yy = groundAt(px, pz) - 0.3;
    bn.add('ivory', G.cyl(3.0, 4.2, 8, 20), { pos: [px, yy, pz], color: C.ivory, ao: [yy, yy + 10] }); bn.add('ivory', G.cyl(3.5, 3.0, 6, 20, true), { pos: [px, yy + 8, pz], color: C.ivory2 }); bn.add('dark', G.cyl(3.3, 2.8, 5.9, 20, true), { pos: [px, yy + 8.05, pz], flip: true, color: '#2a2e36' });
    for (const hb of [3, 8, 13.6]) bn.add('gold', G.torus(hb < 8 ? 3.95 - hb * 0.12 : hb < 13 ? 3.05 : 3.52, 0.18, 3, 20), { pos: [px, yy + hb, pz], rot: [PI / 2, 0, 0], color: C.gold });
    bn.add('glow', G.ring(2.9, 3.4, 20), { pos: [px, yy + 14.05, pz], color: C.winHot, intensity: 3 }); bn.add('dark', G.disc(3.3, 20), { pos: [px, yy + 13.9, pz], color: '#1c2028' }); /* hollow-looking crown */
    bn.add('dark', G.box(1.4, 2.2, 0.2), { pos: [px + Math.cos(a + PI) * 4.05, yy + 1.1, pz + Math.sin(a + PI) * 4.05], rot: [0, -a + PI / 2, 0], color: '#2a3442' }); }
  // service road down the crater wall toward the hub (dark strip with gold edge lights) — leading line for the region shot
  { const ah = Math.atan2(-z, -x); const P = []; for (let k = 0; k <= 30; k++) { const t = k / 30; const rr = 120 - t * 96; const a = ah + Math.sin(t * PI * 1.5) * 0.28; P.push({ x: x + Math.cos(a) * rr, z: z + Math.sin(a) * rr }); }
    const strip = (off, w, lift, group, color, I) => { const pos = []; for (let k = 0; k < P.length - 1; k++) { const A = P[k], B = P[k + 1]; const dx = B.x - A.x, dz = B.z - A.z, l = Math.hypot(dx, dz), nx = -dz / l, nz = dx / l; const q = (p, o) => { const px = p.x + nx * o, pz = p.z + nz * o; return [px, groundAt(px, pz) + lift, pz]; }; const a1 = q(A, off - w / 2), a2 = q(A, off + w / 2), b1 = q(B, off - w / 2), b2 = q(B, off + w / 2); pos.push(...a1, ...b1, ...a2, ...a2, ...b1, ...b2); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); bn.add(group, g, { color, intensity: I }); };
    strip(0, 6, 0.12, 'dark', '#4a4d55', 1); strip(-2.9, 0.22, 0.2, 'glow', C.gold2, 2.2); strip(2.9, 0.22, 0.2, 'glow', C.gold2, 2.2);
    for (let k = 2; k < P.length; k += 3) for (const sgn of [-1, 1]) { const A = P[k], B = P[k - 1]; const dx = A.x - B.x, dz = A.z - B.z, l = Math.hypot(dx, dz); const px = A.x - dz / l * 3.6 * sgn, pz = A.z + dx / l * 3.6 * sgn; const yy = groundAt(px, pz); bn.add('ivory', G.cyl(0.12, 0.16, 2.2, 6), { pos: [px, yy, pz], color: C.ivory2 }); bn.add('glow', G.octa(0.22), { pos: [px, yy + 2.35, pz], color: C.win, intensity: 4 }); } }
  // rim stations + pipes that follow the crater wall down to the core (on short supports, not floating)
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * PI * 2; const rr = 92; const px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr; const yy = groundAt(px, pz);
    b.add('tex', G.box(9, 5, 7), { region: 'panel', pos: [px, yy + 2, pz], rot: [0, -a, 0], color: '#ffffff' });
    b.add('gold', G.box(9.3, 0.5, 7.3), { pos: [px, yy + 4.6, pz], rot: [0, -a, 0], color: C.gold });
    b.add('glow', G.box(7, 1.0, 7.4), { pos: [px, yy + 2.5, pz], rot: [0, -a, 0], color: C.winHot, intensity: 2.5 });
    if (i % 2 === 0) { const N = 22, pts = []; for (let k = 0; k <= N; k++) { const r2 = 88 - k * (88 - 21.5) / N; const qx = x + Math.cos(a) * r2, qz = z + Math.sin(a) * r2; const gy = Math.max(groundAt(qx, qz), groundAt(qx + 1.5, qz), groundAt(qx - 1.5, qz), groundAt(qx, qz + 1.5), groundAt(qx, qz - 1.5)); pts.push({ x: qx, z: qz, gy, y: gy + 1.3 }); }
      pts[N].y = y + 2.2; for (let it = 0; it < 4; it++) for (let k = 1; k < N; k++) pts[k].y = Math.max(pts[k].gy + 1.0, (pts[k - 1].y + pts[k].y * 2 + pts[k + 1].y) / 4); /* smooth run over the jagged wall, never below ground */
      for (let k = 1; k <= N; k++) { const p0 = new THREE.Vector3(pts[k - 1].x, pts[k - 1].y, pts[k - 1].z), p1 = new THREE.Vector3(pts[k].x, pts[k].y, pts[k].z); const dv = p1.clone().sub(p0); bn.add('gold', G.cyl(0.75, 0.75, dv.length(), 8), { pos: p0.toArray(), quat: quatFromDir(dv), color: C.goldD });
        if (k % 3 === 0 && k < N) { const q = pts[k]; bn.add('dark', G.box(0.5, q.y - q.gy + 0.6, 0.5), { pos: [q.x, (q.y + q.gy) / 2 - 0.3, q.z], color: '#3a4250' }); if (k % 6 === 0) bn.add('glow', G.box(0.4, 0.4, 0.4), { pos: [q.x, q.y + 1.0, q.z], color: C.win, intensity: 3.5 }); } } }
  }
}

function canyon(b, beams) {
  const pts = [[-420, -250], [-470, -120], [-520, 0], [-560, 120], [-610, 260]];
  for (const [px, pz] of pts) { const yy = groundAt(px, pz); beams.push({ x: px, y: yy, z: pz, r: 1.2, h: 12, color: '#3fe0d0', I: 0.18 }); b.add('glow', G.disc(3, 12), { pos: [px, yy + 0.3, pz], color: C.cyan, intensity: 3 }); }
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
  beams.push({ x, y: y + 0.6, z, r: 4, h: 26, color: '#40e0e0', I: 0.35 });
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * PI * 2; const rr = i % 2 ? 34 : 24; const px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr; const yy = groundAt(px, pz); const h = 16 + (i % 3) * 7;
    b.add('ivory', G.cyl(0.6, 1.4, h, 8), { pos: [px, yy, pz], color: C.ivory });
    b.add('gold', G.torus(1.2, 0.18, 4, 10), { pos: [px, yy + h * 0.3, pz], rot: [PI / 2, 0, 0], color: C.gold });
    b.add('glow', G.octa(1.1), { pos: [px, yy + h + 1.2, pz], scale: [1, 1.6, 1], color: C.cyan, intensity: 5 });
    beams.push({ x: px, y: yy + h, z: pz, r: 0.6, h: 10 + (i % 3) * 4, color: '#50e0e8', I: 0.4 });
  }
}

function rover(b, x, z, yaw) { // 6-wheel retro rover: rounded ivory cab with glowing windscreen, gold trim, rear cargo deck, antenna dish
  const y = groundAt(x, z) + 0.55;
  const off = (dx, dy, dz) => [x + Math.cos(yaw) * dx + Math.sin(yaw) * dz, y + dy, z - Math.sin(yaw) * dx + Math.cos(yaw) * dz];
  const R = [0, yaw, 0];
  b.add('dark', G.box(2.3, 0.35, 4.4), { pos: off(0, 0.35, 0), rot: R, color: '#4a505a' }); // chassis
  b.add('gold', G.box(2.42, 0.12, 4.5), { pos: off(0, 0.55, 0), rot: R, color: C.gold }); // trim line
  b.add('ivory', G.box(2.2, 0.55, 2.0), { pos: off(0, 0.85, -1.15), rot: R, color: C.ivory2 }); // cargo deck
  b.add('gold', G.box(2.24, 0.06, 2.04), { pos: off(0, 1.14, -1.15), rot: R, color: C.goldD });
  b.add('dark', G.box(1.7, 0.06, 1.5), { pos: off(0, 1.2, -1.2), rot: [-0.08, yaw, 0], color: '#1b3c5a' }); // solar deck
  b.add('ivory', new THREE.CylinderGeometry(1, 1, 2.3, 12, 1, false, -PI / 2, PI).rotateX(-PI / 2), { pos: off(0, 0.6, 1.05), rot: R, scale: [1.1, 0.85, 1], color: C.ivory }); // rounded cab (half cylinder, closed by end plates)
  b.add('ivory', new THREE.CircleGeometry(1, 12, 0, PI), { pos: off(0, 0.6, -0.1), rot: [0, yaw + PI, 0], scale: [1.1, 0.85, 1], color: C.ivory2 });
  b.add('dark', new THREE.CircleGeometry(1, 12, 0, PI), { pos: off(0, 0.6, 2.2), rot: R, scale: [1.1, 0.85, 1], color: '#2a3442' }); b.add('glow', new THREE.CircleGeometry(0.85, 12, 0.25, PI - 0.5), { pos: off(0, 0.62, 2.21), rot: R, scale: [1.1, 0.8, 1], color: C.win, intensity: 2.2 }); b.add('gold', G.torus(1.0, 0.06, 3, 12, PI), { pos: off(0, 0.6, 2.22), rot: R, scale: [1.1, 0.85, 1], color: C.gold }); // front: dark bezel, glowing windscreen, gold arch
  for (const sx of [-1, 1]) { b.add('gold', G.box(0.08, 0.1, 2.3), { pos: off(sx * 1.12, 0.7, 1.05), rot: R, color: C.gold }); b.add('glow', G.box(0.22, 0.14, 0.06), { pos: off(sx * 0.75, 0.62, 2.58), rot: R, color: C.gold2, intensity: 4 }); }
  for (const dz of [-1.5, 0, 1.5]) for (const dx of [-1.32, 1.32]) { b.add('dark', G.cyl(0.52, 0.52, 0.42, 12).rotateZ(PI / 2), { pos: off(dx, 0.0, dz), rot: R, color: '#3a3f48' }); b.add('gold', G.cyl(0.24, 0.24, 0.46, 8).rotateZ(PI / 2), { pos: off(dx, 0.0, dz), rot: R, color: C.gold }); }
  b.add('gold', G.cyl(0.04, 0.04, 1.4, 4), { pos: off(0.75, 1.9, -1.9), color: C.gold }); b.add('ivory', G.cap(0.4, 8, 2).rotateX(-0.9), { pos: off(0.75, 2.6, -1.9), rot: R, color: C.ivory }); b.add('glow', G.octa(0.07), { pos: off(0.75, 2.65, -1.75), color: C.gold2, intensity: 4 });
}

// Glowing gold-lit roads from the hub toward each chapter region (as on the world map)
function roads(b) {
  const targets = [REGIONS.canyon, REGIONS.reactor, REGIONS.launch, REGIONS.echo].map(r => ({ x: r.x * 0.86, z: r.z * 0.86 }));
  for (const [ti, T] of targets.entries()) {
    const a0 = Math.atan2(T.z, T.x); const start = { x: Math.cos(a0) * 46, z: Math.sin(a0) * 46 };
    const len = Math.hypot(T.x - start.x, T.z - start.z); const n = Math.ceil(len / 8);
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

export function buildWorld(B, beams) {
  const b = B.misc; launchComplex(B.launch, beams); reactorCrater(B.reactor, beams, B.reactorNear, B.reactorFar); canyon(B.canyon, beams); echo(B.echo, beams); roads(B.roads);
  const r1 = sd(-30, 2); rover(b, r1.x, r1.z, 1.2);
  const r3 = sd(28, -2); rover(b, r3.x, r3.z, -0.6);
}
