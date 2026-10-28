"use strict";
/* ================= しかけ: 開く扉・爆発するドラム缶・プレス機・キック ================= */
const doors = [], explosives = [], crushers = [], blasts = [], pendingBlasts = [];

/* ---------- 扉(近づくと左右にスライドして開く) ---------- */
function makeDoor(d) {
  const mat = levelMat('panel', 0x8a92a0), leaves = [];
  for (const sgn of [-1, 1]) {
    const geo = d.axis === 'x' ? new THREE.BoxGeometry(d.w / 2, d.h, 0.5) : new THREE.BoxGeometry(0.5, d.h, d.w / 2); scaleUV(geo, d.axis === 'x' ? d.w / 2 : 0.5, d.h, d.axis === 'x' ? 0.5 : d.w / 2, 2.4);
    const m = new THREE.Mesh(geo, mat); m.position.set(d.x + (d.axis === 'x' ? sgn * d.w / 4 : 0), d.h / 2, d.z + (d.axis === 'z' ? sgn * d.w / 4 : 0));
    scene.add(m); obstacleMeshes.push(m); leaves.push({ mesh: m, base: m.position.clone(), sgn });
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(d.axis === 'x' ? d.w / 2 - 0.1 : 0.55, 0.25, d.axis === 'x' ? 0.55 : d.w / 2 - 0.1), new THREE.MeshLambertMaterial({ map: TEX.stripe })); stripe.position.y = -d.h / 2 + 1.0; m.add(stripe);
  }
  const box = d.axis === 'x' ? { x0: d.x - d.w / 2, x1: d.x + d.w / 2, z0: d.z - 0.3, z1: d.z + 0.3 } : { x0: d.x - 0.3, x1: d.x + 0.3, z0: d.z - d.w / 2, z1: d.z + d.w / 2 };
  boxes.push(box);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.2), new THREE.MeshBasicMaterial({ color: 0xff3322 })); lamp.position.set(d.x + (d.axis === 'z' ? 0.35 : 0), d.h - 0.5, d.z + (d.axis === 'x' ? 0.35 : 0)); scene.add(lamp);
  const o = Object.assign({}, d, { open: 0, target: 0, leaves, box, collide: true, lamp, snd: false }); doors.push(o); return o;
}
function updateDoors(dt) {
  for (const d of doors) {
    if (!d.target) {
      const near = Math.hypot(P.pos.x - d.x, P.pos.z - d.z) < 3.4;
      let enemyNear = false; for (const e of enemies) if (e.state === 'alert' && Math.hypot(e.pos.x - d.x, e.pos.z - d.z) < 2.8) { enemyNear = true; break; }
      if (near || enemyNear) { d.target = 1; if (!d.snd) { d.snd = true; sndDoor(new THREE.Vector3(d.x, 0, d.z)); if (near) makeNoise(new THREE.Vector3(d.x, 0, d.z), 5); } }
    }
    if (d.target && d.open < 1) {
      d.open = Math.min(1, d.open + dt * 1.5); const off = d.open * (d.w / 2 + 0.06);
      for (const l of d.leaves) { if (d.axis === 'x') l.mesh.position.x = l.base.x + l.sgn * off; else l.mesh.position.z = l.base.z + l.sgn * off; }
      d.lamp.material.color.setHex(d.open > 0.6 ? 0x33ff66 : 0xffaa22);
      if (d.open >= 0.6 && d.collide) {   // 開いたら通れる・見通せる
        d.collide = false; const bi = boxes.indexOf(d.box); if (bi >= 0) boxes.splice(bi, 1);
        for (const l of d.leaves) { const oi = obstacleMeshes.indexOf(l.mesh); if (oi >= 0) obstacleMeshes.splice(oi, 1); }
      }
    }
  }
}

