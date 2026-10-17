import * as THREE from 'three';
import { G, quatFromDir } from './builder.js';
import { groundAt, sd, PORTAL, F } from './terrain.js';

const PI = Math.PI;
export const C = {
  ivory: '#f7f2e7', ivory2: '#e8e0cf', gold: '#e9bd58', gold2: '#efd295', goldD: '#aa7835', navy: '#102e40', night: '#05070d',
  dark: '#2a3442', win: '#ffb347', winHot: '#ff9a30', cyan: '#67d7f0', mint: '#a8dbc9',
};
export const colliders = [];
const faceCam = Math.atan2(-F.x, -F.z); // yaw that faces the concept camera

function windowsRing(b, x, y, z, R, count, w, h, opts = {}) {
  const a0 = opts.a0 || 0, skip = opts.skip || [];
  for (let i = 0; i < count; i++) {
    const a = a0 + i / count * PI * 2;
    if (skip.some(s => Math.abs(Math.atan2(Math.sin(a - s), Math.cos(a - s))) < (opts.skipW || 0.35))) continue;
    b.add('glow', new THREE.PlaneGeometry(w, h), { pos: [x + Math.sin(a) * R, y, z + Math.cos(a) * R], rot: [0, a, 0], color: opts.color || C.win, intensity: opts.I || 2.2 });
    if (opts.frame) b.add('gold', G.box(w + 0.14, 0.08, 0.12), { pos: [x + Math.sin(a) * R, y - h / 2 - 0.04, z + Math.cos(a) * R], rot: [0, a, 0], color: C.gold });
  }
}
function door(b, x, y, z, a, R, w = 1.4, h = 1.9, color = C.winHot) {
  const px = x + Math.sin(a) * R, pz = z + Math.cos(a) * R;
  b.add('gold', G.box(w + 0.5, h + 0.3, 0.7), { pos: [px, y + (h + 0.3) / 2, pz], rot: [0, a, 0], color: C.gold });
  b.add('glow', G.box(w, h, 0.2), { pos: [px + Math.sin(a) * 0.3, y + h / 2, pz + Math.cos(a) * 0.3], rot: [0, a, 0], color, intensity: 2.6 });
}
function antenna(b, x, y, z, h, light = C.win) {
  b.add('gold', G.cyl(0.08, 0.14, h, 6), { pos: [x, y, z], color: C.gold });
  b.add('gold', G.sphere(0.18, 8, 6), { pos: [x, y + h * 0.6, z], color: C.gold });
  b.add('glow', G.octa(0.16), { pos: [x, y + h + 0.1, z], color: light, intensity: 4 });
}

export function dome(b, s, d, r, o = {}) {
  const { x, z } = sd(s, d); const y = groundAt(x, z) - 0.15;
  colliders.push({ x, z, r: r * 1.15 });
  b.add('dark', G.cyl(r * 1.13, r * 1.2, 0.55, 32), { pos: [x, y - 0.25, z], color: '#3a4250' });
  b.add('gold', G.torus(r * 1.12, 0.12, 3, 28), { pos: [x, y + 0.3, z], rot: [PI / 2, 0, 0], color: C.gold });
  const wallH = r * 0.45, yw = y + 0.3;
  b.add('ivory', G.cyl(r, r * 1.05, wallH, 32, true), { pos: [x, yw, z], color: C.ivory, ao: [yw - 0.2, yw + wallH] });
  const dA = o.doorA ?? faceCam;
  windowsRing(b, x, yw + wallH * 0.55, z, r * 1.025, Math.round(r * 3.2), 0.55, Math.min(0.75, wallH * 0.38), { skip: [dA], a0: 0.1 });
  door(b, x, yw, z, dA, r * 0.95, 1.3, Math.min(1.9, wallH * 0.8));
  b.add('gold', G.torus(r * 1.01, 0.15, 3, 32), { pos: [x, yw + wallH, z], rot: [PI / 2, 0, 0], color: C.gold });
  const sy = 0.8, yd = yw + wallH;
  b.add('ivory', G.cap(r, 26, 8), { pos: [x, yd, z], scale: [1, sy, 1], color: C.ivory });
  for (let k = 0; k < 4; k++) b.add('gold', G.torus(r * 1.006, 0.06, 3, 20, PI), { pos: [x, yd, z], rot: [0, k * PI / 4 + 0.2, 0], scale: [1, sy, 1], color: C.gold2 });
  const e = 0.62; b.add('gold', G.torus(r * Math.cos(e) * 1.005, 0.07, 4, 32), { pos: [x, yd + r * Math.sin(e) * sy, z], rot: [PI / 2, 0, 0], color: C.gold2 });
  // small windows on the dome
  for (let i = 0; i < Math.round(r * 2.2); i++) { const a = i / Math.round(r * 2.2) * PI * 2 + 0.3; const el = 0.33; const rr = r * Math.cos(el) * 1.01; b.add('glow', new THREE.PlaneGeometry(0.42, 0.32), { pos: [x + Math.sin(a) * rr, yd + r * Math.sin(el) * sy, z + Math.cos(a) * rr], rot: [-0.35, a, 0], color: C.win, intensity: 1.8 }); }
  const top = yd + r * sy;
  b.add('ivory', G.cyl(r * 0.18, r * 0.24, 0.5, 16), { pos: [x, top - 0.15, z], color: C.ivory2 });
  b.add('gold', G.torus(r * 0.2, 0.06, 3, 16), { pos: [x, top + 0.33, z], rot: [PI / 2, 0, 0], color: C.gold });
  if (o.spire !== false) antenna(b, x, top + 0.3, z, o.spireH || r * 0.8);
  return { x, y, z, top };
}

