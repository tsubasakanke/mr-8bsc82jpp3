"use strict";
/* ================= DJルーム(Madness 4 のクラブ風): 踊る民間人・DJ・武装兵・近接武器 ================= */
const CL = { cx: CLUB.cx, x0: CLUB.x0, x1: CLUB.x1, z0: CLUB.z0, z1: CLUB.z1, H: 8 };
const clubMats = [0, 1, 2, 3].map(() => new THREE.MeshBasicMaterial({ color: 0x222222 }));   // 光る床(拍に合わせて色が変わる)
const clubLights = [], clubLasers = new THREE.Group(), FAC_LIGHTS = scene.children.filter(o => o.isPointLight);
const neonMat = c => cachedMat('basic', c);
function neon(x, y, z, w, h, d, c) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), neonMat(c)); m.position.set(x, y, z); scene.add(m); STATIC.push(m); return m; }
(function buildClub() {
  const { x0, x1, z0, z1, cx, H } = CL, WALL = 0x24202e;
  addFloor(x0, x1, z0, z1, 'concrete', 0x30303c); addRoof(x0, x1, z0, z1, H, 0x16141c);
  wallX(x0 - 1, x1 + 1, z0 - 0.5, H, WALL); wallX(x0 - 1, x1 + 1, z1 + 0.5, H, WALL); wallZ(z0, z1, x0 - 0.5, H, WALL); wallZ(z0, z1, x1 + 0.5, H, WALL);
  // 光る床(6×4枚)
  for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) { const m = new THREE.Mesh(new THREE.BoxGeometry(5.7, 0.05, 5.7), clubMats[(i + j) % 4]); m.position.set(cx - 15 + i * 6, 0.05, -5 + j * 6); scene.add(m); STATIC.push(m); }
  // DJブース(北の壁ぎわ): 机・ターンテーブル・ミキサー・巨大スクリーン・スピーカー
  addBox(cx, -20.2, 12, 1.7, 1.15, 0x101018);
  for (const dx of [-3.4, 3.4]) { addDeco(cx + dx, 1.2, -20.2, 1.3, 0.1, 1.3, 0x1e1e24); neon(cx + dx, 1.26, -20.2, 0.9, 0.03, 0.9, 0x33ccff); }
  addDeco(cx, 1.25, -20.2, 1.6, 0.18, 1.1, 0x2a2a34); neon(cx, 1.36, -20.2, 1.2, 0.03, 0.2, 0xff3355);
  addSign('MADNESS  RAVE', cx, 5.2, z0 + 0.06, 0, 30, 5.4, '#0b0014', '#ff2bd6');
  for (let i = 0; i < 40; i++) neon(x0 + 3 + i * 1.5, 7.5, z0 + 0.1, 0.9, 0.12, 0.06, i % 2 ? 0x33ffee : 0xff2bd6);
  for (const [sx, sz, h] of [[-19, -23.4, 3.6], [19, -23.4, 3.6], [-12, -22.4, 2.8], [12, -22.4, 2.8], [-26, -10, 3.4], [26, -10, 3.4]]) {
    addBox(cx + sx, sz, 2.4, 1.7, h, 0x0b0b0f); addDeco(cx + sx, h * 0.28, sz + 0.88, 1.5, 1.5, 0.1, 0x25252c); addDeco(cx + sx, h * 0.72, sz + 0.88, 1.0, 1.0, 0.1, 0x25252c);
  }
  // バー(西): カウンターと棚・ボトル・ネオン
  addBox(x0 + 5, 4, 1.4, 17, 1.2, 0x9a6a40, 'crate'); addDeco(x0 + 5, 1.25, 4, 1.7, 0.1, 17.4, 0x2a1a10);
  for (const y of [1.7, 2.5, 3.3]) addDeco(x0 + 0.9, y, 4, 0.7, 0.12, 17, 0x5a3a22);
  for (let i = 0; i < 34; i++) { const y = [1.7, 2.5, 3.3][i % 3], c = [0x2f9a4a, 0xd89a2a, 0x2a6ad8, 0xc83a3a][i % 4]; addDeco(x0 + 0.9, y + 0.3, -3.8 + (i % 11) * 1.5 + (i % 3) * 0.2, 0.2, 0.5, 0.2, c); }
  addSign('BAR', x0 + 0.05, 5.0, 4, Math.PI / 2, 6, 1.5, '#001618', '#33ffee');
  for (let k = 0; k < 7; k++) addDeco(x0 + 7.3, 0.55, -3 + k * 2.4, 0.5, 0.1, 0.5, 0x222226);   // スツール
  // VIPソファ(東)
  for (const z of [-14, -4, 6, 15]) { addBox(x1 - 2.2, z, 2.0, 4.2, 0.9, 0x6a1030); addDeco(x1 - 1.3, 1.1, z, 0.5, 1.0, 4.2, 0x4a0a22); addDeco(x1 - 5.2, 0.45, z, 1.2, 0.5, 2.0, 0x1a1a22); }
  // 柱とネオン・トラス・スポット
  for (const [px, pz] of [[cx - 21, -9], [cx + 21, -9], [cx - 21, 17], [cx + 21, 17]]) { addBox(px, pz, 1.3, 1.3, H, 0x211a2c); neon(px, 4, pz + 0.68, 0.16, 7.6, 0.05, 0xff2bd6); neon(px, 4, pz - 0.68, 0.16, 7.6, 0.05, 0x33ffee); }
  for (const z of [-6, 8]) { addDeco(cx, 7.1, z, 52, 0.2, 0.2, 0x15151a); for (let i = 0; i < 12; i++) neon(x0 + 6 + i * 4.4, 6.95, z, 0.5, 0.15, 0.5, [0xff2bd6, 0x33ffee, 0xffee33, 0x66ff55][i % 4]); }
  addSign('EXIT', cx - 16, 5.2, z1 - 0.04, Math.PI, 3, 0.9, '#0a2a0a', '#55ff55'); addSign('EXIT', cx + 16, 5.2, z1 - 0.04, Math.PI, 3, 0.9, '#0a2a0a', '#55ff55');
  for (const x of [-16, 16]) { addDeco(cx + x, 1.8, z1 - 0.2, 4.6, 3.6, 0.2, 0x3a1010); neon(cx + x, 3.7, z1 - 0.3, 4.8, 0.1, 0.06, 0xff2222); }
  // ドラム缶(撃つと爆発)
  for (const [x, z] of [[x0 + 3.2, 11.5], [x0 + 3.2, 12.6], [x1 - 6, -19], [cx + 16, 20], [cx - 16, 20.4]]) EXPLOSIVE_DEFS.push([x, z]);
  // 光(拍に合わせて点滅するカラーライト。クラブ以外では消しておく)
  for (const [dx, dz, c] of [[-12, -2, 0xff2bd6], [12, -2, 0x33ffee], [-12, 10, 0xffee33], [12, 10, 0x66ff55]]) { const l = new THREE.PointLight(c, 0, 34); l.position.set(cx + dx, 6.4, dz); l.visible = false; scene.add(l); clubLights.push(l); }
  const dl = new THREE.PointLight(0xffffff, 0.8, 30); dl.position.set(cx, 5.2, -17); dl.visible = false; scene.add(dl); clubLights.push(dl);
  // レーザー(扇形に振れる)
  const lm = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < 8; i++) { const g = new THREE.BoxGeometry(0.05, 0.05, 44); g.translate(0, 0, 22); const m = new THREE.Mesh(g, lm(i % 2 ? 0x33ffee : 0xff2bd6)); m.position.set(cx + (i - 3.5) * 3, 7.2, z0 + 1.2); m.userData.i = i; m.frustumCulled = false; clubLasers.add(m); }
  clubLasers.visible = false; scene.add(clubLasers);
})();
function setClubScene(on) {   // DJルームでは施設の照明を消して、カラーライトとレーザーを点ける(描画が重くならないように)
  for (const l of FAC_LIGHTS) l.visible = !on; for (const l of clubLights) l.visible = on; clubLasers.visible = on;
}
const CLUB_FOG = new THREE.Color(0x120a1c), FAC_FOG = new THREE.Color(0x808080);
let clubFlash = 0, clubBeatT = 0;
function updateClub(dt) {   // 拍に合わせて、床・ライト・レーザーを動かす
  const on = S.mode === 'club' && !S.djDead, t = performance.now() / 1000, bpm = 150, ph = (t * bpm / 60) % 1;
  if (ph < clubBeatT) clubFlash = 1; clubBeatT = ph; clubFlash *= Math.exp(-6 * dt);
  const hue = (t * 0.07) % 1, f = on ? clubFlash : 0;
  for (let k = 0; k < 4; k++) clubMats[k].color.setHSL((hue + k * 0.25) % 1, 1, on ? 0.3 + 0.28 * f : 0.08);
  clubLights.forEach((l, i) => { if (i < 4) l.intensity = on ? 0.55 + 1.5 * f + 0.25 * Math.sin(t * 3 + i) : 0.1; });
  clubLasers.children.forEach(m => { const i = m.userData.i; m.rotation.y = Math.sin(t * 0.9 + i * 0.8) * 0.75; m.rotation.x = 0.28 + 0.14 * Math.sin(t * 1.3 + i); m.visible = on; });
}

