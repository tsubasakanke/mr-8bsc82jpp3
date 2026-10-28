"use strict";
/* ================= 敵: 見た目・ステルスAI・射撃・死亡 ================= */
const TYPES = {
  grunt:  { hp: 45,   speed: 3.6, walk: 1.5, kind: 'gun',   weapons: [['pistol', 0.4], ['smg', 0.35], ['shotgun', 0.25]], scale: 1,    tint: null,                 score: 100,  vr: 15 },
  guard:  { hp: 60,   speed: 3.8, walk: 1.3, kind: 'gun',   weapons: [['rifle', 0.5], ['smg', 0.5]],                      scale: 1.03, tint: [0x5a6a8a, 0.35],     score: 200,  vr: 18 },
  rusher: { hp: 30,   speed: 7.6, walk: 2.0, kind: 'melee', weapons: [], dmg: 10, rate: 0.6, range: 1.6,                   scale: 1,    tint: [0x5fae5f, 0.5],      score: 80,   vr: 12 },
  agent:  { hp: 110,  speed: 4.6, walk: 1.6, kind: 'gun',   weapons: [['rifle', 0.7], ['deagle', 0.3]],                   scale: 1.05, tint: [0x000000, 0.55],     score: 250,  vr: 20 },
  boss:   { hp: 800,  speed: 2.7, walk: 1.2, kind: 'gun',   weapons: [['rifle', 1]],                                      scale: 2.5,  tint: [0x2f4a2a, 0.55],     score: 3000, vr: 30, boss: true },   // 社長のボディガード(巨漢)
  slasher: { hp: 60, speed: 6.6, walk: 1.8, kind: 'melee', weapons: [['machete', 0.3], ['axe', 0.15], ['bat', 0.2], ['katana', 0.1], ['pipe', 0.25]], dmg: 14, rate: 0.9, range: 2.1, scale: 1.02, tint: [0xb04040, 0.45], score: 220, vr: 22 },   // 近接武器の兵(DJルーム)
  dj: { hp: 40, speed: 0, walk: 0, civ: true, dj: true, kind: 'civ', weapons: [], scale: 1.0, tint: [0xd8b030, 0.6], score: 800, vr: 0 },
  president: { hp: 45, speed: 0, walk: 0, cower: true, kind: 'cower', weapons: [],                                                    scale: 1.0,  tint: [0xe8d58c, 0.6],      score: 5000, vr: 30, president: true },   // 社長(非戦闘員)
};
[0x4a90d9, 0xd94a7a, 0x59c46a, 0xe0a030, 0x9a5ad9, 0x38c8c8, 0xe8e8e8, 0xff7a3c].forEach((c, i) => { TYPES['civ' + i] = { hp: 20, speed: 6.4, walk: 1.4, civ: true, kind: 'civ', weapons: [], scale: 0.96 + (i % 3) * 0.025, tint: [c, 0.62], score: 60, vr: 0 }; });   // 民間人(服の色いろいろ)
const ORIG = { body: 0x757575, head: 0xe7e7e7, face: 0x000000, foot: 0x4a4a4a };   // Blenderのベースカラー(線形)→sRGB
const matCache = new Map();
function charMats(T) {
  if (matCache.has(T)) return matCache.get(T);
  // 色は madnesssss.blend のマテリアルそのまま。敵タイプごとの色味は tint を混ぜるだけ
  const mk = (c, tintable = true) => { const col = new THREE.Color(c); if (T.tint && tintable) col.lerp(new THREE.Color(T.tint[0]), T.tint[1]); return new THREE.MeshLambertMaterial({ color: col }); };
  const m = { Body: mk(ORIG.body), Head: mk(ORIG.head), Face: mk(ORIG.face, false), FootL: mk(ORIG.foot), FootR: mk(ORIG.foot), _skin: mk(ORIG.head) };
  matCache.set(T, m); return m;
}
const flashTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, '#fff'); g.addColorStop(0.35, '#ffd070'); g.addColorStop(1, 'rgba(255,120,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
})();
function pickWeapon(list) { if (!list.length) return null; let r = Math.random(); for (const [id, p] of list) { if ((r -= p) <= 0) return id; } return list[0][0]; }

// 輪郭線(裏面を黒く膨らませる)。Madness Combat らしい黒フチ
const outlineMat = new THREE.ShaderMaterial({
  uniforms: { t: { value: 0.11 } }, side: THREE.BackSide,
  vertexShader: 'uniform float t; void main(){ vec3 p = position + normal * t; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
  fragmentShader: 'void main(){ gl_FragColor = vec4(0.015, 0.015, 0.02, 1.0); }',
});
function addBossArmor(N) {   // 巨漢のゴツい見た目: 体を太く、肩パッド・胸甲・ヘルメット・ベルト・でかい手足
  const dark = cachedMat('lambert', 0x24272d), steel = cachedMat('lambert', 0x5a606c), strap = cachedMat('lambert', 0x121317), brass = cachedMat('lambert', 0xb08a2a);
  N.Body.scale.set(1.5, 1.1, 1.55); N.FootL.scale.set(1.4, 1.35, 1.5); N.FootR.scale.set(1.4, 1.35, 1.5); N.HandL.scale.setScalar(1.55); N.HandR.scale.setScalar(1.55);
  const arm = new THREE.Group(); arm.scale.set(1 / 1.5, 1 / 1.1, 1 / 1.55); N.Body.add(arm);
  const mk = (geo, mat, x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (sx) m.scale.set(sx, sy, sz); arm.add(m); return m; };
  for (const sz of [-1, 1]) { mk(new THREE.SphereGeometry(1.15, 14, 10), dark, 0, 2.05, sz * 2.25, 1.0, 0.78, 1.1); mk(new THREE.SphereGeometry(0.9, 12, 8), steel, 0.15, 2.3, sz * 2.3, 1.0, 0.45, 1.0); }   // 肩パッド(2段)
  mk(new THREE.BoxGeometry(0.55, 3.0, 3.4), steel, 1.65, 0.7, 0);                      // 胸甲
  mk(new THREE.BoxGeometry(0.4, 0.5, 3.6), dark, 1.78, 1.9, 0);                         // 胸甲の上縁
  mk(new THREE.CylinderGeometry(2.35, 2.35, 0.7, 18), strap, 0, -1.25, 0);              // ベルト
  mk(new THREE.BoxGeometry(0.5, 0.5, 0.5), brass, 2.4, -1.25, 0);                       // バックル
  for (const sz of [-1.1, 0, 1.1]) mk(new THREE.BoxGeometry(0.5, 0.9, 0.7), dark, 2.35, -2.0, sz);   // 弾薬ポーチ
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(1.72, 20, 12, 0, Math.PI * 2, 0, 1.0), dark); helmet.scale.set(1.08, 1.15, 1.12); helmet.position.set(0, 0.2, 0); N.Head.add(helmet);   // ヘルメット
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(1.78, 1.78, 0.22, 20), steel); brim.scale.set(1.08, 1, 1.12); brim.position.set(0, 0.86, 0); N.Head.add(brim);
}
function addPresidentLook(N) {   // 社長: 赤いネクタイと金のカフス
  const tie = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.1, 0.55), cachedMat('lambert', 0xa31515)); tie.position.set(1.42, 0.7, 0); N.Body.add(tie);
  const knot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.7), cachedMat('lambert', 0x7a0e0e)); knot.position.set(1.45, 1.8, 0); N.Body.add(knot);
}
const enemies = [];
const HOLD = new THREE.Vector3(3.3, 4.7, 0.55), HK = 1 / 0.085;   // 敵モデル空間での右手グリップ位置 / 銃単位→敵モデル単位
const _eq = new THREE.Quaternion(), _eq2 = new THREE.Quaternion(), _ev = new THREE.Vector3();
function spawnEnemy(type, x, z, opt) {
  opt = opt || {};
  const T = TYPES[type], M = charMats(T), root = MODEL_LOD.clone(true), N = {}, wrap = new THREE.Group();
  root.traverse(o => { N[o.name] = o; if (o.isMesh) o.material = M[o.name] || M._skin; });
  root.rotation.y = -Math.PI / 2; root.scale.setScalar(S0); wrap.add(root);
  if (T.boss) addBossArmor(N); if (T.president) addPresidentLook(N);
  const outlines = []; for (const n of ['Body', 'Head', 'FootL', 'FootR', 'HandL', 'HandR']) { const o = new THREE.Mesh(N[n].geometry, outlineMat); N[n].add(o); outlines.push(o); }
  wrap.rotation.order = 'YXZ'; wrap.scale.setScalar(T.scale); wrap.position.set(x, 0, z); scene.add(wrap);
  const weapon = opt.weapon || (T.weapons && T.weapons.length ? pickWeapon(T.weapons) : null), wd = weapon ? WDEF[weapon] : null;
  let gun = null, flash = null;
  if (wd) {
    gun = gunNode(wd.model, true); gun.scale.setScalar(wd.K * HK); root.add(gun);
    if (!wd.melee) flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    if (flash) { flash.scale.setScalar(wd.supp ? 1.2 : 4.2); flash.visible = false; root.add(flash); }
  }
  const parts = [N.Body, N.Head, N.Face, N.FootL, N.FootR, N.HandL, N.HandR];
  const yaw = opt.yaw !== undefined ? opt.yaw : rnd(0, 6.28);
  const e = { g: wrap, N, type: T, name: type, parts, head: N.Head, pos: wrap.position, hp: T.hp, phase: rnd(0, 6), mv: 0, fire: 0, aim: 0,
              weapon, wd, gunN: gun, flash, state: opt.state || 'idle', detect: 0, sees: false, visT: rnd(0, 0.2), yaw, baseYaw: yaw, seed: rnd(0, 6),
              route: opt.route || null, ri: 0, wait: 0, post: !!opt.post, target: null, lookT: 0, pendingAlert: -1,
              t: rnd(0.4, 1.2), burstLeft: 0, gapT: 0, desired: rnd(8, 14), strafe: Math.random() < 0.5 ? 1 : -1, dead: false };
  if (wd && !wd.melee) e.desired = { pistol: rnd(8, 13), smg: rnd(6, 10), shotgun: rnd(4, 8), rifle: rnd(14, 22), deagle: rnd(10, 16) }[weapon] * (T.boss ? 1.2 : 1);
  wrap.rotation.y = yaw; e.fingers = []; e.outlines = outlines; root.traverse(o => { if (/^[LR]_[tf]\d+$/.test(o.name)) e.fingers.push(o); }); e.far = false;
  parts.forEach(p => { p.enemy = e; p.isHead = (p === N.Head || p === N.Face); });
  if (T.civ) e.civ = { mode: 'dance', t: 0, ph: rnd(0, 6), yaw0: yaw, rt: null, rtt: 0 };
  enemies.push(e); animEnemy(e, 0, false); return e;
}

