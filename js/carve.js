"use strict";
/* ================= 部位損壊: 頭・胴を切り取って、中の肉・骨・脳・肋骨を見せる =================
   クリップ平面で外側の皮を切り抜き、その内側に「肉(皮の裏面)・頭蓋骨・脳 / 肋骨・背骨・内臓」を置く。
   敵モデルの座標: 前=+X、上=+Y。頭は半径1.5(縦1.77)、胴は x,z が±1.4・y が -3.91〜1.07 */
renderer.localClippingEnabled = true;
const carved = [], RECS = new WeakMap();   // RECS: node → 削れ状態(userData に入れると clone で壊れるので別に持つ)   // {node, make, depth, lp[], wp[]}
const CM = { flesh: 0x8e1010, bone: 0xe8dec6, brain: 0xc65a70, organ: 0x7a1020, dark: 0x4a0a0a };
const cmat = (c, side, planes, inter) => { const m = new THREE.MeshLambertMaterial({ color: c, side: side }); m.clippingPlanes = planes; m.clipIntersection = !!inter; return m; };
const _cp = new THREE.Plane(), _cn = new THREE.Vector3(), _cq = new THREE.Vector3();
function planeLocal(nx, ny, nz, px, py, pz, out) { _cn.set(nx, ny, nz).normalize(); return (out || new THREE.Plane()).setFromNormalAndCoplanarPoint(_cn, _cq.set(px, py, pz)); }

// 形の定義: depth(0〜1)から、ローカル平面 [[nx,ny,nz, px,py,pz], ...] を返す。残す側が法線の向き
const CARVE = {
  top:   { head: true, make: (d, o) => [[0.3 * o.s, -1, 0.2 * o.t, 0, 1.77 - d * 2.5, 0]] },                                // 頭のてっぺんをえぐる
  face:  { head: true, hide: 'Face', make: (d, o) => [[-1, 0.12 * o.s, 0.1 * o.t, 1.5 - d * 2.4, 0, 0]] },                  // 顔面をえぐる
  side:  { head: true, make: (d, o) => [[0.1, 0.1, -o.s, 0, 0, o.s * (1.5 - d * 2.3)], [0.2, -1, 0, 0, 1.77 - d * 1.2, 0]] },   // 側頭部+上
  split: { head: true, make: (d, o) => [[0, -0.1, -o.s, 0, 0, o.s * (1.5 - d * 2.6)], [0.4, -1, 0, 0, 1.77 - d * 0.9, 0]] },   // 縦に割られて半分なくなる(斧)
  chest: { body: true, inter: true, make: (d, o) => [[-1, 0, 0.15 * o.s, 1.4 - d * 1.5, 0, 0], [0, -1, 0, 0, -2.4, 0]] },   // 胸〜腹の前面がえぐれて、肋骨と内臓が見える
};
function carveClear(node) { for (let i = node.children.length - 1; i >= 0; i--) if (node.children[i].userData.carveChild) node.remove(node.children[i]); }
function carve(node, kind, depth, opt) {   // node=頭または胴のメッシュ。すでに削れていれば depth を更新する
  const spec = CARVE[kind]; if (!spec) return null; opt = opt || {};
  let rec = RECS.get(node);
  if (!rec || rec.kind !== kind) {
    if (rec) { carveClear(node); const k = carved.indexOf(rec); if (k >= 0) carved.splice(k, 1); }
    const o = { s: opt.s || (Math.random() < 0.5 ? -1 : 1), t: opt.t || (Math.random() < 0.5 ? -1 : 1) };
    const n = spec.make(0, o).length, wp = [], lp = []; for (let i = 0; i < n; i++) { wp.push(new THREE.Plane()); lp.push(new THREE.Plane()); }
    const inter = !!spec.inter, skin = node.material.clone(); skin.clippingPlanes = wp; skin.clipIntersection = inter; node.material = skin;
    const add = (geo, mat, sc, pos) => { const m = new THREE.Mesh(geo, mat); m.userData.carveChild = true; m.frustumCulled = false; if (sc) m.scale.setScalar(sc); if (pos) m.position.set(...pos); node.add(m); return m; };
    add(node.geometry, cmat(CM.flesh, THREE.BackSide, wp, inter), 1.0);   // 皮の裏側=赤い肉
    if (spec.head) { add(node.geometry, cmat(CM.bone, THREE.DoubleSide, wp, inter), 0.86); add(node.geometry, cmat(CM.brain, THREE.FrontSide, wp, inter), 0.7, [0, -0.08, 0]); }
    if (spec.body) {   // 肋骨・背骨・内臓
      const bone = cmat(CM.bone, THREE.FrontSide, wp, inter), organ = cmat(CM.organ, THREE.FrontSide, wp, inter);
      for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(0.22, 0.2, 2.5 - Math.abs(i - 2.5) * 0.15), bone, 1, [0.55, -2.2 + i * 0.62, 0]);
      add(new THREE.BoxGeometry(0.3, 4.4, 0.3), bone, 1, [-0.55, -1.2, 0]);
      add(new THREE.SphereGeometry(0.62, 10, 8), organ, 1, [0.0, -1.3, 0.6]); add(new THREE.SphereGeometry(0.58, 10, 8), organ, 1, [0.1, -1.6, -0.6]); add(new THREE.SphereGeometry(0.5, 10, 8), cmat(CM.dark, THREE.FrontSide, wp, inter), 1, [-0.1, -0.2, 0.1]);
    }
    for (const c of node.children) if (c.material && c.material.type === 'ShaderMaterial') c.visible = false;   // 黒い輪郭線は切り口で変になるので消す
    rec = { node, kind, o, lp, wp, depth: 0, make: spec.make }; RECS.set(node, rec); carved.push(rec);
    if (carved.length > 70) carved.shift();
    if (spec.hide) { const f = node.getObjectByName(spec.hide) || (node.parent && node.parent.getObjectByName(spec.hide)); if (f) f.visible = false; }
  }
  rec.depth = Math.max(rec.depth, depth); node.userData.carveSpec = { kind, depth: rec.depth, o: rec.o };
  return rec;
}
function carveCopy(src, dst) {   // 破片(ギブ)になった頭・胴にも、同じ削れ方を付ける
  const sp = src.userData.carveSpec; if (!sp) return; carveClear(dst); RECS.delete(dst); carve(dst, sp.kind, sp.depth, sp.o);
}
function updateCarved() {   // 毎フレーム、ローカルの平面をワールドへ変換(動く頭に合わせる)
  for (let i = carved.length - 1; i >= 0; i--) {
    const r = carved[i], n = r.node; let top = n; while (top.parent) top = top.parent; if (top !== scene) { carved.splice(i, 1); continue; }   // 消えた敵の記録は捨てる
    n.updateWorldMatrix(true, false); const ps = r.make(r.depth, r.o);
    for (let k = 0; k < ps.length; k++) { const p = ps[k]; planeLocal(p[0], p[1], p[2], p[3], p[4], p[5], r.lp[k]); r.wp[k].copy(r.lp[k]).applyMatrix4(n.matrixWorld); }
  }
}
function resetCarved() { carved.length = 0; }
