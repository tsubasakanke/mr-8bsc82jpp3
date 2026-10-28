"use strict";
/* ================= メイン: ゲーム状態・入力・ステージ進行・ループ ================= */
const P = { pos: new THREE.Vector3(0, 0, 36.5), vel: new THREE.Vector3(), vy: 0, yaw: 0, pitch: 0, hp: 100, maxHp: 100, onGround: true,
            crouch: false, eye: 1.7, speed: 0, cur: 'pistol', melee: 'knife', owned: { knife: true, pistol: true }, ammo: { knife: 0, pistol: 36 }, pumpT: 0, nearDrop: null, lockT: 0, finishAim: null, nearPanel: false };
const S = { state: 'menu', stage: 'infil', wave: 0, kills: 0, stealthKills: 0, score: 0, combo: 0, comboT: 0, queue: [], spawnT: 0, waveDelay: 0, bt: 1, ts: 1, best: 0, detect: 0, alerted: false, alarm: { on: false, off: false, t: 0, reinf: 0 }, panelT: 0, clearT: 0, freeze: 0, mode: 'mission', bodyguardDown: false, madness: 0, madT: 0, madTierShown: 0 };
let bobT = 0, moveAmt = 0, modelReady = false;
const keys = {};

/* ---------- 狂気度: キルとフィニッシャーで溜まる。高いほどフィニッシャーが残虐になり、BGMが激しくなる ---------- */
const madTier = () => S.madness >= 70 ? 2 : S.madness >= 35 ? 1 : 0;
function addMadness(v) {
  S.madness = Math.min(100, S.madness + v); S.madT = 0; const t = madTier();
  if (t > S.madTierShown) { S.madTierShown = t; punchFov(11); sndThump(); setTimeout(() => { if (S.state === 'play') showMsg(t === 1 ? '狂気' : '極限狂気', true, '#c455ff'); }, 1000); }   // フィニッシャー名と重ならないよう、少し遅らせる
}