/* ---------- ポーズ: 歩き・銃の構え・反動 ---------- */
function handPose(n, x, y, z, pitch) { n.position.set(x, y, z); n.quaternion.setFromAxisAngle(AZ, pitch).multiply(REST[n.name].q); }
function cowerPose(e) {   // 頭を抱えて、うずくまる(ガタガタ震える)
  const N = e.N, tm = performance.now() / 1000, tr = Math.sin(tm * 41) * 0.06, sink = 1.7;
  for (const n of ['Body', 'Head', 'Face']) N[n].position.y = REST[n].p.y - sink + tr;
  for (const [n, sg] of [['FootL', 1], ['FootR', -1]]) { const r = REST[n].p; N[n].position.set(r.x + 1.2, r.y + 0.1, r.z + sg * 0.4); }
  handPose(N.HandR, 1.5, 5.6 + tr, 1.35, 1.35); handPose(N.HandL, 1.5, 5.6 - tr, -1.35, 1.35); setCurl(N, 'R', 1.1); setCurl(N, 'L', 1.1);
  e.g.rotation.x = 0.28 + tr * 0.4; e.g.position.y = 0;
}
function animEnemy(e, dt, moving) {
  const N = e.N, T = e.type, wd = e.wd;
  if (T.cower) { cowerPose(e); return; }
  if (T.civ && e.civ) { animCiv(e, dt, moving); return; }
  e.mv += ((moving ? 1 : 0) - e.mv) * Math.min(1, dt * 10); e.fire = Math.max(0, e.fire - dt * (wd && wd.melee ? 3.4 : 7));
  e.aim += ((e.state === 'alert' ? 1 : 0) - e.aim) * Math.min(1, dt * 5);
  const s = Math.sin(e.phase), c = Math.cos(e.phase), bob = Math.abs(c) * 0.3 * e.mv;
  for (const n of ['Body', 'Head', 'Face']) N[n].position.y = REST[n].p.y + bob;
  for (const [n, sg] of [['FootL', 1], ['FootR', -1]]) { const r = REST[n].p; N[n].position.set(r.x + s * sg * 1.5 * e.mv, r.y + Math.max(0, c * sg) * 0.7 * e.mv, r.z); }
  if (wd) {
    // 構え: 警戒前は銃口を下げた「ローレディ」、戦闘中は構える。撃つと銃口が跳ね上がって後ろに引ける
    const low = 1 - e.aim, mel = wd.melee, th = mel ? (e.fire > 0 ? (e.fire * 2 - 1) * 1.25 : -0.5 * low + 0.25) : -0.55 * low + e.fire * 0.3, back = mel ? 0 : e.fire * 1.0 + low * 0.5;   // 近接: 振りかぶる(fire 1→0.5)→振り下ろす
    const bx = HOLD.x - back, by = HOLD.y - low * 0.7, cs = Math.cos(th), sn = Math.sin(th);
    const toModel = rel => { const x = -rel[2] * HK, y = rel[1] * HK, z = rel[0] * HK; return _ev.set(bx + x * cs - y * sn, by + x * sn + y * cs, HOLD.z + z); };
    e.gunN.position.set(bx, by, HOLD.z);
    e.gunN.quaternion.setFromAxisAngle(AZ, th).multiply(_eq.setFromAxisAngle(UP, -Math.PI / 2));
    for (const s2 of ['L', 'R']) {
      const hd = wd.hands.find(h => h.s === s2), hn = N['Hand' + s2];
      if (!hd) { handPose(hn, 2.2, 4.2, s2 === 'L' ? -1.2 : 1.2, 0); setCurl(N, s2, 0.5); continue; }
      hn.position.copy(toModel(palmRel(hd)));
      handBasisQuat(_eq2, hd); hn.quaternion.setFromAxisAngle(AZ, th).multiply(_eq2);
      setCurl(N, s2, hd.curl, hd.trig ? hd.curl * 0.45 + e.fire * 0.8 : undefined);
    }
    if (e.flash && !wd.melee) { const m = wd.muzzleRel; e.flash.position.copy(toModel([m.x, m.y, m.z])); e.flash.visible = e.fire > 0.7; }
  } else {
    const sw = e.state === 'alert' ? s * 1.4 : s * 0.5;
    handPose(N.HandR, 3.0 + sw, 5.0 + c * 0.3, 1.5, 0.3 + sw * 0.1); handPose(N.HandL, 3.0 - sw, 5.0 - c * 0.3, -1.5, 0.3 - sw * 0.1);
    setCurl(N, 'R', 0.35 + e.fire * 0.8); setCurl(N, 'L', 0.35 + e.fire * 0.8);
  }
}

/* ---------- ステルス: 物音・発見 ---------- */
function disarmEnemy(e, dir) {   // 武器を落とさせる。以後は素手で殴りかかってくる
  if (!e.weapon || e.unarmed) return; const w = WDEF[e.weapon];
  dropGun(e.weapon, e.pos.x, e.pos.z, w.melee ? 0 : Math.round(w.give * rnd(0.6, 1.2)), new THREE.Vector3(dir.x * 3 + rnd(-1, 1), rnd(2, 3.5), dir.z * 3 + rnd(-1, 1)));
  if (e.gunN) e.gunN.visible = false; if (e.flash) e.flash.visible = false; e.weapon = null; e.wd = null; e.unarmed = true; showMsg('DISARM', false, '#ff9');
}
function becomeAlert(e, quiet) {
  if (e.state === 'alert' || e.dead || e.type.cower || e.type.civ) return;   // 社長は戦わない(見つかっても警報は鳴らない)
  e.state = 'alert'; e.detect = 1; e.t = rnd(0.5, 1.0); e.burstLeft = 0;
  if (!quiet && !S.alerted) { S.alerted = true; showMsg('見つかった！', true); }
  if (!quiet) triggerAlarm();
  for (const o of enemies) if (o !== e && o.state !== 'alert' && Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) < 14) o.pendingAlert = rnd(0.3, 1.1);
}
function makeNoise(pos, radius) {
  if (radius <= 0) return;
  for (const e of enemies) {
    if (e.type.civ) { if (radius >= 20 && Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z) < radius * 1.3) civPanic(e); continue; }
    if (e.state === 'alert' || e.type.cower) continue;
    const d = Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z); if (d > radius) continue;
    if (d < radius * 0.3) becomeAlert(e); else { e.state = 'search'; e.target = new THREE.Vector3(pos.x, 0, pos.z); e.detect = Math.max(e.detect, 0.45); e.lookT = 0; }
  }
}
/* ---------- フィニッシャー(武器ごとの専用キル) ----------
   ev = [時刻, 出来事, 引数] の時刻表。自分が敵のすぐ近くへ寄り、出来事のたびに血・ぶれ・FOV・スロー・ヒットストップを入れる。
   出来事: stab 刺す / smash 殴る(±向き) / shot 撃つ(部位) / knees 膝をつく / headoff 頭が飛ぶ / launch 吹き飛ばす / spin 回す / fall 倒れ始める(秒) / slow スロー(秒) / whip 頭がのけぞる */
