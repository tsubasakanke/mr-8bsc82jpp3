"use strict";
/* ================= 武器: データ・銃モデル・一人称の手・ドロップ ================= */

/* ---------- 武器データ。e = 敵が持ったときの性能 ---------- */
const WDEF = {
  knife:   { id: 'knife', name: 'KNIFE', model: 'knife', melee: true, rate: 0.55, range: 2.7, dmg: 70, K: 1.2, give: 0, tilt: 0.75, roll: -0.9 },
  pistol:  { id: 'pistol', name: 'SUPP. PISTOL', model: 'pistol', rate: 0.22, dmg: 38, pellets: 1, spread: 0.008, recoil: 0.1, snd: [2200, 0.07, 0.10, 0], power: 3, noise: 6, K: 1.35, give: 14, supp: true,
             e: { dmg: 6, gap: 0, burst: 1, rate: 1.0, acc: 0.32, range: 24, snd: [2200, 0.07, 0.08, 0] } },
  smg:     { id: 'smg', name: 'MAC-10', model: 'macten', rate: 0.07, dmg: 13, pellets: 1, spread: 0.04, recoil: 0.04, snd: [5000, 0.12, 0.30, 0], power: 5, noise: 40, K: 1.3, give: 40,
             e: { dmg: 4, gap: 0.075, burst: 5, rate: 1.0, acc: 0.30, range: 24, snd: [5000, 0.12, 0.14, 0] } },
  shotgun: { id: 'shotgun', name: 'SHOTGUN', model: 'mossberg', rate: 0.65, dmg: 11, pellets: 10, spread: 0.13, recoil: 0.22, snd: [3000, 0.3, 0.75, 160], power: 12, noise: 55, K: 1.0, give: 8,
             e: { dmg: 3, pellets: 6, gap: 0, burst: 1, rate: 1.7, acc: 0.5, range: 16, snd: [3000, 0.3, 0.3, 160] } },
  rifle:   { id: 'rifle', name: 'AK-47', model: 'rifle', rate: 0.1, dmg: 26, pellets: 1, spread: 0.012, recoil: 0.07, snd: [4200, 0.16, 0.4, 120], power: 7, noise: 60, K: 0.95, give: 30,
             e: { dmg: 7, gap: 0.1, burst: 3, rate: 0.9, acc: 0.40, range: 34, snd: [4200, 0.16, 0.2, 0] } },
  deagle:  { id: 'deagle', name: 'MAGNUM', model: 'deagle', rate: 0.4, dmg: 150, pellets: 1, spread: 0.003, recoil: 0.3, snd: [2500, 0.35, 0.9, 200], power: 16, noise: 65, K: 1.3, give: 7, pierce: true,
             e: { dmg: 14, gap: 0, burst: 1, rate: 1.4, acc: 0.45, range: 30, snd: [2500, 0.3, 0.3, 120] } },
};
const SLOTS = ['knife', 'pistol', 'smg', 'shotgun', 'rifle', 'deagle'];   // 1番は「今持っている近接武器」(P.melee)。拾うと入れ替わる
const allW = () => SLOTS.concat(MELEE.slice(1));
const slotId = i => i === 0 ? (P.melee || 'knife') : SLOTS[i];
const ownedList = () => [P.melee || 'knife'].concat(SLOTS.slice(1).filter(id => P.owned[id]));

/* ---------- 銃モデル(Blender製GLB)の読み込み。無いものは仮の箱で代用 ---------- */
const GUNS = {}, GUNS_LOD = {};   // LOD = 敵が持つ軽い版
const DEFAULT_ANCH = { muzzle: [0, 0.4, 0.05], grip: { center: [0, 0, 0], radius: 0.03 } };
const b2g = a => new THREE.Vector3(a[0], a[2], -a[1]);   // Blender座標 → three座標(前=-Z, 上=+Y)
const anchorsOf = model => (window.GUN_ANCHORS || {})[model] || DEFAULT_ANCH;
function fallbackGun(model) {
  const g = new THREE.Group(), mat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const bx = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); g.add(m); };
  if (model === 'knife') { bx(0.04, 0.03, 0.12, 0, 0, 0); bx(0.02, 0.05, 0.22, 0, 0, -0.17); }
  else { bx(0.05, 0.08, 0.4, 0, 0.08, -0.1); bx(0.04, 0.12, 0.05, 0, -0.02, 0.02); }
  return g;
}
function loadGuns(done) {
  const B = window.GUN_B64 || {}, LB = window.GUN_LOD_B64 || {}, names = Object.keys(B); let left = names.length + Object.keys(LB).length; if (!left) return done();
const matByColor = {};
  const colorFix = scn => scn.traverse(o => { if (o.isMesh) { const c = o.material.color ? o.material.color.clone().convertLinearToSRGB() : new THREE.Color(0x222222), k = c.getHexString(); o.material = matByColor[k] || (matByColor[k] = new THREE.MeshLambertMaterial({ color: c })); o.frustumCulled = false; } });
  const flatten = scn => {   // 敵が持つ軽量版: 全メッシュを材質ごとに1つへまとめる(描画回数を減らす)
    scn.updateMatrixWorld(true); const groups = new Map();
    scn.traverse(o => { if (o.isMesh) { let g = groups.get(o.material.uuid); if (!g) groups.set(o.material.uuid, g = { mat: o.material, geos: [] }); const geo = o.geometry.clone(); geo.applyMatrix4(o.matrixWorld); g.geos.push(geo); } });
    const out = new THREE.Group(); for (const g of groups.values()) { const m = new THREE.Mesh(mergeGeos(g.geos), g.mat); m.frustumCulled = false; out.add(m); } return out;
  };
  Object.keys(LB).forEach(name => {
    const bin = atob(LB[name]), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    new THREE.GLTFLoader().parse(u8.buffer, '', gltf => { colorFix(gltf.scene); GUNS_LOD[name] = flatten(gltf.scene); if (--left === 0) done(); }, () => { if (--left === 0) done(); });
  });
  names.forEach(name => {
    const bin = atob(B[name]), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const fin = () => { if (--left === 0) done(); };
    new THREE.GLTFLoader().parse(u8.buffer, '', gltf => {
      colorFix(gltf.scene);
      GUNS[name] = gltf.scene; fin();
    }, err => { console.error('gun load', name, err); fin(); });
  });
}
function gunNode(model, lod) { if (!GUNS[model]) GUNS[model] = fallbackGun(model); return (lod && GUNS_LOD[model] ? GUNS_LOD[model] : GUNS[model]).clone(true); }

/* ---------- 手の握り方。rel = 右手グリップ(=銃の原点)からの位置[ゲーム単位, 前=-Z] ---------- */
let HANDMODE = 2;   // 握りこぶしの向き: 2=指の向きを反転(手の甲がこちら側で、親指が刃のほう)
const HAND_BACK = 0.07, HAND_SIDE = 0.054;   // 手のひら中心は、グリップから「指の向きの逆に0.07」「手のひら向きの逆に0.054」
function handFrame(hd) {   // 銃の座標系での 指の向き f / 手のひらの向き p
  if (hd.kind === 'tube') return { f: [hd.s === 'L' ? 1 : -1, 0, 0], p: [0, 1, 0] };   // 筒を下から包む
  if (hd.kind === 'fist') {                                                             // 握りこぶし(ナイフ)。roll=柄の軸まわりのひねり
    const c = Math.cos(hd.roll || 0), s = Math.sin(hd.roll || 0), rot = v => [v[0] * c - v[1] * s, v[0] * s + v[1] * c, 0];
    const F = rot([-1, 0, 0]), Pp = rot([0, -1, 0]), neg = v => [-v[0], -v[1], -v[2]];
    return HANDMODE === 1 ? { f: neg(F), p: neg(Pp) } : HANDMODE === 2 ? { f: neg(F), p: Pp } : HANDMODE === 3 ? { f: F, p: neg(Pp) } : { f: F, p: Pp };   // 握りこぶしの向きの候補(画面で確認用)
  }
  return { f: [0, 0, -1], p: [hd.s === 'R' ? -1 : 1, 0, 0] };                           // 縦の柱を一周
}
const REVG = { tilt: -0.5, roll: Math.PI + 0.2 };   // 逆手持ち: 刃を下向きに握る
const gripOf = w => (typeof P !== 'undefined' && P.rev && w.melee) ? REVG : w;
const vmHands = w => (P.rev && w.handsRev) ? w.handsRev : w.hands;
function buildHold(w) {
  const A = anchorsOf(w.model), K = w.K;
  w.muzzleRel = b2g(A.muzzle || A.tip || DEFAULT_ANCH.muzzle).multiplyScalar(K);   // ナイフは「刃の先(tip)」
  const R = { s: 'R', kind: w.melee ? 'fist' : 'post', rel: [0, 0, 0], curl: 1.0, trig: !w.melee, tilt: w.tilt || 0, roll: w.roll || 0 };   // 近接武器の握りこぶしは、手の向きを180度回す(以前は手の甲と指が逆だった)
  let L = null;
  if (w.id === 'pistol' || w.id === 'deagle') L = { s: 'L', kind: 'post', rel: [0, -0.13, 0.0], curl: 1.0 };
  else if (w.id === 'smg') { const m = w.muzzleRel; L = { s: 'L', kind: 'tube', rel: [0, m.y - 0.06, m.z * 0.5], curl: 1.0 }; }
  else if (w.id === 'shotgun' && A.pump) { const c = b2g(A.pump.center).multiplyScalar(K); L = { s: 'L', kind: 'tube', rel: [c.x, c.y, c.z], curl: 1.0, pump: true }; }
  else if (w.id === 'rifle' && A.support) { const c = b2g(A.support.center).multiplyScalar(K); L = { s: 'L', kind: 'tube', rel: [c.x, c.y, c.z], curl: 1.0 }; }
  else if (w.id === 'shotgun' || w.id === 'rifle') L = { s: 'L', kind: 'tube', rel: [0, 0.0, w.muzzleRel.z * 0.45], curl: 1.0, pump: w.id === 'shotgun' };
  w.hands = L ? [R, L] : [R];
  if (w.melee) w.handsRev = [Object.assign({}, R, { tilt: REVG.tilt, roll: REVG.roll })];   // 逆手(R キー)の握り
  w.slideTravel = (A.slideTravel || 0.045);
  w.pumpTravel = ((A.pump && A.pump.travel) || 0.12) * K;
}
function palmRel(hd) {
  const { f, p } = handFrame(hd); let v = [hd.rel[0] - f[0] * HAND_BACK - p[0] * HAND_SIDE, hd.rel[1] - f[1] * HAND_BACK - p[1] * HAND_SIDE, hd.rel[2] - f[2] * HAND_BACK - p[2] * HAND_SIDE];
  if (hd.tilt) { const c = Math.cos(hd.tilt), s = Math.sin(hd.tilt); v = [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c]; }   // 銃の原点まわりに先端を持ち上げる(X軸回転)
  return v;
}
const _bq = new THREE.Quaternion(), _bf = new THREE.Vector3(), _bp = new THREE.Vector3(), _bx = new THREE.Vector3(), _bm = new THREE.Matrix4();
/* 手ノードのローカル軸(glTF): X=親指側の軸, +Y=手のひらの向き, −Z=指の向き。銃座標→手モデル空間は (x,y,z)→(-z,y,x) */
function handBasisQuat(q, hd) {
  const { f, p } = handFrame(hd);
  _bf.set(-f[2], f[1], f[0]); _bp.set(-p[2], p[1], p[0]); _bx.crossVectors(_bf, _bp).normalize();
  q.setFromRotationMatrix(_bm.makeBasis(_bx, _bp, _bf.clone().negate()));
  if (hd.tilt) q.premultiply(_bq.setFromAxisAngle(AZ, hd.tilt));
  return q;
}

