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
export const LOOKOUT = { ...sd(-2, -60), r: 19, h: 12 };
// The concept-art camera: cat on the lip of a ridge, base below at ~60 m
export const CONCEPT = { cat: sd(-2.6, -57.0), cam: sd(-0.8, -60.1), target: sd(-5.5, 0), eye: 1.5, drop: 8.6, fov: 47, catYaw: -0.6 };
const LIP = sd(-2, -56);
export const PLAY_START = sd(-3, -21);
export const PORTAL = sd(34, 36);
const PORTAL_WALL = sd(54, 60), LEFT_HILL = sd(-40, -19);
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
  h += ring * pass * (4 + mass * 15 + rid * rid * 13 + fbm(x * 0.05, z * 0.05, 2) * 3);
  // lookout ledge (where the concept camera / cat stands)
  const dl = Math.hypot(x - LOOKOUT.x, z - LOOKOUT.z);
  { const ux = x - LIP.x, uz = z - LIP.z; const u = ux * F.x + uz * F.z, v = ux * Rt.x + uz * Rt.z;
    let f = u > 0 ? clamp(1 - u / 37, 0, 1) : 1; f = f * f * (1.6 - 0.6 * f) ; // gentle convex ramp toward the base
    f *= 1 - smoothstep(12, 30, -u); f *= 1 - smoothstep(12 + Math.max(0, -v) * 0.0, 34, Math.abs(v) * (v < 0 ? 0.7 : 1));
    h += LOOKOUT.h * f * (1 + 0.12 * noise2(x * 0.25, z * 0.25)) + f * fbm(x * 0.35, z * 0.35, 2) * 0.5; }
  // portal crater wall (cyan gate) behind the base on the right
  const dp = Math.hypot(x - PORTAL_WALL.x, z - PORTAL_WALL.z);
  h += 19 * (1 - smoothstep(8, 26, dp)) * (0.75 + 0.5 * rid);
  const dpp = Math.hypot(x - PORTAL.x, z - PORTAL.z); h = lerp(h, 0.3 + small, 1 - smoothstep(10, 15, dpp));
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
  h += smoothstep(900, 1300, r) * (25 + mass * 55 + rid * 25);
  return h;
}

// Polar mesh centered on the hub: ~2.5-3 m facets around the base, growing geometrically outward.
export const GRID = { M: 104, inner: 20, step: 2.6, grow: 1.056, maxR: 1400 };
const RAD = [0]; { let r = GRID.step; while (r <= GRID.inner) { RAD.push(r); r += GRID.step; } r = RAD[RAD.length - 1]; while (r < GRID.maxR) { r *= GRID.grow; RAD.push(r); } }
const K = RAD.length - 1, M = GRID.M;
let H = null, PX = null, PZ = null;
const vid = (k, j) => k === 0 ? 0 : 1 + (k - 1) * M + ((j % M) + M) % M;
export function groundAt(x, z) { // exact height of the rendered terrain mesh
  const r = Math.hypot(x, z); if (r >= RAD[K]) return heightAt(x, z);
  let lo = 0, hi = K; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (RAD[m] <= r) lo = m; else hi = m; }
  let th = Math.atan2(z, x); if (th < 0) th += Math.PI * 2; const j = Math.floor(th / (Math.PI * 2) * M) % M;
  const tris = []; for (let jj = j - 1; jj <= j + 1; jj++) { if (lo === 0) tris.push([vid(0, 0), vid(1, jj), vid(1, jj + 1)]); else tris.push([vid(lo, jj), vid(lo + 1, jj), vid(lo, jj + 1)], [vid(lo, jj + 1), vid(lo + 1, jj), vid(lo + 1, jj + 1)]); }
  let best = null, bestErr = 1e9;
  for (const [a, b, c] of tris) {
    const x1 = PX[a], z1 = PZ[a], x2 = PX[b], z2 = PZ[b], x3 = PX[c], z3 = PZ[c];
    const det = (z2 - z3) * (x1 - x3) + (x3 - x2) * (z1 - z3);
    const l1 = ((z2 - z3) * (x - x3) + (x3 - x2) * (z - z3)) / det, l2 = ((z3 - z1) * (x - x3) + (x1 - x3) * (z - z3)) / det, l3 = 1 - l1 - l2;
    const err = Math.max(0, -l1) + Math.max(0, -l2) + Math.max(0, -l3);
    if (err < bestErr) { bestErr = err; best = l1 * H[a] + l2 * H[b] + l3 * H[c]; }
  }
  return best;
}

