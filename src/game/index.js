import * as THREE from 'three';
import { pickLang, makeT } from './i18n.js';
import { createStore, LocalBackend } from './storage.js';
import { chapter1, addXP, xpForLevel } from './quests.js';
import { makeBeacon, makeCrystals, makeBurst } from './fx.js';
import { makeHUD, esc } from './hud.js';

// Stage 1 game layer: progression + Chapter 1 quests on top of the 3D world. createGame() is called once from main.js.
//   opts: { scene, camera, ctrl, groundAt, Q, places: { canyonPad, reactorConsole, dish, launchPad, ledge, homePad }, crystalSpots: [{x,z}] }
export function createGame({ scene, camera, ctrl, groundAt, Q, places, crystalSpots }) {
  const FAST = Q.get('fast') === '1'; const lang = pickLang(Q); const t = makeT(lang);
  let dayOffset = 0; // test hook: shift "today"
  const store = createStore({ backend: new LocalBackend(), now: () => Date.now() + dayOffset * 864e5 });
  const P = {}; for (const [k, v] of Object.entries(places)) P[k] = { x: v.x, z: v.z, y: groundAt(v.x, v.z) };
  const Qs = chapter1(P, FAST);
  const hud = makeHUD(t); const beacon = makeBeacon(scene); const spots = crystalSpots.map(c => ({ x: c.x, z: c.z, y: groundAt(c.x, c.z) }));
  const crystals = makeCrystals(scene, spots); const burst = makeBurst(scene);
  if (FAST) ctrl.speedMul = 3;
  try { window.Telegram?.WebApp?.ready?.(); window.Telegram?.WebApp?.expand?.(); } catch (e) { }
  let ready = false, lastThrust = -99, time = 0, hold = 0, holdActive = false, sheetOpen = false, tab = 'ch', busy = false;
  const D = () => store.data;
  const cur = () => (D().ch1.idx < Qs.length ? Qs[D().ch1.idx] : null);

  const syncCrystals = () => { store.roll(); const tk = new Set(D().crystals.taken); spots.forEach((_, i) => crystals.setAlive(i, !tk.has(i))); };
  const refreshTop = () => { const c = store.capInfo(); hud.setTop({ level: D().level, xp: D().xp, need: xpForLevel(D().level), points: D().points, earned: c.earned, cap: c.cap }); };
  const onActivate = () => { const q = cur(); if (!q) return; if (q.kind === 'collect') { const left = crystals.alive.filter(Boolean).length; if (left < q.need - D().ch1.prog) { D().crystals.taken = []; syncCrystals(); store.queueSave(); } } };

  async function reward(q) {
    busy = true; const r = await store.addPoints(q.pts, 'quest:' + q.id); const ups = addXP(D(), q.xp);
    D().ch1.done.push(q.id); D().ch1.idx++; D().ch1.prog = 0; D().stats.quests++; await store.save(); refreshTop();
    const last = D().ch1.idx >= Qs.length;
    hud.popup({ icon: last ? '🏆' : q.icon, head: last ? t('chapterDone') : t('questDone'), title: t('q_' + q.id + '_t'), pts: r.granted, xp: q.xp, level: ups ? D().level : 0, note: r.capped ? `${t('capPart')}: ${r.earned}/${r.cap}` : (last ? t('chapterDoneSub') : '') }, last ? 4200 : 2800);
    onActivate(); busy = false; if (sheetOpen) renderSheet();
  }
  async function pickCrystal(i) {
    crystals.setAlive(i, false); D().crystals.taken.push(i); D().stats.crystals++; const s = spots[i]; burst.fire(s.x, s.y + 1.0, s.z);
    const r = await store.addPoints(3, 'crystal'); addXP(D(), 5); const q = cur(); if (q && q.kind === 'collect') D().ch1.prog++;
    hud.toast(r.granted ? `💎 ${t('crystalToast')} +${r.granted} ⭐` : `💎 ${t('capHit')}`); store.queueSave(); refreshTop();
    if (q && q.kind === 'collect' && cur() === q && !busy && D().ch1.prog >= q.need) await reward(q);
  }

  // ---------- quests sheet ----------
  function renderSheet() {
    const sh = hud.$('#mk-sheet'); sh.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    const sub = sh.querySelector('.sub'), list = sh.querySelector('.list');
    if (tab === 'ch') {
      sub.innerHTML = `<span>${esc(t('chapterTitle'))}</span><span>${Math.min(D().ch1.idx, Qs.length)}/${Qs.length}</span>`;
      list.innerHTML = Qs.map((q, i) => { const s = i < D().ch1.idx ? 'done' : i === D().ch1.idx ? 'active' : 'locked'; return `<div class="mk-q ${s}"><div class="ic">${s === 'done' ? '✅' : s === 'locked' ? '🔒' : q.icon}</div><div class="tx"><div class="tt">${esc(t('q_' + q.id + '_t'))}</div><div class="dd">${esc(t('q_' + q.id + '_d'))}</div><div class="st">${esc(t(s === 'done' ? 'done' : s === 'active' ? 'active' : 'locked'))}</div></div><div class="rw">+${q.pts} ⭐<small>+${q.xp} XP</small></div></div>`; }).join('');
    } else { sub.innerHTML = `<span>${esc(t('daily'))}</span><span></span>`; list.innerHTML = `<div class="mk-soon"><b>🗓️</b>${esc(t('dailySoon'))}<br>${esc(t('dailySoon2'))}</div>`; }
  }
  const openSheet = (o) => { sheetOpen = o; hud.sheet(o, renderSheet); };
  hud.$('#mk-qbtn').addEventListener('click', () => openSheet(!sheetOpen));
  hud.$('#mk-track').addEventListener('click', () => openSheet(true));
  hud.$('#mk-scrim').addEventListener('click', () => openSheet(false));
  hud.$('#mk-sheet .x').addEventListener('click', () => openSheet(false));
  hud.$('#mk-sheet .tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { tab = b.dataset.tab; renderSheet(); } });
  const startHold = () => { const q = cur(); if (q && q.kind === 'interact' && inZone(q)) holdActive = true; };
  hud.$('#mk-act').addEventListener('click', startHold);
  addEventListener('keydown', e => { if (e.code === 'KeyE') startHold(); if (e.code === 'KeyQ' || e.code === 'KeyJ') openSheet(!sheetOpen); if (e.code === 'Escape') openSheet(false); });

  const v = new THREE.Vector3();
  const inZone = (q) => Math.hypot(ctrl.pos.x - q.target.x, ctrl.pos.z - q.target.z) < q.r;
  function targetOf(q) {
    if (!q) return null; if (q.target) return q.target;
    let best = null, bd = 1e9; spots.forEach((s, i) => { if (!crystals.alive[i]) return; const d = Math.hypot(s.x - ctrl.pos.x, s.z - ctrl.pos.z); if (d < bd) { bd = d; best = s; } }); return best || P.canyonPad;
  }
  function trackHTML(q, dist) {
    if (!q) return `<div class="ch"><span>${esc(t('chapter'))} · ${esc(t('chapterTitle'))}</span><span>${Qs.length}/${Qs.length}</span></div><div class="t">🏆 ${esc(t('chapterDone'))}</div><div class="d">${esc(t('chapterDoneSub'))}</div>`;
    const prog = q.kind === 'collect' ? `<div class="row"><div class="bar"><i style="width:${Math.min(100, D().ch1.prog / q.need * 100)}%"></i></div><span>${D().ch1.prog}/${q.need}</span></div>` : '';
    const hint = q.kind === 'jet' ? `<div class="hint">🔥 ${esc(t('useJet'))}</div>` : (q.kind === 'interact' && holdActive ? `<div class="hint">${esc(t('holdZone'))}</div>` : '');
    return `<div class="ch"><span>${esc(t('chapter'))} · ${esc(t('chapterTitle'))}</span><span>${D().ch1.idx + 1}/${Qs.length}</span></div><div class="t">${q.icon} ${esc(t('q_' + q.id + '_t'))}</div><div class="d">${esc(t('q_' + q.id + '_d'))}</div>${prog}<div class="row" style="margin-top:5px"><span style="color:rgba(247,242,231,.6)">+${q.pts} ⭐ · +${q.xp} XP</span><span class="dist">${dist != null ? Math.round(dist) + ' ' + t('m') : ''}</span></div>${hint}`;
  }

  function update(dt) {
    if (!ready) return; time += dt;
    if (ctrl.thrusting) lastThrust = time;
    crystals.update(time); burst.update(dt);
    // pickups (any quest state; daily respawn)
    for (let i = 0; i < spots.length; i++) { if (!crystals.alive[i]) continue; const s = spots[i]; if (Math.hypot(s.x - ctrl.pos.x, s.z - ctrl.pos.z) < 1.7 && Math.abs(ctrl.pos.y - s.y) < 3.5) pickCrystal(i); }
    const q = cur(); const tg = targetOf(q);
    beacon.set(tg ? { x: tg.x, y: tg.y, z: tg.z } : null, q && q.kind === 'collect' ? '#ffcf5a' : '#67d7f0'); beacon.update(time, camera.position);
    const dist = tg ? Math.hypot(tg.x - ctrl.pos.x, tg.z - ctrl.pos.z) : null;
    // quest logic
    if (q && !busy) {
      if (q.kind === 'reach' && inZone(q)) reward(q);
      else if (q.kind === 'jet' && inZone(q) && ctrl.onGround && time - lastThrust < 4) reward(q);
      else if (q.kind === 'interact') {
        const z = inZone(q); if (!z) { holdActive = false; hold = 0; }
        if (holdActive) { hold += dt; if (hold >= q.hold) { holdActive = false; hold = 0; reward(q); } }
        hud.action(z ? (q.action === 'scan' ? '📡 ' + t('scan') : '⚡ ' + t('activate')) : null, q.hold ? Math.min(1, hold / q.hold) : 0);
      }
    }
    if (!q || q.kind !== 'interact' || busy) hud.action(null);
    hud.setTrack(trackHTML(q, dist));
    // marker: chip over the beacon when on screen, edge arrow otherwise
    if (tg && dist > 2.5) {
      v.set(tg.x, tg.y + 3.2, tg.z).project(camera); const W = innerWidth, Hh = innerHeight; const behind = v.z > 1;
      let x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * Hh; const mT = 150, mB = 230, mX = 34; const label = Math.round(dist) + ' ' + t('m');
      if (!behind && x > mX && x < W - mX && y > mT && y < Hh - mB) hud.marker('chip', x, y, 0, label);
      else { let dx = x - W / 2, dy = y - Hh / 2; if (behind) { dx = -dx; dy = -dy; } if (Math.abs(dx) < 1e-3 && Math.abs(dy) < 1e-3) dy = 1; const cx = W / 2, cy = (mT + Hh - mB) / 2; const hx = W / 2 - mX, hy = (Hh - mB - mT) / 2; const k = Math.min(hx / Math.abs(dx || 1e-6), hy / Math.abs(dy || 1e-6)); hud.marker('arrow', cx + dx * k, cy + dy * k, Math.atan2(dx, -dy), label); }
    } else hud.marker(null);
  }

  const boot = (async () => {
    if (Q.get('reset') === '1') { await store.wipe(); try { history.replaceState(null, '', location.pathname + location.search.replace(/([?&])reset=1&?/, '$1').replace(/[?&]$/, '')); } catch (e) { } }
    await store.load(); syncCrystals(); onActivate(); refreshTop(); await store.save(); ready = true;
  })();

  const api = {
    boot, get ready() { return ready; }, t, lang,
    state: () => JSON.parse(JSON.stringify(D())), quest: () => { const q = cur(); return q && { id: q.id, kind: q.kind, idx: D().ch1.idx, prog: D().ch1.prog, need: q.need }; },
    target: () => { const g = targetOf(cur()); return g && { x: g.x, y: g.y, z: g.z }; },
    teleport(x, z, yaw = ctrl.yaw) { ctrl.place(x, z, yaw); ctrl.vel.set(0, 0, 0); },
    teleportToTarget(off = 0) { const g = targetOf(cur()); if (g) api.teleport(g.x + off, g.z); return g; },
    interact: startHold, openSheet, setTab(x) { tab = x; renderSheet(); },
    addPoints: (n, why) => store.addPoints(n, why).then(r => { refreshTop(); return r; }),
    shiftDay(n) { dayOffset += n; store.roll(); syncCrystals(); onActivate(); refreshTop(); },
    crystals: () => ({ alive: crystals.alive.filter(Boolean).length, total: spots.length, spots: spots.map((s, i) => ({ ...s, alive: crystals.alive[i] })) }),
    fakeThrust() { lastThrust = time; }, popup: (o) => hud.popup(o, 60000), save: () => store.save(), fast: FAST,
  };
  return { update, api };
}
