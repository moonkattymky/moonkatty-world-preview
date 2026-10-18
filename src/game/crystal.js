import * as THREE from 'three';
// Energy crystals (user art ref): a cluster of 3-5 tall sharp hexagonal shards of different heights growing from one base, saturated
// electric blue/cyan, translucent look with a bright inner glow, white-hot facet edges, a soft blue halo (fake bloom, additive billboard)
// and a faint pulsing light pool on the ground. No real-time lights. Per field: 1 instanced shard draw + 1 instanced glow draw.

// hexagonal shard: prism + pointed tip; barycentric attribute marks real facet edges (quad diagonals excluded) for the white-hot edge lines
function shard(pos, bary, hh, { x, z, h, r, tilt, yaw, tip }) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, -0.08, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt * Math.cos(yaw), 0, tilt * Math.sin(yaw))), new THREE.Vector3(1, 1, 1));
  const v = (a, y, rr) => new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr).applyMatrix4(m);
  const ring = (y, rr) => Array.from({ length: 6 }, (_, i) => v(i / 6 * Math.PI * 2 + 0.3, y, rr));
  const B = ring(0, r * 0.55), M = ring(h * 0.62, r), T = ring(h, r * 0.86), P = v(0, h + tip, 0); const H = h + tip;
  const tri = (a, b, c, ba, bb, bc) => { for (const [p, q] of [[a, ba], [b, bb], [c, bc]]) { pos.push(p.x, p.y, p.z); bary.push(...q); hh.push(Math.max(0, p.y) / H); } };
  const quad = (A, Bq, i, j) => { tri(A[i], A[j], Bq[j], [1, 1, 0], [0, 1, 0], [0, 1, 1]); tri(A[i], Bq[j], Bq[i], [1, 1, 0], [0, 1, 1], [0, 1, 0]); };
  for (let i = 0; i < 6; i++) { const j = (i + 1) % 6; quad(B, M, i, j); quad(M, T, i, j); tri(T[i], T[j], P, [1, 0, 0], [0, 1, 0], [0, 0, 1]); }
}
let _geo = null;
export function clusterGeometry() {
  if (_geo) return _geo; const pos = [], bary = [], hh = [];
  const S = [{ x: 0, z: 0, h: 0.92, r: 0.4, tilt: 0.03, yaw: 0, tip: 0.46 }, { x: 0.3, z: 0.1, h: 0.46, r: 0.19, tilt: 1.0, yaw: 0.2, tip: 0.24 }, { x: -0.31, z: 0.07, h: 0.52, r: 0.2, tilt: 0.95, yaw: 3.0, tip: 0.26 },
    { x: 0.07, z: -0.3, h: 0.38, r: 0.16, tilt: 1.05, yaw: -1.6, tip: 0.2 }, { x: -0.1, z: 0.31, h: 0.32, r: 0.15, tilt: 1.1, yaw: 1.7, tip: 0.18 }];
  for (const s of S) shard(pos, bary, hh, s);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aBary', new THREE.Float32BufferAttribute(bary, 3)); g.setAttribute('aH', new THREE.Float32BufferAttribute(hh, 1)); g.computeVertexNormals(); g.computeBoundingSphere();
  return (_geo = g);
}
const shardMat = () => new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, toneMapped: false,
  vertexShader: `attribute vec3 aBary; attribute float aH; attribute float aState; varying vec3 vB; varying float vH; varying vec3 vN; varying vec3 vV; varying float vS; varying float vSeed; varying vec3 vLP;
    void main(){ vLP = position; mat4 im = modelMatrix * instanceMatrix; vec4 wp = im * vec4(position, 1.0); vN = normalize(mat3(im) * normal); vV = normalize(cameraPosition - wp.xyz); vB = aBary; vH = aH; vS = aState; vSeed = im[3].x * 0.37 + im[3].z * 0.11; gl_Position = projectionMatrix * viewMatrix * wp; }`,
  fragmentShader: `uniform float uTime; varying vec3 vB; varying float vH; varying vec3 vN; varying vec3 vV; varying float vS; varying float vSeed; varying vec3 vLP;
    float h1(float n){ return fract(sin(n * 91.345 + vSeed * 3.1) * 43758.5453); }
    void main(){ vec3 n = normalize(vN), V = normalize(vV); float e = min(min(vB.x, vB.y), vB.z); float w = fwidth(e);
      float edge = 1.0 - smoothstep(0.0, w * 1.8, e); float edgeSoft = 1.0 - smoothstep(0.0, w * 8.0 + 0.04, e);
      float nv = abs(dot(n, V)); float fr = pow(1.0 - nv, 2.0);
      float pulse = 0.85 + 0.15 * sin(uTime * 2.4 + vSeed);
      // fake refraction: shattered internal facets = cells bounded by 4 tilted planes, looked up along the refracted view ray (shift with the view)
      vec3 rd = refract(-V, n, 0.62); vec3 q = vLP * 2.3 + rd * 0.5;
      vec4 d = vec4(dot(q, vec3(0.83, 0.42, 0.37)), dot(q, vec3(-0.51, 0.66, 0.55)), dot(q, vec3(0.12, -0.39, 0.91)), dot(q, vec3(0.7, 0.71, -0.1)) * 1.3);
      vec4 fd = fract(d); vec4 cs = step(0.5, fd); float cell = h1(dot(cs, vec4(1.0, 2.0, 4.0, 8.0)) + dot(floor(d), vec4(3.0, 17.0, 31.0, 7.0)));
      vec4 bd = abs(fd - 0.5); float ib = min(min(bd.x, bd.y), min(bd.z, bd.w)); float inner = 1.0 - smoothstep(0.0, 0.022, ib); // internal facet edges
      vec3 deep = vec3(0.0, 0.006, 0.2), mid = vec3(0.008, 0.055, 0.85), lite = vec3(0.05, 0.28, 1.35), cyan = vec3(0.06, 0.42, 1.5), hot = vec3(0.6, 1.1, 2.0);
      float tone = clamp(cell * 0.85 + 0.25 * (0.5 + 0.5 * dot(n, normalize(vec3(-0.45, 0.75, 0.5)))), 0.0, 1.0);
      vec3 c = mix(deep, mid, smoothstep(0.1, 0.55, tone)); c = mix(c, lite, smoothstep(0.62, 0.95, tone) * 0.8);   // dark / mid / light blue facets
      c += cyan * inner * (0.16 + 0.16 * nv) * pulse;                                     // bright refracted fracture lines
      c += cyan * pow(1.0 - vH, 2.4) * 0.45 * pulse;                                       // bright core glow at the base
      c += lite * pow(nv, 3.0) * (0.1 + 0.25 * (1.0 - vH)) * pulse;                       // inner glow seen through the crystal
      c += mix(mid, cyan, vH) * fr * 0.55;                                                   // rim
      c += hot * edge * (0.6 + 0.3 * vH) + cyan * edgeSoft * 0.2;                         // white-hot facet edges
      c += hot * smoothstep(0.88, 1.0, vH) * 0.2;                                            // glowing tips
      if (vS > 0.5) c = c * vec3(0.35, 0.33, 0.4) + vec3(0.5, 0.12, 0.05) * edge; // cracked
      gl_FragColor = vec4(c, 1.0); }` });