/* ---------- 爆発するドラム缶(赤) ---------- */
function makeExplosive(x, z) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.05, 14), new THREE.MeshLambertMaterial({ color: 0xff4a3a, map: TEX.barrel }));
  m.position.set(x, 0.525, z); scene.add(m); obstacleMeshes.push(m);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.22, 14), new THREE.MeshLambertMaterial({ map: TEX.stripe })); ring.position.y = 0.1; m.add(ring);
  const box = { x0: x - 0.4, x1: x + 0.4, z0: z - 0.4, z1: z + 0.4 }; boxes.push(box);
  const ex = { mesh: m, box, x, z, alive: true }; m.userData.explosive = ex; explosives.push(ex); return ex;
}
function detonate(ex, delay) { if (!ex.alive) return; ex.alive = false; pendingBlasts.push({ ex, t: delay || 0 }); }
const fireTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,255,220,1)'); g.addColorStop(0.25, 'rgba(255,190,60,0.95)'); g.addColorStop(0.6, 'rgba(230,70,10,0.7)'); g.addColorStop(1, 'rgba(60,20,10,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
})();
const smokeTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(40,40,40,0.85)'); g.addColorStop(1, 'rgba(30,30,30,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
function blastFx(x, y, z, size) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); sp.position.set(x, y, z); sp.scale.setScalar(1); scene.add(sp); blasts.push({ sp, t: 0, life: 0.55, size, smoke: false });
  for (let k = 0; k < 7; k++) { const sm = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0.8 })); sm.position.set(x + rnd(-1, 1), y + rnd(0, 1.4), z + rnd(-1, 1)); sm.scale.setScalar(1.5); scene.add(sm); blasts.push({ sp: sm, t: 0, life: rnd(0.9, 1.7), size: rnd(2.5, 4), smoke: true, vy: rnd(0.8, 1.8) }); }
}
function doBlast(ex) {
  const R = 6.8; scene.remove(ex.mesh); let oi = obstacleMeshes.indexOf(ex.mesh); if (oi >= 0) obstacleMeshes.splice(oi, 1); const bi = boxes.indexOf(ex.box); if (bi >= 0) boxes.splice(bi, 1);
  blastFx(ex.x, 1.1, ex.z, 9);
  splat(ex.x, ex.z, true); { const sc = decals[(dIdx - 1 + decals.length) % decals.length]; sc.material = new THREE.MeshBasicMaterial({ color: 0x151515, transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }); sc.scale.setScalar(rnd(2.6, 3.4)); }   // 焦げ跡
  sndExplosion(new THREE.Vector3(ex.x, 0, ex.z)); shake = Math.min(0.35, shake + 0.28); punchFov(10); hitStop(0.1);
  for (const e of enemies.slice()) {
    const dx = e.pos.x - ex.x, dz = e.pos.z - ex.z, d = Math.hypot(dx, dz); if (d > R) continue;
    const dir = new THREE.Vector3(dx / (d || 1), 0.4, dz / (d || 1));
    if (e.type.boss) { e.hp -= 300 * (1 - d / R); blood(new THREE.Vector3(e.pos.x, 1.5, e.pos.z), dir, 120, 9); if (e.hp <= 0) killEnemy(e, dir, false, 18, false, true); else becomeAlert(e); continue; }
    killEnemy(e, dir, false, 18, false, true);
  }
  for (const gm of gibs) { const dx = gm.position.x - ex.x, dz = gm.position.z - ex.z, d = Math.hypot(dx, dz); if (d < R && gm.userData.vel) { gm.userData.rest = false; gm.userData.vel.add(new THREE.Vector3(dx / (d || 1) * 9, rnd(5, 9), dz / (d || 1) * 9)); } }
  const dp = Math.hypot(P.pos.x - ex.x, P.pos.z - ex.z); if (dp < R) { damagePlayer(75 * (1 - dp / R)); redFlash(0.6); screenSplat(0); }
  makeNoise(new THREE.Vector3(ex.x, 0, ex.z), 40);
  for (const o of explosives) if (o.alive && Math.hypot(o.x - ex.x, o.z - ex.z) < 5.5) detonate(o, rnd(0.08, 0.3));   // 誘爆
}
function updateBlasts(dt) {
  for (let i = pendingBlasts.length - 1; i >= 0; i--) { const p = pendingBlasts[i]; p.t -= dt; if (p.t <= 0) { pendingBlasts.splice(i, 1); doBlast(p.ex); } }
  for (let i = blasts.length - 1; i >= 0; i--) {
    const b = blasts[i]; b.t += dt; const u = b.t / b.life;
    if (b.smoke) { b.sp.scale.setScalar(1.5 + u * b.size * 0.7); b.sp.position.y += b.vy * dt; const cd = b.sp.position.distanceTo(camera.position); b.sp.material.opacity = 0.7 * (1 - u) * Math.max(0, Math.min(1, (cd - 1.0) / 3.0)); }   // カメラに近い煙は薄く
    else { b.sp.scale.setScalar(b.size * (0.25 + Math.sqrt(u) * 0.9)); b.sp.material.opacity = 1 - u * u; }
    if (u >= 1) { scene.remove(b.sp); b.sp.material.dispose(); blasts.splice(i, 1); }
  }
}