/* ---------- 一人称ビュー(ビューモデル) ---------- */
const GRIP_AT = { knife: [0.26, -0.44, -0.55], pistol: [0.20, -0.40, -0.52], smg: [0.20, -0.42, -0.64], shotgun: [0.15, -0.40, -0.80], rifle: [0.16, -0.42, -0.85], deagle: [0.25, -0.38, -0.50] };
const gunGroup = new THREE.Group(); camera.add(gunGroup);
const GUN_BASE = new THREE.Vector3(0.08, 0.1, -0.12);
gunGroup.scale.setScalar(0.62);
const insp = { on: false, amt: 0, yaw: 0.6, pitch: 0.15, zoom: 1 };   // 銃を眺める(Y長押し)
const _ip = new THREE.Vector3(), _iq = new THREE.Quaternion(), _iq0 = new THREE.Quaternion(), _ie = new THREE.Euler();
const vm = {}, fp = { ready: false, N: {}, wrap: {}, h: {} };
let fpFire = 0, vmRecoil = 0, vmSwitch = 0, swingT = 0, swingHit = true, flashT = 0, kick = 0, stabT = 0, rollKick = 0;
// フィニッシャー中は銃を「銃口が画面の中央(=敵の狙う場所)に来る」位置へ寄せる。銃口までの距離・画面内のずれは銃ごとに計算する
const FIN_THRUST = { pistol: 0.3, smg: 0.32, shotgun: 0.42, rifle: 0.3, deagle: 0.4 };
function finTipForward(id) { const w = WDEF[id], g0 = GRIP_AT[id]; return (FIN_THRUST[id] || 0) - GUN_BASE.z - 0.62 * (g0[2] + w.muzzleRel.z); }   // カメラから銃口までの前方距離
const gunBaseX = () => GUN_BASE.x - (1 - Math.min(1, innerWidth / innerHeight / 1.6)) * 0.35;   // 画面が縦長のとき銃を内側に寄せる補正(updateViewmodelと同じ式)
function finTipOffset(id) { const w = WDEF[id], g0 = GRIP_AT[id]; return [gunBaseX() + 0.62 * (g0[0] + w.muzzleRel.x), GUN_BASE.y + 0.62 * (g0[1] + w.muzzleRel.y)]; }   // 銃口の画面内オフセット
function finAimAngles(id, thrust) {   // 銃口が画面中央(0,0)に来るよう、銃全体を回す角度(rx,ry)。銃の本体は画面の端に残る(画面を覆わない)
  const w = WDEF[id], g0 = GRIP_AT[id], v = new THREE.Vector3(0.62 * (g0[0] + w.muzzleRel.x), 0.62 * (g0[1] + w.muzzleRel.y), 0.62 * (g0[2] + w.muzzleRel.z));
  const px = gunBaseX(), py = GUN_BASE.y, pz = GUN_BASE.z - thrust, e = new THREE.Euler(0, 0, 0, 'XYZ'), tip = new THREE.Vector3(); let rx = 0, ry = 0;
  for (let i = 0; i < 5; i++) { e.set(rx, ry, 0); tip.copy(v).applyEuler(e); tip.x += px; tip.y += py; tip.z += pz; const f = Math.max(0.3, -tip.z); ry += tip.x / f; rx -= tip.y / f; }
  return [rx, ry];
}
const _qn = new THREE.Quaternion(), _qz = new THREE.Quaternion(), ZV = new THREE.Vector3(0, 0, 1);
function tipLocal(id, fr) {   // 銃(刃)の先端の、gunGroup 内での位置。持ち方の傾き(tilt/roll)も含める
  const w = WDEF[id], g0 = GRIP_AT[id], gp = gripOf(w); _qn.setFromAxisAngle(AX, gp.tilt || 0).multiply(_qz.setFromAxisAngle(ZV, gp.roll || 0));
  return new THREE.Vector3(w.muzzleRel.x * fr, w.muzzleRel.y * fr, w.muzzleRel.z * fr).applyQuaternion(_qn).add(new THREE.Vector3(g0[0], g0[1], g0[2]));
}
function finAim(id, Dt, frac) {   // 銃口がカメラから前方 Dt の位置(画面の中央)に来る「銃の回転(rx,ry)」と「前へ突き出す量 T」を、数値で解く
  const w = WDEF[id], g0 = GRIP_AT[id], fr = frac || 1, v = tipLocal(id, fr).multiplyScalar(0.62);
  const px = gunBaseX(), py = GUN_BASE.y, e = new THREE.Euler(0, 0, 0, 'XYZ'), tip = new THREE.Vector3(); let rx = 0, ry = 0, T = 0.3;
  for (let i = 0; i < 8; i++) {
    const pz = GUN_BASE.z - T;
    for (let j = 0; j < 4; j++) { e.set(rx, ry, 0); tip.copy(v).applyEuler(e); tip.x += px; tip.y += py; tip.z += pz; const f = Math.max(0.3, -tip.z); ry += tip.x / f; rx -= tip.y / f; }
    e.set(rx, ry, 0); tip.copy(v).applyEuler(e); T = Math.max(-0.25, Math.min(1.0, GUN_BASE.z + tip.z + Dt));
  }
  return [rx, ry, T];
}
const _bR = new THREE.Quaternion(), _bE = new THREE.Euler(), _bT = new THREE.Vector3(), _bG = new THREE.Vector3(), _bB = new THREE.Vector3(), _bP = new THREE.Vector3();
function buttPose(Dt, side) {   // 銃を逆さにして、銃床の先が「カメラの前方 Dt の画面中央」に来る姿勢 [sx,sy,sz,rx,ry,rz]。握りの位置を基準にする
  const g0 = GRIP_AT.rifle, rx = -0.45, ry = Math.PI + side * 0.3, rz = side * 0.15;
  _bR.setFromEuler(_bE.set(rx, ry, rz, 'XYZ')); _bB.set(0, 0.0, 0.40).multiplyScalar(0.62).applyQuaternion(_bR);   // 銃床の位置(握りから)
  _bG.set(g0[0], g0[1], g0[2]).multiplyScalar(0.62).applyQuaternion(_bR);                                         // 握りの、銃の原点からの位置
  _bT.set(side * 0.04, 0.0, -Dt).sub(_bB);                                                                         // 握りがあるべき位置
  _bP.copy(_bT).sub(_bG);                                                                                          // 銃の原点
  return [_bP.x - gunBaseX(), _bP.y - GUN_BASE.y, _bP.z - GUN_BASE.z, rx, ry, rz];
}
function finReach(id, T) {   // 突き出し量 T のとき、銃口がカメラから前方どれだけに届くか(銃の回転で縮む分も含める)
  const v = tipLocal(id, 1).multiplyScalar(0.62);
  const px = gunBaseX(), py = GUN_BASE.y, pz = GUN_BASE.z - T, e = new THREE.Euler(0, 0, 0, 'XYZ'), tip = new THREE.Vector3(); let rx = 0, ry = 0;
  for (let j = 0; j < 6; j++) { e.set(rx, ry, 0); tip.copy(v).applyEuler(e); tip.x += px; tip.y += py; tip.z += pz; const f = Math.max(0.3, -tip.z); ry += tip.x / f; rx -= tip.y / f; }
  return -tip.z;
}
const finApproach = (id, sc, r) => finReach(id, FIN_THRUST[id] || 0.3) + (r === undefined ? 0.45 * sc : r) + 0.02;   // 銃口が頭の表面に届く、カメラと狙う場所の距離
function finAimDist() {   // 今のカメラから、狙う場所までの実際の距離
  const a = P.finishAim; if (!a) return 1; return Math.hypot(a.x - P.pos.x, a.z - P.pos.z, a.y - (P.pos.y + P.eye));
}
function finisherWorldTip(id, fr) { gunGroup.updateMatrixWorld(true); return gunGroup.localToWorld(tipLocal(id, fr || 1)); }
function finPulse(v) { if (P.finish) P.finish.p = Math.max(P.finish.p || 0, v || 1); }
const flashTexFP = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 1, 32, 32, 31); g.addColorStop(0, 'rgba(255,255,230,1)'); g.addColorStop(0.3, 'rgba(255,205,110,0.85)'); g.addColorStop(1, 'rgba(255,120,30,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();   // 発砲炎: 四角い板でなく、にじむ光
const flashMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), new THREE.MeshBasicMaterial({ map: flashTexFP, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false }));
flashMesh.visible = false; flashMesh.renderOrder = 10; gunGroup.add(flashMesh);

