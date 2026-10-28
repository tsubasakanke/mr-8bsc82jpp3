"use strict";
/* ================= ゴア・粉砕: 肉片・壁の血・手足の切断・画面の血しぶき・ヒットストップ ================= */

/* ---------- 肉片(小さな塊が大量に飛び散る) ---------- */
const chunkGeo = new THREE.BoxGeometry(1, 1, 1);
const chunkMats = [0x8a0a0a, 0xb01414, 0x5a0606, 0x3a0404, 0xd8c8b8].map(c => new THREE.MeshLambertMaterial({ color: c }));   // 肉・内臓・骨
const chunks = []; let chIdx = 0;
for (let i = 0; i < 320; i++) {
  const m = new THREE.Mesh(chunkGeo, chunkMats[i % 5]); m.visible = false; m.userData = { vel: new THREE.Vector3(), av: new THREE.Vector3(), rest: true };
  scene.add(m); chunks.push(m);
}
function spawnChunks(pos, dir, n, power) {
  for (let i = 0; i < n; i++) {
    const m = chunks[chIdx++ % chunks.length], u = m.userData; m.visible = true; m.position.copy(pos); m.position.y += rnd(-0.3, 0.4);
    const s = rnd(0.05, 0.2); m.scale.set(s * rnd(0.7, 1.6), s * rnd(0.7, 1.4), s * rnd(0.7, 1.6)); m.rotation.set(rnd(0, 6), rnd(0, 6), rnd(0, 6));
    u.vel.set(rnd(-1, 1), rnd(0.2, 1.3), rnd(-1, 1)).multiplyScalar(power * 0.55).addScaledVector(dir, power * rnd(0.2, 0.9)); u.av.set(rnd(-14, 14), rnd(-14, 14), rnd(-14, 14)); u.rest = false;
    // カメラの近くから出た肉片は、カメラへ向かって飛ばさない(視界を覆わないよう反射) + 小さめにする
    const dc = m.position.distanceTo(camera.position); if (dc < 5) { const cx = (camera.position.x - m.position.x) / (dc || 1), cy = (camera.position.y - m.position.y) / (dc || 1), cz = (camera.position.z - m.position.z) / (dc || 1), dp = u.vel.x * cx + u.vel.y * cy + u.vel.z * cz; if (dp > 0) { u.vel.x -= 1.8 * dp * cx; u.vel.y -= 1.8 * dp * cy; u.vel.z -= 1.8 * dp * cz; } m.scale.multiplyScalar(0.55 + 0.09 * dc); }
  }
}
function updateChunks(dt) {
  for (const m of chunks) {
    const u = m.userData; if (!m.visible || u.rest) continue;
    { const d2 = m.position.distanceToSquared(camera.position); if (d2 < 1.0 || (d2 < 4 && m.scale.x > 0.14)) { m.visible = false; continue; } }   // カメラに近い肉片は消す(視界確保)
    u.vel.y -= 22 * dt; m.position.addScaledVector(u.vel, dt);
    tmpQ.setFromEuler(tmpE.set(u.av.x * dt, u.av.y * dt, u.av.z * dt)); m.quaternion.premultiply(tmpQ);
    if (Math.random() < 0.22) blood(m.position, ZERO, 1, 1.6);
    wclamp(m.position, 0.3);
    if (m.position.y < 0.05) {
      m.position.y = 0.05; u.vel.y *= -0.3; u.vel.x *= 0.6; u.vel.z *= 0.6; u.av.multiplyScalar(0.5);
      if (Math.abs(u.vel.y) < 0.7 && u.vel.lengthSq() < 0.9) { u.rest = true; if (Math.random() < 0.5) splat(m.position.x, m.position.z, false); }
    }
  }
}

