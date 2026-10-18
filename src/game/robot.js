import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/three/jsm/utils/BufferGeometryUtils.js';
// Builder robot "Строитель" (approved concept): yellow hard hat with ridges + brim, big ivory rounded head, black visor with cyan pill
// eyes and a small smile, gold ear pods, dark ribbed neck, ivory chest with gold trim and a gold crescent, gold-rimmed shoulder pads,
// ivory forearms with gold bands, dark gloves, welding torch with a black hose and cyan flame in the right hand, steel I-beam in the left,
// gold knee pads and chunky ivory boots. ~2.6k tris, 3 draw calls (body, torch arm, visor face) + spark points while welding.
const COL = { ivory: '#cdc4b0', ivory2: '#b9af9a', gold: '#c98f2a', hat: '#d4961c', dark: '#2a2e35', dark2: '#41464f', steel: '#6d7179', black: '#0b0d12' };
const METAL = { gold: 0.55, hat: 0.18, steel: 0.7, dark: 0.35, dark2: 0.4 };

function rbox(w, h, d, r, s = 4) { const g = new THREE.BoxGeometry(w, h, d, s, s, s); const P = g.attributes.position, v = new THREE.Vector3(), q = new THREE.Vector3();
  const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
  for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i); q.set(THREE.MathUtils.clamp(v.x, -hx, hx), THREE.MathUtils.clamp(v.y, -hy, hy), THREE.MathUtils.clamp(v.z, -hz, hz)); v.sub(q); if (v.lengthSq() > 1e-12) v.setLength(r); P.setXYZ(i, q.x + v.x, q.y + v.y, q.z + v.z); }
  g.computeVertexNormals(); return g; }
// crescent: outer disc minus an offset disc (opening to the upper right, as on the concept's chest)
function crescent(R = 0.075) { const r2 = R * 0.8, cx = R * 0.36, cy = R * 0.24; const d = Math.hypot(cx, cy), a = (R * R - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, R * R - a * a));
  const mx = cx * a / d, my = cy * a / d; const P1 = [mx + h * cy / d, my - h * cx / d], P2 = [mx - h * cy / d, my + h * cx / d];
  const o1 = Math.atan2(P1[1], P1[0]), o2 = Math.atan2(P2[1], P2[0]); const i1 = Math.atan2(P1[1] - cy, P1[0] - cx), i2 = Math.atan2(P2[1] - cy, P2[0] - cx);
  const sh = new THREE.Shape(); sh.moveTo(P2[0], P2[1]); sh.absarc(0, 0, R, o2, o1 + (o1 < o2 ? 2 * Math.PI : 0), false); sh.absarc(cx, cy, r2, i1, i2 + (i2 > i1 ? -2 * Math.PI : 0) + 2 * Math.PI * 0, true);
  return new THREE.ShapeGeometry(sh, 10); }
class Kit { constructor() { this.parts = []; }
  add(g, col, o = {}) { g = g.index ? g.toNonIndexed() : g.clone(); const m = new THREE.Matrix4(); m.compose(new THREE.Vector3(...(o.p || [0, 0, 0])), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(o.r || [0, 0, 0]), 'YXZ')), new THREE.Vector3(...(o.s || [1, 1, 1]))); g.applyMatrix4(m);
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); if (!g.attributes.normal) g.computeVertexNormals();
    const c = new THREE.Color(COL[col] || col), n = g.attributes.position.count, cc = new Float32Array(n * 3), mm = new Float32Array(n).fill(METAL[col] ?? 0.08);
    for (let i = 0; i < n; i++) c.toArray(cc, i * 3); g.setAttribute('color', new THREE.BufferAttribute(cc, 3)); g.setAttribute('aMetal', new THREE.BufferAttribute(mm, 1)); this.parts.push(g); return g; }
  build() { const g = mergeGeometries(this.parts, false); g.computeBoundingSphere(); return g; } }
const cyl = (rt, rb, h, s = 12) => new THREE.CylinderGeometry(rt, rb, h, s, 1);
const sph = (r, ws = 12, hs = 8, th = Math.PI) => new THREE.SphereGeometry(r, ws, hs, 0, Math.PI * 2, 0, th);
const tor = (R, t, rs = 4, ts = 14, arc = Math.PI * 2) => new THREE.TorusGeometry(R, t, rs, ts, arc);

