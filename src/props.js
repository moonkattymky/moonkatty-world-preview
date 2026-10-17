import * as THREE from 'three';
import { groundAt, groundMesh, LEDGE, slopeAt, F, Rt, LOOKOUT, REGIONS, sd, CONCEPT, CAVE, PORTAL } from './terrain.js';
import { noise2, seeded } from './noise.js';
import { colliders } from './base.js';

const rnd = seeded(2024);
export function rockGeom(detail, seed, stretch = [1, 1, 1], rough = 0.32, light = 1) {
  const g = detail === 'b' ? new THREE.BoxGeometry(1.4, 1.4, 1.4, 1, 1, 1).toNonIndexed() : detail === 'd' ? new THREE.DodecahedronGeometry(1, 0) : detail < 0 ? new THREE.OctahedronGeometry(1, 0) : new THREE.IcosahedronGeometry(1, detail);
  const P = g.attributes.position; const v = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i);
    const n = noise2(v.x * 1.7 + seed * 3.1, v.z * 1.7 + v.y * 1.3 - seed) * rough + noise2(v.y * 3.1 + seed, v.x * 2.9) * rough * 0.45;
    v.multiplyScalar(1 + n); v.x *= stretch[0]; v.y *= stretch[1]; v.z *= stretch[2];
    if (v.y < -0.35) v.y = -0.35 - (v.y + 0.35) * 0.15;
    P.setXYZ(i, v.x, v.y, v.z);
  }
  g.deleteAttribute('uv'); g.computeVertexNormals();
  const col = new Float32Array(P.count * 3); const r = seeded(seed * 97 + 5); const N = g.attributes.normal;
  for (let f = 0; f < P.count; f += 3) {
    const up = (N.getY(f) + 1) * 0.5; const base = (0.12 + r() * 0.09 + up * 0.09) * light;
    for (let k = 0; k < 3; k++) { const y = P.getY(f + k); const ao = THREE.MathUtils.clamp(0.55 + (y + 0.35) * 0.45, 0.5, 1.05); const c = base * ao; col[(f + k) * 3] = c * 1.03; col[(f + k) * 3 + 1] = c; col[(f + k) * 3 + 2] = c * 0.94; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

// higher-detail rock prototype: noise-displaced icosphere with sharp strata terraces + baked AO (same shape at every LOD)
// weld duplicate vertices so computeVertexNormals gives smooth-ish shading (no addons needed)
export function weld(g) {
  const P = g.attributes.position; const map = new Map(); const pos = []; const idx = [];
  for (let i = 0; i < P.count; i++) { const k = P.getX(i).toFixed(4) + ',' + P.getY(i).toFixed(4) + ',' + P.getZ(i).toFixed(4); let j = map.get(k); if (j === undefined) { j = pos.length / 3; map.set(k, j); pos.push(P.getX(i), P.getY(i), P.getZ(i)); } idx.push(j); }
  const o = new THREE.BufferGeometry(); o.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); o.setIndex(idx); return o;
}
// chunky regolith boulder: welded (smooth normals), noise-displaced, rough flattened top, warm-neutral per-vertex colour with baked AO
export function chunkGeom(detail, seed, top = 0.5) {
  const g = weld(new THREE.IcosahedronGeometry(1, detail)); const P = g.attributes.position; const v = new THREE.Vector3(); const nz = [];
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i);
    const n = noise2(v.x * 1.4 + seed * 3.1, v.z * 1.4 + v.y * 1.2 - seed) * 0.3 + noise2(v.y * 2.9 + seed, v.x * 2.6 + v.z) * 0.15 + noise2(v.x * 6.1 - seed, v.y * 5.7 + v.z * 5.3) * 0.07;
    v.multiplyScalar(1 + n); v.x *= 1.2; v.y *= 0.85; v.z *= 1.05;
    if (v.y > top) v.y = top + (v.y - top) * 0.2 + noise2(v.x * 3.7 + seed, v.z * 3.9) * 0.05;
    if (v.y < -0.3) v.y = -0.3 - (v.y + 0.3) * 0.15;
    P.setXYZ(i, v.x, v.y, v.z); nz.push(n);
  }
  g.computeVertexNormals(); const N = g.attributes.normal; const col = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) { const up = N.getY(i); const y = P.getY(i); const ao = THREE.MathUtils.clamp(0.7 + (y + 0.3) * 0.4, 0.65, 1.0); const c = (0.21 + Math.max(0, up) * 0.03 + nz[i] * 0.03) * ao; col[i * 3] = c * 1.04; col[i * 3 + 1] = c; col[i * 3 + 2] = c * 0.93; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeBoundingSphere(); return g;
}
// chiselled boulder: icosphere cut by random planes -> flat facets with crisp edges (angular, chunky), flat-shaded, top-lit vertex colours
export function chiselGeom(seed, cuts = 11, detail = 2) {
  const r = seeded(seed * 13 + 1); const g = new THREE.IcosahedronGeometry(1, detail); const P = g.attributes.position; const v = new THREE.Vector3(); const n = new THREE.Vector3();
  const planes = []; for (let i = 0; i < cuts; i++) { const th = r() * Math.PI * 2, y = i < 2 ? 0.85 + r() * 0.15 : (r() - 0.35) * 1.3; n.set(Math.cos(th) * Math.sqrt(Math.max(0, 1 - y * y)), y, Math.sin(th) * Math.sqrt(Math.max(0, 1 - y * y))).normalize(); planes.push([n.clone(), i < 2 ? 0.45 + r() * 0.15 : 0.55 + r() * 0.3]); }
  for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i); for (const [pn, d] of planes) { const k = v.dot(pn); if (k > d) v.addScaledVector(pn, d - k); } v.x *= 1.25; v.z *= 1.05; v.y *= 0.9; if (v.y < -0.3) v.y = -0.3 - (v.y + 0.3) * 0.15; P.setXYZ(i, v.x, v.y, v.z); }
  g.deleteAttribute('uv'); g.computeVertexNormals(); const N = g.attributes.normal; const col = new Float32Array(P.count * 3);
  for (let f = 0; f < P.count; f += 3) { const nx = (N.getX(f) + N.getX(f + 1) + N.getX(f + 2)) / 3, ny = (N.getY(f) + N.getY(f + 1) + N.getY(f + 2)) / 3; const c = 0.24 + Math.max(0, ny) * 0.06 + Math.max(0, -nx) * 0.03 + (r() - 0.5) * 0.025; for (let k = 0; k < 3; k++) { const y = P.getY(f + k); const ao = THREE.MathUtils.clamp(0.72 + (y + 0.3) * 0.35, 0.68, 1.0); const cc = c * ao; col.set([cc * 1.03, cc, cc * 0.95], (f + k) * 3); } }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeBoundingSphere(); return g;
}
// jagged crest for crater-wall pieces: lift upper vertices by position-hashed noise into sharp spires (no new triangles, crack-free)
export function jagGeom(g, seed, amp = 0.9) { const P = g.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); if (y <= 0.1) continue; const n = noise2(x * 2.3 + seed, z * 2.3 - seed * 0.7) * 0.5 + 0.5; const sp = Math.pow(n, 2.2) * amp * (y - 0.1) * 2.0; P.setY(i, y + sp); P.setX(i, x * (1 - 0.25 * Math.min(1, sp))); P.setZ(i, z * (1 - 0.25 * Math.min(1, sp))); } g.computeVertexNormals(); g.computeBoundingSphere(); return g; }
export function protoGeom(detail, seed, stretch = [1, 1, 1], strata = 0.65, light = 1) {
  const g = new THREE.IcosahedronGeometry(1, detail); const P = g.attributes.position; const v = new THREE.Vector3(); const rr = new Float32Array(P.count);
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i);
    const n = noise2(v.x * 1.3 + seed * 3.1, v.z * 1.3 + v.y * 1.1 - seed) * 0.34 + noise2(v.y * 2.7 + seed, v.x * 2.5 + v.z) * 0.16 + noise2(v.x * 5.1 - seed, v.y * 5.3 + v.z * 4.7) * 0.07;
    v.multiplyScalar(1 + n); v.x *= stretch[0]; v.y *= stretch[1]; v.z *= stretch[2];
    const st = 0.24 * stretch[1]; const q = Math.round(v.y / st) * st; v.y += (q - v.y) * strata; // strata ledges
    if (v.y < -0.3) v.y = -0.3 - (v.y + 0.3) * 0.15;
    P.setXYZ(i, v.x, v.y, v.z); rr[i] = Math.hypot(v.x / stretch[0], v.z / stretch[2]);
  }
  g.deleteAttribute('uv'); g.computeVertexNormals();
  const N = g.attributes.normal; const col = new Float32Array(P.count * 3); const r = seeded(seed * 31 + 7);
  for (let f = 0; f < P.count; f += 3) {
    const up = N.getY(f); const base = (0.13 + r() * 0.06 + Math.max(0, up) * 0.11 - Math.max(0, -up) * 0.05) * light;
    for (let k = 0; k < 3; k++) { const i = f + k; const y = P.getY(i) / stretch[1]; const ao = THREE.MathUtils.clamp(0.5 + (y + 0.3) * 0.42, 0.45, 1.05) * THREE.MathUtils.clamp(0.75 + rr[i] * 0.3, 0.7, 1.08); const c = base * ao; col[i * 3] = c * 1.03; col[i * 3 + 1] = c; col[i * 3 + 2] = c * 0.94; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeBoundingSphere(); return g;
}
// jagged crater-wall piece: tapering strata ledges with ragged rims and a faceted peak (sharp silhouette, not boxy)
export function wallGeom(seed, layers = 4, sides = 8) {
  const r = seeded(seed); const pos = [], col = []; const h = 1 / layers; let prevTop = null;
  for (let k = 0; k < layers; k++) {
    const y0 = k * h - (k ? 0.04 : 0.15); const R = 1 - k * 0.21; const cx = (r() - 0.5) * 0.2 * k, cz = (r() - 0.5) * 0.2 * k;
    const pts = []; for (let i = 0; i < sides; i++) { const a = i / sides * Math.PI * 2 + r() * 0.35; const rad = R * (0.6 + r() * 0.55); pts.push([cx + Math.cos(a) * rad, cz + Math.sin(a) * rad, (k + 1) * h + (r() - 0.5) * h * 0.7]); }
    const shade = 0.14 + r() * 0.04;
    for (let i = 0; i < sides; i++) { const [ax, az, ay] = pts[i], [bx, bz, by] = pts[(i + 1) % sides]; const t0 = shade * 0.55, t1 = shade;
      pos.push(ax, y0, az, bx, by, bz, bx, y0, bz, ax, y0, az, ax, ay, az, bx, by, bz); col.push(t0, t0, t0, t1, t1, t1, t0, t0, t0, t0, t0, t0, t1, t1, t1, t1, t1, t1); }
    if (k === layers - 1) { const ap = [cx + (r() - 0.5) * 0.5, (k + 1) * h + 0.12 + r() * 0.14, cz + (r() - 0.5) * 0.3]; const top = shade * 1.4; for (let i = 0; i < sides; i++) { const [ax, az, ay] = pts[i], [bx, bz, by] = pts[(i + 1) % sides]; pos.push(ax, ay, az, ap[0], ap[1], ap[2], bx, by, bz); col.push(top, top, top, top * 1.1, top * 1.1, top * 1.1, top, top, top); } }
    else { const top = shade * 1.45; for (let i = 1; i < sides - 1; i++) { pos.push(pts[0][0], pts[0][2], pts[0][1], pts[i + 1][0], pts[i + 1][2], pts[i + 1][1], pts[i][0], pts[i][2], pts[i][1]); col.push(top, top, top, top, top, top, top, top, top); } }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); g.computeBoundingSphere(); return g;
}
// layered strata block: stacked jagged prisms with sharp horizontal ledges (far rim cliffs, hill ledges)
export function strataGeom(seed, layers = 3, sides = 7) {
  const r = seeded(seed); const pos = [], col = []; const h = 1 / layers;
  for (let k = 0; k < layers; k++) {
    const y0 = k * h - 0.15, y1 = (k + 1) * h; const cx = (r() - 0.5) * 0.15 * k, cz = (r() - 0.5) * 0.15 * k; const R = 1 - k * 0.2;
    const pts = []; for (let i = 0; i < sides; i++) { const a = i / sides * Math.PI * 2 + r() * 0.3; const rad = R * (0.72 + r() * 0.4); pts.push([cx + Math.cos(a) * rad, cz + Math.sin(a) * rad]); }
    const shade = 0.13 + r() * 0.04;
    for (let i = 0; i < sides; i++) { const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % sides]; const t0 = shade * 0.55, t1 = shade * 1.0;
      pos.push(ax, y0, az, bx, y1 * 0.98 + y0 * 0.02, bz, bx, y0, bz, ax, y0, az, ax, y1, az, bx, y1 * 0.98 + y0 * 0.02, bz); col.push(t0, t0, t0, t1, t1, t1, t0, t0, t0, t0, t0, t0, t1, t1, t1, t1, t1, t1); }
    const top = shade * 1.45; for (let i = 1; i < sides - 1; i++) { pos.push(pts[0][0], y1, pts[0][1], pts[i + 1][0], y1, pts[i + 1][1], pts[i][0], y1, pts[i][1]); col.push(top, top, top, top, top, top, top, top, top); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); g.computeBoundingSphere(); return g;
}

function rockMaterial(fog = true, bump = 2.2, smooth = false, key = 0.0, far = false) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: !smooth, roughness: 0.95, metalness: 0.0, fog }); m.color.setScalar(0.82); m.customProgramCacheKey = () => 'rock' + bump + fog + smooth + key + far;
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <project_vertex>', `#include <project_vertex>
      #ifdef USE_INSTANCING
        vWP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
      #else
        vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;
      #endif`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWP;
      float hh(vec2 p){ p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), f.x), f.y); }
      float vor(vec2 p){ vec2 i = floor(p), f = fract(p); float m1 = 8., m2 = 8.; for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 o = vec2(x, y); vec2 r = o + vec2(hh(i + o), hh(i + o + 17.3)) - f; float dd = dot(r, r); if (dd < m1) { m2 = m1; m1 = dd; } else if (dd < m2) m2 = dd; } return sqrt(m2) - sqrt(m1); }
      float crH(vec3 w){ vec2 a = w.xz * 5.0 + w.y * 3.3, c = vec2(w.x + w.y * 0.8, w.z - w.y * 0.8) * 11.0; return vn(a) * 0.45 + vn(c) * 0.3 + vn(a * 4.3) * 0.17 + vn(c * 3.1) * 0.08; }
      float farH(vec3 w){ float sb = smoothstep(0.25, 0.75, vn(vec2(w.y * 0.55, (w.x + w.z) * 0.03))); float cn = vn(w.xz * 0.3 + w.y * 0.45) * 0.7 + vn(w.xz * 0.9 - w.y * 0.8) * 0.3; return sb * 0.5 + cn * 0.5; }
      float rkH(vec3 w){ vec2 a = w.xz * 2.3 + w.y * 1.7, b = vec2(w.x + w.y * 0.7, w.z - w.y * 0.7) * 3.1; return vor(a) * 0.55 + vor(b) * 0.3 + vn(a * 4.0) * 0.15; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      { float d = length(vWP - cameraPosition); float fd = 1.0 - smoothstep(30.0, 120.0, d); vec2 q = vWP.xz * 1.9 + vWP.yy * 1.3;
        float n = vn(q) * 0.5 + vn(q * 3.7) * 0.3 + vn(q * 11.0) * 0.2; diffuseColor.rgb *= mix(1.0, 0.72 + 0.56 * n, fd * ${smooth ? '0.6' : '1.0'});
        ${far ? 'float fdd = smoothstep(25.0, 60.0, d); float fh = farH(vWP); diffuseColor.rgb *= mix(1.0, 0.72 + 0.55 * fh, fdd);' : ''}
        ${smooth ? 'float ck = crH(vWP); diffuseColor.rgb *= mix(1.0, 0.92 + 0.14 * ck, fd);' : 'float ck = rkH(vWP); diffuseColor.rgb *= mix(1.0, 0.55 + 0.6 * smoothstep(0.08, 0.42, ck), fd);'} }`)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
      { // crumbly micro-relief: derivative bump from a cellular/fbm height (no extra geometry)
        float d = length(vWP - cameraPosition); float fb = 1.0 - smoothstep(10.0, 70.0, d);
        if (fb > 0.01) { vec3 sp = -vViewPosition; vec3 sx = dFdx(sp), sy = dFdy(sp); vec3 R1 = cross(sy, normal), R2 = cross(normal, sx); float det = dot(sx, R1);
          float H = ${smooth ? 'crH(vWP)' : 'rkH(vWP)'}; float dhx = dFdx(H), dhy = dFdy(H); vec3 grad = sign(det) * (dhx * R1 + dhy * R2); normal = normalize(mix(normal, normalize(abs(det) * normal - grad * ${bump.toFixed(2)}), fb)); }
        ${far ? 'float ffb = smoothstep(25.0, 60.0, d); if (ffb > 0.01) { vec3 sp = -vViewPosition; vec3 sx = dFdx(sp), sy = dFdy(sp); vec3 R1 = cross(sy, normal), R2 = cross(normal, sx); float det = dot(sx, R1); float H = farH(vWP) * 1.6; vec3 grad = sign(det) * (dFdx(H) * R1 + dFdy(H) * R2); normal = normalize(mix(normal, normalize(abs(det) * normal - grad), ffb * 0.8)); }' : ''} }`)
      .replace('#include <opaque_fragment>', `${key > 0 ? `{ vec3 kd = normalize((viewMatrix * vec4(${KEY}, 0.0)).xyz); outgoingLight += diffuseColor.rgb * vec3(1.0, 0.96, 0.9) * ${key.toFixed(2)} * max(dot(normal, kd), 0.0); }` : ''}
      #include <opaque_fragment>`);
  };
  return m;
}

