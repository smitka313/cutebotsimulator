/* Arena, physics, sensors and drawing for the virtual Cutebot.
   Sensing and physics are pure geometry + seeded randomness, so a run can be replayed exactly. */
(() => {
'use strict';
const L = window.Lab;
const { W, H, PXCM, LINE_W, ROBOT_R, SENSOR_FWD, SENSOR_SIDE, SONAR_FWD } = L;

const bot = L.bot = { x: 60, y: 40, a: 0, vl: 0, vr: 0, cmdL: 0, cmdR: 0, lights: ['#000000', '#000000'], servo: [90, 90],
  under: [0, 0], underBright: 128, bumpT: -1e9, bumps: 0, lineL: 1, lineR: 1, sonar: 0, odo: 0, turn: 0, clock: 0 };
// on = the viewer's setting; active = what the current run uses (fixed when Run is pressed)
L.real = { on: false, active: false, gainL: 1, gainR: 1, deadband: 15 };

/* ---------- geometry helpers ---------- */
L.TRACK = { r: 22, x1: 32, x2: 88, cy: 40 };
L.distToStadium = function (x, y) {
  const { r, x1, x2, cy } = L.TRACK;
  if (x < x1) return Math.abs(Math.hypot(x - x1, y - cy) - r);
  if (x > x2) return Math.abs(Math.hypot(x - x2, y - cy) - r);
  return Math.min(Math.abs(y - (cy - r)), Math.abs(y - (cy + r)));
};
function segDist(x, y, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / len)) : 0;
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}
/** [distance, segment index] from a point to a closed polyline */
L.distToPolyline = function (x, y, P) {
  let best = Infinity, idx = 0;
  for (let i = 0; i < P.length; i++) { const d = segDist(x, y, P[i], P[(i + 1) % P.length]); if (d < best) { best = d; idx = i; } }
  return [best, idx];
};

