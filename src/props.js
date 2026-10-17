import * as THREE from 'three';
import { groundAt, slopeAt, LOOKOUT, REGIONS, sd, CONCEPT, CAVE, PORTAL } from './terrain.js';
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
    for (let k = 0; k < 3; k++) { const y = P.getY(f + k); const ao = THREE.MathUtils.clamp(0.55 + (y + 0.35) * 0.45, 0.5, 1.05); const c = base * ao; col[(f + k) * 3] = c; col[(f + k) * 3 + 1] = c * 0.995; col[(f + k) * 3 + 2] = c * 1.02; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

function rockMaterial(fog = true) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0.0, fog });
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
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      { float d = length(vWP - cameraPosition); float fd = 1.0 - smoothstep(30.0, 120.0, d); vec2 q = vWP.xz * 1.9 + vWP.yy * 1.3;
        float n = vn(q) * 0.5 + vn(q * 3.7) * 0.3 + vn(q * 11.0) * 0.2; diffuseColor.rgb *= mix(1.0, 0.72 + 0.56 * n, fd); }`);
  };
  return m;
}

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
        const d2 = (it.x - cx) ** 2 + (it.y - cy) ** 2 + (it.z - cz) ** 2;
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
  const its = items.map(o => { q.setFromEuler(e.set(o.r[0], o.r[1], o.r[2])); m4.compose(new THREE.Vector3(o.x, o.y, o.z), q, new THREE.Vector3(...o.s)); return { x: o.x, y: o.y, z: o.z, r: Math.max(...o.s) * 1.6, m: m4.toArray() }; });
  const kind = { name, items: its, lods: lods.map(([g, dist], i) => { const im = new THREE.InstancedMesh(g, mat, Math.max(1, its.length)); im.count = 0; im.frustumCulled = false; im.castShadow = castShadow && i === 0 || (castShadow === 'all'); im.receiveShadow = true; im.name = name + '_lod' + i; scene.add(im); return { mesh: im, d2: dist * dist }; }) };
  return kind;
}

export function buildRocks(scene, culler, quality = 1) {
  const mat = rockMaterial(); const matFar = rockMaterial();
  const L = { crumb: [], pebble: [], rubble: [], bA: [], bB: [], bC: [], cliff: [], peak: [] };
  const K = CONCEPT; const cgy = groundAt(K.cat.x, K.cat.z); const ccam = new THREE.PerspectiveCamera(K.fov, 16 / 9, 0.2, 5000);
  ccam.position.set(K.cam.x, cgy + K.eye, K.cam.z); ccam.lookAt(K.target.x, cgy + K.eye - K.drop, K.target.z); ccam.updateMatrixWorld(); ccam.updateProjectionMatrix();
  const _v = new THREE.Vector3();
  // keep the concept framing readable: nothing may cover the base silhouette / beacon / cat
  const occludes = (x, z, top) => { const dist = Math.hypot(x - K.cam.x, z - K.cam.z); if (dist > 54 || dist < 1) return false; _v.set(x, top, z).project(ccam); if (_v.z > 1) return false; const px = (_v.x * 0.5 + 0.5) * 1024, py = (0.5 - _v.y * 0.5) * 576; return (px > 265 && px < 850 && py < 372 && py > 40) || (dist < 42 && px > 740 && py < 330) || (dist < 37 && px > 720 && px < 940 && py > 280 && py < 500) || (dist < 6 && px > 60 && px < 330 && py < 560); };
  const put = (list, x, z, s, sink = 0.3, tilt = 0.35, sy = 1) => { const y = groundAt(x, z) - s * sink; list.push({ x, y, z, s: [s * (0.8 + rnd() * 0.5), s * (0.65 + rnd() * 0.55) * sy, s * (0.8 + rnd() * 0.5)], r: [(rnd() - 0.5) * tilt, rnd() * Math.PI * 2, (rnd() - 0.5) * tilt] }); };
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
  for (let i = 0, t = 0; i < 650 * quality && t < 20000; t++) {
    const m = rnd(); let x, z;
    if (m < 0.22) { const a = rnd() * 6.283, r = Math.sqrt(rnd()) * 20; x = LOOKOUT.x + Math.cos(a) * r; z = LOOKOUT.z + Math.sin(a) * r; }
    else if (m < 0.5) { const p = sd((rnd() - 0.5) * 60, -58 + rnd() * 44); x = p.x; z = p.z; }
    else { const a = rnd() * 6.283, r = 8 + Math.sqrt(rnd()) * 110; x = Math.cos(a) * r; z = Math.sin(a) * r; }
    const s = 0.12 + rnd() ** 2.2 * 0.8; if (blocked(x, z, 0.5) || !viewOK(x, z, s, 0.6)) continue; put(L.rubble, x, z, s, 0.25, 0.55); i++;
  }
  // hand-placed hero boulders for the concept framing (bottom-left / bottom-right clusters)
  // hand-composed foreground rocks for the concept framing: placed by casting rays through screen pixels of the concept camera
  const ray = new THREE.Vector3(); const screenPut = (px, py, k, list) => { ray.set(px / 1024 * 2 - 1, 1 - py / 576 * 2, 0.5).unproject(ccam).sub(ccam.position).normalize();
    for (let t = 1; t < 140; t += 0.25) { const x = ccam.position.x + ray.x * t, y = ccam.position.y + ray.y * t, z = ccam.position.z + ray.z * t; if (y < groundAt(x, z)) { if (Math.hypot(x - K.cat.x, z - K.cat.z) < 1.6) return; if (t > 30) return; put(list || bl(), x, z, Math.min(k * t * 0.055, 1.5), 0.35, 0.4); return; } } };
  for (const [px, py, k] of [[30, 560, 1.3], [150, 575, 1.0], [300, 560, 1.4], [400, 545, 1.0], [490, 590, 1.4], [20, 430, 1.2], [70, 470, 0.8], [330, 455, 0.9], [270, 420, 0.7], [440, 470, 0.8],
    [600, 560, 1.3], [700, 590, 1.6], [820, 560, 1.5], [930, 540, 1.3], [1010, 470, 1.3], [880, 470, 0.9], [960, 410, 1.0], [760, 470, 0.7], [640, 470, 0.6], [560, 470, 0.5],
    [340, 405, 0.5], [600, 420, 0.45], [880, 380, 0.6], [990, 360, 0.6], [250, 380, 0.55], [460, 410, 0.45]]) screenPut(px, py, k);
  // cliff slabs on steep slopes (jagged faceted rims / crater walls)
  for (let i = 0, t = 0; i < 300 * quality && t < 60000; t++) {
    const a = rnd() * 6.283, r = 50 + rnd() ** 1.3 * 650; const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const sl = slopeAt(x, z); if (sl < 0.3 || blocked(x, z, 6) || Math.hypot(x - PORTAL.x, z - PORTAL.z) < 20 || Math.hypot(x - LOOKOUT.x, z - LOOKOUT.z) < 30) continue;
    const s = (r < 150 ? 2 : 4) + rnd() * (r < 150 ? 5 : 11); if (!viewOK(x, z, s, 1.1)) continue; put(L.cliff, x, z, s, 0.62, 0.3, 1.0); i++;
  }
  // portal crater wall: extra jagged slabs around the cave mouth
  for (let i = 0; i < 26; i++) { const a = (i / 26 - 0.5) * 2.8; const yaw = Math.atan2(-0.592, 0.806) * 0 + 0; const p = { x: CAVE.x + Math.cos(a + 0.6) * (13 + rnd() * 9), z: CAVE.z + Math.sin(a + 0.6) * (13 + rnd() * 9) }; if (Math.hypot(p.x - PORTAL.x, p.z - PORTAL.z) < 16) continue; put(L.cliff, p.x, p.z, 3 + rnd() * 4, 0.4, 0.8, 1.2); }
  // jagged distant mountain rim (big faceted peaks)
  for (let i = 0; i < 75; i++) { const a = rnd() * 6.283, r = 280 + rnd() * 400; const s0 = 9 + rnd() * 11; const tilt = (rnd() - 0.5) * 0.35;
    for (let k = 0; k < 3; k++) { const rr = r + k * s0 * 0.7 + (rnd() - 0.5) * 6, aa = a + (rnd() - 0.5) * 0.05; const x = Math.cos(aa) * rr, z = Math.sin(aa) * rr; const s = s0 * (1 - k * 0.18);
      const gy = Math.min(groundAt(x, z), groundAt(x + Math.sin(aa) * s * 1.5, z - Math.cos(aa) * s * 1.5), groundAt(x - Math.sin(aa) * s * 1.5, z + Math.cos(aa) * s * 1.5)); L.peak.push({ x, y: gy - s * 0.3 + k * s0 * 0.18, z, s: [s * (1.5 + rnd() * 0.7), s * (0.42 + rnd() * 0.25), s * (0.9 + rnd() * 0.4)], r: [tilt + (rnd() - 0.5) * 0.15, -aa + Math.PI / 2 + (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.25] }); } }
  // crumbs: dense angular fragments in the concept foreground, the lookout and the gameplay start area
  for (let i = 0, t = 0; i < 2100 * quality && t < 40000; t++) { const m = rnd(); let x, z;
    if (m < 0.45) { const p = sd((rnd() - 0.5) * 34, -60 + rnd() * 22); x = p.x; z = p.z; } else if (m < 0.8) { const p = sd(-3 + (rnd() - 0.5) * 36, -21 + (rnd() - 0.5) * 30); x = p.x; z = p.z; } else { const a = rnd() * 6.283, r = 8 + Math.sqrt(rnd()) * 60; x = Math.cos(a) * r; z = Math.sin(a) * r; }
    if (blocked(x, z, 0.2)) continue; const s = 0.05 + rnd() ** 2.5 * 0.3; put(L.crumb, x, z, s, 0.3, 0.35); i++; }
  // pebbles: dense small stones across the hub floor (gameplay view)
  for (let i = 0, t = 0; i < 2600 * quality && t < 30000; t++) { const a = rnd() * 6.283, r = 6 + Math.sqrt(rnd()) * 70; const x = Math.cos(a) * r, z = Math.sin(a) * r; if (blocked(x, z, 0.3)) continue; const s = 0.1 + rnd() ** 2 * 0.4; put(L.pebble, x, z, s, 0.3, 1.2); i++; }
  const kinds = {
    rubble: makeKind(scene, 'rubble', [[rockGeom('b', 1, [1.0, 0.62, 1.1], 0.6), 45]], L.rubble, mat, false),
    bA: makeKind(scene, 'boulderA', [[rockGeom('d', 2, [1.25, 0.72, 1.05], 0.28), 38], [rockGeom(0, 2, [1.25, 0.72, 1.05], 0.28), 320]], L.bA, mat, true),
    bB: makeKind(scene, 'boulderB', [[rockGeom(1, 3, [1.0, 0.85, 1.15], 0.34), 30], [rockGeom(0, 3, [1.0, 0.85, 1.15], 0.34), 320]], L.bB, mat, true),
    bC: makeKind(scene, 'boulderC', [[rockGeom('d', 4, [1.4, 0.6, 1.1], 0.3), 38], [rockGeom(0, 4, [1.4, 0.6, 1.1], 0.3), 320]], L.bC, mat, true),
    cliff: makeKind(scene, 'cliff', [[rockGeom(1, 5, [1.3, 0.9, 0.9], 0.42), 75], [rockGeom(0, 5, [1.3, 0.9, 0.9], 0.42), 1000]], L.cliff, mat, true),
    peak: makeKind(scene, 'peak', [[rockGeom(1, 9, [1.0, 1.0, 0.9], 0.5, 0.85), 380], [rockGeom(0, 9, [1.0, 1.0, 0.9], 0.5, 0.85), 3000]], L.peak, matFar, false),
    pebble: makeKind(scene, 'pebble', [[rockGeom(-1, 12, [1.1, 0.6, 1.0], 0.45), 30]], L.pebble, mat, false),
    crumb: makeKind(scene, 'crumb', [[rockGeom(-1, 14, [1.3, 0.5, 0.9], 0.55), 17]], L.crumb, mat, false),
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
      void main(){ float fade=pow(1.-vUv.y,1.7)*smoothstep(0.,0.03,vUv.y+0.02); float core=pow(vF,2.0); float fl=0.85+0.15*sin(uTime*3.+vY*0.4);
        gl_FragColor=vec4(vC*fade*core*fl,1.); }`,
  });
}
export function addBeams(b, beams) {
  for (const B of beams) b.add('beam', new THREE.CylinderGeometry(B.r, B.r * 1.05, B.h, 12, 1, true).translate(0, B.h / 2, 0), { pos: [B.x, B.y, B.z], color: B.color, intensity: B.I });
}