const FIN = {
  knife:   { dur: 2.2, cost: 0, name: 'STEALTH KILL', dist: 1.0, hands: 'neck', grab: [[0.04, 1.3, 'mouth', 'mouth']], score: 300, ev: [[0.28, 'stab', 0], [0.52, 'stab', 1], [0.78, 'stab', 2], [0.78, 'slow', 0.5], [1.1, 'knees'], [1.3, 'fall', 0.75]] },
  pistol:  { dur: 2.8, cost: 3, name: 'EXECUTION',    dist: 1.5, hands: 'up', grab: [[0.62, 2.4, 'head', 'face']], tilt: [0.62, 2.4],    score: 300, ev: [[0.25, 'shot', 'knee'], [0.25, 'knees'], [0.55, 'shot', 'knee'], [1.4, 'slow', 0.8], [1.55, 'shot', 'head'], [1.55, 'carve', 'top:0.55'], [1.55, 'whip', -1.3], [1.6, 'fall', 0.9]] },
  smg:     { dur: 2.5, cost: 7, name: 'FULL AUTO',    dist: 1.3, hands: 'flail', grab: [[0.05, 1.1, 'shoulder', 'shoulder']], score: 350, ev: [[0.22, 'shot', 'chest'], [0.23, 'carve', 'chest:0.15'], [0.3, 'shot', 'chest'], [0.31, 'carve', 'chest:0.3'], [0.38, 'shot', 'chest'], [0.39, 'carve', 'chest:0.45'], [0.46, 'shot', 'chest'], [0.47, 'carve', 'chest:0.6'], [0.54, 'shot', 'chest'], [0.55, 'carve', 'chest:0.75'], [0.62, 'shot', 'chest'], [0.63, 'carve', 'chest:0.9'], [0.7, 'shot', 'chest'], [0.71, 'carve', 'chest:1.0'], [0.5, 'slow', 0.7], [0.95, 'launch', 11], [0.95, 'fall', 0.38]] },
  shotgun: { dur: 3.0, cost: 1, name: 'BOOM',         dist: 1.0, hands: 'barrel', score: 500, ev: [[0.95, 'shot', 'head'], [0.95, 'carve', 'face:0.95'], [0.95, 'launch', 8], [0.95, 'slow', 0.65], [0.95, 'fall', 0.5]] },
  rifle:   { dur: 3.0, cost: 1, name: 'SMASH',        dist: 1.5, hands: 'face', grab: [[0.95, 2.2, 'shoulder', 'shoulder']],  score: 400, ev: [[0.32, 'smash', 1], [0.85, 'smash', -1], [0.85, 'knees'], [1.55, 'shot', 'chest'], [1.55, 'carve', 'chest:0.7'], [1.55, 'launch', 10], [1.55, 'slow', 0.55], [1.55, 'fall', 0.45]] },
  deagle:  { dur: 2.3, cost: 1, name: 'ONE SHOT',     dist: 1.5, hands: 'flail', grab: [[0.05, 1.0, 'head', 'face']], tilt: [0.05, 0.6], score: 500, ev: [[0.5, 'shot', 'head'], [0.5, 'carve', 'top:0.9'], [0.5, 'launch', 7], [0.5, 'spin', 14], [0.5, 'slow', 0.6], [0.5, 'fall', 0.5]] },
};
const dying = [], corpses = [];
/* ---------- 真っ二つ: 敵をもう1体コピーして、左半分/右半分をクリップで切り分け、左右に倒す ---------- */
function bisectEnemy(e) {
  if (e.twin) return; const g2 = e.g.clone(true); scene.add(g2); e.twin = g2;
  const mkHalf = (grp, sign) => {
    let root = null; grp.traverse(o => { if (!root && o.name === 'Root') root = o; }); if (!root) return;
    const wp = [new THREE.Plane()], lp = [new THREE.Plane()], mk = () => (n, c) => 0;
    const planes = () => [[0, 0, sign, 0, 0, 0]];
    const skin = new Map(); root.traverse(o => {
      if (!o.isMesh) return; if (o.material && o.material.type === 'ShaderMaterial') { o.visible = false; return; }   // 輪郭線は切り口で変になるので消す
      const m = o.material.clone(); m.clippingPlanes = wp; m.side = THREE.DoubleSide; o.material = m;
      if (o.name === 'Body' || o.name === 'Head') { const f = new THREE.Mesh(o.geometry, cmat(CM.flesh, THREE.BackSide, wp, false)); f.userData.carveChild = true; f.frustumCulled = false; o.add(f);
        if (o.name === 'Body') { const bone = cmat(CM.bone, THREE.FrontSide, wp, false); for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 2.5), bone); b.position.set(0.55, -2.2 + i * 0.62, 0); b.userData.carveChild = true; o.add(b); } const sp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.4, 0.3), bone); sp.position.set(-0.55, -1.2, 0); o.add(sp); } }
    });
    carved.push({ node: root, kind: 'bisect', o: {}, lp, wp, depth: 1, make: planes });
  };
  mkHalf(e.g, 1); mkHalf(g2, -1); e.sep = 0; e.twinPairs = []; { const a = [], b = []; e.g.traverse(o => a.push(o)); g2.traverse(o => b.push(o)); for (let i = 0; i < a.length && i < b.length; i++) if (!a[i].isMesh && a[i].name) e.twinPairs.push([a[i], b[i]]); }   // 骨(ノード)の動きも本体に合わせる
}
function syncTwin(e) {   // もう半分を、本体と同じ姿勢+左右に開かせる
  const t = e.twin; if (!t) return; let root = null; e.g.traverse(o => { if (!root && o.name === 'Root') root = o; });
  const side = new THREE.Vector3(0, 0, 1).transformDirection(root.matrixWorld).setY(0).normalize(), sep = e.sep || 0;
  for (const [s, d] of e.twinPairs || []) { if (s === e.g) continue; d.position.copy(s.position); d.quaternion.copy(s.quaternion); }
  t.position.copy(e.g.position).addScaledVector(side, -0.3 * sep * 2); t.rotation.order = 'YXZ'; t.rotation.set(e.g.rotation.x, e.g.rotation.y, -e.g.rotation.z - 0.0, 'YXZ'); t.visible = e.g.visible;
  e.g.position.addScaledVector(side, 0.3 * sep * 0 + 0);
}
function fullHeal() { if (P.hp < P.maxHp * 0.92) { healFlash(); sndHeal(); } P.hp = P.maxHp; }
function startFinisher(e, kind) {
  kind = kind || 'knife'; const F = FIN[kind], sc = e.type.scale, mt = madTier();
  enemies.splice(enemies.indexOf(e), 1); e.dead = true; e.dyT = 0; e.dropped = false; e.finKind = kind; e.headGone = false; e.evIdx = 0; e.mt = mt; e.burst = false; dying.push(e);
  e.ev = F.ev.slice();   // 狂気度が高いほど、追加の演出(手足を全部もぐ / 体が破裂)が付く
  if (mt >= 1) e.ev.push([F.dur - 1.0, 'limbs']); if (mt >= 2) e.ev.push([F.dur - 0.5, 'burst']); e.ev.sort((a, b) => a[0] - b[0]);
  // 倒れる向き: 自分から離れる方向(敵の正面と同じ向きなら前のめり、逆なら後ろへ)
  const ax = e.pos.x - P.pos.x, az = e.pos.z - P.pos.z, ad = Math.hypot(ax, az) || 1; e.away = new THREE.Vector3(ax / ad, 0, az / ad);
  e.fdir = (Math.sin(e.yaw) * e.away.x + Math.cos(e.yaw) * e.away.z) >= 0 ? 1 : -1;
  Object.assign(e, { kneel: 0, kneelT: 0, fallStart: null, fallDur: 0.7, fall: 0, jerk: 0, whip: 0, fv: null, spin: 0, spinAng: 0, hop: 0, launchT: 0, wallHit: false, bleedT: 0, handMode: F.hands });
  S.kills++; if (e.state !== 'alert') S.stealthKills++; S.combo++; S.comboT = 2.8; S.score += e.type.score * Math.max(1, S.combo) + F.score; onSpecialKill(e);
  fullHeal(); showMsg(F.name, kind === 'shotgun' || kind === 'deagle' || kind === 'smg' || mt >= 1, mt >= 2 ? '#ff4d6a' : mt >= 1 ? '#d070ff' : (kind === 'knife' ? '#9f9' : '#fff'));
  addMadness(14 + (mt >= 1 ? 2 : 0));
  P.lockT = F.dur; P.finishTarget = e; P.finish = { kind, e, t: 0, p: 0 };
  // 自分が立つ位置: 銃口がちょうど敵の頭に触れる距離(銃ごとに銃口までの長さから計算)。ナイフは固定
  const want = MELEE.includes(kind) ? (F.dist + 0.1) * Math.max(1, sc * 0.85) : finApproach(kind, sc, 0.45 * sc);   // 銃口が頭の表面に届く距離
  e.finD = want; e.finM0 = Math.max(1, Math.min(1.8, Math.hypot(P.pos.x - e.pos.x, P.pos.z - e.pos.z) / Math.max(0.5, want)));
  { const o = new THREE.Vector3(e.pos.x, 0.9, e.pos.z); rc.set(o, new THREE.Vector3(e.away.x, 0, e.away.z)); rc.far = 1.7; const h = rc.intersectObjects(obstacleMeshes, false)[0]; e.fallScale = h ? Math.max(0.15, (h.distance - 0.3) / 1.4) : 1; }   // 背後が壁なら、倒れ込む量を減らす
 P.finishMove = { x: e.pos.x - e.away.x * want, z: e.pos.z - e.away.z * want }; P.finishEye = 1.7; P.finishRoll = 0;
  P.finishAim = { x: e.pos.x, z: e.pos.z, y: 1.55 * sc, r: 0.45 * sc };
  punchFov(9); rollKick = (Math.random() < 0.5 ? -1 : 1) * 0.05;
}
/* フィニッシャー中のプレイヤーの動き(path): 行 [時刻, 回り込む角度(rad), 距離の倍率, 目の高さ, カメラの傾き]。なめらかにつなぐ */
const PATH_DEFAULT = [[0, 0.6, 1.7, 1.7, 0.05], [0.55, 0.42, 1, 1.7, 0.03]], PATH_MELEE = [[0, 0.4, 1.5, 1.7, 0.04], [0.4, 0, 1, 1.7, 0]];
function finPath(kind, t, e) {
  const F = FIN[kind]; let P0 = F.path || (MELEE.includes(kind) ? PATH_MELEE : PATH_DEFAULT); if (e && e.finM0) { P0 = P0.map(r => r.slice()); P0[0][2] = e.finM0; }; let a = P0[0], b = P0[P0.length - 1];   // 最初の距離は今の実距離から
  if (t <= a[0]) b = a; else if (t >= b[0]) a = b; else for (let i = 0; i < P0.length - 1; i++) if (t >= P0[i][0] && t < P0[i + 1][0]) { a = P0[i]; b = P0[i + 1]; break; }
  const u = a === b ? 0 : Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0]))), k = u * u * (3 - 2 * u), L = i => a[i] + (b[i] - a[i]) * k;
  return { ang: L(1), m: L(2), eye: L(3), roll: L(4) || 0 };
}
const ease01 = (a, b, t) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };
function finTargetY(e, part) {   // 部位ごとの高さ(膝をついたり倒れたりして下がる)
  const sc = e.type.scale, fall2 = (e.fall || 0) * (e.fall || 0), k = (e.kneel || 0) * (1 - (e.fall || 0));
  if (part === 'knee') return 0.58 * sc * (1 - k * 0.4);
  if (part === 'chest') return (1.1 - k * 0.5 - fall2 * 0.7) * sc;
  return (1.55 - k * 0.55 - fall2 * 1.25) * sc;   // head(倒れると地面近くまで下がる)
}
function finisherEvent(e, F, ev) {
  const sc = e.type.scale, fk = e.finKind, act = ev[1], arg = ev[2], aw = e.away, hy = (1.6 - e.kneel * 0.55) * sc, mt = e.mt || 0, mk = 1 + 0.45 * mt;
  const at = (y) => new THREE.Vector3(e.pos.x, y, e.pos.z), toP = new THREE.Vector3(-aw.x, 0.25, -aw.z);   // 自分のほうへ向く血しぶき
  if (act === 'stab') {      // 首を刺す: 血が自分のほうへ噴き出す。だんだん激しく
    const k = arg + 1; blood(at(1.35 * sc), toP, (30 + k * 26) * mk, 6 + k * 2); spawnChunks(at(1.35 * sc), toP, (2 + k * 2) * mk, 5);
    if (mt >= 2 && arg === 2) { finisherEvent(e, F, [ev[0], 'headoff']); } sndStab(); sndGore(false, e.pos); finPulse(1); shake = Math.min(0.22, shake + 0.06 * k); rollKick = (arg % 2 ? 1 : -1) * 0.05; screenSplat(k + (arg === 2 ? 2 : 0)); e.jerk = 1; punchFov(4 + k * 2); hitStop(arg === 2 ? 0.07 : 0.035);
    if (arg === 2) wallSprays(at(1.35 * sc), 6, 5, 1.8);
  } else if (act === 'smash') {   // 銃床で殴る: 頭が横へ吹っ飛ぶ勢いで揺れ、歯と血が飛ぶ
    e.whip = arg * 0.7; e.jerk = 1.0; blood(at(hy), new THREE.Vector3(arg * 0.8, 0.3, 0).applyAxisAngle(UP, Math.atan2(aw.x, aw.z)), 80 * mk, 9); spawnChunks(at(hy), toP, 8 * mk, 6);
    if (mt >= 2 && arg < 0) { finisherEvent(e, F, [ev[0], 'headoff']); } sndKick(); sndGore(false, e.pos); finPulse(1); shake = Math.min(0.26, shake + 0.14); rollKick = arg * -0.08; screenSplat(3); punchFov(8); hitStop(0.08); wallSprays(at(hy), 5, 5, 1.6);
  } else if (act === 'shot') {    // 撃つ(音・弾・薬莢は自分側の finisherShotFx)
    finisherShotFx(fk, at(finTargetY(e, arg))); finPulse(0.6); e.jerk = 1;
    if (arg === 'knee') { blood(at(finTargetY(e, 'knee')), toP, 70, 8); spawnChunks(at(finTargetY(e, 'knee')), UP, 4, 4); sndGore(false, e.pos); }
    else if (arg === 'head') { const hp = at(finTargetY(e, 'head')); blood(hp, aw, 120 * mk, 10); wallSprays(hp, 8 + mt * 3, 6, 2.2); spawnChunks(hp, aw, 8 * mk, 7); screenSplat(3); hitStop(0.06); }
    else if (arg === 'chest') { const cp = at(finTargetY(e, 'chest')); blood(cp, aw.clone().setY(0.1), 90 * mk, 9); wallSprays(cp, 4 + mt * 2, 6, 1.6); spawnChunks(cp, aw, 5 * mk, 6); screenSplat(1); }
    else if (arg === 'limb') { popLimb(e, ['HandL', 'HandR', 'FootL', 'FootR'][Math.random() * 4 | 0], aw); }
    shake = Math.min(0.26, shake + 0.08); rollKick = (Math.random() - 0.5) * 0.07; punchFov(6);
  } else if (act === 'cut') {   // 近接武器の一撃: 振り方(slash/chop/bash/low)と部位で、血・衝撃・反応を変える
    const [sty, part] = arg.split(':'), blade = !!WDEF[fk].blade, py = part === 'head' ? 'head' : part === 'neck' ? 'head' : part === 'torso' ? 'chest' : 'knee', dy = part === 'neck' ? -0.14 * sc : 0;
    const pt = at(finTargetY(e, py) + dy), side = sty === 'slashB' ? 1 : -1, sp = new THREE.Vector3(side * 0.9, 0.25, 0).applyAxisAngle(UP, Math.atan2(aw.x, aw.z)).add(toP.clone().multiplyScalar(0.6));
    const n = (part === 'head' ? 130 : part === 'neck' ? 110 : part === 'torso' ? 85 : 60) * mk * (blade ? 1 : 0.8);
    blood(pt, sp, n, 8 + (part === 'head' ? 3 : 0)); spawnChunks(pt, sp, (blade ? 4 : 6) * mk + (part === 'head' ? 4 : 0), 6); wallSprays(pt, 4 + mt * 2 + (part === 'head' ? 4 : 0), 6, 1.8);
    if (!blade) { e.whip = side * 0.9; spawnChunks(pt, toP, 6, 7); }   // 殴打: 頭や体が派手にのけぞる(歯・骨のかけら)
    else e.whip = sty === 'chop' ? 0.1 : side * 0.5;
    e.jerk = sty === 'chop' ? 1.5 : 1.15; blade ? (sndStab(), sndGore(false, e.pos)) : (sndKick(), sndGore(false, e.pos)); finPulse(1);
    shake = Math.min(0.3, shake + (sty === 'chop' || sty === 'bash' ? 0.16 : 0.09)); rollKick = side * 0.07 * (sty === 'low' ? 0.4 : 1); screenSplat(part === 'head' || part === 'neck' ? 3 : 2); punchFov(sty === 'chop' ? 9 : 6); hitStop(sty === 'chop' || sty === 'bash' ? 0.09 : 0.055);
    if (mt >= 1 && part === 'torso') popLimb(e, ['HandL', 'HandR', 'FootL', 'FootR'][Math.random() * 4 | 0], aw);
    if (mt >= 2 && ev[0] > 1.0 && part !== 'knee') finisherEvent(e, F, [ev[0], 'headoff']);
  } else if (act === 'throw') { finThrowProp(fk, e);   // 拳銃を敵の顔へ投げつける
  } else if (act === 'hitprop') {   // 投げた銃が顔面に当たる: のけぞって倒れる
    const hp = at(finTargetY(e, 'head')); blood(hp, toP, 60 * mk, 7); spawnChunks(hp, toP, 3, 5); sndHit(e.pos); sndKick(); e.whip = -1.6; e.jerk = 1.3; hitStop(0.05); shake = Math.min(0.2, shake + 0.12); punchFov(6); rollKick = 0.08; screenSplat(1);
  } else if (act === 'pickup') { finPickupProp();
  } else if (act === 'kick') {   // 蹴り飛ばす
    startKickAnim(); sndKick(); sndGore(false, e.pos); const cp = at(1.0 * sc); blood(cp, aw, 110 * mk, 10); wallSprays(cp, 6, 6, 2); hitStop(0.09); shake = Math.min(0.32, shake + 0.2); punchFov(10); rollKick = -0.07; screenSplat(2); e.jerk = 1.4;
  } else if (act === 'bisect') {   // 真っ二つ
    bisectEnemy(e); const cp = at(1.0 * sc); blood(cp, UP, 260 * mk, 12); wallSprays(cp, 12, 7, 2.4); spawnChunks(cp, UP, 20 + mt * 6, 8); sndGore(true, e.pos); sndStab(); screenSplat(4); hitStop(0.12); shake = Math.min(0.34, shake + 0.22); punchFov(12); e.whip = 2.6; e.jerk = 1.0;
    e.fallStart = ev[0] + 0.3; e.fallDur = 0.9; e.kneelT = 1;
  } else if (act === 'carve') {   // 部位損壊: 頭・胴を切り取って、中身(肉・骨・脳・肋骨)を見せる
    const [kind, d] = arg.split(':'); carve(kind === 'chest' ? e.N.Body : e.N.Head, kind, +d);
    const hp = at(finTargetY(e, kind === 'chest' ? 'chest' : 'head')); blood(hp, UP, 40 * mk, 8); spawnChunks(hp, aw.clone().setY(0.6).normalize(), 5 + mt * 3, 7);
  } else if (act === 'knees') { e.kneelT = 1; }
  else if (act === 'limbs') { for (const nm of ['HandL', 'HandR', 'FootL', 'FootR']) if (Math.random() < 0.85) popLimb(e, nm, aw); }
  else if (act === 'burst') { bodyBurst(e); }
  else if (act === 'headoff') {   // 頭が吹き飛び、首から血の噴水
    if (e.headGone) return; e.headGone = true; e.bleedT = ev[0]; e.g.updateMatrixWorld(true);
    spawnGib(e.N.Head, new THREE.Vector3(aw.x * 5 + rnd(-1.5, 1.5), rnd(6, 9), aw.z * 5 + rnd(-1.5, 1.5)), e.N.Face); e.N.Head.visible = false; e.N.Face.visible = false;
    blood(at(hy), UP, 320, 13); wallSprays(at(hy), 12, 7, 2.6); spawnChunks(at(hy), aw.clone().setY(0.8).normalize(), 18 + mt * 6, 8); sndGore(true, e.pos); screenSplat(3); hitStop(0.1); shake = Math.min(0.3, shake + 0.2); punchFov(12);
  } else if (act === 'launch') {  // 体ごと吹っ飛ばす
    e.fv = aw.clone().multiplyScalar(arg); e.launchT = 0; e.hop = 1;
  } else if (act === 'spin') { e.spin = arg * (Math.random() < 0.5 ? -1 : 1); }
  else if (act === 'fall') { e.fallStart = ev[0]; e.fallDur = arg; }
  else if (act === 'slow') { S.finSlow = Math.max(S.finSlow || 0, arg); }
  else if (act === 'whip') { e.whip = arg; }
}
function bodyBurst(e) {   // 狂気: 体が内側から破裂して、パーツと肉片が四方に飛び散る
  const sc = e.type.scale, p0 = at0(e, 1.0 * sc); e.g.updateMatrixWorld(true);
  for (const nm of ['Body', 'Head', 'FootL', 'FootR', 'HandL', 'HandR']) { const n = e.N[nm]; if (!n.visible) continue; spawnGib(n, new THREE.Vector3(rnd(-1, 1) * 6, rnd(5, 10), rnd(-1, 1) * 6), nm === 'Head' ? e.N.Face : null); }
  e.burst = true; e.g.visible = false; if (e.twin) e.twin.visible = false; goreBurst(p0, UP, true); spawnChunks(p0, UP, 60, 11); wallSprays(p0, 14, 8, 2.8); blood(p0, UP, 300, 13); sndGore(true, e.pos); sndExplosion(e.pos); screenSplat(3); hitStop(0.11); shake = Math.min(0.34, shake + 0.25); punchFov(15); rollKick = (Math.random() - 0.5) * 0.14;
}
function updateDying(dt) {
  for (let i = dying.length - 1; i >= 0; i--) {
    const e = dying[i], N = e.N, sc = e.type.scale, F = FIN[e.finKind || 'knife'], fd = e.fdir; e.dyT += dt; const t = e.dyT;
    while (e.evIdx < e.ev.length && t >= e.ev[e.evIdx][0]) finisherEvent(e, F, e.ev[e.evIdx++]);
    if (P.finish && P.finish.e === e) P.finish.t = t;
    // ---- 状態の更新 ----
    e.kneel += (e.kneelT - e.kneel) * Math.min(1, dt * 11); e.jerk *= Math.exp(-dt * 13); e.whip *= Math.exp(-dt * 3.2);
    e.fall = e.fallStart === null ? 0 : Math.max(0, Math.min(1, (t - e.fallStart) / e.fallDur)); const fall2 = e.fall * e.fall;
    // 吹っ飛び: 壁にぶつかると粉砕の血
    if (e.fv) {
      e.launchT += dt; const sp = e.fv.length(), ox = e.pos.x + e.fv.x * dt, oz = e.pos.z + e.fv.z * dt; e.pos.x = ox; e.pos.z = oz; resolve(e.pos, 0.4 * sc);
      if (!e.wallHit && sp > 3.5 && Math.hypot(e.pos.x - ox, e.pos.z - oz) > 0.012) {
        e.wallHit = true; const wn = new THREE.Vector3(e.pos.x - ox, 0, e.pos.z - oz).normalize(); wallSplat(new THREE.Vector3(e.pos.x - wn.x * 0.5, 1.2, e.pos.z - wn.z * 0.5), wn, 3.0); wallSprays(at0(e, 1.2), 7, 5, 2.0);
        sndCrusherSlam(e.pos); sndGore(true, e.pos); shake = Math.min(0.32, shake + 0.2); hitStop(0.07); screenSplat(2); spawnChunks(at0(e, 1.0), wn, 14, 8); e.fv.multiplyScalar(0.15);
      }
      e.fv.multiplyScalar(Math.exp(-dt * 2.6)); if (e.launchT < 0.6 && Math.random() < dt * 40) blood(at0(e, 1.0), e.away, 5, 4);   // 吹っ飛びながら血を撒く
      if (sp < 0.6) e.fv = null;
    }
    e.spinAng += e.spin * dt; e.spin *= Math.exp(-dt * 2.4);
    // ---- 手の動き ----
    const ha = Math.min(1, t / 0.25), mode = e.handMode, tw = Math.sin(t * 36) * 0.5;
    if (e.headGone || mode === 'flail') { handPose(N.HandR, 2.4 + tw * 0.8, 5.6 + tw * 0.5, 2.0 + tw * 0.5, 0.5 + tw * 0.4); handPose(N.HandL, 2.4 - tw * 0.8, 5.6 - tw * 0.5, -2.0 - tw * 0.5, 0.5 - tw * 0.4); setCurl(N, 'R', 0.4); setCurl(N, 'L', 0.4); }
    else if (mode === 'neck') { const k = t < 0.45 ? 0 : 1; handPose(N.HandR, 1.7 + 1.3 * (1 - k), 5.75 - 0.75 * (1 - k), 0.75, 1.1 * k); handPose(N.HandL, 1.7 + 1.3 * (1 - k), 5.75 - 0.75 * (1 - k), -0.75, 1.1 * k); setCurl(N, 'R', 1.2); setCurl(N, 'L', 1.2); }
    else if (mode === 'up') { handPose(N.HandR, 1.6, 5.2 + 2.3 * ha, 1.3, 1.2 * ha); handPose(N.HandL, 1.6, 5.2 + 2.3 * ha, -1.3, 1.2 * ha); setCurl(N, 'R', 0.15); setCurl(N, 'L', 0.15); }
    else { handPose(N.HandR, 2.1, 6.4, 0.8, 1.35 * ha); handPose(N.HandL, 2.1, 6.4, -0.8, 1.35 * ha); setCurl(N, 'R', 0.9); setCurl(N, 'L', 0.9); }
    if (mode === 'wound') { const tw3 = Math.sin(t * 40) * 0.12; if (t < 0.5) { handPose(N.HandR, 2.4, 6.4, 1.2, 1.2); handPose(N.HandL, 2.4, 6.4, -1.2, 1.2); setCurl(N, 'R', 0.3); setCurl(N, 'L', 0.3); } else if (t < 1.1) { handPose(N.HandR, 2.5 + tw3, 3.9, 0.55, 0.6); handPose(N.HandL, 2.5 - tw3, 3.9, -0.55, 0.6); setCurl(N, 'R', 1.1); setCurl(N, 'L', 1.1); } else { handPose(N.HandR, 2.2 + tw, 5.6 + tw * 0.5, 2.0, 0.5 + tw * 0.4); handPose(N.HandL, 2.2 - tw, 5.6 - tw * 0.5, -2.0, 0.5 - tw * 0.4); } }   // 刺された所(胸)を両手で押さえる → 蹴られて手を広げる
    if (mode === 'barrel') { const tw2 = Math.sin(t * 52) * 0.25 * (t < 0.95 ? 1 : 0), cl = 0.95; handPose(N.HandR, 3.4 + tw2, 6.2 + tw2 * 0.5, 0.65, 0.25); handPose(N.HandL, 3.9 - tw2, 5.7, -0.65, 0.25); setCurl(N, 'R', cl); setCurl(N, 'L', cl); }   // ショットガンの銃身を必死につかんで押し返す
    { const tl = F.tilt && t >= F.tilt[0] && t < F.tilt[1] && !e.headGone ? 0.6 : 0; e.headTilt = (e.headTilt || 0) + (tl - (e.headTilt || 0)) * Math.min(1, dt * 10); }
    if (e.gunN && t > 0.3) e.gunN.visible = false; if (e.flash) e.flash.visible = false;
    if (!e.dropped && t > 0.5 && e.weapon) {
      e.dropped = true; const w = WDEF[e.weapon];
      dropGun(e.weapon, e.pos.x, e.pos.z, Math.round(w.give * rnd(0.6, 1.2)), new THREE.Vector3(e.away.x * 2 + rnd(-0.6, 0.6), rnd(2, 3.2), e.away.z * 2 + rnd(-0.6, 0.6)));
    }
    // ---- 出血(首・刺し傷) ----
    if (e.headGone && t < e.bleedT + 1.8 && Math.random() < dt * 60) blood(at0(e, (1.55 - e.kneel * 0.5 - fall2 * 0.8) * sc), UP, 7, 6);
    else if (F.hands === 'neck' && e.kneelT === 0 || (F.hands === 'neck' && t < 1.9)) { if (t > 0.3 && Math.random() < dt * 34) blood(at0(e, (1.3 - e.kneel * 0.5 - fall2 * 0.7) * sc), new THREE.Vector3(-e.away.x, 0.35, -e.away.z), 5, 3.4); }
    // ---- 体の動き ----
    const lean = F.hands === 'neck' ? -0.2 * Math.sin(Math.min(1, t / 0.5) * Math.PI) * (1 - e.fall) : 0;
    e.g.rotation.order = 'YXZ'; e.g.rotation.y = e.yaw + e.spinAng;
    e.g.rotation.x = fd * (fall2 * 1.5 * (e.fallScale === undefined ? 1 : e.fallScale)) - fd * (e.hang || 0) * 0.16 + e.kneel * 0.14 * fd + fd * e.jerk * 0.28 + lean + (e.fv ? -fd * 0.4 * Math.max(0, 1 - e.launchT * 3) : 0) + Math.sin(t * 38) * 0.012 * (e.kneel > 0.5 && e.fall < 0.1 ? 1 : 0);
    e.hang = F.hang && t >= F.hang[0] && t < F.hang[1] ? Math.min(1, (t - F.hang[0]) / 0.12) : 0;   // 刺さったまま、体を折って刃に寄りかかる
    e.g.rotation.z = e.whip * (1 - e.fall) * 0.38 + (e.headGone ? Math.sin(t * 29) * 0.03 * (1 - e.fall) : 0);
    if (e.twin) e.sep = Math.min(1, (e.sep || 0) + dt * 2.2);
    const hop = e.fv ? Math.sin(Math.min(1, e.launchT / 0.55) * Math.PI) * 0.55 : 0;
    e.g.position.y = ((fall2 * 0.3 - e.kneel * 0.5 * (1 - e.fall)) * sc) + hop;   // 倒れたら体の厚みの分だけ持ち上げる(寝た体が床にめり込まない)
    e.g.updateMatrixWorld(true); if (e.twin) syncTwin(e);
    const sink = Math.max(e.kneel, Math.min(1, e.fall * 2));
    for (const n of ['Body', 'Head', 'Face']) N[n].position.y = REST[n].p.y - sink * 1.2 + (n !== 'Body' ? -e.jerk * 0.25 : 0);
    if (e.headTilt > 0.01) { const th = e.headTilt; N.Head.quaternion.setFromAxisAngle(AZ, th).multiply(REST.Head.q); N.Face.quaternion.setFromAxisAngle(AZ, th).multiply(REST.Face.q); N.Face.position.x = REST.Face.p.x - 1.43 * (1 - Math.cos(th)); N.Face.position.y += 1.43 * Math.sin(th); } else if (e.headTilt !== undefined && e.headTilt !== 0) { e.headTilt = 0; N.Head.quaternion.copy(REST.Head.q); N.Face.quaternion.copy(REST.Face.q); }   // 頭をつかまれて、のけぞる
    const bend = Math.max(e.kneel, Math.min(1, e.fall * 1.6)); for (const [n, sg] of [['FootL', 1], ['FootR', -1]]) { const r = REST[n].p; N[n].position.set(r.x - bend * 1.0 * sg * 0.3, r.y + bend * 0.8, r.z); }
    if (P.finish && P.finish.e === e) {   // 狙う場所: 膝を撃つ間は膝、胸を撃つ時は胸、それ以外は頭(膝をつくと下がる)
      const k = e.finKind; let part = 'head';
      if (k === 'pipe' && t < 0.85) part = 'knee'; else if (k === 'smg') part = 'chest'; else if (k === 'rifle' && t > 1.7) part = 'chest';
      if (MELEE.includes(k) && k !== 'knife') { const nx = e.ev.find(x => x[1] === 'cut' && (x[0] > t - 0.2 || (x[3] && x[3] > t))); if (nx) { const pt = nx[2].split(':')[1]; part = pt === 'torso' ? 'chest' : pt === 'knee' ? 'knee' : 'head'; } }   // 次に斬る場所を見る
      const ay = Math.max(0.3, finTargetY(e, part) - (part === 'head' && MELEE.includes(k) ? 0.05 * sc : 0)); const hw = new THREE.Vector3(e.pos.x, ay, e.pos.z); if (part === 'head' && (e.fall > 0.05 || e.headTilt > 0.05)) { e.g.updateMatrixWorld(true); e.N.Head.getWorldPosition(hw); if (hw.y < 0.25) hw.y = 0.25; } P.finishAim = { x: hw.x, z: hw.z, y: part === 'head' && e.fall > 0.05 ? hw.y : ay, r: (part === 'head' ? 0.45 : part === 'chest' ? 0.38 : 0.25) * sc };
      // プレイヤーの動き: 歩いて近づき、横へ回り込み、かがむ(path)。銃は「銃口が狙う場所に届く距離」へ、近接は決まった距離へ
      let d = e.finD;
      if (!MELEE.includes(k)) {
        let R = finApproach(k, sc, P.finishAim.r); if (k === 'shotgun') R += 0.5 * (1 - ease01(0.1, 0.85, t)); if (k === 'rifle') R = 0.95 + (R - 0.95) * ease01(1.45, 1.78, t);   // ショットガンは銃身を押し込む / ライフルは殴る間だけ近い
        const ey = P.finishEye || P.eye, dy = P.pos.y + ey - ay; d = Math.sqrt(Math.max(0.04, R * R - dy * dy));
      }
      const kp = finPath(k, t, e), ax = -e.away.x, az = -e.away.z, cs = Math.cos(kp.ang), sn = Math.sin(kp.ang);
      if (e.fv && e.launchT > 0) e.launched = true;
      if (!e.launched) P.finishMove = { x: e.pos.x + (ax * cs - az * sn) * d * kp.m, z: e.pos.z + (ax * sn + az * cs) * d * kp.m }; P.finishEye = kp.eye; P.finishRoll = kp.roll;
    }
    if (t > F.dur + 0.35) {
      dying.splice(i, 1); if (e.burst) { scene.remove(e.g); if (e.twin) scene.remove(e.twin); continue; }   // 破裂した体は残らない
      e.g.rotation.x = fd * 1.5 * (e.fallScale === undefined ? 1 : e.fallScale); e.g.rotation.z = e.twin ? e.g.rotation.z : 0; e.g.position.y = 0.3 * sc; e.g.updateMatrixWorld(true); if (e.twin) syncTwin(e); corpses.push(e);
      if (corpses.length > 16) { const o = corpses.shift(); scene.remove(o.g); if (o.twin) scene.remove(o.twin); }
      splat(e.pos.x + e.away.x * 0.6, e.pos.z + e.away.z * 0.6, true); splat(e.pos.x, e.pos.z, true);
    }
  }
}
const at0 = (e, y) => new THREE.Vector3(e.pos.x, y, e.pos.z);
function stealthKill(e, dir) {
  killEnemy(e, dir, false, 2.5, true); S.stealthKills++; S.score += 300;
  showMsg('STEALTH KILL', false, '#9f9');
}
function eyeSees(e, dist, dx, dz) {
  const T = e.type; let vr = T.vr * (P.crouch ? 0.6 : 1) * (e.state === 'alert' ? 1.6 : 1);
  if (dist > vr) return false;
  if (dist > 2.2 && e.state !== 'alert') { const cosA = (Math.sin(e.yaw) * dx + Math.cos(e.yaw) * dz) / dist; if (cosA < 0.5) return false; }   // 視野は正面±60°
  _ev.set(e.pos.x, 1.5 * T.scale, e.pos.z); const to = new THREE.Vector3(P.pos.x, P.pos.y + (P.crouch ? 0.9 : 1.5), P.pos.z);
  const dir = to.clone().sub(_ev), len = dir.length(); dir.normalize(); rc.set(_ev, dir); rc.far = len;
  return rc.intersectObjects(obstacleMeshes, false).length === 0;
}