/* ---------- maps ---------- */
function curvyPoints() {
  const P = [[22,18],[60,12],[98,18],[108,44],[92,66],[62,52],[34,66],[12,46]];
  const out = [], n = P.length;
  for (let i = 0; i < n; i++) {
    const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
    for (let k = 0; k < 40; k++) {
      const t = k / 40, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  return out;
}
const CURVY = L.CURVY = curvyPoints();
const curvyStart = () => { const p = CURVY[20], q = CURVY[21]; return { x: p[0], y: p[1], a: Math.atan2(q[0] - p[0], -(q[1] - p[1])) }; };
const HALF = LINE_W / 2;
const MAPS = L.MAPS = {
  track: { name: 'Line track', start: { x: 50, y: 62, a: Math.PI / 2 }, boxes: [], grid: false,
    black: (x, y) => L.distToStadium(x, y) <= HALF || (x >= 58.8 && x <= 58.8 + LINE_W && y >= 55 && y <= 69),
    floor(c) { const { r, x1, x2, cy } = L.TRACK; c.lineWidth = LINE_W; c.strokeStyle = '#111';
      c.beginPath(); c.moveTo(x1, cy - r); c.lineTo(x2, cy - r); c.arc(x2, cy, r, -Math.PI / 2, Math.PI / 2); c.lineTo(x1, cy + r); c.arc(x1, cy, r, Math.PI / 2, Math.PI * 1.5); c.closePath(); c.stroke();
      c.fillStyle = '#111'; c.fillRect(58.8, 55, LINE_W, 14); } },
  curvy: { name: 'Curvy track', start: curvyStart(), boxes: [], grid: false,
    black: (x, y) => L.distToPolyline(x, y, CURVY)[0] <= HALF,
    floor(c) { c.lineWidth = LINE_W; c.strokeStyle = '#111'; c.lineJoin = 'round'; c.beginPath(); CURVY.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.stroke(); } },
  room: { name: 'Obstacle room', start: { x: 12, y: 40, a: Math.PI / 2 }, grid: true,
    boxes: [{ x: 34, y: 0, w: 10, h: 28 }, { x: 34, y: 56, w: 10, h: 24 }, { x: 70, y: 30, w: 14, h: 18 }, { x: 98, y: 8, w: 12, h: 12 }, { x: 96, y: 60, w: 14, h: 10 }],
    black: () => false, floor() {} },
  sumo: { name: 'Sumo ring', start: { x: 60, y: 40, a: 0 }, grid: false, boxes: [{ x: 74, y: 22, w: 9, h: 9 }],
    black: (x, y) => { const r = Math.hypot(x - 60, y - 40); return r > 33 && r <= 37; },
    floor(c) { c.fillStyle = '#e9e9e4'; c.fillRect(0, 0, W, H); c.fillStyle = '#111'; c.beginPath(); c.arc(60, 40, 37, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(60, 40, 33, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#c8c8c0'; c.fillRect(52, 39.5, 4, 1); c.fillRect(64, 39.5, 4, 1); } },
  open: { name: 'Open floor', start: { x: 60, y: 40, a: 0 }, boxes: [], grid: true, black: () => false, floor() {} },
  mat: { name: 'My track (draw your own)', start: { x: 20, y: 40, a: Math.PI / 2 }, boxes: [], grid: false, black: () => false, floor() {} }
};

L.arena = { map: 'track', edits: {} };      // edits[map] = { strokes: [], boxes?: [], start?: {x,y,a} }
const PRISTINE = { strokes: [] };
// Challenges set L.pristine so the original arena is used, whatever the student drew.
const ed = L.edits = (m = L.arena.map) => L.pristine ? (PRISTINE.strokes.length = 0, delete PRISTINE.boxes, delete PRISTINE.start, PRISTINE) : (L.arena.edits[m] ||= { strokes: [] });
L.boxes = () => ed().boxes || MAPS[L.arena.map].boxes;
L.ownBoxes = () => { const e = ed(); if (!e.boxes) e.boxes = MAPS[L.arena.map].boxes.map(b => ({ ...b })); return e.boxes; };
L.startPose = () => L.startOverride || ed().start || MAPS[L.arena.map].start;
L.mapEdited = () => { const e = !L.pristine && L.arena.edits[L.arena.map]; return !!e && (e.strokes.length > 0 || !!e.boxes || !!e.start); };

/* The floor picture is only for show. Sensors use the same shapes as geometry (see isBlack). */
const floorCanvas = document.createElement('canvas');
floorCanvas.width = W * PXCM; floorCanvas.height = H * PXCM;
const fctx = floorCanvas.getContext('2d');
function strokePath(c, s) {
  c.lineWidth = s.k === 'e' ? 6 : LINE_W; c.strokeStyle = s.k === 'e' ? '#ffffff' : '#111111'; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); s.pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]));
  if (s.pts.length === 1) c.lineTo(s.pts[0][0] + .01, s.pts[0][1]);
  c.stroke();
}
L.buildFloor = function () {
  const c = fctx;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, floorCanvas.width, floorCanvas.height);
  c.setTransform(PXCM, 0, 0, PXCM, 0, 0);
  MAPS[L.arena.map].floor(c);
  for (const s of ed().strokes) strokePath(c, s);
};
const bboxes = new WeakMap();
function strokeBox(s) {
  let b = bboxes.get(s);
  if (!b || b.n !== s.pts.length) {
    const r = s.k === 'e' ? 3 : HALF; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of s.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    b = { x0: x0 - r, y0: y0 - r, x1: x1 + r, y1: y1 + r, r, n: s.pts.length }; bboxes.set(s, b);
  }
  return b;
}
function isBlack(x, y) {
  if (x < 0 || y < 0 || x > W || y > H) return false;
  const strokes = ed().strokes;
  for (let i = strokes.length - 1; i >= 0; i--) {          // the last stroke drawn over a point wins
    const s = strokes[i], b = strokeBox(s);
    if (x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1) continue;
    const P = s.pts;
    for (let j = 0; j < P.length; j++) if (segDist(x, y, P[j], P[Math.min(j + 1, P.length - 1)]) <= b.r) return s.k !== 'e';
  }
  return MAPS[L.arena.map].black(x, y);
}
L.isBlack = isBlack;

L.placeRobot = function () {
  const s = L.startPose();
  Object.assign(bot, { x: s.x, y: s.y, a: s.a, vl: 0, vr: 0, cmdL: 0, cmdR: 0, odo: 0, turn: 0, bumps: 0, bumpT: -1e9, clock: 0 });
  L.trail = [];
  sense(true);
};

/* ---------- sensors ---------- */
function sensorPos(side, jitter) {
  const s = Math.sin(bot.a), c = Math.cos(bot.a), l = side * SENSOR_SIDE;
  const jx = jitter ? (L.rand() - .5) * .5 : 0, jy = jitter ? (L.rand() - .5) * .5 : 0;
  return [bot.x + s * SENSOR_FWD + c * l + jx, bot.y - c * SENSOR_FWD + s * l + jy];
}
function raycast(ox, oy, ang) {
  const dx = Math.sin(ang), dy = -Math.cos(ang);
  let best = 500;
  const consider = (t) => { if (t > 0 && t < best) best = t; };
  if (dx > 0) consider((W - ox) / dx); if (dx < 0) consider(-ox / dx);
  if (dy > 0) consider((H - oy) / dy); if (dy < 0) consider(-oy / dy);
  for (const b of L.boxes()) {
    let tmin = -Infinity, tmax = Infinity;
    for (const [o, d, lo, hi] of [[ox, dx, b.x, b.x + b.w], [oy, dy, b.y, b.y + b.h]]) {
      if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) tmin = Infinity; continue; }
      let t1 = (lo - o) / d, t2 = (hi - o) / d; if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    }
    if (tmin <= tmax && tmax > 0) consider(tmin > 0 ? tmin : 0.01);
  }
  return best;
}
function sonarTrue() {
  const ox = bot.x + Math.sin(bot.a) * SONAR_FWD, oy = bot.y - Math.cos(bot.a) * SONAR_FWD;
  const d = Math.min(raycast(ox, oy, bot.a), raycast(ox, oy, bot.a - 0.13), raycast(ox, oy, bot.a + 0.13));
  return d >= 500 ? 0 : d;
}
/** What the HC-SR04 block returns: whole cm, with glitches in real-world mode. */
L.sonarReading = function () {
  let d = bot.sonar;
  if (L.real.active) { if (L.rand() < 0.02) return 0; d += (L.rand() + L.rand() + L.rand() - 1.5) * 1.2; }
  return Math.max(0, Math.floor(d));
};
function sense(silent) {
  const jit = L.real.active && !silent;
  const [lx, ly] = sensorPos(-1, jit), [rx, ry] = sensorPos(1, jit);
  const nl = isBlack(lx, ly) ? 0 : 1, nr = isBlack(rx, ry) ? 0 : 1;   // 0 = over black line, like the real P13/P14 pins
  if (!silent && L.fireRobot) {
    if (nl !== bot.lineL) L.fireRobot('line', 'L' + (nl === 0 ? 'find' : 'lose'));
    if (nr !== bot.lineR) L.fireRobot('line', 'R' + (nr === 0 ? 'find' : 'lose'));
  }
  bot.lineL = nl; bot.lineR = nr;
  bot.sonar = sonarTrue();
}
L.sense = sense;
function collide() {
  let hit = false;
  if (bot.x < ROBOT_R) { bot.x = ROBOT_R; hit = true; }
  if (bot.x > W - ROBOT_R) { bot.x = W - ROBOT_R; hit = true; }
  if (bot.y < ROBOT_R) { bot.y = ROBOT_R; hit = true; }
  if (bot.y > H - ROBOT_R) { bot.y = H - ROBOT_R; hit = true; }
  for (const b of L.boxes()) {
    const cx = Math.max(b.x, Math.min(bot.x, b.x + b.w)), cy = Math.max(b.y, Math.min(bot.y, b.y + b.h));
    const dx = bot.x - cx, dy = bot.y - cy, d = Math.hypot(dx, dy);
    if (d < ROBOT_R) {
      hit = true;
      if (d < 1e-6) {
        const o = [[bot.x - b.x, -1, 0], [b.x + b.w - bot.x, 1, 0], [bot.y - b.y, 0, -1], [b.y + b.h - bot.y, 0, 1]].sort((p, q) => p[0] - q[0])[0];
        bot.x += o[1] * (o[0] + ROBOT_R); bot.y += o[2] * (o[0] + ROBOT_R);
      } else { bot.x = cx + dx / d * ROBOT_R; bot.y = cy + dy / d * ROBOT_R; }
    }
  }
  if (hit) { if (bot.clock - bot.bumpT > 400) bot.bumps++; bot.bumpT = bot.clock; }
}
function wheelTarget(cmd, gain) {
  if (L.real.active && Math.abs(cmd) < L.real.deadband) return 0;
  return cmd / 100 * L.MAXV * (L.real.active ? gain : 1);
}
L.physics = function (dt) {
  if (dt <= 0) return;
  const steps = Math.max(1, Math.round(dt / 0.005)), h = dt / steps;
  const k = 1 - Math.exp(-h / 0.08);
  for (let i = 0; i < steps; i++) {
    bot.clock += h * 1000;
    bot.vl += (wheelTarget(bot.cmdL, L.real.gainL) - bot.vl) * k;
    bot.vr += (wheelTarget(bot.cmdR, L.real.gainR) - bot.vr) * k;
    const v = (bot.vl + bot.vr) / 2, w = (bot.vl - bot.vr) / L.WHEELBASE;
    bot.a += w * h; bot.turn += w * h;
    const px = bot.x, py = bot.y;
    bot.x += Math.sin(bot.a) * v * h;
    bot.y -= Math.cos(bot.a) * v * h;
    collide();
    bot.odo += Math.hypot(bot.x - px, bot.y - py);
    sense(false);
  }
  const last = L.trail[L.trail.length - 1];
  if (!last || Math.hypot(last[0] - bot.x, last[1] - bot.y) > 0.4) { L.trail.push([bot.x, bot.y]); if (L.trail.length > 6000) L.trail.splice(0, 1000); }
};
L.trail = [];
L.trailOn = true;