/* ---------- 開始・リセット ---------- */
function freePos(minDist, zMin, zMax) {
  let x, z;
  for (let k = 0; k < 60; k++) { x = rnd(-A + 4, A - 4); z = rnd(zMin, zMax); if (!insideBox(x, z, 1.2) && zoneAt(x, z) === 'outside' && Math.hypot(x - P.pos.x, z - P.pos.z) > minDist) break; }
  return [x, z];
}
function resetGame(mode) {
  mode = mode || S.mode || 'mission';
  for (const e of enemies) scene.remove(e.g); enemies.length = 0;
  for (const g of gibs) scene.remove(g); gibs.length = 0; resetCarved();
  for (const d of drops) { scene.remove(d.holder); scene.remove(d.ring); } drops.length = 0;
  particles.forEach(m => m.visible = false); decals.forEach(m => m.visible = false); resetHazards(); resetGoreScreen(); S.freeze = 0; if (typeof BGM !== 'undefined') BGM.tgt = 0; $('madvig').style.opacity = 0; renderer.domElement.style.filter = ''; $('obj').textContent = '';
  for (const t of tracers) scene.remove(t); tracers.length = 0; for (const t of thrown) scene.remove(t.m); thrown.length = 0; for (const s of stuck) if (s.m.parent) s.m.parent.remove(s.m); stuck.length = 0; S.djDead = false; S.clubPanic = false; S.clubWave = 0; S.clubT = 0;
  Object.assign(P, { hp: 100, vy: 0, yaw: 0, pitch: 0, onGround: true, crouch: false, eye: 1.7, cur: 'pistol', melee: 'knife', owned: { knife: true, pistol: true }, ammo: { knife: 0, pistol: 36 }, pumpT: 0, nearDrop: null });
  if (P.rev) toggleGrip(); P.pos.set(0, 0, 36.5); P.vel.set(0, 0, 0); P.lockT = 0; P.finish = null; P.finishMove = null; S.finSlow = 0; S.mode = mode; S.bodyguardDown = false; S.madness = 0; S.madT = 0; S.madTierShown = 0;
  for (const e of dying.concat(corpses)) { scene.remove(e.g); if (e.twin) scene.remove(e.twin); } dying.length = 0; corpses.length = 0; if (finProp) { scene.remove(finProp.m); finProp = null; }
  Object.assign(S, { stage: mode === 'waves' ? 'waves' : mode === 'club' ? 'club' : 'infil', wave: 0, kills: 0, stealthKills: 0, score: 0, combo: 0, comboT: 0, queue: [], spawnT: 0, waveDelay: 0, bt: 1, ts: 1, detect: 0, alerted: false, alarm: { on: false, off: false, t: 0, reinf: 0 }, panelT: 0, clearT: 0 });
  if (window.PANEL_LED) PANEL_LED.material.color.set(0xff2a1a);
  setWeapon('pistol'); setClubScene(mode === 'club');
  if (mode === 'club') { setupClub(); renderWeaponHUD(); showMsg('DJルームを血で染めろ', false, '#f6c'); return; }
  if (mode === 'waves') {   // ウェーブ戦: 中庭の真ん中から、全武器を持って始める。敵は四方から押し寄せる
    P.pos.set(0, 0, 4); P.owned = { knife: true, pistol: true, smg: true, shotgun: true, rifle: true, deagle: true }; P.ammo = { knife: 0, pistol: 60, smg: 120, shotgun: 30, rifle: 90, deagle: 28 };
    setWeapon('smg'); renderWeaponHUD(); startWave(); return;
  }
  // ===== 敵の配置 =====
  const out = (x0, x1, z0, z1) => { let x, z, n = 0; do { x = rnd(x0, x1); z = rnd(z0, z1); n++; } while (n < 60 && (insideBox(x, z, 1.2) || zoneAt(x, z) !== 'outside')); return [x, z]; };
  const route = (x, z, r, zn) => { const rt = [[x, z]]; for (let k = 0; k < 2; k++) { let rx, rz, n = 0; do { rx = x + rnd(-r, r); rz = z + rnd(-r, r); n++; } while (n < 25 && (insideBox(rx, rz, 1.2) || (zn ? zoneAt(rx, rz) !== zn : zoneAt(rx, rz) !== 'outside') || Math.abs(rx) > A - 3 || rz > 16 || rz < -A + 3)); rt.push([rx, rz]); } return rt; };
  const post = (type, x, z, yaw, weapon) => spawnEnemy(type, x, z, { post: true, yaw, weapon });
  const patrol = (type, pts, weapon) => spawnEnemy(type, pts[0][0], pts[0][1], { route: pts, yaw: rnd(0, 6.28), weapon });
  // ① 正面ゲートの門番2人(庭のほうを向いて立っている)
  const g1 = spawnEnemy('guard', -1.9, 18.0, { weapon: 'rifle', yaw: 0, post: true }), g2 = spawnEnemy('guard', 2.1, 18.0, { weapon: 'smg', yaw: 0.15, post: true });
  g1.isGuard = g2.isGuard = true;
  // 中庭: 巡回5人 + 本館の入口を見張るエージェント1人 / 両脇の外: 東3人・西1人
  for (let i = 0; i < 5; i++) { const [x, z] = out(-24, 24, -4, 15); spawnEnemy('grunt', x, z, { route: route(x, z, 9), yaw: rnd(0, 6.28) }); }
  post('agent', -7, -5.5, 0.2);
  for (let i = 0; i < 3; i++) { const [x, z] = out(18, 36, -32, 12); spawnEnemy('grunt', x, z, { route: route(x, z, 8), yaw: rnd(0, 6.28) }); }
  { const [x, z] = out(-26, -17, -6, 14); spawnEnemy('grunt', x, z, { route: route(x, z, 6), yaw: rnd(0, 6.28) }); }
  // ロビー: エージェント2人(入口を向く)+ 巡回1人
  post('agent', -9, -11, 0, 'rifle'); post('agent', 9, -11, -0.2); patrol('grunt', [[-5, -20], [5, -20], [5, -12], [-5, -12]]);
  // 地下(警報パネルの部屋): 巡回1人 + 見張り1人
  patrol('grunt', [[-28, -16], [-20, -28], [-30, -30], [-22, -18]]); post('grunt', -17, -14, -Math.PI / 2);
  // 兵舎: ベッドのそばで見張り4人 + 巡回2人
  for (const [x, z] of [[-7, -30], [-7, -37], [7, -31], [7, -38]]) post('grunt', x, z, rnd(0, 6.28));
  patrol('grunt', [[-3, -27], [3, -27], [3, -41], [-3, -41]]); patrol('grunt', [[0, -30], [0, -40]]);
  // 機械ホール: プレス機のレーンを避けて巡回(戦闘中に追いかけてくる敵を、レーンに誘い込むと潰れる)
  patrol('grunt', [[-2.4, -46.5], [-2.4, -53]]); patrol('grunt', [[2.4, -46.5], [2.4, -53]]); patrol('grunt', [[-3, -60.2], [3, -60.2]]); patrol('grunt', [[-2.4, -66], [2.4, -66]]); patrol('grunt', [[-9, -46.5], [-9, -52.5]]); post('agent', 0, -46, 0);
  // サーバー室: エージェント3人 + 通路を巡回2人
  post('agent', -3, -71, 0); post('agent', 3, -76, 0.3); post('agent', 0, -85, 0); patrol('grunt', [[-2, -72], [-2, -86]]); patrol('grunt', [[2, -84], [2, -71]]);
  // 司令室: 巨漢のボディガードと、取り巻きのエージェント4人。社長はデスクの裏
  post('boss', 0, -98, 0); for (const [x, z] of [[-6, -93], [6, -93], [-6, -102], [6, -102]]) post('agent', x, z, 0);
  spawnEnemy('president', 0, -108.7, { post: true, yaw: 0 });   // 社長: 一番奥のデスクの裏でうずくまっている
  // 武器庫・倉庫: 見張りと、床に置かれた武器
  post('agent', 21, -30, -Math.PI / 2); post('grunt', -24, -52, 0.4); post('grunt', -18, -60, 1.2);
  for (const [id, x, z, n] of [['smg', 18, -28, 40], ['shotgun', 22.5, -41.5, 10], ['rifle', 25, -33, 30], ['deagle', 17, -42, 14], ['shotgun', -21, -62, 10]]) dropGun(id, x, z, n, new THREE.Vector3(0, 0, 0));
  showMsg('社長を始末せよ', false, '#ccc');
}
function showOverlay(kind) {   // 'menu' | 'pause' | 'over' | 'win'
  const T = { menu: ['MADNESS RAMPAGE', '社長を始末するか、押し寄せる敵を殲滅するか。モードを選べ。'], pause: ['PAUSE', ''], over: ['YOU DIED', ''], win: ['MISSION COMPLETE', ''] }[kind];
  $('ovt').textContent = T[0]; $('ovt').style.color = kind === 'win' ? '#7f7' : '#e00'; $('ovp').innerHTML = T[1];
  if (kind === 'over' || kind === 'win') $('ovp').innerHTML = `${S.mode === 'waves' ? `WAVE ${S.wave}` : S.mode === 'club' ? (kind === 'win' ? 'DJルーム制圧' : '任務失敗') : (kind === 'win' ? '社長を始末した' : '任務失敗')} ／ KILLS ${S.kills}（ステルスキル ${S.stealthKills}）<br>SCORE ${S.score}（BEST ${S.best}）`;
  $('modes').style.display = kind === 'pause' ? 'none' : 'flex'; $('ovg').textContent = kind === 'pause' ? 'クリックで再開' : ''; $('ovg').style.display = kind === 'pause' ? 'block' : 'none';
  $('mMission').firstChild.textContent = 'MISSION'; $('mWave').firstChild.textContent = 'WAVE'; $('mClub').firstChild.textContent = 'CLUB';
  $('ovc').style.display = kind === 'menu' || kind === 'pause' ? 'block' : 'none'; { const m = $('msg'); m.classList.remove('show'); m.style.opacity = 0; }
  $('madvig').style.opacity = 0; renderer.domElement.style.filter = '';
  $('overlay').classList.remove('hidden');
}
function gameOver() {
  S.state = 'over'; $('hptxt').textContent = 'HP 0'; $('hpbar').style.width = '0%'; S.best = Math.max(S.best, S.score); document.exitPointerLock(); document.body.style.cursor = ''; showOverlay('over');
}
function showWin() { S.state = 'win'; S.best = Math.max(S.best, S.score); document.exitPointerLock(); document.body.style.cursor = ''; showOverlay('win'); }
function lockPointer() {
  // マウスをロックして視点操作。ロックできない環境(アプリ内ブラウザ等)では「画面端で旋回」モードに切り替える
  try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(setLockFail); } catch (_) { setLockFail(); }
  setTimeout(() => { if (S.state === 'play' && document.pointerLockElement !== renderer.domElement) setLockFail(); }, 500);
}
function begin(mode) {   // モード指定で新規開始 / 指定なしで再開
  if (!modelReady) return; ac();
  if (mode) { resetGame(mode); } else if (S.state === 'menu' || S.state === 'over' || S.state === 'win') { resetGame(S.mode); }
  S.state = 'play'; $('overlay').classList.add('hidden'); if (S.lockFail) document.body.style.cursor = 'none'; lockPointer();
}
function pause() { S.state = 'pause'; document.body.style.cursor = ''; showOverlay('pause'); }
function setLockFail() {
  if (S.lockFail) return; S.lockFail = true; document.body.style.cursor = 'none';
  const h = $('lockhint'); h.style.display = 'block'; setTimeout(() => h.style.opacity = 0, 7000);
}
function damagePlayer(d) {
  if (P.lockT > 0 || S.stage === 'clear') return;   // フィニッシャー中・任務完了後は無敵
  P.hp -= d; shake = Math.min(0.2, shake + 0.06); redFlash(Math.min(0.9, 0.35 + d * 0.04)); sndHurt();
  if (P.hp <= 0 && S.state === 'play') gameOver();
}

