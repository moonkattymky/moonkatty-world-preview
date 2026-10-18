// "World life" pass (chapter 2, concept d04ca995): the base feels inhabited. Everything moves:
//  sky: shuttles + a satellite cross on paths, a distant shuttle lifts off with a flame trail, shooting stars;
//  lore: Dust Jellies drift + pulse over a far crater, a rare bunny silhouette runs on the horizon;
//  ground: a cargo rover loops fields -> storage with headlights + dust trail, a drill rig spins with sparks,
//  steam vents puff, beacons blink, the radar dish turns; ambient audio + radio chatter (RU/EN subtitles), mute toggle.
// Cheap by design: few draw calls, low-poly merged meshes, one particle system, distance culling.
import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/three/jsm/utils/BufferGeometryUtils.js';

const col = (g, hex, e = 0) => { g = g.index ? g.toNonIndexed() : g; const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3), ae = new Float32Array(n); for (let i = 0; i < n; i++) { c.toArray(a, i * 3); ae[i] = e; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.setAttribute('aE', new THREE.BufferAttribute(ae, 1)); if (g.attributes.uv) g.deleteAttribute('uv'); return g; };
const merge = (list) => mergeGeometries(list.map(g => g.index ? g.toNonIndexed() : g));
function vcMat(env) { const m = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.45, roughness: 0.45, envMap: env || null }); m.onBeforeCompile = (sh) => { sh.vertexShader = 'attribute float aE; varying float vE;\n' + sh.vertexShader.replace('#include <color_vertex>', '#include <color_vertex>\n vE = aE;'); sh.fragmentShader = 'varying float vE;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vColor.rgb * vE;'); }; m.customProgramCacheKey = () => 'mk_life_vc'; return m; }

function shuttleGeo() { return merge([col(new THREE.CylinderGeometry(0.55, 0.7, 4.2, 8).rotateZ(Math.PI / 2), '#e9e2d2'), col(new THREE.ConeGeometry(0.55, 1.4, 8).rotateZ(-Math.PI / 2).translate(2.8, 0, 0), '#e9e2d2'), col(new THREE.BoxGeometry(2.2, 0.12, 3.6).translate(-0.6, -0.15, 0), '#d8cdb5'), col(new THREE.BoxGeometry(1.0, 1.2, 0.1).translate(-1.6, 0.7, 0), '#c8912a'), col(new THREE.BoxGeometry(0.7, 0.3, 0.6).translate(1.4, 0.4, 0), '#3a6fb0', 0.6), col(new THREE.CylinderGeometry(0.4, 0.5, 0.4, 8).rotateZ(Math.PI / 2).translate(-2.25, 0, 0), '#6a5a40')]); }
function satGeo() { return merge([col(new THREE.BoxGeometry(1, 1, 1.4), '#d8c08a'), col(new THREE.BoxGeometry(4.2, 0.05, 1.3).translate(-2.8, 0, 0), '#2a4f9a', 0.25), col(new THREE.BoxGeometry(4.2, 0.05, 1.3).translate(2.8, 0, 0), '#2a4f9a', 0.25), col(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 4).translate(0, 1.1, 0), '#c8912a'), col(new THREE.ConeGeometry(0.5, 0.3, 8, 1, true).translate(0, 1.7, 0), '#e9e2d2')]); }
function roverGeo() { const L = [col(new THREE.BoxGeometry(1.6, 0.5, 2.6).translate(0, 0.75, 0), '#e6dcc6'), col(new THREE.BoxGeometry(1.7, 0.08, 2.7).translate(0, 1.02, 0), '#c8912a'), col(new THREE.BoxGeometry(1.4, 0.45, 1.6).translate(0, 1.25, -0.35), '#d8cdb5'), col(new THREE.BoxGeometry(1.0, 0.35, 0.5).translate(0, 1.15, 1.05), '#2b3d5c', 0.15)];
  for (const z of [-0.95, 0, 0.95]) for (const x of [-0.9, 0.9]) L.push(col(new THREE.CylinderGeometry(0.34, 0.34, 0.3, 10).rotateZ(Math.PI / 2).translate(x, 0.34, z), '#3a3530'));
  for (const x of [-0.5, 0.5]) L.push(col(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 8).rotateX(Math.PI / 2).translate(x, 0.85, 1.32), '#fff2c8', 3.0));
  for (let k = 0; k < 7; k++) L.push(col(new THREE.OctahedronGeometry(1, 0).scale(0.16, 0.38 + (k % 3) * 0.08, 0.16).rotateZ((k - 3) * 0.12).translate(-0.45 + (k % 4) * 0.3, 1.6 + (k % 3) * 0.04, -0.75 + Math.floor(k / 4) * 0.5), '#5fc4ff', 2.2));
  return merge(L); }