/* ---------- view (zoom + follow) ---------- */
L.view = { zoom: 1, follow: true, cx: W / 2, cy: H / 2 };
const arena = L.$('arena'), actx = arena.getContext('2d');
let T = { s: 5, ox: 0, oy: 0 };
L.sizeArena = function () {
  const w = arena.parentElement.clientWidth - 12;
  if (w <= 0) return;
  const dpr = window.devicePixelRatio || 1;
  arena.width = Math.round(w * dpr); arena.height = Math.round(w * H / W * dpr);
  arena.style.height = (w * H / W) + 'px';
};
function computeView() {
  const v = L.view, base = arena.width / W, s = base * v.zoom;
  if (v.zoom <= 1) { v.cx = W / 2; v.cy = H / 2; }
  else if (v.follow) { v.cx += (bot.x - v.cx) * 0.25; v.cy += (bot.y - v.cy) * 0.25; }
  const hw = W / (2 * v.zoom), hh = H / (2 * v.zoom);
  v.cx = Math.max(hw, Math.min(W - hw, v.cx)); v.cy = Math.max(hh, Math.min(H - hh, v.cy));
  T = { s, ox: arena.width / 2 - v.cx * s, oy: arena.height / 2 - v.cy * s };
}
L.toWorld = function (e) {
  const r = arena.getBoundingClientRect();
  const px = (e.clientX - r.left) * (arena.width / r.width), py = (e.clientY - r.top) * (arena.height / r.height);
  return [(px - T.ox) / T.s, (py - T.oy) / T.s];
};