function reactor(b, s, d) {
  const { x, z } = sd(s, d); const y = groundAt(x, z) - 0.1; const R = 8.5, H = 2.6, Ri = R - 2.4;
  colliders.push({ x, z, r: R * 1.1 });
  b.add('dark', G.cyl(R * 1.1, R * 1.16, 0.5, 48), { pos: [x, y - 0.2, z], color: '#3a4250' });
  b.add('gold', G.torus(R * 1.09, 0.14, 3, 40), { pos: [x, y + 0.3, z], rot: [PI / 2, 0, 0], color: C.gold });
  b.add('ivory', G.cyl(R, R * 1.04, H, 48, true), { pos: [x, y + 0.3, z], color: C.ivory, ao: [y, y + H] });
  const doors = [faceCam, faceCam + 1.9, faceCam - 1.6, faceCam + PI];
  windowsRing(b, x, y + 0.3 + H * 0.55, z, R * 1.03, 30, 0.75, 0.6, { skip: doors, skipW: 0.25, frame: true });
  for (const a of doors) door(b, x, y + 0.3, z, a, R * 0.98, 1.6, 2.0);
  for (let i = 0; i < 16; i++) { const a = i / 16 * PI * 2 + 0.1; b.add('gold', G.box(0.22, H, 0.25), { pos: [x + Math.sin(a) * R * 1.03, y + 0.3 + H / 2, z + Math.cos(a) * R * 1.03], rot: [0, a, 0], color: C.goldD }); }
  const yt = y + 0.3 + H;
  b.add('ivory', G.ring(Ri, R, 48), { pos: [x, yt, z], color: C.ivory2 });
  b.add('gold', G.torus(R, 0.3, 4, 40), { pos: [x, yt, z], rot: [PI / 2, 0, 0], color: C.gold });
  b.add('gold', G.torus(Ri, 0.32, 4, 36), { pos: [x, yt + 0.05, z], rot: [PI / 2, 0, 0], color: C.gold });
  b.add('gold', G.torus((R + Ri) / 2, 0.1, 4, 48), { pos: [x, yt + 0.02, z], rot: [PI / 2, 0, 0], color: C.gold2 });
  b.add('ivory', G.cyl(Ri, Ri, 1.4, 40, true), { pos: [x, yt - 1.4, z], color: C.ivory2, flip: true });
  // molten core
  b.add('glow', G.disc(Ri, 40), { pos: [x, yt - 0.25, z], color: (px, py, pz) => { const t = Math.hypot(px - x, pz - z) / Ri; return [5.5 - 2.2 * t, 2.6 - 1.4 * t, 0.6 - 0.4 * t]; } });
  for (const rr of [Ri * 0.35, Ri * 0.62, Ri * 0.85]) b.add('gold', G.torus(rr, 0.08, 3, 32), { pos: [x, yt - 0.2, z], rot: [PI / 2, 0, 0], color: C.goldD });
  b.add('beam', G.cyl(Ri * 0.98, Ri * 0.7, 3.2, 32, true), { pos: [x, yt - 0.25, z], color: '#ffae50', intensity: 0.5 }); // heat shimmer above the core
  // small rooftop units
  for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2 + 0.5; const rr = (R + Ri) / 2; b.add('ivory', G.cyl(0.35, 0.45, 0.6, 10), { pos: [x + Math.sin(a) * rr, yt, z + Math.cos(a) * rr], color: C.ivory }); b.add('glow', G.octa(0.14), { pos: [x + Math.sin(a) * rr, yt + 0.7, z + Math.cos(a) * rr], color: C.win, intensity: 4 }); }
  return { x, y: yt, z };
}