/* ---------- 警報・ミッション ---------- */
function triggerAlarm() {
  if (S.alarm.on || S.alarm.off || S.stage !== 'infil') return;
  S.alarm.on = true; S.alarm.t = 0; S.alarm.reinf = 0; showMsg('ALARM!', true);
}
function missionClear() {
  if (S.stage !== 'infil') return;
  S.stage = 'clear'; S.clearT = 4.5; S.alarm.on = false; S.score += 3000;
}
function updateAlarm(dt) {
  const al = S.alarm; if (S.mode === 'waves') { P.nearPanel = false; $('alarm').className = ''; $('alarm').textContent = ''; return; }
  // 地下の警報パネル(Eを長押し)
  const dp = Math.hypot(P.pos.x - PANEL.x, P.pos.z - (PANEL.z + 1.4));
  P.nearPanel = dp < 2.6 && !al.off;
  if (P.nearPanel && keys.KeyE) {
    S.panelT += dt;
    if (S.panelT >= 1.6) { al.off = true; al.on = false; S.panelT = 0; if (window.PANEL_LED) PANEL_LED.material.color.set(0x33ff66); showMsg('警報を停止した', false, '#9f9'); sndPickup(); }
  } else S.panelT = Math.max(0, S.panelT - dt * 2);
  if (P.nearPanel) { $('prompt').style.display = 'block'; $('prompt').textContent = `[E 長押し] 警報パネルを止める ${Math.round(S.panelT / 1.6 * 100)}%`; }
  // 警報中: サイレンと増援(ゲートから入ってくる)
  if (al.on) {
    al.t += dt; if (Math.floor(al.t / 0.9) !== Math.floor((al.t - dt) / 0.9)) sndSiren();
    const next = 12 + al.reinf * 6 - al.t;
    if (next <= 0 && al.reinf < 4 && enemies.length < 28) { al.reinf++; for (let k = 0; k < 2; k++) spawnEnemy('grunt', rnd(-2.5, 2.5), 17.5, { state: 'alert' }); showMsg('増援!', false, '#f66'); }
  }
  const el = $('alarm');
  if (al.on) { el.className = 'on'; el.textContent = al.reinf < 4 ? `ALARM  次の増援まで ${Math.max(0, Math.ceil(12 + al.reinf * 6 - al.t))}s` : 'ALARM'; }
  else { el.className = ''; el.textContent = ''; }
}

