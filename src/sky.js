import * as THREE from 'three';
import { seeded } from './noise.js';
import { rockGeom } from './props.js';
import { Builder, G } from './builder.js';
import { C } from './base.js';

const NOISE_GLSL = `
float h3(vec3 p){ p=fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float n3(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
 return mix(mix(mix(h3(i+vec3(0,0,0)),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm3(vec3 p){ float a=0.5,s=0.; for(int i=0;i<5;i++){ s+=a*n3(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=0.5;} return s; }`;

export function buildSky(sunDir, earthDir) {
  const group = new THREE.Group(); group.name = 'sky';
  // gradient dome + faint milky way
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#03050b') }, mid: { value: new THREE.Color('#070c18') }, hor: { value: new THREE.Color('#16283a') }, band: { value: new THREE.Vector3(0.35, 0.55, -0.76).normalize() } },
    vertexShader: `varying vec3 vD; void main(){ vD=normalize(position); vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position=p.xyww; }`,
    fragmentShader: `uniform vec3 top,mid,hor,band; uniform samplerCube stars; varying vec3 vD; ${NOISE_GLSL}
      void main(){ float y=vD.y; vec3 c=mix(hor,mid,smoothstep(-0.05,0.18,y)); c=mix(c,top,smoothstep(0.18,0.8,y));
        float b=exp(-pow(dot(vD,band)/0.16,2.)); float n=fbm3(vD*6.0); float n2=fbm3(vD*14.0+3.0); c+=vec3(0.07,0.085,0.13)*b*smoothstep(0.3,0.8,n)*1.4; c+=vec3(0.035,0.038,0.06)*b; c+=vec3(0.09,0.07,0.06)*b*b*smoothstep(0.5,0.85,n2)*0.8; c-=vec3(0.02)*b*smoothstep(0.55,0.75,fbm3(vD*9.0+7.0)); c+=textureCube(stars,vD).rgb*1.7*smoothstep(-0.12,0.0,y);
        gl_FragColor=vec4(c,1.); }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(6000, 24, 12), skyMat); dome.renderOrder = -10; dome.frustumCulled = false; group.add(dome);
  // stars
  const r = seeded(99); const N = 14000; const pos = new Float32Array(N * 3), size = new Float32Array(N), col = new Float32Array(N * 3);
  const band = skyMat.uniforms.band.value;
  for (let i = 0; i < N; i++) {
    let v; do { v = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1); } while (v.lengthSq() > 1 || v.lengthSq() < 0.01);
    v.normalize(); if (i < N * 0.5) { v.addScaledVector(band, -v.dot(band) * (0.8 + r() * 0.2)); v.normalize(); }
    if (v.y < -0.08) v.y = -v.y;
    pos.set(v.clone().multiplyScalar(5500).toArray(), i * 3);
    const m = r(); size[i] = m > 0.985 ? 3.6 + r() * 2 : m > 0.88 ? 2.2 + r() : 1.2 + r() * 0.9;
    const t = r(); const c = t < 0.15 ? [1, 0.85, 0.65] : t < 0.3 ? [0.7, 0.85, 1] : [1, 1, 1]; const br = 0.6 + r() * 0.6; col.set(c.map(x => x * br), i * 3);
  }
  // stars baked into a cube map sampled by the sky dome (0 extra draw calls / primitives)
  const FS = 1024; const faces = []; for (let f = 0; f < 6; f++) { const cv = document.createElement('canvas'); cv.width = cv.height = FS; const cx = cv.getContext('2d'); cx.fillStyle = '#000'; cx.fillRect(0, 0, FS, FS); faces.push(cx); }
  for (let i = 0; i < N; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2]; const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z); let f, sc, tc, ma;
    if (ax >= ay && ax >= az) { ma = ax; if (x > 0) { f = 0; sc = -z; tc = -y; } else { f = 1; sc = z; tc = -y; } }
    else if (ay >= az) { ma = ay; if (y > 0) { f = 2; sc = x; tc = z; } else { f = 3; sc = x; tc = -z; } }
    else { ma = az; if (z > 0) { f = 4; sc = x; tc = -y; } else { f = 5; sc = -x; tc = -y; } }
    const u = (sc / ma + 1) / 2 * FS, v = (tc / ma + 1) / 2 * FS; const rad = size[i] * 0.55; const cx = faces[f];
    const [cr, cg, cb] = [col[i * 3], col[i * 3 + 1], col[i * 3 + 2]].map(c => Math.min(255, Math.round(c * 215)));
    const g = cx.createRadialGradient(u, v, 0, u, v, rad); g.addColorStop(0, `rgba(${cr},${cg},${cb},1)`); g.addColorStop(0.45, `rgba(${cr},${cg},${cb},0.55)`); g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    cx.fillStyle = g; cx.fillRect(u - rad, v - rad, rad * 2, rad * 2);
  }
  const starTex = new THREE.CubeTexture(faces.map(c => c.canvas)); starTex.colorSpace = THREE.SRGBColorSpace; starTex.generateMipmaps = false; starTex.minFilter = THREE.LinearFilter; starTex.needsUpdate = true;
  skyMat.uniforms.stars = { value: starTex };
  const starMat = { uniforms: { uTime: { value: 0 }, uPR: { value: 1 } } };
  // Earth
  const earthMat = new THREE.ShaderMaterial({
    fog: false, uniforms: { sun: { value: sunDir.clone() }, uTime: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vP; varying vec3 vV; void main(){ vN=normalize(mat3(modelMatrix)*normal); vP=position; vec4 w=modelMatrix*vec4(position,1.); vV=normalize(cameraPosition-w.xyz); gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 sun; uniform float uTime; varying vec3 vN; varying vec3 vP; varying vec3 vV; ${NOISE_GLSL}
      void main(){ vec3 p=normalize(vP); float land=fbm3(p*2.2+vec3(3.,1.,7.)); float l=smoothstep(0.6,0.64,land);
        vec3 ocean=mix(vec3(0.01,0.06,0.22),vec3(0.03,0.16,0.42),fbm3(p*6.)); vec3 ground=mix(vec3(0.16,0.24,0.16),vec3(0.42,0.38,0.30),fbm3(p*7.));
        vec3 c=mix(ocean,ground,l); vec3 q=p*3.0+vec3(fbm3(p*4.+uTime*0.01),fbm3(p*4.+5.),0.)*1.4; float cl=smoothstep(0.44,0.68,fbm3(q*1.8)); c=mix(c,vec3(0.85,0.88,0.93),cl*0.6);
        float ndl=dot(normalize(vN),sun); float lit=smoothstep(-0.15,0.35,ndl); vec3 col=c*(0.04+1.25*lit);
        float fr=pow(1.-max(dot(normalize(vN),vV),0.),3.); col+=vec3(0.25,0.55,1.0)*fr*(0.25+1.4*lit);
        float lum=dot(col,vec3(0.3,0.59,0.11)); col=mix(vec3(lum),col,0.55)*0.5; gl_FragColor=vec4(col,1.); }`,
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14), earthMat); earth.renderOrder = -8;
  const ED = 4200, ER = 820; earth.position.copy(earthDir).multiplyScalar(ED); earth.scale.setScalar(ER); earth.rotation.set(0.4, 2.2, 0.2);
  group.add(earth);
  const haloMat = new THREE.ShaderMaterial({
    fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide, uniforms: { sun: { value: sunDir.clone() } },
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.); vV=normalize(cameraPosition-w.xyz); gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 sun; varying vec3 vN; varying vec3 vV; void main(){ float d=dot(normalize(vN),vV); float a=pow(smoothstep(0.0,0.42,-d),2.0); float lit=0.3+0.7*smoothstep(-0.5,0.4,dot(normalize(vN),sun)); gl_FragColor=vec4(vec3(0.3,0.58,0.95)*a*lit*1.2,1.); }`,
  });
  const halo = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10), haloMat); halo.position.copy(earth.position); halo.scale.setScalar(ER * 1.09); halo.renderOrder = -7; group.add(halo);
  return { group, earth, starMat, earthMat };
}

// Asteroid belt + Ark orbital station + MK-01 (sky set pieces; no fog)
export function buildSpace(scene, hullMat) {
  const g = new THREE.Group(); g.name = 'space';
  const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, fog: false });
  const ag = rockGeom(0, 11, [1.2, 0.9, 1], 0.45); const r = seeded(7); const N = 110;
  const belt = new THREE.InstancedMesh(ag, rockMat, N); const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < N; i++) { const a = -0.3 + r() * 2.6; const rr = 2600 + r() * 500; const y = 700 + Math.sin(a * 2) * 250 + (r() - 0.5) * 300; const s = 6 + r() ** 3 * 45; q.setFromEuler(e.set(r() * 6, r() * 6, r() * 6)); m.compose(new THREE.Vector3(-Math.cos(a) * rr * 0.7 - 1400, y + 300, Math.sin(a) * rr + 600), q, new THREE.Vector3(s, s * 0.8, s)); belt.setMatrixAt(i, m); }
  belt.frustumCulled = false; g.add(belt);
  const b = new Builder();
  const ax = 2300, ay = 1500, az = -2500;
  b.add('ivory', G.torus(220, 22, 8, 40), { pos: [ax, ay, az], rot: [1.15, 0.5, 0], color: C.ivory });
  b.add('gold', G.torus(220, 24, 4, 40), { pos: [ax, ay, az], rot: [1.15, 0.5, 0], scale: [1, 1, 0.3], color: C.gold });
  b.add('ivory', G.cyl(26, 26, 520, 12).translate(0, -260, 0), { pos: [ax, ay, az], rot: [1.15 - Math.PI / 2, 0.5, 0], color: C.ivory2 });
  for (let k = 0; k < 4; k++) { const sp = G.cyl(7, 7, 440, 6).translate(0, -220, 0).rotateZ(Math.PI / 2).rotateY(k * Math.PI / 4); b.add('gold', sp, { pos: [ax, ay, az], rot: [1.15, 0.5, 0], color: C.goldD }); }
  b.add('glow', G.torus(220, 6, 3, 40), { pos: [ax, ay, az], rot: [1.15, 0.5, 0], scale: [1.08, 1.08, 1], color: C.win, intensity: 2.5 });
  const hm = hullMat.clone(); hm.fog = false; const mats = { hull: hm };
  const built = b.build(mats, g); for (const k in built) { built[k].castShadow = built[k].receiveShadow = false; built[k].frustumCulled = false; }
  scene.add(g);
  return { group: g, mats };
}