function corridor(b, A, B, r = 1.05, h = 1.25) {
  const ya = groundAt(A.x, A.z), yb = groundAt(B.x, B.z);
  const a = new THREE.Vector3(A.x, ya + h, A.z), c = new THREE.Vector3(B.x, yb + h, B.z);
  const dir = c.clone().sub(a); const L = dir.length(); dir.normalize(); const q = quatFromDir(dir); const mid = a.clone().add(c).multiplyScalar(0.5);
  b.add('ivory', G.cyl(r, r, L, 16, true).translate(0, -L / 2, 0), { pos: mid.toArray(), quat: q, color: C.ivory });
  const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize(); const yaw = Math.atan2(side.x, side.z);
  const n = Math.floor(L / 2.2);
  for (let i = 1; i < n; i++) {
    const p = a.clone().addScaledVector(dir, i / n * L);
    b.add('gold', G.torus(r * 1.08, 0.11, 3, 12), { pos: p.toArray(), quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir), color: i % 3 === 0 ? C.gold : C.gold2 });
    if (i < n - 1) for (const sgn of [1, -1]) { const w = p.clone().addScaledVector(dir, L / n / 2).addScaledVector(side, sgn * r * 0.99); w.y += 0.15; b.add('glow', new THREE.PlaneGeometry(0.55, 0.38), { pos: w.toArray(), rot: [0, sgn > 0 ? yaw : yaw + PI, 0], color: C.win, intensity: 2.2 }); }
    if (i % 2 === 0) b.add('dark', G.box(0.5, h, 0.8), { pos: [p.x, p.y - r - h / 2 + 0.6, p.z], rot: [0, yaw, 0], color: '#4a5260' });
  }
  for (let i = 0; i < 6; i++) colliders.push({ x: A.x + (B.x - A.x) * (i + 0.5) / 6, z: A.z + (B.z - A.z) * (i + 0.5) / 6, r: r + 0.4 });
}

function dishModule(b, s, d) {
  const { x, z } = sd(s, d); const y = groundAt(x, z) - 0.1;
  colliders.push({ x, z, r: 5 });
  b.add('dark', G.cyl(4.6, 4.9, 0.5, 32), { pos: [x, y - 0.2, z], color: '#3a4250' });
  b.add('ivory', G.cyl(4.2, 4.4, 2.6, 32), { pos: [x, y + 0.3, z], color: C.ivory, ao: [y, y + 2.6] });
  windowsRing(b, x, y + 1.7, z, 4.32, 14, 0.6, 0.55, { frame: true, skip: [faceCam] });
  door(b, x, y + 0.3, z, faceCam, 4.1, 1.2, 1.7);
  b.add('gold', G.torus(4.3, 0.16, 3, 32), { pos: [x, y + 2.9, z], rot: [PI / 2, 0, 0], color: C.gold });
  b.add('ivory', G.cyl(3.2, 4.1, 1.2, 32), { pos: [x, y + 2.9, z], color: C.ivory2 });
  b.add('gold', G.torus(3.2, 0.12, 3, 28), { pos: [x, y + 4.1, z], rot: [PI / 2, 0, 0], color: C.gold });
  b.add('gold', G.cyl(0.7, 1.1, 2.6, 12), { pos: [x, y + 4.1, z], color: C.gold });
  b.add('gold', G.box(2.4, 0.8, 0.8), { pos: [x, y + 6.8, z], color: C.goldD });
  // dish
  const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.75, faceCam - 0.9, 0, 'YXZ'));
  const center = new THREE.Vector3(x, y + 7.6, z);
  const M = (g, off, col, grp = 'ivory', extra = {}) => { const m = new THREE.Matrix4().compose(center, tilt, new THREE.Vector3(1, 1, 1)); m.multiply(new THREE.Matrix4().makeTranslation(...off)); b.add(grp, g, { matrix: m, color: col, ...extra }); };
  const Rd = 4.6, th = 0.62; const sr = Rd / Math.sin(th);
  const cap = new THREE.SphereGeometry(sr, 28, 6, 0, PI * 2, PI - th, th); // bottom cap: bowl opening up
  const cy = sr * Math.cos(th);
  M(cap, [0, cy, 0], C.ivory, 'ivory');
  M(cap, [0, cy + 0.06, 0], C.ivory2, 'ivory', { flip: true });
  M(G.torus(Rd, 0.16, 3, 32).rotateX(PI / 2), [0, 0.03, 0], C.gold, 'gold');
  for (let k = 0; k < 6; k++) { const g = G.torus(sr, 0.05, 3, 10, th).rotateZ(-PI / 2 - th).rotateY(k * PI / 3); M(g, [0, cy + 0.08, 0], C.gold2, 'gold'); }
  for (let k = 0; k < 3; k++) { const a = k / 3 * PI * 2; const p0 = new THREE.Vector3(Math.cos(a) * Rd * 0.95, 0, Math.sin(a) * Rd * 0.95), p1 = new THREE.Vector3(0, 3.2, 0); const dv = p1.clone().sub(p0); const L = dv.length(); const g = G.cyl(0.06, 0.06, L, 5).applyQuaternion(quatFromDir(dv)); M(g, p0.toArray(), C.gold, 'gold'); }
  M(G.cone(0.35, 0.9).rotateX(PI), [0, 3.8, 0], C.gold, 'gold');
  M(G.sphere(0.2, 8, 6), [0, 2.9, 0], C.win, 'glow', { intensity: 4 });
  M(G.cyl(0.9, 0.6, 0.6, 12), [0, -0.5, 0], C.ivory2, 'ivory');
}

