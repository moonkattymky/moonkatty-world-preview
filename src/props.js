import * as THREE from 'three';
import { groundAt, heightAt, slopeAt, LOOKOUT, REGIONS, sd, CONCEPT } from './terrain.js';
import { noise2, seeded } from './noise.js';
import { colliders } from './base.js';

const rnd = seeded(2024);
export function rockGeom(detail, seed, stretch = [1, 1, 1], rough = 0.32) {
  const g = detail === 'b' ? new THREE.BoxGeometry(1.4, 1.4, 1.4).toNonIndexed() : detail === 'd' ? new THREE.DodecahedronGeometry(1, 0) : detail < 0 ? new THREE.OctahedronGeometry(1, 0) : new THREE.IcosahedronGeometry(1, detail); // non-indexed
  const P = g.attributes.position; const v = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i);
    const n = noise2(v.x * 1.7 + seed * 3.1, v.z * 1.7 + v.y * 1.3 - seed) * rough + noise2(v.y * 3.1 + seed, v.x * 2.9) * rough * 0.4;
    v.multiplyScalar(1 + n); v.x *= stretch[0]; v.y *= stretch[1]; v.z *= stretch[2];
    if (v.y < -0.35) v.y = -0.35 - (v.y + 0.35) * 0.15;
    P.setXYZ(i, v.x, v.y, v.z);
  }
  g.deleteAttribute('uv'); g.computeVertexNormals();
  const col = new Float32Array(P.count * 3); const r = seeded(seed * 97 + 5);
  for (let f = 0; f < P.count; f += 3) {
    const base = 0.27 + r() * 0.14; for (let k = 0; k < 3; k++) { const y = P.getY(f + k); const ao = THREE.MathUtils.clamp(0.55 + (y + 0.35) * 0.5, 0.5, 1.1); const c = base * ao; col[(f + k) * 3] = c * 1.0; col[(f + k) * 3 + 1] = c * 1.0; col[(f + k) * 3 + 2] = c * 1.04; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

const CLEAR = sd(-3, -24.5);
function blocked(x, z, pad) { if (Math.hypot(x - CLEAR.x, z - CLEAR.z) < 7 + pad * 0.5) return true; for (const c of colliders) if (Math.hypot(x - c.x, z - c.z) < c.r + pad) return true; return false; }
function onRoad(x, z) { return false; }

export function buildRocks(scene, quality = 1) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0.0 });
  const variants = [
    { g: rockGeom('b', 1, [1.0, 0.62, 1.1], 0.42), list: [] },     // rubble: broken stone blocks (12 tris)
    { g: rockGeom('d', 2, [1.25, 0.72, 1.05], 0.28), list: [] },  // chunky boulders (36 tris)
    { g: rockGeom('d', 3, [1.0, 0.85, 1.15], 0.34), list: [] },
    { g: rockGeom('d', 4, [1.4, 0.6, 1.1], 0.3), list: [] },
    { g: rockGeom('d', 5, [1.3, 0.8, 1.1], 0.4), list: [] },      // cliff chunks (near)
    { g: rockGeom(0, 6, [1.3, 0.9, 1.1], 0.4), list: [] },        // cliff chunks (far, low poly)
    { g: rockGeom(0, 8, [1.2, 0.8, 1.05], 0.38), list: [] },      // boulders away from the camera spots (low poly)
  ];
  // keep the concept framing clear: reject rocks that would cover the base in the concept camera
  const K = CONCEPT; const cgy = groundAt(K.cat.x, K.cat.z); const ccam = new THREE.PerspectiveCamera(K.fov, 16 / 9, 0.2, 5000);
  ccam.position.set(K.cam.x, cgy + K.eye, K.cam.z); ccam.lookAt(K.target.x, cgy + K.eye - K.drop, K.target.z); ccam.updateMatrixWorld(); ccam.updateProjectionMatrix();
  const _v = new THREE.Vector3();
  const put = (vi, x, z, s, sink = 0.3, tilt = 0.35) => {
    const y = groundAt(x, z) - s * sink;
    variants[vi].list.push({ x, y, z, s: [s * (0.8 + rnd() * 0.5), s * (0.7 + rnd() * 0.6), s * (0.8 + rnd() * 0.5)], r: [(rnd() - 0.5) * tilt, rnd() * Math.PI * 2, (rnd() - 0.5) * tilt] });
  };
  const occludes = (x, z, top) => { const dist = Math.hypot(x - K.cam.x, z - K.cam.z); if (dist > 52 || dist < 1) return false; _v.set(x, top, z).project(ccam); if (_v.z > 1) return false; const px = (_v.x * 0.5 + 0.5) * 1024, py = (0.5 - _v.y * 0.5) * 576; return (px > 265 && px < 850 && py < 372 && py > 60) || (dist < 42 && px > 740 && py < 330) || (dist < 37 && px > 720 && px < 940 && py > 280 && py < 500); };
  const nPeb = Math.round(1000 * quality), nBould = Math.round(220 * quality);
  // pebbles: everywhere in hub, denser on lookout
  for (let i = 0, tries = 0; i < nPeb && tries < 20000; tries++) {
    let x, z;
    const m = rnd();
    if (m < 0.25) { const a = rnd() * 6.283, r = Math.sqrt(rnd()) * 20; x = LOOKOUT.x + Math.cos(a) * r; z = LOOKOUT.z + Math.sin(a) * r; }
    else if (m < 0.65) { const p = sd((rnd() - 0.5) * 56, -56 + rnd() * 40); x = p.x; z = p.z; }
    else { const a = rnd() * 6.283, r = 10 + Math.sqrt(rnd()) * 85; x = Math.cos(a) * r; z = Math.sin(a) * r; }
    if (blocked(x, z, 0.8)) continue; const s = 0.18 + rnd() ** 2 * 0.9; if (occludes(x, z, groundAt(x, z) + s * 0.7)) continue; put(0, x, z, s, 0.25, 0.8); i++;
  }
  for (let i = 0, tries = 0; i < nBould && tries < 20000; tries++) {
    let x, z; const m = rnd();
    if (m < 0.35) { const a = rnd() * 6.283, r = Math.sqrt(rnd()) * 30; x = LOOKOUT.x + Math.cos(a) * r; z = LOOKOUT.z + Math.sin(a) * r; }
    else { const a = rnd() * 6.283, r = 40 + rnd() * 120; x = Math.cos(a) * r; z = Math.sin(a) * r; }
    if (blocked(x, z, 2.5)) continue;
    const d = Math.hypot(x - LOOKOUT.x, z - LOOKOUT.z); if (d < 4) continue; // keep cat spot clear
    const s = 0.5 + rnd() ** 2.2 * (d < 30 ? 2.2 : 2.6); if (occludes(x, z, groundAt(x, z) + s * 0.9)) continue;
    put(Math.hypot(x, z) > 75 && d > 30 ? 6 : 1 + (i % 3), x, z, s); i++;
  }
  // extra chunky boulders in the concept foreground band (kept off the base silhouette)
  for (let i = 0, tries = 0; i < 120 * quality && tries < 6000; tries++) { const p = sd((rnd() - 0.5) * 64, -58 + rnd() * 38); const s = 0.7 + rnd() ** 1.4 * 2.2; if (blocked(p.x, p.z, 1.5) || Math.hypot(p.x - CONCEPT.cat.x, p.z - CONCEPT.cat.z) < 2.2 || occludes(p.x, p.z, groundAt(p.x, p.z) + s * 0.9)) continue; put(1 + (i % 3), p.x, p.z, s, 0.25); i++; }
  // hand-placed foreground rocks matching the concept framing
  const fg = [[2.2, -53.5, 1.1], [5.5, -54.5, 1.9], [0.5, -50.5, 1.0], [8.5, -51, 1.6], [3.5, -48, 1.4], [-6.5, -56, 1.0], [-8.5, -52, 2.0], [11, -57, 2.3], [-3, -46, 1.6], [6, -44, 1.5], [-12, -47, 1.8], [24, -54, 1.8], [-14, -58, 2.6], [-18, -52, 3.4], [-11, -62, 1.8], [15, -36, 1.8], [9, -40, 1.2], [-6, -40, 1.4], [1, -42, 1.0], [19, -30, 1.6]];
  for (const [s, d, sz] of fg) { const p = sd(s, d); if (!occludes(p.x, p.z, groundAt(p.x, p.z) + sz * 0.8)) put(1 + Math.floor(rnd() * 3), p.x, p.z, sz, 0.35); }
  // cliff chunks on steep slopes and rims
  const nCliff = Math.round(300 * quality);
  for (let i = 0, tries = 0; i < nCliff && tries < 40000; tries++) {
    const a = rnd() * 6.283, r = 60 + rnd() * 560; const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const sl = slopeAt(x, z); if (sl < 0.35 || blocked(x, z, 8) || r < 85 || Math.hypot(x - LOOKOUT.x, z - LOOKOUT.z) < 45) continue;
    const s = (r < 150 ? 3 : 6) + rnd() * (r < 150 ? 7 : 16); put(r < 150 ? 4 : 5, x, z, s, 0.55, 0.6); i++;
  }
  const meshes = []; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (const v of variants) {
    const im = new THREE.InstancedMesh(v.g, mat, v.list.length);
    v.list.forEach((o, i) => { q.setFromEuler(e.set(o.r[0], o.r[1], o.r[2])); m4.compose(new THREE.Vector3(o.x, o.y, o.z), q, new THREE.Vector3(...o.s)); im.setMatrixAt(i, m4); });
    im.castShadow = v !== variants[0] && v !== variants[5]; im.receiveShadow = true; im.computeBoundingSphere(); scene.add(im); meshes.push(im);
  }
  return meshes;
}