/* ---------- プレス機(周期的に落ちてくる。通りかかった敵もプレイヤーも潰す) ---------- */
function makeCrusher(x, z) {
  addDeco(x, 0.03, z, 3.8, 0.06, 3.8, 0x888888, 'stripe');
  for (const sx of [-2.0, 2.0]) addDeco(x + sx, H / 2, z, 0.35, H, 0.35, 0x45484e);
  addDeco(x, H - 0.3, z, 4.4, 0.6, 0.6, 0x45484e);
  const head = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.9, 3.3), new THREE.MeshLambertMaterial({ map: TEX.panel, color: 0x6a707c })); scene.add(head);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 3.2, 10), new THREE.MeshLambertMaterial({ color: 0x3a3d42 })); shaft.position.y = 2.1; head.add(shaft);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.25), new THREE.MeshBasicMaterial({ color: 0x331111 })); lamp.position.set(0, 0.5, 1.7); head.add(lamp);
  const top = H - 1.4; head.position.set(x, top, z);
  const c = { x, z, head, lamp, top, state: 'up', t: rnd(0.6, 3.2), y: top, beeped: false }; crushers.push(c); return c;
}
function crushEnemy(e) {
  const dir = new THREE.Vector3(rnd(-1, 1), 0.3, rnd(-1, 1)).normalize();
  killEnemy(e, dir, false, 12, false, true);
  for (let k = 0; k < 4; k++) splat(e.pos.x + rnd(-1.4, 1.4), e.pos.z + rnd(-1.4, 1.4), true);
}
function updateCrushers(dt) {
  // 機械ホールの近くにプレイヤーがいる時だけ動く(開始直後に敵が勝手に潰れないように)
  const armed = S.state === 'play' && P.pos.z < -32 && P.pos.z > -92 && Math.abs(P.pos.x) < 26;
  if (!armed) { crushers.armed = false; return; }
  if (!crushers.armed) { crushers.armed = true; for (const c of crushers) if (c.state === 'up') c.t = Math.max(c.t, 1.6 + Math.random()); }
  for (const c of crushers) {
    c.t -= dt;
    if (c.state === 'up') { if (c.t <= 0) { c.state = 'warn'; c.t = 0.85; c.beeped = false; } }
    else if (c.state === 'warn') {
      const blink = Math.floor(c.t * 10) % 2 === 0; c.lamp.material.color.setHex(blink ? 0xff2211 : 0x331111);
      if (!c.beeped) { c.beeped = true; sndCrusherWarn(new THREE.Vector3(c.x, 0, c.z)); }
      if (c.t <= 0) { c.state = 'slam'; c.t = 0.1; c.y0 = c.y; }
    } else if (c.state === 'slam') {
      const u = 1 - Math.max(0, c.t / 0.1); c.y = c.y0 + (0.45 - c.y0) * u * u;
      if (c.t <= 0) {
        c.y = 0.45; c.state = 'hold'; c.t = 0.55; c.lamp.material.color.setHex(0x331111);
        sndCrusherSlam(new THREE.Vector3(c.x, 0, c.z));
        const dc = Math.hypot(P.pos.x - c.x, P.pos.z - c.z); if (dc < 22) { shake = Math.min(0.3, shake + 0.2 * (1 - dc / 22)); }
        for (const e of enemies.slice()) if (Math.abs(e.pos.x - c.x) < 1.75 && Math.abs(e.pos.z - c.z) < 1.75) crushEnemy(e);
        if (Math.abs(P.pos.x - c.x) < 1.75 && Math.abs(P.pos.z - c.z) < 1.75 && P.pos.y < 1.2) { damagePlayer(60); screenSplat(0); }
      }
    } else if (c.state === 'hold') { if (c.t <= 0) { c.state = 'rise'; c.t = 0.9; } }
    else if (c.state === 'rise') { c.y = 0.45 + (c.top - 0.45) * (1 - Math.max(0, c.t) / 0.9); if (c.t <= 0) { c.y = c.top; c.state = 'up'; c.t = rnd(1.6, 3.4); } }
    c.head.position.y = c.y;
  }
}

