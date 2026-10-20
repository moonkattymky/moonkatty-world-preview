// ch1 concept-view render: node tools/ch1_concept_shot.mjs out.png [view=concept|play] [q]
import { chromium } from 'playwright-core';
const out = process.argv[2] || '/tmp/c1.png', view = process.argv[3] || 'concept', q = process.argv[4] ? '&q=' + process.argv[4] : '';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1024, height: 576 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(`http://localhost:${process.env.MKPORT || 47321}/index.html?view=${view}&shot=1${q}`); await p.waitForFunction(() => window.MK && MK.ready, null, { timeout: 180000 });
await p.waitForTimeout(4000); await p.screenshot({ path: out });
console.log(JSON.stringify({ out, errs, st: await p.evaluate(() => MK.stats ? MK.stats().wholeFrameInclPost : null) })); await b.close();