// Floating gold crystals (hub) + cyan crystal clusters (canyon / portal) in a single instanced draw
export function buildCrystals(scene) {
  const g = new THREE.OctahedronGeometry(1, 0); g.scale(0.62, 1.25, 0.62);
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 0.35, roughness: 0.25, flatShading: true, emissive: '#ffffff', emissiveIntensity: 1 });
  mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= vColor.rgb * 0.55;'); };
  const items = [];
  const gold = new THREE.Color('#f2b640'), cyan = new THREE.Color('#5ee6ec');
  const hubSpots = [[-27, -44, 2.6], [-17, -26, 2.2], [-9, 16, 3.5], [-3, -30, 2.4], [5.5, 27, 2.8], [16, 18, 2.6], [29, -2, 2.3], [31, 12, 2.6], [21, -24, 2.2], [-31, -12, 2.6], [-40, 18, 3.0], [40, 30, 2.6], [12, -36, 2.3], [-14, 40, 3.2], [36, -30, 2.6], [-48, -30, 2.8], [46, -8, 2.4], [-2, 48, 3]];
  for (const [s, d, h] of hubSpots) { const p = sd(s, d); items.push({ x: p.x, y: groundAt(p.x, p.z) + h, z: p.z, s: 0.55 + rnd() * 0.25, c: gold, bob: true, ph: rnd() * 6 }); }
  for (let i = 0; i < 70; i++) { // canyon floor clusters
    const t = rnd(); const x = -420 + (-610 + 420) * t + (rnd() - 0.5) * 30, z = -250 + (260 + 250) * t + (rnd() - 0.5) * 30;
    items.push({ x, y: groundAt(x, z) + 1, z, s: 2 + rnd() * 5, c: cyan, tilt: (rnd() - 0.5) * 0.8, ph: rnd() * 6 });
  }
  for (let i = 0; i < 12; i++) { const a = rnd() * 6.28; const R = REGIONS.echo; const x = R.x + Math.cos(a) * (45 + rnd() * 20), z = R.z + Math.sin(a) * (45 + rnd() * 20); items.push({ x, y: groundAt(x, z) + 1, z, s: 1.5 + rnd() * 3, c: cyan, tilt: (rnd() - 0.5) * 0.6, ph: 0 }); }
  const im = new THREE.InstancedMesh(g, mat, items.length);
  items.forEach((it, i) => im.setColorAt(i, it.c));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const update = (t) => { items.forEach((it, i) => { if (!it.bob && t > 0) return; const y = it.bob ? it.y + Math.sin(t * 1.4 + it.ph) * 0.18 : it.y; q.setFromEuler(e.set(it.tilt || 0, it.bob ? t * 0.6 + it.ph : it.ph, 0)); m4.compose(new THREE.Vector3(it.x, y, it.z), q, new THREE.Vector3(it.s, it.s, it.s)); im.setMatrixAt(i, m4); }); im.instanceMatrix.needsUpdate = true; };
  update(0); im.computeBoundingSphere(); im.frustumCulled = false; im.castShadow = false; scene.add(im);
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