function drillGeo() { const L = [col(new THREE.BoxGeometry(2.2, 0.8, 3.2).translate(0, 0.9, 0), '#e6dcc6'), col(new THREE.BoxGeometry(2.3, 0.1, 3.3).translate(0, 1.32, 0), '#c8912a'), col(new THREE.BoxGeometry(1.2, 0.9, 1.0).translate(0, 1.8, -1.0), '#d8cdb5'), col(new THREE.BoxGeometry(0.9, 0.4, 0.1).translate(0, 1.9, -0.48), '#2b3d5c', 0.2), col(new THREE.BoxGeometry(0.3, 4.2, 0.3).translate(0, 3.2, 1.1), '#d6a136'), col(new THREE.BoxGeometry(0.9, 0.5, 0.6).translate(0, 5.1, 1.1), '#e6dcc6')];
  for (const z of [-1.1, 0, 1.1]) for (const x of [-1.2, 1.2]) L.push(col(new THREE.CylinderGeometry(0.42, 0.42, 0.34, 10).rotateZ(Math.PI / 2).translate(x, 0.42, z), '#3a3530'));
  L.push(col(new THREE.SphereGeometry(0.12, 6, 4).translate(0, 5.45, 1.1), '#ff4030', 4.0)); return merge(L); }
function bitGeo() { return merge([col(new THREE.CylinderGeometry(0.32, 0.32, 1.4, 10), '#b8b2a6'), col(new THREE.TorusGeometry(0.34, 0.06, 4, 10).rotateX(Math.PI / 2).translate(0, 0.3, 0), '#c8912a'), col(new THREE.TorusGeometry(0.34, 0.06, 4, 10).rotateX(Math.PI / 2).translate(0, -0.2, 0), '#c8912a'), col(new THREE.ConeGeometry(0.3, 0.6, 10).rotateX(Math.PI).translate(0, -1.0, 0), '#d8d0c0')]); }