export function buildTerrain() {
  const NV = 1 + K * M; H = new Float32Array(NV); PX = new Float32Array(NV); PZ = new Float32Array(NV);
  const pos = new Float32Array(NV * 3), col = new Float32Array(NV * 3);
  for (let k = 0; k <= K; k++) for (let j = 0; j < (k === 0 ? 1 : M); j++) {
    const i = vid(k, j); const th = (j + (k % 2) * 0.5) / M * Math.PI * 2; // stagger rings for a less radial look
    const x = Math.cos(th) * RAD[k], z = Math.sin(th) * RAD[k]; const h = heightAt(x, z);
    PX[i] = x; PZ[i] = z; H[i] = h; pos[i * 3] = x; pos[i * 3 + 1] = h; pos[i * 3 + 2] = z;
  }
  const cA = new THREE.Color('#8c8c90'), cB = new THREE.Color('#6c6d72'), cDark = new THREE.Color('#3b3f4a'), cTeal = new THREE.Color('#2f6f78'), cOrange = new THREE.Color('#c0602a'), cLight = new THREE.Color('#9c9a96');
  const c = new THREE.Color();
  for (let i = 0; i < NV; i++) {
    const x = PX[i], z = PZ[i], h = H[i]; const r = Math.hypot(x, z); const step = Math.max(2.5, r * 0.05);
    const hx = heightAt(x + step, z), hx2 = heightAt(x - step, z), hz = heightAt(x, z + step), hz2 = heightAt(x, z - step);
    const slope = clamp(Math.hypot(hx - hx2, hz - hz2) / (2 * step), 0, 2);
    const ao = clamp(1 - ((hx + hx2 + hz + hz2) / 4 - h) * 0.09 * (6 / Math.max(6, step)), 0.45, 1.12);
    c.copy(cA).lerp(cB, clamp(0.5 + fbm(x * 0.03, z * 0.03, 3) * 1.2, 0, 1));
    c.lerp(cLight, clamp(fbm(x * 0.15 + 4, z * 0.15, 2) * 0.8, 0, 0.5));
    c.lerp(cDark, clamp(slope * 0.35 - 0.1, 0, 0.55));
    c.multiplyScalar(ao);
    const dc = segDist(x, z, CANYON_A, CANYON_B); if (h < -10) c.lerp(cTeal, clamp((-h - 10) / 45, 0, 0.75) * (1 - smoothstep(30, 60, dc)));
    { const R = REGIONS.reactor; const d = Math.hypot(x - R.x, z - R.z); c.lerp(cOrange, (1 - smoothstep(20, 80, d)) * 0.8); }
    c.lerp(cDark, 0.15 * (1 - smoothstep(10, 40, r)));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const idx = [];
  for (let j = 0; j < M; j++) idx.push(vid(0, 0), vid(1, j + 1), vid(1, j));
  for (let k = 1; k < K; k++) for (let j = 0; j < M; j++) { const a = vid(k, j), b = vid(k, j + 1), cc = vid(k + 1, j), d = vid(k + 1, j + 1); idx.push(a, b, cc, b, d, cc); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx);
  g.computeVertexNormals(); g.computeBoundingSphere();
  if (g.attributes.normal.getY(5) < 0) { const I = g.index.array; for (let t = 0; t < I.length; t += 3) { const tmp = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = tmp; } g.computeVertexNormals(); }
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, flatShading: true });
  // cheap procedural regolith detail (breaks up large facets): value-noise mottling + small dark pits
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWP;
      float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      { float d = length(vWP - cameraPosition); float fade = 1.0 - smoothstep(60.0, 260.0, d);
        float n = vn(vWP.xz * 0.9) * 0.5 + vn(vWP.xz * 2.7) * 0.3 + vn(vWP.xz * 7.0) * 0.2;
        float pits = smoothstep(0.78, 0.9, vn(vWP.xz * 1.6 + 7.0));
        diffuseColor.rgb *= mix(1.0, (0.8 + 0.38 * n) * (1.0 - 0.25 * pits), fade); }`);
  };
  const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; mesh.castShadow = false; mesh.name = 'terrain';
  return mesh;
}
export function slopeAt(x, z) { const e = 1.5; return Math.hypot(heightAt(x + e, z) - heightAt(x - e, z), heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e); }