/* ---------- 敵の更新 ---------- */
function updateEnemies(dt) {
  S.detect = 0;
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i], T = e.type, sc = T.scale;
    const dx = P.pos.x - e.pos.x, dz = P.pos.z - e.pos.z, dist = Math.hypot(dx, dz) || 0.001, nx = dx / dist, nz = dz / dist;
    if (e.pendingAlert >= 0) { e.pendingAlert -= dt; if (e.pendingAlert < 0) becomeAlert(e, true); }
    if (e.kv && updateKicked(e, dt)) continue;   // 蹴り飛ばされ中(壁に当たると粉砕)
    if (T.cower) { const ddx = P.pos.x - e.pos.x, ddz = P.pos.z - e.pos.z; if (Math.hypot(ddx, ddz) < 45) e.yaw = Math.atan2(ddx, ddz); e.g.rotation.y = e.yaw; animEnemy(e, dt, false); continue; }
    if (e.stun > 0) { if (!e.kv) e.stun -= dt; e.g.rotation.y = e.yaw; animEnemy(e, dt, false); continue; }
    if (!T.civ) { e.visT -= dt; if (e.visT <= 0) { e.visT = 0.14 + Math.random() * 0.08; e.sees = eyeSees(e, dist, dx, dz); } }
    let mvx = 0, mvz = 0, spd = 0, face = e.yaw;
    if (T.civ) {   // 民間人: 踊る / 逃げる / うずくまる
      const r = civThink(e, dt, dist, dx, dz); mvx = r.x; mvz = r.z; spd = r.s; let dy2 = r.face - e.yaw; dy2 = Math.atan2(Math.sin(dy2), Math.cos(dy2)); e.yaw += Math.max(-9 * dt, Math.min(9 * dt, dy2));
    } else if (e.state !== 'alert') {
      // --- まだ気づいていない ---
      if (e.sees) {
        const rate = (0.55 + 1.6 * (1 - dist / (T.vr * (P.crouch ? 0.6 : 1)))) * (P.crouch ? 0.55 : 1) * (P.speed > 8 ? 1.6 : 1);
        e.detect += rate * dt;
      } else e.detect = Math.max(0, e.detect - dt * 0.45);
      if (e.detect >= 1) becomeAlert(e);
      S.detect = Math.max(S.detect, e.detect);
      if (e.state === 'search' && e.target) {
        const tx = e.target.x - e.pos.x, tz = e.target.z - e.pos.z, td = Math.hypot(tx, tz);
        if (td > 1.6) { mvx = tx / td; mvz = tz / td; spd = T.walk * 1.8; face = Math.atan2(tx, tz); }
        else { e.lookT += dt; face = e.baseYaw + Math.sin(e.lookT * 2) * 1.2; if (e.lookT > 3.5) { e.state = 'idle'; e.target = null; e.detect = 0; } }
      } else if (e.route) {
        const p = e.route[e.ri], tx = p[0] - e.pos.x, tz = p[1] - e.pos.z, td = Math.hypot(tx, tz);
        if (e.wait > 0) { e.wait -= dt; face = e.yaw + Math.sin(e.seed + e.wait * 2) * 0.01; }
        else if (td > 0.8) { mvx = tx / td; mvz = tz / td; spd = T.walk; face = Math.atan2(tx, tz); }
        else { e.ri = (e.ri + 1) % e.route.length; e.wait = rnd(1, 3); }
      } else { face = e.baseYaw + Math.sin(performance.now() / 1000 * 0.6 + e.seed) * 0.55; }   // 見張り: ゆっくり首を振る
      let dy = face - e.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); e.yaw += Math.max(-4 * dt, Math.min(4 * dt, dy));
    } else {
      // --- 戦闘中 ---
      e.yaw = Math.atan2(dx, dz);
      const wd = e.wd;
      if (T.kind === 'melee' || e.unarmed) { mvx = nx; mvz = nz; spd = dist > 0.95 * sc ? T.speed : 0; }   // 体の中まで入り込まない
      else if (dist > e.desired) { mvx = nx; mvz = nz; spd = T.speed; }
      else { mvx = -nz * e.strafe; mvz = nx * e.strafe; spd = T.speed * 0.5; if (Math.random() < 0.004) e.strafe *= -1; }
      e.t -= dt;
      if (T.kind === 'melee' || e.unarmed) {   // 近接(武器を落とされた敵も素手で): 振りかぶって(0.2秒後に)当たる。離れていたら空振り
        const rg = wd && wd.melee ? 2.3 : (T.range || 1.6), md = wd && wd.e ? wd.e.dmg : (T.dmg || 8), mr = wd && wd.e ? wd.e.rate : (T.rate || 0.8);
        if (e.hitT > 0) { e.hitT -= dt; if (e.hitT <= 0 && dist < rg * 1.25) { damagePlayer(md); sndKick(); } }
        else if (e.t <= 0 && dist < rg) { e.fire = 1; e.t = mr; e.hitT = wd && wd.melee ? 0.2 : 0.02; if (wd) sndSwish(); }
      } else if (wd) {
        if (e.burstLeft > 0) {
          e.gapT -= dt;
          if (e.gapT <= 0) { enemyShot(e, dist); e.burstLeft--; e.gapT = wd.e.gap; if (e.burstLeft === 0) e.t = wd.e.rate * rnd(0.9, 1.7) * (T.boss ? 0.85 : 1); }
        } else if (e.t <= 0 && dist < wd.e.range && e.sees) { e.burstLeft = wd.e.burst; e.gapT = 0; }
        else if (e.t <= 0) e.t = 0.25;
      }
    }
    if (spd) { e.pos.x += mvx * spd * dt; e.pos.z += mvz * spd * dt; }
    e.phase += spd * dt * 2.3 / sc;
    for (const o of enemies) if (o !== e) { // 敵同士の押し合い
      const ox = e.pos.x - o.pos.x, oz = e.pos.z - o.pos.z, d2 = ox * ox + oz * oz, r = 0.6 * (sc + o.type.scale) / 2;
      if (d2 < r * r && d2 > 1e-6) { const d = Math.sqrt(d2); e.pos.x += ox / d * (r - d) * 0.5; e.pos.z += oz / d * (r - d) * 0.5; }
    }
    { const pd = Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z), mn = 0.7 * sc; if (pd < mn && pd > 1e-4) { e.pos.x += (e.pos.x - P.pos.x) / pd * (mn - pd); e.pos.z += (e.pos.z - P.pos.z) / pd * (mn - pd); } }   // プレイヤーと重ならない
    resolve(e.pos, 0.4 * sc);
    e.g.rotation.y = e.yaw;
    { const zz = zoneAt(P.pos.x, P.pos.z); e.g.visible = dist < (zz === 'club' ? 64 : zz === 'outside' ? 58 : 34); }   // 遠い敵は描かない(軽量化)
    const far = dist > 17; if (far !== e.far) { e.far = far; for (const n of e.fingers) n.visible = !far && !(e.lost && false); }
    const ov = dist < 22; if (ov !== e.ov) { e.ov = ov; for (const o of e.outlines) o.visible = ov; }   // 遠くの敵は指と輪郭線を描かない(軽量化)
    animEnemy(e, dt, spd > 0.1);
  }
}
function enemyShot(e, dist) {
  const wd = e.wd, ed = wd.e, T = e.type, sc = T.scale;
  const mw = e.flash.getWorldPosition(new THREE.Vector3()), to = new THREE.Vector3(P.pos.x, P.pos.y + (P.crouch ? 0.9 : 1.4), P.pos.z);
  gunshot(e.weapon, 0.8, mw);
  e.fire = 1;
  const n = ed.pellets || 1; let hit = 0;
  for (let i = 0; i < n; i++) if (Math.random() < ed.acc) hit++;
  const dir = to.clone().sub(mw).normalize();
  tracer(mw, hit ? to : to.clone().add(new THREE.Vector3(rnd(-2, 2), rnd(-1, 1), rnd(-2, 2))), wd.supp ? 0xaaaaaa : 0xff5030, 0.08);
  if (hit) damagePlayer(ed.dmg * hit * (T.boss ? 1.0 : 1));
}