function buildViewmodels() {
  const skin = new THREE.MeshLambertMaterial({ color: 0xe7e7e7 });
  for (const id of allW()) {
    const w = WDEF[id]; buildHold(w);
    const n = gunNode(w.model); n.scale.setScalar(w.K); n.position.set(...GRIP_AT[id]); n.quaternion.setFromAxisAngle(AX, w.tilt || 0).multiply(_bq.setFromAxisAngle(new THREE.Vector3(0, 0, 1), w.roll || 0)); n.visible = false; gunGroup.add(n);
    const slide = n.getObjectByName('Slide') || n.getObjectByName('Bolt');
    vm[id] = { node: n, slide, slideBase: slide ? slide.position.z : 0, pump: n.getObjectByName('Pump'), pumpBase: 0 };
    if (vm[id].pump) vm[id].pumpBase = vm[id].pump.position.z;
  }
  for (const side of ['L', 'R']) {
    const h = MODEL.getObjectByName('Hand' + side).clone(true), N = {};
    h.traverse(o => { N[o.name] = o; if (o.isMesh) { o.material = skin; o.frustumCulled = false; } });
    h.position.set(0, 0, 0);
    const wrap = new THREE.Group(); wrap.rotation.y = Math.PI / 2; wrap.scale.setScalar(0.085); wrap.add(h); gunGroup.add(wrap);
    fp.N[side] = N; fp.wrap[side] = wrap; fp.h[side] = h;
  }
  buildFoot(); fp.ready = true;
}
function viewmodelHands() { return vmHands(WDEF[P.cur]); }
function toggleGrip() {   // 順手 ⇄ 逆手(近接武器の持ち方)
  P.rev = !P.rev;
  for (const id of MELEE) { const w = WDEF[id], gp = gripOf(w); vm[id].node.quaternion.setFromAxisAngle(AX, gp.tilt || 0).multiply(_bq.setFromAxisAngle(new THREE.Vector3(0, 0, 1), gp.roll || 0)); }
  if (fp.ready) applyFpPose(); showMsg(P.rev ? '逆手' : '順手', false, '#ccc'); if (WDEF[P.cur].melee) vmSwitch = 0.6;
}
function applyFpPose() {
  const w = WDEF[P.cur];
  for (const s of ['L', 'R']) { const hd = vmHands(w).find(h => h.s === s); fp.wrap[s].visible = !!hd; if (hd) handBasisQuat(fp.h[s].quaternion, hd); }
  for (const id of allW()) vm[id].node.visible = id === P.cur;
  flashMesh.position.set(GRIP_AT[P.cur][0] + w.muzzleRel.x, GRIP_AT[P.cur][1] + w.muzzleRel.y, GRIP_AT[P.cur][2] + w.muzzleRel.z - 0.05);
}
/* ---------- 打撃モーション: 振りかぶり(ゆっくり・力をためる) → 一気に振り抜く(加速) → 行き過ぎて戻る → 余韻。強弱を付ける ----------
   u=0..1 を p=-1(振りかぶり)〜+1(打撃)に変換。ポーズは [横, 縦, 前後, rx(先端の上下), ry(左右の振り), rz(ひねり)] */