// one additive particle system for dust, steam, sparks, engine/flame trails
function makeParticles(scene, N) {
  const g = new THREE.BufferGeometry(); const P = new Float32Array(N * 3), C = new Float32Array(N * 4), S = new Float32Array(N); g.setAttribute('position', new THREE.BufferAttribute(P, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('color', new THREE.BufferAttribute(C, 4).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('size', new THREE.BufferAttribute(S, 1).setUsage(THREE.DynamicDrawUsage));
  const m = new THREE.ShaderMaterial({ uniforms: { uScale: { value: innerHeight * 0.6 } }, transparent: true, depthWrite: false, toneMapped: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    vertexShader: `attribute float size; attribute vec4 color; varying vec4 vC; uniform float uScale; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = min(size * uScale / max(0.5, -mv.z), 160.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec4 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float a = exp(-dot(d, d) * 12.0); if (a < 0.03) discard; gl_FragColor = vec4(vC.rgb * a, vC.a * a); }` });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 4; pts.name = 'life_particles'; scene.add(pts);
  const L = Array.from({ length: N }, () => ({ life: 0 })); let pi = 0;
  return { pts, m, emit(x, y, z, vx, vy, vz, life, size, r, gc, b, occ, kind, grow = 0, grav = 0) { const p = L[pi]; pi = (pi + 1) % N; Object.assign(p, { x, y, z, vx, vy, vz, life, max: life, size, r, g: gc, b, occ, kind, grow, grav }); },
    update(dt) { let any = false; for (let i = 0; i < N; i++) { const p = L[i]; if (p.life <= 0) { S[i] = 0; continue; } any = true; p.life -= dt; p.vy -= p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; const f = Math.max(0, p.life / p.max); P[i * 3] = p.x; P[i * 3 + 1] = p.y; P[i * 3 + 2] = p.z; const k = p.kind === 'smoke' ? Math.sin(f * Math.PI) : f; C[i * 4] = p.r * k; C[i * 4 + 1] = p.g * k; C[i * 4 + 2] = p.b * k; C[i * 4 + 3] = p.occ * k; S[i] = p.size + p.grow * (1 - f); }
      pts.visible = any; if (any) { g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.attributes.size.needsUpdate = true; } m.uniforms.uScale.value = innerHeight * 0.6; } };
}

// billboards with procedural looks: kind 0 jelly, 1 bunny silhouette, 2 shooting star, 3 engine glow
function makeBillboards(scene, N) {
  const g = new THREE.InstancedBufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
  const iP = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4), iD = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4); iP.setUsage(THREE.DynamicDrawUsage); iD.setUsage(THREE.DynamicDrawUsage); g.setAttribute('iP', iP); g.setAttribute('iD', iD); g.instanceCount = N;
  const U = { uT: { value: 0 } };
  const m = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    vertexShader: `attribute vec4 iP; attribute vec4 iD; varying vec2 vUv; varying vec4 vD; varying float vS; void main(){ vD = iD; vUv = position.xy + 0.5; vS = iP.w; vec3 R = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), Up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
      vec3 p; if (iD.x > 1.5) { vec3 dir = normalize(vec3(cos(iD.z), -0.55, sin(iD.z))); vec3 toC = normalize(cameraPosition - iP.xyz); vec3 sd = normalize(cross(dir, toC)); p = iP.xyz + dir * (position.y - 0.5) * iP.w * 8.0 * -1.0 + sd * position.x * iP.w * 0.6; } else p = iP.xyz + (R * position.x * (iD.x > 0.5 ? 1.4 : 1.0) + Up * position.y * (iD.x > 0.5 ? 1.0 : 1.3)) * iP.w;
      gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform float uT; varying vec2 vUv; varying vec4 vD; varying float vS;
      void main(){ vec2 u = vUv; vec3 c = vec3(0.0); float a = 0.0; if (vS <= 0.0) discard;
        if (vD.x < 0.5) { float ph = uT * 1.6 + vD.y; float pu = 0.5 + 0.5 * sin(ph); vec2 b = (u - vec2(0.5, 0.7)) / vec2(0.36 + 0.05 * pu, 0.22 - 0.03 * pu); float bell = smoothstep(1.0, 0.75, length(b)) * step(-0.25, b.y); float rim = smoothstep(0.8, 1.0, length(b)) * smoothstep(1.15, 1.0, length(b)) * step(-0.3, b.y);
          float ten = 0.0; for (int i = 0; i < 5; i++) { float x0 = 0.3 + float(i) * 0.1; float x = x0 + 0.03 * sin(u.y * 14.0 - uT * 3.0 + float(i)); ten += smoothstep(0.012, 0.0, abs(u.x - x)) * step(u.y, 0.58) * smoothstep(0.02, 0.5, u.y); }
          vec3 jc = mix(vec3(0.35, 0.8, 1.6), vec3(1.2, 0.7, 1.8), 0.5 + 0.5 * sin(ph * 0.5)); c = jc * (bell * 0.55 + rim * 1.2 + ten * 0.8) * (0.7 + 0.5 * pu); a = (bell * 0.25 + rim * 0.3 + ten * 0.2); }
        else if (vD.x < 1.5) { vec2 q = u - 0.5; float run = sin(uT * 18.0) * 0.06; float body = smoothstep(0.02, 0.0, length((q - vec2(0.0, -0.05)) / vec2(0.26, 0.15)) - 1.0); float head = smoothstep(0.02, 0.0, length((q - vec2(0.24, 0.08)) / vec2(0.11, 0.1)) - 1.0);
          float ear1 = smoothstep(0.02, 0.0, length((q - vec2(0.22, 0.27 + run * 0.3)) / vec2(0.03, 0.12)) - 1.0), ear2 = smoothstep(0.02, 0.0, length((q - vec2(0.28, 0.25)) / vec2(0.03, 0.11)) - 1.0); float leg = smoothstep(0.02, 0.0, length((q - vec2(-0.15 + run, -0.22)) / vec2(0.1, 0.05)) - 1.0) + smoothstep(0.02, 0.0, length((q - vec2(0.12 - run, -0.21)) / vec2(0.07, 0.04)) - 1.0);
          float s = clamp(body + head + ear1 + ear2 + leg, 0.0, 1.0); c = vec3(0.9, 0.9, 1.0) * s * 0.9; a = s * 0.9; }
        else if (vD.x < 2.5) { float w = smoothstep(0.5, 0.0, abs(u.x - 0.5)); float t = pow(u.y, 3.0); c = vec3(1.4, 1.2, 0.8) * w * t * 1.6 + vec3(2.0) * w * smoothstep(0.92, 1.0, u.y); a = 0.0; }
        else { float r = length(u - 0.5); float g = exp(-r * r * 30.0); c = (vD.y > 0.5 ? vec3(2.2, 1.0, 0.3) : vec3(0.5, 1.2, 2.4)) * g * 1.6; a = 0.0; }
        gl_FragColor = vec4(c, a); }` });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 3; mesh.name = 'life_billboards'; scene.add(mesh);
  return { mesh, U, set(i, x, y, z, s, kind, a = 0, b = 0) { iP.setXYZW(i, x, y, z, s); iD.setXYZW(i, kind, a, b, 0); }, flush() { iP.needsUpdate = true; iD.needsUpdate = true; } };
}