function material(env) { const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.48, metalness: 1, envMap: env || null, envMapIntensity: 0.9 });
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * 0.06; /* soft self-fill: reads like the concept on the shadow side */'); sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aMetal; varying float vMetal;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvMetal = aMetal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vMetal;').replace('#include <metalnessmap_fragment>', 'float metalnessFactor = metalness * vMetal;').replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * (1.0 - 0.35 * vMetal);'); };
  m.customProgramCacheKey = () => 'mk_robot'; return m; }
function faceTexture() { const W = 256, H = 160, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  rr(4, 4, W - 8, H - 8, 46); const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#1b2230'); gr.addColorStop(0.5, '#05070b'); gr.addColorStop(1, '#0b0f16'); g.fillStyle = gr; g.fill();
  g.shadowColor = '#3ee8ff'; g.shadowBlur = 18; g.fillStyle = '#7ff3ff'; for (const x of [78, 178]) { rr(x - 16, 44, 32, 52, 15); g.fill(); }
  g.lineWidth = 7; g.lineCap = 'round'; g.strokeStyle = '#7ff3ff'; g.beginPath(); g.arc(128, 96, 20, 0.22 * Math.PI, 0.78 * Math.PI); g.stroke();
  g.shadowBlur = 0; g.fillStyle = 'rgba(255,255,255,0.10)'; rr(30, 14, 120, 22, 11); g.fill(); // glass glint
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

export function makeRobot(scene, env) {
  const body = new Kit(), arm = new Kit();
  // chibi proportions from the concept: big head (~1/3 of the height), chunky torso, short thick legs, big boots. Feet at y=0, top of hat ~1.62.
  for (const sx of [-1, 1]) { const x = sx * 0.155;
    body.add(rbox(0.25, 0.17, 0.36, 0.07, 2), 'ivory', { p: [x, 0.085, 0.03] }); body.add(rbox(0.255, 0.05, 0.31, 0.02, 1), 'gold', { p: [x, 0.18, 0.0] }); // chunky boot + gold cuff
    body.add(rbox(0.2, 0.19, 0.2, 0.07, 2), 'ivory', { p: [x, 0.3, 0] }); body.add(rbox(0.15, 0.12, 0.07, 0.035, 1), 'gold', { p: [x, 0.43, 0.085] }); // shin + gold knee pad
    body.add(cyl(0.075, 0.075, 0.1, 8), 'dark', { p: [x, 0.43, 0] }); body.add(rbox(0.2, 0.14, 0.2, 0.06, 2), 'ivory', { p: [x, 0.54, 0] }); }
  body.add(rbox(0.46, 0.13, 0.28, 0.05, 2), 'dark2', { p: [0, 0.64, 0] }); body.add(rbox(0.5, 0.05, 0.31, 0.02, 1), 'gold', { p: [0, 0.715, 0] }); // hips + gold belt
  body.add(rbox(0.6, 0.4, 0.36, 0.12, 3), 'ivory', { p: [0, 0.94, 0] }); // chest
  body.add(rbox(0.36, 0.025, 0.02, 0.01, 1), 'gold', { p: [0, 1.12, 0.175] }); body.add(rbox(0.025, 0.2, 0.02, 0.01, 1), 'gold', { p: [-0.2, 0.96, 0.175] }); body.add(rbox(0.025, 0.2, 0.02, 0.01, 1), 'gold', { p: [0.2, 0.96, 0.175] }); // gold trim lines
  body.add(crescent(0.075), 'gold', { p: [0.0, 0.93, 0.182] }); // crescent emblem
  body.add(cyl(0.09, 0.1, 0.09, 10), 'dark', { p: [0, 1.17, 0] }); body.add(tor(0.098, 0.014, 3, 10), 'dark2', { p: [0, 1.16, 0], r: [Math.PI / 2, 0, 0] }); // ribbed neck
  for (const sx of [-1, 1]) { body.add(rbox(0.2, 0.13, 0.27, 0.05, 2), 'ivory', { p: [sx * 0.37, 1.07, 0], r: [0, 0, -sx * 0.42] }); body.add(rbox(0.21, 0.035, 0.28, 0.015, 1), 'gold', { p: [sx * 0.395, 1.015, 0], r: [0, 0, -sx * 0.42] }); } // angular shoulder pads with gold edge
  body.add(tor(0.13, 0.025, 3, 14), 'gold', { p: [0, 1.135, 0], r: [Math.PI / 2, 0, 0], s: [1.35, 1, 1] }); // gold collar
  // left arm (static) holding the steel I-beam low across the front
  body.add(rbox(0.14, 0.18, 0.14, 0.05, 2), 'ivory', { p: [-0.39, 0.9, 0.02], r: [0.45, 0, 0.15] }); body.add(sph(0.06, 8, 5), 'dark', { p: [-0.39, 0.82, 0.07] }); body.add(rbox(0.13, 0.22, 0.13, 0.045, 2), 'ivory', { p: [-0.38, 0.76, 0.12], r: [0.95, 0, 0.1] }); body.add(rbox(0.14, 0.04, 0.14, 0.015, 1), 'gold', { p: [-0.38, 0.8, 0.09], r: [0.95, 0, 0.1] });
  body.add(rbox(0.12, 0.11, 0.13, 0.045, 2), 'dark', { p: [-0.36, 0.68, 0.24] });
  { const L = 0.95, bx = 0.02, by = 0.64, bz = 0.3, ry = 0.3, rz = 0.12; for (const [w, h, d, dy, c] of [[L, 0.02, 0.11, 0.055, 'steel'], [L, 0.02, 0.11, -0.055, 'steel'], [L, 0.11, 0.02, 0, 'dark2']]) body.add(new THREE.BoxGeometry(w, h, d), c, { p: [bx, by + dy, bz], r: [0, ry, rz] }); }
  // head: big rounded ivory block, gold ear pods, black visor, hard hat with ridges + brim
  body.add(rbox(0.64, 0.5, 0.52, 0.17, 3), 'ivory', { p: [0, 1.44, 0] });
  for (const sx of [-1, 1]) { body.add(cyl(0.11, 0.11, 0.07, 14), 'gold', { p: [sx * 0.33, 1.42, -0.01], r: [0, 0, Math.PI / 2] }); body.add(cyl(0.07, 0.07, 0.08, 12), 'dark', { p: [sx * 0.345, 1.42, -0.01], r: [0, 0, Math.PI / 2] }); body.add(cyl(0.035, 0.035, 0.09, 8), 'gold', { p: [sx * 0.355, 1.42, -0.01], r: [0, 0, Math.PI / 2] }); }
  body.add(rbox(0.52, 0.31, 0.04, 0.09, 2), 'black', { p: [0, 1.42, 0.25] }); // visor bezel (face texture sits on it)
  body.add(sph(0.35, 18, 7, Math.PI / 2), 'hat', { p: [0, 1.64, -0.01], s: [1.0, 0.92, 0.98] }); // hat dome
  body.add(cyl(0.375, 0.385, 0.035, 20), 'hat', { p: [0, 1.645, 0.035], s: [1, 1, 0.98] }); // brim, a little longer at the front
  body.add(tor(0.345, 0.04, 4, 14, Math.PI), 'hat', { p: [0, 1.64, -0.01], r: [0, Math.PI / 2, 0], s: [1, 0.94, 0.99] }); // centre ridge front->back
  for (const sx of [-1, 1]) body.add(tor(0.34, 0.024, 3, 10, Math.PI * 0.62), 'hat', { p: [sx * 0.13, 1.64, -0.01], r: [0, Math.PI / 2, -sx * 0.06], s: [0.93, 0.87, 0.95] });
  body.add(rbox(0.62, 0.045, 0.06, 0.02, 1), 'hat', { p: [0, 1.67, 0.31] }); for (const sx of [-1, 1]) body.add(rbox(0.09, 0.07, 0.06, 0.02, 1), 'hat', { p: [sx * 0.25, 1.69, 0.3] }); // hat band + side tabs
  // right arm (animated): pivot at the shoulder; forearm, glove with gold knuckles, welding torch + black hose
  arm.add(rbox(0.14, 0.18, 0.14, 0.05, 2), 'ivory', { p: [0, -0.06, 0] }); arm.add(sph(0.06, 8, 5), 'dark', { p: [0, -0.17, 0.01] }); arm.add(rbox(0.14, 0.24, 0.14, 0.05, 2), 'ivory', { p: [0, -0.3, 0.02] }); arm.add(rbox(0.15, 0.04, 0.15, 0.015, 1), 'gold', { p: [0, -0.23, 0.02] }); arm.add(rbox(0.15, 0.035, 0.15, 0.015, 1), 'gold', { p: [0, -0.41, 0.02] });
  arm.add(rbox(0.13, 0.12, 0.14, 0.045, 2), 'dark', { p: [0, -0.49, 0.04] }); arm.add(rbox(0.14, 0.03, 0.05, 0.012, 1), 'gold', { p: [0, -0.47, 0.11] });
  arm.add(cyl(0.03, 0.032, 0.26, 8), 'dark2', { p: [0, -0.53, 0.17], r: [Math.PI / 2 - 0.5, 0, 0] }); arm.add(cyl(0.04, 0.04, 0.05, 10), 'gold', { p: [0, -0.51, 0.12], r: [Math.PI / 2 - 0.5, 0, 0] }); arm.add(cyl(0.012, 0.02, 0.07, 6), 'steel', { p: [0, -0.595, 0.29], r: [Math.PI / 2 - 0.5, 0, 0] });
  { const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.5, 0.06), new THREE.Vector3(0.05, -0.6, -0.1), new THREE.Vector3(0.08, -0.6, -0.3), new THREE.Vector3(0.12, -0.75, -0.38)]); arm.add(new THREE.TubeGeometry(curve, 10, 0.024, 5), 'black'); }
  const mat = material(env);
  const root = new THREE.Group(); root.name = 'game_robot';
  const bodyM = new THREE.Mesh(body.build(), mat); bodyM.name = 'game_robot_body'; bodyM.castShadow = true; root.add(bodyM);
  const armPivot = new THREE.Group(); armPivot.position.set(0.38, 1.01, 0); root.add(armPivot); const armM = new THREE.Mesh(arm.build(), mat); armM.name = 'game_robot_arm'; armM.castShadow = true; armPivot.add(armM);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.49, 0.3), new THREE.MeshBasicMaterial({ map: faceTexture(), transparent: true, toneMapped: false, color: new THREE.Color(1.25, 1.25, 1.25) })); face.position.set(0, 1.42, 0.272); face.name = 'game_robot_face'; root.add(face);
  // welding sparks + cyan flame (one Points draw, only while welding)
  const N = 40, sp = new Float32Array(N * 3), sv = new Float32Array(N * 3), sa = new Float32Array(N).fill(9); const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const sparks = new THREE.Points(sg, new THREE.PointsMaterial({ color: new THREE.Color(1.2, 3.2, 4.0), size: 0.06, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); sparks.name = 'game_robot_sparks'; sparks.frustumCulled = false; sparks.visible = false; scene.add(sparks);
  const tip = new THREE.Object3D(); tip.position.set(0, -0.61, 0.33); armM.add(tip); const tw = new THREE.Vector3();
  root.visible = false; scene.add(root); let ph = 0;
  const tris = [bodyM, armM, face].reduce((s, m) => s + m.geometry.attributes.position.count / 3, 0);
  return { root, tris, armPivot, face,
    // mode: 'idle' | 'walk' | 'weld'
    update(dt, mode) { ph += dt; armPivot.rotation.set(0, 0, 0); bodyM.position.y = 0; face.position.y = 1.42;
      if (mode === 'walk') { const b = Math.abs(Math.sin(ph * 7)) * 0.04; bodyM.position.y = b; face.position.y = 1.42 + b; armPivot.position.y = 1.01 + b; armPivot.rotation.x = Math.sin(ph * 7) * 0.35; }
      else if (mode === 'weld') { armPivot.position.y = 1.01; armPivot.rotation.x = -0.75 + Math.sin(ph * 2.3) * 0.12; armPivot.rotation.z = 0.12 + Math.sin(ph * 1.7) * 0.08; }
      else { armPivot.position.y = 1.01 + Math.sin(ph * 1.6) * 0.01; armPivot.rotation.x = Math.sin(ph * 1.2) * 0.05; }
      sparks.visible = mode === 'weld' && root.visible;
      if (sparks.visible) { root.updateMatrixWorld(true); tip.getWorldPosition(tw); for (let i = 0; i < N; i++) { sa[i] += dt; if (sa[i] > 0.45 + (i % 5) * 0.08) { sa[i] = 0; sp[i * 3] = tw.x; sp[i * 3 + 1] = tw.y; sp[i * 3 + 2] = tw.z; const a = Math.random() * 6.283, u = Math.random(); sv[i * 3] = Math.cos(a) * u * 2.2; sv[i * 3 + 1] = 0.6 + Math.random() * 1.8; sv[i * 3 + 2] = Math.sin(a) * u * 2.2; }
        sv[i * 3 + 1] -= 7 * dt; sp[i * 3] += sv[i * 3] * dt; sp[i * 3 + 1] += sv[i * 3 + 1] * dt; sp[i * 3 + 2] += sv[i * 3 + 2] * dt; } sg.attributes.position.needsUpdate = true; } },
    tipWorld() { root.updateMatrixWorld(true); return tip.getWorldPosition(new THREE.Vector3()); },
  };
}