const STY = {
  slash:  [[0.5, 0.28, 0.18, 0.45, -1.0, -0.4], [-0.78, -0.2, -0.46, -0.15, 0.95, 0.6]],
  slashB: [[-0.6, 0.2, 0.14, 0.4, 1.0, 0.35], [0.62, -0.2, -0.42, -0.12, -0.9, -0.6]],
  chop:   [[0.04, 0.52, 0.18, 1.3, 0.1, 0.1], [-0.12, -0.58, -0.62, -1.0, -0.1, -0.1]],
  bash:   [[0.62, 0.08, 0.16, 0.12, -1.4, -0.35], [-0.82, -0.12, -0.42, -0.12, 1.5, 0.25]],
  low:    [[0.32, 0.12, 0.10, 0.40, 0.60, 0.30], [-0.30, -0.58, -0.36, -0.70, -0.60, -0.40]],
  stab:   [[0.0, 0.0, 0.16, 0.12, 0.0, 0.0], [-0.04, 0.03, -0.58, -0.20, -0.12, 0.0]],
  butt:   [[-0.14, 0.0, 0.12, 0.0, 0.80, -0.20], [0.30, 0.0, -0.36, 0.0, -1.30, 0.70]],
  buttB:  [[0.34, 0.0, 0.12, 0.0, -0.80, 0.20], [-0.30, 0.0, -0.36, 0.0, 1.30, -0.70]],
};
// 近接フィニッシャー用: 振りかぶりの位置(命中ポーズからのずれ)と、命中時のひねり
const STYW = { slash: [0.75, 0.32, 0.35, 0.30, -1.2, -0.5], slashB: [-0.75, 0.25, 0.30, 0.25, 1.2, 0.5], chop: [0.05, 0.55, 0.35, 1.35, 0.15, 0.1], bash: [0.8, 0.1, 0.3, 0.1, -1.6, -0.4], low: [0.4, 0.3, 0.2, 0.7, 0.8, 0.3], stab: [0, 0, 0.5, 0.1, 0, 0] };
const STYH = { slash: [0.8, 0.25, 0.55], slashB: [-0.8, 0.25, 0.55], chop: [0.08, 0.92, 0.3], bash: [0.85, 0.05, 0.5], low: [0.3, 0.8, 0.5] };   // 命中の瞬間、握りの手が刃の先に対してどちら側にあるか(カメラ空間)。刃を画面に対して斜めに見せる
const _fp = new THREE.Vector3(), _fC = new THREE.Vector3(), _fG = new THREE.Vector3(), _fh = new THREE.Vector3(), _fa = new THREE.Vector3(), _fn = new THREE.Vector3(), _fv = new THREE.Vector3(), _fq = new THREE.Quaternion(), _fq2 = new THREE.Quaternion(), _fq3 = new THREE.Quaternion(), _fE = new THREE.Euler(), _qI = new THREE.Quaternion();
function applyFinFx(fx, id, pos, q) {   // 刃の先(当たる点)を動かさずに、武器を画面に対して斜めに寝かせ、刃の腹がカメラ側に向くようにひねる
  const w = WDEF[id], fr = w.hitF || 1, tip = tipLocal(id, fr).multiplyScalar(0.62), g0 = GRIP_AT[id], grip = _fG.set(g0[0], g0[1], g0[2]).multiplyScalar(0.62).clone();
  _fC.copy(tip).applyQuaternion(q).add(pos); _fp.copy(grip).applyQuaternion(q).add(pos); _fh.set(...fx.h).normalize();
  const h0 = _fp.clone().sub(_fC).normalize(); _fq.setFromUnitVectors(h0, _fh); _fq2.copy(_qI).slerp(_fq, fx.w);   // 手の向きを h へ
  q.premultiply(_fq2); pos.sub(_fC).applyQuaternion(_fq2).add(_fC);
  _fp.copy(grip).applyQuaternion(q).add(pos); _fa.copy(_fC).sub(_fp).normalize();   // 刃の軸(手→先端)
  if (fx.e) { _fn.set(0, -1, 0).applyQuaternion(q); _fv.set(...fx.e); } else { _fn.set(1, 0, 0).applyQuaternion(q); _fv.set(0, 0, 1); }   // 刃物: 切れる側を振る方向へ / 鈍器: 平らな面をカメラへ
  _fn.addScaledVector(_fa, -_fn.dot(_fa)); _fv.addScaledVector(_fa, -_fv.dot(_fa)); if (_fn.lengthSq() < 1e-4 || _fv.lengthSq() < 1e-4) return;
  _fn.normalize(); _fv.normalize(); let ang = Math.atan2(_fa.dot(_fn.clone().cross(_fv)), _fn.dot(_fv)); if (!fx.e) { if (ang > Math.PI / 2) ang -= Math.PI; else if (ang < -Math.PI / 2) ang += Math.PI; } else ang = Math.max(-0.9, Math.min(0.9, ang));   // 刃は手首が回りすぎない範囲(約50度)で   // 裏表どちらでも近いほうの面を向ける
  _fq2.setFromAxisAngle(_fa, ang * fx.w); q.premultiply(_fq2); pos.sub(_fC).applyQuaternion(_fq2).add(_fC);
}
const STYE = { slash: [-1, 0, 0], slashB: [1, 0, 0], chop: [0, -0.3, -1], low: [0, -1, 0], stab: [0, -1, 0] };   // 振る方向に刃の「切れる側」を向ける(カメラ空間)
const STYR = { slash: -0.5, slashB: 0.5, chop: 0, bash: -0.2, low: -0.3, stab: 0 };
const STRIKE_LEN = { slash: 0.8, slashB: 0.8, chop: 0.95, bash: 0.9, low: 0.8, stab: 0.55, butt: 0.8, buttB: 0.8 };
function strikeP(u) {
  if (u <= 0 || u >= 1) return 0;
  if (u < 0.34) { const k = u / 0.34; return -(k * k * (3 - 2 * k)); }
  if (u < 0.46) { const k = (u - 0.34) / 0.12; return -1 + 2.15 * k * k; }
  if (u < 0.62) { const k = (u - 0.46) / 0.16; return 1.15 - 0.15 * (k * k * (3 - 2 * k)); }
  const k = (u - 0.62) / 0.38; return 1 - k * k * (3 - 2 * k);
}
/* ---------- 刃の軌跡(振った瞬間だけ光る尾) ---------- */
const TRN = 14, trPos = new Float32Array(TRN * 6), trCol = new Float32Array(TRN * 6), trHist = [], trGeo = new THREE.BufferGeometry();
trGeo.setAttribute('position', new THREE.BufferAttribute(trPos, 3).setUsage(THREE.DynamicDrawUsage)); trGeo.setAttribute('color', new THREE.BufferAttribute(trCol, 3).setUsage(THREE.DynamicDrawUsage));
{ const idx = []; for (let i = 0; i < TRN - 1; i++) { const a = 2 * i; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } trGeo.setIndex(idx); }
const trMesh = new THREE.Mesh(trGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
trMesh.frustumCulled = false; trMesh.renderOrder = 8; camera.add(trMesh);
function updateTrail(dt, on) {
  const w = WDEF[P.cur];
  if (on && w.melee) { const a = tipLocal(P.cur, 1).multiplyScalar(0.62).applyQuaternion(gunGroup.quaternion).add(gunGroup.position), b = tipLocal(P.cur, 0.72).multiplyScalar(0.62).applyQuaternion(gunGroup.quaternion).add(gunGroup.position); trHist.unshift({ a, b, age: 0 }); }
  for (const h of trHist) h.age += dt; while (trHist.length > TRN || (trHist.length && trHist[trHist.length - 1].age > 0.15)) trHist.pop();
  const c = w.blade ? [1, 0.95, 0.9] : [1, 0.7, 0.55];
  for (let i = 0; i < TRN; i++) {
    const h = trHist[Math.min(i, trHist.length - 1)], k = trHist[i] ? Math.pow(1 - Math.min(1, trHist[i].age / 0.15), 1.8) * 0.4 : 0;
    if (!h) { for (let j = 0; j < 6; j++) { trPos[i * 6 + j] = 0; trCol[i * 6 + j] = 0; } continue; }
    trPos[i * 6] = h.a.x; trPos[i * 6 + 1] = h.a.y; trPos[i * 6 + 2] = h.a.z; trPos[i * 6 + 3] = h.b.x; trPos[i * 6 + 4] = h.b.y; trPos[i * 6 + 5] = h.b.z;
    for (let j = 0; j < 2; j++) { trCol[i * 6 + j * 3] = c[0] * k; trCol[i * 6 + j * 3 + 1] = c[1] * k; trCol[i * 6 + j * 3 + 2] = c[2] * k * (j ? 0.5 : 1); }
  }
  trGeo.attributes.position.needsUpdate = true; trGeo.attributes.color.needsUpdate = true;
}
const _pose = [0, 0, 0, 0, 0, 0];
function stylePose(st, p, out) { const a = (STY[st] || STY.slash)[p < 0 ? 0 : 1], k = Math.abs(p); out = out || _pose; for (let i = 0; i < 6; i++) out[i] = a[i] * k; return out; }
function finStrikes(kind) {   // フィニッシャーの時刻表から「いつ・どんな打撃か」を取り出す
  const F = FIN[kind]; if (F._st) return F._st; const l = [];
  for (const [t, act, arg, hold] of F.ev) { if (act === 'stab') l.push([t, 'stab']); else if (act === 'smash') l.push([t, arg > 0 ? 'butt' : 'buttB']); else if (act === 'cut') l.push([t, arg.split(':')[0], hold]); }
  return F._st = l;
}
function strikeAt(strikes, ft) {   // いま有効な打撃 [振り方, u] 。連続攻撃では、前の命中の直後から次の振りかぶりを始める(時間が短ければ縮める)
  let found = null;
  for (let i = 0; i < strikes.length; i++) {
    const [te, sty, hold] = strikes[i], L = STRIKE_LEN[sty], start = Math.max(te - 0.46 * L, i ? (strikes[i - 1][2] || strikes[i - 1][0]) + 0.12 : -1); if (ft < start) break;
    let u; if (ft < te) u = 0.46 * (ft - start) / Math.max(0.05, te - start); else if (hold && ft < hold) u = 0.52; else if (hold) u = 0.52 + 0.48 * (ft - hold) / 0.3; else u = 0.46 + 0.54 * (ft - te) / (0.54 * L);   // hold: 刺したまま保持 → 引き抜く
    found = u < 1 ? [sty, u] : null;
  }
  return found;
}
const finVM = [0, 0, 0, 0, 0, 0]; let fxH = null, fxE = null, fxW = 0, swStyle = 'slash', swCombo = 0, swingLunged = false, trOn = false;
/* ---------- 左手でつかむ(サイバーパンク風のフィニッシャー): 相手の頭・肩・口を、見えている左手でつかむ ---------- */
let grabOn = false, grabW = 0; const _gM = new THREE.Matrix4(), _gI = new THREE.Matrix4(), _gQ = new THREE.Quaternion(), _gE = new THREE.Euler(), _gP = new THREE.Vector3(), _gF = new THREE.Vector3(), _gA = new THREE.Vector3(), _gB = new THREE.Vector3(), _gC = new THREE.Vector3(), _gS = new THREE.Vector3(1, 1, 1);
const GRABST = { face: [[0, 1, 0], [0, 0, -1], 0.9], mouth: [[0, 1, 0.1], [0, 0.1, -1], 1.0], shoulder: [[0.1, -0.8, -0.5], [0, 0.5, -0.85], 0.9], push: [[0, 1, 0], [0, 0, -1], 0.2] };   // [指の向き, 手のひらの向き, 握り具合] (カメラ空間)
function finGrabTarget(e, tg, out) {   // 掴む場所(ワールド)
  const sc = e.type.scale, tx = P.pos.x - e.pos.x, tz = P.pos.z - e.pos.z, d = Math.hypot(tx, tz) || 1, nx = tx / d, nz = tz / d;
  if (tg === 'shoulder') return out.set(e.pos.x + nx * 0.22 * sc + nz * 0.3 * sc, finTargetY(e, 'chest') + 0.3 * sc, e.pos.z + nz * 0.22 * sc - nx * 0.3 * sc);
  if (tg === 'mouth') return out.set(e.pos.x + nx * 0.36 * sc, finTargetY(e, 'head') - 0.1 * sc, e.pos.z + nz * 0.36 * sc);
  return out.set(e.pos.x + nx * 0.3 * sc + nz * 0.26 * sc, finTargetY(e, 'head') + 0.12 * sc, e.pos.z + nz * 0.3 * sc - nx * 0.26 * sc);   // head: 顔の横〜こめかみをつかむ(顔を隠さない)
}
function applyGrab(dt) {
  const fin = P.finish, G = fin && FIN[fin.kind].grab; let g = null;
  if (G) for (const x of G) if (fin.t >= x[0] && fin.t < x[1]) g = x;
  if (!g || !fp.ready) { grabW = 0; if (grabOn) { grabOn = false; applyFpPose(); } return; }
  grabOn = true; grabW += (1 - grabW) * (1 - Math.exp(-8 * dt));
  const e = fin.e, st = GRABST[g[3]] || GRABST.face; finGrabTarget(e, g[2], _gP);
  // カメラ空間(今フレームの視点で)→ gunGroup のローカルへ
  _gE.set(P.pitch, P.yaw, 0, 'YXZ'); _gQ.setFromEuler(_gE); _gM.compose(_gA.set(P.pos.x, P.pos.y + P.eye, P.pos.z), _gQ, _gS); _gI.copy(_gM).invert(); _gP.applyMatrix4(_gI); if (_gP.length() > 0.85) _gP.setLength(0.85);   // 左手も腕の長さの範囲まで
  gunGroup.updateMatrix(); _gM.copy(gunGroup.matrix).invert(); _gP.applyMatrix4(_gM);
  const w = fp.wrap.L; w.visible = true; w.position.lerp(_gP, grabW);
  const qg = gunGroup.quaternion.clone().invert(); _gF.set(...st[0]).normalize().applyQuaternion(qg); _gB.set(...st[1]).normalize().applyQuaternion(qg);
  _gB.addScaledVector(_gF, -_gB.dot(_gF)).normalize();   // 指と手のひらの向きを直交に
  _bf.set(-_gF.z, _gF.y, _gF.x); _bp.set(-_gB.z, _gB.y, _gB.x); _bx.crossVectors(_bf, _bp).normalize();
  fp.h.L.quaternion.setFromRotationMatrix(_bm.makeBasis(_bx, _bp, _bf.clone().negate()));
  setCurl(fp.N.L, 'L', st[2] * (0.55 + 0.45 * grabW));
}
/* ---------- フィニッシャーの小道具: 投げた銃(飛ぶ→床に落ちる→拾う)と、蹴りの足 ---------- */
let finProp = null, vmHidden = false;
function finThrowProp(kind, e) {   // 手元の銃を敵の顔へ投げつける
  const w = WDEF[kind], n = gunNode(w.model), m = new THREE.Group(); n.scale.setScalar(w.K * 0.9); m.add(n); scene.add(m);
  camera.updateMatrixWorld(true); const from = finisherWorldTip(kind), to = new THREE.Vector3(e.pos.x, finTargetY(e, 'head'), e.pos.z);
  m.position.copy(from); m.quaternion.copy(camera.quaternion);
  finProp = { m, from, to, t: 0, dur: 0.2, state: 'fly', rest: (() => { const kp = finPath(kind, 1.15, e), ax = -e.away.x, az = -e.away.z, c = Math.cos(kp.ang), s = Math.sin(kp.ang), d = (e.finD || 1) * kp.m * 0.8; return new THREE.Vector3(e.pos.x + (ax * c - az * s) * d, 0.07, e.pos.z + (ax * s + az * c) * d); })(), ang: rnd(0, 6) };
  if (P.finish) { P.finish.gunOut = true; P.finish.outT = P.finish.t; } sndSwish();
}
function finPickupProp() { if (finProp) { scene.remove(finProp.m); finProp = null; } if (P.finish) { P.finish.gunOut = false; P.finish.pick = P.finish.t; } sndPickup(); }
function updateFinProp(dt) {
  const p = finProp; if (!p) return; p.t += dt;
  if (p.state === 'fly') { const u = Math.min(1, p.t / p.dur); p.m.position.lerpVectors(p.from, p.to, u); p.m.position.y += Math.sin(u * Math.PI) * 0.15; p.m.rotateX(-24 * dt); p.m.rotateZ(9 * dt); if (u >= 1) { p.state = 'fall'; p.t = 0; p.v = 0; p.start = p.m.position.clone(); } }
  else if (p.state === 'fall') { const u = Math.min(1, p.t / 0.35); p.m.position.lerpVectors(p.start, p.rest, u); p.m.position.y = p.rest.y + (p.start.y - p.rest.y) * (1 - u) * (1 - u) + Math.abs(Math.sin(u * Math.PI * 1.5)) * 0.08 * (1 - u); p.m.rotateX(-10 * (1 - u) * dt); if (u >= 1) p.state = 'rest'; }
}
const fpFoot = new THREE.Group(); let fpKick = -1;
function buildFoot() { const f = MODEL.getObjectByName('FootL').clone(true), mat = new THREE.MeshLambertMaterial({ color: 0x4a4a4a }); f.traverse(o => { if (o.isMesh) { o.material = mat; o.frustumCulled = false; } }); f.position.set(0, 0, 0); f.rotation.set(0, 0, 0);
  const wr = new THREE.Group(); wr.rotation.y = Math.PI / 2; wr.scale.setScalar(0.17); wr.add(f); fpFoot.add(wr); fpFoot.visible = false; camera.add(fpFoot); }
function startKickAnim() { fpKick = 0; }
function updateKickAnim(dt) {   // 蹴り足: 画面下から振り上がって、前へ突き出し、戻る
  if (fpKick < 0) { fpFoot.visible = false; return; }
  fpKick += dt * Math.max(0.35, S.ts) / 0.55;   // スローモーションの間は足もゆっくり if (fpKick >= 1) { fpKick = -1; fpFoot.visible = false; return; }
  const u = fpKick, e1 = u < 0.35 ? u / 0.35 : 1 - (u - 0.35) / 0.65, k = e1 * e1 * (3 - 2 * e1), s = u < 0.35 ? 1 : 0;
  fpFoot.visible = true; fpFoot.position.set(0.08 - 0.08 * k, -0.95 + 0.7 * k, -0.25 - 0.8 * k); fpFoot.rotation.set(-0.3 - 0.5 * k, 0.1, 0.05);
}
function updateViewmodel(dt) {
  if (!fp.ready) return;
  const w = WDEF[P.cur], v = vm[P.cur], g0 = GRIP_AT[P.cur];
  fpFire = Math.max(0, fpFire - dt * 7); vmRecoil *= Math.exp(-14 * dt); vmSwitch = Math.max(0, vmSwitch - dt * 4.5);
  const pumpPhase = P.pumpT > 0 ? Math.sin((1 - P.pumpT) * Math.PI) : 0; P.pumpT = Math.max(0, P.pumpT - dt * 1.6);
  const pz = pumpPhase * w.pumpTravel;
  if (v.slide) v.slide.position.z = v.slideBase + fpFire * (w.id === 'smg' || w.id === 'rifle' ? 0.03 : w.slideTravel);
  if (v.pump) v.pump.position.z = v.pumpBase + pz / w.K;
  for (const hd of vmHands(w)) {
    const q = palmRel(hd);
    fp.wrap[hd.s].position.set(g0[0] + q[0], g0[1] + q[1], g0[2] + q[2] + (hd.pump ? pz : 0));
    setCurl(fp.N[hd.s], hd.s, hd.curl, hd.trig ? hd.curl * 0.45 + fpFire * 0.8 : undefined);
  }
  // 持ち替え・反動・ナイフの振り
  let sx = 0, sy = 0, sz = 0, rx = vmRecoil * 0.6, ry = 0, rz = 0, finFx = null;
  sy -= vmSwitch * 0.55; sz += vmRecoil;
  if (P.rev && w.melee) { sy += 0.24; sx -= 0.1; sz -= 0.06; }   // 逆手: 拳を胸の前に上げて、刃を前へ突き出す
  if (insp.on) { swingT = 0; stabT = 0; }
  if (P.finish) {   // フィニッシャー中: 近づいて構え → 出来事ごとに打撃モーション(振りかぶり→振り抜き→余韻) / 銃は銃口を相手に押し当てて撃つ
    const fk = P.finish.kind, ft = P.finish.t, F = FIN[fk], p = P.finish.p; P.finish.p *= Math.exp(-9 * dt);
    vm[P.cur].node.visible = !P.finish.gunOut; vmHidden = !!P.finish.gunOut;
    if (P.finish.gunOut) sy -= 0.35 * ease01(P.finish.outT || 0, (P.finish.outT || 0) + 0.3, ft);   // 銃を投げた後、手はゆっくり下がる
    else if (P.finish.pick !== undefined) { const u = ease01(P.finish.pick, P.finish.pick + 0.4, ft); sy -= (1 - u) * 0.35; rx -= (1 - u) * 0.5; }   // 拾った銃を構え直す(手は下から戻ってくる)
    const strikes = finStrikes(fk), tgt = [0, 0, 0, 0, 0, 0], ready = ease01(0, 0.32, ft) * (1 - ease01(F.dur - 0.7, F.dur - 0.2, ft));
    const melee = MELEE.includes(fk);
    if (melee) {   // 近接: 打撃の瞬間に、刃の先が狙う場所に確実に届くポーズ(I)を数値で求め、振りかぶり(W)→I→余韻 とつなぐ
      const sa0 = strikeAt(strikes, ft), sc = P.finish.e.type.scale, [ax, ay, T0] = finAim(fk, finAimDist() - (P.finishAim.r || 0.4 * sc) - 0.04 + (sa0 && sa0[0] === 'stab' ? 0.3 : 0), WDEF[fk].hitF || 1), R = [-0.06 * ready, 0.05 * ready, 0, 0.18 * ready, 0, 0], T = Math.min(T0, 0.3 + (sa0 && sa0[0] === 'stab' ? 0.3 : 0));   // 腕が伸びすぎない(足りない分は歩いて近づく)
      for (let i = 0; i < 6; i++) tgt[i] = R[i];
      const sa = sa0; if (sa && sa[1] > 0.3 && sa[1] < 0.8) trOn = true;
      if (sa) { const sty = sa[0], I = [0, 0, -T, ax, ay, 0], d = STYW[sty], p2 = strikeP(sa[1]); for (let i = 0; i < 6; i++) tgt[i] = R[i] + (p2 < 0 ? (I[i] + d[i] - R[i]) * -p2 : (I[i] - R[i]) * p2); if (p2 > 0 && STYH[sty]) finFx = { h: STYH[sty], w: Math.min(1, p2), e: WDEF[fk].blade ? STYE[sty] : null }; }
    } else if (fk === 'rifle') {   // ライフル: 銃を逆さに持ち替えて、銃床(ストック)を顔面に叩きつける。握りを軸に回すので、銃身が敵を貫通しない
      const sa = strikeAt(strikes, ft);
      if (sa) { const side = sa[0] === 'buttB' ? -1 : 1, I = buttPose(finAimDist() - (P.finishAim.r || 0.4) + 0.02, side), d = [0.25 * side, 0.3, 0.3, 0.55, 0.0, 0.3 * side], p2 = strikeP(sa[1]), R0 = [-0.06 * ready, 0.05 * ready, 0, 0.18 * ready, 0, 0]; for (let i = 0; i < 6; i++) tgt[i] = R0[i] + (p2 < 0 ? (I[i] + d[i] - R0[i]) * -p2 : (I[i] - R0[i]) * p2); }
    } else { const sa = strikeAt(strikes, ft); if (sa) stylePose(sa[0], strikeP(sa[1]), tgt); }

    const k = 1 - Math.exp(-55 * dt); for (let i = 0; i < 6; i++) finVM[i] += (tgt[i] - finVM[i]) * k;   // 急に切り替わらないようなめらかに
    sx += finVM[0]; sy += finVM[1]; sz += finVM[2]; rx += finVM[3]; ry += finVM[4]; rz += finVM[5];
    if (fk === 'rifle') {   // 殴った後、銃口を敵に押し当てて撃つ
      const c = ease01(1.5, 1.82, ft) * (1 - ease01(2.9, 3.3, ft)), [ax, ay, T0] = finAim('rifle', finAimDist() - (P.finishAim.r || 0.4) - 0.02), T = Math.min(T0, (FIN_THRUST.rifle || 0.3) + 0.1); rx += ax * c; ry += ay * c; sz -= T * c;
    } else if (!MELEE.includes(fk)) {   // 拳銃・SMG・ショットガン・デザートイーグル: 銃口を画面の中央へ(=狙う場所へ)。構えるときに少し行き過ぎて戻る
      const e0 = ease01(0, 0.24, ft), c = e0 * (1 - ease01(F.dur - 0.7, F.dur - 0.2, ft)), ov = 1 + 0.06 * Math.sin(e0 * Math.PI), [ax, ay, T0] = finAim(fk, finAimDist() - (P.finishAim.r || 0.4) - 0.02), T = Math.min(T0, (FIN_THRUST[fk] || 0.3) + 0.1);   // 銃口は狙う場所に確実に届く(少しめり込む)
      rx += ax * c * ov; ry += ay * c * ov; sz -= T * c * ov; sz += 0.05 * p;
      if (fk === 'smg') rz += Math.sin(ft * 70) * 0.03 * p;
    }
  } else { for (let i = 0; i < 6; i++) finVM[i] = 0; if (vmHidden) { vmHidden = false; vm[P.cur].node.visible = true; } }
  if (swingT > 0) {
    swingT += dt / (w.sw || 0.4); const u = Math.min(1, swingT), po = stylePose(swStyle, strikeP(u));
    sx += po[0]; sy += po[1]; sz += po[2]; rx += po[3]; ry += po[4]; rz += po[5];
    if (!swingLunged && u >= 0.32) { swingLunged = true; camera.getWorldDirection(_d); P.vel.x += _d.x * 6; P.vel.z += _d.z * 6; }   // 振る瞬間に一歩踏み込む
    if (u >= 0.44 && !swingHit) { swingHit = true; meleeHit(); const sg = swStyle === 'slashB' ? 1 : -1; rollKick += swStyle === 'chop' ? 0 : sg * 0.06; kick += swStyle === 'chop' ? 0.07 : swStyle === 'bash' ? 0.035 : 0.02; }   // カメラも振りに合わせて傾く・沈む
    trOn = u > 0.3 && u < 0.8;
    if (swingT >= 1) swingT = 0;
  }
  gunGroup.position.set(gunBaseX() + sx + Math.sin(bobT * 0.5) * 0.012 * moveAmt, GUN_BASE.y + sy - Math.abs(Math.cos(bobT * 0.5)) * 0.02 * moveAmt, GUN_BASE.z + sz);
  gunGroup.rotation.set(rx, ry, rz);
  { if (finFx) { fxH = finFx.h; fxE = finFx.e; } fxW += ((finFx ? finFx.w : 0) - fxW) * (1 - Math.exp(-22 * dt)); if (!P.finish) fxW = 0;   // 斜めに寝かせる量もなめらかに(急に手が飛ばない)
    if (fxW > 0.01 && fxH) { _fE.set(rx, ry, rz, 'XYZ'); _fq3.setFromEuler(_fE); applyFinFx({ h: fxH, w: fxW, e: fxE }, P.cur, gunGroup.position, _fq3); gunGroup.quaternion.copy(_fq3); } }
  // --- 銃を眺める: 銃と手を画面中央へ寄せて、銃の中心まわりに回す ---
  insp.amt += ((insp.on ? 1 : 0) - insp.amt) * (1 - Math.exp(-10 * dt));
  if (insp.amt > 0.002) {
    const len = (anchorsOf(w.model).length || 0.5) * w.K, mz = Math.abs(w.muzzleRel.z), cz = -(2 * mz - len) / 2;   // 銃の長さに合わせて大きさを自動調整、回転の中心は銃の真ん中
    const k = insp.amt, sI = Math.max(0.5, Math.min(2.6, 0.95 / len)) * insp.zoom * Math.max(0.5, Math.min(1, innerWidth / innerHeight / 1.3)), sc = 0.62 + (sI - 0.62) * k;   // 縦長の画面では小さめ
    _iq0.copy(gunGroup.quaternion); _iq.setFromEuler(_ie.set(insp.pitch, insp.yaw, 0, 'YXZ'));
    _ip.set(g0[0] + w.muzzleRel.x * 0.5, g0[1] + w.muzzleRel.y * 0.5, g0[2] + cz).multiplyScalar(sI).applyQuaternion(_iq);   // 回転の中心(銃の真ん中)
    const tx = 0 - _ip.x, ty = -0.02 - _ip.y, tz = -0.95 - _ip.z;
    gunGroup.position.set(gunGroup.position.x + (tx - gunGroup.position.x) * k, gunGroup.position.y + (ty - gunGroup.position.y) * k, gunGroup.position.z + (tz - gunGroup.position.z) * k);
    gunGroup.quaternion.copy(_iq0).slerp(_iq, k); gunGroup.scale.setScalar(sc);
  } else gunGroup.scale.setScalar(0.62);
  flashT -= dt; flashMesh.visible = flashT > 0;
  updateTrail(dt, trOn && !insp.on); trOn = false;
  if (!insp.on) applyGrab(dt); else grabOn = false;
  if (P.finish && P.finish.gunOut) setCurl(fp.N.R, 'R', 0.05);   // 銃を投げた後の、開いた手
  updateKickAnim(dt);
}
function setWeapon(id) {
  if (P.lockT > 0) return;   // フィニッシャー中は持ち替え不可
  if (typeof id === 'number') id = slotId((id + SLOTS.length) % SLOTS.length);
  if (!P.owned[id]) return;
  P.cur = id; cd = 0.2; vmSwitch = 1; swingT = 0;
  if (fp.ready) applyFpPose();
  renderWeaponHUD();
}
function cycleWeapon(dir) {
  const owned = ownedList(); let i = Math.max(0, owned.indexOf(P.cur));
  setWeapon(owned[(i + dir + owned.length) % owned.length]);
}
function renderWeaponHUD() {
  $('wep').innerHTML = '<div style="opacity:.45;font-size:11px">[G / 右クリック] 投げる</div>' + ownedList().map((id, k) => {
    const w = WDEF[id], n = k === 0 ? 1 : SLOTS.indexOf(id) + 1, a = w.melee ? '' : ` <small>${P.ammo[id]}</small>`;
    return id === P.cur ? `<b>[${n}] ${w.name}${a}</b>` : `<span style="opacity:.55">[${n}] ${w.name}${a}</span>`;
  }).join('<br>');
}

/* ---------- プレイヤーの攻撃 ---------- */
const rc = new THREE.Raycaster();
const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _v = new THREE.Vector3();
let cd = 0, mouseDown = false, shake = 0;
function targets() { const a = obstacleMeshes.slice(); for (const e of enemies) for (const p of e.parts) if (p.visible) a.push(p); return a; }
function playerFire() {
  if (P.lockT > 0 || insp.on) return;
  const w = WDEF[P.cur];
  if (w.melee) { if (swingT === 0) { swingT = 0.0001; swingHit = false; swStyle = P.rev && w.blade ? 'chop' : w.style === 'slash' && (swCombo ^= 1) ? 'slashB' : (w.style || 'slash'); swingLunged = false; sndSwish(); cd = w.rate; } return; }
  if (P.ammo[w.id] <= 0) { sndEmpty(); cd = 0.25; showMsg('EMPTY', false, '#ccc'); const best = ['rifle', 'smg', 'shotgun', 'deagle', 'pistol'].find(i => P.owned[i] && P.ammo[i] > 0); setWeapon(best || P.melee || 'knife'); return; }
  P.ammo[w.id]--; renderWeaponHUD();
  gunshot(w.id, 1.0);
  makeNoise(P.pos, w.noise);
  fpFire = 1; if (w.id === 'shotgun') P.pumpT = 1; vmRecoil += w.recoil * 0.9; kick += w.recoil * 0.5; shake = Math.min(0.12, shake + w.recoil * 0.25);
  flashT = w.supp ? 0.025 : 0.045; flashMesh.scale.setScalar(w.supp ? rnd(0.25, 0.4) : rnd(0.7, 1.5)); flashMesh.rotation.z = rnd(0, 6);
  const g0 = GRIP_AT[w.id], tipW = gunGroup.localToWorld(new THREE.Vector3(g0[0] + w.muzzleRel.x, g0[1] + w.muzzleRel.y, g0[2] + w.muzzleRel.z));
  const objs = targets(); camera.getWorldPosition(_o); rc.far = 90;
  for (let i = 0; i < w.pellets; i++) {
    _d.set((Math.random() - 0.5) * w.spread, (Math.random() - 0.5) * w.spread, -1).normalize().applyQuaternion(camera.quaternion);
    rc.set(_o, _d); const hits = rc.intersectObjects(objs, false);
    let end = _o.clone().addScaledVector(_d, 70);
    for (const h of hits) {
      if (h.object.enemy) {
        const e = h.object.enemy; if (e.dead) continue;
        hitEnemy(e, h.object, w.dmg, _d.clone(), h.point.clone(), w.power);
        if (!w.pierce) { end = h.point.clone(); break; }
      } else { end = h.point.clone(); if (h.object.userData.explosive) detonate(h.object.userData.explosive, 0); if (h.face) impact(end, h.face.normal.clone().transformDirection(h.object.matrixWorld), w.id === 'deagle' || w.id === 'rifle'); break; }
    }
    if (i < 3 || w.pellets === 1) tracer(tipW, end, w.supp ? 0xaaaaaa : 0xffe9a0, w.supp ? 0.04 : 0.06);
  }
  { // 薬莢を右へ排出
    const eg = GRIP_AT[w.id], ep = gunGroup.localToWorld(new THREE.Vector3(eg[0] + 0.06, eg[1] + 0.07, eg[2] - 0.08));
    const ev = new THREE.Vector3(rnd(1.2, 2.2), rnd(1.4, 2.4), rnd(0.2, 1.0)).applyQuaternion(camera.quaternion);
    ejectCasing(ep, ev, w.id === 'shotgun');
  }
  cd = w.rate;
}
function meleeHit() {
  if (P.lockT > 0) return;   // フィニッシャー中は通常の振りを無効
  const w = WDEF[P.cur]; camera.getWorldPosition(_o); camera.getWorldDirection(_d);
  let best = null, bd = 1e9;
  for (const e of enemies) {
    _v.set(e.pos.x - _o.x, 1.1 * e.type.scale - _o.y, e.pos.z - _o.z); const dist = _v.length();
    if (dist < w.range * Math.max(1, e.type.scale * 0.8) && _v.normalize().dot(_d) > 0.45 && dist < bd) { best = e; bd = dist; }
  }
  if (!best) {   // 空振り: 壁に当たれば火花
    rc.set(_o, _d); rc.far = w.range * 0.9; const h = rc.intersectObjects(obstacleMeshes, false)[0];
    if (h && h.face) { impact(h.point, h.face.normal.clone().transformDirection(h.object.matrixWorld), false); shake = Math.min(0.2, shake + 0.06); kick += 0.02; }
    return;
  }
  const dir = _d.clone().setY(0).normalize(), sc = best.type.scale, head = P.pitch > 0.06 && !best.type.boss, pt = new THREE.Vector3(best.pos.x, (head ? 1.55 : 1.1) * sc, best.pos.z);
  if (best.type.boss) { hitEnemy(best, best.N.Body, w.dmg, dir, pt, 4); hitStop(0.05); }
  else if (best.state !== 'alert' && !best.type.civ) startFinisher(best, w.id);   // 気づいてない敵は専用フィニッシャー(処刑)
  else {
    if (w.blade && best.hp > 0 && Math.random() < 0.5) popLimb(best, ['HandL', 'HandR', 'FootL', 'FootR'][Math.random() * 4 | 0], dir);
    hitEnemy(best, head ? best.N.Head : best.N.Body, w.dmg, dir, pt, w.power || 4);
    if (!best.dead) { best.stun = 0.45; best.kv = dir.clone().multiplyScalar(w.power >= 8 ? 9 : 4); }
    hitStop(0.05); shake = Math.min(0.24, shake + 0.1); kick += 0.03; punchFov(4); screenSplat(1);
  }
  w.blade ? sndStab() : sndKick();
}

/* ---------- フィニッシャー(Fキー): 気づいてない/弱った敵に近づいて、武器ごとの専用キル ---------- */
function finisherTarget() {
  if (P.lockT > 0 || insp.on || S.state !== 'play') return null;
  const w = WDEF[P.cur]; if (!FIN[w.id] || (!w.melee && P.ammo[w.id] < FIN[w.id].cost)) return null;
  camera.getWorldPosition(_o); camera.getWorldDirection(_d); let best = null, bd = 1e9;
  for (const e of enemies) {
    if (e.type.boss) continue;
    _v.set(e.pos.x - _o.x, 1.2 * e.type.scale - _o.y, e.pos.z - _o.z); const dist = _v.length();
    if (dist < 2.9 * Math.max(1, e.type.scale * 0.8) && _v.normalize().dot(_d) > 0.4 && dist < bd) { best = e; bd = dist; }
  }
  return best;
}
function tryFinisher() { const e = finisherTarget(); if (e) startFinisher(e, WDEF[P.cur].id); }
function updateFinisher(dt) {
  if (P.finish && P.lockT <= 0) { P.finish = null; P.finishMove = null; P.finishEye = null; P.finishRoll = 0; P.pitch *= 0.3; }
}
function finisherShotFx(kind, pt) {   // フィニッシャー中に撃った瞬間の、自分側の演出(音・反動・発砲炎・薬莢・弾の消費・弾道)
  const w = WDEF[kind]; if (!w || w.melee) return;
  if (pt) tracer(finisherWorldTip(kind), pt, w.supp ? 0xaaaaaa : 0xffe9a0, 0.09);
  P.ammo[w.id] = Math.max(0, P.ammo[w.id] - 1); renderWeaponHUD();
  gunshot(w.id, 1.0); makeNoise(P.pos, w.noise);
  fpFire = 1; vmRecoil += w.recoil * 0.55;   // 反動は小さめ(銃が急に遠のかない) kick += w.recoil * 0.5; shake = Math.min(0.16, shake + w.recoil * 0.3);
  flashT = w.supp ? 0.03 : 0.06; flashMesh.scale.setScalar(w.supp ? 0.4 : rnd(1.0, 1.8)); flashMesh.rotation.z = rnd(0, 6);
  const eg = GRIP_AT[w.id], ep = gunGroup.localToWorld(new THREE.Vector3(eg[0] + 0.06, eg[1] + 0.07, eg[2] - 0.08));
  ejectCasing(ep, new THREE.Vector3(rnd(1.2, 2.2), rnd(1.4, 2.4), rnd(0.2, 1.0)).applyQuaternion(camera.quaternion), w.id === 'shotgun');
  if (w.id === 'shotgun') setTimeout(() => { P.pumpT = 1; }, 450);
}

/* ---------- ドロップした銃を拾う ---------- */
const drops = [];
const ringGeo = new THREE.RingGeometry(0.55, 0.7, 28), ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
function dropGun(id, x, z, ammo, vel) {   // ammo 省略(null)なら標準の弾数
  const w = WDEF[id]; if (!w) return;
  const holder = new THREE.Group(), n = gunNode(w.model); n.scale.setScalar(0.75); n.rotation.z = Math.PI / 2; n.position.y = 0.0; holder.add(n);
  holder.position.set(x, 0.9, z); holder.rotation.y = rnd(0, 6.28); scene.add(holder);
  const ring = new THREE.Mesh(ringGeo, ringMat); ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.03, z); scene.add(ring);
  drops.push({ id, ammo: ammo == null ? w.give : ammo, holder, ring, vel: vel || new THREE.Vector3(rnd(-1, 1), 3, rnd(-1, 1)), rest: false, t: 0 });
  if (drops.length > 24) { const d = drops.shift(); scene.remove(d.holder); scene.remove(d.ring); }
}
function updateDrops(dt) {
  let near = null, nd = 2.4;
  for (const d of drops) {
    d.t += dt;
    if (!d.rest) {
      d.vel.y -= 22 * dt; d.holder.position.addScaledVector(d.vel, dt); d.holder.rotation.y += dt * 4;
      wclamp(d.holder.position, 0.6);
      if (d.holder.position.y < 0.1) { d.holder.position.y = 0.1; d.vel.y *= -0.3; d.vel.x *= 0.5; d.vel.z *= 0.5; if (Math.abs(d.vel.y) < 0.6) { d.rest = true; d.ring.position.set(d.holder.position.x, 0.03, d.holder.position.z); } }
    } else { d.holder.position.y = 0.12 + Math.sin(d.t * 3) * 0.03; d.ring.scale.setScalar(1 + Math.sin(d.t * 3) * 0.12); }
    const dist = Math.hypot(d.holder.position.x - P.pos.x, d.holder.position.z - P.pos.z);
    if (d.rest && dist < nd) { nd = dist; near = d; }
  }
  P.nearDrop = near;
  if (P.lockT > 0) near = null; $('prompt').style.display = near ? 'block' : 'none';
  if (near) $('prompt').textContent = WDEF[near.id].melee ? `[E] ${WDEF[near.id].name} を拾う${(P.melee || 'knife') !== 'knife' ? '(今の近接武器と交換)' : ''}` : `[E] ${WDEF[near.id].name} を拾う (${near.ammo})${S.mode !== 'waves' && S.mode !== 'club' && ownedList().some(g => g !== near.id && !WDEF[g].melee && g !== 'knife') ? '(今の銃と交換)' : ''}`;
}
function tryPickup() {
  const d = P.nearDrop; if (!d) return;
  const id = d.id, first = !P.owned[id];
  if (WDEF[id].melee) {   // 近接武器: 持っているものと交換(ナイフは常に予備として残る)
    const old = P.melee || 'knife'; if (old === id) return;
    scene.remove(d.holder); scene.remove(d.ring); drops.splice(drops.indexOf(d), 1); P.nearDrop = null;
    if (old !== 'knife') { P.owned[old] = false; dropGun(old, P.pos.x, P.pos.z, 0, new THREE.Vector3(rnd(-1, 1), 2.5, rnd(-1, 1))); }
    P.melee = id; P.owned[id] = true; sndPickup(); setWeapon(id); showMsg(WDEF[id].name + ' GET', false, '#9f9'); return;
  }
  if (S.mode !== 'waves' && S.mode !== 'club') {   // ミッション: 銃は1丁だけ。拾うと今の銃を足元に捨てて持ち替える
    for (const g of SLOTS.slice(1)) if (P.owned[g] && g !== id) { P.owned[g] = false; dropGun(g, P.pos.x, P.pos.z, P.ammo[g], new THREE.Vector3(rnd(-1, 1), 2.5, rnd(-1, 1))); P.ammo[g] = 0; }
    if (!P.owned[id]) { P.owned[id] = true; P.ammo[id] = d.ammo; scene.remove(d.holder); scene.remove(d.ring); drops.splice(drops.indexOf(d), 1); P.nearDrop = null; sndPickup(); setWeapon(id); showMsg(WDEF[id].name + ' GET', false, '#9f9'); return; }
  }
  P.owned[id] = true; P.ammo[id] = (P.ammo[id] || 0) + d.ammo;
  scene.remove(d.holder); scene.remove(d.ring); drops.splice(drops.indexOf(d), 1); P.nearDrop = null;
  sndPickup();
  if (first) { setWeapon(id); showMsg(WDEF[id].name + ' GET', false, '#9f9'); } else renderWeaponHUD();
}