// ---------- audio (WebAudio, synthesized; starts on first gesture; mute saved) ----------
function makeAudio() {
  let ctx = null, master = null, muted = localStorage.getItem('mk_mute') === '1', humG = null;
  const start = () => { if (ctx) return; try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; } master = ctx.createGain(); master.gain.value = muted ? 0 : 0.55; master.connect(ctx.destination);
    humG = ctx.createGain(); humG.gain.value = 0.05; humG.connect(master); for (const f of [55, 82.4, 110.3]) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = f === 55 ? 0.6 : 0.25; o.connect(g); g.connect(humG); o.start(); }
    const pad = ctx.createGain(); pad.gain.value = 0.0; pad.connect(master); const chords = [[220, 277.2, 329.6], [196, 246.9, 293.7], [174.6, 220, 261.6], [196, 246.9, 329.6]]; let ci = 0; const osc = chords[0].map(f => { const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = 0.018; o.connect(g); g.connect(pad); o.start(); return o; });
    pad.gain.setTargetAtTime(1, ctx.currentTime, 4); setInterval(() => { ci = (ci + 1) % chords.length; osc.forEach((o, k) => o.frequency.setTargetAtTime(chords[ci][k], ctx.currentTime, 1.5)); }, 8000); };
  const once = () => { start(); removeEventListener('pointerdown', once); removeEventListener('keydown', once); }; addEventListener('pointerdown', once); addEventListener('keydown', once);
  const blip = (f0, f1, dur, vol = 0.08, type = 'square') => { if (!ctx || muted) return; const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, ctx.currentTime); o.frequency.exponentialRampToValueAtTime(f1, ctx.currentTime + dur); g.gain.setValueAtTime(vol, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur); o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + dur + 0.02); };
  const noise = (dur, f, q, vol) => { if (!ctx || muted) return; const n = ctx.createBufferSource(); const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; n.buffer = b; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; const g = ctx.createGain(); g.gain.setValueAtTime(vol, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur); n.connect(bp); bp.connect(g); g.connect(master); n.start(); };
  return { get muted() { return muted; }, setMuted(v) { muted = v; localStorage.setItem('mk_mute', v ? '1' : '0'); if (master) master.gain.value = v ? 0 : 0.55; },
    beep() { const f = 600 + Math.random() * 900; blip(f, f * (Math.random() < 0.5 ? 1.6 : 0.6), 0.09, 0.05); setTimeout(() => blip(f * 1.3, f * 0.9, 0.07, 0.04), 110); },
    step() { noise(0.06, 380, 1.2, 0.05); }, radio() { noise(0.35, 1800, 0.8, 0.04); setTimeout(() => blip(1200, 1200, 0.05, 0.03, 'sine'), 360); }, whoosh() { noise(1.4, 500, 0.6, 0.03); } };
}