function tower(b, x, z, h, w = 1.5) {
  const y = groundAt(x, z); colliders.push({ x, z, r: w });
  b.add('dark', G.cyl(w * 1.2, w * 1.4, 0.6, 8), { pos: [x, y - 0.2, z], color: '#3a4250' });
  const n = 6; const sh = h / n;
  for (let i = 0; i < n; i++) {
    const ww = w * (1 - i * 0.07); const yy = y + 0.4 + i * sh;
    b.add('ivory', G.cyl(ww * 0.55, ww * 0.6, sh * 0.92, 8), { pos: [x, yy, z], color: C.ivory });
    b.add('gold', G.cyl(ww * 0.68, ww * 0.68, sh * 0.1, 8), { pos: [x, yy + sh * 0.9, z], color: C.gold });
    for (let k = 0; k < 4; k++) { const a = k * PI / 2 + PI / 8; b.add('glow', new THREE.PlaneGeometry(0.28, sh * 0.4), { pos: [x + Math.sin(a) * ww * 0.56, yy + sh * 0.5, z + Math.cos(a) * ww * 0.56], rot: [0, a, 0], color: C.win, intensity: 2.5 }); }
    if (i === 2 || i === 4) b.add('ivory', G.cyl(ww * 1.0, ww * 0.8, 0.35, 12), { pos: [x, yy + sh * 0.95, z], color: C.ivory2 });
  }
  const top = y + 0.4 + h;
  b.add('gold', G.cone(w * 0.35, h * 0.22, 8), { pos: [x, top, z], color: C.gold });
  b.add('glow', G.octa(0.2), { pos: [x, top + h * 0.22 + 0.15, z], color: '#ff6a3a', intensity: 5 });
  return top;
}

