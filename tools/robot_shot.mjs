// Close-up of the builder robot next to the approved concept crop -> renders/robot_compare.png (side by side)
// usage: node tools/robot_shot.mjs [mode=weld]  (server on :47321)
import { chromium } from 'playwright-core'; import { execSync } from 'child_process';
const mode = process.argv[2] || 'weld';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 540, height: 720 } }); const logs = []; p.on('pageerror', e => logs.push(e.message)); p.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
await p.goto('http://localhost:47321/index.html?view=play&reset=1&fast=1'); await p.waitForFunction(() => window.MK && MK.ready && MK.game && MK.game.ready, null, { timeout: 150000 });
await p.addStyleTag({ content: 'body > *:not(#app){display:none !important}' });
const info = await p.evaluate(async (mode) => { const R = MK.game.robot ? MK.game.robot() : null; let r = R; if (!r) { const { makeRobot } = await import('./src/game/robot.js'); r = makeRobot(MK.scene, MK.env); }
  const T = await import('./src/terrain.js'); const c = MK.ctrl; c.camFree = false; const x = c.pos.x + 3, z = c.pos.z + 2; r.root.visible = true; r.root.position.set(x, T.groundAt(x, z), z); r.root.rotation.y = -1.25; /* face the sun (concept: front-lit) */ window.__rb = r;
  const cam = MK.camera; const yy = r.root.rotation.y; cam.position.set(x + Math.sin(yy) * 2.0, r.root.position.y + 1.05, z + Math.cos(yy) * 2.0); cam.lookAt(x, r.root.position.y + 1.08, z); cam.fov = 40; cam.updateProjectionMatrix();
  let t = 0; const step = () => { r.update(1 / 30, mode); }; window.__rbi = setInterval(step, 33); return { tris: r.tris }; }, mode);
await p.waitForTimeout(3500); await p.screenshot({ path: '/tmp/robot_close.png' });
await p.evaluate(() => { const r = window.__rb, cam = MK.camera; const P = r.root.position; const yy = r.root.rotation.y; cam.position.set(P.x + Math.sin(yy) * 3.4, P.y + 0.9, P.z + Math.cos(yy) * 3.4); cam.lookAt(P.x, P.y + 0.85, P.z); cam.updateProjectionMatrix(); });
await p.waitForTimeout(2500); await p.screenshot({ path: '/tmp/robot_full.png' });
console.log(JSON.stringify({ ...info, logs })); await b.close();
execSync(`python3 -c "
from PIL import Image
ref=Image.open('/cursor/stores/store-aec859c9-8de3-4a87-9ebb-d27a70ea91ac/grok-bot/agents/2e137442-742f-420a-bc0f-9f91777db88f/attachments/c3d81f09779a9361ef30d51172aa3f67f27c68a31a35dc7fbacc29f1efa25705.jpg')
full=ref.crop((20,160,360,610)).resize((540,715)); body=ref.crop((0,150,380,620)).resize((540,668))
a=Image.open('/tmp/robot_close.png'); f=Image.open('/tmp/robot_full.png')
s=Image.new('RGB',(540*4,720),'#111'); s.paste(full,(0,0)); s.paste(a,(540,0)); s.paste(body,(1080,26)); s.paste(f,(1620,0)); s.save('renders/robot_compare.png')"`);
