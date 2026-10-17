import * as THREE from 'three';
import { GLTFLoader } from '../vendor/three/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from '../vendor/three/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/three/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/three/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/three/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from '../vendor/three/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from '../vendor/three/jsm/shaders/FXAAShader.js';
import { buildTerrain, groundAt, sd, F, Rt, LOOKOUT, CONCEPT, PLAY_START } from './terrain.js';
import { Builder } from './builder.js';
import { buildHub, colliders, C } from './base.js';
import { buildWorld } from './world.js';
import { buildRocks, buildCrystals, beamMaterial, addBeams, InstanceCuller, buildTracks, TRACK_MAIN } from './props.js';
import { makeAtlas, EMISSIVE_INTENSITY } from './atlas.js';
import { buildSky, buildSpace } from './sky.js';
import { Controller } from './controller.js';

const Q = new URLSearchParams(location.search);
const SHOT = Q.has('shot'); const VIEW = Q.get('view') || 'play';
const LOW = Q.get('q') === 'low';
const MOBILE = Q.get('q') === 'mobile' || (!Q.get('q') && (matchMedia('(pointer:coarse)').matches || Math.min(innerWidth, innerHeight) < 480));
const BLOOM = Q.get('bloom') !== '0' && !LOW;
document.body.classList.toggle('shot', SHOT);

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: SHOT });
let PR = Math.min(devicePixelRatio, LOW ? 1 : MOBILE ? 1.25 : 1.5); if (Q.get('pr')) PR = +Q.get('pr');
renderer.setPixelRatio(PR); renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = +(Q.get('exp') || 0.92);
renderer.shadowMap.enabled = !LOW; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2('#1e2024', 0.0011);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.2, 9000);

// light: sun from camera-left in the concept framing, cool sky fill, warm bounce
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const sunDir = v3(-Rt.x * 0.75 - F.x * 0.45, 0.62, -Rt.z * 0.75 - F.z * 0.45).normalize();
const earthYaw = 0.322, earthEl = 0.096; // radians relative to concept forward
const ef = v3(F.x, 0, F.z).applyAxisAngle(v3(0, 1, 0), -earthYaw); const earthDir = ef.multiplyScalar(Math.cos(earthEl)).add(v3(0, Math.sin(earthEl), 0)).normalize();
const hemi = new THREE.HemisphereLight('#b3b6bc', '#4f4840', 0.6); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff1dc', 2.3); sun.castShadow = true;
sun.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048); const sc = sun.shadow.camera; sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 400; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight('#8f9aab', 0.45); fill.position.copy(earthDir).multiplyScalar(100); scene.add(fill);
const front = new THREE.DirectionalLight('#d6d3cc', 0.55); front.position.set(-F.x * 80 - Rt.x * 40, 60, -F.z * 80 - Rt.z * 40); scene.add(front); // soft key from behind the concept camera (lights the left hillside)
const coreLight = new THREE.PointLight('#ff9a40', 60, 32, 1.6); scene.add(coreLight);

// environment for gold/ivory reflections: dark sky, light ground, warm sun panel
function makeEnv() {
  const s = new THREE.Scene();
  const g = new THREE.SphereGeometry(10, 32, 16); const col = []; const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) { const y = P.getY(i) / 10; const c = new THREE.Color(); if (y > 0) c.set('#0b1626').lerp(new THREE.Color('#2a3d58'), Math.pow(1 - y, 4)); else c.set('#6d6b68').lerp(new THREE.Color('#3a3936'), -y); col.push(c.r, c.g, c.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  s.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(12, 10, 8), side: THREE.DoubleSide })); panel.position.copy(sunDir).multiplyScalar(8); panel.lookAt(0, 0, 0); s.add(panel);
  const p2 = new THREE.Mesh(new THREE.PlaneGeometry(8, 3), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 2.2, 3.5), side: THREE.DoubleSide })); p2.position.copy(earthDir).multiplyScalar(8); p2.lookAt(0, 0, 0); s.add(p2);
  const pm = new THREE.PMREMGenerator(renderer); const rt = pm.fromScene(s, 0.02); pm.dispose(); return rt.texture;
}
const env = makeEnv();