// rock-only soft key light from the concept camera's upper-left/front (concept: foreground rocks sunlit from the left)
const KEY = (() => { const v = new THREE.Vector3(-Rt.x * 0.65 - F.x * 0.35, 0.72, -Rt.z * 0.65 - F.z * 0.35).normalize(); return `vec3(${v.x.toFixed(3)}, ${v.y.toFixed(3)}, ${v.z.toFixed(3)})`; })();
// main rover track: from just ahead of the concept camera, curving down the lookout to the hub (concept: track from the bottom centre)
export const TRACK_MAIN = (t) => sd(0.3 + Math.sin(t * 2.6) * 3 - t * 3, -52.6 + t * 41.6);
const TRACK_PTS = Array.from({ length: 47 }, (_, i) => TRACK_MAIN(i / 46)); const nearTrack = (x, z, w) => TRACK_PTS.some(p => Math.hypot(p.x - x, p.z - z) < w);
const CLEAR = sd(-3, -21.5);
function blocked(x, z, pad) { if (Math.hypot(x - CLEAR.x, z - CLEAR.z) < 2.5 + pad * 0.5) return true; for (const c of colliders) if (Math.hypot(x - c.x, z - c.z) < c.r + pad) return true; return false; }

// ---------- per-frame area culling + distance LOD for instanced rocks (constant draw calls) ----------
export class InstanceCuller {
  constructor() { this.kinds = []; this.frustum = new THREE.Frustum(); this.pm = new THREE.Matrix4(); this.last = new THREE.Matrix4(); this.lastPos = new THREE.Vector3(1e9, 0, 0); this.sphere = new THREE.Sphere(); }
  add(kind) { this.kinds.push(kind); return kind; }
  update(camera, force = false) {
    camera.updateMatrixWorld();
    const moved = camera.position.distanceToSquared(this.lastPos) > 0.5; const turned = !this.last.equals(camera.matrixWorld);
    if (!force && !moved && !turned) return; this.lastPos.copy(camera.position); this.last.copy(camera.matrixWorld);
    this.pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); this.frustum.setFromProjectionMatrix(this.pm);
    const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
    for (const k of this.kinds) {
      const counts = k.lods.map(() => 0); const arr = k.lods.map(l => l.mesh.instanceMatrix.array);
      for (const it of k.items) {
        const d2 = ((it.x - cx) ** 2 + (it.y - cy) ** 2 + (it.z - cz) ** 2) * it.lodK; // size-aware LOD: small rocks drop detail sooner
        let li = -1; for (let i = 0; i < k.lods.length; i++) if (d2 < k.lods[i].d2) { li = i; break; }
        if (li < 0) continue;
        this.sphere.center.set(it.x, it.y, it.z); this.sphere.radius = it.r + 2.5;
        if (!this.frustum.intersectsSphere(this.sphere)) continue;
        arr[li].set(it.m, counts[li] * 16); counts[li]++;
      }
      k.lods.forEach((l, i) => { l.mesh.count = counts[i]; l.mesh.visible = counts[i] > 0; l.mesh.instanceMatrix.needsUpdate = true; l.mesh.instanceMatrix.clearUpdateRanges?.(); });
    }
  }
  stats() { const o = {}; for (const k of this.kinds) o[k.name] = k.lods.map(l => l.mesh.count + '×' + (l.mesh.geometry.attributes.position.count / 3)); return o; }
}
function makeKind(scene, name, lods, items, mat, castShadow) {
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const single = lods.length === 1; const its = items.map(o => { q.setFromEuler(e.set(o.r[0], o.r[1], o.r[2])); m4.compose(new THREE.Vector3(o.x, o.y, o.z), q, new THREE.Vector3(...o.s)); const r = Math.max(...o.s) * 1.6; const sn = Math.min(1, Math.max(0.3, r / 2.4)); return { x: o.x, y: o.y, z: o.z, r, lodK: o.lodK ?? (single ? 1 : 1 / (sn * sn)), m: m4.toArray() }; });
  const kind = { name, items: its, lods: lods.map(([g, dist], i) => { const im = new THREE.InstancedMesh(g, mat, Math.max(1, its.length)); im.count = 0; im.frustumCulled = false; im.castShadow = typeof castShadow === 'number' ? i < castShadow : (castShadow && i === 0 || castShadow === 'all'); im.receiveShadow = true; im.name = name + '_lod' + i; scene.add(im); return { mesh: im, d2: dist * dist }; }) };
  return kind;
}

