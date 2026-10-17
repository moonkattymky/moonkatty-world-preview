import * as THREE from 'three';
import { fbm, ridged, noise2, smoothstep, lerp, clamp } from './noise.js';

// World layout (meters). Hub "Base Alpha" centered at origin, ~180 m across.
export const REGIONS = {
  canyon:  { x: -540, z: 60,   name: 'Landing Canyon' },
  reactor: { x: 440,  z: 400,  name: 'Reactor Crater' },
  launch:  { x: 430,  z: -430, name: 'Launch Complex' },
  echo:    { x: -60,  z: -660, name: 'Echo Relay Field' },
};
// Concept-camera frame: forward F (from lookout toward base), right Rt. sd(s,d) -> world xz
export const F = { x: 0.592, z: -0.806 }, Rt = { x: 0.806, z: 0.592 };
export function sd(s, d) { return { x: s * Rt.x + d * F.x, z: s * Rt.z + d * F.z }; }
export const LOOKOUT = { ...sd(-2, -54), r: 19, h: 10 };
// The concept-art camera: cat on the lip of a ridge, base below at ~60 m
export const CONCEPT = { cat: sd(-2.53, -51.23), cam: sd(-0.8, -54.1), target: sd(-5.5, 0), eye: 1.0, drop: 3.5, fov: 47, catYaw: -0.15 };
// walkable rock ledge under the concept cat (the rock mesh itself lives in props.js); raises groundAt so the cat really stands on it
const _lc = sd(-3.0, -51.85); export const LEDGE = { x: _lc.x, z: _lc.z, h: 0.55, r0: 1.35, r1: 1.75 };
export function ledgeAt(x, z) { const d = Math.hypot(x - LEDGE.x, z - LEDGE.z); if (d >= LEDGE.r1) return 0; const t = Math.min(1, Math.max(0, (d - LEDGE.r0) / (LEDGE.r1 - LEDGE.r0))); return LEDGE.h * (1 - t * t * (3 - 2 * t)); }
const LIP = sd(-2, -56);
export const PLAY_START = sd(-3, -21);
export const PORTAL = sd(34, 36);
const PORTAL_WALL = sd(50, 57), LEFT_HILL = sd(-40, -19);
export const CAVE = { ...sd(43.5, 47), yawOff: 0.35 };
const CANYON_A = { x: -400, z: -300 }, CANYON_B = { x: -660, z: 380 };
const SMALL_CRATERS = [
  [-58, -8, 9], [30, 40, 7], [-20, 62, 6], [60, 18, 8], [-70, 40, 10], [8, -66, 7], [70, -60, 11], [-40, -60, 9], [95,70,14], [-110,-20,16]
];

function segDist(px, pz, a, b) {
  const vx = b.x - a.x, vz = b.z - a.z; const t = clamp(((px - a.x) * vx + (pz - a.z) * vz) / (vx * vx + vz * vz), 0, 1);
  return Math.hypot(px - (a.x + vx * t), pz - (a.z + vz * t));
}
function crater(d, R, depth, rimH) {
  const t = d / R; let h = 0;
  if (t < 1) h -= depth * (1 - t * t);
  h += rimH * Math.exp(-(((t - 1) / 0.28) ** 2));
  return h;
}
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); }
const PASS_ANG = Object.values(REGIONS).map(r => Math.atan2(r.z, r.x));
const EARTH_ANG = Math.atan2(-0.806, 0.592) + 0.33;