/* ---------- drawing ---------- */
const hexToRgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
L.hexToRgb = hexToRgb;
function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function drawArena() {
  computeView();
  const c = actx, s = T.s;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = '#2a332e'; c.fillRect(0, 0, arena.width, arena.height);
  c.setTransform(s, 0, 0, s, T.ox, T.oy);
  c.imageSmoothingEnabled = true;
  c.drawImage(floorCanvas, 0, 0, W, H);
  c.strokeStyle = MAPS[L.arena.map].grid ? 'rgba(40,80,60,.16)' : 'rgba(40,80,60,.07)'; c.lineWidth = 1 / s;
  c.beginPath(); for (let x = 10; x < W; x += 10) { c.moveTo(x, 0); c.lineTo(x, H); } for (let y = 10; y < H; y += 10) { c.moveTo(0, y); c.lineTo(W, y); } c.stroke();
  if (L.drawOverlay) L.drawOverlay(c, s);
  for (const b of L.boxes()) {
    c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(b.x + .8, b.y + .8, b.w, b.h);
    c.fillStyle = '#c9a06a'; c.fillRect(b.x, b.y, b.w, b.h);
    c.strokeStyle = '#8a6537'; c.lineWidth = .5; c.strokeRect(b.x + .25, b.y + .25, b.w - .5, b.h - .5);
    c.strokeStyle = 'rgba(138,101,55,.5)'; c.beginPath(); c.moveTo(b.x + b.w / 2, b.y + .5); c.lineTo(b.x + b.w / 2, b.y + b.h - .5); c.stroke();
  }
  if (L.trailOn && L.trail.length > 1) {
    c.strokeStyle = 'rgba(15,188,17,.75)'; c.lineWidth = .7; c.lineJoin = 'round'; c.lineCap = 'round';
    c.beginPath(); L.trail.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke();
  }
  const sx = bot.x + Math.sin(bot.a) * SONAR_FWD, sy = bot.y - Math.cos(bot.a) * SONAR_FWD, d = bot.sonar || 500;
  c.fillStyle = L.RT && L.RT.running ? 'rgba(47,108,246,.10)' : 'rgba(47,108,246,.05)';
  c.beginPath(); c.moveTo(sx, sy);
  c.lineTo(sx + Math.sin(bot.a - .13) * d, sy - Math.cos(bot.a - .13) * d);
  c.lineTo(sx + Math.sin(bot.a + .13) * d, sy - Math.cos(bot.a + .13) * d); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(47,108,246,.55)'; c.setLineDash([1.2, 1]); c.lineWidth = .35;
  c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + Math.sin(bot.a) * d, sy - Math.cos(bot.a) * d); c.stroke(); c.setLineDash([]);
  drawRobot(c);
}
function glow(c, x, y, rgb, alpha, r) {
  const [R, G, B] = rgb, g = c.createRadialGradient(x, y, .3, x, y, r);
  g.addColorStop(0, `rgba(${R},${G},${B},${alpha})`); g.addColorStop(1, `rgba(${R},${G},${B},0)`);
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
}
function drawRobot(c) {
  const disp = L.devices ? L.devices.robot.display : new Float32Array(25);
  c.save();
  c.translate(bot.x, bot.y); c.rotate(bot.a);
  const ub = bot.underBright / 255;
  [[-2.4, 0], [2.4, 1]].forEach(([ux, i]) => { const col = bot.under[i]; if (!col) return; glow(c, ux, 1, [col >> 16, (col >> 8) & 255, col & 255], .35 + .5 * ub, 6 + 3 * ub); });
  [[-3.1, 1], [3.1, 0]].forEach(([lx, idx]) => {
    const col = bot.lights[idx]; if (col === '#000000') return;
    const [r, g, b] = hexToRgb(col);
    const gr = c.createRadialGradient(lx, -6, .5, lx, -11, 9);
    gr.addColorStop(0, `rgba(${r},${g},${b},.55)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    c.fillStyle = gr; c.beginPath(); c.moveTo(lx - 1, -6); c.lineTo(lx - 6, -17); c.lineTo(lx + 6, -17); c.lineTo(lx + 1, -6); c.closePath(); c.fill();
  });
  c.fillStyle = 'rgba(0,0,0,.22)'; roundRect(c, -5.3, -5.8, 11, 11.8, 2.6); c.fill();
  c.fillStyle = '#151515';
  roundRect(c, -5.9, -2.3, 1.8, 4.6, .6); c.fill(); roundRect(c, 4.1, -2.3, 1.8, 4.6, .6); c.fill();
  c.fillStyle = '#3b3b3b'; for (let i = -2; i <= 2; i += 1) { c.fillRect(-5.9, i - .1, 1.8, .2); c.fillRect(4.1, i - .1, 1.8, .2); }
  c.fillStyle = '#20262a'; roundRect(c, -4.1, -6.2, 8.2, 11.6, 2.4); c.fill();
  c.strokeStyle = '#0fbc11'; c.lineWidth = .35; roundRect(c, -3.8, -5.9, 7.6, 11, 2.1); c.stroke();
  c.fillStyle = '#c9ccd0'; c.beginPath(); c.arc(-1.6, -5.5, 1.25, 0, 7); c.arc(1.6, -5.5, 1.25, 0, 7); c.fill();
  c.fillStyle = '#5c6168'; c.beginPath(); c.arc(-1.6, -5.5, .6, 0, 7); c.arc(1.6, -5.5, .6, 0, 7); c.fill();
  [[-3.1, 1], [3.1, 0]].forEach(([lx, idx]) => { c.fillStyle = bot.lights[idx] === '#000000' ? '#555' : bot.lights[idx]; c.beginPath(); c.arc(lx, -5.1, .7, 0, 7); c.fill(); });
  c.fillStyle = '#111'; roundRect(c, -2.6, -2.6, 5.2, 4.4, .5); c.fill();
  for (let i = 0; i < 25; i++) {
    const v = disp[i] / 255;
    c.fillStyle = v > 0 ? `rgba(255,60,50,${.25 + v * .75})` : '#2b2222';
    c.fillRect(-1.7 + (i % 5) * .8, -2.1 + Math.floor(i / 5) * .8, .4, .5);
  }
  c.fillStyle = '#b08d3c'; c.fillRect(-2.6, 1.8, 5.2, .5);
  [[-3, 0], [3, 1]].forEach(([sx, i]) => {
    c.save(); c.translate(sx, 3.8); c.rotate((bot.servo[i] - 90) * Math.PI / 180);
    c.fillStyle = '#e7e7e7'; roundRect(c, -.35, -2.2, .7, 2.2, .3); c.fill(); c.fillStyle = '#9aa0a6'; c.beginPath(); c.arc(0, 0, .55, 0, 7); c.fill(); c.restore();
  });
  [[-1, bot.lineL], [1, bot.lineR]].forEach(([side, val]) => {
    c.fillStyle = val === 0 ? '#2f6cf6' : 'rgba(255,255,255,.85)'; c.strokeStyle = '#000'; c.lineWidth = .15;
    c.beginPath(); c.arc(side * SENSOR_SIDE, -SENSOR_FWD, .42, 0, 7); c.fill(); c.stroke();
  });
  c.restore();
}

/* ---------- arena interaction ---------- */
L.tool = 'move';
let drag = null;
// L.lockRobot is set during challenge runs and replays: nobody may move the robot by hand then.
arena.addEventListener('pointerdown', (e) => {
  const [x, y] = L.toWorld(e);
  if (L.lockRobot && L.tool !== 'move') return;
  if (L.tool === 'box') {
    const bs = L.ownBoxes(); const i = bs.findIndex(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
    if (i >= 0) bs.splice(i, 1); else bs.push({ x: Math.max(0, Math.min(W - 10, x - 5)), y: Math.max(0, Math.min(H - 10, y - 5)), w: 10, h: 10 });
    sense(true); L.emit('change'); return;
  }
  if (L.tool === 'draw' || L.tool === 'erase') {
    drag = { kind: 'stroke', s: { k: L.tool === 'erase' ? 'e' : 'd', pts: [[+x.toFixed(2), +y.toFixed(2)]] } };
    arena.setPointerCapture(e.pointerId);
    fctx.setTransform(PXCM, 0, 0, PXCM, 0, 0); strokePath(fctx, drag.s);
    return;
  }
  if (Math.hypot(x - bot.x, y - bot.y) < 9 && !L.lockRobot) { drag = { kind: 'robot', dx: bot.x - x, dy: bot.y - y }; arena.setPointerCapture(e.pointerId); arena.style.cursor = 'grabbing'; }
  else if (Math.hypot(x - bot.x, y - bot.y) < 9 && L.lockRobot) { L.emit('locked'); }
  else if (L.view.zoom > 1) { drag = { kind: 'pan', x0: e.clientX, y0: e.clientY, cx: L.view.cx, cy: L.view.cy }; L.view.follow = false; L.emit('change', 'view'); arena.setPointerCapture(e.pointerId); }
});
arena.addEventListener('pointermove', (e) => {
  if (!drag) return;
  if (drag.kind === 'robot') {
    const [x, y] = L.toWorld(e);
    bot.x = Math.max(ROBOT_R, Math.min(W - ROBOT_R, x + drag.dx)); bot.y = Math.max(ROBOT_R, Math.min(H - ROBOT_R, y + drag.dy));
    bot.vl = bot.vr = 0; L.trail = []; sense(true);
  } else if (drag.kind === 'pan') {
    const r = arena.getBoundingClientRect(), k = (arena.width / r.width) / T.s;
    L.view.cx = drag.cx - (e.clientX - drag.x0) * k; L.view.cy = drag.cy - (e.clientY - drag.y0) * k;
  } else if (drag.kind === 'stroke') {
    const [x, y] = L.toWorld(e), pts = drag.s.pts, last = pts[pts.length - 1];
    if (Math.hypot(x - last[0], y - last[1]) < 0.3) return;
    pts.push([+x.toFixed(2), +y.toFixed(2)]);
    fctx.setTransform(PXCM, 0, 0, PXCM, 0, 0); strokePath(fctx, { k: drag.s.k, pts: [last, pts[pts.length - 1]] });
  }
});
const endDrag = () => {
  if (!drag) return;
  if (drag.kind === 'stroke') { ed().strokes.push(drag.s); L.buildFloor(); L.emit('change'); }
  drag = null; arena.style.cursor = ''; sense(true);
};
arena.addEventListener('pointerup', endDrag); arena.addEventListener('pointercancel', endDrag);

/* ---------- main loop: drawing always; physics here only while no program runs ---------- */
let lastT = performance.now();
function frame(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
  if (!(L.RT && L.RT.running) && !(drag && drag.kind === 'robot')) L.physics(dt);
  drawArena();
  L.emit('frame', t);
  requestAnimationFrame(frame);
}
L.startLoop = () => requestAnimationFrame((t) => { lastT = t; frame(t); });
})();