export function buildRocks(scene, culler, quality = 1) {
  const mat = rockMaterial(true, 2.2, false, 0.9, true); mat.color.setScalar(1.15); const matFar = rockMaterial(true, 0.16, true, 1.3); matFar.flatShading = true; matFar.color.setScalar(1.5); const matWall = rockMaterial(true, 1.2, false, 0.35, true); matWall.color.setScalar(1.2);
  const L = { crumb: [], pebble: [], rubble: [], bA: [], bB: [], bC: [], cliff: [], peak: [], wall: [] };
  const K = CONCEPT; const cgy = groundAt(K.cat.x, K.cat.z); const ccam = new THREE.PerspectiveCamera(K.fov, 16 / 9, 0.2, 5000);
  ccam.position.set(K.cam.x, cgy + K.eye, K.cam.z); ccam.lookAt(K.target.x, cgy + K.eye - K.drop, K.target.z); ccam.updateMatrixWorld(); ccam.updateProjectionMatrix();
  const _v = new THREE.Vector3();
  // keep the concept framing readable: nothing may cover the base silhouette / beacon / cat
  const occludes = (x, z, top) => { const dist = Math.hypot(x - K.cam.x, z - K.cam.z); if (dist > 54 || dist < 1) return false; _v.set(x, top, z).project(ccam); if (_v.z > 1) return false; const px = (_v.x * 0.5 + 0.5) * 1024, py = (0.5 - _v.y * 0.5) * 576; return (px > 265 && px < 850 && py < 440 && py > 40) || (dist < 42 && px > 740 && py < 330) || (dist < 37 && px > 720 && px < 940 && py > 280 && py < 500) || (dist < 6 && px > 60 && px < 330 && py < 560); };
  const put = (list, x, z, s, sink = 0.3, tilt = 0.35, sy = 1) => { const f = s * 0.8; const y = Math.min(groundAt(x, z), groundAt(x + f, z), groundAt(x - f, z), groundAt(x, z + f), groundAt(x, z - f)) - s * sink; list.push({ x, y, z, s: [s * (0.8 + rnd() * 0.5), s * (0.65 + rnd() * 0.55) * sy, s * (0.8 + rnd() * 0.5)], r: [(rnd() - 0.5) * tilt, rnd() * Math.PI * 2, (rnd() - 0.5) * tilt] }); };
  const bl = () => [L.bA, L.bB, L.bC][Math.floor(rnd() * 3)];
  const viewOK = (x, z, s, k = 0.85) => !occludes(x, z, groundAt(x, z) + s * k);
  // rock clusters: a few boulders surrounded by rubble (like the concept's chunky ground)
  const clusters = [];
  for (let i = 0, t = 0; i < 190 * quality && t < 5000; t++) {
    const m = rnd(); let x, z;
    if (m < 0.25) { const p = sd((rnd() - 0.5) * 70, -64 + rnd() * 44); x = p.x; z = p.z; } // concept foreground band
    else if (m < 0.4) { const a = rnd() * 6.283, r = 6 + Math.sqrt(rnd()) * 18; x = LOOKOUT.x + Math.cos(a) * r; z = LOOKOUT.z + Math.sin(a) * r; }
    else if (m < 0.48) { const p = sd(-3 + (rnd() - 0.5) * 30, -21 + (rnd() - 0.5) * 22); x = p.x; z = p.z; }
    else if (m < 0.6) { const a = rnd() * 6.283, r = 12 + rnd() * 34; x = Math.cos(a) * r; z = Math.sin(a) * r; }
    else { const a = rnd() * 6.283, r = 44 + rnd() * 150; x = Math.cos(a) * r; z = Math.sin(a) * r; }
    if (blocked(x, z, 3)) continue; clusters.push([x, z]); i++;
  }
  for (const [cx, cz] of clusters) {
    const nb = 1 + Math.floor(rnd() * 3); const big = Math.hypot(cx, cz) > 70 ? 1.4 : 1;
    for (let k = 0; k < nb; k++) { const x = cx + (rnd() - 0.5) * 4, z = cz + (rnd() - 0.5) * 4; let s = (0.6 + rnd() ** 1.6 * 2.2) * big; { const dc = Math.hypot(x - K.cam.x, z - K.cam.z); if (dc < 36) s = Math.min(s, 0.45 + dc * 0.035); } if (blocked(x, z, 1.5) || Math.hypot(x - K.cat.x, z - K.cat.z) < 2.2 || !viewOK(x, z, s)) continue; put(bl(), x, z, s, 0.3); }
    const nr = 4 + Math.floor(rnd() * 6);
    for (let k = 0; k < nr; k++) { const a = rnd() * 6.283, r = 1 + rnd() * 5; const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; const s = 0.15 + rnd() ** 2 * 0.7; if (blocked(x, z, 0.6) || !viewOK(x, z, s, 0.6)) continue; put(L.rubble, x, z, s, 0.25, 0.9); }
  }
  // scattered rubble everywhere in the hub + dense on the lookout
  for (let i = 0, t = 0; i < 420 * quality && t < 20000; t++) {
    const m = rnd(); let x, z;
    if (m < 0.22) { const a = rnd() * 6.283, r = Math.sqrt(rnd()) * 20; x = LOOKOUT.x + Math.cos(a) * r; z = LOOKOUT.z + Math.sin(a) * r; }
    else if (m < 0.5) { const p = sd((rnd() - 0.5) * 60, -58 + rnd() * 44); x = p.x; z = p.z; }
    else { const a = rnd() * 6.283, r = 8 + Math.sqrt(rnd()) * 110; x = Math.cos(a) * r; z = Math.sin(a) * r; }
    const s = 0.12 + rnd() ** 2.2 * 0.8; if (blocked(x, z, 0.5) || !viewOK(x, z, s, 0.6)) continue; put(L.rubble, x, z, s, 0.38, 0.45); i++;
  }
  // hand-placed hero boulders for the concept framing (bottom-left / bottom-right clusters)
  // hand-composed foreground rocks for the concept framing: placed by casting rays through screen pixels of the concept camera
  const ray = new THREE.Vector3(); const screenPut = (px, py, k, list, flat = false) => { ray.set(px / 1024 * 2 - 1, 1 - py / 576 * 2, 0.5).unproject(ccam).sub(ccam.position).normalize();
    for (let t = 0.6; t < 140; t += 0.2) { const x = ccam.position.x + ray.x * t, y = ccam.position.y + ray.y * t, z = ccam.position.z + ray.z * t; if (y < groundAt(x, z)) { if (Math.hypot(x - K.cat.x, z - K.cat.z) < 1.1) return; if (t > 30 || (flat && t > 9 && rnd() < 0.55)) return; const slab0 = list === L.peak; let sz = flat ? Math.min(k * (0.16 + t * 0.02), 0.95) : Math.min(k * t * 0.045, 1.3);
        if (flat || slab0) { const g0 = groundAt(x, z); const lim = (px > 250 && px < 880) ? 452 : 405; for (let it = 0; it < 12; it++) { _v.set(x, g0 + sz * 0.85, z).project(ccam); if ((0.5 - _v.y * 0.5) * 576 >= lim) break; sz *= 0.8; } if (sz < 0.07) return; } const slab = list === L.peak; if (nearTrack(x, z, 0.9 + (slab ? sz : 0))) return; put(list, x, z, slab ? sz * 1.15 : sz, slab ? 0.22 : flat ? 0.1 : 0.35, slab ? 0.25 : flat ? 0.22 : 0.4, slab ? 0.95 : flat ? 0.75 : 1); return; } } };
  for (const [px, py, k] of [[30, 560, 1.3], [150, 575, 1.0], [300, 560, 1.4], [400, 545, 1.0], [490, 590, 1.4], [20, 430, 1.2], [70, 470, 0.8], [330, 455, 0.9], [270, 420, 0.7], [440, 470, 0.8],
    [600, 560, 1.3], [700, 590, 1.6], [820, 560, 1.5], [930, 540, 1.3], [1010, 470, 1.3], [880, 470, 0.9], [960, 410, 1.0], [760, 470, 0.7], [640, 470, 0.6], [560, 470, 0.5],
    [340, 405, 0.5], [600, 420, 0.45], [880, 380, 0.6], [990, 360, 0.6], [250, 380, 0.55], [460, 410, 0.45]]) screenPut(px, py, k, L.peak);
  // HERO slabs: a few big sunlit chiselled rocks in the concept's bottom band; each is sized so its top projects to the art's rock top
  const heroPut = (px, py, topY, sx = 1.25) => { ray.set(px / 1024 * 2 - 1, 1 - py / 576 * 2, 0.5).unproject(ccam).sub(ccam.position).normalize();
    for (let t = 0.6; t < 60; t += 0.1) { const x = ccam.position.x + ray.x * t, y = ccam.position.y + ray.y * t, z = ccam.position.z + ray.z * t; if (y < groundAt(x, z)) {
      if (Math.hypot(x - K.cat.x, z - K.cat.z) < 1.3 || nearTrack(x, z, 1.0)) return; const g0 = groundMesh(x, z); let lo = 0.2, hi = 4;
      for (let it = 0; it < 18; it++) { const m = (lo + hi) / 2; _v.set(x, g0 + m * 0.62, z).project(ccam); if ((0.5 - _v.y * 0.5) * 576 > topY) lo = m; else hi = m; }
      const sz = lo; L.peak.push({ x, y: g0 - sz * 0.18, z, s: [sz * sx, sz * 0.8, sz * (0.9 + rnd() * 0.3)], r: [(rnd() - 0.5) * 0.12, rnd() * 6.28, (rnd() - 0.5) * 0.12] }); return; } } };
  for (const [px, py, top, sx] of [[385, 568, 412, 1.3], [480, 574, 452, 1.1], [60, 566, 468, 1.3], [215, 572, 486, 1.2], [690, 566, 482, 1.3], [770, 575, 505, 1.1], [955, 528, 412, 1.3], [1012, 478, 382, 1.1], [870, 572, 470, 1.2]]) heroPut(px, py, top, sx);
  // dense chunky foreground (concept: jagged slabs + rubble filling the bottom of the frame around the cat's ledge)
  for (let gy = 455; gy < 595; gy += 26) for (let gx = -10; gx < 1050; gx += 56) { const px = gx + (rnd() - 0.5) * 30, py = gy + (rnd() - 0.5) * 14; if (px > 20 && px < 290 && py < 500) continue; if (rnd() < 0.88) continue; screenPut(px, py, 0.8 + rnd() * 2.0, L.peak, true); }
  // rocky ledge under the cat: one big flat-topped boulder matching LEDGE (groundAt is raised there, so feet are grounded) + lower stepped rocks at its front/right edge
  { const gb = Math.min(groundMesh(LEDGE.x, LEDGE.z), groundMesh(LEDGE.x + 1.4, LEDGE.z), groundMesh(LEDGE.x - 1.4, LEDGE.z), groundMesh(LEDGE.x, LEDGE.z + 1.4), groundMesh(LEDGE.x, LEDGE.z - 1.4)); const top = gb + LEDGE.h;
    L.peak.push({ x: LEDGE.x, y: top - 0.53 * 1.1, z: LEDGE.z, s: [1.5, 1.1, 1.6], r: [0, 0.4, 0] });
    for (const [ds, dd, s0, hh] of [[1.3, 0.9, 0.75, 0.3], [0.2, 1.5, 0.65, 0.22], [1.6, -0.5, 0.6, 0.26], [-1.4, 1.2, 0.7, 0.3], [0.9, 2.0, 0.45, 0.12]]) {
      const p = sd(ds, dd), o = sd(0, 0); const x = LEDGE.x + p.x - o.x, z = LEDGE.z + p.z - o.z; const g0 = groundMesh(x, z); L.peak.push({ x, y: g0 + hh - 0.53 * s0, z, s: [s0 * 1.1, s0, s0], r: [0, rnd() * 6.28, 0] }); } }
  // rocky texture left of the cat: layered slabs on the hill side seen at the left edge of the concept frame
  for (let i = 0; i < 24; i++) { const px = rnd() * 120, py = 250 + rnd() * 300; ray.set(px / 1024 * 2 - 1, 1 - py / 576 * 2, 0.5).unproject(ccam).sub(ccam.position).normalize();
    for (let t = 0.6; t < 90; t += 0.3) { const x = ccam.position.x + ray.x * t, y = ccam.position.y + ray.y * t, z = ccam.position.z + ray.z * t; if (y < groundAt(x, z)) { if (Math.hypot(x - K.cat.x, z - K.cat.z) < 1.4) break; const sz = Math.min(0.5 + t * 0.06, 2.6) * (0.5 + rnd() * 0.8); put(L.peak, x, z, sz, 0.3, 0.35, 0.7 + rnd() * 0.4); break; } } }
  for (let i = 0; i < 90; i++) { const px = rnd() * 1024, py = 420 + rnd() * 160; if (px > 20 && px < 290 && py < 500) continue; screenPut(px, py, 0.3 + rnd() * 0.5, L.rubble, true); }
  // cliff slabs on steep slopes (jagged faceted rims / crater walls)
  for (let i = 0, t = 0; i < 140 * quality && t < 60000; t++) {
    const a = rnd() * 6.283, r = 50 + rnd() ** 1.3 * 650; const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const sl = slopeAt(x, z); if (sl < 0.3 || blocked(x, z, 6) || Math.hypot(x - PORTAL.x, z - PORTAL.z) < 20 || Math.hypot(x - (PORTAL.x + CAVE.x) / 2, z - (PORTAL.z + CAVE.z) / 2) < 22 || Math.hypot(x - CAVE.x, z - CAVE.z) < 16 || Math.hypot(x - LOOKOUT.x, z - LOOKOUT.z) < 30) continue;
    const s = (r < 150 ? 2 : 4) + rnd() * (r < 150 ? 5 : 11); if (!viewOK(x, z, s, 1.1)) continue; put(L.cliff, x, z, s, 0.62, 0.3, 1.0); i++;
  }
  // portal crater wall: extra jagged slabs around the cave mouth
  for (let i = 0; i < 26; i++) { const a = (i / 26 - 0.5) * 2.8; const yaw = Math.atan2(-0.592, 0.806) * 0 + 0; const p = { x: CAVE.x + Math.cos(a + 0.6) * (13 + rnd() * 9), z: CAVE.z + Math.sin(a + 0.6) * (13 + rnd() * 9) }; if (Math.hypot(p.x - PORTAL.x, p.z - PORTAL.z) < 16) continue; { const ux = CAVE.x - PORTAL.x, uz = CAVE.z - PORTAL.z, ul = Math.hypot(ux, uz); const tt = Math.max(0, Math.min(1.6, ((p.x - PORTAL.x) * ux + (p.z - PORTAL.z) * uz) / (ul * ul))); if (Math.hypot(p.x - PORTAL.x - ux * tt, p.z - PORTAL.z - uz * tt) < 13) continue; } put(L.cliff, p.x, p.z, 3 + rnd() * 4, 0.4, 0.8, 1.2); }
  // jagged distant mountain rim (big faceted peaks)
  for (let i = 0; i < 70; i++) { const a = rnd() * 6.283, r = 280 + rnd() * 400; const s0 = 9 + rnd() * 11; const tilt = (rnd() - 0.5) * 0.35;
    for (let k = 0; k < 3; k++) { const rr = r + k * s0 * 0.7 + (rnd() - 0.5) * 6, aa = a + (rnd() - 0.5) * 0.05; const x = Math.cos(aa) * rr, z = Math.sin(aa) * rr; const s = s0 * (1 - k * 0.18);
      const gy = Math.min(groundAt(x, z), groundAt(x + Math.sin(aa) * s * 1.5, z - Math.cos(aa) * s * 1.5), groundAt(x - Math.sin(aa) * s * 1.5, z + Math.cos(aa) * s * 1.5)); L.wall.push({ x, y: gy - s * 0.25 + k * s0 * 0.3, z, s: [s * (1.6 + rnd() * 0.8), s * (0.9 + rnd() * 0.6), s * (0.9 + rnd() * 0.4)], r: [tilt * 0.3 + (rnd() - 0.5) * 0.06, -aa + Math.PI / 2 + (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.25] }); } }
  // crater walls: tall layered cliffs ringing the hub (r 105-175), gaps toward the outer regions
  { const gaps = Object.values(REGIONS).map(R => Math.atan2(R.z, R.x));
    for (let i = 0; i < 170; i++) { const a = i / 170 * Math.PI * 2 + (rnd() - 0.5) * 0.04; if (gaps.some(g => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < 0.1)) continue;
      const r0 = 105 + rnd() * 60; const s0 = 5 + rnd() * 8;
      for (let k = 0; k < 2; k++) { const rr = r0 + k * s0 * 0.9 + rnd() * 4, aa = a + (rnd() - 0.5) * 0.02; const x = Math.cos(aa) * rr, z = Math.sin(aa) * rr; const s = s0 * (1 - k * 0.15);
        const gy = Math.min(groundAt(x, z), groundAt(x + Math.sin(aa) * s, z - Math.cos(aa) * s), groundAt(x - Math.sin(aa) * s, z + Math.cos(aa) * s));
        const hy = Math.min(s * (0.85 + rnd() * 0.9), 20); L.wall.push({ x, y: gy + k * 2.5 + hy * 0.25, z, s: [s * (2.3 + rnd() * 1.0), hy, s * (0.9 + rnd() * 0.4)], r: [(rnd() - 0.5) * 0.08, -aa + Math.PI / 2 + (rnd() - 0.5) * 0.35, (rnd() - 0.5) * 0.15], lodK: k ? 100 : undefined /* back layer: always the cheap 20-tri LOD */ }); } } }
  // crumbs: dense angular fragments in the concept foreground, the lookout and the gameplay start area
  for (let i = 0, t = 0; i < 1200 * quality && t < 40000; t++) { const m = rnd(); let x, z;
    if (m < 0.22) { const p = sd((rnd() - 0.5) * 34, -60 + rnd() * 22); x = p.x; z = p.z; } else if (m < 0.8) { const p = sd(-3 + (rnd() - 0.5) * 36, -21 + (rnd() - 0.5) * 30); x = p.x; z = p.z; } else { const a = rnd() * 6.283, r = 8 + Math.sqrt(rnd()) * 60; x = Math.cos(a) * r; z = Math.sin(a) * r; }
    if (blocked(x, z, 0.2)) continue; const s = 0.05 + rnd() ** 2.5 * 0.3; put(L.crumb, x, z, s, 0.42, 0.3); i++; }
  // pebbles: dense small stones across the hub floor (gameplay view)
  for (let i = 0, t = 0; i < 1400 * quality && t < 30000; t++) { const a = rnd() * 6.283, r = 6 + Math.sqrt(rnd()) * 70; const x = Math.cos(a) * r, z = Math.sin(a) * r; if (blocked(x, z, 0.3)) continue; const s = 0.1 + rnd() ** 2 * 0.4; put(L.pebble, x, z, s, 0.3, 1.2); i++; }
  // gameplay area: scattered small stones + small crater rims of rocks around the hub
  for (let i = 0, t = 0; i < 420 * quality && t < 8000; t++) { const p = sd(-3 + (rnd() - 0.5) * 34, -21 + (rnd() - 0.5) * 30); if (blocked(p.x, p.z, 0.4)) continue; put(L.rubble, p.x, p.z, 0.07 + rnd() ** 2 * 0.3, 0.3, 0.8); i++; }
  for (let c = 0, t = 0; c < 16 && t < 400; t++) { const a = rnd() * 6.283, r = 12 + rnd() * 34; const cx = Math.cos(a) * r, cz = Math.sin(a) * r; const cr = 1.4 + rnd() * 2.4; if (blocked(cx, cz, cr + 1)) continue; c++;
    const n = Math.round(cr * 7); for (let k = 0; k < n; k++) { const b = k / n * 6.283 + rnd() * 0.3; const rr = cr * (0.92 + rnd() * 0.2); const x = cx + Math.cos(b) * rr, z = cz + Math.sin(b) * rr; put(L.bB, x, z, 0.16 + rnd() * 0.22, 0.35, 0.6, 0.7); } }
  // merge lists: two prototypes (3 LODs each), one debris layer, one strata layer -> 8 instanced draws total
  const half = (l) => [l.filter((_, i) => i % 2 === 0), l.filter((_, i) => i % 2 === 1)]; const [c0, c1] = half(L.cliff);
  const A = [...L.bA, ...L.bC, ...L.bB, ...c0, ...c1]; // one boulder prototype (saves 3 main + 2 shadow draws)
  const debris = [...L.rubble, ...L.pebble, ...L.crumb];
  const kinds = {
    rockA: makeKind(scene, 'rockA', [[protoGeom(2, 2, [1.25, 0.75, 1.05]), 8], [protoGeom(1, 2, [1.25, 0.75, 1.05]), 30], [protoGeom(0, 2, [1.25, 0.75, 1.05], 0.3), 200]], A, mat, 2),
    debris: makeKind(scene, 'debris', [[chiselGeom(14, 6, 0), 10]], debris, mat, 0),
    strata: makeKind(scene, 'strata', [[chiselGeom(9, 12, 2), 8], [chiselGeom(9, 12, 1), 3000]], L.peak, matFar, 0),
    wall: makeKind(scene, 'wall', [[jagGeom(protoGeom(1, 33, [1, 1, 1], 0.55), 33, 0.22), 230], [jagGeom(protoGeom(0, 33, [1, 1, 1], 0.45), 33, 0.28), 3000]], L.wall, matWall, 0),
  };
    for (const k of Object.values(kinds)) culler.add(k);
  return { kinds, counts: Object.fromEntries(Object.entries(L).map(([k, v]) => [k, v.length])) };
}

// ---------- crystals: floating gold/amber diamonds + ground clusters (amber, cyan) in ONE instanced draw ----------
function diamondGeom() {
  const n = 6, rr = 0.42, ht = 0.62, hb = 1.15; const pos = [];
  for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2; const p0 = [Math.cos(a0) * rr, 0, Math.sin(a0) * rr], p1 = [Math.cos(a1) * rr, 0, Math.sin(a1) * rr]; pos.push(...p0, 0, ht, 0, ...p1); pos.push(...p1, 0, -hb, 0, ...p0); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  // face shading gradient baked in vertex colors (bright tip, deeper base)
  const P = g.attributes.position, col = []; for (let i = 0; i < P.count; i++) { const y = P.getY(i); const t = (y + hb) / (hb + ht); col.push(0.75 + 0.25 * t, 0.75 + 0.25 * t, 0.75 + 0.25 * t); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
export function buildCrystals(scene, envMap) {
  const g = diamondGeom();
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, metalness: 0.55, roughness: 0.18, flatShading: true, emissive: '#ffffff', emissiveIntensity: 1, envMap, envMapIntensity: 1.6 });
  mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= vColor.rgb * vColor.rgb * 1.7;'); };
  const items = [];
  const gold = new THREE.Color('#f5b83a'), amber = new THREE.Color('#ff9a2e'), cyan = new THREE.Color('#5ee6ec');
  // floating gold diamonds (hub), several placed to match the concept composition
  const hubSpots = [[-27, -44, 2.6], [-17, -26, 2.2], [-9, 16, 3.5], [-3, -30, 2.4], [5.5, 27, 2.8], [16, 18, 2.6], [29, -2, 2.3], [31, 12, 2.6], [21, -24, 2.2], [-31, -12, 2.6], [-40, 18, 3.0], [40, 30, 2.6], [12, -36, 2.3], [-14, 40, 3.2], [36, -30, 2.6], [-48, -30, 2.8], [46, -8, 2.4], [-2, 48, 3],
    [-9.5, -52, 2.1], [-6, -47, 2.6], [4, -38, 2.0], [-12, -30, 3.2], [8, -18, 2.4], [17, -26, 2.0], [26, -12, 2.8], [33, 4, 3.4], [-21, -8, 2.6], [-26, 10, 3.0], [12, 6, 4.5], [-4, 6, 4.8], [20, 30, 3.6], [42, 14, 3.0], [-36, -40, 3.6], [-16, -60, 2.6]];
  for (const [s, d, h] of hubSpots) { const p = sd(s, d); items.push({ x: p.x, y: groundAt(p.x, p.z) + h, z: p.z, s: 0.55 + rnd() * 0.45, c: rnd() < 0.8 ? gold : amber, bob: true, ph: rnd() * 6 }); }
  for (let i = 0; i < 26; i++) { const a = rnd() * 6.283, r = 50 + rnd() * 120; const x = Math.cos(a) * r, z = Math.sin(a) * r; if (blocked(x, z, 4)) continue; items.push({ x, y: groundAt(x, z) + 2.5 + rnd() * 3, z, s: 0.6 + rnd() * 0.5, c: gold, bob: true, ph: rnd() * 6 }); }
  // amber ground clusters
  for (let i = 0; i < 24; i++) { const a = rnd() * 6.283, r = 48 + rnd() * 110; const cx = Math.cos(a) * r, cz = Math.sin(a) * r; if (blocked(cx, cz, 4)) continue;
    for (let k = 0; k < 4; k++) { const x = cx + (rnd() - 0.5) * 2, z = cz + (rnd() - 0.5) * 2; items.push({ x, y: groundAt(x, z) + 0.2, z, s: 0.5 + rnd() * 0.7, c: amber, tilt: (rnd() - 0.5) * 1.0, ph: rnd() * 6 }); } }
  // cyan clusters at the portal cave mouth
  for (let i = 0; i < 9; i++) { const a = (i / 9 - 0.5) * 2.2 + Math.atan2(PORTAL.z - CAVE.z, PORTAL.x - CAVE.x); const cx = CAVE.x + Math.cos(a) * 8.5, cz = CAVE.z + Math.sin(a) * 8.5;
    for (let k = 0; k < 3; k++) { const x = cx + (rnd() - 0.5) * 1.6, z = cz + (rnd() - 0.5) * 1.6; items.push({ x, y: groundAt(x, z) + 0.3, z, s: 0.6 + rnd() * 1.0, c: cyan, tilt: (rnd() - 0.5) * 0.9, ph: rnd() * 6 }); } }
  for (let i = 0; i < 40; i++) { const t = rnd(); const x = -420 + (-610 + 420) * t + (rnd() - 0.5) * 30, z = -250 + (260 + 250) * t + (rnd() - 0.5) * 30; items.push({ x, y: groundAt(x, z) + 1, z, s: 2 + rnd() * 5, c: cyan, tilt: (rnd() - 0.5) * 0.8, ph: rnd() * 6 }); }
  for (let i = 0; i < 12; i++) { const a = rnd() * 6.28; const R = REGIONS.echo; const x = R.x + Math.cos(a) * (45 + rnd() * 20), z = R.z + Math.sin(a) * (45 + rnd() * 20); items.push({ x, y: groundAt(x, z) + 1, z, s: 1.5 + rnd() * 3, c: cyan, tilt: (rnd() - 0.5) * 0.6, ph: 0 }); }
  for (let i = items.length - 1; i >= 0; i--) { const it = items[i]; if (!it.bob && Math.hypot(it.x - CONCEPT.cam.x, it.z - CONCEPT.cam.z) < 12) items.splice(i, 1); }
  // concept composition: floating diamonds at the concept's screen spots/sizes; drop procedural ones that would read big in that shot
  { const K = CONCEPT; const cgy = groundAt(K.cat.x, K.cat.z); const cc = new THREE.PerspectiveCamera(K.fov, 16 / 9, 0.2, 5000); cc.position.set(K.cam.x, cgy + K.eye, K.cam.z); cc.lookAt(K.target.x, cgy + K.eye - K.drop, K.target.z); cc.updateMatrixWorld(); cc.updateProjectionMatrix();
    const v = new THREE.Vector3(); const k = 2 * Math.tan(K.fov * Math.PI / 360) / 576;
    for (let i = items.length - 1; i >= 0; i--) { const it = items[i]; if (!it.bob) continue; v.set(it.x, it.y, it.z); const t = v.distanceTo(cc.position); v.project(cc); if (v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 && 1.9 * it.s / (t * k) > 20) items.splice(i, 1); }
    for (const [px, py, hp, t] of [[62, 268, 62, 7], [330, 262, 30, 24], [348, 214, 15, 58], [410, 372, 30, 28], [618, 254, 15, 70], [805, 248, 20, 72], [875, 336, 28, 42], [952, 338, 46, 20], [918, 394, 30, 30], [470, 300, 14, 50], [700, 300, 16, 55]]) {
      v.set(px / 512 - 1, 1 - py / 288, 0.5).unproject(cc).sub(cc.position).normalize(); const x = cc.position.x + v.x * t, y = cc.position.y + v.y * t, z = cc.position.z + v.z * t;
      items.push({ x, y: Math.max(y, groundAt(x, z) + 0.6), z, s: hp * t * k / 1.9, c: rnd() < 0.85 ? gold : amber, bob: true, ph: rnd() * 6 }); } }
  const im = new THREE.InstancedMesh(g, mat, items.length);
  items.forEach((it, i) => im.setColorAt(i, it.c));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const update = (t) => { items.forEach((it, i) => { if (!it.bob && t > 0) return; const y = it.bob ? it.y + Math.sin(t * 1.3 + it.ph) * 0.2 : it.y; q.setFromEuler(e.set(it.tilt || 0, it.bob ? t * 0.5 + it.ph : it.ph, 0)); m4.compose(v.set(it.x, y, it.z), q, sc.set(it.s, it.s * 1.08, it.s)); im.setMatrixAt(i, m4); }); im.instanceMatrix.needsUpdate = true; };
  update(0); im.frustumCulled = false; im.castShadow = false; im.name = 'crystals'; scene.add(im);
  return { mesh: im, update, items };
}

export function beamMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    vertexShader: `attribute vec3 color; varying vec3 vC; varying vec2 vUv; varying float vF; varying float vY;
      void main(){ vC=color; vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.); vec3 n=normalize(normalMatrix*normal); vF=abs(dot(n,normalize(-mv.xyz))); vY=position.y; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform float uTime; varying vec3 vC; varying vec2 vUv; varying float vF; varying float vY;
      void main(){ float fade=pow(1.-vUv.y,2.6)*smoothstep(0.,0.03,vUv.y+0.02); float core=pow(vF,2.0); float fl=0.85+0.15*sin(uTime*3.+vY*0.4);
        gl_FragColor=vec4(vC*fade*core*fl,1.); }`,
  });
}
export function addBeams(b, beams) {
  for (const B of beams) b.add('beam', new THREE.CylinderGeometry(B.r * (B.taper ?? 1), B.r * 1.05, B.h, 12, 1, true).translate(0, B.h / 2, 0), { pos: [B.x, B.y, B.z], color: B.color, intensity: B.I });
}