export function makeWorldLife({ scene, camera, env, groundAt, depotP, fields, base, launch, crater, t, hud, low, mobile, ctrl, dish }) {
  const mat = vcMat(env); const root = new THREE.Group(); root.name = 'world_life'; scene.add(root);
  const parts = makeParticles(scene, low ? 140 : mobile ? 200 : 300); const bb = makeBillboards(scene, 12); const audio = makeAudio();
  // sky ships: 2 shuttles + 1 satellite, merged-geometry meshes moved along arcs high in the sky
  const shG = shuttleGeo(); const ships = [0, 1].map(i => { const m = new THREE.Mesh(shG, mat); m.name = 'life_ship'; m.scale.setScalar(2.2); root.add(m); return { m, t: i * 14, dur: 26 + i * 6, a0: 0.6 + i * 2.4, h: 70 + i * 25, r: 260 + i * 60 }; });
  const sat = new THREE.Mesh(satGeo(), mat); sat.name = 'life_sat'; sat.scale.setScalar(3); root.add(sat);
  const lift = new THREE.Mesh(shG, mat); lift.name = 'life_liftoff'; lift.scale.setScalar(2.6); root.add(lift); let liftT = 5;
  // ground vehicles
  const rover = new THREE.Mesh(roverGeo(), mat); rover.name = 'life_rover'; rover.castShadow = true; root.add(rover);
  const drill = new THREE.Mesh(drillGeo(), mat); drill.name = 'life_drill'; root.add(drill); const bit = new THREE.Mesh(bitGeo(), mat); bit.position.set(0, 1.0, 1.1); drill.add(bit);
  // rotating radar dish next to the base
  if (!dish) { const rg = merge([col(new THREE.CylinderGeometry(0.25, 0.4, 3.2, 8).translate(0, 1.6, 0), '#d8cdb5'), col(new THREE.BoxGeometry(0.8, 0.5, 0.8).translate(0, 3.3, 0), '#c8912a')]); const st_ = new THREE.Mesh(rg, mat); const rx = base.x + 22, rz = base.z - 12; st_.position.set(rx, groundAt(rx, rz), rz); root.add(st_);
    dish = new THREE.Mesh(merge([col(new THREE.SphereGeometry(2.2, 16, 6, 0, Math.PI * 2, 0, 0.9).rotateX(-Math.PI / 2 + 0.5).translate(0, 0.6, 0), '#efe6d2'), col(new THREE.CylinderGeometry(0.05, 0.05, 2.0, 4).rotateX(-0.6).translate(0, 1.3, 0.55), '#c8912a'), col(new THREE.SphereGeometry(0.15, 6, 4).translate(0, 2.1, 1.1), '#7fe0ff', 3.0)]), mat); dish.position.set(0, 3.5, 0); st_.add(dish); dish.name = 'life_radar'; }
  // beacons (instanced spheres, blinking) on the base
  const bN = 6; const beacons = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), bN); beacons.name = 'life_beacons'; root.add(beacons);
  const bPos = Array.from({ length: bN }, (_, i) => { const a = i / bN * Math.PI * 2 + 0.3, r = 9 + (i % 2) * 6; const x = base.x + Math.cos(a) * r, z = base.z + Math.sin(a) * r; return { x, z, y: groundAt(x, z) + 3.2 + (i % 3) * 1.4, c: i % 2 ? new THREE.Color(2.6, 0.25, 0.15) : new THREE.Color(0.3, 1.2, 2.8), ph: i * 0.7 }; });
  // rover loop: field centroid -> depot -> back, a closed Catmull-Rom loop on the ground
  const F = fields.length ? fields.reduce((a, s) => ({ x: a.x + s.x / fields.length, z: a.z + s.z / fields.length }), { x: 0, z: 0 }) : { x: depotP.x + 30, z: depotP.z };
  const mid = { x: (F.x + depotP.x) / 2, z: (F.z + depotP.z) / 2 }; const nx = -(F.z - depotP.z), nz = F.x - depotP.x, nl = Math.hypot(nx, nz) || 1;
  const loopPts = [[depotP.x + 4, depotP.z + 4], [mid.x + nx / nl * 9, mid.z + nz / nl * 9], [F.x + 3, F.z + 3], [mid.x - nx / nl * 9, mid.z - nz / nl * 9]].map(([x, z]) => new THREE.Vector3(x, 0, z));
  const loop = new THREE.CatmullRomCurve3(loopPts, true); const loopLen = loop.getLength();
  // drill site: next to the field, facing it
  const D = { x: F.x - 10, z: F.z + 7 }; drill.position.set(D.x, groundAt(D.x, D.z), D.z); drill.rotation.y = Math.atan2(F.x - D.x, F.z - D.z);
  // steam vents near the base
  const vents = [0, 1, 2].map(i => { const a = 1.1 + i * 2.1, r = 14 + i * 3; const x = base.x + Math.cos(a) * r, z = base.z + Math.sin(a) * r; return { x, z, y: groundAt(x, z) + 1.2, tt: i * 0.7 }; });
  // lore anchors
  const J = crater; const bunnyPath = { a0: Math.atan2(J.z - base.z, J.x - base.x) + 0.9 };
  const RADIO = ['radio1', 'radio2', 'radio3', 'radio4', 'radio5']; let radioT = 25, beepT = 3, stepT = 0, waveCD = 0, starT = 2; const stars = [];
  let on = true, T = 0; const v = new THREE.Vector3(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  // mute toggle on the HUD
  const mb = document.createElement('button'); mb.id = 'mk-mute'; mb.className = 'pe'; mb.textContent = audio.muted ? '🔇' : '🔊'; mb.setAttribute('aria-label', 'mute');
  mb.style.cssText = 'position:absolute;right:max(10px,env(safe-area-inset-right));top:max(64px,calc(env(safe-area-inset-top) + 56px));width:38px;height:38px;border-radius:50%;border:1.5px solid #C8912A;background:radial-gradient(circle,#13214a,#0B1530);color:#fff;font-size:16px;box-shadow:0 0 8px rgba(103,215,240,.45);pointer-events:auto';
  mb.addEventListener('click', () => { audio.setMuted(!audio.muted); mb.textContent = audio.muted ? '🔇' : '🔊'; }); (hud.root || document.body).appendChild(mb);
  const sub = (key) => { const s = t(key); if (s && s !== key) hud.toast('📻 ' + s); };

  function update(dt, time, cat, robots) {
    if (!on) return; T += dt; bb.U.uT.value = T;
    const cam = camera.position;
    // ships across the sky (relative to the base so they read from anywhere)
    for (const s of ships) { s.t += dt; const u = (s.t % s.dur) / s.dur; const a = s.a0 + u * 2.2; const x = base.x + Math.cos(a) * s.r, z = base.z + Math.sin(a) * s.r, y = groundAt(base.x, base.z) + s.h + Math.sin(u * Math.PI) * 30; s.m.position.set(x, y, z); const tx = -Math.sin(a), tz = Math.cos(a); s.m.rotation.set(0, Math.atan2(-tz, tx), 0.12); s.m.visible = u > 0.02 && u < 0.98; }
    { const u = (T % 70) / 70; const a = 2.0 + u * 2.8; sat.position.set(base.x + Math.cos(a) * 340, groundAt(base.x, base.z) + 150 + Math.sin(u * 3.1) * 20, base.z + Math.sin(a) * 340); sat.rotation.y += dt * 0.25; sat.rotation.z = 0.4; }
    // distant shuttle lift-off at the launch site, then re-lands after a pause
    liftT += dt; { const cyc = 48, k = liftT % cyc; const gy = groundAt(launch.x, launch.z); const climb = k < 18 ? Math.pow(k / 18, 2) * 260 : 260 + (k - 18) * 40; lift.visible = k < 30; lift.position.set(launch.x + (k > 8 ? (k - 8) * (k - 8) * 0.25 : 0), gy + 6 + climb, launch.z); lift.rotation.set(0, 0, Math.PI / 2 - Math.min(0.5, Math.max(0, k - 8) * 0.03));
      if (lift.visible && k < 26) { for (let n = 0; n < 2; n++) parts.emit(lift.position.x - 1, lift.position.y - 5, lift.position.z, (Math.random() - 0.5) * 3, -8 - Math.random() * 6, (Math.random() - 0.5) * 3, 1.2, 4.5, 2.2, 1.0, 0.3, 0.0, 'fire', 6); if (k < 4) parts.emit(launch.x + (Math.random() - 0.5) * 8, gy + 1, launch.z + (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6, 1.5, (Math.random() - 0.5) * 6, 2.5, 4, 0.5, 0.5, 0.5, 0.35, 'smoke', 10); } }
    // engine glows for the ships, shooting stars, jellies, bunny (billboards)
    let bi = 0; for (const s of ships) { if (s.m.visible) { s.m.localToWorld(v.set(-2.5, 0, 0)); bb.set(bi, v.x, v.y, v.z, 7, 3, 0); } else bb.set(bi, 0, -999, 0, 0, 3); bi++; }
    starT -= dt; if (starT <= 0) { starT = 1.5 + Math.random() * 3; stars.push({ a: Math.random() * 6.28, t: 0, h: 120 + Math.random() * 80, r: 220 + Math.random() * 120, dir: Math.random() * 6.28 }); if (stars.length > 3) stars.shift(); }
    for (let k = 0; k < 3; k++) { const s = stars[k]; if (s && s.t < 1.2) { s.t += dt; const x = cam.x + Math.cos(s.a) * s.r + Math.cos(s.dir) * s.t * 60, z = cam.z + Math.sin(s.a) * s.r + Math.sin(s.dir) * s.t * 60, y = cam.y + s.h - s.t * 35; bb.set(bi, x, y, z, 6 * (1 - s.t / 1.2) + 0.5, 2, 0, s.dir); } else bb.set(bi, 0, -999, 0, 0, 2); bi++; }
    for (let k = 0; k < 4; k++) { const a = k * 1.7 + T * 0.03; const x = J.x + Math.cos(a) * (14 + k * 6), z = J.z + Math.sin(a) * (14 + k * 6), y = groundAt(J.x, J.z) + 22 + k * 7 + Math.sin(T * 0.6 + k) * 3; bb.set(bi++, x, y, z, 8 + k * 2, 0, k * 1.3); }
    { const cyc = 75, k = T % cyc; if (k < 6) { const a = bunnyPath.a0 + k * 0.05; const r = 320; const x = base.x + Math.cos(a) * r, z = base.z + Math.sin(a) * r; bb.set(bi, x, groundAt(x, z) + 3 + Math.abs(Math.sin(k * 6)) * 2.5, z, 5, 1, 0); } else bb.set(bi, 0, -999, 0, 0, 1); bi++; }
    bb.flush();
    // rover on its loop: follows the ground, dust trail, crystals while hauling back
    { const u = ((T * 4.2) / loopLen) % 1; loop.getPointAt(u, v); const gy = groundAt(v.x, v.z); const tng = loop.getTangentAt(u); rover.position.set(v.x, gy, v.z); rover.rotation.y = Math.atan2(tng.x, tng.z);
      const e = 0.9; const fy = groundAt(v.x + tng.x * e, v.z + tng.z * e), by = groundAt(v.x - tng.x * e, v.z - tng.z * e); rover.rotation.x = -Math.atan2(fy - by, 2 * e) ; rover.visible = Math.hypot(v.x - cam.x, v.z - cam.z) < 160;
      if (rover.visible && Math.random() < dt * 30) { const bx = v.x - tng.x * 1.6, bz = v.z - tng.z * 1.6; parts.emit(bx + (Math.random() - 0.5), gy + 0.3, bz + (Math.random() - 0.5), (Math.random() - 0.5) * 0.8, 0.5 + Math.random() * 0.5, (Math.random() - 0.5) * 0.8, 1.6, 0.9, 0.42, 0.4, 0.38, 0.3, 'smoke', 2.2); } }
    // drill: bit spins + bobs, sparks at the ground
    { const dv = Math.hypot(D.x - cam.x, D.z - cam.z) < 140; drill.visible = dv; if (dv) { bit.rotation.y += dt * 14; bit.position.y = 0.9 + Math.sin(T * 1.3) * 0.25; if (Math.random() < dt * 25) { drill.localToWorld(v.set(0, 0.05, 1.1)); parts.emit(v.x, v.y, v.z, (Math.random() - 0.5) * 5, 2 + Math.random() * 3, (Math.random() - 0.5) * 5, 0.5, 0.25, 2.6, 1.4, 0.4, 0, 'spark', 0, 9); } } }
    // steam puffs
    for (const s of vents) { s.tt -= dt; if (s.tt <= 0) { s.tt = 0.25 + Math.random() * 0.3; if (Math.hypot(s.x - cam.x, s.z - cam.z) < 120) parts.emit(s.x, s.y, s.z, (Math.random() - 0.5) * 0.4, 1.6 + Math.random() * 0.6, (Math.random() - 0.5) * 0.4, 3.2, 1.0, 0.55, 0.55, 0.58, 0.32, 'smoke', 3.5); } }
    // beacons blink, dish turns
    { const M = new THREE.Matrix4(); bPos.forEach((b, i) => { const on_ = Math.sin(T * 3.0 + b.ph) > 0.2; M.makeTranslation(b.x, b.y, b.z); beacons.setMatrixAt(i, M); beacons.setColorAt(i, on_ ? b.c : new THREE.Color(0.06, 0.06, 0.08)); }); beacons.instanceMatrix.needsUpdate = true; if (beacons.instanceColor) beacons.instanceColor.needsUpdate = true; }
    if (dish) dish.rotation.y += dt * 0.15;
    parts.update(dt);
    // audio: robot beeps nearby, footsteps, radio chatter with subtitles; robots greet the cat
    beepT -= dt; stepT -= dt; radioT -= dt; waveCD -= dt;
    if (robots && robots.length) { let nd = 1e9, nr = null; for (const r of robots) { const d = Math.hypot(r.x - cat.x, r.z - cat.z); if (d < nd) { nd = d; nr = r; } }
      if (beepT <= 0 && nd < 18) { beepT = 2.5 + Math.random() * 4; audio.beep(); }
      if (nr && nd < 3.2 && waveCD <= 0) { waveCD = 12; audio.beep(); nr.wave && nr.wave(); hud.toast('🤖 ' + t('robotHi')); } }
    if (ctrl && ctrl.onGround && ctrl.speed > 0.8 && stepT <= 0) { stepT = 0.42 / Math.min(2, ctrl.speed / 2); audio.step(); }
    if (radioT <= 0) { radioT = 40 + Math.random() * 40; audio.radio(); sub(RADIO[Math.floor(Math.random() * RADIO.length)]); }
  }
  return { root, update, audio, setVisible(v_) { on = v_; root.visible = v_; parts.pts.visible = v_; bb.mesh.visible = v_; mb.style.display = v_ ? '' : 'none'; }, meshes: { rover, drill, ships, sat, lift, beacons } };
}