/* ---------- 入力 ---------- */
const mouseN = { x: 0.5, y: 0.5 };
$('overlay').addEventListener('click', () => { if (S.state === 'pause') begin(); });
$('mMission').addEventListener('click', e => { e.stopPropagation(); begin('mission'); });
$('mWave').addEventListener('click', e => { e.stopPropagation(); begin('waves'); });
$('mClub').addEventListener('click', e => { e.stopPropagation(); begin('club'); });
document.addEventListener('pointerlockerror', setLockFail);
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== renderer.domElement && S.state === 'play' && !S.lockFail) pause();
});
addEventListener('mousemove', e => {
  mouseN.x = e.clientX / innerWidth; mouseN.y = e.clientY / innerHeight;
  if (document.pointerLockElement !== renderer.domElement) return;
  if (insp.on) { insp.yaw += e.movementX * 0.012; insp.pitch = Math.max(-1.4, Math.min(1.4, insp.pitch + e.movementY * 0.012)); return; }
  P.yaw -= e.movementX * 0.0022; P.pitch = Math.max(-1.5, Math.min(1.5, P.pitch - e.movementY * 0.0022));
});
addEventListener('mousedown', e => { if (e.button === 0) mouseDown = true; else if (e.button === 2 && S.state === 'play') throwWeapon(); });
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mouseup', e => { if (e.button === 0) mouseDown = false; });
addEventListener('wheel', e => { if (S.state !== 'play') return; if (insp.on) insp.zoom = Math.max(0.6, Math.min(2.4, insp.zoom + (e.deltaY > 0 ? -0.1 : 0.1))); else cycleWeapon(e.deltaY > 0 ? 1 : -1); });
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'KeyM' && AC) toggleBGM();
  if (e.code === 'Minus' || e.code === 'Equal' || e.code === 'Semicolon' || e.code === 'NumpadSubtract' || e.code === 'NumpadAdd') { setVol('master', VOL.master + (e.code === 'Minus' || e.code === 'NumpadSubtract' ? -0.1 : 0.1)); if (S.state === 'play') showMsg('VOLUME ' + Math.round(VOL.master * 100), false, '#ccc'); }   // BGM の ON/OFF はメニューでも効く
  if (S.state !== 'play') return;
  if (e.code === 'Escape' && S.lockFail) pause();
  if (e.code === 'KeyE') tryPickup();
  if (e.code === 'KeyF') tryFinisher();
  if (e.code === 'KeyG') throwWeapon();
  if (e.code === 'KeyR') toggleGrip();
  if (e.code === 'KeyV') doKick();
  if (e.code.startsWith('Digit')) { const n = +e.code.slice(5) - 1; if (n >= 0 && n < SLOTS.length) setWeapon(slotId(n)); }
});
addEventListener('keyup', e => keys[e.code] = false);

