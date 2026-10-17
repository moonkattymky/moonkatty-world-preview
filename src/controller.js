import * as THREE from 'three';
import { groundAt } from './terrain.js';

// Third-person controller: WASD/arrows + touch joystick, jetpack on Space/button, orbit camera.
export class Controller {
  constructor(camera, dom, colliders) {
    this.cam = camera; this.dom = dom; this.colliders = colliders;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.yaw = 0; this.onGround = true;
    this.fuel = 1; this.thrusting = false; this.keys = new Set(); this.joy = new THREE.Vector2(); this.jumpHeld = false; this._jumpPrev = false;
    this.camYaw = 0; this.camPitch = 0.28; this.camDist = 7.5; this.camTarget = new THREE.Vector3(); this.enabled = true; this.camFree = true;
    addEventListener('keydown', e => { this.keys.add(e.code); if (e.code === 'Space') e.preventDefault(); });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    // orbit by drag
    let drag = null;
    dom.addEventListener('pointerdown', e => { drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; dom.setPointerCapture(e.pointerId); });
    dom.addEventListener('pointermove', e => { if (!drag || drag.id !== e.pointerId) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; this.camYaw -= dx * 0.006; this.camPitch = THREE.MathUtils.clamp(this.camPitch + dy * 0.004, -0.15, 1.3); });
    dom.addEventListener('pointerup', () => drag = null); dom.addEventListener('pointercancel', () => drag = null);
    dom.addEventListener('wheel', e => { this.camDist = THREE.MathUtils.clamp(this.camDist * (1 + Math.sign(e.deltaY) * 0.1), 3, 40); e.preventDefault(); }, { passive: false });
  }
  bindTouch(joyEl, knobEl, jumpEl) {
    let id = null, cx = 0, cy = 0; const R = 55;
    const move = e => { const dx = e.clientX - cx, dy = e.clientY - cy; const l = Math.min(R, Math.hypot(dx, dy)); const a = Math.atan2(dy, dx); const kx = Math.cos(a) * l, ky = Math.sin(a) * l; knobEl.style.transform = `translate(${kx}px,${ky}px)`; this.joy.set(kx / R, -ky / R); };
    joyEl.addEventListener('pointerdown', e => { id = e.pointerId; const r = joyEl.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; joyEl.setPointerCapture(id); move(e); e.stopPropagation(); });
    joyEl.addEventListener('pointermove', e => { if (e.pointerId === id) move(e); });
    const end = e => { if (e.pointerId !== id) return; id = null; this.joy.set(0, 0); knobEl.style.transform = ''; };
    joyEl.addEventListener('pointerup', end); joyEl.addEventListener('pointercancel', end);
    jumpEl.addEventListener('pointerdown', e => { this.jumpHeld = true; jumpEl.setPointerCapture(e.pointerId); e.stopPropagation(); });
    const je = () => this.jumpHeld = false; jumpEl.addEventListener('pointerup', je); jumpEl.addEventListener('pointercancel', je);
  }
  place(x, z, yaw) { this.pos.set(x, groundAt(x, z), z); this.yaw = yaw; this.camYaw = yaw + Math.PI; this.camTarget.copy(this.pos).add(new THREE.Vector3(0, 1.3, 0)); }
  update(dt) {
    const k = this.keys; let ix = this.joy.x, iy = this.joy.y;
    if (k.has('KeyW') || k.has('ArrowUp')) iy += 1; if (k.has('KeyS') || k.has('ArrowDown')) iy -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) ix += 1; if (k.has('KeyA') || k.has('ArrowLeft')) ix -= 1;
    const il = Math.hypot(ix, iy); if (il > 1) { ix /= il; iy /= il; }
    const run = k.has('ShiftLeft') || k.has('ShiftRight') || Math.hypot(this.joy.x, this.joy.y) > 0.95;
    const fx = -Math.sin(this.camYaw), fz = -Math.cos(this.camYaw), rx = Math.cos(this.camYaw), rz = -Math.sin(this.camYaw);
    const mx = rx * ix + fx * iy, mz = rz * ix + fz * iy; const speed = (run ? 9 : 5) * Math.min(1, Math.hypot(ix, iy) * 1.2);
    const ml = Math.hypot(mx, mz) || 1; const tx = mx / ml * speed, tz = mz / ml * speed;
    const acc = this.onGround ? 10 : 3; this.vel.x += (tx - this.vel.x) * Math.min(1, acc * dt); this.vel.z += (tz - this.vel.z) * Math.min(1, acc * dt);
    const jump = this.jumpHeld || k.has('Space');
    if (jump && !this._jumpPrev && this.onGround) { this.vel.y = 6.5; this.onGround = false; }
    this.thrusting = false;
    if (jump && !this.onGround && this.fuel > 0 && this.vel.y < 6) { this.vel.y += 24 * dt; this.fuel = Math.max(0, this.fuel - dt * 0.4); this.thrusting = true; }
    this._jumpPrev = jump;
    this.vel.y -= 11 * dt;
    this.pos.addScaledVector(this.vel, dt);
    for (const c of this.colliders) { const dx = this.pos.x - c.x, dz = this.pos.z - c.z, d = Math.hypot(dx, dz), r = c.r + 0.45; if (d < r && d > 1e-4 && this.pos.y < groundAt(c.x, c.z) + (c.h || 8)) { this.pos.x = c.x + dx / d * r; this.pos.z = c.z + dz / d * r; } }
    const rr = Math.hypot(this.pos.x, this.pos.z); if (rr > 1050) { this.pos.x *= 1050 / rr; this.pos.z *= 1050 / rr; }
    const g = groundAt(this.pos.x, this.pos.z);
    if (this.pos.y <= g) { this.pos.y = g; if (this.vel.y < 0) this.vel.y = 0; this.onGround = true; } else if (this.pos.y > g + 0.05) this.onGround = false;
    if (this.onGround) this.fuel = Math.min(1, this.fuel + dt * 0.5);
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (hs > 0.3 && speed > 0.1) { const ty = Math.atan2(this.vel.x, this.vel.z); let d = ty - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw += d * Math.min(1, 10 * dt); }
    this.speed = hs;
    if (this.camFree) this.updateCamera(dt);
  }
  updateCamera(dt) {
    const want = this.pos.clone().add(new THREE.Vector3(0, 1.3, 0));
    this.camTarget.lerp(want, Math.min(1, dt * 8));
    const cp = Math.cos(this.camPitch); const off = new THREE.Vector3(Math.sin(this.camYaw) * cp, Math.sin(this.camPitch), Math.cos(this.camYaw) * cp).multiplyScalar(this.camDist);
    const p = this.camTarget.clone().add(off); const gy = groundAt(p.x, p.z) + 0.6; if (p.y < gy) p.y = gy;
    this.cam.position.copy(p); this.cam.lookAt(this.camTarget);
  }
}
