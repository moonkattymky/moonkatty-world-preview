import { chromium } from 'playwright-core'; import { seed } from './ch2_seed.mjs'; import { execSync } from 'child_process';
const q = process.argv[2] || '';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const urlq = process.env.Q || ''; const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push('ERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('C ' + m.text().slice(0, 200)); });
await seed(p, q, { done: ['c2_collect', 'c2_send', 'c2_upgrade', 'c2_help', 'c2_daily', 'c2_deliver', 'c2_l3'], level: 3, robots: [{ id: 'r1', type: 'builder', xp: 0 }, { id: 'r2', type: 'geologist', xp: 0 }, { id: 'r3e', type: 'engineer', xp: 0 }] });
const info = await p.evaluate(async () => { const THREE_V = function (C, lx, lz) { const e = C.matrixWorld.elements; const r = { x: e[0], z: e[2] }, f = { x: -e[8], z: -e[10] }; const fl = Math.hypot(f.x, f.z) || 1; f.x /= fl; f.z /= fl; const rl = Math.hypot(r.x, r.z) || 1; r.x /= rl; r.z /= rl; this.x = C.position.x + r.x * lx - f.x * lz; this.z = C.position.z + r.z * lx - f.z * lz; }; const G = MK.game, st = G.ch2.storm(); const cp = st.console, c = st.center; const a = Math.atan2(c.x - cp.x, c.z - cp.z);
  const dx = Math.sin(a), dz = Math.cos(a), px = Math.cos(a), pz = -Math.sin(a); // dir to centre, perpendicular
  const FOV = +(new URLSearchParams(location.search).get('fov') || 70), BK = +(new URLSearchParams(location.search).get('bk') || 2.6), LK = +(new URLSearchParams(location.search).get('lk') || -6);
  G.teleport(cp.x - dx * 2, cp.z - dz * 2, 0, true); const gy0 = MK.ctrl.pos.y;
  window.__camFix = () => { const C = MK.camera, gy = gy0; MK.ctrl.camFree = false; const CH = +(new URLSearchParams(location.search).get('ch') || 1.6), CX = +(new URLSearchParams(location.search).get('cx') || -0.6), LY = +(new URLSearchParams(location.search).get('ly') || 6.5); C.position.set(cp.x - dx * BK + px * CX, gy + CH, cp.z - dz * BK + pz * CX); C.lookAt(cp.x + dx * 30 - px * LK, gy + LY, cp.z + dz * 30 - pz * LK); C.fov = FOV; C.updateProjectionMatrix(); C.updateMatrixWorld(); };
  window.__camFix(); { const kx = cp.x + px * 1.2 - dx * 0.15, kz = cp.z + pz * 1.2 - dz * 0.15; const tx = cp.x - dx * 2.2, tz = cp.z - dz * 2.2; G.teleport(kx, kz, Math.atan2(tx - kx, tz - kz), true); }
  window.__camFix(); setInterval(window.__camFix, 30);
  G.ch2.startStorm(); G.ch2.stepStorm(+(new URLSearchParams(location.search).get('ss') || 9)); const sh = G.ch2.shield; if (G.ch2.poseStorm) G.ch2.poseStorm(); if (sh && sh.pose) sh.pose(9); return { cp, c, a }; });
await p.addStyleTag({ content: '#mk-root,#joy,#jump,#views,#help,#title,#fuelwrap{display:none !important} body > *:not(#app):not(canvas){opacity:0}' });
await p.waitForTimeout(3500); await p.evaluate(() => { const sh = MK.game.ch2.shield; if (sh && sh.pose) sh.pose(7); }); await p.waitForTimeout(120);
await p.screenshot({ path: `renders/ch2_shield${q ? '_' + q.replace(/\W/g, '') : ''}.png` });
console.log(JSON.stringify(await p.evaluate(() => { const S = MK.scene, C = MK.camera, out = []; S.traverse(o => { if (o.name && o.name.startsWith('crew_') && o.isGroup) out.push([o.name, o.visible, +o.position.x.toFixed(1), +o.position.z.toFixed(1), +C.position.distanceTo(o.position).toFixed(1)]); }); const im = S.getObjectByName('crew_impostors'); return { crew: out, imp: im && [im.visible, im.geometry.instanceCount] }; })));
console.log(JSON.stringify({ info, st: await p.evaluate(() => MK.game.ch2.storm()), errs })); await b.close();
if (!q) execSync(`python3 -c "
from PIL import Image, ImageDraw
a=Image.open('refs/shield_concept.jpg').convert('RGB').resize((1280,720)); b=Image.open('renders/ch2_shield.png').convert('RGB').resize((1280,720))
S=Image.new('RGB',(2560,760),'#111'); S.paste(a,(0,0)); S.paste(b,(1280,0)); d=ImageDraw.Draw(S); d.text((10,730),'concept (approved)',fill='white'); d.text((1290,730),'in-game night meteor storm (headless SwiftShader render, meteors posed mid-flight)',fill='white'); S.save('renders/ch2_shield_vs_concept.png')
"`);