const glowMat = () => new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  vertexShader: `attribute float aK; attribute float aState; varying vec2 vP; varying float vK; varying float vS; varying float vSeed;
    void main(){ mat4 im = modelMatrix * instanceMatrix; float s = length(im[0].xyz); vec3 c = im[3].xyz; vP = position.xy; vK = aK; vS = aState; vSeed = c.x * 0.37 + c.z * 0.11; vec3 wp;
      if (aK < 0.5) { vec3 R = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), U = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]); wp = c + vec3(0.0, 0.62 * s, 0.0) + (R * position.x * 1.5 + U * position.y * 1.5) * s; wp += normalize(cameraPosition - wp) * 0.75 * s; } /* pulled toward the camera: the aura is not clipped by the ground and blooms over the shards */
      else wp = c + vec3(position.x, 0.04, position.y) * 2.1 * s;
      gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0); }`,
  fragmentShader: `uniform float uTime; varying vec2 vP; varying float vK; varying float vS; varying float vSeed;
    void main(){ float r = length(vP); if (r > 1.0) discard; float pulse = 0.75 + 0.25 * sin(uTime * 2.4 + vSeed); float a;
      vec3 col = vec3(0.03, 0.2, 1.15);
      if (vK < 0.5) { vec2 e = vec2(vP.x * 1.45, (vP.y - 0.08) * 1.0); float rr = dot(e, e); a = (exp(-rr * 2.6) * 0.75 + exp(-rr * 8.0) * 0.45) * pulse; // tall soft halo around the whole cluster
        vec2 b = vec2(vP.x / 0.62, (vP.y + 0.5) / 0.13); float fl = exp(-dot(b, b)) * 0.85; a += fl; col = mix(col, vec3(0.22, 0.6, 1.6), fl / max(a, 1e-3)); } // white-blue flare at the base
      else { a = (pow(1.0 - r, 3.0) * 0.9 + pow(1.0 - r, 1.2) * 0.2 + smoothstep(0.08, 0.0, abs(r - fract(uTime * 0.45 + vSeed))) * 0.16 * (1.0 - r)) * pulse; col = mix(col, vec3(0.3, 0.75, 1.7), pow(1.0 - r, 6.0)); } // pooled light on the ground
      if (vS > 0.5) a *= 0.25; gl_FragColor = vec4(col * a, a); }` });
