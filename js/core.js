"use strict";
/* ================= 共通: 描画・ステージ・音・血・演出 ================= */
const $ = id => document.getElementById(id);
const rnd = (a, b) => a + Math.random() * (b - a);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.insertBefore(renderer.domElement, document.body.firstChild);

const scene = new THREE.Scene();
(function sky() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#3b3b3b'); g.addColorStop(0.55, '#8a8a8a'); g.addColorStop(1, '#a08080');
  x.fillStyle = g; x.fillRect(0, 0, 4, 256);
  scene.background = new THREE.CanvasTexture(c);
})();
scene.fog = new THREE.Fog(0x808080, 14, 75);

const camera = new THREE.PerspectiveCamera(82, innerWidth / innerHeight, 0.05, 150);
camera.rotation.order = 'YXZ';
scene.add(camera);
const sun = new THREE.DirectionalLight(0xffffff, 0.55); sun.position.set(0.4, 1, 0.3); scene.add(sun);
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
});

/* ---------- ステージ: 手前が「庭」(スタート)、z=20 の壁と門の奥が「施設」 ---------- */
const CLUB = { cx: 300, x0: 270, x1: 330, z0: -26, z1: 24 };   // DJルーム(別ステージ)は、施設から遠く離れた場所に作る
const A = 40, GATE_Z = 20, GATE_HALF = 3, ZMIN = -112;   // x は ±A、z は ZMIN〜A。本館は北(−z)へ長く伸びる
(function floor() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d'); x.fillStyle = '#5d5d5d'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) { const v = 70 + Math.random() * 40 | 0; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  x.strokeStyle = '#3a3a3a'; x.lineWidth = 3; x.strokeRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(A / 2, (A - ZMIN) / 4);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(A * 2 + 4, A - ZMIN + 4), new THREE.MeshLambertMaterial({ map: t }));
  m.rotation.x = -Math.PI / 2; m.position.z = (A + ZMIN) / 2; scene.add(m);
})();

/* ---------- 手続き生成テクスチャ(画像ファイル不要) ---------- */
function mkTex(draw, size) {
  const c = document.createElement('canvas'); c.width = c.height = size || 256; const x = c.getContext('2d'); draw(x, c.width);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
function speckle(x, s, n, lo, hi, a) { for (let i = 0; i < n; i++) { const v = lo + Math.random() * (hi - lo) | 0; x.fillStyle = `rgba(${v},${v},${v},${a})`; x.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 2, 1 + Math.random() * 2); } }
function stains(x, s, n) { for (let i = 0; i < n; i++) { const g = x.createRadialGradient(0, 0, 1, 0, 0, 10 + Math.random() * 30); g.addColorStop(0, 'rgba(40,36,30,0.28)'); g.addColorStop(1, 'rgba(40,36,30,0)'); x.save(); x.translate(Math.random() * s, Math.random() * s); x.scale(1, 1.6 + Math.random() * 2); x.fillStyle = g; x.fillRect(-60, -60, 120, 120); x.restore(); } }
const TEX = {
  concrete: mkTex((x, s) => { x.fillStyle = '#b4b4b4'; x.fillRect(0, 0, s, s); speckle(x, s, 2600, 120, 210, 0.5); stains(x, s, 7);
    x.strokeStyle = 'rgba(70,70,70,0.55)'; x.lineWidth = 2; x.strokeRect(0, 0, s, s); x.beginPath(); x.moveTo(0, s * 0.5); x.lineTo(s, s * 0.5); x.stroke(); }),
  panel: mkTex((x, s) => { x.fillStyle = '#a2a6ac'; x.fillRect(0, 0, s, s); speckle(x, s, 1800, 110, 190, 0.45);
    x.strokeStyle = 'rgba(30,30,34,0.8)'; x.lineWidth = 3; for (const k of [0, s / 2]) { x.strokeRect(k + 2, 2, s / 2 - 4, s - 4); }
    x.fillStyle = 'rgba(40,40,44,0.9)'; for (const px of [10, s / 2 - 10, s / 2 + 10, s - 10]) for (const py of [10, s / 2, s - 10]) { x.beginPath(); x.arc(px, py, 3, 0, 6.3); x.fill(); } stains(x, s, 4); }),
  tile: mkTex((x, s) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const v = 150 + Math.random() * 40 | 0; x.fillStyle = `rgb(${v},${v},${v + 4})`; x.fillRect(i * s / 4, j * s / 4, s / 4, s / 4); }
    x.strokeStyle = 'rgba(50,50,55,0.85)'; x.lineWidth = 2; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * s / 4, 0); x.lineTo(i * s / 4, s); x.moveTo(0, i * s / 4); x.lineTo(s, i * s / 4); x.stroke(); } speckle(x, s, 1500, 90, 170, 0.5); stains(x, s, 6); }),
  grate: mkTex((x, s) => { x.fillStyle = '#5a5c60'; x.fillRect(0, 0, s, s); x.strokeStyle = '#2a2b2e'; x.lineWidth = 4; for (let i = 0; i < 8; i++) { x.beginPath(); x.moveTo(i * s / 8, 0); x.lineTo(i * s / 8, s); x.moveTo(0, i * s / 8); x.lineTo(s, i * s / 8); x.stroke(); } speckle(x, s, 1200, 40, 110, 0.5); }),
  crate: mkTex((x, s) => { x.fillStyle = '#a77b4b'; x.fillRect(0, 0, s, s); for (let i = 0; i < 5; i++) { x.fillStyle = `rgba(${60 + Math.random() * 40 | 0},${35 + Math.random() * 20 | 0},15,0.35)`; x.fillRect(0, i * s / 5, s, 3); }
    x.strokeStyle = '#4b3016'; x.lineWidth = 6; x.strokeRect(5, 5, s - 10, s - 10); x.beginPath(); x.moveTo(5, 5); x.lineTo(s - 5, s - 5); x.moveTo(s - 5, 5); x.lineTo(5, s - 5); x.stroke();
    x.fillStyle = '#2a1a0a'; for (const px of [14, s - 14]) for (const py of [14, s - 14]) { x.beginPath(); x.arc(px, py, 3, 0, 6.3); x.fill(); } speckle(x, s, 900, 60, 120, 0.4); }),
  stripe: mkTex((x, s) => { x.fillStyle = '#d9b100'; x.fillRect(0, 0, s, s); x.fillStyle = '#16161a'; for (let i = -s; i < s * 2; i += 64) { x.beginPath(); x.moveTo(i, s); x.lineTo(i + 32, s); x.lineTo(i + 32 + s, 0); x.lineTo(i + s, 0); x.fill(); } speckle(x, s, 800, 60, 160, 0.4); }),
  barrel: mkTex((x, s) => { x.fillStyle = '#7a3a2a'; x.fillRect(0, 0, s, s); x.fillStyle = 'rgba(0,0,0,0.35)'; for (const y of [s * 0.12, s * 0.5, s * 0.88]) x.fillRect(0, y - 5, s, 10); speckle(x, s, 1500, 40, 140, 0.5); stains(x, s, 4); }),
};
const matCache2 = {};
function levelMat(tex, color) { const k = tex + color; return matCache2[k] || (matCache2[k] = new THREE.MeshLambertMaterial({ color, map: TEX[tex] })); }
function scaleUV(geo, w, h, d, S) {   // BoxGeometryのUVを実寸(S メートルで1周期)に合わせる
  const uv = geo.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / S, uv.getY(k) * dims[f][1] / S); }
  uv.needsUpdate = true;
}

