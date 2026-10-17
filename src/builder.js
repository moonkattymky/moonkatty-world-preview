import * as THREE from 'three';
import { mergeGeometries } from '../vendor/three/jsm/utils/BufferGeometryUtils.js';

// Accumulates static geometry per material group, baked with vertex colors, merged into one mesh per group.
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _c = new THREE.Color();
export class Builder {
  constructor() { this.groups = {}; }
  add(group, geom, o = {}) {
    let g = geom.index ? geom.toNonIndexed() : geom.clone();
    if (o.matrix) _m.copy(o.matrix); else {
      const p = o.pos || [0, 0, 0], r = o.rot || [0, 0, 0], s = o.scale === undefined ? [1, 1, 1] : (typeof o.scale === 'number' ? [o.scale, o.scale, o.scale] : o.scale);
      if (o.quat) _q.copy(o.quat); else _q.setFromEuler(_e.set(r[0], r[1], r[2], o.order || 'YXZ'));
      _m.compose(new THREE.Vector3(...p), _q, new THREE.Vector3(...s));
    }
    g.applyMatrix4(_m);
    if (group !== 'beam') g.deleteAttribute('uv'); else if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (group === 'beam' && o.uvY !== undefined) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, o.uvY); }
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    const n = g.attributes.position.count, col = new Float32Array(n * 3);
    const I = o.intensity ?? 1;
    if (typeof o.color === 'function') { const P = g.attributes.position; for (let i = 0; i < n; i++) { const cc = o.color(P.getX(i), P.getY(i), P.getZ(i)); col[i * 3] = cc[0]; col[i * 3 + 1] = cc[1]; col[i * 3 + 2] = cc[2]; } }
    else { _c.set(o.color || '#ffffff'); for (let i = 0; i < n; i++) { col[i * 3] = _c.r * I; col[i * 3 + 1] = _c.g * I; col[i * 3 + 2] = _c.b * I; } }
    if (o.ao) { const P = g.attributes.position; const y0 = o.ao[0], y1 = o.ao[1]; for (let i = 0; i < n; i++) { const t = THREE.MathUtils.clamp((P.getY(i) - y0) / (y1 - y0), 0, 1); const f = 0.55 + 0.45 * t; col[i * 3] *= f; col[i * 3 + 1] *= f; col[i * 3 + 2] *= f; } }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (o.flip) flipGeom(g);
    (this.groups[group] ||= []).push(g);
    return g;
  }
  build(materials, parent) {
    const out = {};
    for (const [k, list] of Object.entries(this.groups)) {
      const merged = mergeGeometries(list, false); merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, materials[k]); mesh.name = 'merged_' + k;
      const lit = !['glow', 'beam'].includes(k);
      mesh.castShadow = lit; mesh.receiveShadow = lit;
      if (k === 'beam') mesh.renderOrder = 10;
      parent.add(mesh); out[k] = mesh;
    }
    return out;
  }
}
export function flipGeom(g) {
  const P = g.attributes.position, N = g.attributes.normal, C = g.attributes.color, U = g.attributes.uv;
  for (let i = 0; i < P.count; i += 3) for (const A of [P, N, C, U]) { if (!A) continue; for (let c = 0; c < A.itemSize; c++) { const t = A.array[i * A.itemSize + c]; A.array[i * A.itemSize + c] = A.array[(i + 2) * A.itemSize + c]; A.array[(i + 2) * A.itemSize + c] = t; } }
  if (N) for (let i = 0; i < N.array.length; i++) N.array[i] *= -1;
}
// geometry helpers (base at y=0 for cylinders)
export const G = {
  cyl: (rt, rb, h, seg = 24, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open).translate(0, h / 2, 0),
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  torus: (R, t, rs = 5, ts = 28, arc = Math.PI * 2) => new THREE.TorusGeometry(R, t, rs, ts, arc),
  cap: (r, ws = 28, hs = 10, theta = Math.PI / 2) => new THREE.SphereGeometry(r, ws, hs, 0, Math.PI * 2, 0, theta),
  sphere: (r, ws = 12, hs = 8) => new THREE.SphereGeometry(r, ws, hs),
  cone: (r, h, seg = 12) => new THREE.ConeGeometry(r, h, seg).translate(0, h / 2, 0),
  ring: (ri, ro, seg = 40) => new THREE.RingGeometry(ri, ro, seg).rotateX(-Math.PI / 2),
  disc: (r, seg = 40) => new THREE.CircleGeometry(r, seg).rotateX(-Math.PI / 2),
  octa: (r) => new THREE.OctahedronGeometry(r, 0),
};
export function quatFromDir(dir) { return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()); }