/* ---------- 大量の血と、壁・床・天井への飛び散り ---------- */
const _gr = new THREE.Vector3(), _gp = new THREE.Vector3();
function wallSprays(pos, n, reach, size) {   // 周囲に向けて光線を飛ばし、当たった面に血を貼る
  for (let k = 0; k < n; k++) {
    _gr.set(rnd(-1, 1), k % 5 === 0 ? -1 : rnd(-0.35, 0.8), rnd(-1, 1)).normalize(); rc.set(pos, _gr); rc.far = reach;
    const hit = rc.intersectObjects(obstacleMeshes, false)[0]; if (!hit || !hit.face) continue;
    wallSplat(hit.point, hit.face.normal.clone().transformDirection(hit.object.matrixWorld), size * rnd(0.6, 1.2));
  }
}
function goreBurst(pos, dir, big) {
  blood(pos, dir, big ? 420 : 130, big ? 14 : 9);
  spawnChunks(pos, dir, big ? 34 : 12, big ? 9 : 6);
  wallSprays(pos, big ? 12 : 5, big ? 7 : 4.5, big ? 2.4 : 1.4);
  splat(pos.x, pos.z, true); splat(pos.x + rnd(-1, 1), pos.z + rnd(-1, 1), true); if (big) { splat(pos.x + rnd(-1.5, 1.5), pos.z + rnd(-1.5, 1.5), true); splat(pos.x + rnd(-1.5, 1.5), pos.z + rnd(-1.5, 1.5), true); }
  const d = Math.hypot(P.pos.x - pos.x, P.pos.z - pos.z); if (d < (big ? 7 : 3.5)) screenSplat(big ? 4 : 2);
}
// 当たった時の血しぶき(敵の後ろの壁にも飛ぶ)
function hitSpray(pt, dir) {
  if (Math.random() > 0.45) return;
  rc.set(pt, dir); rc.far = 5; const hit = rc.intersectObjects(obstacleMeshes, false)[0];
  if (hit && hit.face) wallSplat(hit.point, hit.face.normal.clone().transformDirection(hit.object.matrixWorld), rnd(0.7, 1.5));
}

/* ---------- 手足の切断 ---------- */
function popLimb(e, name, dir) {
  const n = e.N[name]; if (!n || !n.visible) return false;
  e.g.updateMatrixWorld(true);
  spawnGib(n, new THREE.Vector3(dir.x * 6 + rnd(-2, 2), rnd(3, 7), dir.z * 6 + rnd(-2, 2)));
  n.visible = false; (e.lost || (e.lost = {}))[name] = true;
  _gp.setFromMatrixPosition(n.matrixWorld); blood(_gp, UP, 60, 8); spawnChunks(_gp, dir, 6, 5); sndGore(false, _gp);
  return true;
}