/* ---------- ウェーブ(施設を制圧した後に始まる) ---------- */
function updateClubStage(dt) {   // DJルーム: 兵が減る/時間が来ると増援。最後の波を倒してDJも倒すとクリア
  S.clubT += dt; const hostile = enemies.filter(e => !e.type.civ).length;
  if (S.clubWave < CLUB_WAVES && (hostile <= 2 || S.clubT > 45 + S.clubWave * 25)) { S.clubWave++; S.clubT = 0; clubReinforce(); }
  else if (S.clubWave >= CLUB_WAVES && hostile === 0 && S.djDead) { S.stage = 'clear'; S.clearT = 4; S.score += 2000; showMsg('DJルーム制圧', true, '#f6c'); }
}
function startWave() {
  S.wave++; const n = S.wave, q = [];
  for (let i = 0; i < 4 + n * 2; i++) q.push('grunt');
  if (n >= 2) for (let i = 0; i < 2 + n; i++) q.push('rusher');
  if (n >= 3) for (let i = 0; i < n - 1; i++) q.push('agent');
  q.sort(() => Math.random() - 0.5);
  if (n % 5 === 0) q.push('boss');
  S.queue = q; S.spawnT = 1; showMsg(n % 5 === 0 ? `WAVE ${n}  BOSS` : `WAVE ${n}`, n % 5 === 0);
}
function spawnFromQueue() {
  const type = S.queue.shift(), [x, z] = freePos(20, -A + 3, 15);
  spawnEnemy(type, x, z, { state: 'alert' });
}

