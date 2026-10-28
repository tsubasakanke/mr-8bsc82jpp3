"use strict";
/* ================= 近接武器: モデル(コードで作る)・性能・フィニッシャー ================= */
// 向きは銃と同じ: 前=-Z、上=+Y、原点=握る場所。ナイフ(Blender製)と同じ大きさ感で作る
const MELEE = ['knife', 'machete', 'axe', 'bat', 'katana', 'pipe'];
const _mm = c => new THREE.MeshLambertMaterial({ color: c });
const MM = { steel: _mm(0xd4dae2), dark: _mm(0x23201e), wood: _mm(0x7a4f2a), woodL: _mm(0xb48d57), gold: _mm(0xb8922e), rust: _mm(0x70747a), black: _mm(0x15151a), red: _mm(0x8a1010), tape: _mm(0x2c2c30), nail: _mm(0xbfc3c8) };
MM.steel.side = MM.rust.side = THREE.DoubleSide;   // 刃は薄い板なので、裏から見ても見えるように
function mcyl(r0, r1, len, z0, mat) {   // r0=先端側の半径、z0=手前側の端。-Z方向へ len だけ伸びる
  const g = new THREE.CylinderGeometry(r0, r1, len, 10); g.rotateX(-Math.PI / 2); g.translate(0, 0, z0 - len / 2); return new THREE.Mesh(g, mat);
}
function mbox(w, h, d, x, y, z, mat) { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return new THREE.Mesh(g, mat); }
function mprof(pts, thick, mat, x) {   // 横から見た輪郭 [前方への距離u, 上v] を厚みを付けて押し出す。刃物用
  const sh = new THREE.Shape(); pts.forEach((p, i) => i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1]));
  const g = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: false }); g.translate(0, 0, -thick / 2);
  g.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, x || 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1)); return new THREE.Mesh(g, mat);
}
function mgroup(list) {   // 同じ材質のパーツを1つにまとめて(描画回数を減らす)グループにする
  const by = new Map(); for (const m of list) { m.updateMatrix(); const g = m.geometry.clone(); g.applyMatrix4(m.matrix); let e = by.get(m.material); if (!e) by.set(m.material, e = []); e.push(g); }
  const out = new THREE.Group(); for (const [mat, geos] of by) { const m = new THREE.Mesh(mergeGeos(geos.map(g => g.index ? g : g.toNonIndexed())), mat); m.frustumCulled = false; out.add(m); } return out;
}
function buildMeleeModels() {
  GUNS.machete = mgroup([
    mcyl(0.017, 0.019, 0.17, 0.11, MM.dark), mbox(0.032, 0.075, 0.014, 0, 0, -0.062, MM.dark), mcyl(0.02, 0.02, 0.02, 0.11, MM.black),
    mprof([[0.06, -0.034], [0.06, 0.034], [0.5, 0.044], [0.6, 0.03], [0.63, -0.012], [0.5, -0.034]], 0.009, MM.steel),
    mprof([[0.06, 0.03], [0.06, 0.038], [0.5, 0.048], [0.5, 0.044]], 0.014, MM.rust),
  ]);
  GUNS.axe = mgroup([
    mcyl(0.015, 0.018, 0.84, 0.13, MM.wood), mbox(0.03, 0.075, 0.09, 0, 0, -0.66, MM.steel),
    mprof([[0.60, 0.0], [0.58, -0.17], [0.68, -0.235], [0.76, -0.17], [0.74, 0.0]], 0.022, MM.steel),
    mbox(0.034, 0.05, 0.07, 0, 0.055, -0.66, MM.dark), mcyl(0.019, 0.019, 0.05, 0.13, MM.black),
  ]);
  { const parts = [mcyl(0.044, 0.017, 0.86, 0.12, MM.woodL), mcyl(0.047, 0.047, 0.03, -0.69, MM.wood), mcyl(0.02, 0.02, 0.2, 0.12, MM.tape)];
    for (let i = 0; i < 9; i++) { const a = i * 2.4, z = -0.40 - (i % 5) * 0.06, r = 0.05; parts.push(mbox(0.01, 0.01, 0.01, Math.cos(a) * r, Math.sin(a) * r, z, MM.nail), mbox(0.006, 0.006, 0.026, Math.cos(a) * (r - 0.01), Math.sin(a) * (r - 0.01), z, MM.nail)); }   // 釘
    GUNS.bat = mgroup(parts); }
  GUNS.katana = mgroup([
    mcyl(0.017, 0.017, 0.26, 0.13, MM.black), mcyl(0.019, 0.019, 0.02, 0.0, MM.red), mcyl(0.019, 0.019, 0.02, -0.06, MM.red),
    (() => { const m = mcyl(0.045, 0.045, 0.012, -0.125, MM.gold); m.scale.set(1, 0.7, 1); return m; })(),
    mprof([[0.14, -0.017], [0.14, 0.016], [0.9, 0.016], [1.04, 0.003], [1.07, -0.004], [0.92, -0.015]], 0.007, MM.steel),
  ]);
  GUNS.pipe = mgroup([
    mcyl(0.021, 0.021, 0.78, 0.11, MM.rust), mcyl(0.028, 0.028, 0.045, -0.64, MM.dark), mcyl(0.027, 0.027, 0.03, -0.3, MM.dark), mcyl(0.024, 0.024, 0.14, 0.11, MM.tape),
  ]);
  const A = {
    machete: { tip: [0, 0.63, 0], grip: { center: [0, 0, 0], radius: 0.02 }, length: 0.75 }, axe: { tip: [0, 0.76, 0], grip: { center: [0, 0, 0], radius: 0.02 }, length: 0.95 },
    bat: { tip: [0, 0.72, 0], grip: { center: [0, 0, 0], radius: 0.02 }, length: 0.9 }, katana: { tip: [0, 1.07, 0], grip: { center: [0, 0, 0], radius: 0.02 }, length: 1.2 },
    pipe: { tip: [0, 0.67, 0], grip: { center: [0, 0, 0], radius: 0.02 }, length: 0.9 },
  };
  window.GUN_ANCHORS = Object.assign(window.GUN_ANCHORS || {}, A);
}
Object.assign(WDEF.knife, { hitF: 0.9, blade: true, rate: 0.4, sw: 0.34, power: 3, style: 'slash', e: { dmg: 10, rate: 0.7 } });
Object.assign(WDEF, {
  machete: { id: 'machete', hitF: 0.8, name: 'MACHETE', model: 'machete', melee: true, blade: true, rate: 0.48, sw: 0.44, range: 3.0, dmg: 90, power: 5, K: 1.0, give: 0, tilt: 0.7, roll: -0.5, style: 'slash', e: { dmg: 14, rate: 0.85 } },
  axe:     { id: 'axe', hitF: 0.95, name: 'FIRE AXE', model: 'axe', melee: true, blade: true, rate: 0.82, sw: 0.66, range: 2.9, dmg: 160, power: 9, K: 0.95, give: 0, tilt: 0.55, roll: -0.15, style: 'chop', e: { dmg: 24, rate: 1.3 } },
  bat:     { id: 'bat', hitF: 0.85, name: 'NAIL BAT', model: 'bat', melee: true, rate: 0.7, sw: 0.56, range: 3.1, dmg: 110, power: 12, K: 0.95, give: 0, tilt: 0.8, roll: -0.2, style: 'bash', e: { dmg: 18, rate: 1.1 } },
  katana:  { id: 'katana', hitF: 0.7, name: 'KATANA', model: 'katana', melee: true, blade: true, rate: 0.42, sw: 0.36, range: 3.4, dmg: 140, power: 6, K: 0.9, give: 0, tilt: 0.7, roll: -0.4, style: 'slash', e: { dmg: 20, rate: 0.8 } },
  pipe:    { id: 'pipe', hitF: 0.9, name: 'LEAD PIPE', model: 'pipe', melee: true, rate: 0.5, sw: 0.46, range: 3.0, dmg: 85, power: 8, K: 1.0, give: 0, tilt: 0.75, roll: -0.3, style: 'bash', e: { dmg: 14, rate: 0.9 } },
});
for (const id of MELEE.slice(1)) GRIP_AT[id] = GRIP_AT.knife.slice();
buildMeleeModels();
// 近接武器ごとのフィニッシャー。cut の引数は '振り方:部位'(slash 斜め斬り / chop 振り下ろし / bash 殴打 / low 足元 / stab 突き)、4番目は刺したまま保持する終了時刻
Object.assign(FIN, {
  knife:   { dur: 2.4, cost: 0, name: 'THROAT CUT', dist: 1.0, hands: 'neck', score: 300, grab: [[0.04, 0.45, 'mouth', 'mouth']], ev: [[0.45, 'cut', 'slash:neck'], [0.45, 'slow', 0.6], [0.95, 'knees'], [1.45, 'fall', 0.9]] },   // 首を切る → 敵は首を押さえてうずくまり、倒れる
  machete: { dur: 2.5, cost: 0, name: 'IMPALE', dist: 1.15, hands: 'wound', score: 400, grab: [[0.05, 0.5, 'shoulder', 'shoulder']], path: [[0, 0.5, 1.5, 1.7, 0.04], [0.45, 0.75, 1.0, 1.6, -0.02], [1.5, 0.75, 1.0, 1.6, -0.02]], hang: [0.55, 1.1], ev: [[0.55, 'cut', 'stab:torso', 1.1], [0.55, 'carve', 'chest:0.5'], [1.1, 'kick'], [1.1, 'launch', 15], [1.1, 'fall', 0.5], [1.1, 'slow', 0.5]] },   // 胴に突き刺して、蹴り飛ばす
  axe:     { dur: 2.4, cost: 0, name: 'CLEAVE', dist: 1.15, hands: 'flail', score: 500, ev: [[0.62, 'cut', 'chop:head'], [0.62, 'carve', 'split:0.95'], [0.62, 'launch', 5], [0.62, 'slow', 0.7], [0.62, 'fall', 0.7], [1.45, 'cut', 'chop:torso'], [1.45, 'carve', 'chest:0.6]'.replace(']', '')]] },
  bat:     { dur: 3.0, cost: 0, name: 'PULVERIZE', dist: 1.2, hands: 'up', score: 500, grab: [[0.05, 0.45, 'shoulder', 'shoulder']], ev: [[0.5, 'cut', 'bash:head'], [0.5, 'carve', 'face:0.2'], [0.52, 'knees'], [0.88, 'cut', 'bash:head'], [0.88, 'carve', 'face:0.4'], [1.22, 'cut', 'bash:head'], [1.22, 'carve', 'face:0.6'], [1.52, 'cut', 'bash:head'], [1.52, 'carve', 'face:0.8'], [1.8, 'cut', 'bash:head'], [1.8, 'carve', 'face:1.0'], [1.8, 'slow', 0.6], [1.85, 'fall', 0.7]] },   // ひたすら頭を殴って粉砕
  katana:  { dur: 2.7, cost: 0, name: 'BISECT', dist: 1.3, hands: 'flail', score: 600, grab: [[0.05, 0.6, 'shoulder', 'shoulder']], ev: [[0.7, 'cut', 'chop:head'], [0.7, 'bisect'], [0.7, 'slow', 0.9]] },   // 上から下へ真っ二つ
  pipe:    { dur: 2.8, cost: 0, name: 'BEATDOWN', dist: 1.1, hands: 'up', score: 400, ev: [[0.45, 'cut', 'low:knee'], [0.45, 'knees'], [0.95, 'cut', 'bash:torso'], [1.4, 'cut', 'bash:head'], [1.85, 'cut', 'bash:head'], [1.85, 'carve', 'side:0.85'], [1.85, 'slow', 0.6], [1.9, 'fall', 0.7]] },
});
// 銃のフィニッシャー: 最初の動きは歩いて近づき終わってから(0.5秒以降)
Object.assign(FIN.pistol, { dur: 3.3, cost: 1, hands: 'flail', grab: null, tilt: null,   // 拳銃を敵の顔に投げつける → 倒れたところへ歩み寄り、しゃがんで拾い、頭を撃つ
  path: [[0, 0.6, 1.8, 1.7, 0.05], [0.4, 0.3, 1.7, 1.7, 0.03], [0.9, 0.2, 1.35, 1.35, -0.03], [1.5, 0.3, 1.0, 1.15, 0.02]],
  ev: [[0.35, 'throw'], [0.55, 'hitprop'], [0.55, 'knees'], [0.57, 'fall', 0.8], [0.57, 'slow', 0.35], [1.2, 'pickup'], [1.85, 'shot', 'head'], [1.85, 'carve', 'top:0.8'], [1.85, 'whip', -1.3], [1.85, 'slow', 0.6]] });
const shiftEv = (F, d) => { F.ev = F.ev.map(x => [x[0] + d, ...x.slice(1)]); };
shiftEv(FIN.smg, 0.4); FIN.smg.dur = 2.9; FIN.smg.grab = [[0.3, 1.6, 'shoulder', 'shoulder']];
shiftEv(FIN.deagle, 0.35); FIN.deagle.dur = 2.7; FIN.deagle.grab = [[0.25, 1.3, 'head', 'face']]; FIN.deagle.tilt = [0.4, 1.0];
shiftEv(FIN.rifle, 0.4); FIN.rifle.dur = 3.4; FIN.rifle.grab = [[1.3, 2.4, 'shoulder', 'shoulder']];