/* ---------- 画面に血しぶき: 厚みと光沢のある血の塊が、レンズに貼りついてゆっくり垂れる ---------- */
const bsCanvas = document.createElement('canvas'); bsCanvas.id = 'bloodscreen'; let BSW = 960, BSH = 540;
function sizeBloodCanvas() { const k = Math.min(1, 1100 / Math.max(innerWidth, innerHeight)); BSW = Math.max(200, Math.round(innerWidth * k)); BSH = Math.max(200, Math.round(innerHeight * k)); bsCanvas.width = BSW; bsCanvas.height = BSH; }   // 画面と同じ縦横比にして、血が歪まないように
sizeBloodCanvas(); addEventListener('resize', sizeBloodCanvas);
Object.assign(bsCanvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '3' });
document.body.appendChild(bsCanvas); const bsx = bsCanvas.getContext('2d'); let bsActive = 0; const bsBlobs = [];
function drawBlob(x, y, r) {   // 不規則な塊: 暗い縁 → べた塗りの赤 → 内側の深み → 光沢
  const n = 6 + (r / 16 | 0), parts = [];
  for (let k = 0; k < n; k++) { const a = rnd(0, 6.28), d = k === 0 ? 0 : rnd(0, r * 0.6); parts.push({ cx: x + Math.cos(a) * d, cy: y + Math.sin(a) * d * 0.85, rr: r * (k === 0 ? rnd(0.7, 0.9) : rnd(0.3, 0.62)) }); }
  bsx.fillStyle = 'rgba(70,0,0,0.95)'; for (const q of parts) { bsx.beginPath(); bsx.arc(q.cx, q.cy, q.rr + 3, 0, 6.3); bsx.fill(); }      // 縁
  bsx.fillStyle = 'rgba(150,5,5,0.97)'; for (const q of parts) { bsx.beginPath(); bsx.arc(q.cx, q.cy, q.rr, 0, 6.3); bsx.fill(); }          // 本体
  const dg = bsx.createRadialGradient(x + r * 0.1, y + r * 0.15, r * 0.05, x + r * 0.1, y + r * 0.15, r * 0.8); dg.addColorStop(0, 'rgba(95,0,0,0.55)'); dg.addColorStop(1, 'rgba(95,0,0,0)');
  bsx.fillStyle = dg; bsx.beginPath(); bsx.arc(x + r * 0.1, y + r * 0.15, r * 0.8, 0, 6.3); bsx.fill();                                           // 内側の深み
  const hx = x - r * 0.28, hy = y - r * 0.32; bsx.fillStyle = 'rgba(255,205,195,0.5)'; bsx.beginPath(); bsx.ellipse(hx, hy, r * 0.17, r * 0.1, -0.6, 0, 6.3); bsx.fill();   // 光沢
  bsx.fillStyle = 'rgba(255,225,215,0.7)'; bsx.beginPath(); bsx.ellipse(hx - r * 0.03, hy - r * 0.02, r * 0.06, r * 0.035, -0.6, 0, 6.3); bsx.fill();
  for (let k = 0; k < r / 6; k++) { const px = x + rnd(-r * 1.5, r * 1.5), py = y + rnd(-r * 1.3, r * 1.3), pr = rnd(1.5, 5); bsx.fillStyle = 'rgba(70,0,0,0.9)'; bsx.beginPath(); bsx.arc(px, py, pr + 1, 0, 6.3); bsx.fill(); bsx.fillStyle = 'rgba(150,5,5,0.95)'; bsx.beginPath(); bsx.arc(px, py, pr, 0, 6.3); bsx.fill(); }   // 飛沫
}
let bsLevel = 0, bsFadeT = 0;   // 画面にある血の量(0〜1)。上限に近いほど、新しい血は付きにくい → 視界が血で埋まらない
function screenSplat(n) {
  n = Math.min(4, Math.max(1, n || 1)); const room = Math.max(0, 1 - bsLevel / 0.9), count = Math.round((n * 1.4 + 0.6) * room); if (count <= 0) return;
  bsCanvas.style.opacity = '1'; bsActive = 7; const sc = Math.min(BSW, BSH) / 540;
  for (let i = 0; i < count; i++) {
    let x, y, tries = 0;   // 画面の中央(照準のまわり)は、ほぼ避ける
    do { x = rnd(BSW * 0.03, BSW * 0.97); y = rnd(BSH * 0.04, BSH * 0.96); tries++; } while (tries < 8 && Math.abs(x - BSW / 2) < BSW * 0.2 && Math.abs(y - BSH / 2) < BSH * 0.2);
    const r = rnd(16, 40) * sc * (n > 3 && Math.random() < 0.3 ? 1.5 : 1); drawBlob(x, y, r); bsLevel += 0.055 * (r / (28 * sc));
    if (Math.random() < 0.7) bsBlobs.push({ x: x + rnd(-r * 0.3, r * 0.3), y: y + r * 0.35, r: r * rnd(0.1, 0.17), vy: rnd(6, 20), life: rnd(2.5, 5.5) });
  }
  if (bsBlobs.length > 45) bsBlobs.splice(0, bsBlobs.length - 45);
}
function resetGoreScreen() { bsx.clearRect(0, 0, BSW, BSH); bsBlobs.length = 0; bsLevel = 0; bsActive = 0; bsFadeT = 0; fovKick = 0; camera.fov = 82; camera.updateProjectionMatrix(); }
function updateGoreScreen(dt) {
  bsLevel = Math.max(0, bsLevel - dt * 0.22);
  if (bsActive <= 0) return; bsActive -= dt;
  for (let i = bsBlobs.length - 1; i >= 0; i--) {   // 雫がゆっくり落ちて、跡(筋)を残す
    const b = bsBlobs[i]; b.life -= dt; if (b.life <= 0 || b.y > BSH + 20) { bsBlobs.splice(i, 1); continue; }
    const y0 = b.y; b.vy = Math.min(60, b.vy * (1 + dt * 0.35)); b.y += b.vy * dt;
    bsx.strokeStyle = 'rgba(125,2,2,0.92)'; bsx.lineWidth = b.r * 1.5; bsx.lineCap = 'round'; bsx.beginPath(); bsx.moveTo(b.x, y0); bsx.lineTo(b.x, b.y); bsx.stroke();
    bsx.fillStyle = 'rgba(150,6,6,0.95)'; bsx.beginPath(); bsx.arc(b.x, b.y, b.r * 1.15, 0, 6.3); bsx.fill();
  }
  bsFadeT += dt; if (bsFadeT >= 0.1) {   // 0.1秒ごとに6%ずつ消す(毎フレームの極小の消しだと、薄いもやが残って、最後に突然消えるため)
    bsx.globalCompositeOperation = 'destination-out'; bsx.fillStyle = `rgba(0,0,0,${1 - Math.exp(-bsFadeT * (bsActive < 1.5 ? 3.2 : 0.75))})`; bsx.fillRect(0, 0, BSW, BSH); bsx.globalCompositeOperation = 'source-over'; bsFadeT = 0;
  }
  if (bsActive <= 0) { bsx.clearRect(0, 0, BSW, BSH); bsBlobs.length = 0; }
}

/* ---------- ヒットストップ・FOVパンチ ---------- */
let fovKick = 0;
function hitStop(t) { S.freeze = Math.max(S.freeze || 0, t); }
function punchFov(v) { fovKick = Math.max(fovKick, v); }
function updateFov(dt) {
  if (fovKick > 0.05) { fovKick *= Math.exp(-9 * dt); camera.fov = 82 + fovKick; camera.updateProjectionMatrix(); }
  else if (camera.fov !== 82) { fovKick = 0; camera.fov = 82; camera.updateProjectionMatrix(); }
}