/* ---------- 被弾・死亡 ---------- */
function onSpecialKill(e) {
  if (S.mode === 'club') civScare(e.pos, 22);
  if (e.type.dj) { S.djDead = true; showMsg('DJ DOWN', true, '#ff2bd6'); S.score += 800; }
  if (e.type.president) { showMsg('社長を始末した', true, '#9f9'); missionClear(); }
  else if (e.type.boss && S.mode === 'mission') { S.bodyguardDown = true; showMsg('BODYGUARD DOWN', true); }
  else if (e.type.boss) showMsg('BOSS DOWN', true);
}
function killEnemy(e, dir, headshot, power, silent, burst) {
  if (e.dead) return; e.dead = true;
  enemies.splice(enemies.indexOf(e), 1); scene.remove(e.g); e.g.updateMatrixWorld(true);
  for (const p of [e.N.Body, e.N.Head, e.N.FootL, e.N.FootR, e.N.HandL, e.N.HandR]) {
    const v = new THREE.Vector3(rnd(-1, 1), 0, rnd(-1, 1)).multiplyScalar(2).addScaledVector(dir, power * rnd(0.5, 1.4)); v.y = rnd(2, 7) + (p === e.head && headshot ? 6 : 0);
    const gm = spawnGib(p, v, p === e.N.Head ? e.N.Face : null);
    if (headshot && p === e.N.Head && !e.type.boss) carve(gm, ['top', 'face', 'side'][Math.random() * 3 | 0], rnd(0.55, 0.9));   // 頭を撃ち抜かれた頭部は、えぐれて中身が見える
  }
  const bp = new THREE.Vector3(e.pos.x, 1.1 * e.type.scale, e.pos.z);
  blood(bp, dir, e.type.boss ? 260 : (silent ? 45 : 90), silent ? 6 : 9);
  if (headshot) { bp.y = 1.5 * e.type.scale; blood(bp, UP, 60, 10); bp.y = 1.1 * e.type.scale; }
  if (!silent || burst) goreBurst(bp, dir, !!burst || e.type.boss);   // 肉片・壁の血・床の血だまり・画面の血しぶき
  else { splat(e.pos.x, e.pos.z, true); splat(e.pos.x + rnd(-0.6, 0.6), e.pos.z + rnd(-0.6, 0.6), true); }
  if (burst) { for (const p of [e.N.Body, e.N.Head, e.N.FootL, e.N.FootR, e.N.HandL, e.N.HandR]) spawnChunks(bp, dir, 5, 8); sndGore(true, e.pos); }   // 粉砕
  if (!silent) { if (!burst) sndGore(false, e.pos); hitStop(burst ? 0.09 : 0.045); punchFov(burst ? 8 : 3); }
  if (burst && S.stage !== 'clear') showMsg(['粉砕!', 'CRUSHED!', 'SMASHED!', 'ぐちゃっ'][Math.random() * 4 | 0], false, '#f55');
  // 持ってた銃をその場に落とす
  if (e.weapon) {
    const w = WDEF[e.weapon]; dropGun(e.weapon, e.pos.x, e.pos.z, Math.round(w.give * rnd(0.6, 1.2)), new THREE.Vector3(dir.x * 2 + rnd(-1, 1), rnd(2.5, 4), dir.z * 2 + rnd(-1, 1)));
    if (e.type.boss) { dropGun('deagle', e.pos.x + 1, e.pos.z, 14); }
  }
  S.kills++; S.combo++; S.comboT = 2.8; S.score += e.type.score * Math.max(1, S.combo);
  fullHeal();   // 敵を倒すとHPが全回復
  addMadness(e.type.boss ? 20 : 6 + (burst ? 5 : 0));
  if (headshot && !e.type.boss && !silent) showMsg('HEADSHOT');
  const c = S.combo;
  if (c === 10) showMsg('MASSACRE', true); else if (c === 25) showMsg('無双', true); else if (c === 50) showMsg('MADNESS', true); else if (c === 100) showMsg('HANK ?!', true);
  onSpecialKill(e);
}
function hitEnemy(e, part, dmg, dir, pt, power) {
  const head = part.isHead, unaware = e.state !== 'alert', total = dmg * (head ? 2.2 : 1) * (unaware ? 3 : 1), hp0 = e.hp;
  e.hp -= total;
  blood(pt, dir, head ? 36 : 16, 7); hitSpray(pt, dir);
  if (!e.type.boss && dmg >= 22 && e.hp > 0 && Math.random() < 0.5) { const nm = part === e.N.HandL ? 'HandL' : part === e.N.HandR ? 'HandR' : part === e.N.FootL ? 'FootL' : part === e.N.FootR ? 'FootR' : (Math.random() < 0.25 ? ['HandL', 'HandR', 'FootL', 'FootR'][Math.random() * 4 | 0] : null); if (nm) popLimb(e, nm, dir); }   // 手足がちぎれる
  if (!e.type.boss) { e.pos.addScaledVector(dir, Math.min(0.5, dmg * 0.012)); e.pos.y = 0; }
  hitMarker(); sndHit(pt); if (S.mode === 'club') civScare(pt, 14);
  if (e.hp <= 0) { const burst = !e.type.boss && ((total - hp0 > e.type.hp * 0.9 && power >= 7) || (power >= 12 && Math.hypot(P.pos.x - e.pos.x, P.pos.z - e.pos.z) < 6)); killEnemy(e, dir, head, power, unaware && WDEF[P.cur].supp, burst); }
  else if (unaware) becomeAlert(e);
}