const obstacleMeshes = [], boxes = [], STATIC = [];   // STATIC=動かない見た目のメッシュ(後で場所ごとにまとめて描画回数を減らす)
const _mc = {}; const cachedMat = (kind, color) => _mc[kind + color] || (_mc[kind + color] = kind === 'basic' ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshLambertMaterial({ color }));
function addBox(x, z, w, d, h, color, tex) {
  tex = tex || 'concrete';
  const geo = new THREE.BoxGeometry(w, h, d); scaleUV(geo, w, h, d, tex === 'crate' ? 1.6 : tex === 'panel' ? 3 : 3.2);
  const m = new THREE.Mesh(geo, levelMat(tex, color));
  m.position.set(x, h / 2, z); scene.add(m); obstacleMeshes.push(m); STATIC.push(m);
  boxes.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
  return m;
}
// 当たり判定の無い飾り(柱の飾り枠・パイプ・看板など)
function addDeco(x, y, z, w, h, d, color, tex) {
  const geo = new THREE.BoxGeometry(w, h, d); scaleUV(geo, w, h, d, 2);
  const m = new THREE.Mesh(geo, tex ? levelMat(tex, color) : cachedMat('lambert', color)); m.position.set(x, y, z); scene.add(m); STATIC.push(m); return m;
}
function addLamp(x, y, z, w, d, color) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), cachedMat('basic', color)); m.position.set(x, y, z); scene.add(m); STATIC.push(m); return m; }
function addPipe(x0, y0, z0, x1, y1, z1, r, color) {
  const a = new THREE.Vector3(x0, y0, z0), b = new THREE.Vector3(x1, y1, z1), len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), cachedMat('lambert', color)); m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); scene.add(m); STATIC.push(m); return m;
}
function addBarrel(x, z, color) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.0, 14), levelMat('barrel', color || 0xffffff)); m.position.set(x, 0.5, z); scene.add(m); obstacleMeshes.push(m); STATIC.push(m);
  boxes.push({ x0: x - 0.4, x1: x + 0.4, z0: z - 0.4, z1: z + 0.4 });
}
function addSign(text, x, y, z, ry, w, h, bg, fg) {
  const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * h / w); const g = c.getContext('2d');
  g.fillStyle = bg || '#16161a'; g.fillRect(0, 0, c.width, c.height); g.strokeStyle = fg || '#ddd'; g.lineWidth = 6; g.strokeRect(6, 6, c.width - 12, c.height - 12);
  g.fillStyle = fg || '#ddd'; g.font = `bold ${Math.round(c.height * 0.42)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, c.width / 2, c.height / 2 + 2);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) })); m.position.set(x, y, z); m.rotation.y = ry || 0; scene.add(m); STATIC.push(m); return m;
}
function addFloor(x0, x1, z0, z1, tex, color) {
  const t = TEX[tex].clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set((x1 - x0) / 3, (z1 - z0) / 3);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), new THREE.MeshLambertMaterial({ map: t, color: color || 0xffffff, polygonOffset: true, polygonOffsetFactor: -1 }));
  m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, 0.012, (z0 + z1) / 2); scene.add(m); STATIC.push(m);
}
// 壁(x0〜x1 の横壁 / z0〜z1 の縦壁)。端の座標で指定する
function wallX(x0, x1, z, h, color, t, tex) { t = t || 1; return addBox((x0 + x1) / 2, z, x1 - x0, t, h || 5, color || 0xcfcfcf, tex || 'panel'); }
function wallZ(z0, z1, x, h, color, t, tex) { t = t || 1; return addBox(x, (z0 + z1) / 2, t, z1 - z0, h || 5, color || 0xcfcfcf, tex || 'panel'); }
// 天井: 当たり判定は無いが、弾や視線は遮る(見た目の屋根)
function addRoof(x0, x1, z0, z1, y, color) {
  const geo = new THREE.BoxGeometry(x1 - x0, 0.3, z1 - z0); scaleUV(geo, x1 - x0, 0.3, z1 - z0, 3);
  const m = new THREE.Mesh(geo, levelMat('panel', color || 0x777777));
  m.position.set((x0 + x1) / 2, y + 0.15, (z0 + z1) / 2); scene.add(m); obstacleMeshes.push(m); STATIC.push(m);
}

/* ---------- ステージ配置 ----------
   南(+z)の庭がスタート。z=20 の壁と門の奥が施設。北(−z)へ 本館: ロビー → 兵舎 → 機械ホール → サーバー室 → 司令室 と、扉で次々つながる。
   横に 武器庫(東) と 倉庫(西)、西に 地下(警報パネル)。ルート: ①正面ゲート ②西の排水路(x=-31.5, しゃがみ専用) → 地下 → 本館 */
const H = 6.5;   // 本館の天井の高さ
const ZONES = {
  building: { x0: -14, x1: 14, z0: -110, z1: -8 },
  basement: { x0: -34, x1: -14, z0: -36, z1: -10 },
  tunnel:   { x0: -33, x1: -30, z0: -10, z1: 26 },
  armory:   { x0: 14, x1: 28, z0: -44, z1: -24 },
  storage:  { x0: -28, x1: -14, z0: -66, z1: -48 },
};
const ROOMS = { lobby: [-24, -8], barracks: [-44, -24], machine: [-68, -44], server: [-88, -68], command: [-110, -88] };
const DOOR_DEFS = [   // 扉: 近づくと開く
  { x: 0, z: -8, axis: 'x', w: 5, h: H }, { x: 0, z: -24, axis: 'x', w: 4, h: H }, { x: 0, z: -44, axis: 'x', w: 4, h: H }, { x: 0, z: -68, axis: 'x', w: 4, h: H }, { x: 0, z: -88, axis: 'x', w: 4, h: H },
  { x: -14, z: -17, axis: 'z', w: 4, h: H }, { x: 14, z: -34, axis: 'z', w: 4, h: H }, { x: -14, z: -56, axis: 'z', w: 4, h: H },
];
const CRUSHER_DEFS = [[-6, -50], [6, -50], [0, -57], [-6, -64], [6, -64]];                                  // 機械ホールのプレス機
const EXPLOSIVE_DEFS = [[-12, -47], [-12.9, -46.1], [12, -65], [12.9, -64.2], [11.4, -47], [-11, -66.5], [-22, -52], [-21.1, -52.9], [-24, -62], [20, -28], [22, -40], [-10, -34], [10, -38]];
// 外周
addBox(0, ZMIN - 1, A * 2 + 4, 2, 12, 0x8a8a8a); addBox(0, A + 1, A * 2 + 4, 2, 12, 0x8a8a8a);
addBox(-A - 1, (A + ZMIN) / 2, 2, A - ZMIN, 12, 0x8a8a8a); addBox(A + 1, (A + ZMIN) / 2, 2, A - ZMIN, 12, 0x8a8a8a);
// 施設の壁(z=20)。中央が正面ゲート、西(x=-34〜-29)が排水路の口
wallX(-41, -34, GATE_Z, 7, 0x9a9a9a, 1, 'concrete'); wallX(-29, -GATE_HALF, GATE_Z, 7, 0x9a9a9a, 1, 'concrete'); wallX(GATE_HALF, 41, GATE_Z, 7, 0x9a9a9a, 1, 'concrete');
addBox(-GATE_HALF - 0.4, GATE_Z, 0.8, 0.9, 8, 0x888888, 'stripe'); addBox(GATE_HALF + 0.4, GATE_Z, 0.8, 0.9, 8, 0x888888, 'stripe');
addDeco(0, 6.6, GATE_Z, GATE_HALF * 2 + 1.6, 0.7, 1.0, 0x666666, 'stripe');                    // ゲートの上の梁
addSign('正面ゲート  GATE', 0, 5.4, GATE_Z + 0.55, 0, 4.8, 0.9);
// 本館の外壁
wallX(-14, -2.5, -8, H); wallX(2.5, 14, -8, H);                                              // 正面(中央に入口)
wallX(-14, 14, -110, H);                                                                     // 奥
wallZ(-110, -36, 14, H); wallZ(-32, -8, 14, H);                                              // 東(武器庫の扉口 z=-36〜-32)
wallZ(-110, -58, -14, H); wallZ(-54, -19, -14, H); wallZ(-15, -8, -14, H);                   // 西(倉庫の扉口 z=-58〜-54 / 地下の扉口 z=-19〜-15)
for (const z of [-24, -44, -68, -88]) { wallX(-14, -2, z, H); wallX(2, 14, z, H); }          // 部屋の仕切り(中央に扉口)
addRoof(-14, 14, -110, -8, H, 0x666666);
// 武器庫(東)・倉庫(西)
wallX(14, 28, -44, H - 2); wallZ(-44, -24, 28, H - 2); wallX(14, 28, -24, H - 2); addRoof(14, 28, -44, -24, H - 2, 0x555555);
wallX(-28, -14, -66, H - 2); wallZ(-66, -48, -28, H - 2); wallX(-28, -14, -48, H - 2); addRoof(-28, -14, -66, -48, H - 2, 0x555555);
// 扉の枠と看板
for (const d of DOOR_DEFS) {
  if (d.axis === 'x') for (const sx of [-1, 1]) addDeco(d.x + sx * (d.w / 2 + 0.02), H / 2, d.z, 0.4, H, 1.25, 0x777777, 'stripe');
  else for (const sz of [-1, 1]) addDeco(d.x, H / 2, d.z + sz * (d.w / 2 + 0.02), 1.25, H, 0.4, 0x777777, 'stripe');
}
addSign('MAIN BUILDING', 0, 5.4, -7.45, 0, 4.2, 0.8); addSign('兵舎  BARRACKS', 0, 5.2, -23.45, 0, 4.2, 0.8); addSign('機械ホール  MACHINE', 0, 5.2, -43.45, 0, 4.6, 0.8, '#2a1c0a', '#ffc070');
addSign('サーバー室  SERVER', 0, 5.2, -67.45, 0, 4.6, 0.8, '#0a1f2a', '#8fdcff'); addSign('司令室  COMMAND', 0, 5.2, -87.45, 0, 4.2, 0.8, '#3a0f0f', '#ff8a7a');
addSign('B1  地下', -13.45, 4.4, -17, Math.PI / 2, 2.6, 0.7, '#102a30', '#7fe0d0'); addSign('武器庫  ARMORY', 13.45, 4.4, -34, -Math.PI / 2, 3.0, 0.7, '#2a2a10', '#ffe38a'); addSign('倉庫', -13.45, 4.4, -56, Math.PI / 2, 1.8, 0.7);
// 地下
wallX(-34, -14, -36); wallZ(-36, -10, -34); wallX(-29, -14, -10);
addRoof(-34, -14, -36, -10, 3.4, 0x555555);
// 排水路(幅3m・天井1.5m): 庭の端(z=26)から地下の入口(z=-10)まで
wallZ(-10, 26, -33.5, 1.5, 0x8a8a8a, 1, 'concrete'); wallZ(-10, 26, -29.5, 1.5, 0x8a8a8a, 1, 'concrete');
addRoof(-34, -29, -10, 26, 1.5, 0x555555);
addDeco(-31.5, 1.7, 26.4, 4.4, 0.5, 0.6, 0x888888, 'stripe');
addSign('排水口  DRAIN', -31.5, 2.35, 26.45, 0, 3.2, 0.7, '#102a14', '#8dff9d');
{ const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.3), new THREE.MeshBasicMaterial({ color: 0x66ff88 })); lamp.position.set(-31.5, 1.3, 26.2); scene.add(lamp); }
for (let z = 22; z > -8; z -= 8) addLamp(-31.5, 1.42, z, 0.5, 0.25, 0x998844);
addPipe(-33.1, 1.05, 25, -33.1, 1.05, -9, 0.1, 0x4a4d50); addPipe(-29.9, 0.45, 25, -29.9, 0.45, -9, 0.07, 0x57524a);
// 床
addFloor(-14, 14, -110, -8, 'tile', 0xdadada); addFloor(-34, -14, -36, -10, 'tile', 0x8a8a90); addFloor(-34, -29, -10, 26, 'grate', 0xffffff);
addFloor(-14, 14, -68, -44, 'grate', 0xb0b0b8); addFloor(14, 28, -44, -24, 'tile', 0x9a9a8a); addFloor(-28, -14, -66, -48, 'tile', 0x8a8a8a);
// 庭の遮蔽物(しゃがむと隠れられる低い壁と、立っても隠れる木箱)
for (const [x, z, w, d, h] of [[-12, 31, 4, 1.4, 1.2], [9, 29, 4.5, 1.4, 1.2], [-4.5, 24.5, 2.4, 1.6, 2.3], [19, 35, 2.6, 2.6, 2.2], [-22, 34, 3.2, 3.2, 2.4], [5, 35.5, 2, 1.4, 1.2], [-17, 24, 1.6, 4, 2.2], [14, 23.5, 1.6, 2.4, 2.2]])
  addBox(x, z, w, d, h, 0xbfbfbf, h < 1.5 ? 'concrete' : (Math.abs(x) | 0) % 2 ? 'crate' : 'panel');
for (const [x, z] of [[12, 32.5], [13.1, 33.3], [-9, 36], [24, 28], [-26, 27]]) addBarrel(x, z, [0xffffff, 0xaab8ff, 0xb5ffc0][(Math.abs(x) | 0) % 3]);
// 中庭・両脇の遮蔽物
function inZone(z, x, zn, pad) { pad = pad || 0; return x > zn.x0 - pad && x < zn.x1 + pad && z > zn.z0 - pad && z < zn.z1 + pad; }
for (let i = 0; i < 16; i++) {
  let x, z, n = 0; do { x = rnd(-36, 36); z = rnd(-36, 16); n++; } while (n < 40 && (inZone(z, x, ZONES.building, 4) || inZone(z, x, ZONES.basement, 4) || inZone(z, x, ZONES.tunnel, 3) || inZone(z, x, ZONES.armory, 4) || inZone(z, x, ZONES.storage, 4) || (Math.abs(x) < 6 && z > -10) || Math.hypot(x, z - 2) < 5));
  const big = Math.random() < 0.4;
  addBox(x, z, big ? rnd(3, 5) : rnd(1.5, 2.5), big ? rnd(3, 5) : rnd(1.5, 2.5), rnd(1.5, 4), [0xbfbfbf, 0xd0d0d0, 0xa8a8a8, 0xc9aaaa][i % 4], i % 3 === 0 ? 'crate' : (i % 3 === 1 ? 'concrete' : 'panel'));
}
// 各部屋の家具
const furn = (list) => { for (const [x, z, w, d, h, c, t] of list) addBox(x, z, w, d, h, c, t); };
furn([[-7, -12, 1.2, 1.2, 5, 0xbbbbbb, 'concrete'], [7, -12, 1.2, 1.2, 5, 0xbbbbbb, 'concrete'], [0, -16.5, 6, 1.2, 1.1, 0xd8c8a8, 'crate'], [-10, -21, 3, 1.2, 0.8, 0x999999, 'panel'], [10, -21, 3, 1.2, 0.8, 0x999999, 'panel']]);   // ロビー
furn([[-10, -28, 3.4, 1.2, 1.5, 0xb0b8c0, 'panel'], [-10, -33, 3.4, 1.2, 1.5, 0xb0b8c0, 'panel'], [-10, -38, 3.4, 1.2, 1.5, 0xb0b8c0, 'panel'], [10, -28, 3.4, 1.2, 1.5, 0xb0b8c0, 'panel'], [10, -33, 3.4, 1.2, 1.5, 0xb0b8c0, 'panel'], [10, -38, 3.4, 1.2, 1.5, 0xb0b8c0, 'panel'],
  [-13, -30, 1, 0.9, 2.4, 0x8a8f96, 'panel'], [-13, -36, 1, 0.9, 2.4, 0x8a8f96, 'panel'], [13, -42, 1, 0.9, 2.4, 0x8a8f96, 'panel'], [0, -34, 4, 1.4, 0.9, 0xd8c8a8, 'crate']]);                                                                // 兵舎(二段ベッド・ロッカー・机)
furn([[-11, -56, 3, 3, 2.6, 0xb0b0b8, 'panel'], [11, -56, 3, 3, 2.6, 0xb0b0b8, 'panel'], [-12.5, -52, 1.5, 1.5, 1.4, 0xcfcfcf, 'crate'], [12.5, -50, 1.5, 1.5, 1.4, 0xcfcfcf, 'crate']]);                                       // 機械ホール(大きな機械)
for (const z of [-72, -76, -80, -84]) { furn([[-8, z, 6, 1.2, 2.5, 0x6a6e76, 'panel'], [8, z, 6, 1.2, 2.5, 0x6a6e76, 'panel']]); for (const sx of [-1, 1]) addDeco(sx * 8, 2.0, z + 0.62, 4.6, 0.12, 0.05, sx > 0 ? 0x44ff88 : 0x44aaff); }      // サーバー室(ラック+LED)
furn([[-8, -96, 1.4, 1.4, H, 0xbbbbbb, 'concrete'], [8, -96, 1.4, 1.4, H, 0xbbbbbb, 'concrete'], [-8, -104, 1.4, 1.4, H, 0xbbbbbb, 'concrete'], [8, -104, 1.4, 1.4, H, 0xbbbbbb, 'concrete'], [0, -107, 8, 1.6, 1.1, 0xd8c8a8, 'crate']]);   // 司令室
furn([[24, -30, 2.4, 1.2, 1.1, 0xcfcfcf, 'crate'], [18, -41, 2.4, 1.2, 1.1, 0xcfcfcf, 'crate'], [24, -41, 1.5, 1.5, 1.5, 0xcfcfcf, 'crate']]);                       // 武器庫
furn([[-24, -57, 2, 3, 1.4, 0xcfcfcf, 'crate'], [-18, -62, 2.4, 2.4, 1.4, 0xcfcfcf, 'crate']]);                                                                          // 倉庫
furn([[-20, -20, 2.4, 2.4, 1.4, 0xcfcfcf, 'crate'], [-30, -22, 2, 3, 1.4, 0xcfcfcf, 'crate'], [-24, -14, 4, 1, 1.0, 0x999999, 'panel'], [-18, -30, 2, 2, 1.4, 0xcfcfcf, 'crate']]);   // 地下
addBarrel(-32, -31); addBarrel(-31, -32); addBarrel(-16.5, -33);
// 天井の照明
const LAMP_Y = H - 0.18;
for (const z of [-12, -18]) for (const x of [-7, 0, 7]) addLamp(x, LAMP_Y, z, 3, 0.4, 0xf2f2e8);                                    // ロビー: 白
for (const z of [-30, -38]) for (const x of [-7, 7]) addLamp(x, LAMP_Y, z, 3, 0.4, 0xe8e8d0);                                      // 兵舎: 白
for (const z of [-48, -56, -64]) for (const x of [-8, 8]) addLamp(x, LAMP_Y, z, 0.5, 3, 0xffaa55);                                 // 機械ホール: 橙
for (const z of [-72, -78, -84]) addLamp(0, LAMP_Y, z, 0.5, 4, 0x77ccff);                                                          // サーバー室: 青
for (const x of [-9, 0, 9]) addLamp(x, LAMP_Y, -99, 0.4, 7, 0xff5a44);                                                             // 司令室: 赤
for (const [x, z] of [[-30, -16], [-24, -26], [-18, -18], [-28, -32]]) addLamp(x, 3.22, z, 2.4, 0.3, 0xff3a2a);
for (const [x, z] of [[21, -34], [-21, -57]]) addLamp(x, H - 2.2, z, 2.4, 0.4, 0xffdd88);
// 壁沿いのパイプ(機械ホール・地下)
for (const sx of [-1, 1]) { addPipe(sx * 13.6, 5.0, -44, sx * 13.6, 5.0, -68, 0.2, 0x55585c); addPipe(sx * 13.6, 4.3, -44, sx * 13.6, 4.3, -68, 0.12, 0x6a5a40); }
for (const z of [-18, -26, -33]) addPipe(-33.5, 3.0, z, -14.5, 3.0, z, 0.14, 0x55585c);
addPipe(-33.5, 2.55, -22, -14.5, 2.55, -22, 0.09, 0x6a5a40);
// 警報パネル(地下の奥)
const PANEL = { x: -26, z: -34.4 };
addBox(PANEL.x, PANEL.z, 3.4, 0.9, 1.9, 0x555560, 'panel');
{ const led = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 0.05), new THREE.MeshBasicMaterial({ color: 0xff2a1a })); led.position.set(PANEL.x, 1.3, PANEL.z + 0.5); scene.add(led); window.PANEL_LED = led; }
addSign('ALARM  警報', PANEL.x, 2.3, PANEL.z + 0.5, 0, 2.6, 0.55, '#2a0c0c', '#ff8a7a');

/* ---------- 明るさ: 外は明るく、屋内は暗め、排水路は真っ暗 ---------- */
const ambient = new THREE.AmbientLight(0xffffff, 0.75); scene.add(ambient);
for (const [x, y, z, c, i, d] of [[0, 5, -16, 0xffffff, 0.9, 26], [0, 5, -34, 0xffffee, 0.85, 26], [0, 5.4, -56, 0xffaa66, 1.0, 30], [0, 5, -78, 0x88ccff, 0.95, 26], [0, 5.4, -99, 0xff5544, 1.0, 30], [-24, 2.6, -22, 0xff4433, 0.8, 20]]) {
  const l = new THREE.PointLight(c, i, d); l.position.set(x, y, z); scene.add(l);
}
function zoneAt(x, z) {
  if (x > 150) return 'club';
  if (inZone(z, x, ZONES.tunnel)) return 'tunnel';
  if (inZone(z, x, ZONES.basement)) return 'basement';
  if (inZone(z, x, ZONES.building) || inZone(z, x, ZONES.armory) || inZone(z, x, ZONES.storage)) return 'building';
  return 'outside';
}
const ZONE_LOOK = { tunnel: { amb: 0.16, fog: 16 }, basement: { amb: 0.3, fog: 40 }, building: { amb: 0.42, fog: 55 }, outside: { amb: 0.75, fog: 75 }, club: { amb: 0.52, fog: 100 } };

function mergeGeos(geos) {
  let vc = 0, ic = 0; for (const g of geos) { vc += g.attributes.position.count; ic += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3), uv = new Float32Array(vc * 2), idx = new Uint32Array(ic); let vo = 0, io = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, vo * 3); nor.set(g.attributes.normal.array, vo * 3); if (g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2);
    if (g.index) for (let i = 0; i < g.index.count; i++) idx[io++] = g.index.array[i] + vo; else for (let i = 0; i < g.attributes.position.count; i++) idx[io++] = vo + i;
    vo += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); out.setIndex(new THREE.BufferAttribute(idx, 1)); out.computeBoundingSphere(); return out;
}
// 動かない見た目を「材質×場所(z方向に20mごと)」でまとめる。元のメッシュは当たり判定(弾・視線)用に残し、描画だけ止める
function mergeStatic() {
  const groups = new Map();
  for (const m of STATIC) {
    m.updateMatrixWorld(true); const cell = Math.floor((m.position.z - ZMIN) / 20) + ':' + Math.floor(m.position.x / 100), key = m.material.uuid + ':' + cell; let g = groups.get(key);
    if (!g) groups.set(key, g = { mat: m.material, geos: [] });
    const geo = m.geometry.clone(); geo.applyMatrix4(m.matrixWorld); g.geos.push(geo); m.visible = false;
  }
  for (const g of groups.values()) { const mesh = new THREE.Mesh(mergeGeos(g.geos), g.mat); scene.add(mesh); }
  return groups.size;
}
function wclamp(p, r) {   // ステージの外へ出ないように(施設とDJルームで範囲が違う)
  if (p.x > 150) { p.x = Math.max(CLUB.x0 + r, Math.min(CLUB.x1 - r, p.x)); p.z = Math.max(CLUB.z0 + r, Math.min(CLUB.z1 - r, p.z)); }
  else { p.x = Math.max(-A + r, Math.min(A - r, p.x)); p.z = Math.max(ZMIN + r, Math.min(A - r, p.z)); }
}
function resolve(p, r) {
  wclamp(p, r);
  for (const b of boxes) {
    const cx = Math.max(b.x0, Math.min(p.x, b.x1)), cz = Math.max(b.z0, Math.min(p.z, b.z1));
    const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) { const d = Math.sqrt(d2); p.x = cx + dx / d * r; p.z = cz + dz / d * r; }
      else {
        const l = p.x - b.x0, rr = b.x1 - p.x, t = p.z - b.z0, bt = b.z1 - p.z, m = Math.min(l, rr, t, bt);
        if (m === l) p.x = b.x0 - r; else if (m === rr) p.x = b.x1 + r; else if (m === t) p.z = b.z0 - r; else p.z = b.z1 + r;
      }
    }
  }
}
function insideBox(x, z, pad) { return boxes.some(b => x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad); }

/* ---------- 血・肉片 ---------- */
function makeSplatTex(seed) {   // 不規則な血だまり+飛び散り+下に垂れる筋
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  const R = (a, b) => a + Math.random() * (b - a);
  for (let k = 0; k < 16; k++) {
    const cx = 128 + R(-60, 60) * (k < 4 ? 0.3 : 1), cy = 128 + R(-60, 60) * (k < 4 ? 0.3 : 1), r = k < 4 ? R(28, 52) : R(6, 22);
    const g = x.createRadialGradient(cx, cy, 1, cx, cy, r); g.addColorStop(0, 'rgba(150,6,6,0.95)'); g.addColorStop(0.7, 'rgba(120,4,4,0.9)'); g.addColorStop(1, 'rgba(100,0,0,0)');
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 6.3); x.fill();
  }
  x.strokeStyle = 'rgba(110,4,4,0.9)'; x.lineCap = 'round';
  for (let k = 0; k < 7; k++) { const sx = 128 + R(-50, 50), sy = 128 + R(-30, 40); x.lineWidth = R(3, 9); x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + R(-5, 5), sy + R(30, 100)); x.stroke(); }
  for (let k = 0; k < 40; k++) { x.fillStyle = 'rgba(130,5,5,0.9)'; x.beginPath(); x.arc(R(10, 246), R(10, 246), R(1, 4), 0, 6.3); x.fill(); }
  const t = new THREE.CanvasTexture(c); return t;
}
const splatTexs = [makeSplatTex(), makeSplatTex(), makeSplatTex(), makeSplatTex()];
const decalMats = splatTexs.map(t => new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
const wallDecalMats = splatTexs.map(t => new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
const partGeo = new THREE.SphereGeometry(0.032, 6, 4); partGeo.scale(1, 1, 2.6);   // 進行方向に細長い雫
const partMats = [0xaa0000, 0xd10000, 0x7a0000, 0xe01818].map(c => new THREE.MeshBasicMaterial({ color: c }));
const particles = []; let pIdx = 0;
for (let i = 0; i < 2600; i++) {
  const m = new THREE.Mesh(partGeo, partMats[i % 4]); m.visible = false;
  m.userData = { vel: new THREE.Vector3(), life: 0 }; scene.add(m); particles.push(m);
}
const decalGeo = new THREE.PlaneGeometry(1, 1);
const decals = []; let dIdx = 0;
for (let i = 0; i < 520; i++) {
  const m = new THREE.Mesh(decalGeo, decalMats[i % 4]); m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); decals.push(m);
}
function splat(x, z, big) {
  const m = decals[dIdx++ % decals.length]; m.visible = true; m.material = decalMats[Math.random() * 4 | 0];
  m.position.set(x, 0.015 + (dIdx % 7) * 0.0006, z); m.scale.setScalar(big ? rnd(0.9, 2.4) : rnd(0.25, 0.8)); m.rotation.set(-Math.PI / 2, 0, rnd(0, 6.28));
}
const wallDecals = []; let wdIdx = 0;
for (let i = 0; i < 360; i++) { const m = new THREE.Mesh(decalGeo, wallDecalMats[i % 4]); m.visible = false; scene.add(m); wallDecals.push(m); }
function wallSplat(point, normal, size) {   // 壁・天井・床への血(法線に沿って貼る。垂れる筋は下向き)
  const m = wallDecals[wdIdx++ % wallDecals.length]; m.visible = true; m.material = wallDecalMats[Math.random() * 4 | 0];
  m.position.copy(point).addScaledVector(normal, 0.012 + (wdIdx % 9) * 0.0008); m.up.set(0, 1, 0); if (Math.abs(normal.y) > 0.9) m.up.set(rnd(-1, 1), 0, rnd(-1, 1));
  m.lookAt(point.x + normal.x, point.y + normal.y, point.z + normal.z); m.scale.setScalar(size);
}
const ZERO = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
function blood(pos, dir, n, power) {
  for (let i = 0; i < n; i++) {
    const m = particles[pIdx++ % particles.length]; m.visible = true; m.position.copy(pos);
    const v = m.userData.vel; v.set(rnd(-1, 1), rnd(-0.2, 1), rnd(-1, 1)).multiplyScalar(power * 0.6).addScaledVector(dir, power * rnd(0.3, 1));
    m.userData.life = rnd(0.6, 1.7); m.scale.setScalar(rnd(0.7, 2.6)); m.userData.s0 = m.scale.x;
  }
}
const gibs = [];
function spawnGib(src, vel, extra) {   // 戻り値: 作った破片
  const m = src.clone(true);   // 手は指ごと丸ごとコピーされる
  src.matrixWorld.decompose(m.position, m.quaternion, m.scale); m.updateMatrix();
  if (extra) { const f = extra.clone(true); f.position.copy(extra.position).sub(src.position); f.quaternion.identity(); m.add(f); }
  m.userData = { vel, av: new THREE.Vector3(rnd(-9, 9), rnd(-9, 9), rnd(-9, 9)), rest: false };
  carveCopy(src, m); scene.add(m); gibs.push(m);
  if (gibs.length > 160) scene.remove(gibs.shift());
  return m;
}
const tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler();
function updateDebris(dt) {
  updateImpacts(dt);
  for (const m of particles) {
    if (!m.visible) continue; const u = m.userData;
    u.vel.y -= 22 * dt; m.position.addScaledVector(u.vel, dt); u.life -= dt;
    { const d2 = m.position.distanceToSquared(camera.position); if (d2 < 2.25) { m.visible = false; continue; } const k = d2 < 9 ? 0.45 + 0.55 * (d2 - 2.25) / 6.75 : 1; if (!u.s0) u.s0 = m.scale.x; m.scale.setScalar(u.s0 * k); }
    if (u.vel.lengthSq() > 0.4) m.lookAt(m.position.x + u.vel.x, m.position.y + u.vel.y, m.position.z + u.vel.z);   // 速度の向きに雫を伸ばす
    if (m.position.y < 0.04) { if (Math.random() < 0.18) splat(m.position.x, m.position.z, false); u.life = 0; }
    if (u.life <= 0) m.visible = false;
  }
  for (const m of gibs) {
    const u = m.userData; if (u.rest) continue;
    u.vel.y -= 24 * dt; m.position.addScaledVector(u.vel, dt);
    tmpQ.setFromEuler(tmpE.set(u.av.x * dt, u.av.y * dt, u.av.z * dt)); m.quaternion.premultiply(tmpQ);
    if (Math.random() < 0.25) blood(m.position, ZERO, 1, 2);
    wclamp(m.position, 0.3);
    if (m.position.y < 0.2) {
      m.position.y = 0.2; u.vel.y *= -0.3; u.vel.x *= 0.65; u.vel.z *= 0.65; u.av.multiplyScalar(0.55);
      if (Math.abs(u.vel.y) < 0.8 && u.vel.lengthSq() < 0.8) { u.rest = true; splat(m.position.x, m.position.z, true); }
    }
  }
}

/* ---------- 着弾: 弾痕・火花 / 薬莢 ---------- */
const holeGeo = new THREE.CircleGeometry(0.06, 8), holeMat = new THREE.MeshBasicMaterial({ color: 0x0c0c0c, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
const holes = []; let hIdx = 0;
for (let i = 0; i < 180; i++) { const m = new THREE.Mesh(holeGeo, holeMat); m.visible = false; scene.add(m); holes.push(m); }
const sparkGeo = new THREE.BoxGeometry(0.035, 0.035, 0.035), sparkMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
const sparks = []; let sIdx = 0;
for (let i = 0; i < 160; i++) { const m = new THREE.Mesh(sparkGeo, sparkMat); m.visible = false; m.userData = { vel: new THREE.Vector3(), life: 0 }; scene.add(m); sparks.push(m); }
function impact(point, normal, big) {
  if (Math.random() < 0.6) sndRicochet(point);
  const h = holes[hIdx++ % holes.length]; h.visible = true; h.position.copy(point).addScaledVector(normal, 0.014); h.lookAt(point.x + normal.x, point.y + normal.y, point.z + normal.z); h.scale.setScalar(big ? 1.7 : rnd(0.7, 1.2));
  for (let i = 0; i < (big ? 9 : 5); i++) {
    const s = sparks[sIdx++ % sparks.length]; s.visible = true; s.position.copy(point); s.scale.setScalar(rnd(0.6, 1.4));
    s.userData.vel.set(rnd(-1, 1), rnd(-0.3, 1), rnd(-1, 1)).multiplyScalar(2.2).addScaledVector(normal, rnd(1.5, 4)); s.userData.life = rnd(0.15, 0.45);
  }
}
const casingGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.05, 6), casingMats = [new THREE.MeshLambertMaterial({ color: 0xc9a24a }), new THREE.MeshLambertMaterial({ color: 0xb02a22 })];
const casings = []; let cIdx = 0;
for (let i = 0; i < 48; i++) { const m = new THREE.Mesh(casingGeo, casingMats[0]); m.visible = false; m.userData = { vel: new THREE.Vector3(), av: new THREE.Vector3(), life: 0, rest: true }; scene.add(m); casings.push(m); }
function ejectCasing(pos, vel, shell) {
  const m = casings[cIdx++ % casings.length]; m.visible = true; m.position.copy(pos); m.material = casingMats[shell ? 1 : 0]; m.scale.set(shell ? 1.9 : 1, shell ? 1.7 : 1, shell ? 1.9 : 1);
  m.userData.vel.copy(vel); m.userData.av.set(rnd(-20, 20), rnd(-20, 20), rnd(-20, 20)); m.userData.life = 9; m.userData.rest = false; m.userData.bounced = false;
}
function updateImpacts(dt) {
  for (const s of sparks) { if (!s.visible) continue; const u = s.userData; u.vel.y -= 14 * dt; s.position.addScaledVector(u.vel, dt); u.life -= dt; if (u.life <= 0 || s.position.y < 0.02) s.visible = false; }
  for (const m of casings) {
    if (!m.visible) continue; const u = m.userData; u.life -= dt; if (u.life <= 0) { m.visible = false; continue; } if (u.rest) continue;
    u.vel.y -= 14 * dt; m.position.addScaledVector(u.vel, dt);
    tmpQ.setFromEuler(tmpE.set(u.av.x * dt, u.av.y * dt, u.av.z * dt)); m.quaternion.premultiply(tmpQ);
    if (m.position.y < 0.02) { m.position.y = 0.02; u.vel.y *= -0.35; u.vel.x *= 0.5; u.vel.z *= 0.5; u.av.multiplyScalar(0.4); if (!u.bounced) { u.bounced = true; sfx(5200, 0.05, 0.05); } if (Math.abs(u.vel.y) < 0.4) u.rest = true; }
  }
}

/* ---------- 弾道・メッセージ・画面効果 ---------- */
const tracers = [];
function tracer(a, b, color, life) {
  const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
  const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true }));
  l.userData = { life, max: life }; scene.add(l); tracers.push(l);
}
function updateTracers(dt) {
  for (let i = tracers.length - 1; i >= 0; i--) {
    const l = tracers[i]; l.userData.life -= dt; l.material.opacity = Math.max(0, l.userData.life / l.userData.max);
    if (l.userData.life <= 0) { scene.remove(l); l.geometry.dispose(); l.material.dispose(); tracers.splice(i, 1); }
  }
}
function showMsg(t, big, color) {
  const m = $('msg'); m.textContent = t; m.style.fontSize = big ? '70px' : '54px'; m.style.color = color || (big ? '#e00' : '#fff');
  m.classList.remove('show'); void m.offsetWidth; m.classList.add('show');
}
function hitMarker() { const h = $('hitm'); h.style.transition = 'none'; h.style.opacity = 1; requestAnimationFrame(() => { h.style.transition = 'opacity .18s'; h.style.opacity = 0; }); }
function healFlash() { const f = $('healfx'); if (!f) return; f.style.transition = 'none'; f.style.opacity = 0.75; requestAnimationFrame(() => { f.style.transition = 'opacity .6s'; f.style.opacity = 0; }); }
function redFlash(a) { const f = $('flash'); f.style.transition = 'none'; f.style.opacity = a; requestAnimationFrame(() => { f.style.transition = 'opacity .5s'; f.style.opacity = 0; }); }

/* ---------- Blenderモデル(madnesssss.blend)の読み込みと、指の曲げ ---------- */
const S0 = 0.215;                       // モデル単位 → メートル
let MODEL = null, MODEL_LOD = null; const REST = {};
const AX = new THREE.Vector3(1, 0, 0), AZ = new THREE.Vector3(0, 0, 1), _q = new THREE.Quaternion();
function loadCharacter(done) {
  const bin = atob(window.GRUNT_B64), u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  new THREE.GLTFLoader().parse(u8.buffer, '', gltf => {
    MODEL = gltf.scene.getObjectByName('Root') || gltf.scene;
    const jg = new THREE.SphereGeometry(1, 10, 8), joints = [];
    MODEL.traverse(o => { if (/^[LR]_[tf]\d+$/.test(o.name)) joints.push(o); });
    for (const o of joints) { const j = new THREE.Mesh(jg); j.name = 'Joint'; j.scale.setScalar(o.name[2] === 't' ? 0.23 : 0.2); o.add(j); } // 関節の丸で隙間を埋める
    MODEL.traverse(o => { REST[o.name] = { p: o.position.clone(), q: o.quaternion.clone() }; });
    // 敵用の軽いモデル(手と指の面を減らしたもの。関節の丸も省く)
    const lb = window.GRUNT_LOD_B64;
    if (!lb) { MODEL_LOD = MODEL; return done(); }
    const bin2 = atob(lb), u2 = new Uint8Array(bin2.length); for (let i = 0; i < bin2.length; i++) u2[i] = bin2.charCodeAt(i);
    new THREE.GLTFLoader().parse(u2.buffer, '', g2 => { MODEL_LOD = g2.scene.getObjectByName('Root') || g2.scene; done(); }, () => { MODEL_LOD = MODEL; done(); });
  }, err => { console.error(err); $('ovg').textContent = 'モデルの読み込みに失敗'; });
}
/* 指を曲げる: amt=0(開く)〜1.4(握る)。idxAmt で人差し指(f3)だけ別の値に */
const CURLW = [0.9, 1.1, 0.8];
function setCurl(N, side, amt, idxAmt) {
  for (const f of ['f1', 'f2', 'f3']) {
    const a = (f === 'f3' && idxAmt !== undefined) ? idxAmt : amt;
    for (let m = 0; m < 3; m++) { const n = N[`${side}_${f}${m}`]; n.quaternion.copy(REST[n.name].q).multiply(_q.setFromAxisAngle(AX, a * CURLW[m])); }
  }
  for (const [nm, k] of [['t0', 0.45], ['t1', 0.6]]) { const n = N[`${side}_${nm}`]; n.quaternion.copy(REST[n.name].q).multiply(_q.setFromAxisAngle(AX, amt * k)); }
}