/* ---------- 民間人・DJの動き ---------- */
const REFUGES = [[CL.x0 + 3, CL.z0 + 3], [CL.x1 - 3, CL.z0 + 3], [CL.x0 + 3, CL.z1 - 3], [CL.x1 - 3, CL.z1 - 3], [CL.x0 + 3, 14], [CL.x1 - 3, 0], [CL.cx - 14, -17], [CL.cx + 14, -17], [CL.cx, 21]];
function civPanic(e) { const c = e.civ; if (!c || e.type.dj || c.mode === 'panic') return; c.mode = 'panic'; c.t = -rnd(0, 0.5); c.rt = null; S.clubPanic = true; }
function civScare(pos, r) { for (const e of enemies) if (e.civ && Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z) < r) civPanic(e); }
function civThink(e, dt, dist, dx, dz) {   // 戻り値: 移動方向と速さ。動きの形は animCiv
  const c = e.civ, T = e.type, o = { x: 0, z: 0, s: 0, face: e.yaw }; c.t += dt;
  if (T.dj) { o.face = 0; return o; }
  if (c.mode === 'dance') { o.face = c.yaw0 + Math.sin(c.ph + performance.now() / 1000) * 0.5; if (S.clubPanic && dist < 9) civPanic(e); return o; }
  if (c.mode === 'cower') { o.face = Math.atan2(-dx, -dz); if (c.t > 0.8 && dist < 3.2) { c.mode = 'panic'; c.t = 0; c.rt = null; } return o; }
  // panic: 一番遠い隅へ走る。プレイヤーに近いと避ける
  if (c.t < 0) return o;
  if (!c.rt || c.t > c.rtt) {
    let best = null, bs = -1e9; for (const r of REFUGES) { const s = Math.hypot(r[0] - P.pos.x, r[1] - P.pos.z) - 0.45 * Math.hypot(r[0] - e.pos.x, r[1] - e.pos.z) + rnd(0, 8); if (s > bs) { bs = s; best = r; } }
    c.rt = best; c.rtt = c.t + rnd(2.5, 4);
  }
  let tx = c.rt[0] - e.pos.x, tz = c.rt[1] - e.pos.z; const td = Math.hypot(tx, tz) || 1; tx /= td; tz /= td;
  if (dist < 7) { const w = (7 - dist) / 7 * 1.6; tx -= dx / dist * w; tz -= dz / dist * w; }
  const tl = Math.hypot(tx, tz) || 1; o.x = tx / tl; o.z = tz / tl; o.s = T.speed * (0.9 + 0.2 * Math.sin(c.ph)); o.face = Math.atan2(o.x, o.z);
  if (td < 1.6 && dist > 4) { c.mode = 'cower'; c.t = 0; }
  return o;
}
function animCiv(e, dt, moving) {
  e.g.rotation.x = 0; const N = e.N, T = e.type, c = e.civ, tm = performance.now() / 1000, beat = tm * (150 / 60) * Math.PI * 2 + c.ph;
  if (c.mode === 'cower') { cowerPose(e); return; }
  e.mv += ((moving ? 1 : 0) - e.mv) * Math.min(1, dt * 10);
  const s = Math.sin(e.phase), co = Math.cos(e.phase), bob = Math.abs(co) * 0.3 * e.mv;
  if (T.dj) {   // ターンテーブルをこする。頭は拍でうなずく
    const sc = Math.sin(beat * 0.5), nod = Math.abs(Math.sin(beat * 0.5)) * 0.25;
    for (const n of ['Body', 'Head', 'Face']) N[n].position.y = REST[n].p.y - (n === 'Body' ? 0 : nod * 0.6) - (S.djDead ? 0 : 0);
    for (const [n, sg] of [['FootL', 1], ['FootR', -1]]) { const r = REST[n].p; N[n].position.set(r.x, r.y, r.z); }
    handPose(N.HandR, 3.1, 4.2 + Math.abs(sc) * 0.2, 1.4 + sc * 0.7, 0.45); handPose(N.HandL, 3.1, 4.2 + Math.abs(Math.cos(beat * 0.5)) * 0.2, -1.4 + Math.cos(beat * 0.5) * 0.5, 0.45); setCurl(N, 'R', 0.7); setCurl(N, 'L', 0.7); return;
  }
  if (c.mode === 'dance') {   // 拍に合わせて跳ねる。腕を振り上げる
    const hop = Math.abs(Math.sin(beat * 0.5)) * 0.5, sw = Math.sin(beat * 0.5 + (c.ph > 3 ? 1.5 : 0));
    for (const n of ['Body', 'Head', 'Face']) N[n].position.y = REST[n].p.y + hop;
    for (const [n, sg] of [['FootL', 1], ['FootR', -1]]) { const r = REST[n].p; N[n].position.set(r.x + Math.sin(beat * 0.25) * sg * 0.5, r.y + (Math.sin(beat * 0.5 + (sg > 0 ? 0 : Math.PI)) > 0.4 ? 0.5 : 0), r.z); }
    handPose(N.HandR, 2.4, 6.6 + Math.max(0, sw) * 1.4, 1.9, 1.0 + sw * 0.4); handPose(N.HandL, 2.4, 6.6 + Math.max(0, -sw) * 1.4, -1.9, 1.0 - sw * 0.4); setCurl(N, 'R', 0.3); setCurl(N, 'L', 0.3); return;
  }
  // 逃げる: 両手を上げて走る
  for (const n of ['Body', 'Head', 'Face']) N[n].position.y = REST[n].p.y + bob;
  for (const [n, sg] of [['FootL', 1], ['FootR', -1]]) { const r = REST[n].p; N[n].position.set(r.x + s * sg * 1.5 * e.mv, r.y + Math.max(0, co * sg) * 0.7 * e.mv, r.z); }
  const w = Math.sin(e.phase * 2) * 0.5;
  handPose(N.HandR, 2.2 + w * 0.3, 7.0 + w, 1.9, 1.3 + w * 0.3); handPose(N.HandL, 2.2 - w * 0.3, 7.0 - w, -1.9, 1.3 - w * 0.3); setCurl(N, 'R', 0.2); setCurl(N, 'L', 0.2);
}