let _glowGeo = null;
const glowGeometry = () => { if (_glowGeo) return _glowGeo; const q = new THREE.PlaneGeometry(2, 2).toNonIndexed(); const a = q.clone(); const b = q.clone(); const g = new THREE.BufferGeometry(); const P = [...a.attributes.position.array, ...b.attributes.position.array]; g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aK', new THREE.Float32BufferAttribute([...Array(6).fill(0), ...Array(6).fill(1)], 1)); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 3.5); return (_glowGeo = g); };

// spots: [{x,y,z}] -> fields clustered by 60 m (one shard + one glow InstancedMesh each, frustum-culled)
export function makeCrystalField(scene, spots, { scale = 1, name = 'game_crystals', cluster = 60 } = {}) {
  const geo = clusterGeometry(); const sm = shardMat(), gm = glowMat();
  const groups = []; spots.forEach((c, i) => { let g = groups.find(g => Math.hypot(g.x - c.x, g.z - c.z) < cluster); if (!g) groups.push(g = { x: c.x, z: c.z, ids: [] }); g.ids.push(i); });
  const alive = spots.map(() => true), cracked = spots.map(() => 0), shake = spots.map(() => 0);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (const g of groups) { const n = g.ids.length;
    const sgeo = geo.clone(); sgeo.setAttribute('aState', new THREE.InstancedBufferAttribute(new Float32Array(n), 1)); const ggeo = glowGeometry().clone(); ggeo.setAttribute('aState', new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
    g.im = new THREE.InstancedMesh(sgeo, sm, n); g.im.name = name; g.gl = new THREE.InstancedMesh(ggeo, gm, n); g.gl.name = name + '_glow'; g.gl.renderOrder = 2; g.im.castShadow = false; scene.add(g.im, g.gl); }
  const update = (t, dt = 0) => { sm.uniforms.uTime.value = t; gm.uniforms.uTime.value = t;
    for (const g of groups) { const sa = g.im.geometry.attributes.aState, ga = g.gl.geometry.attributes.aState; g.ids.forEach((i, k) => { const c = spots[i]; shake[i] = Math.max(0, shake[i] - dt * 3); e.set(Math.sin(t * 45) * 0.07 * shake[i], i * 2.399, 0); q.setFromEuler(e); p.set(c.x, c.y, c.z); s.setScalar(alive[i] ? scale * (0.85 + 0.3 * ((i * 0.618) % 1)) : 0); M.compose(p, q, s); g.im.setMatrixAt(k, M); g.gl.setMatrixAt(k, M); sa.setX(k, cracked[i]); ga.setX(k, cracked[i]); });
      g.im.instanceMatrix.needsUpdate = true; g.gl.instanceMatrix.needsUpdate = true; sa.needsUpdate = true; ga.needsUpdate = true; const vis = g.ids.some(i => alive[i]); g.im.visible = vis && g.on !== false; g.gl.visible = g.im.visible; } };
  update(0); for (const g of groups) { for (const m of [g.im, g.gl]) { m.computeBoundingSphere(); m.boundingSphere.radius += 3 * scale; } }
  return { meshes: groups.map(g => g.im), groups, alive, cracked, spots, update, setAlive(i, v) { alive[i] = v; }, setVisible(v) { groups.forEach(g => g.on = v); }, shake(i) { shake[i] = 1; } };
}

// static decor clusters (canyon / echo world crystals): same look, one shard + one glow instanced draw for the whole list
export function makeStaticCrystals(scene, list, name, k = 1) {
  const n = list.length; const sgeo = clusterGeometry().clone(); sgeo.setAttribute('aState', new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
  const ggeo = glowGeometry().clone(); ggeo.setAttribute('aState', new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
  const im = new THREE.InstancedMesh(sgeo, shardMat(), n), gl = new THREE.InstancedMesh(ggeo, glowMat(), n); im.name = name; gl.name = name + '_glow'; gl.renderOrder = 2; im.castShadow = false;
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  list.forEach((it, i) => { q.setFromEuler(e.set(it.tilt * 0.6, it.ph, it.tilt * 0.3)); M.compose(v.set(it.x, it.y + 0.25 * it.s, it.z), q, sc.setScalar(it.s * k)); im.setMatrixAt(i, M); q.identity(); M.compose(v, q, sc); gl.setMatrixAt(i, M); });
  im.computeBoundingSphere(); gl.computeBoundingSphere(); gl.boundingSphere.radius += 4 * k * 2.5; im.add(gl); gl.matrixAutoUpdate = false; gl.matrix.identity(); gl.matrixWorldAutoUpdate = true;
  scene.add(im); return im;
}