export function rocketGeom(scale = 1) {
  const pts = [[0, 0], [1.25, 0], [1.55, 1.0], [1.65, 3], [1.65, 9.5], [1.55, 11.5], [1.25, 13.2], [0.75, 14.8], [0.25, 15.9], [0, 16.2]].map(([r, y]) => new THREE.Vector2(r * scale, y * scale));
  return new THREE.LatheGeometry(pts, 24);
}
export function rocket(b, x, y, z, S = 1, yaw = 0) {
  const by = y + 1.4 * S;
  b.add('gold', G.cone(1.15 * S, 1.6 * S, 16).rotateX(PI).translate(0, 1.6 * S, 0), { pos: [x, y - 0.2 * S, z], color: C.goldD });
  b.add('ivory', rocketGeom(S), { pos: [x, by, z], color: C.ivory });
  for (const [yy, rr] of [[0.15, 1.3], [3.4, 1.67], [9.2, 1.67], [12.0, 1.48]]) b.add('gold', G.torus(rr * S, 0.12 * S, 4, 28), { pos: [x, by + yy * S, z], rot: [PI / 2, 0, 0], color: C.gold });
  for (let k = 0; k < 4; k++) {
    const a = yaw + k * PI / 2 + PI / 4; const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(2.2, -1.2); sh.lineTo(2.3, -2.6); sh.lineTo(0, 0.0 - 1.4); sh.lineTo(0, 4.2); sh.lineTo(0, 0);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.18, bevelEnabled: false }).translate(0, 0, -0.09).scale(S, S, S);
    b.add('ivory', g, { pos: [x + Math.sin(a) * 1.5 * S, by + 2.6 * S, z + Math.cos(a) * 1.5 * S], rot: [0, a - PI / 2, 0], color: C.ivory2 });
    b.add('gold', G.box(0.12 * S, 2.8 * S, 0.24 * S), { pos: [x + Math.sin(a) * 3.75 * S, by + 0.75 * S, z + Math.cos(a) * 3.75 * S], rot: [0, a, 0], color: C.gold });
  }
  for (const [yy, rr] of [[10.4, 1.62], [12.6, 1.38]]) { const a = yaw; b.add('gold', G.torus(0.42 * S, 0.08 * S, 4, 14), { pos: [x + Math.sin(a) * rr * S, by + yy * S, z + Math.cos(a) * rr * S], rot: [0, a, 0], color: C.gold }); b.add('glow', G.disc(0.36 * S, 12).rotateX(PI / 2), { pos: [x + Math.sin(a) * (rr + 0.03) * S, by + yy * S, z + Math.cos(a) * (rr + 0.03) * S], rot: [0, a, 0], color: C.win, intensity: 3 }); }
  b.add('glow', G.octa(0.14 * S), { pos: [x, by + 16.3 * S, z], color: '#ff5533', intensity: 5 });
}

function launchPad(b, s, d) {
  const { x, z } = sd(s, d); const y = groundAt(x, z);
  colliders.push({ x, z, r: 6.5 });
  b.add('dark', G.cyl(6.6, 7.2, 0.7, 6), { pos: [x, y - 0.3, z], color: '#3a4250' });
  b.add('ivory', G.cyl(6.0, 6.4, 1.1, 6), { pos: [x, y + 0.2, z], color: C.ivory2 });
  b.add('gold', G.cyl(6.45, 6.45, 0.18, 6), { pos: [x, y + 1.2, z], color: C.gold });
  b.add('ivory', G.cyl(3.2, 3.6, 0.7, 24), { pos: [x, y + 1.3, z], color: C.ivory });
  for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; b.add('glow', G.box(0.4, 0.15, 0.4), { pos: [x + Math.sin(a) * 5.3, y + 1.35, z + Math.cos(a) * 5.3], color: C.win, intensity: 3 }); }
  rocket(b, x, y + 2.0, z, 0.95, faceCam);
  const t1 = sd(s - 7.5, d - 1), t2 = sd(s + 7.5, d + 1.5);
  const h1 = tower(b, t1.x, t1.z, 15, 1.6), h2 = tower(b, t2.x, t2.z, 12.5, 1.5);
  // gantry arms
  for (const [t, hh] of [[t1, 9], [t2, 7]]) { const A = new THREE.Vector3(t.x, y + hh, t.z), B = new THREE.Vector3(x, y + hh, z); const dv = B.clone().sub(A); const L = dv.length() - 1.7; b.add('gold', G.box(0.35, 0.35, L), { pos: A.clone().addScaledVector(dv.normalize(), L / 2).toArray(), rot: [0, Math.atan2(dv.x, dv.z), 0], color: C.goldD }); }
}

