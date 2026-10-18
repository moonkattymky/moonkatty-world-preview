import { chromium } from 'playwright-core'; import { seed } from './ch2_seed.mjs'; import { execSync } from 'child_process';
const q = process.argv[2] || '';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push('ERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('C ' + m.text().slice(0, 200)); });
await seed(p, q, { done: ['c2_collect', 'c2_send', 'c2_upgrade', 'c2_help', 'c2_daily', 'c2_deliver', 'c2_l3'], level: 3, robots: [{ id: 'r1', type: 'builder', xp: 0 }, { id: 'r2', type: 'geologist', xp: 0 }, { id: 'r3e', type: 'engineer', xp: 0 }] });
const info = await p.evaluate(async () => { const G = MK.game, st = G.ch2.storm(); const cp = st.console, c = st.center; const a = Math.atan2(c.x - cp.x, c.z - cp.z);
  const dx = Math.sin(a), dz = Math.cos(a), px = Math.cos(a), pz = -Math.sin(a); // dir to centre, perpendicular
  G.teleport(cp.x - dx * 0.9 + px * 1.3, cp.z - dz * 0.9 + pz * 1.3, Math.atan2(-dx * 0.8 - px * 0.6, -dz * 0.8 - pz * 0.6), true); window.__camFix = () => { const C = MK.camera, gy = MK.ctrl.pos.y; MK.ctrl.camFree = false; C.position.set(cp.x - dx * 3.6 - px * 0.6, gy + 1.75, cp.z - dz * 3.6 - pz * 0.6); C.lookAt(c.x * 0.4 + cp.x * 0.6 - px * 4, gy + 7.5, c.z * 0.4 + cp.z * 0.6 - pz * 4); C.fov = 55; C.updateProjectionMatrix(); };
  window.__camFix(); setInterval(window.__camFix, 30);
  G.ch2.startStorm(); G.ch2.stepStorm(+(new URLSearchParams(location.search).get('ss') || 9)); const sh = G.ch2.shield; if (G.ch2.poseStorm) G.ch2.poseStorm(); if (sh && sh.pose) sh.pose(9); return { cp, c, a }; });
await p.addStyleTag({ content: '#mk-root{display:none !important} body > *:not(#app):not(canvas){opacity:0}' });
await p.waitForTimeout(4000);
await p.screenshot({ path: `renders/ch2_shield${q ? '_' + q.replace(/\W/g, '') : ''}.png` });
console.log(JSON.stringify({ info, st: await p.evaluate(() => MK.game.ch2.storm()), errs })); await b.close();
if (!q) execSync(`python3 -c "
from PIL import Image, ImageDraw
a=Image.open('refs/shield_concept.jpg').convert('RGB').resize((1280,720)); b=Image.open('renders/ch2_shield.png').convert('RGB').resize((1280,720))
S=Image.new('RGB',(2560,760),'#111'); S.paste(a,(0,0)); S.paste(b,(1280,0)); d=ImageDraw.Draw(S); d.text((10,730),'concept (approved)',fill='white'); d.text((1290,730),'in-game night meteor storm (headless SwiftShader render, meteors posed mid-flight)',fill='white'); S.save('renders/ch2_shield_vs_concept.png')
"`);
