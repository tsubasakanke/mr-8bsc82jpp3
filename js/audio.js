"use strict";
/* ================= サウンド: WebAudio での合成(ファイル不要) =================
   音を「パンチ(破裂)+ボディ+低い衝撃+反響」の層で重ねて、コンプレッサーで潰して太くする。
   位置つきの音は、左右(パン)・距離(音量とこもり)を付ける。 */
let AC = null, M = null, ambF = null, ambG = null, windG = null, voiceCount = 0;

function makeIR(sec, decay) {   // 反響用のインパルス応答(減衰するノイズ)
  const n = Math.floor(AC.sampleRate * sec), b = AC.createBuffer(2, n, AC.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let lp = 0; for (let i = 0; i < n; i++) { const t = i / n; lp += ((Math.random() * 2 - 1) * Math.pow(1 - t, decay) - lp) * 0.3; d[i] = lp * 1.6; } }
  return b;
}
function ac() {
  if (!AC) {
    AC = new (window.AudioContext || window.webkitAudioContext)(); M = {};
    M.comp = AC.createDynamicsCompressor(); M.comp.threshold.value = -16; M.comp.knee.value = 18; M.comp.ratio.value = 7; M.comp.attack.value = 0.002; M.comp.release.value = 0.18;
    M.master = AC.createGain(); M.master.gain.value = 0.95 * VOL.master; M.dry = AC.createGain(); M.wet = AC.createGain(); M.wet.gain.value = 0.34;
    M.conv = AC.createConvolver(); M.conv.buffer = makeIR(1.7, 2.6);
    M.dry.connect(M.comp); M.conv.connect(M.wet); M.wet.connect(M.comp); M.comp.connect(M.master); M.master.connect(AC.destination);
    M.noise = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate); const d = M.noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startBGM();
  }
  if (AC.state === 'suspended') AC.resume();
}

/* ---------- 部品: ノイズ・トーン・出力バス ---------- */
function Nz(dest, t, dur, o) {   // ノイズのバースト(フィルター付き)
  const s = AC.createBufferSource(); s.buffer = M.noise; const f = AC.createBiquadFilter(); f.type = o.type || 'lowpass'; f.frequency.setValueAtTime(o.f0, t); if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + dur); f.Q.value = o.q || 0.7;
  const g = AC.createGain(), a = o.attack || 0.002, vv = o.vol * (o.type === 'highpass' && o.f0 >= 1400 ? 1.7 : 1);   // 鋭い破裂音(高域)を強めに
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vv, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
}
function Tn(dest, t, dur, f0, f1, type, vol, attack) {   // 音程が変わるトーン
  const o = AC.createOscillator(), g = AC.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(18, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (attack || 0.003)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
}
function bus(vol, pan, send, lp) {   // 1つの音の出口: 音量→(こもり)→(左右)→ ドライ+反響
  const g = AC.createGain(); g.gain.value = vol; let node = g;
  if (lp) { const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; node.connect(f); node = f; }
  if (pan && AC.createStereoPanner) { const p = AC.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); node.connect(p); node = p; }
  node.connect(M.dry); if (send > 0) { const s = AC.createGain(); s.gain.value = send; node.connect(s); s.connect(M.conv); }
  voiceCount++; setTimeout(() => voiceCount--, 1500); return g;
}
function where(pos) {   // 発生位置 → 音量・左右・こもり
  if (!pos || typeof P === 'undefined') return { vol: 1, pan: 0, lp: 0 };
  const dx = pos.x - P.pos.x, dz = pos.z - P.pos.z, d = Math.hypot(dx, dz), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
  return { vol: Math.min(1, 8 / (d + 5)), pan: d > 0.6 ? (dx * rx + dz * rz) / d * 0.9 : 0, lp: d > 10 ? Math.max(1100, 15000 / (1 + d * 0.14)) : 0 };
}
const busy = () => !AC || voiceCount > 46;