// ---------- world ----------
const terrain = buildTerrain(); scene.add(terrain);
const b = new Builder(), wb = new Builder(); const beams = [];
const WB = { launch: new Builder(), reactor: new Builder(), canyon: new Builder(), echo: new Builder(), roads: new Builder(), misc: new Builder() };
const hub = buildHub(b, beams); buildWorld(WB, beams); addBeams(wb, beams);
coreLight.position.set(hub.reactor.x, hub.reactor.y + 2.5, hub.reactor.z);
const atlas = makeAtlas();
const hullOpts = { map: atlas.map, emissiveMap: atlas.emissiveMap, emissive: '#ffffff', emissiveIntensity: EMISSIVE_INTENSITY, roughnessMap: atlas.ormMap, metalnessMap: atlas.ormMap, roughness: 1, metalness: 1, vertexColors: true, envMap: env, envMapIntensity: 0.75 };
const mats = {
  hull: new THREE.MeshStandardMaterial(hullOpts),
  lattice: new THREE.MeshStandardMaterial({ ...hullOpts, alphaTest: 0.5, side: THREE.DoubleSide }),
  beam: beamMaterial(),
};
mats.ivory = mats.hull; // placeholder fallback
const built = b.build(mats, scene); for (const [n, B] of [...Object.entries(WB), ['beams', wb]]) { const bw = B.build(mats, scene, '_' + n); for (const k in bw) bw[k].castShadow = false; }
const culler = new InstanceCuller();
const rocks = buildRocks(scene, culler, LOW ? 0.6 : MOBILE ? 0.8 : 1);
const crystals = buildCrystals(scene, env);
{ const pts = []; for (let i = 0; i <= 46; i++) { const t = i / 46; pts.push(TRACK_MAIN(t)); }
  const loop = []; for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2; loop.push({ x: Math.cos(a) * 31, z: Math.sin(a) * 31 }); }
  const spur = []; for (let i = 0; i <= 20; i++) { const t = i / 20; spur.push(sd(-1.5 - t * 3 + Math.sin(t * 3) * 1.5, -11 - t * 20)); }
  const toPortal = []; for (let i = 0; i <= 20; i++) { const t = i / 20; toPortal.push(sd(22 + t * 9, 18 + t * 13 + Math.sin(t * 3) * 2)); }
  buildTracks(scene, [pts, loop, spur, toPortal]); }
const sky = buildSky(sunDir, earthDir); scene.add(sky.group); sky.starMat.uniforms.uPR.value = PR;
const space = buildSpace(scene, mats.hull);