/* ---------- キック(V): 敵を蹴り飛ばす。壁に叩きつけると粉砕 ---------- */
let kickCd = 0;
function doKick() {
  if (kickCd > 0 || P.lockT > 0 || insp.on) return; kickCd = 0.7;
  camera.getWorldPosition(_o); camera.getWorldDirection(_d); const fwd = new THREE.Vector3(_d.x, 0, _d.z).normalize();
  vmSwitch = 0.3; startKickAnim(); kick += 0.08; punchFov(5); sndKick();
  let hit = false;
  for (const e of enemies.slice()) {
    const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z, d = Math.hypot(dx, dz); if (d > 2.7 * Math.max(1, e.type.scale * 0.8) || (dx * fwd.x + dz * fwd.z) / (d || 1) < 0.45) continue;
    hit = true; e.kv = new THREE.Vector3(fwd.x, 0, fwd.z).multiplyScalar(e.type.boss ? 3 : 17); e.stun = 0.7;
    blood(new THREE.Vector3(e.pos.x, 1.1, e.pos.z), fwd, 20, 6); sndHit(e.pos);
    if (e.state !== 'alert') becomeAlert(e);
    if (e.weapon && !e.type.boss && e.hp > 28) disarmEnemy(e, fwd);   // 蹴られると武器を落とす(拾って使える)
    e.hp -= 28; if (e.hp <= 0) killEnemy(e, fwd, false, 14, false, true);
  }
  if (hit) { hitStop(0.06); shake = Math.min(0.2, shake + 0.12); }
}
// 蹴り飛ばされて飛んでいる最中の敵を動かす(壁にぶつかると粉砕)
function updateKicked(e, dt) {
  if (!e.kv || e.kv.lengthSq() < 1) { e.kv = null; return false; }
  const sc = e.type.scale, ox = e.pos.x + e.kv.x * dt, oz = e.pos.z + e.kv.z * dt; e.pos.x = ox; e.pos.z = oz; resolve(e.pos, 0.4 * sc);
  const slip = Math.hypot(e.pos.x - ox, e.pos.z - oz), sp = e.kv.length();
  if (slip > 0.015 && sp > 5.5 && !e.type.boss) {   // 壁にぶつかった
    const n = new THREE.Vector3(e.pos.x - ox, 0, e.pos.z - oz).normalize(), wp = new THREE.Vector3(ox + n.x * -0.5, 1.2, oz + n.z * -0.5);
    wallSplat(new THREE.Vector3(e.pos.x - n.x * 0.45, 1.2, e.pos.z - n.z * 0.45), n, 2.6); sndGore(true, e.pos); sndCrusherSlam(e.pos); shake = Math.min(0.3, shake + 0.18);
    killEnemy(e, e.kv.clone().normalize(), false, 13, false, true); return true;
  }
  e.kv.multiplyScalar(Math.exp(-4 * dt)); e.stun -= dt; e.phase += dt * 10; return false;
}

/* ---------- 毎フレーム ---------- */
function updateHazards(dt, wdt) {
  kickCd = Math.max(0, kickCd - dt);
  updateDoors(dt); updateBlasts(wdt); updateCrushers(wdt);
}
// 配置(読み込み時に作る)。先に、動かない壁・家具を場所ごとにまとめる
const MERGED_GROUPS = mergeStatic();
for (const d of DOOR_DEFS) makeDoor(d);
for (const [x, z] of EXPLOSIVE_DEFS) makeExplosive(x, z);
for (const [x, z] of CRUSHER_DEFS) makeCrusher(x, z);
function resetHazards() {
  for (const d of doors) { d.open = 0; d.target = 0; d.snd = false; d.lamp.material.color.setHex(0xff3322); for (const l of d.leaves) l.mesh.position.copy(l.base); if (!d.collide) { d.collide = true; boxes.push(d.box); for (const l of d.leaves) obstacleMeshes.push(l.mesh); } }
  for (const ex of explosives) if (!ex.alive) { ex.alive = true; ex.mesh.userData.explosive = ex; scene.add(ex.mesh); obstacleMeshes.push(ex.mesh); boxes.push(ex.box); }
  pendingBlasts.length = 0; for (const b of blasts) { scene.remove(b.sp); } blasts.length = 0;
  for (const c of crushers) { c.state = 'up'; c.t = rnd(0.6, 3.2); c.y = c.top; c.head.position.y = c.top; }
  chunks.forEach(m => m.visible = false); wallDecals.forEach(m => m.visible = false); sparks.forEach(m => m.visible = false);
}