/* ---------- 銃声(武器ごとに層を変える) ---------- */
function gunshot(kind, vol, pos) {
  if (busy()) return;
  const w = where(pos), v = (vol == null ? 1 : vol) * w.vol * ({ pistol: 2.4, smg: 2.1, shotgun: 1.15, rifle: 1.6, deagle: 1.1 }[kind] || 1); if (v < 0.015) return; if (w.vol > 0.45) duckBGM(0.4); const t = AC.currentTime + 0.002;
  const R = { pistol: 0.18, smg: 0.3, shotgun: 0.55, rifle: 0.5, deagle: 0.6 }[kind] || 0.3, b = bus(v, w.pan, R, w.lp);
  if (kind === 'pistol') {          // サプレッサー付き: 「ぷしゅっ」と詰まった低めの音 + 機関部のカチャ
    Nz(b, t, 0.1, { type: 'bandpass', f0: 1500, f1: 420, q: 0.8, vol: 0.5 }); Tn(b, t, 0.12, 150, 55, 'sine', 0.4); Nz(b, t + 0.012, 0.03, { type: 'highpass', f0: 3500, vol: 0.13 });
    Nz(b, t + 0.09, 0.035, { type: 'bandpass', f0: 2600, q: 2, vol: 0.1 });   // スライドの戻り
  } else if (kind === 'smg') {      // 軽くて速い破裂音
    Nz(b, t, 0.025, { type: 'highpass', f0: 2600, vol: 0.55 }); Nz(b, t, 0.1, { type: 'bandpass', f0: 1900, f1: 600, q: 0.7, vol: 0.5 }); Tn(b, t, 0.13, 170, 58, 'sine', 0.5);
  } else if (kind === 'shotgun') {  // ドン!と腹に来る低音 + 広い炸裂
    Nz(b, t, 0.035, { type: 'highpass', f0: 1400, vol: 0.8 }); Nz(b, t, 0.4, { type: 'lowpass', f0: 4200, f1: 180, q: 0.6, vol: 0.95 }); Tn(b, t, 0.45, 118, 26, 'sine', 1.0, 0.004);
    Nz(b, t + 0.01, 0.55, { type: 'lowpass', f0: 500, f1: 70, vol: 0.55 });
    Nz(b, t + 0.52, 0.05, { type: 'bandpass', f0: 1800, q: 2, vol: 0.2 }); Nz(b, t + 0.6, 0.05, { type: 'bandpass', f0: 1300, q: 2, vol: 0.22 });   // ポンプ(ガシャッ)
  } else if (kind === 'rifle') {    // パァン!と鋭く、胴が太い
    Nz(b, t, 0.03, { type: 'highpass', f0: 3200, vol: 0.9 }); Nz(b, t, 0.22, { type: 'bandpass', f0: 1700, f1: 280, q: 0.6, vol: 0.85 }); Tn(b, t, 0.26, 135, 38, 'sine', 0.85);
    Nz(b, t + 0.055, 0.18, { type: 'bandpass', f0: 1100, f1: 300, q: 0.8, vol: 0.28 });   // 反射(すぐ後ろの壁)
  } else {                          // デザートイーグル: 巨大な衝撃と金属の余韻
    Nz(b, t, 0.04, { type: 'highpass', f0: 2400, vol: 1.0 }); Nz(b, t, 0.3, { type: 'bandpass', f0: 1300, f1: 200, q: 0.6, vol: 0.9 }); Tn(b, t, 0.5, 105, 24, 'sine', 1.1, 0.004);
    Tn(b, t, 0.35, 1750, 1500, 'sine', 0.1); Tn(b, t, 0.3, 2650, 2400, 'sine', 0.05);
  }
}

/* ---------- 汎用(従来の sfx も、層を重ねて太くした) ---------- */
function sfx(freq, dur, vol, boom, pos) {
  if (busy() || vol <= 0.003) return; const w = where(pos), v = vol * w.vol, t = AC.currentTime, b = bus(v, w.pan, 0.2, w.lp);
  Nz(b, t, dur, { type: 'lowpass', f0: freq, f1: 140, vol: 0.9 }); Nz(b, t, Math.min(0.03, dur), { type: 'highpass', f0: Math.min(freq * 1.6, 5000), vol: 0.25 });
  if (boom) Tn(b, t, dur * 1.1, boom, Math.max(24, boom * 0.3), 'sine', 0.9);
}