// ---------- cat ----------
const ctrl = new Controller(camera, renderer.domElement, colliders);
const catRoot = new THREE.Group(); scene.add(catRoot);
let mixer = null, actions = {}, current = null, headBone = null, headYaw = 0;
const _hq = new THREE.Quaternion(), _hp = new THREE.Quaternion(), _hr = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0), _hw = new THREE.Vector3();
let lookTarget = null; // world point the cat looks at (concept), else camera forward while idle
function headLook(dt) {
  if (!headBone) return; catRoot.updateMatrixWorld(true);
  let want = 0;
  if (lookTarget && !ctrl.camFree) { headBone.getWorldPosition(_hw); want = Math.atan2(lookTarget.x - _hw.x, lookTarget.z - _hw.z) - ctrl.yaw; }
  else if (ctrl.camFree && ctrl.speed < 0.6 && ctrl.onGround) { const d = new THREE.Vector3(); camera.getWorldDirection(d); want = Math.atan2(d.x, d.z) - ctrl.yaw; }
  want = Math.atan2(Math.sin(want), Math.cos(want)); want = THREE.MathUtils.clamp(want, -0.95, 0.95);
  headYaw = dt >= 0.5 ? want : headYaw + (want - headYaw) * Math.min(1, dt * 4);
  headBone.userData.pre = (headBone.userData.pre || new THREE.Quaternion()).copy(headBone.quaternion); headBone.parent.getWorldQuaternion(_hp); _hr.setFromAxisAngle(_up, headYaw); _hq.copy(_hp).invert().multiply(_hr).multiply(_hp); headBone.quaternion.premultiply(_hq); headBone.updateMatrixWorld(true);
}
const flame = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.9, 10, 1, true).rotateX(Math.PI).translate(0, -0.35, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.2, 0.8), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
flame.position.set(0, 0.85, -0.45); flame.visible = false; catRoot.add(flame);
function play(name, fade = 0.25) { const a = actions[name]; if (!a || current === a) return; a.reset().fadeIn(fade).play(); if (current) current.fadeOut(fade); current = a; }
const catURL = Q.get('cat') || 'assets/moonkatty.glb';
const catPromise = new GLTFLoader().loadAsync(catURL + '?v=' + Date.now()).then(gltf => {
  const m = gltf.scene; m.traverse(o => { if (o.isMesh) { o.castShadow = !/Eye|Glow|Dome|Glint|Outline/i.test(Array.isArray(o.material) ? '' : o.material.name); o.receiveShadow = true; o.frustumCulled = false; const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const mt of ms) { if (mt.transmission > 0) { mt.transmission = 0; mt.transparent = true; mt.opacity = Math.min(mt.opacity, 0.35); mt.depthWrite = false; } /* transmission would re-render the whole opaque scene every frame */ if (mt.isMeshStandardMaterial) { mt.envMap = env; mt.envMapIntensity = /gold/i.test(mt.name) ? 1.6 : 0.6; } if (/Face|Fur|Eye/i.test(mt.name) && mt.isMeshStandardMaterial) { /* cat-only warm fill: face reads bright orange inside the dome even with the sun behind (no scene light added) */ if (mt.map) mt.emissiveMap = mt.map; mt.emissive = new THREE.Color(/Eye/i.test(mt.name) ? '#8a8a8a' : '#ffc89a'); mt.emissiveIntensity = /Eye/i.test(mt.name) ? 0.3 : 0.42; mt.needsUpdate = true; } if (/^MK_Dome$/i.test(mt.name)) { /* clear glass: weaker env/spec glare so the face reads through the helmet */ mt.opacity = 0.16; mt.envMapIntensity = 0.3; if ('specularIntensity' in mt) mt.specularIntensity = 0.5; if ('clearcoat' in mt) mt.clearcoat = 0; mt.needsUpdate = true; } if (/DomeGlint/i.test(mt.name)) mt.opacity = 0.22; if (/Fur/i.test(mt.name)) mt.emissiveIntensity = 0.3; } } });
  catRoot.add(m); m.traverse(o => { if (!headBone && /^head$/i.test(o.name)) headBone = o; }); if (!headBone) m.traverse(o => { if (!headBone && /head/i.test(o.name) && !o.isMesh) headBone = o; });
  if (gltf.animations.length) { mixer = new THREE.AnimationMixer(m); for (const c of gltf.animations) actions[c.name] = mixer.clipAction(c); play('idle', 0); }
  return gltf;
}).catch(err => { console.warn('cat glb missing, using placeholder', err); const ph = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.9, 4, 12), mats.ivory); ph.position.y = 0.85; ph.castShadow = true; catRoot.add(ph); });

// ---------- views ----------
const VIEWS = {
  concept: () => { lookTarget = new THREE.Vector3(...(() => { const p = sd(45, -48); return [p.x, 2, p.z]; })()); const K = CONCEPT; ctrl.place(K.cat.x, K.cat.z, Math.atan2(F.x, F.z) + K.catYaw); const gy = groundAt(K.cat.x, K.cat.z); camera.position.set(K.cam.x, gy + K.eye, K.cam.z); camera.lookAt(K.target.x, gy + K.eye - K.drop, K.target.z); camera.fov = K.fov; ctrl.camFree = false; },
  play: () => { lookTarget = null; const c = PLAY_START; ctrl.place(c.x, c.z, Math.atan2(F.x, F.z) + 0.25); ctrl.camYaw = Math.atan2(-F.x, -F.z) - 0.25; ctrl.camPitch = 0.22; ctrl.camDist = 7; ctrl.camFree = true; camera.fov = 55; },
  aerial: () => { lookTarget = null; const c = sd(-2, -57); ctrl.place(c.x, c.z, Math.atan2(F.x, F.z)); const p = sd(-70, -125); camera.position.set(p.x, 75, p.z); const t = sd(8, 25); camera.lookAt(t.x, -6, t.z); camera.fov = 50; ctrl.camFree = false; },
  world: () => { lookTarget = null; const c = sd(-2, -57); ctrl.place(c.x, c.z, Math.atan2(F.x, F.z)); camera.position.set(-260, 520, 820); camera.lookAt(40, 0, -60); camera.fov = 55; ctrl.camFree = false; },
  cave: () => { lookTarget = null; const c = sd(24, 20); ctrl.place(c.x, c.z, Math.atan2(F.x, F.z)); const p = sd(18, 14); camera.position.set(p.x, groundAt(p.x, p.z) + 7, p.z); const cv = hub.cave; camera.lookAt(cv.x, cv.y + 4, cv.z); camera.fov = 55; ctrl.camFree = false; },
  base: () => { lookTarget = null; const c = sd(16, -28); ctrl.place(c.x, c.z, Math.atan2(F.x, F.z) - 0.4); const p = sd(36, -60); camera.position.set(p.x, 34, p.z); const t = sd(0, 10); camera.lookAt(t.x, 2, t.z); camera.fov = 50; ctrl.camFree = false; },
};
(VIEWS[VIEW] || VIEWS.play)(); camera.updateProjectionMatrix();