/* ---------- 武器を投げる(G): 銃も近接武器も。当たると大ダメージ(銃は怯ませる)。落ちた武器はまた拾える ---------- */
const thrown = [], _tr = new THREE.Vector3(), _tu = new THREE.Vector3(0, 1, 0);
function throwWeapon() {
  if (P.lockT > 0 || insp.on || swingT > 0 || cd > 0) return;
  const id = P.cur, w = WDEF[id]; if (!w || !P.owned[id]) return;
  const m = new THREE.Group(), n = gunNode(w.model); n.scale.setScalar(w.K * 0.9); m.add(n); camera.getWorldPosition(_o); camera.getWorldDirection(_d);
  _tr.crossVectors(_d, _tu).normalize();
  m.position.copy(_o).addScaledVector(_d, 0.55).addScaledVector(_tr, 0.22).addScaledVector(_tu, -0.2); m.quaternion.copy(camera.quaternion); scene.add(m);
  const ammo = P.ammo[id] || 0, keep = id === 'knife';   // ナイフは投げても手元に残る(投げナイフ)
  thrown.push({ m, id, ammo, vel: _d.clone().multiplyScalar(24).addScaledVector(_tu, 2.2), axis: _tr.clone(), av: w.melee ? 17 : 11, t: 0, keep });
  if (!keep) {
    P.ammo[id] = 0; P.owned[id] = false; if (id === P.melee) P.melee = 'knife';
    const list = ownedList(); setWeapon(list.includes('pistol') ? 'pistol' : list[list.length - 1]);
  }
  sndSwish(); vmSwitch = 0.7; kick += 0.03; punchFov(3); renderWeaponHUD(); cd = 0.4;
}
function landThrown(t, pos) {
  scene.remove(t.m); thrown.splice(thrown.indexOf(t), 1);
  if (t.keep) return;   // 投げナイフは消える(手元にもう1本ある)
  dropGun(t.id, pos.x, pos.z, t.ammo, new THREE.Vector3(rnd(-0.6, 0.6), 1.5, rnd(-0.6, 0.6)));
}
/* 命中した投擲武器は、頭(または胴)に先端から刺さって、敵と一緒に動く。敵が倒れて少し経つと、足元に落ちて拾えるようになる */
const stuck = [], _sb = new THREE.Box3(), _sv = new THREE.Vector3(), _sq = new THREE.Quaternion(), _su = new THREE.Vector3(), _sd = new THREE.Vector3();
function stickThrown(t, e, node, dir) {
  const w = WDEF[t.id], m = t.m; scene.remove(m); thrown.splice(thrown.indexOf(t), 1);
  m.quaternion.identity(); m.position.set(0, 0, 0); m.updateMatrixWorld(true); _sb.setFromObject(m);
  _su.set(w.muzzleRel.x, w.muzzleRel.y, w.muzzleRel.z).normalize(); let mx = -1e9;
  for (let i = 0; i < 8; i++) { _sv.set(i & 1 ? _sb.max.x : _sb.min.x, i & 2 ? _sb.max.y : _sb.min.y, i & 4 ? _sb.max.z : _sb.min.z); mx = Math.max(mx, _sv.dot(_su)); }   // 先端の位置(刃の長さ方向の端)
  _sd.copy(t.vel).normalize(); _sd.y = Math.max(-0.3, Math.min(0.5, _sd.y)); _sd.normalize();
  node.getWorldPosition(_sv); const tgt = _sv.clone(); if (node === e.N.Head) tgt.y += 0.02 * e.type.scale; _sq.setFromUnitVectors(_su, _sd);
  m.quaternion.copy(_sq); m.position.copy(tgt).addScaledVector(_sd, -(mx + 0.22 * e.type.scale)); scene.add(m); node.attach(m);   // 先端は頭の表面から少しだけ中へ(ほとんどの刃が外に出る)
  stuck.push({ m, e, id: t.id, ammo: t.ammo, keep: t.keep, t: 0 });
}
function updateStuck(dt) {
  for (let i = stuck.length - 1; i >= 0; i--) {
    const s = stuck[i]; let top = s.m; while (top.parent) top = top.parent;
    if (top !== scene) { if (s.m.parent) s.m.parent.remove(s.m); stuck.splice(i, 1); if (s.e.dead && !s.keep) dropGun(s.id, s.e.pos.x, s.e.pos.z, s.ammo, new THREE.Vector3(rnd(-0.6, 0.6), 2, rnd(-0.6, 0.6))); continue; }   // 頭ごと吹き飛んだ(部位が外れた)ときも、武器は足元に落ちる
    if (s.e.dead) { s.t += dt; if (s.t > 1.6) { if (s.m.parent) s.m.parent.remove(s.m); stuck.splice(i, 1); if (!s.keep) dropGun(s.id, s.e.pos.x, s.e.pos.z, s.ammo, new THREE.Vector3(rnd(-0.6, 0.6), 1.5, rnd(-0.6, 0.6))); } }
  }
}
function updateThrown(dt) {
  updateStuck(dt);
  for (let i = thrown.length - 1; i >= 0; i--) {
    const t = thrown[i], w = WDEF[t.id]; t.t += dt; t.vel.y -= 13 * dt;
    const from = t.m.position.clone(); t.m.position.addScaledVector(t.vel, dt); t.m.rotateOnWorldAxis(t.axis, -t.av * dt);
    // 敵に当たったか(胴の軸との距離)
    let hit = null;
    for (const e of enemies) { const sc = e.type.scale, dx = e.pos.x - t.m.position.x, dz = e.pos.z - t.m.position.z; if (dx * dx + dz * dz < (0.55 * sc) ** 2 && t.m.position.y > 0.1 && t.m.position.y < 1.9 * sc) { hit = e; break; } }
    if (hit) {
      const dir = t.vel.clone().setY(0).normalize(), pt = t.m.position.clone(), dmg = Math.max(w.melee ? w.dmg * 1.1 : 34, pt.y > 1.35 * hit.type.scale ? 60 : 0);
      stickThrown(t, hit, pt.y > 1.35 * hit.type.scale ? hit.N.Head : hit.N.Body, dir);   // 先に刺す(頭が吹き飛ぶとき、破片に武器も付いてくる)
      if (w.blade && !hit.type.boss && Math.random() < 0.6) popLimb(hit, ['HandL', 'HandR', 'FootL', 'FootR'][Math.random() * 4 | 0], dir);
      hitEnemy(hit, pt.y > 1.35 * hit.type.scale ? hit.N.Head : hit.N.Body, dmg, dir, pt, w.melee ? Math.max(6, w.power || 6) : 6);
      if (!hit.dead) { hit.stun = Math.max(hit.stun || 0, w.melee ? 0.8 : 1.4); hit.kv = dir.clone().multiplyScalar(5); }
      hitStop(0.05); shake = Math.min(0.2, shake + 0.08); screenSplat(1); sndKick(); continue;
    }
    // 壁・床
    const step = t.m.position.clone().sub(from), len = step.length();
    if (len > 1e-4) { rc.set(from, step.clone().normalize()); rc.far = len + 0.1; const h = rc.intersectObjects(obstacleMeshes, false)[0]; if (h) { if (h.face) impact(h.point, h.face.normal.clone().transformDirection(h.object.matrixWorld), false); landThrown(t, h.point.clone().addScaledVector(step.clone().normalize(), -0.3)); continue; } }
    if (t.m.position.y < 0.08 || t.t > 3) landThrown(t, t.m.position);
  }
}