/* ---------- ステージの開始 ---------- */
function clubAt(x, z) { return [CL.cx + x, z]; }
function clubFree(x0, x1, z0, z1) { let x, z, n = 0; do { x = rnd(x0, x1); z = rnd(z0, z1); n++; } while (n < 60 && insideBox(x, z, 0.9)); return [x, z]; }
function spawnCivilian(x, z, mode) {
  const e = spawnEnemy('civ' + (Math.random() * 8 | 0), x, z, { yaw: rnd(0, 6.28) }); e.civ.mode = mode || 'dance'; return e;
}
function setupClub() {   // 配置: 踊る民間人・DJ・武装兵・床の武器
  const { x0, x1, z0, z1, cx } = CL;
  P.pos.set(cx, 0, 20.5); P.yaw = 0; P.pitch = 0;
  const dj = spawnEnemy('dj', cx, -22.4, { yaw: 0, post: true }); dj.civ.mode = 'dj';
  for (let i = 0; i < 30; i++) { const [x, z] = clubFree(cx - 17, cx + 17, -7, 16); spawnCivilian(x, z, 'dance'); }   // ダンスフロア
  for (let i = 0; i < 6; i++) { const [x, z] = clubFree(x0 + 2.5, x0 + 4.4, -3, 12); spawnCivilian(x, z, 'dance'); }   // バーの客
  for (let i = 0; i < 4; i++) { const [x, z] = clubFree(x1 - 5, x1 - 3.4, -14, 15); spawnCivilian(x, z, 'dance'); }   // ソファ
  // 武装兵: ステージ脇・バー・出入口・フロアの縁
  const post = (type, x, z, yaw, weapon) => spawnEnemy(type, x, z, { post: true, yaw, weapon });
  post('guard', cx - 8, -17, Math.PI * 0.9, 'rifle'); post('guard', cx + 8, -17, Math.PI * 1.1, 'smg'); post('agent', cx - 22, -14, Math.PI * 0.6); post('agent', cx + 22, -14, Math.PI * 1.4);
  for (const [dx, z] of [[-20, 4], [20, 4], [-20, 14], [20, 14], [-12, 1], [12, 1]]) post('grunt', cx + dx, z, rnd(0, 6.28));
  post('slasher', x0 + 8, 1, 1.2, 'machete'); post('slasher', x1 - 8, 8, -1.2, 'bat'); post('slasher', cx - 10, 12, 3.0, 'axe'); post('slasher', cx + 10, -2, 0, 'katana');
  // 床・バーカウンターに武器
  for (const [id, dx, z] of [['machete', -24, 14], ['bat', -23.5, -2], ['pipe', 22.5, 17.5], ['axe', 24, -16.5], ['katana', 0, -18.6]]) dropGun(id, cx + dx, z, 0, new THREE.Vector3(0, 0, 0));
  for (const [id, dx, z, n] of [['shotgun', -8, 21, 12], ['rifle', 8, 21, 30], ['smg', 0, 22, 50]]) dropGun(id, cx + dx, z, n, new THREE.Vector3(0, 0, 0));
}
const CLUB_WAVES = 3;
function clubReinforce() {   // 出入口から武装兵が突入してくる。波ごとに強くなる
  const w = S.clubWave, cx = CL.cx, list = [];
  for (let i = 0; i < 3 + w * 2; i++) list.push(i % 4 === 3 ? 'slasher' : 'grunt'); for (let i = 0; i < w; i++) list.push('agent'); if (w >= 3) list.push('guard', 'guard');
  list.forEach((t, i) => { const e = spawnEnemy(t, cx + (i % 2 ? 16 : -16) + rnd(-2.5, 2.5), CL.z1 - 2.2 - Math.floor(i / 2) * 1.0, { state: 'alert' }); });
  showMsg(`増援 ${w}/${CLUB_WAVES}`, true, '#f66');
}