function beaconPad(b, s, d, beams, height = 46) {
  const { x, z } = sd(s, d); const y = groundAt(x, z);
  colliders.push({ x, z, r: 1.2 });
  b.add('dark', G.cyl(2.9, 3.2, 0.5, 32), { pos: [x, y - 0.2, z], color: '#2c3644' });
  b.add('gold', G.torus(2.85, 0.13, 3, 28), { pos: [x, y + 0.3, z], rot: [PI / 2, 0, 0], color: C.gold });
  b.add('ivory', G.cyl(2.2, 2.5, 0.5, 32), { pos: [x, y + 0.3, z], color: C.ivory });
  b.add('gold', G.torus(2.2, 0.1, 3, 28), { pos: [x, y + 0.8, z], rot: [PI / 2, 0, 0], color: C.gold });
  b.add('glow', G.ring(1.5, 1.75, 32), { pos: [x, y + 0.82, z], color: C.cyan, intensity: 2.5 });
  b.add('dark', G.cyl(1.2, 1.4, 0.35, 24), { pos: [x, y + 0.8, z], color: '#2c3644' });
  b.add('glow', G.disc(0.95, 24), { pos: [x, y + 1.16, z], color: C.cyan, intensity: 4 });
  beams.push({ x, y: y + 1.1, z, r: 0.7, h: height, color: C.cyan, I: 0.9 });
  beams.push({ x, y: y + 1.1, z, r: 1.5, h: height * 0.45, color: C.cyan, I: 0.18 });
}

function portal(b, s, d, beams) {
  const { x, z } = sd(s, d); const y = groundAt(x, z);
  colliders.push({ x, z, r: 6 });
  b.add('dark', G.cyl(8.5, 9.2, 0.8, 40), { pos: [x, y - 0.4, z], color: '#2c3644' });
  b.add('ivory', G.cyl(8.0, 8.4, 0.5, 40), { pos: [x, y + 0.2, z], color: C.ivory2 });
  b.add('gold', G.torus(8.1, 0.14, 3, 36), { pos: [x, y + 0.72, z], rot: [PI / 2, 0, 0], color: C.gold });
  b.add('glow', G.ring(5.4, 5.8, 40), { pos: [x, y + 0.73, z], color: C.mint, intensity: 2 });
  // gate arch, facing the hub
  const yaw = faceCam + 0.35; const back = 5.5;
  const gx = x - Math.sin(yaw) * back, gz = z - Math.cos(yaw) * back;
  b.add('gold', G.torus(6.0, 0.55, 8, 40, PI), { pos: [gx, y + 0.5, gz], rot: [0, yaw, 0], color: C.gold });
  b.add('ivory', G.torus(6.9, 0.45, 6, 40, PI), { pos: [gx - Math.sin(yaw) * 0.4, y + 0.5, gz - Math.cos(yaw) * 0.4], rot: [0, yaw, 0], color: C.ivory });
  b.add('beam', new THREE.CircleGeometry(5.8, 32, 0, PI), { pos: [gx, y + 0.5, gz], rot: [0, yaw, 0], color: '#3fd8c8', intensity: 0.6, uvY: 0.35 });
  for (let k = 0; k < 4; k++) {
    const a = yaw + (k - 1.5) * 0.75; const rr = 4.8;
    const px = x + Math.sin(a) * rr * 0.9 - Math.sin(yaw) * 1.0, pz = z + Math.cos(a) * rr * 0.9 - Math.cos(yaw) * 1.0;
    b.add('ivory', G.cyl(0.8, 1.0, 0.9, 16), { pos: [px, y + 0.6, pz], color: C.ivory });
    b.add('gold', G.torus(0.8, 0.08, 3, 16), { pos: [px, y + 1.5, pz], rot: [PI / 2, 0, 0], color: C.gold });
    b.add('glow', G.disc(0.6, 16), { pos: [px, y + 1.52, pz], color: C.cyan, intensity: 4 });
    beams.push({ x: px, y: y + 1.5, z: pz, r: 0.5, h: 20 + k % 2 * 6, color: '#53e0d0', I: 1.3 });
  }
}

function lamp(b, x, z, color = C.win) { const y = groundAt(x, z); b.add('dark', G.cyl(0.07, 0.1, 1.2, 5), { pos: [x, y, z], color: '#555c66' }); b.add('glow', G.octa(0.13), { pos: [x, y + 1.3, z], color, intensity: 4 }); }
function crate(b, x, z, s = 1, yaw = 0) { const y = groundAt(x, z); b.add('ivory', G.box(1.2 * s, 0.9 * s, 0.9 * s), { pos: [x, y + 0.45 * s, z], rot: [0, yaw, 0], color: C.ivory2 }); b.add('gold', G.box(1.25 * s, 0.12 * s, 0.95 * s), { pos: [x, y + 0.65 * s, z], rot: [0, yaw, 0], color: C.gold }); colliders.push({ x, z, r: 0.8 * s }); }
function solar(b, x, z, yaw) { const y = groundAt(x, z); b.add('dark', G.cyl(0.1, 0.12, 1.4, 5), { pos: [x, y, z], color: '#555c66' }); b.add('dark', G.box(3.2, 0.08, 1.8), { pos: [x, y + 1.5, z], rot: [-0.5, yaw, 0], color: '#1b3c5a' }); b.add('gold', G.box(3.35, 0.05, 0.08), { pos: [x, y + 1.5, z], rot: [-0.5, yaw, 0], color: C.gold }); }