// ---------- post ----------
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
composer.addPass(new RenderPass(scene, camera));
let bloom = null; if (BLOOM) { bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.38, 0.22, 2.2); composer.addPass(bloom); }
composer.addPass(new OutputPass());
const grade = new ShaderPass({ uniforms: { tDiffuse: { value: null }, uVig: { value: 0.3 } }, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uVig; varying vec2 vUv;
    void main(){ vec4 t = texture2D(tDiffuse, vUv); vec3 c = t.rgb; float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(c, c * vec3(0.97, 0.99, 1.03), (1.0 - smoothstep(0.0, 0.45, l)) * 0.4); // very slightly cool shadows (neutral grey, no navy)
      c += vec3(0.045, 0.02, -0.025) * smoothstep(0.45, 1.0, l); // warm highlights
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.18); // gentle S-curve
      vec2 d = vUv - 0.5; d.x *= 1.15; c *= 1.0 - uVig * smoothstep(0.3, 0.85, length(d) * 1.25);
      gl_FragColor = vec4(c, t.a); }` });
composer.addPass(grade);
const fxaa = new ShaderPass(FXAAShader); composer.addPass(fxaa);
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h); composer.setPixelRatio(PR); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); fxaa.material.uniforms.resolution.value.set(1 / (w * PR), 1 / (h * PR)); }
addEventListener('resize', resize); resize();

// ---------- HUD ----------
const joy = document.getElementById('joy');
ctrl.bindTouch(joy, document.getElementById('knob'), document.getElementById('jump'));
const fuelEl = document.getElementById('fuel');
document.getElementById('views').addEventListener('click', e => { const v = e.target.dataset.v; if (v) { (VIEWS[v])(); camera.updateProjectionMatrix(); if (v === 'concept' || v === 'aerial' || v === 'base') setTimeout(() => { }, 0); } });
addEventListener('keydown', e => { if (e.code === 'KeyC') { VIEWS.concept(); camera.updateProjectionMatrix(); } if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) && !ctrl.camFree) { ctrl.camFree = true; ctrl.camYaw = ctrl.yaw + Math.PI; camera.fov = 55; camera.updateProjectionMatrix(); } });
renderer.domElement.addEventListener('pointerdown', () => { if (!ctrl.camFree && !SHOT) { ctrl.camFree = true; ctrl.camYaw = Math.atan2(camera.position.x - ctrl.pos.x, camera.position.z - ctrl.pos.z); } });

// ---------- loop ----------
const clock = new THREE.Clock(); let t = 0; const ftimes = [];
function frame(dt) {
  t += dt;
  if (!SHOT) ctrl.update(dt); else { ctrl.pos.y = groundAt(ctrl.pos.x, ctrl.pos.z); if (ctrl.camFree) { ctrl.camTarget.copy(ctrl.pos).add(new THREE.Vector3(0, 1.3, 0)); ctrl.updateCamera(1); } }
  catRoot.position.copy(ctrl.pos); catRoot.rotation.y = ctrl.yaw;
  if (headBone && headBone.userData.pre) headBone.quaternion.copy(headBone.userData.pre);
  if (mixer) { if (!ctrl.onGround) play(actions.jump ? 'jump' : 'idle', 0.15); else if (ctrl.speed > 0.6) { play('walk'); actions.walk && (actions.walk.timeScale = THREE.MathUtils.clamp(ctrl.speed / 3.8, 0.7, 2.2)); } else play('idle'); mixer.update(dt); }
  headLook(SHOT ? 1 : dt);
  flame.visible = ctrl.thrusting; if (flame.visible) flame.scale.y = 0.8 + Math.random() * 0.5;
  crystals.update(t); mats.beam.uniforms.uTime.value = t; sky.starMat.uniforms.uTime.value = t; sky.earthMat.uniforms.uTime.value = t;
  sky.group.position.copy(camera.position);
  space.group.rotation.y = t * 0.002;
  // shadow frustum follows the focus point
  const focus = ctrl.camFree ? ctrl.pos : (VIEW === 'aerial' || VIEW === 'world' ? new THREE.Vector3(sd(0, 5).x, 0, sd(0, 5).z) : new THREE.Vector3(sd(0, -20).x, 0, sd(0, -20).z));
  sun.target.position.set(Math.round(focus.x), 0, Math.round(focus.z)); sun.position.copy(sun.target.position).addScaledVector(sunDir, 200);
  coreLight.intensity = 55 + Math.sin(t * 2.3) * 8;
  fuelEl.style.width = (ctrl.fuel * 100).toFixed(0) + '%';
  culler.update(camera);
  composer.render(dt);
}
function loop() { const dt = Math.min(clock.getDelta(), 0.05); const t0 = performance.now(); frame(dt); ftimes.push(performance.now() - t0); if (ftimes.length > 240) ftimes.shift(); requestAnimationFrame(loop); }

// test / screenshot API
window.MK = { THREE, camera, scene, sky, renderer, head: () => headBone && [headBone.name, headBone.type, +headYaw.toFixed(2)],
  ready: false,
  setView(v) { VIEWS[v](); camera.updateProjectionMatrix(); },
  renderOnce(dt = 1 / 60) { frame(dt); },
  stats() {
    const info = renderer.info; info.autoReset = false; const sm = renderer.shadowMap;
    sm.autoUpdate = false; sm.needsUpdate = false; info.reset(); renderer.render(scene, camera); const main = { calls: info.render.calls, triangles: info.render.triangles };
    sm.needsUpdate = true; info.reset(); renderer.render(scene, camera); const withShadow = { calls: info.render.calls, triangles: info.render.triangles };
    sm.autoUpdate = true; info.reset(); composer.render(0); const frameAll = { calls: info.render.calls, triangles: info.render.triangles };
    info.autoReset = true;
    culler.update(camera, true); const per = []; scene.traverse(o => { if ((o.isMesh || o.isPoints) && o.visible && o.geometry) { const g = o.geometry; const n = (g.index ? g.index.count : g.attributes.position.count) / (o.isPoints ? 1 : 3) * (o.isInstancedMesh ? o.count : 1); per.push([o.name || o.type, Math.round(n)]); } });
    per.sort((x, y) => y[1] - x[1]);
    return { culler: culler.stats(), rocks: rocks.counts, mainPass: main, mainPlusShadowPass: withShadow, wholeFrameInclPost: frameAll, top: per.slice(0, +(window.TOPN || 14)) };
  },
  ctrlState() { return { pos: ctrl.pos.toArray().map(v => +v.toFixed(2)), onGround: ctrl.onGround, fuel: +ctrl.fuel.toFixed(2), anim: current ? current.getClip().name : null, thrust: ctrl.thrusting }; },
  frameTimes() { const a = [...ftimes].sort((x, y) => x - y); return { n: a.length, avg: a.reduce((s, x) => s + x, 0) / a.length, p50: a[Math.floor(a.length / 2)], p95: a[Math.floor(a.length * 0.95)] }; },
  async measure(n = 30) { const out = []; for (let i = 0; i < n; i++) { const t0 = performance.now(); frame(1 / 60); { const gl = renderer.getContext(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); } out.push(performance.now() - t0); await new Promise(r => setTimeout(r, 0)); } out.sort((a, b) => a - b); return { n, p50: out[n >> 1], avg: out.reduce((s, x) => s + x, 0) / n, min: out[0], max: out[n - 1] }; },
};
catPromise.finally(() => { if (SHOT) { for (let i = 0; i < 3; i++) frame(1 / 60); MK.ready = true; } else { MK.ready = true; loop(); } document.getElementById('loading').style.display = 'none'; });