export function heightAt(x, z) {
  const r = Math.hypot(x, z);
  const hub = 1 - smoothstep(48, 100, r);
  const large = fbm(x * 0.0028 + 3.1, z * 0.0028 - 1.7, 4) * 18;
  const medium = fbm(x * 0.022, z * 0.022, 3) * 2.6;
  const small = fbm(x * 0.11 + 9, z * 0.11, 2) * 0.45;
  const flat = 1 - smoothstep(30, 46, r); // building pad
  let h = (large + medium) * (1 - hub * 0.95) + small * (1 - flat * 0.7);
  // rim mountains around the hub basin, with passes toward the chapter regions
  const ang = Math.atan2(z, x);
  let pass = 1; for (const a of PASS_ANG) pass *= 1 - 0.8 * Math.exp(-(((angDiff(ang, a)) / 0.2) ** 2));
  pass *= 1 - 0.55 * Math.exp(-(((angDiff(ang, EARTH_ANG)) / 0.3) ** 2)); // lower ridge under the Earth in the concept view
  const rIn = 118 + 26 * noise2(Math.cos(ang) * 1.3, Math.sin(ang) * 1.3);
  const ring = smoothstep(rIn, rIn + 50, r) * (1 - smoothstep(230, 360, r));
  const rid = ridged(x * 0.011, z * 0.011, 4);
  const mass = 0.5 + 0.5 * fbm(x * 0.007 + 11, z * 0.007 - 4, 3);
  const jag = ridged(x * 0.03 + 5, z * 0.03, 3);
  h += ring * pass * (4 + mass * 15 + rid * rid * 13 + jag * jag * 9 + fbm(x * 0.05, z * 0.05, 2) * 3);
  // rocky outcrops / chunky ground around the hub (kept off the building pad)
  { const oc = Math.max(0, ridged(x * 0.075 + 3, z * 0.075 - 7, 2) - 0.62) * 5.5; const cs = x * Rt.x + z * Rt.z, cd = x * F.x + z * F.z; const corridor = (1 - smoothstep(18, 28, Math.abs(cs - 8))) * smoothstep(-62, -55, cd) * (1 - smoothstep(-6, 0, cd)); h += oc * smoothstep(40, 58, r) * (1 - smoothstep(220, 300, r)) * (1 - corridor); h += (ridged(x * 0.35, z * 0.35, 2) - 0.5) * 0.35 * smoothstep(34, 50, r); }
  // lookout ledge (where the concept camera / cat stands)
  const dl = Math.hypot(x - LOOKOUT.x, z - LOOKOUT.z);
  { const ux = x - LIP.x, uz = z - LIP.z; const u = ux * F.x + uz * F.z, v = ux * Rt.x + uz * Rt.z;
    let f = u > 0 ? clamp(1 - u / 37, 0, 1) : 1; f = f * f * (1.6 - 0.6 * f) ; // gentle convex ramp toward the base
    f *= 1 - smoothstep(12, 30, -u); f *= 1 - smoothstep(12 + Math.max(0, -v) * 0.0, 34, Math.abs(v) * (v < 0 ? 0.7 : 1));
    h += LOOKOUT.h * f * (1 + 0.12 * noise2(x * 0.25, z * 0.25)) + f * fbm(x * 0.35, z * 0.35, 2) * 0.5; }
  // portal crater wall (cyan gate) behind the base on the right
  const dp = Math.hypot(x - PORTAL_WALL.x, z - PORTAL_WALL.z);
  h += 15 * (1 - smoothstep(7, 21, dp)) * (0.82 + 0.36 * rid) + 6 * (1 - smoothstep(14, 34, dp));
  const dpp = Math.hypot(x - PORTAL.x, z - PORTAL.z); h = lerp(h, 0.3 + small, 1 - smoothstep(8, 12.5, dpp));
  const dh = Math.hypot(x - LEFT_HILL.x, z - LEFT_HILL.z);
  h += 20 * (1 - smoothstep(4, 19, dh)) * (0.7 + 0.6 * rid);
  // small craters in the hub
  for (const [cx, cz, cr] of SMALL_CRATERS) { const d = Math.hypot(x - cx, z - cz); if (d < cr * 2) h += crater(d, cr, cr * 0.22, cr * 0.12); }
  // landing canyon
  const dc = segDist(x, z, CANYON_A, CANYON_B);
  const cw = 26 + 14 * noise2(x * 0.01, z * 0.01);
  h += 6 * Math.exp(-(((dc - cw - 18) / 14) ** 2));
  h -= 58 * (1 - smoothstep(cw * 0.55, cw + 16, dc)) * (0.85 + 0.3 * rid);
  // reactor crater
  { const R = REGIONS.reactor; const d = Math.hypot(x - R.x, z - R.z); if (d < 220) h = lerp(h, h * 0.3, 1 - smoothstep(70, 200, d)) + crater(d, 82, 42, 18); }
  // launch complex pad
  { const L = REGIONS.launch; const d = Math.hypot(x - L.x, z - L.z); h = lerp(h, 3 + small, 1 - smoothstep(70, 115, d)); }
  // echo plateau
  { const E = REGIONS.echo; const d = Math.hypot(x - E.x, z - E.z); h = lerp(h, 22 + small, 1 - smoothstep(60, 110, d)); }
  // world boundary mountains
  h += smoothstep(900, 1300, r) * (25 + mass * 55 + rid * 25 + jag * 30);
  return h;
}