// ---------- rover tire tracks: textured ribbons hugging the terrain ----------
export function buildTracks(scene, paths) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d');
  x.clearRect(0, 0, 64, 64); x.fillStyle = 'rgba(40,40,46,0.34)'; x.fillRect(6, 0, 18, 64); x.fillRect(40, 0, 18, 64);
  x.fillStyle = 'rgba(22,22,28,0.5)'; for (let y = 0; y < 64; y += 6) { x.fillRect(7, y, 16, 3); x.fillRect(41, y + 3, 16, 3); }
  x.fillStyle = 'rgba(200,196,188,0.16)'; x.fillRect(4, 0, 2, 64); x.fillRect(24, 0, 2, 64); x.fillRect(38, 0, 2, 64); x.fillRect(58, 0, 2, 64);
  const tex = new THREE.CanvasTexture(c); tex.wrapS = THREE.ClampToEdgeWrapping; tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const pos = [], uv = [];
  for (const pts of paths) {
    let acc = 0; const W = 0.95;
    for (let i = 0; i < pts.length - 1; i++) {
      const A = pts[i], B = pts[i + 1]; const dx = B.x - A.x, dz = B.z - A.z, l = Math.hypot(dx, dz); const nx = -dz / l * W, nz = dx / l * W;
      const p = (P, s) => { const px = P.x + nx * s, pz = P.z + nz * s; return [px, groundAt(px, pz) + 0.05, pz]; };
      const a1 = p(A, -1), a2 = p(A, 1), b1 = p(B, -1), b2 = p(B, 1); const v0 = acc / 2.4, v1 = (acc + l) / 2.4; acc += l;
      pos.push(...a1, ...b1, ...a2, ...a2, ...b1, ...b2); uv.push(0, v0, 0, v1, 1, v0, 1, v0, 0, v1, 1, v1);
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 1, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; mesh.name = 'tracks'; mesh.renderOrder = 2; scene.add(mesh); return mesh;
}