/* ---------- 更新 ---------- */
let last = performance.now();
function update(dt) {
  const bt = keys.KeyQ && S.bt > 0.02;
  S.finSlow = Math.max(0, (S.finSlow || 0) - dt);
  S.ts += (((bt ? 0.22 : 1) * (S.finSlow > 0 ? 0.3 : 1)) - S.ts) * (1 - Math.exp(-10 * dt));
  S.bt = bt ? Math.max(0, S.bt - dt * 0.3) : Math.min(1, S.bt + dt * 0.08);
  const pdt = dt * Math.min(1, S.ts * 2.4); let wdt = dt * S.ts;
  if (S.freeze > 0) { S.freeze -= dt; wdt = 0; }   // ヒットストップ(キルの瞬間に一瞬止まる)

  // 視点: ロック不可モード(画面端で旋回・カーソルの高さで上下) と 矢印キー
  insp.on = !!keys.KeyY && P.lockT <= 0;
  if (insp.on) {   // 眺め中: ロック不可モードではカーソル位置で回転、矢印キーでも回転。視点と移動は止める
    if (S.lockFail) { insp.yaw += (((mouseN.x - 0.5) * 2 * 2.6) - insp.yaw) * (1 - Math.exp(-8 * dt)); insp.pitch += (((mouseN.y - 0.5) * 2 * 1.2) - insp.pitch) * (1 - Math.exp(-8 * dt)); }
    insp.yaw += ((keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0)) * 2.2 * dt; insp.pitch = Math.max(-1.4, Math.min(1.4, insp.pitch + ((keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0)) * 1.6 * dt));
  }
  if (S.lockFail && !insp.on && P.lockT <= 0) {   // (フィニッシャー中は自動で相手を向くので、カーソルでの視点操作は止める)
    const nx = (mouseN.x - 0.5) * 2, dz = 0.14;
    if (Math.abs(nx) > dz) P.yaw -= Math.sign(nx) * (Math.abs(nx) - dz) / (1 - dz) * 3.0 * dt;
    P.pitch += ((-(mouseN.y - 0.5) * 2 * 1.1) - P.pitch) * (1 - Math.exp(-10 * dt));
  }
  if (!insp.on && P.lockT <= 0) {
    P.yaw += ((keys.ArrowLeft ? 1 : 0) - (keys.ArrowRight ? 1 : 0)) * 2.4 * dt;
    P.pitch = Math.max(-1.5, Math.min(1.5, P.pitch + ((keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0)) * 1.6 * dt));
  }

  // フィニッシャー中は動けない。視線は相手の首へ
  if (P.lockT > 0) {
    P.lockT -= wdt; const a = P.finishAim, fm = P.finishMove;
    if (fm) { const ox = P.pos.x, oz = P.pos.z, k = 1 - Math.exp(-9 * dt); P.pos.x += (fm.x - P.pos.x) * k; P.pos.z += (fm.z - P.pos.z) * k; resolve(P.pos, 0.4); P.lockSpeed = Math.hypot(P.pos.x - ox, P.pos.z - oz) / Math.max(dt, 0.001); }   // 歩いて近づく(なめらかに)
    if (a) {
      const dx = a.x - P.pos.x, dz = a.z - P.pos.z, tyaw = Math.atan2(-dx, -dz), tp = Math.atan2(a.y - (P.pos.y + P.eye), Math.hypot(dx, dz));
      let dy = tyaw - P.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      P.yaw += dy * (1 - Math.exp(-14 * dt)); P.pitch += (tp - P.pitch) * (1 - Math.exp(-14 * dt));
    }
    P.vel.set(0, 0, 0);
  }
  // 移動(しゃがみは遅くて見つかりにくい)
  const zn = zoneAt(P.pos.x, P.pos.z), look = ZONE_LOOK[zn];
  ambient.intensity += (look.amb - ambient.intensity) * (1 - Math.exp(-4 * dt)); sun.intensity = ambient.intensity * 0.7; scene.fog.far += (look.fog - scene.fog.far) * (1 - Math.exp(-4 * dt)); scene.fog.color.lerp(zn === 'club' ? CLUB_FOG : FAC_FOG, 1 - Math.exp(-4 * dt));
  P.crouch = !!(keys.KeyC || keys.ControlLeft) || zn === 'tunnel';   // 排水路は天井が低くて、しゃがみ専用
  const fw = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), st = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const sp = P.crouch ? 4 : (keys.ShiftLeft || keys.ShiftRight ? 14 : 9);
  const tx = (-Math.sin(P.yaw) * fw + Math.cos(P.yaw) * st), tz = (-Math.cos(P.yaw) * fw - Math.sin(P.yaw) * st);
  const tl = Math.hypot(tx, tz) || 1, k = 1 - Math.exp(-14 * pdt);
  const mvOk = (P.lockT > 0 || insp.on) ? 0 : 1;
  P.vel.x += ((tx / tl * (fw || st ? sp : 0) * mvOk) - P.vel.x) * k; P.vel.z += ((tz / tl * (fw || st ? sp : 0) * mvOk) - P.vel.z) * k;
  P.pos.x += P.vel.x * pdt; P.pos.z += P.vel.z * pdt;
  if (keys.Space && P.onGround && !P.crouch) { P.vy = 8.5; P.onGround = false; }
  P.vy -= 26 * pdt; P.pos.y += P.vy * pdt; if (P.pos.y <= 0) { P.pos.y = 0; P.vy = 0; P.onGround = true; }
  resolve(P.pos, 0.4);
  P.speed = P.lockT > 0 ? Math.min(9, P.lockSpeed || 0) : Math.hypot(P.vel.x, P.vel.z);
  moveAmt = Math.min(1, P.speed / 9) * (P.onGround ? 1 : 0.2); bobT += pdt * (sp > 10 ? 15 : 10) * moveAmt;
  P.eye += (((P.lockT > 0 && P.finishEye) ? P.finishEye : (P.crouch ? 1.05 : 1.7)) - P.eye) * (1 - Math.exp(-(P.lockT > 0 ? 8 : 12) * dt));
  if (P.speed > 11 && P.onGround) makeNoise(P.pos, 6);
  stepSound(dt, P.speed, P.onGround, P.crouch, sp > 10); updateAudio(dt, zn, enemies.some(e => e.state === 'alert'), madTier());
  S.madT += dt; if (S.madT > 6 && S.madness > 0) { S.madness = Math.max(0, S.madness - 3 * dt); const tn = madTier(); if (tn < S.madTierShown) S.madTierShown = tn; }   // しばらく倒さないと、狂気は冷める   // 全力ダッシュは近くの敵に聞こえる

  // 攻撃
  cd -= pdt;
  if (mouseDown && cd <= 0) playerFire();
  updateViewmodel(dt);

  // 敵・演出
  updateFinisher(dt); updateEnemies(wdt); updateDying(wdt); updateDrops(dt); updateAlarm(dt); updateHazards(dt, wdt); updateChunks(wdt); updateGoreScreen(dt); updateFov(dt);
  const ft = finisherTarget(); if (ft && $('prompt').style.display !== 'block') { $('prompt').style.display = 'block'; $('prompt').textContent = `[F] フィニッシュ (${FIN[P.cur].name})`; } updateDebris(wdt); updateTracers(wdt); updateThrown(wdt); updateFinProp(wdt); updateClub(dt); updateCarved();
  S.comboT -= dt; if (S.comboT <= 0) S.combo = 0;
  shake *= Math.exp(-8 * dt); kick *= Math.exp(-9 * dt);

  // 進行: 潜入 → ボス撃破でミッション完了 → 残敵を倒してウェーブ戦
  if (S.stage === 'infil') { /* ボスを倒すとクリア */ }
  else if (S.stage === 'clear') { S.clearT -= dt; if (S.clearT <= 0) { showWin(); return; } }
  else if (S.stage === 'club') updateClubStage(dt);
  else if (S.queue.length) {
    S.spawnT -= wdt;
    if (S.spawnT <= 0 && enemies.length < 26) { spawnFromQueue(); S.spawnT = Math.max(0.2, 1.1 - S.wave * 0.07); }
  } else if (!enemies.length) {
    S.waveDelay += dt;
    if (S.waveDelay > 3) { S.waveDelay = 0; P.hp = Math.min(P.maxHp, P.hp + 30); startWave(); }
  }

  // カメラ
  camera.position.set(P.pos.x + (Math.random() - 0.5) * shake, P.pos.y + P.eye + Math.abs(Math.sin(bobT)) * 0.05 * moveAmt + (Math.random() - 0.5) * shake, P.pos.z + (Math.random() - 0.5) * shake);
  rollKick *= Math.exp(-6 * dt); camera.rotation.set(P.pitch + kick, P.yaw, (Math.random() - 0.5) * shake * 0.2 + rollKick + (P.lockT > 0 ? (P.finishRoll || 0) : 0));

  // HUD
  const guards = enemies.filter(e => e.isGuard).length;
  $('wave').textContent = S.stage === 'club' ? `MASSACRE ${Math.min(S.clubWave + 1, CLUB_WAVES)}/${CLUB_WAVES}` : S.stage === 'infil' ? 'ASSASSINATE' : S.stage === 'clear' ? 'CLEAR' : `WAVE ${S.wave}`; $('kills').textContent = `KILLS ${S.kills}`; $('score').textContent = `SCORE ${S.score}`;
  $('obj').textContent = S.stage === 'club' ? (S.clubWave >= CLUB_WAVES ? '最後の増援を殲滅し、DJを倒せ' : `武装兵を殲滅しDJを倒せ(民間人はご自由に)  残り: 武装兵${enemies.filter(e => !e.type.civ).length} ／ 民間人${enemies.filter(e => e.civ && !e.type.dj).length}`) : S.stage === 'infil' ? (S.bodyguardDown ? '目標: ボディガードは倒れた。デスクの裏の社長を始末せよ' : `目標: 最奥の司令室にいる社長を始末せよ。護衛の巨漢が守っている。①正面ゲート(門番${guards || 0}) ／ ②西の排水路 → 地下。扉は近づくと開く・赤いドラム缶は爆発・プレス機に注意`) : S.stage === 'clear' ? '任務完了!' : '';
  $('hptxt').textContent = `HP ${Math.max(0, Math.ceil(P.hp))}`; $('hpbar').style.width = Math.max(0, P.hp) + '%'; $('btbar').style.width = S.bt * 100 + '%';
  $('combo').innerHTML = S.combo > 1 ? `x${S.combo}<small>COMBO</small>` : '';
  const dv = $('detect'); dv.style.opacity = (S.detect > 0.02 && P.lockT <= 0) ? 1 : 0; $('detbar').style.width = Math.min(100, S.detect * 100) + '%';
  $('stance').textContent = P.crouch ? 'CROUCH' : '';
  { const mt = madTier(); $('madbar').style.width = S.madness + '%'; $('madlbl').textContent = mt === 2 ? '極限狂気' : mt === 1 ? '狂気' : '狂気'; $('madlbl').style.color = mt === 2 ? '#ff4d6a' : mt === 1 ? '#d070ff' : '#aaa'; $('madbar').style.background = mt === 2 ? '#f2204a' : '#a0d';
    const mv = $('madvig'); mv.style.opacity = mt === 0 ? S.madness / 35 * 0.25 : (mt === 1 ? 0.4 : 0.55 + Math.sin(performance.now() / 1000 * 5) * 0.12); renderer.domElement.style.filter = mt === 2 ? 'contrast(1.12) saturate(1.3)' : ''; }
  const iv = $('insp'); iv.style.opacity = insp.amt > 0.3 ? 1 : 0; if (insp.on) iv.innerHTML = `${WDEF[P.cur].name}<small>マウス/矢印で回転 ・ ホイールで拡大 ・ Yを離すと戻る</small>`;
}
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (S.state === 'play') { for (let k = window.__boost || 1; k > 0; k--) { update(dt); if (S.state !== 'play') break; } } else if (S.state === 'over') updateDebris(dt * 0.3);
  renderer.render(scene, camera);
}

/* ---------- 起動 ---------- */
camera.position.set(0, 1.7, 36.5);
loadCharacter(() => loadGuns(() => {
  buildViewmodels(); setWeapon('pistol'); renderWeaponHUD(); setVol('master', VOL.master); setVol('bgm', VOL.bgm); modelReady = true; $('mMission').disabled = false; $('mWave').disabled = false; $('mClub').disabled = false; showOverlay('menu');
}));
requestAnimationFrame(loop);
window.__game = { thrown, stuck, throwWeapon, tryFinisher, step(n, dt) { for (let i = 0; i < n; i++) update(dt || 0.02); }, get ready() { return modelReady; }, S, P, enemies, drops, spawnEnemy, begin, setWeapon, WDEF, playerFire, tryPickup, dropGun, makeNoise, becomeAlert, resetGame, keys };   // デバッグ用