// Terrain mesh: polar rings around the hub. NEAR disc (r < ~260 m, 128 segments, ~2.5-3 m facets near the base)
// split into 6 angular sectors + FAR ring (64 segments) split into 4 quadrants, so the GPU only draws what is in view.
export const GRID = { Mn: 128, Mf: 64, inner: 20, step: 2.5, grow: 1.05, R1: 260, growFar: 1.1, maxR: 1450 };
let H = null, PX = null, PZ = null, TRI = null, BUCKET = null;
const AB = 256;
const rbOf = r => r < 20 ? Math.floor(r / 2.5) : 8 + Math.floor(Math.log(r / 20) / Math.log(1.05));
function buildTopology() {
  const rings = []; // {r, M, stagger}
  rings.push({ r: 0, M: 1 });
  let r = GRID.step; while (r <= GRID.inner) { rings.push({ r, M: GRID.Mn }); r += GRID.step; }
  r = rings[rings.length - 1].r; while (r < GRID.R1) { r *= GRID.grow; rings.push({ r, M: GRID.Mn }); }
  while (r < GRID.maxR) { r *= GRID.growFar; rings.push({ r, M: GRID.Mf }); }
  let off = 0; rings.forEach((g, k) => { g.off = off; off += g.M; g.st = (k % 2) * 0.5; });
  const NV = off; const px = new Float32Array(NV), pz = new Float32Array(NV);
  rings.forEach(g => { for (let j = 0; j < g.M; j++) { const th = (j + (g.M > 1 ? g.st : 0)) / g.M * Math.PI * 2; px[g.off + j] = Math.cos(th) * g.r; pz[g.off + j] = Math.sin(th) * g.r; } });
  const tris = []; const id = (g, j) => g.off + ((j % g.M) + g.M) % g.M;
  for (let k = 0; k < rings.length - 1; k++) {
    const A = rings[k], B = rings[k + 1];
    if (A.M === 1) { for (let j = 0; j < B.M; j++) tris.push(A.off, id(B, j), id(B, j + 1)); continue; }
    if (A.M === B.M) { for (let j = 0; j < A.M; j++) { const a = id(A, j), b = id(A, j + 1), c = id(B, j), d = id(B, j + 1); tris.push(a, c, b, b, c, d); } continue; }
    // stitch 2:1 (inner A has 2x the segments of outer B)
    for (let j = 0; j < B.M; j++) { const i0 = id(A, 2 * j), i1 = id(A, 2 * j + 1), i2 = id(A, 2 * j + 2), o0 = id(B, j), o1 = id(B, j + 1); tris.push(i0, o0, i1, i1, o0, o1, i1, o1, i2); }
  }
  // enforce CCW (upward) winding in xz
  for (let t = 0; t < tris.length; t += 3) { const a = tris[t], b = tris[t + 1], c = tris[t + 2]; const cr = (px[b] - px[a]) * (pz[c] - pz[a]) - (pz[b] - pz[a]) * (px[c] - px[a]); if (cr > 0) { tris[t + 1] = c; tris[t + 2] = b; } }
  return { NV, px, pz, tris: new Uint32Array(tris), rings };
}
function buildBuckets() {
  BUCKET = new Map(); const T = TRI;
  const put = (key, t) => { let l = BUCKET.get(key); if (!l) BUCKET.set(key, l = []); l.push(t); };
  for (let t = 0; t < T.length; t += 3) {
    let rmin = 1e9, rmax = 0, center = false; const th = [];
    for (let k = 0; k < 3; k++) { const v = T[t + k]; const r = Math.hypot(PX[v], PZ[v]); rmin = Math.min(rmin, r); rmax = Math.max(rmax, r); if (r < 1e-3) center = true; else { let a = Math.atan2(PZ[v], PX[v]); if (a < 0) a += Math.PI * 2; th.push(a); } }
    const r0 = rbOf(rmin), r1 = rbOf(rmax);
    let a0 = Math.min(...th), a1 = Math.max(...th); let ranges = [[a0, a1]];
    if (center) ranges = [[0, Math.PI * 2 - 1e-6]]; else if (a1 - a0 > Math.PI) { const lo = th.filter(a => a < Math.PI), hi = th.filter(a => a >= Math.PI); ranges = [[0, Math.max(...lo)], [Math.min(...hi), Math.PI * 2 - 1e-6]]; }
    for (let rb = r0; rb <= r1; rb++) for (const [x0, x1] of ranges) for (let ab = Math.floor(x0 / (Math.PI * 2) * AB); ab <= Math.floor(x1 / (Math.PI * 2) * AB); ab++) put(rb * AB + ab, t);
  }
}
export function groundAt(x, z) { return groundMesh(x, z) + ledgeAt(x, z); } // terrain mesh + walkable concept ledge
export function groundMesh(x, z) { // exact height of the rendered terrain mesh
  const r = Math.hypot(x, z); if (!BUCKET || r >= GRID.maxR * 0.98) return heightAt(x, z);
  let a = Math.atan2(z, x); if (a < 0) a += Math.PI * 2;
  const list = BUCKET.get(rbOf(r) * AB + Math.floor(a / (Math.PI * 2) * AB) % AB); if (!list) return heightAt(x, z);
  let best = null, bestErr = 1e9;
  for (const t of list) {
    const A = TRI[t], B = TRI[t + 1], Cc = TRI[t + 2];
    const x1 = PX[A], z1 = PZ[A], x2 = PX[B], z2 = PZ[B], x3 = PX[Cc], z3 = PZ[Cc];
    const det = (z2 - z3) * (x1 - x3) + (x3 - x2) * (z1 - z3); if (Math.abs(det) < 1e-9) continue;
    const l1 = ((z2 - z3) * (x - x3) + (x3 - x2) * (z - z3)) / det, l2 = ((z3 - z1) * (x - x3) + (x1 - x3) * (z - z3)) / det, l3 = 1 - l1 - l2;
    const err = Math.max(0, -l1) + Math.max(0, -l2) + Math.max(0, -l3);
    if (err < bestErr) { bestErr = err; best = l1 * H[A] + l2 * H[B] + l3 * H[Cc]; if (err === 0) break; }
  }
  return best ?? heightAt(x, z);
}

