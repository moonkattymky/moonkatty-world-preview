// Holographic 3D world map (concept 09b1aaa3, "variant B"): the cat raises its paw, the gold wrist device projects a tilted
// cyan hologram of the real terrain of the current region. Modal: while open the world is not updated/rendered (main.js).
// Shows: holo terrain (cyan contour edges, scanlines, flicker, translucency), miniature base, crystals, holo pins with icons +
// labels, orange cat marker (position + heading), quest target (yellow beam + dotted gold path), robots with progress rings,
// fog of war (persisted, dim + flickering), undiscovered caches as hints, bottom quest card with GO, zoom / rotate / close.
import * as THREE from 'three';

const FOG_N = 32;
// cyan line-art pin icons (concept 09b1aaa3), keyed by the emoji index.js sends
const sv = (b) => `<svg viewBox="0 0 32 32" fill="none" stroke="#9fefff" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">${b}</svg>`;
const ICONS = { '💎': sv('<path d="M16 3l5 9-5 17-5-17z"/><path d="M11 12h10"/><path d="M8 10l3 9 3 7M24 10l-3 9-3 7" opacity=".7"/>'), '🏠': sv('<path d="M5 22a11 11 0 0 1 22 0z"/><path d="M3 22h26M10 22v4h12v-4M16 11V6M14 6h4"/>'), '⚡': sv('<circle cx="16" cy="16" r="12" opacity=".6"/><path d="M17 6l-7 11h6l-1 9 7-12h-6z"/>'),
  '📡': sv('<path d="M16 14v14M11 28h10M13 20l3-6 3 6"/><path d="M10.5 9.5a8 8 0 0 1 11 0M7.5 6.5a12 12 0 0 1 17 0" opacity=".85"/><circle cx="16" cy="13" r="1.6"/>'), '⛰️': sv('<path d="M3 26l9-14 5 7 3-4 9 11z"/><path d="M10 15l2 2 2-2" opacity=".7"/>'), '🚀': sv('<path d="M16 3c4 4 5 10 3 17h-6c-2-7-1-13 3-17z"/><path d="M13 20l-4 5h5M19 20l4 5h-5M16 23v5"/><circle cx="16" cy="11" r="2"/>'),
  '🛬': sv('<ellipse cx="16" cy="22" rx="12" ry="5"/><ellipse cx="16" cy="22" rx="6" ry="2.4" opacity=".7"/><path d="M16 4v10M12 10l4 4 4-4"/>'), '🌀': sv('<path d="M3 26c0-10 6-17 13-17s13 7 13 17"/><path d="M9 26c0-6 3-10 7-10s7 4 7 10" opacity=".8"/><path d="M1 26h30"/>'), '❔': sv('<path d="M11.5 12a4.5 4.5 0 1 1 6.5 4c-1.4.8-2 1.6-2 3.2"/><circle cx="16" cy="24" r="1.2"/>'),
  '🕳️': sv('<ellipse cx="16" cy="18" rx="13" ry="6"/><ellipse cx="16" cy="18" rx="7" ry="3" opacity=".8"/><path d="M5 15c2-4 5-6 11-6s9 2 11 6" opacity=".6"/>') };
const CSS = `
#mk-map-ui{position:fixed;inset:0;z-index:6;pointer-events:none;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;display:none}
#mk-map-ui.on{display:block}
body.mk-mapopen #mk-root,body.mk-mapopen #joy,body.mk-mapopen #jump,body.mk-mapopen #views,body.mk-mapopen .hud{display:none!important}
#mk-map-ui .pe{pointer-events:auto}
#mk-map-cv{position:absolute;inset:0;width:100%;height:100%;pointer-events:auto;touch-action:none}
.mkm-pin{position:absolute;left:0;top:0;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;gap:4px;padding:7px 9px 5px;min-width:58px;border-radius:6px;border:1.5px solid rgba(120,225,255,.95);background:linear-gradient(180deg,rgba(40,120,190,.42),rgba(8,34,80,.62));box-shadow:0 0 14px rgba(80,200,255,.7),inset 0 0 14px rgba(110,220,255,.3);backdrop-filter:blur(1.5px);color:#e6fbff;font-size:10px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;white-space:nowrap;text-shadow:0 0 6px rgba(110,220,255,.8)}
.mkm-pin .i{font-size:20px;line-height:1;filter:drop-shadow(0 0 5px rgba(110,220,255,.95))}.mkm-pin .i svg{width:30px;height:30px;display:block}.mkm-pin.h .i svg{width:16px;height:16px}
.mkm-pin:after{content:'';position:absolute;left:50%;bottom:-7px;width:2px;height:7px;background:rgba(120,225,255,.9);transform:translateX(-50%)}
.mkm-pin.q{border-color:#ffd25a;box-shadow:0 0 14px rgba(255,200,80,.8);color:#fff3cf}
.mkm-pin.h{opacity:.55;border-style:dashed;min-width:0;padding:3px 6px}
.mkm-pin.h .i{font-size:14px}
.mkm-bot{position:absolute;left:0;top:0;width:30px;height:30px;transform:translate(-50%,-50%)}
.mkm-bot svg{position:absolute;inset:0}
.mkm-bot b{position:absolute;inset:5px;border-radius:50%;background:radial-gradient(circle,#123a66,#081a36);display:flex;align-items:center;justify-content:center;font-size:12px}
.mkm-cat{position:absolute;left:0;top:0;transform:translate(-50%,-160%);font-size:10px;font-weight:900;color:#ffb35a;text-shadow:0 0 6px #000;white-space:nowrap}
#mkm-card{position:absolute;left:50%;bottom:max(18px,env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;align-items:center;gap:14px;padding:11px 12px 11px 18px;border-radius:8px;border:1.5px solid rgba(110,220,255,.9);background:linear-gradient(180deg,rgba(12,30,60,.85),rgba(5,14,34,.9));box-shadow:0 0 0 2px rgba(200,145,42,.55),0 0 18px rgba(80,200,255,.5);color:#e6fbff;max-width:92vw}
#mkm-card .t{font-size:15px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:min(52vw,420px);color:#dff7ff;text-shadow:0 0 8px rgba(110,220,255,.7)}
#mkm-card .t small{display:block;font-size:10px;letter-spacing:.04em;color:#9fe6ff;font-weight:600;text-transform:none;margin-top:3px;overflow:hidden;text-overflow:ellipsis;opacity:.8}
#mkm-card .t b{color:#9fe6ff;font-weight:700;margin-right:.35em}
#mkm-go{white-space:nowrap;flex:none;border:1.5px solid #8a5c12;border-radius:7px;padding:9px 16px;background:linear-gradient(180deg,#f6d987,#C8912A);color:#2a1a04;font-weight:900;font-size:14px;letter-spacing:.06em;box-shadow:0 0 10px rgba(255,200,80,.6)}
#mkm-x{position:absolute;right:max(14px,env(safe-area-inset-right));top:max(14px,env(safe-area-inset-top));width:42px;height:42px;border-radius:50%;border:1.5px solid rgba(110,220,255,.9);background:rgba(6,20,46,.8);color:#cff6ff;font-size:24px;line-height:38px;text-align:center;box-shadow:0 0 10px rgba(80,200,255,.6)}
#mkm-zoom{position:absolute;right:max(14px,env(safe-area-inset-right));top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:8px}
#mkm-zoom button{width:40px;height:40px;border-radius:10px;border:1.5px solid rgba(110,220,255,.9);background:rgba(6,20,46,.8);color:#cff6ff;font-size:22px;font-weight:800}
@media (max-width:560px){.mkm-pin{padding:4px 6px 3px;min-width:40px;font-size:8px;gap:2px;letter-spacing:.04em}.mkm-pin .i svg{width:20px;height:20px}.mkm-pin.h .i svg{width:12px;height:12px}.mkm-bot{width:24px;height:24px}}
#mkm-title{position:absolute;left:50%;top:max(14px,env(safe-area-inset-top));transform:translateX(-50%);font-size:11px;letter-spacing:.3em;color:#9fe6ff;font-weight:800;text-shadow:0 0 8px rgba(110,220,255,.9);text-transform:uppercase}
`;