/* ---------- 個別の効果音 ---------- */
function sndHit(pos) {   // 弾が肉に当たる「ブシュッ」
  if (busy()) return; const w = where(pos), t = AC.currentTime, b = bus(0.55 * w.vol, w.pan, 0.1, w.lp);
  Nz(b, t, 0.09, { type: 'lowpass', f0: 1100, f1: 160, vol: 0.8 }); Tn(b, t, 0.1, 240, 90, 'sine', 0.5); Nz(b, t, 0.012, { type: 'highpass', f0: 3000, vol: 0.25 });
}
function sndGore(big, pos) {   // 肉が弾ける: 粘つくブチュッ + 骨のバキッ
  if (busy()) return; const w = where(pos), t = AC.currentTime, b = bus((big ? 1 : 0.75) * w.vol, w.pan, 0.35, w.lp);
  for (let i = 0; i < (big ? 6 : 3); i++) Nz(b, t + i * 0.035 + Math.random() * 0.02, 0.12 + Math.random() * 0.1, { type: 'bandpass', f0: 380 + Math.random() * 500, f1: 150, q: 3 + Math.random() * 4, vol: 0.55 });
  Tn(b, t, big ? 0.4 : 0.22, big ? 90 : 120, 30, 'sine', big ? 1.0 : 0.7);
  for (let i = 0; i < (big ? 5 : 2); i++) Nz(b, t + 0.015 + Math.random() * 0.2, 0.025, { type: 'highpass', f0: 2200 + Math.random() * 1800, vol: 0.4 });   // 骨
  if (big) Nz(b, t, 0.6, { type: 'lowpass', f0: 900, f1: 80, vol: 0.5 });
}
function sndExplosion(pos) {
  if (!AC) return; duckBGM(0.75); const w = where(pos), t = AC.currentTime, b = bus(Math.max(0.5, w.vol) * 1.2, w.pan, 0.7, w.lp);
  Nz(b, t, 0.05, { type: 'highpass', f0: 1500, vol: 1.0 }); Nz(b, t, 1.5, { type: 'lowpass', f0: 3000, f1: 70, q: 0.5, vol: 1.0 });
  Tn(b, t, 1.3, 70, 20, 'sine', 1.3, 0.005); Tn(b, t + 0.03, 0.9, 140, 35, 'sawtooth', 0.35);
  for (let i = 0; i < 10; i++) Nz(b, t + 0.15 + Math.random() * 1.1, 0.05 + Math.random() * 0.08, { type: 'bandpass', f0: 600 + Math.random() * 2500, q: 2, vol: 0.18 });   // 瓦礫のパラパラ
  Nz(b, t + 0.2, 1.8, { type: 'lowpass', f0: 260, f1: 50, vol: 0.5 });   // 地鳴り
}
function sndStep(vol, crouch) {
  if (busy()) return; const t = AC.currentTime, b = bus(vol * 3.2, (Math.random() - 0.5) * 0.2, 0.12, 0);
  Nz(b, t, 0.07, { type: 'lowpass', f0: crouch ? 380 : 650, f1: 120, vol: 0.8 }); Tn(b, t, 0.08, crouch ? 70 : 95, 45, 'sine', 0.55);
}
function sndDoor(pos) {   // サーボ音 + 最後のガチャ
  if (busy()) return; const w = where(pos), t = AC.currentTime, b = bus(0.7 * w.vol, w.pan, 0.35, w.lp);
  const o = AC.createOscillator(), g = AC.createGain(), f = AC.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.setValueAtTime(90, t); o.frequency.linearRampToValueAtTime(190, t + 0.5); f.type = 'lowpass'; f.frequency.value = 700;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.4, t + 0.08); g.gain.setValueAtTime(0.4, t + 0.55); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8); o.connect(f); f.connect(g); g.connect(b); o.start(t); o.stop(t + 0.9);
  Nz(b, t, 0.7, { type: 'bandpass', f0: 1800, f1: 900, q: 1, vol: 0.12 }); Tn(b, t + 0.62, 0.2, 120, 50, 'sine', 0.6); Nz(b, t + 0.62, 0.05, { type: 'bandpass', f0: 1200, q: 3, vol: 0.4 });
}
function sndCrusherWarn(pos) { if (busy()) return; const w = where(pos), t = AC.currentTime, b = bus(0.35 * w.vol, w.pan, 0.2, w.lp); Tn(b, t, 0.1, 1800, 1700, 'square', 0.25); Tn(b, t + 0.2, 0.1, 1800, 1700, 'square', 0.25); Nz(b, t, 0.5, { type: 'highpass', f0: 3000, vol: 0.12 }); }
function sndCrusherSlam(pos) {
  if (!AC) return; const w = where(pos), t = AC.currentTime, b = bus(Math.max(0.35, w.vol) * 1.15, w.pan, 0.55, w.lp);
  Tn(b, t, 0.7, 85, 22, 'sine', 1.2, 0.004); Nz(b, t, 0.12, { type: 'lowpass', f0: 2500, f1: 200, vol: 0.9 });
  for (const f of [310, 540, 830, 1210]) Tn(b, t, 0.7, f, f * 0.97, 'sine', 0.12);   // 金属の鳴り
  Nz(b, t + 0.02, 0.4, { type: 'highpass', f0: 4000, vol: 0.18 });
}
function sndPickup() { if (!AC) return; const t = AC.currentTime, b = bus(0.5, 0, 0.3, 0); Tn(b, t, 0.12, 1400, 1380, 'triangle', 0.3); Tn(b, t + 0.07, 0.2, 2100, 2080, 'triangle', 0.28); Nz(b, t, 0.03, { type: 'highpass', f0: 4000, vol: 0.2 }); }
function sndSwish() { if (!AC) return; const t = AC.currentTime, b = bus(0.6, 0, 0.15, 0); Nz(b, t, 0.2, { type: 'bandpass', f0: 600, f1: 3200, q: 1.2, vol: 0.5, attack: 0.07 }); }
function sndStab() { if (!AC) return; const t = AC.currentTime, b = bus(0.9, 0, 0.2, 0); Nz(b, t, 0.18, { type: 'bandpass', f0: 900, f1: 300, q: 4, vol: 0.7 }); Tn(b, t, 0.12, 200, 70, 'sine', 0.6); Nz(b, t + 0.06, 0.25, { type: 'bandpass', f0: 500, f1: 220, q: 6, vol: 0.4 }); }
function sndKick() { if (!AC) return; const t = AC.currentTime, b = bus(0.9, 0, 0.2, 0); Nz(b, t, 0.15, { type: 'bandpass', f0: 500, f1: 2500, q: 1, vol: 0.4, attack: 0.05 }); Tn(b, t + 0.08, 0.2, 130, 45, 'sine', 0.9); Nz(b, t + 0.08, 0.1, { type: 'lowpass', f0: 1500, f1: 200, vol: 0.7 }); }
function sndEmpty() { if (!AC) return; const t = AC.currentTime, b = bus(0.5, 0, 0.1, 0); Nz(b, t, 0.025, { type: 'bandpass', f0: 2400, q: 3, vol: 0.6 }); Tn(b, t, 0.04, 600, 300, 'square', 0.12); }
function sndHeal() { if (!AC) return; const t = AC.currentTime, b = bus(0.45, 0, 0.5, 0); for (const [i, f] of [[0, 520], [1, 660], [2, 880]]) Tn(b, t + i * 0.07, 0.35, f, f * 1.01, 'triangle', 0.22); }
function sndRicochet(pos) { if (busy()) return; const w = where(pos), t = AC.currentTime, b = bus(0.4 * w.vol, w.pan, 0.3, w.lp); Nz(b, t, 0.02, { type: 'highpass', f0: 3500, vol: 0.5 }); Tn(b, t + 0.005, 0.25, 3200, 1100, 'sine', 0.1); Nz(b, t, 0.07, { type: 'bandpass', f0: 2500, q: 2, vol: 0.2 }); }
function sndHurt() { if (!AC) return; const t = AC.currentTime, b = bus(0.8, 0, 0.3, 0); Tn(b, t, 0.2, 140, 50, 'sine', 0.9); Nz(b, t, 0.15, { type: 'lowpass', f0: 900, f1: 150, vol: 0.7 }); }
let sirenT = 0;
function sndSiren() { if (!AC) return; const t = AC.currentTime, b = bus(0.28, 0, 0.5, 0), o = AC.createOscillator(), g = AC.createGain(), f = AC.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.setValueAtTime(620, t); o.frequency.linearRampToValueAtTime(980, t + 0.45); o.frequency.linearRampToValueAtTime(620, t + 0.9); f.type = 'lowpass'; f.frequency.value = 1600; g.gain.setValueAtTime(0.5, t); g.gain.linearRampToValueAtTime(0.0001, t + 0.9); o.connect(f); f.connect(g); g.connect(b); o.start(t); o.stop(t + 0.95); }
function sndThump() { if (!AC) return; const t = AC.currentTime, b = bus(0.35, 0, 0.1, 0); Tn(b, t, 0.2, 60, 38, 'sine', 0.9); Tn(b, t + 0.22, 0.18, 55, 36, 'sine', 0.6); }   // 心音(HPが少ない時)