export function terrainMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0, flatShading: true }); m.color.setScalar(0.7);
  // procedural regolith: mottled albedo, dark pits, pebble speckle and a bump-mapped normal (fades with distance)
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWP;
      float hh(vec2 p){ p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), f.x), f.y); }
      float rg(vec2 p){ return vn(p * 0.55) * 0.45 + vn(p * 1.7) * 0.33 + vn(p * 5.3) * 0.22; }
      // small impact craters: returns (albedo factor, dh/dx, dh/dz)
      vec3 craters(vec2 p, float cs){
        vec2 cell = floor(p / cs); vec3 acc = vec3(1.0, 0.0, 0.0);
        for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
          vec2 c = cell + vec2(float(i), float(j)); if (hh(c + 9.7) < 0.2) continue;
          vec2 ctr = (c + 0.2 + 0.6 * vec2(hh(c), hh(c + 17.3))) * cs; float rad = cs * (0.12 + 0.3 * hh(c + 5.1) * hh(c + 5.1));
          vec2 dv = p - ctr; float dl = length(dv); float d = dl / rad; if (d > 1.7) continue;
          float e1 = exp(-2.5 * d * d), q = (d - 1.0) / 0.28, e2 = exp(-q * q); float dh = 3.0 * d * e1 - 0.25 * 2.0 * q / 0.28 * e2; vec2 g = dh * 0.32 * dv / max(dl, 1e-3);
          acc.yz += g; acc.x *= (1.0 - 0.1 * e1) * (1.0 + 0.06 * e2);
        }
        return acc; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      float tDist = length(vWP - cameraPosition); float tFade = 1.0 - smoothstep(40.0, 200.0, tDist); float tNear = 1.0 - smoothstep(18.0, 85.0, tDist);
      float tN = rg(vWP.xz); vec3 cr = vec3(1.0, 0.0, 0.0); if (tNear > 0.01) cr = craters(vWP.xz, 2.6);
      { float speck = smoothstep(0.78, 0.95, vn(vWP.xz * 13.0)) - 0.6 * smoothstep(0.8, 0.95, vn(vWP.xz * 9.0 + 3.1)); float grain = vn(vWP.xz * 31.0) * 0.45 + vn(vWP.xz * 67.0) * 0.35 + hh(floor(vWP.xz * 90.0)) * 0.2;
        diffuseColor.rgb *= mix(1.0, (0.86 + 0.26 * tN) * (1.0 + 0.22 * speck), tFade) * mix(1.0, cr.x * (0.66 + 0.68 * grain), tNear); }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      if (tFade > 0.01) { float e = 0.15; float n0 = rg(vWP.xz * 1.6), nx = rg(vWP.xz * 1.6 + vec2(e, 0.)), nz = rg(vWP.xz * 1.6 + vec2(0., e));
        vec3 gW = vec3(-(nx - n0) / e, 0.0, -(nz - n0) / e) * 0.35 * tFade - vec3(cr.y, 0.0, cr.z) * 2.4 * tNear;
        if (tNear > 0.01) { float ge = 0.03; vec2 q = vWP.xz * 9.0; float g0 = vn(q), gx = vn(q + vec2(ge * 9.0, 0.)), gz = vn(q + vec2(0., ge * 9.0)); gW += vec3(-(gx - g0), 0.0, -(gz - g0)) * 0.9 * tNear * (1.0 - smoothstep(4.0, 30.0, tDist)); }
        normal = normalize(normal + (viewMatrix * vec4(gW, 0.0)).xyz); }`);
  };
  return m;
}

export function buildTerrain() {
  const topo = buildTopology(); PX = topo.px; PZ = topo.pz; TRI = topo.tris; const NV = topo.NV;
  H = new Float32Array(NV); for (let i = 0; i < NV; i++) H[i] = heightAt(PX[i], PZ[i]);
  buildBuckets();
  const cA = new THREE.Color('#8e8e92'), cB = new THREE.Color('#717277'), cDark = new THREE.Color('#4a4e58'), cTeal = new THREE.Color('#2f6f78'), cOrange = new THREE.Color('#c0602a'), cLight = new THREE.Color('#aaa8a3');
  const col = new Float32Array(NV * 3); const c = new THREE.Color();
  for (let i = 0; i < NV; i++) {
    const x = PX[i], z = PZ[i], h = H[i]; const r = Math.hypot(x, z); const step = Math.max(2.5, r * 0.05);
    const hx = heightAt(x + step, z), hx2 = heightAt(x - step, z), hz = heightAt(x, z + step), hz2 = heightAt(x, z - step);
    const slope = clamp(Math.hypot(hx - hx2, hz - hz2) / (2 * step), 0, 2);
    const ao = clamp(1 - ((hx + hx2 + hz + hz2) / 4 - h) * 0.07 * (6 / Math.max(6, step)), 0.55, 1.12);
    c.copy(cA).lerp(cB, clamp(0.5 + fbm(x * 0.03, z * 0.03, 3) * 1.2, 0, 1));
    c.lerp(cLight, clamp(fbm(x * 0.15 + 4, z * 0.15, 2) * 0.8 + slope * 0.15, 0, 0.55)); // rocky faces read lighter, like the concept
    c.lerp(cDark, clamp(slope * 0.12 - 0.05, 0, 0.2));
    c.multiplyScalar(ao);
    const dc = segDist(x, z, CANYON_A, CANYON_B); if (h < -10) c.lerp(cTeal, clamp((-h - 10) / 45, 0, 0.75) * (1 - smoothstep(30, 60, dc)));
    { const R = REGIONS.reactor; const d = Math.hypot(x - R.x, z - R.z); c.lerp(cOrange, (1 - smoothstep(20, 80, d)) * 0.8); }
    c.lerp(cDark, 0.12 * (1 - smoothstep(10, 40, r)));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  // bucket triangles into sectors
  const nearR = GRID.R1 * 1.06; const sectors = new Map();
  for (let t = 0; t < TRI.length; t += 3) {
    const a = TRI[t], b = TRI[t + 1], cc = TRI[t + 2]; const cx = (PX[a] + PX[b] + PX[cc]) / 3, cz = (PZ[a] + PZ[b] + PZ[cc]) / 3;
    const r = Math.hypot(cx, cz); let ang = Math.atan2(cz, cx); if (ang < 0) ang += Math.PI * 2;
    const key = r < 75 ? 'i' + Math.floor(ang / (Math.PI * 2) * 6) : r < nearR ? 'n' + Math.floor(ang / (Math.PI * 2) * 8) : 'f' + Math.floor(ang / (Math.PI * 2) * 4);
    let l = sectors.get(key); if (!l) sectors.set(key, l = []); l.push(a, b, cc);
  }
  const group = new THREE.Group(); group.name = 'terrain'; const mat = terrainMaterial();
  for (const [key, idx] of sectors) {
    const pos = new Float32Array(idx.length * 3), cl = new Float32Array(idx.length * 3);
    idx.forEach((v, i) => { pos[i * 3] = PX[v]; pos[i * 3 + 1] = H[v]; pos[i * 3 + 2] = PZ[v]; cl[i * 3] = col[v * 3]; cl[i * 3 + 1] = col[v * 3 + 1]; cl[i * 3 + 2] = col[v * 3 + 2]; });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(cl, 3)); g.computeVertexNormals(); g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, mat); mesh.name = 'terrain_' + key; mesh.receiveShadow = true; mesh.castShadow = false; group.add(mesh);
  }
  group.userData.tris = TRI.length / 3;
  return group;
}
export function slopeAt(x, z) { const e = 1.5; return Math.hypot(heightAt(x + e, z) - heightAt(x - e, z), heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e); }