const holoVS = `varying vec3 vW; varying vec3 vL; varying float vH; varying float vF; varying vec3 vN; attribute float aH; attribute float aF; void main(){ vL = position; vH = aH; vF = aF; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const holoFS = `uniform float uT; uniform float uOpen; uniform sampler2D uFog; uniform float uR; uniform float uHK; uniform float uRW; uniform float uGam; uniform float uFR; uniform float uA; uniform float uR0;
varying vec3 vW; varying vec3 vL; varying float vH; varying float vF; varying vec3 vN;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main(){
  float m = pow(abs(vL.x / uR), 4.0) + pow(abs(vL.z / uR), 4.0); if (m > 1.0) discard;
  float rm = max(length(vL.xz), 1e-4); float rw = rm < uA * uR0 ? rm / uA : uRW * pow(rm / (0.97 * uR), 1.0 / uGam); vec2 wo = vL.xz / rm * rw; vec2 uv = wo / (2.0 * uFR) + 0.5;
  float fog = vF; uv = vL.xz / (2.0 * uR) + 0.5; /* v52: fog baked per vertex in world space (aF) */
  vec3 n = normalize(vN); float sl = 1.0 - abs(n.y);
  float shade = 0.3 + 0.85 * clamp(dot(n, normalize(vec3(-0.5, 0.7, 0.35))), 0.0, 1.0);
  vec3 rock = mix(vec3(0.30, 0.29, 0.30), vec3(0.55, 0.52, 0.48), clamp(vH * uHK * 0.8 + 0.5, 0.0, 1.0)) * shade;
  float ct = abs(fract(vH * uHK * 9.0) - 0.5); float cl = 1.0 - smoothstep(0.0, 0.06 + fwidth(vH * uHK * 9.0) * 1.5, ct);
  float ridge = smoothstep(0.35, 0.85, sl);
  float scan = 0.95 + 0.05 * sin(gl_FragCoord.y * 1.6 + uT * 6.0);
  float flick = 0.96 + 0.04 * sin(uT * 23.0);
  vec3 cyan = vec3(0.25, 0.85, 1.0);
  float tx = vn(vL.xz * 1.6) * 0.5 + vn(vL.xz * 4.5) * 0.32 + vn(vL.xz * 9.0) * 0.18; rock *= 0.62 + 0.7 * tx;
  vec3 col = rock + cyan * (cl * 0.12 + ridge * 0.16 + 0.025);
  float edge = smoothstep(0.82, 1.0, m); col += cyan * edge * 1.3;
  float grid = (1.0 - smoothstep(0.0, 0.03, abs(fract(vL.x / uR * 6.0) - 0.5) - 0.47)) + (1.0 - smoothstep(0.0, 0.03, abs(fract(vL.z / uR * 6.0) - 0.5) - 0.47));
  col += cyan * grid * 0.025;
  float unk = 1.0 - fog; float noise = hash(floor(uv * 90.0) + floor(uT * 9.0));
  col = mix(col, col * 0.3 + vec3(0.03, 0.12, 0.26) * (0.6 + 0.6 * tx) + cyan * (0.06 * noise + cl * 0.22 + ridge * 0.18), unk * 0.85);
  float a = (0.97 - unk * 0.3) * scan * flick * uOpen;
  gl_FragColor = vec4(col * scan * flick, a);
}`;

function fogTex() { const d = new Uint8Array(FOG_N * FOG_N * 4); const t = new THREE.DataTexture(d, FOG_N, FOG_N, THREE.RGBAFormat); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t; }

const PQ = (() => { const q = new URLSearchParams(location.search).get('q'); return q === 'low' ? 'low' : q === 'mobile' || (!q && (matchMedia('(pointer:coarse)').matches || Math.min(innerWidth, innerHeight) < 480)) ? 'mobile' : 'desktop'; })();
export function makeHoloMap({ renderer, t, onGo, world }) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const ui = document.createElement('div'); ui.id = 'mk-map-ui';
  ui.innerHTML = `<canvas id="mk-map-cv"></canvas><div id="mkm-layer"></div><div id="mkm-title"></div><button id="mkm-x" class="pe" aria-label="close">×</button><div id="mkm-zoom" class="pe"><button data-z="1">+</button><button data-z="-1">−</button></div><div id="mkm-card" class="pe"><div class="t"></div><button id="mkm-go"></button></div>`;
  document.body.appendChild(ui); const $ = (s) => ui.querySelector(s); const layer = $('#mkm-layer');
  for (const ev of ['pointerdown', 'touchstart', 'wheel', 'keydown']) ui.addEventListener(ev, e => e.stopPropagation(), { passive: true });

  const scene = new THREE.Scene(); scene.background = new THREE.Color('#03060f');
  const cam = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  scene.add(new THREE.HemisphereLight('#bfe6ff', '#1a2030', 1.4)); const dl = new THREE.DirectionalLight('#fff4dc', 2.2); dl.position.set(-6, 12, 8); scene.add(dl);
  { // starfield + earth
    const n = 900, p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, a = Math.random() * 6.283, r = 90; const s = Math.sqrt(1 - u * u); p[i * 3] = Math.cos(a) * s * r; p[i * 3 + 1] = Math.abs(u) * r * 0.9 + 4; p[i * 3 + 2] = Math.sin(a) * s * r; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#cfe6ff', size: 1.6, sizeAttenuation: false })));
    const earth = new THREE.Mesh(new THREE.SphereGeometry(7, 32, 20), new THREE.MeshStandardMaterial({ color: '#2a5aa8', emissive: '#0c2a66', roughness: 0.8 })); earth.position.set(14, 3.6, -32); scene.add(earth); scene.userData.earth = earth;
  }
  const W = 10; // map half-size in scene units
  const board = new THREE.Group(); scene.add(board);
  const fogT = fogTex();
  const U = { uT: { value: 0 }, uOpen: { value: 0 }, uFog: { value: fogT }, uR: { value: W }, uHK: { value: 1 }, uRW: { value: 150 }, uGam: { value: 0.55 }, uFR: { value: 90 }, uA: { value: 0.13 }, uR0: { value: 30 } };
  const hmat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: holoVS, fragmentShader: holoFS, transparent: true, depthWrite: true, side: THREE.DoubleSide, extensions: { derivatives: true } });
  let terr = null, built = null;
  // holo rim: glowing vertical ribbon around the superellipse edge + base plate glow
  const rimPts = []; for (let i = 0; i <= 128; i++) { const a = i / 128 * Math.PI * 2; const c = Math.cos(a), s = Math.sin(a); const k = Math.pow(Math.pow(Math.abs(c), 4) + Math.pow(Math.abs(s), 4), -0.25); rimPts.push(c * k * W, s * k * W); }
  const rimGeo = (() => { const P = [], A = []; for (let i = 0; i < rimPts.length / 2; i++) { const x = rimPts[i * 2], z = rimPts[i * 2 + 1]; const top = 0.5 + 2.8 * Math.pow(Math.max(0, -z / W), 1.4); P.push(x, -0.6, z, x, top, z); A.push(0, 1); } const idx = []; for (let i = 0; i < rimPts.length / 2 - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aV', new THREE.Float32BufferAttribute(A, 1)); g.setIndex(idx); return g; })();
  const rim = new THREE.Mesh(rimGeo, new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, vertexShader: `attribute float aV; varying float vV; void main(){ vV = aV; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`, fragmentShader: `uniform float uT; uniform float uOpen; varying float vV; void main(){ float a = 0.16 + (1.0 - vV) * 0.22 + exp(-vV * 30.0) * 0.6 + smoothstep(0.93, 1.0, vV) * 0.9; float sc = 0.8 + 0.2 * sin(gl_FragCoord.y * 1.4 - uT * 5.0); gl_FragColor = vec4(vec3(0.25, 0.8, 1.0) * a * sc * uOpen, 1.0); }` }));
  board.add(rim);
  const minis = new THREE.Group(); board.add(minis);
  const ivory = new THREE.MeshStandardMaterial({ color: '#efe6d2', roughness: 0.5, metalness: 0.1, emissive: '#3a3020' }), gold = new THREE.MeshStandardMaterial({ color: '#d9a640', roughness: 0.35, metalness: 0.8, emissive: '#3a2400' });
  const crysM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.45, 0.85, 1.6), toneMapped: false });
  const crysI = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0).scale(0.5, 1.3, 0.5), crysM, 64); crysI.count = 0; board.add(crysI);
  // v52 robot minis: ivory body + cyan visor + cyan ground ring (concept robots with rings), instanced
  const botB = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 12, 8).scale(1, 1.15, 1), ivory, 12), botV = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 10, 6, 0, Math.PI * 2, 0, 1.2).rotateX(Math.PI / 2).scale(1.2, 0.8, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 1.2, 1.8), toneMapped: false }), 12), botR = new THREE.InstancedMesh(new THREE.RingGeometry(0.26, 0.36, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.0, 1.6), toneMapped: false, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }), 12);
  for (const m of [botB, botV, botR]) { m.count = 0; board.add(m); }
  // cat marker (orange arrow + glow), target beam + ring, dotted path
  const catM = new THREE.Group(); { const sh = new THREE.Shape(); sh.moveTo(0, 0.55); sh.lineTo(0.38, -0.35); sh.lineTo(0, -0.15); sh.lineTo(-0.38, -0.35); sh.closePath(); const g = new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: false }).rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.7, 0.15), toneMapped: false })); catM.add(m); { /* v52 mini cat token (concept): ivory suit body, orange head + ears, glass helmet */ const or = new THREE.MeshStandardMaterial({ color: '#f08a2c', roughness: 0.6, emissive: '#5a2006' }), su = new THREE.MeshStandardMaterial({ color: '#f1e8d6', roughness: 0.6, emissive: '#2a2418' }); const bd = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8).scale(1, 1.25, 0.9), su); bd.position.y = 0.26; catM.add(bd); const hd = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), or); hd.position.y = 0.56; catM.add(hd); for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 6), or); e.position.set(sx * 0.08, 0.7, 0); catM.add(e); } const hl = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.9, 1.2), transparent: true, opacity: 0.22, depthWrite: false })); hl.position.y = 0.58; catM.add(hl); } const d = new THREE.Mesh(new THREE.CircleGeometry(0.7, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.4, 0.05), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false })); d.position.y = -0.02; catM.add(d); } board.add(catM);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.3, 3.2, 16, 1, true).translate(0, 1.6, 0), new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, vertexShader: `varying float vY; void main(){ vY = position.y / 3.2; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`, fragmentShader: `uniform float uT; uniform float uOpen; varying float vY; void main(){ float a = (1.0 - vY) * (0.75 + 0.25 * sin(uT * 6.0 - vY * 12.0)); gl_FragColor = vec4(vec3(2.0, 1.25, 0.3) * a * uOpen, 1.0); }` })); board.add(beam);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.55, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.05, 0.3), toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); board.add(ring);
  let tube = null; const tubeM = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: `varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`, fragmentShader: `uniform float uT; uniform float uOpen; varying vec2 vU; void main(){ float d = fract(vU.x * 26.0 - uT * 1.6); float dash = smoothstep(0.0, 0.15, d) * (1.0 - smoothstep(0.45, 0.6, d)); gl_FragColor = vec4(vec3(1.9, 1.25, 0.35) * (0.35 + 1.1 * dash) * uOpen, 1.0); }` });
  const NP = 60; const pathG = new THREE.BufferGeometry(); pathG.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
  const path = new THREE.Points(pathG, new THREE.PointsMaterial({ color: new THREE.Color(1.6, 1.15, 0.35), size: 0.22, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); board.add(path);
  // the wrist device: fluffy paw + gold bracelet with a cyan screen, projection cone toward the map
  const wrist = new THREE.Group(); scene.add(cam); cam.add(wrist);
  { // v52 paw (concept): fluffy cream paw with toe pads, white suit sleeve with gold rings, ornate gold watch with a navy/cyan face
    const fluff = (g, amp = 0.05) => { const P = g.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i); const n = Math.sin(v.x * 23.1 + v.y * 17.3) * Math.sin(v.z * 19.7 - v.y * 11.1) * 0.5 + Math.sin(v.x * 41 + v.z * 37) * 0.5; v.multiplyScalar(1 + amp * n); P.setXYZ(i, v.x, v.y, v.z); } g.computeVertexNormals(); return g; };
    const fur = new THREE.MeshStandardMaterial({ color: '#f4ead6', roughness: 1, emissive: '#2a241a' }), suit = new THREE.MeshStandardMaterial({ color: '#ebe3d2', roughness: 0.65, emissive: '#1e1a14' });
    const au = new THREE.MeshStandardMaterial({ color: '#e5b04a', roughness: 0.28, metalness: 0.55, emissive: '#4a3008' }), navy = new THREE.MeshStandardMaterial({ color: '#0b1d40', roughness: 0.3, metalness: 0.3, emissive: '#06122a' });
    const add = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); wrist.add(o); return o; };
    add(fluff(new THREE.SphereGeometry(1, 26, 18).scale(1.05, 0.78, 1.15)), fur, 0, 0.18, -1.0);
    for (let k = 0; k < 4; k++) { const x = -0.66 + k * 0.44, up = (k === 1 || k === 2) ? 0.12 : 0; add(fluff(new THREE.SphereGeometry(0.37, 18, 12).scale(1, 0.95, 1.15), 0.06), fur, x, 0.42 + up, -1.92 + Math.abs(x) * 0.25); }
    add(fluff(new THREE.SphereGeometry(0.33, 16, 10).scale(1, 0.9, 1.2), 0.06), fur, 0.98, 0.05, -1.15);
    add(fluff(new THREE.SphereGeometry(1, 22, 14).scale(1.02, 0.9, 0.62), 0.07), fur, 0, 0.02, -0.05);
    add(new THREE.CylinderGeometry(0.98, 1.08, 3.6, 24, 1, true).rotateX(Math.PI / 2), suit, 0, -0.05, 2.15);
    for (const z of [1.25, 2.35]) { add(new THREE.TorusGeometry(1.02, 0.07, 8, 32), au, 0, -0.05, z); }
    add(new THREE.CylinderGeometry(0.93, 0.93, 0.55, 28, 1, true).rotateX(Math.PI / 2), au, 0, -0.03, 0.42);
    add(new THREE.CylinderGeometry(0.66, 0.7, 0.3, 32), au, 0, 0.9, 0.42); add(new THREE.TorusGeometry(0.6, 0.085, 10, 36).rotateX(Math.PI / 2), au, 0, 1.06, 0.42);
    add(new THREE.CircleGeometry(0.53, 32).rotateX(-Math.PI / 2), navy, 0, 1.07, 0.42);
    add(new THREE.RingGeometry(0.34, 0.45, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.1, 1.7), toneMapped: false }), 0, 1.08, 0.42);
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; add(new THREE.SphereGeometry(0.045, 8, 6), au, Math.cos(a) * 0.6, 1.13, 0.42 + Math.sin(a) * 0.6); }
    add(new THREE.CylinderGeometry(0.09, 0.09, 0.2, 10).rotateZ(Math.PI / 2), au, 0.76, 0.9, 0.42);
    const scr = new THREE.Mesh(new THREE.CircleGeometry(0.26, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 1.4, 2.0), toneMapped: false })); scr.position.set(0, 1.09, 0.42); wrist.add(scr); wrist.userData.scr = scr; }
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 32, 1, true), new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, vertexShader: `varying float vY; void main(){ vY = position.y + 0.5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`, fragmentShader: `uniform float uOpen; uniform float uT; varying float vY; void main(){ gl_FragColor = vec4(vec3(0.2, 0.7, 1.0) * (0.03 + 0.07 * vY * vY) * uOpen * (0.85 + 0.15 * sin(uT * 9.0)), 1.0); }` })); scene.add(cone);

  // ---------- state ----------
  let openAt = 0, open = false, openK = 0, yaw = 0, zoom = 1, data = null, region = null, R = 140, cx = 0, cz = 0, S = W / 140, HK = 1, h0 = 0; const pins = [];
  // v52 fisheye: the centre (base, cat) is magnified, the crater walls far away are compressed into the map edge (concept framing)
  let RW = 150, R0 = 30, A = 0.13; const GAM = 0.55; const fwP = (r) => 0.97 * W * Math.pow(r / RW, GAM); /* linear (undistorted) core r<R0, power-law compression outside */ const fw = (r) => r < R0 ? A * r : fwP(r), iw = (rm) => rm < A * R0 ? rm / A : RW * Math.pow(rm / (0.97 * W), 1 / GAM);
  const toMap = (x, z, y) => { const dx = x - cx, dz = z - cz, r = Math.hypot(dx, dz) || 1e-4, k = fw(r) / r; return new THREE.Vector3(dx * k, y != null ? y : 0, dz * k); };
  const toWorld = (mx, mz) => { const rm = Math.hypot(mx, mz) || 1e-4, k = iw(rm) / rm; return [cx + mx * k, cz + mz * k]; };
  const localK = (x, z) => { const r = Math.max(4, Math.hypot(x - cx, z - cz)); return fw(r) / r; };
  const HMAX = 2.0; const hMap = h => HMAX * Math.tanh((h - h0) * A / HMAX); const hAt = (x, z) => hMap(data.groundAt(x, z));
  function buildTerrain() {
    if (terr) { board.remove(terr); terr.geometry.dispose(); }
    const N = PQ === 'low' ? 80 : PQ === 'mobile' ? 100 : 130, g = new THREE.PlaneGeometry(2 * W, 2 * W, N, N).rotateX(-Math.PI / 2); const P = g.attributes.position; const aH = new Float32Array(P.count);
    let mn = 1e9, mx = -1e9; const hs = [], wxz = new Float32Array(P.count * 2); for (let i = 0; i < P.count; i++) { const [x, z] = toWorld(P.getX(i), P.getZ(i)); wxz[i * 2] = x; wxz[i * 2 + 1] = z; const h = data.groundAt(x, z); hs.push(h); mn = Math.min(mn, h); mx = Math.max(mx, h); }
    { const so = hs.slice().sort((a, b) => a - b); h0 = so[Math.floor(so.length * 0.4)]; } for (let i = 0; i < P.count; i++) { const y = hMap(hs[i]); P.setY(i, y); aH[i] = y; }
    HK = 1 / (2 * HMAX); U.uHK.value = HK; g.setAttribute('aH', new THREE.BufferAttribute(aH, 1)); g.setAttribute('aF', new THREE.BufferAttribute(new Float32Array(P.count).fill(1), 1)); g.userData.wxz = wxz; g.computeVertexNormals();
    terr = new THREE.Mesh(g, hmat); terr.renderOrder = 1; board.add(terr); built = region;
  }
  function buildMinis() {
    while (minis.children.length) minis.remove(minis.children[0]);
    const b = data.base; if (!b) return;
    // v52: the REAL base (shared geometry subset + the game's own materials) as the miniature, uniform scale A = the map's linear core
    if (world && !minis.userData.real) { const out = []; for (const nm of ['merged_hull', 'merged_lattice']) { const src = world.getObjectByName(nm); if (!src) continue; const sg = sub(src.geometry, cx, cz, R0 * 1.05); if (sg) { const m = new THREE.Mesh(sg, src.material); m.name = 'map_' + nm; out.push(m); } } minis.userData.real = out; }
    if (minis.userData.real && minis.userData.real.length) { const gb = data.groundAt(b.x, b.z); for (const m of minis.userData.real) { m.scale.setScalar(A); m.position.set(-cx * A, hMap(gb) - gb * A, -cz * A); minis.add(m); } return; }
    const p = toMap(b.x, b.z, hAt(b.x, b.z)); const k = fw(14) / 0.85; void localK;
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(p.x + x * k, p.y + y * k, p.z + z * k); minis.add(m); return m; };
    add(new THREE.CylinderGeometry(0.62, 0.62, 0.22, 28), ivory, 0, 0.11, 0); add(new THREE.TorusGeometry(0.62, 0.035, 6, 28).rotateX(Math.PI / 2), gold, 0, 0.23, 0);
    add(new THREE.CircleGeometry(0.42, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 0.9, 0.35), toneMapped: false }), 0, 0.235, 0);
    for (const [x, z, r] of [[-1.0, -0.2, 0.32], [0.95, 0.15, 0.36], [0.2, -0.95, 0.3], [-0.35, 0.95, 0.28], [1.25, -0.8, 0.24]]) { add(new THREE.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), ivory, x, 0, z); add(new THREE.CylinderGeometry(r, r, 0.12, 18), ivory, x, 0.0, z); }
    add(new THREE.CylinderGeometry(0.09, 0.12, 1.1, 10), ivory, 0.15, 0.75, -0.55); add(new THREE.ConeGeometry(0.09, 0.32, 10), gold, 0.15, 1.46, -0.55);
    for (const [x, z] of [[-0.25, -0.75], [0.55, -0.7]]) { add(new THREE.CylinderGeometry(0.035, 0.05, 0.9, 6), ivory, x, 0.45, z); add(new THREE.ConeGeometry(0.04, 0.16, 6), gold, x, 0.98, z); }
    const dish = add(new THREE.SphereGeometry(0.28, 14, 6, 0, Math.PI * 2, 0, 1.0), ivory, -0.9, 0.55, -0.75); dish.rotation.x = 0.9;
  }
  function sub(g, x0, z0, rad) { const P = g.attributes.position, ix = g.index, n = ix ? ix.count : P.count, keep = []; const v = (i) => ix ? ix.getX(i) : i;
    for (let t = 0; t < n; t += 3) { const a = v(t), b_ = v(t + 1), c = v(t + 2); const x = (P.getX(a) + P.getX(b_) + P.getX(c)) / 3 - x0, z = (P.getZ(a) + P.getZ(b_) + P.getZ(c)) / 3 - z0; if (x * x + z * z < rad * rad) keep.push(a, b_, c); }
    if (!keep.length) return null; const o = new THREE.BufferGeometry(); for (const k of Object.keys(g.attributes)) o.setAttribute(k, g.attributes[k]); o.setIndex(keep); o.userData.tris = keep.length / 3; return o; }
  function pinEl(cls, html) { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; layer.appendChild(d); return d; }
  function rebuildPins() {
    layer.innerHTML = ''; pins.length = 0;
    for (const p of data.pins) pins.push({ ...p, y: hAt(p.x, p.z), el: pinEl('mkm-pin' + (p.kind === 'hint' ? ' h' : p.kind === 'quest' ? ' q' : ''), `<span class="i">${ICONS[p.icon] || p.icon}</span>${p.label ? `<span>${p.label}</span>` : ''}`), lift: p.kind === 'hint' ? 0.6 : 1.7 });
    for (const c of data.crew) { const el = pinEl('mkm-bot', `<svg viewBox="0 0 30 30"><circle cx="15" cy="15" r="13" fill="none" stroke="rgba(110,220,255,.3)" stroke-width="3"/><circle cx="15" cy="15" r="13" fill="none" stroke="#ffd25a" stroke-width="3" stroke-linecap="round" stroke-dasharray="81.7" stroke-dashoffset="${(81.7 * (1 - Math.max(0, c.prog))).toFixed(1)}" transform="rotate(-90 15 15)" ${c.prog < 0 ? 'opacity="0"' : ''}/></svg><b>🤖</b>`); pins.push({ x: c.x, z: c.z, y: hAt(c.x, c.z), el, lift: 0.5, bot: true }); }
    const ce = pinEl('mkm-cat', t('mapYou')); pins.push({ x: data.me.x, z: data.me.z, y: hAt(data.me.x, data.me.z), el: ce, lift: 0.4, cat: true });
    // lines from pins down to the terrain
    if (board.userData.lines) { board.remove(board.userData.lines); board.userData.lines.geometry.dispose(); }
    const L = []; for (const p of pins) { if (p.bot || p.cat) continue; const q = toMap(p.x, p.z, p.y); L.push(q.x, q.y, q.z, q.x, q.y + p.lift, q.z); }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(L, 3)); const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: new THREE.Color(0.4, 1.1, 1.6), toneMapped: false, transparent: true, opacity: 0.85 })); board.add(lines); board.userData.lines = lines;
  }
  function bakeFog() { if (!terr) return; const f = data.fog, n = FOG_N, rg = data.region, cell = 2 * rg.R / n, A_ = terr.geometry.attributes.aF, w = terr.geometry.userData.wxz; const at = (i, j) => (i < 0 || j < 0 || i >= n || j >= n) ? 1 : f[j * n + i];
    for (let k = 0; k < A_.count; k++) { const gx = (w[k * 2] - rg.x + rg.R) / cell - 0.5, gz = (w[k * 2 + 1] - rg.z + rg.R) / cell - 0.5; const i = Math.floor(gx), j = Math.floor(gz), u = gx - i, v = gz - j; A_.array[k] = (at(i, j) * (1 - u) + at(i + 1, j) * u) * (1 - v) + (at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u) * v; } A_.needsUpdate = true; }
  function updateFogTex() { bakeFog(); const f = data.fog; const d = fogT.image.data; for (let i = 0; i < FOG_N * FOG_N; i++) { const v = f[i] ? 255 : 0; d[i * 4] = v; d[i * 4 + 1] = v; d[i * 4 + 2] = v; d[i * 4 + 3] = 255; } fogT.needsUpdate = true; }
  function sync() {
    data = api.getData(); if (!data) return;
    if (data.region.key !== region || !terr) { region = data.region.key; R = data.region.R; cx = data.region.x; cz = data.region.z; if (data.base) { cx = data.base.x - 3; cz = data.base.z + 3; } /* v52: centre on the base (+ a bit toward the crew yard) */ S = W / R; RW = data.region.RW || Math.max(R * 1.6, 140); R0 = R / 2.2; A = fwP(R0) / R0; U.uRW.value = RW; U.uFR.value = R; U.uA.value = A; U.uR0.value = R0; buildTerrain(); buildMinis(); }
    updateFogTex();
    if (world && !scene.userData.realEarth) { scene.userData.realEarth = true; const sk = world.getObjectByName('sky'); let src = null; if (sk) sk.traverse(o => { if (!src && o.isMesh && o.geometry && o.geometry.type === 'SphereGeometry' && o.geometry.parameters.radius === 1) src = o; }); if (src) { const e = scene.userData.earth; e.geometry = src.geometry; e.material = src.material; e.scale.setScalar(7); } } /* v52: the game's own textured Earth */
    const cs = data.crystals.slice(0, 21); const M = new THREE.Matrix4(); let ci = 0; cs.forEach((c, i) => { const b0 = toMap(c.x, c.z, hAt(c.x, c.z)); for (let k = 0; k < 3; k++) { const a = i * 2.4 + k * 2.1, o = k ? 0.22 : 0; const p = b0.clone().add(new THREE.Vector3(Math.cos(a) * o, 0, Math.sin(a) * o)); const s = (k ? 0.26 : 0.42) + 0.08 * ((i * 0.618) % 1); M.compose(p.setY(p.y + s * 0.9), new THREE.Quaternion().setFromEuler(new THREE.Euler(k ? 0.35 * Math.cos(a) : 0, a, k ? 0.35 * Math.sin(a) : 0)), new THREE.Vector3(s, s, s)); crysI.setMatrixAt(ci++, M); } }); crysI.count = ci; crysI.instanceMatrix.needsUpdate = true;
    { const M2 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1); const cr = data.crew.slice(0, 12); cr.forEach((c, i) => { const p = toMap(c.x, c.z, hAt(c.x, c.z)); q.setFromEuler(new THREE.Euler(0, (c.yaw || 0), 0)); M2.compose(p.clone().setY(p.y + 0.24), q, one); botB.setMatrixAt(i, M2); M2.compose(p.clone().setY(p.y + 0.3).add(new THREE.Vector3(Math.sin(c.yaw || 0) * 0.1, 0, Math.cos(c.yaw || 0) * 0.1)), q, one); botV.setMatrixAt(i, M2); M2.compose(p.clone().setY(p.y + 0.03), q, one); botR.setMatrixAt(i, M2); }); for (const m of [botB, botV, botR]) { m.count = cr.length; m.instanceMatrix.needsUpdate = true; } }
    const mp = toMap(data.me.x, data.me.z, hAt(data.me.x, data.me.z) + 0.12); catM.position.copy(mp); catM.rotation.y = data.me.yaw + Math.PI;
    const tg = data.target; beam.visible = ring.visible = !!tg; path.visible = false; if (tube) { board.remove(tube); tube.geometry.dispose(); tube = null; }
    if (tg) { const tp = toMap(tg.x, tg.z, hAt(tg.x, tg.z)); beam.position.copy(tp); ring.position.copy(tp).setY(tp.y + 0.05); const A = pathG.attributes.position; const mx = (mp.x + tp.x) / 2, mz = (mp.z + tp.z) / 2; const nx = -(tp.z - mp.z) * 0.18, nz = (tp.x - mp.x) * 0.18;
      for (let i = 0; i < NP; i++) { const u = i / (NP - 1); const x = (1 - u) * (1 - u) * mp.x + 2 * u * (1 - u) * (mx + nx) + u * u * tp.x, z = (1 - u) * (1 - u) * mp.z + 2 * u * (1 - u) * (mz + nz) + u * u * tp.z; const [wx, wz] = toWorld(x, z); A.setXYZ(i, x, hAt(wx, wz) + 0.32, z); } A.needsUpdate = true;
      const pts = []; for (let i = 0; i < NP; i++) pts.push(new THREE.Vector3().fromBufferAttribute(A, i)); tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, 0.09, 6, false), tubeM); tube.renderOrder = 3; board.add(tube); }
    rebuildPins();
    $('#mkm-title').textContent = data.region.name; $('#mkm-card .t').innerHTML = `${data.quest ? `<b>${t('mapQ')}</b>${data.quest.title.replace(/^\S+\s/, '')}` : t('mapNoQuest')}${data.quest && data.quest.sub ? `<small>${data.quest.sub}</small>` : ''}`; $('#mkm-go').textContent = t('mapGo'); $('#mkm-go').style.display = tg ? '' : 'none';
    const cvs = renderer.domElement; void cvs;
  }
  // ---------- input ----------
  const cv = $('#mk-map-cv'); const ptrs = new Map(); let pinch0 = 0, z0 = 1;
  cv.addEventListener('pointerdown', e => { ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); cv.setPointerCapture(e.pointerId); if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); z0 = zoom; } });
  cv.addEventListener('pointermove', e => { const p = ptrs.get(e.pointerId); if (!p) return; if (ptrs.size === 1) { yaw -= (e.clientX - p.x) * 0.008; } p.x = e.clientX; p.y = e.clientY; if (ptrs.size === 2 && pinch0) { const [a, b] = [...ptrs.values()]; zoom = Math.min(2.6, Math.max(0.7, z0 * Math.hypot(a.x - b.x, a.y - b.y) / pinch0)); } });
  const up = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = 0; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { zoom = Math.min(2.6, Math.max(0.7, zoom * (e.deltaY > 0 ? 0.9 : 1.1))); }, { passive: true });
  ui.querySelectorAll('#mkm-zoom button').forEach(b => b.addEventListener('click', () => { zoom = Math.min(2.6, Math.max(0.7, zoom * (b.dataset.z === '1' ? 1.25 : 0.8))); }));
  $('#mkm-x').addEventListener('click', () => api.close());
  $('#mkm-go').addEventListener('click', () => { api.close(); onGo && onGo(); });
  addEventListener('keydown', e => { if (open && (e.code === 'Escape' || e.code === 'KeyM')) api.close(); });

  const pv = new THREE.Vector3(); let T = 0;
  const api = {
    getData: null, get open() { return open; },
    show() { if (open) return; open = true; openK = 0; openAt = performance.now(); ui.classList.add('on'); document.body.classList.add('mk-mapopen'); yaw = 0; zoom = 1; sync(); },
    close() { if (!open) return; open = false; ui.classList.remove('on'); document.body.classList.remove('mk-mapopen'); api.onClose && api.onClose(); },
    toggle() { open ? api.close() : api.show(); },
    frame(dt) {
      T += dt; openK = Math.min(1, (performance.now() - openAt) / 450); U.uT.value = T; U.uOpen.value = openK < 1 ? openK * (0.6 + 0.4 * Math.sin(T * 60.0) * (1 - openK)) + openK * 0.4 : 1;
      const w = innerWidth, h = innerHeight; const pr = renderer.getPixelRatio(); const port = h > w;
      cam.aspect = w / h; cam.fov = port ? 62 : 42; cam.updateProjectionMatrix();
      const dist = (port ? 22 : 18.5) / zoom; cam.position.set(0, dist * (port ? 0.5 : 0.42), dist * (port ? 0.87 : 0.92)); cam.lookAt(0, port ? -0.8 : -1.6, port ? 0.8 : -0.2);
      board.rotation.y = yaw; board.scale.setScalar(0.25 + 0.75 * (1 - Math.pow(1 - openK, 3))); board.position.y = 0;
      board.rotation.x = 0; board.rotation.z = 0;
      scene.userData.earth.rotation.y += dt * 0.03; scene.userData.earth.position.set(port ? 9 : 25, port ? 9 : -9, port ? -40 : -50);
      // wrist in the lower-left foreground, projection cone from the screen to the board
      wrist.position.set(port ? -1.0 : -2.05, port ? -2.3 : -1.3, -5.0); wrist.rotation.set(1.25, -0.5, 0.25, 'YXZ'); wrist.scale.setScalar(port ? 0.46 : 0.6);
      cam.updateMatrixWorld(true); const s0 = wrist.userData.scr.getWorldPosition(new THREE.Vector3()); const s1 = new THREE.Vector3(0, 0, 0); const mid = s0.clone().add(s1).multiplyScalar(0.5); const len = s0.distanceTo(s1);
      cone.position.copy(mid); cone.scale.set(W * 0.8 * board.scale.x, len, W * 0.8 * board.scale.x); cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), s1.clone().sub(s0).normalize());
      catM.children[0].material.color.setScalar(1).setRGB(1.6, 0.7 + 0.2 * Math.sin(T * 5), 0.15);
      const path_ = pathG.attributes.position; void path_; path.material.size = 0.2 + 0.05 * Math.sin(T * 6);
      board.updateMatrixWorld(true);
      for (const p of pins) { pv.copy(toMap(p.x, p.z, p.y + p.lift)); board.localToWorld(pv); pv.project(cam); const vis = pv.z < 1 && Math.abs(pv.x) < 1.1 && Math.abs(pv.y) < 1.1; p.el.style.display = vis && openK > 0.6 ? '' : 'none'; p.sx = (pv.x + 1) / 2 * w; p.sy = (1 - pv.y) / 2 * h; p.vis = vis; }
      { const placed = []; const lab = pins.filter(p => p.vis && !p.bot && !p.cat).sort((a, b) => b.sy - a.sy); for (const p of lab) { const bw = p.kind === 'hint' ? 26 : 70, bh = p.kind === 'hint' ? 26 : 44; let bx = p.sx, by = p.sy; const C = [[0, 0], [-0.55, 0], [0.55, 0], [0, -1], [-0.55, -0.6], [0.55, -0.6], [-1.1, 0], [1.1, 0], [-0.55, -1.2], [0.55, -1.2], [0, -2]]; for (const [kx, ky] of C) { const x = p.sx + kx * (bw + 4), y = p.sy + ky * (bh + 2); if (!placed.some(q => Math.abs(q.x - x) < (bw + q.w) / 2 && Math.abs(q.y - y) < (bh + q.h) / 2)) { bx = x; by = y; break; } } placed.push({ x: bx, y: by, w: bw, h: bh }); p.sx = bx; p.sy = by; } }
      for (const p of pins) if (p.vis) p.el.style.transform = `translate(${p.sx.toFixed(1)}px,${p.sy.toFixed(1)}px) translate(-50%,${p.bot ? '-50%' : '-100%'})`;
      const tm = renderer.toneMapping; renderer.toneMapping = THREE.ACESFilmicToneMapping; const ot = renderer.getRenderTarget(); renderer.setRenderTarget(null); renderer.render(scene, cam); renderer.setRenderTarget(ot); renderer.toneMapping = tm; void pr;
    },
    stats() { return renderer.info.render; },
    dbg() { const p = pins[0]; if (!p) return { n: 0, openK }; const q = toMap(p.x, p.z, p.y + p.lift); board.localToWorld(q); const w = q.clone(); q.project(cam); return { n: pins.length, openK, w: [w.x, w.y, w.z], ndc: [q.x, q.y, q.z], cam: cam.position.toArray(), disp: p.el.style.display }; },
  };
  return api;
}

// fog-of-war helpers (save: store.data.mapFog[region] = hex string of FOG_N*FOG_N bits)
export function fogGet(store, key) { const D = store.data; D.mapFog ||= {}; const s = D.mapFog[key] || ''; const a = new Uint8Array(FOG_N * FOG_N); for (let i = 0; i < s.length && i * 4 < a.length; i++) { const v = parseInt(s[i], 16); for (let b = 0; b < 4; b++) a[i * 4 + b] = (v >> b) & 1; } return a; }
export function fogSet(store, key, a) { let s = ''; for (let i = 0; i < a.length; i += 4) s += ((a[i] | (a[i + 1] << 1) | (a[i + 2] << 2) | (a[i + 3] << 3)) >>> 0).toString(16); store.data.mapFog ||= {}; store.data.mapFog[key] = s; }
export function fogReveal(a, region, x, z, rad) { const n = FOG_N; let ch = false; const cell = (2 * region.R) / n; const gx = (x - region.x + region.R) / cell, gz = (z - region.z + region.R) / cell; const rc = rad / cell; for (let j = Math.floor(gz - rc); j <= Math.ceil(gz + rc); j++) for (let i = Math.floor(gx - rc); i <= Math.ceil(gx + rc); i++) { if (i < 0 || j < 0 || i >= n || j >= n) continue; if (Math.hypot(i + 0.5 - gx, j + 0.5 - gz) > rc + 0.5) continue; const k = j * n + i; if (!a[k]) { a[k] = 1; ch = true; } } return ch; }
export const FOG_SIZE = FOG_N;