/* ---------- BGM(手続き生成): Madness Combat らしい重い電子ロック。強度が変わる ----------
   L0=潜入中(重い低音のパッドと心音) / L1=見つかった(4つ打ち+ベース) / L2=激しい(スネア+スタブ) / L3=狂気(倍速キック+歪んだアルペジオ)。M キーで ON/OFF */
const BGM_BASE = 0.34;   // BGMの音量(銃声より小さく)
const VOL = { master: 0.8, bgm: 1.0 }; try { const sv = JSON.parse(localStorage.getItem('mr-vol') || 'null'); if (sv) { VOL.master = sv.master; VOL.bgm = sv.bgm; } } catch (_) {}
const bgmVol = () => BGM_BASE * VOL.bgm;
function setVol(kind, v) {   // 音量: master=全体 / bgm=BGMだけ(0〜1)
  VOL[kind] = Math.max(0, Math.min(1, v)); try { localStorage.setItem('mr-vol', JSON.stringify(VOL)); } catch (_) {}
  if (AC && M) { const t = AC.currentTime; M.master.gain.setTargetAtTime(0.95 * VOL.master, t, 0.03); if (BGM.bus && BGM.on) BGM.bus.gain.setTargetAtTime(bgmVol(), t, 0.05); }
  const el = document.getElementById('vol_' + kind); if (el) el.value = Math.round(VOL[kind] * 100);
}
const BGMT = { main: { bpm: 172 }, club: { bpm: 150 } };
const BGM = { on: true, step: 0, nextT: 0, level: 0, tgt: 0, track: 'main', deadDone: false, bus: null, dist: null, lp: null, timer: null };
const NOTE = { E1: 41.2, G1: 49, A1: 55, B1: 61.7, D2: 73.4, E2: 82.4, G2: 98, A2: 110, B2: 123.5, E3: 164.8, G3: 196, A3: 220, B3: 246.9, D4: 293.7, E4: 329.6, G4: 392, B4: 493.9, D5: 587.3, E5: 659.3 };
function distCurve(k) { const n = 2048, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = (1 + k) * x / (1 + k * Math.abs(x)); } return c; }
function startBGM() {
  BGM.bus = AC.createGain(); BGM.bus.gain.value = BGM.on ? bgmVol() : 0; BGM.lp = AC.createBiquadFilter(); BGM.lp.type = 'lowpass'; BGM.lp.frequency.value = 9000; BGM.bus.connect(BGM.lp); BGM.lp.connect(M.dry);
  BGM.dist = AC.createWaveShaper(); BGM.dist.curve = distCurve(45); BGM.dist.oversample = '2x'; const dg = AC.createGain(); dg.gain.value = 0.55; BGM.dist.connect(dg); dg.connect(BGM.bus);
  BGM.nextT = AC.currentTime + 0.15; BGM.timer = setInterval(bgmTick, 40);
}
function bgmTick() {
  if (!AC) return; if (BGM.nextT < AC.currentTime - 0.1) BGM.nextT = AC.currentTime + 0.05;
  const tr = S.mode === 'club' ? 'club' : 'main'; if (tr !== BGM.track) { BGM.track = tr; BGM.step = 0; BGM.level = Math.round(BGM.tgt); }   // ステージが変わったら曲も変える
  const dead = tr === 'club' && S.djDead; if (dead && !BGM.deadDone) { BGM.deadDone = true; sndPowerDown(); } if (!dead) BGM.deadDone = false;
  const spb = 60 / (BGMT[tr].bpm * (BGM.level >= 3 ? 1.04 : 1)) / 4;
  while (BGM.nextT < AC.currentTime + 0.2) { if (BGM.on && !dead) bgmStep(BGM.step, BGM.nextT); BGM.step++; BGM.nextT += spb; }
}
function duckBGM(depth) { if (!BGM.bus || !BGM.on) return; const g = BGM.bus.gain, t = AC.currentTime; g.cancelScheduledValues(t); g.setTargetAtTime(bgmVol() * (1 - depth), t, 0.008); g.setTargetAtTime(bgmVol(), t + 0.1, 0.14); }   // 銃声の瞬間だけBGMを引っ込める
function toggleBGM() { BGM.on = !BGM.on; if (BGM.bus) BGM.bus.gain.setTargetAtTime(BGM.on ? bgmVol() : 0, AC.currentTime, 0.05); showMsg(BGM.on ? 'BGM ON' : 'BGM OFF', false, '#ccc'); }
Object.assign(NOTE, { F1: 43.65, Bb1: 58.27, C2: 65.41, F2: 87.31, Bb2: 116.54, C3: 130.8, D3: 146.8, F3: 174.6, Bb3: 233.1, C4: 261.6, F4: 349.2, Bb4: 466.2, C5: 523.3 });
/* --- 楽器(全部コードで合成)。Madness Combat らしい、歪んだベース・ブレイクビーツ・金属音・ノコギリ波のリード --- */
const bKick = (t, v, hard) => { const b = BGM.bus; Tn(b, t, hard ? 0.28 : 0.2, hard ? 190 : 135, hard ? 38 : 42, 'sine', v); if (hard) Tn(BGM.dist, t, 0.11, 150, 50, 'triangle', v * 0.4); Nz(b, t, 0.012, { type: 'highpass', f0: 2500, vol: v * 0.3 }); };
const bSnare = (t, v) => { const b = BGM.bus; Nz(b, t, 0.17, { type: 'bandpass', f0: 2100, f1: 900, q: 0.7, vol: v }); Tn(b, t, 0.1, 230, 140, 'triangle', v * 0.65); Nz(BGM.dist, t, 0.05, { type: 'highpass', f0: 3000, vol: v * 0.25 }); };
const bClap = (t, v) => { for (const d of [0, 0.011, 0.024]) Nz(BGM.bus, t + d, 0.1, { type: 'bandpass', f0: 1500, f1: 1100, q: 1.2, vol: v * (d ? 0.8 : 1) }); };
const bHat = (t, v, open) => Nz(BGM.bus, t, open ? 0.12 : 0.035, { type: 'highpass', f0: 7500, vol: v });
const bCrash = (t, v) => Nz(BGM.bus, t, 1.0, { type: 'highpass', f0: 4500, vol: v });
function bRiser(t, dur, v) { Nz(BGM.bus, t, dur, { type: 'bandpass', f0: 400, f1: 7500, q: 1.3, vol: v, attack: dur * 0.92 }); Tn(BGM.dist, t, dur, 110, 880, 'sawtooth', v * 0.12, dur * 0.9); }
function bClank(t, v) { for (const [f, r] of [[620, 1], [1330, 0.7], [2170, 0.5]]) Tn(BGM.bus, t, 0.6, f, f * 0.985, 'sine', v * r); Nz(BGM.bus, t, 0.06, { type: 'bandpass', f0: 3200, vol: v * 0.8 }); }
function saw2(t, f, dur, v, o) {   // ノコギリ波を少しずらして重ね、フィルターをかけて歪ませる(リーゼベース/スタブ共通)
  const fl = AC.createBiquadFilter(), g = AC.createGain(); fl.type = 'lowpass'; fl.Q.value = o.q || 3; fl.frequency.setValueAtTime(o.f0, t); fl.frequency.exponentialRampToValueAtTime(Math.max(60, o.f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + (o.atk || 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); fl.connect(g); g.connect(o.out || BGM.dist);
  for (const d of o.det || [-9, 9]) { const os = AC.createOscillator(); os.type = o.type || 'sawtooth'; os.frequency.value = f; os.detune.value = d; os.connect(fl); os.start(t); os.stop(t + dur + 0.05); }
}
const reese = (t, f, dur, v) => { saw2(t, f, dur, v, { f0: 1500, f1: 200, q: 4 }); Tn(BGM.bus, t, dur, f, f, 'sine', v * 0.8); };
const acid = (t, f, dur, v, acc) => { saw2(t, f, dur, v * (acc ? 1.25 : 1), { f0: acc ? 3400 : 1900, f1: 220, q: 13, det: [0], atk: 0.003 }); };
const raveStab = (t, freqs, dur, v) => { for (const f of freqs) saw2(t, f, dur, v, { f0: 3600, f1: 700, q: 1.2, det: [-14, 0, 14] }); };
function lead(t, f, dur, v) {   // 叫ぶようなリード: 矩形波+ノコギリ波(1オクターブ上)にビブラート
  const lfo = AC.createOscillator(), lg = AC.createGain(); lfo.frequency.value = 6.5; lg.gain.value = 28; lfo.connect(lg); lfo.start(t); lfo.stop(t + dur + 0.05);
  for (const [type, m, vv] of [['square', 1, 1], ['sawtooth', 2, 0.55]]) { const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.value = f * m; lg.connect(o.detune); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * vv, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(BGM.dist); o.start(t); o.stop(t + dur + 0.05); }
}
function pad(t, dur, v) { for (const [f, type] of [[NOTE.E1, 'sine'], [NOTE.B1, 'triangle'], [NOTE.E2, 'triangle'], [NOTE.F2, 'sine']]) { const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + dur * 0.5); g.gain.linearRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(BGM.bus); o.start(t); o.stop(t + dur + 0.05); } }
function sndPowerDown() {   // DJが倒れて音楽が止まる: ピッチが落ちて、レコードが止まる
  if (!AC) return; const t = AC.currentTime, b = bus(0.8, 0, 0.3, 0); Tn(b, t, 1.4, 900, 28, 'sawtooth', 0.3, 0.01); Tn(b, t, 1.2, 440, 20, 'square', 0.18, 0.01); Nz(b, t, 0.9, { type: 'bandpass', f0: 3000, f1: 200, q: 1.2, vol: 0.35 });
}
/* --- 曲1: 施設(172BPM)。E フリジアンの重いリフ。強度 L0=潜入の暗いドローン+金属音 / L1=4つ打ち+リフ / L2=ブレイクビーツ+スタブ+アシッド / L3=ハードコア(倍キック・スネアロール・叫ぶリード) --- */
const MBASS = [
  [NOTE.E1, 0, NOTE.E1, NOTE.E1, 0, NOTE.E1, 0, NOTE.G1, NOTE.E1, 0, NOTE.E1, 0, NOTE.F1, 0, NOTE.E1, 0],
  [NOTE.E1, 0, NOTE.E1, NOTE.E1, 0, NOTE.E1, NOTE.G1, 0, NOTE.A1, 0, NOTE.G1, 0, NOTE.F1, 0, NOTE.E1, NOTE.E1],
  [NOTE.E1, 0, NOTE.E1, NOTE.E1, 0, NOTE.E1, 0, NOTE.G1, NOTE.E1, 0, NOTE.E1, 0, NOTE.F1, 0, NOTE.E1, 0],
  [NOTE.E1, NOTE.E1, 0, NOTE.E1, NOTE.G1, 0, NOTE.A1, 0, NOTE.Bb1, 0, NOTE.A1, NOTE.G1, NOTE.F1, NOTE.E1, 0, NOTE.E1],
];
const MTR = [1, 1, 1, 1, 1.0595, 1.0595, 1.1225, 1.0595];   // 8小節の進行(E E E E F F G F)
const MLEAD = [NOTE.E4, NOTE.F4, NOTE.E4, NOTE.B4, NOTE.C5, NOTE.B4, NOTE.F4, NOTE.E4];
function mainStep(i, t) {
  const s = i % 16, b8 = Math.floor(i / 16) % 8, bar = b8 % 4, tr = MTR[b8]; if (s === 0 && b8 % 4 === 0) BGM.level = Math.round(BGM.tgt);   // 強度は4小節ごとに切り替える
  const L = BGM.level, spb = 60 / BGMT.main.bpm / 4;
  if (s === 0 && bar === 0) pad(t, spb * 64 * 1.05, L === 0 ? 0.1 : 0.04);
  if (L === 0) { if (s === 0 && bar % 2 === 0) bKick(t, 0.45); if (s === 6 && bar % 2 === 0) bKick(t, 0.25); if (s === 8 && bar === 3) bClank(t, 0.13); if (s === 0 && bar === 2) bClank(t, 0.08); return; }   // 潜入中: 重い鼓動と遠くの金属音
  const kicks = L >= 3 ? [0, 3, 6, 8, 10, 12, 14] : L === 2 ? (bar % 2 ? [0, 3, 6, 10] : [0, 6, 10]) : [0, 4, 8, 12];
  if (kicks.includes(s)) bKick(t, L >= 3 ? 0.88 : 0.82, true);
  if (L >= 2 ? (s === 4 || s === 12) : (s === 4 || s === 12)) bSnare(t, L >= 3 ? 0.6 : 0.5);
  if (L >= 2 && (s === 7 || s === 15) && bar % 2 === 1) bSnare(t, 0.2);   // ゴーストスネア(ブレイクビーツ風)
  if (L >= 3 && b8 === 7 && s >= 8) bSnare(t, 0.2 + (s - 8) * 0.06);   // 8小節目のスネアロール
  if (L >= 2) bHat(t, s % 4 === 2 ? 0.2 : 0.1, L >= 3 && s % 4 === 2); else if (s % 2 === 0) bHat(t, s % 4 === 2 ? 0.2 : 0.09, false);
  if (s === 0 && b8 === 0) bCrash(t, 0.16);
  if (s === 0 && b8 === 6) bRiser(t, spb * 32, L >= 3 ? 0.2 : 0.12);
  const bn = MBASS[bar][s]; if (bn) reese(t, bn * tr, spb * 1.9, 0.5 + (L >= 2 ? 0.1 : 0));
  if (L >= 2 && bar % 2 === 0 && (s === 0 || s === 6 || s === 10)) raveStab(t, [NOTE.E3 * tr, NOTE.B3 * tr, NOTE.F3 * tr], spb * 2.2, 0.03);
  if (L >= 2 && bar % 2 === 1 && (s === 3 || s === 8 || s === 11)) raveStab(t, [NOTE.G3 * tr, NOTE.D4 * tr], spb * 2, 0.03);
  if (L >= 2 && s % 4 === 3 && bar >= 2) acid(t, NOTE.E2 * tr * (s === 7 ? 1.5 : 1), spb * 1.2, 0.07, s === 11);
  if (L >= 3 && s % 2 === 0) lead(t, MLEAD[(s / 2 + b8) % 8] * tr, spb * 1.8, 0.035);
}
/* --- 曲2: DJルーム(150BPM)。ハードテクノ/レイヴ: 歪んだ4つ打ち・裏拍のベース・アシッド・レイヴスタブ・ライザー。常に盛り上がる --- */
const CACID = [NOTE.E2, 0, NOTE.E2, NOTE.G2, NOTE.E2, 0, NOTE.A2, NOTE.E2, 0, NOTE.E2, NOTE.B2, 0, NOTE.G2, NOTE.E2, NOTE.F2, 0];
const CLEAD = [NOTE.E4, NOTE.B4, NOTE.G4, NOTE.B4, NOTE.E5, NOTE.B4, NOTE.G4, NOTE.B4];
function clubStep(i, t) {
  const s = i % 16, b8 = Math.floor(i / 16) % 8, bar = b8 % 4; if (s === 0 && b8 % 4 === 0) BGM.level = Math.round(BGM.tgt);
  const L = Math.max(2, BGM.level), spb = 60 / BGMT.club.bpm / 4, brk = b8 === 7 && L < 3 ? 0.5 : 1;   // 8小節目はキックが半分(ブレイク)
  if (s === 0 && bar === 0) pad(t, spb * 64 * 1.05, 0.04);
  if (s % 4 === 0 && !(b8 === 7 && s >= 8 && L < 3)) bKick(t, 0.9, true);
  if (s === 4 || s === 12) bClap(t, 0.5);
  if (s % 4 === 2) { bHat(t, 0.24, true); } else if (s % 2 === 1) bHat(t, 0.08, false);
  if (s % 4 === 2 || (L >= 3 && s % 4 === 3)) reese(t, NOTE.E1 * MTR[b8], spb * 1.4, 0.55);   // 裏拍のベース
  if (L >= 2 && bar >= 1 && CACID[s]) acid(t, CACID[s] * (b8 >= 4 ? 1.0595 : 1), spb * 0.9, 0.075, s % 8 === 3);
  if ((s === 0 && bar % 2 === 0) || s === 6 || s === 10) raveStab(t, [NOTE.E3 * MTR[b8], NOTE.G3 * MTR[b8], NOTE.B3 * MTR[b8], NOTE.D4 * MTR[b8]], spb * 2.4, 0.026);
  if (L >= 3 && s % 2 === 0) lead(t, CLEAD[(s / 2) % 8] * MTR[b8], spb * 1.7, 0.03);
  if (s === 0 && b8 === 0) bCrash(t, 0.18);
  if (s === 0 && b8 === 6) bRiser(t, spb * 32, 0.16);
  if (b8 === 7 && s >= 8) bSnare(t, 0.18 + (s - 8) * 0.05);
}
function bgmStep(i, t) { if (BGM.track === 'club') clubStep(i, t); else mainStep(i, t); }
let beatT = 0, beatN = 0, stepT = 0, heartT = 0;
function updateAudio(dt, zone, combat, mtier) {
  if (!AC) return; const t = AC.currentTime;
  M.wet.gain.setTargetAtTime(zone === 'outside' ? 0.2 : (zone === 'tunnel' ? 0.5 : 0.36), t, 0.4);   // 屋内ほど響く
  BGM.tgt = combat ? (mtier >= 2 ? 3 : mtier >= 1 ? 2 : 1) : (mtier >= 1 ? 1 : 0);
  if (S.mode === 'club') BGM.tgt = (combat && mtier >= 1) || mtier >= 2 ? 3 : 2;   // DJルームは常に盛り上がっている
  if (BGM.lp) BGM.lp.frequency.setTargetAtTime(zone === 'tunnel' ? 700 : (zone === 'basement' ? 3500 : 9000), t, 0.5);   // 排水路ではこもる
  if (P.hp < 35 && P.hp > 0) { heartT -= dt; if (heartT <= 0) { heartT = 0.8 + P.hp / 100; sndThump(); } }
}
function stepSound(dt, speed, onGround, crouch, sprint) {   // 足音: 走り/しゃがみで間隔と大きさが変わる
  if (!AC || !onGround || speed < 1.5) { stepT = 0; return; }
  stepT -= dt * speed; if (stepT <= 0) { stepT = crouch ? 2.6 : (sprint ? 3.6 : 3.2); sndStep(crouch ? 0.12 : (sprint ? 0.42 : 0.28), crouch); }
}