// ---------- rover tire tracks: textured ribbons hugging the terrain ----------
export function buildTracks(scene, paths) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d');
  // one wide tread band with chevron lugs (concept: a single caterpillar trail, not twin rails)
  x.clearRect(0, 0, 64, 64); x.filter = 'blur(0.6px)'; x.fillStyle = 'rgba(30,29,28,0.18)'; x.fillRect(10, 0, 44, 64);
  x.fillStyle = 'rgba(18,17,16,0.36)'; for (let y = 0; y < 64; y += 8) { x.beginPath(); x.moveTo(12, y); x.lineTo(32, y + 4); x.lineTo(52, y); x.lineTo(52, y + 3.5); x.lineTo(32, y + 7.5); x.lineTo(12, y + 3.5); x.fill(); }
  x.fillStyle = 'rgba(230,225,215,0.14)'; x.fillRect(7, 0, 3, 64); x.fillRect(54, 0, 3, 64); x.filter = 'none';
  const tex = new THREE.CanvasTexture(c); tex.wrapS = THREE.ClampToEdgeWrapping; tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const pos = [], uv = [];
  for (const pts of paths) {
    let acc = 0; const W = 0.42;
    for (let i = 0; i < pts.length - 1; i++) {
      const A = pts[i], B = pts[i + 1]; const dx = B.x - A.x, dz = B.z - A.z, l = Math.hypot(dx, dz); const nx = -dz / l * W, nz = dx / l * W;
      const p = (P, s) => { const px = P.x + nx * s, pz = P.z + nz * s; return [px, groundAt(px, pz) + 0.05, pz]; };
      const a1 = p(A, -1), a2 = p(A, 1), b1 = p(B, -1), b2 = p(B, 1); const v0 = acc / 1.2, v1 = (acc + l) / 1.2; acc += l;
      pos.push(...a1, ...b1, ...a2, ...a2, ...b1, ...b2); uv.push(0, v0, 0, v1, 1, v0, 1, v0, 0, v1, 1, v1);
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 1, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; mesh.name = 'tracks'; mesh.renderOrder = 2; scene.add(mesh); return mesh;
}