// rover tread marks from the lookout down to the base (as in the concept foreground)
function tracks(b) {
  const pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push(sd(3.5 + Math.sin(t * 2.6) * 4 - t * 2, -54 + t * 44)); }
  for (const off of [-0.85, 0.85]) for (let i = 0; i < pts.length - 1; i++) {
    const A = pts[i], B = pts[i + 1]; const dx = B.x - A.x, dz = B.z - A.z, l = Math.hypot(dx, dz); const nx = -dz / l, nz = dx / l; const yaw = Math.atan2(dx, dz);
    for (let k = 0; k < 3; k++) { const t = k / 3; const px = A.x + dx * t + nx * off, pz = A.z + dz * t + nz * off; b.add('dark', new THREE.PlaneGeometry(0.42, 0.22).rotateX(-PI / 2), { pos: [px, groundAt(px, pz) + 0.04, pz], rot: [0, yaw, 0], color: '#4b4c52' }); }
  }
}
export function buildHub(b, beams) {
  tracks(b);
  const R = reactor(b, 0, 0);
  const L = dome(b, -22, 3, 5.0);
  const Bk = dome(b, -3.5, 25, 5.6, { spireH: 4.5 });
  const sm = dome(b, -9, 16.5, 2.8, { spire: false });
  const Rd = dome(b, 19.5, 9, 4.6);
  const Fd = dome(b, 10.5, -6.5, 3.8);
  const Bd = dome(b, 25, 24, 3.2);
  dishModule(b, -14, 12);
  launchPad(b, 12, 33);
  beaconPad(b, 11.5, -30, beams, 30);
  portal(b, 37, 37, beams);
  // corridors (auto-trimmed to module radii)
  const P = (s, d) => sd(s, d);
  const M = { ring: [0, 0, 8.5], L: [-22, 3, 5], Bk: [-3.5, 25, 5.6], sm: [-9, 16.5, 2.8], Rd: [19.5, 9, 4.6], Fd: [10.5, -6.5, 3.8], Bd: [25, 24, 3.2], dish: [-14, 12, 4.3] };
  const link = (a, c, r = 1.0) => { const A = M[a], B = M[c]; const ds = B[0] - A[0], dd = B[1] - A[1]; const l = Math.hypot(ds, dd); const ux = ds / l, uy = dd / l; corridor(b, P(A[0] + ux * (A[2] - 0.3), A[1] + uy * (A[2] - 0.3)), P(B[0] - ux * (B[2] - 0.3), B[1] - uy * (B[2] - 0.3)), r); };
  link('ring', 'L'); link('ring', 'Fd', 0.95); link('ring', 'Rd'); link('ring', 'dish'); link('dish', 'sm', 0.85); link('sm', 'Bk', 0.85); link('Rd', 'Bd', 0.9); link('dish', 'L', 0.9); link('ring', 'Bk', 0.95);
  // props
  const rnd = (() => { let a = 7; return () => (a = (a * 16807) % 2147483647) / 2147483647; })();
  for (let i = 0; i < 26; i++) { const a = i / 26 * PI * 2; const p = { x: Math.cos(a) * 38, z: Math.sin(a) * 38 }; lamp(b, p.x, p.z, i % 2 ? C.win : C.gold2); }
  for (let i = 0; i < 10; i++) { const p = P(-26 + rnd() * 10, 10 + rnd() * 8); crate(b, p.x, p.z, 0.8 + rnd() * 0.5, rnd() * 3); }
  for (let i = 0; i < 6; i++) { const p = P(14 + rnd() * 6, -12 - rnd() * 8); crate(b, p.x, p.z, 0.7 + rnd() * 0.4, rnd() * 3); }
  for (let i = 0; i < 8; i++) { const p = P(-30 + (i % 4) * 3.8, 22 + Math.floor(i / 4) * 3); solar(b, p.x, p.z, faceCam + PI); }
  return { reactor: R };
}
