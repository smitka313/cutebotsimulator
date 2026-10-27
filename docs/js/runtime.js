/* Program runtime: two virtual micro:bits running MakeCode-named APIs on a simulated clock.
   Everything advances in fixed 5 ms steps. Timers, radio and inputs are tied to step numbers and
   randomness is seeded, so a recorded run (program + seed + inputs) replays exactly the same way. */
(() => {
'use strict';
const L = window.Lab;
const bot = L.bot;

const STEP = L.STEP = 5;                 // simulated milliseconds per step
const STOP = L.STOP = { stop: true };
const RT = L.RT = { running: false, gen: 0, speed: 1, hits: new Map(), ticks: 0, fast: false, realBase: 0, simBase: 0, waiters: [] };
const S = L.sched = { t: 0, step: 0, timers: [], seq: 0, queue: [], record: [], replay: null, onStep: null, seed: 0 };
L.simNow = () => S.t;
L.setSpeed = (speed) => { RT.realBase = performance.now(); RT.simBase = S.t; RT.speed = speed; };

/* seeded random numbers (mulberry32) */
let rs = 1;
L.seedRand = (s) => { rs = s | 0; };
L.rand = () => { rs = rs + 0x6D2B79F5 | 0; let t = Math.imul(rs ^ rs >>> 15, 1 | rs); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

function check() { if (!RT.running) throw STOP; }
function sleep(ms) {
  check();
  return new Promise((res, rej) => { S.timers.push({ due: S.t + Math.max(0, +ms || 0), seq: S.seq++, res, rej }); });
}
function later(delay, fn) { S.timers.push({ due: S.t + delay, seq: S.seq++, fn }); }
L.sleep = sleep;
// loops yield to the clock every 64 passes, so a loop with no pause still lets the robot move
async function __tick() { check(); if (++RT.ticks % 64 === 0) await sleep(0); }

/* macrotask yield that is not throttled like setTimeout(0) */
const ch = new MessageChannel(), flushQ = [];
ch.port1.onmessage = () => { const f = flushQ.shift(); if (f) f(); };
const flush = () => new Promise(r => { flushQ.push(r); ch.port2.postMessage(0); });

/* ---------- devices ---------- */
function makeDevice(id, name) {
  return { id, name, display: new Float32Array(25), buttons: { A: false, B: false }, accel: { x: 0, y: 0, z: -1023 }, env: { temp: 21, light: 128 },
    handlers: {}, forevers: [], group: 0, displayToken: 0, tempo: 120, ring: null, ir: { code: 0, held: false, until: -1, next: 0 }, active: false, lastBlock: null };
}
const devices = L.devices = { robot: makeDevice('robot', 'Cutebot micro:bit'), remote: makeDevice('remote', 'Remote micro:bit') };

function startFiber(dev, f) {
  const g = RT.gen;
  Promise.resolve().then(f).catch(e => { if (e !== STOP && g === RT.gen && RT.running) reportError(dev, e); });
}
function on(dev, kind, key, fn) { (dev.handlers[kind + ':' + key] ||= []).push({ fn, busy: false, queue: [] }); }
function fire(dev, kind, key, args = []) {
  if (!RT.running || !dev.active) return;
  for (const h of (dev.handlers[kind + ':' + key] || [])) {
    if (h.busy) { if (h.queue.length < 4) h.queue.push(args); continue; }
    h.busy = true;
    startFiber(dev, async () => {
      try { let a = args; for (;;) { await h.fn(...a); if (!h.queue.length) break; a = h.queue.shift(); } }
      finally { h.busy = false; h.queue = []; }
    });
  }
}
L.fireRobot = (kind, key, args) => fire(devices.robot, kind, key, args);

/* ---------- inputs: applied at a step boundary and recorded, so replays match ---------- */
function applyInput(inp) {
  const [k, a, b, c] = inp, d = devices[a];
  if (k === 'p') { if (b === 'AB') { d.buttons.A = d.buttons.B = c; } else d.buttons[b] = c; if (!c) fire(d, 'button', b); }
  else if (k === 'i') { const ir = devices.robot.ir; ir.code = a; ir.held = b; if (b) { fire(devices.robot, 'ir', 'any', [a]); ir.next = S.t + 110; } else ir.until = S.t + 150; }
  else if (k === 'g') fire(d, 'gesture', b);
  else if (k === 'a') d.accel[b] = c;
  else if (k === 'e') d.env[b] = c;
}
/** Every button press, IR press, gesture and slider change goes through here. */
L.input = (...inp) => {
  if (RT.running) { if (!S.replay) S.queue.push(inp); }
  else applyInput(inp);
};

/* ---------- display ---------- */
function setImage(dev, str) { for (let i = 0; i < 25; i++) dev.display[i] = str[i] === '1' ? 255 : 0; }
function glyphCols(ch) { const g = L.FONT[ch] || L.FONT['?']; const cols = []; for (let x = 0; x < 5; x++) { const col = []; for (let y = 0; y < 5; y++) col.push((g[y] >> (4 - x)) & 1); cols.push(col); } return cols; }
async function scrollText(dev, text, interval = 150) {
  const tok = ++dev.displayToken;
  text = String(text);
  if (text.length === 1) { const cols = glyphCols(text); for (let i = 0; i < 25; i++) dev.display[i] = cols[i % 5][Math.floor(i / 5)] ? 255 : 0; await sleep(interval * 5); return; }
  const cols = [];
  for (const ch of text) cols.push(...glyphCols(ch), [0, 0, 0, 0, 0]);
  for (let off = -5; off < cols.length; off++) {
    if (tok !== dev.displayToken) return;
    for (let x = 0; x < 5; x++) { const col = cols[off + x] || [0, 0, 0, 0, 0]; for (let y = 0; y < 5; y++) dev.display[y * 5 + x] = col[y] ? 255 : 0; }
    await sleep(interval);
  }
  if (tok === dev.displayToken) dev.display.fill(0);
}
const fmtNum = (n) => { n = +n; if (!isFinite(n)) return String(n); return String(Math.round(n * 1e4) / 1e4); };
const parseLeds = (s) => String(s).replace(/[^#.]/g, '').split('').map(c => c === '#' ? '1' : '0').join('').padEnd(25, '0').slice(0, 25);

/* ---------- audio ---------- */
let actx = null;
L.soundOn = true;
L.audio = () => { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; } } if (actx && actx.state === 'suspended') actx.resume(); return actx; };
function stopRing(dev) { if (dev.ring) { try { dev.ring.stop(); } catch (e) {} dev.ring = null; } }
L.stopSounds = () => Object.values(devices).forEach(stopRing);
function ring(dev, freq) {
  stopRing(dev); if (!L.soundOn || RT.fast || !freq) return; const a = L.audio(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain(); o.type = 'square'; o.frequency.value = freq; g.gain.value = 0.04; o.connect(g).connect(a.destination); o.start(); dev.ring = o;
}

/* ---------- shared enums ---------- */
const E = {
  Button: { A: 'A', B: 'B', AB: 'AB' },
  Gesture: { Shake: 'Shake', LogoUp: 'LogoUp', LogoDown: 'LogoDown', ScreenUp: 'ScreenUp', ScreenDown: 'ScreenDown', TiltLeft: 'TiltLeft', TiltRight: 'TiltRight' },
  IconNames: Object.fromEntries(Object.keys(L.ICONS).map(k => [k, k])),
  ArrowNames: Object.fromEntries(Object.keys(L.ARROWS).map(k => [k, k])),
  Note: Object.fromEntries(L.NOTES.map(n => [n[1], n[2]])),
  BeatFraction: Object.fromEntries(L.BEATS.map(b => [b[1], b[2]])),
  Dimension: { X: 0, Y: 1, Z: 2, Strength: 3 },
  DigitalPin: { P0: 0, P1: 1, P2: 2, P8: 8, P12: 12, P13: 13, P14: 14, P15: 15, P16: 16 },
  NeoPixelMode: { RGB: 0, RGBW: 1, RGB_RGB: 2 },
  NeoPixelColors: Object.fromEntries(L.NP_COLORS.map(c => [c[1], c[2]])),
  randint: (a, b) => { a = Math.round(+a); b = Math.round(+b); if (a > b) [a, b] = [b, a]; return a + Math.floor(L.rand() * (b - a + 1)); },
  __tick
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, +v || 0));
const toHex = (n) => '#' + (Math.max(0, Math.min(0xffffff, Math.round(+n) || 0))).toString(16).padStart(6, '0');
function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  return (f(0) << 16) | (f(8) << 8) | f(4);
}

function makeApi(dev) {
  const isRobot = dev.id === 'robot';
  const basic = {
    showNumber: (n) => scrollText(dev, fmtNum(n)),
    showString: (s) => scrollText(dev, s),
    showLeds: async (s) => { dev.displayToken++; setImage(dev, parseLeds(s)); await sleep(400); },
    showIcon: async (i) => { dev.displayToken++; setImage(dev, L.ICONS[i] || L.ICONS.Heart); await sleep(600); },
    showArrow: async (d) => { dev.displayToken++; setImage(dev, L.ARROWS[d] || L.ARROWS.North); await sleep(600); },
    clearScreen: () => { dev.displayToken++; dev.display.fill(0); },
    pause: (ms) => sleep(ms),
    forever: (fn) => { dev.forevers.push(async () => { for (;;) { await fn(); await sleep(20); } }); }
  };
  const loops = { everyInterval: (ms, fn) => { dev.forevers.push(async () => { for (;;) { await sleep(ms); await fn(); } }); } };
  const input = {
    onButtonPressed: (b, fn) => on(dev, 'button', b, fn),
    onGesture: (g, fn) => on(dev, 'gesture', g, fn),
    buttonIsPressed: (b) => b === 'AB' ? dev.buttons.A && dev.buttons.B : !!dev.buttons[b],
    temperature: () => dev.env.temp,
    lightLevel: () => dev.env.light,
    compassHeading: () => isRobot ? Math.round(((bot.a * 180 / Math.PI) % 360 + 360) % 360) : 0,
    runningTime: () => Math.round(S.t),
    acceleration: (d) => { const a = dev.accel; return [a.x, a.y, a.z, Math.round(Math.hypot(a.x, a.y, a.z))][d] ?? 0; }
  };
  const music = {
    beat: (f = 1) => (60000 / dev.tempo) * f,
    setTempo: (b) => { dev.tempo = Math.max(4, +b || 120); },
    playTone: async (freq, ms) => { ring(dev, freq); try { await sleep(ms); } finally { stopRing(dev); } },
    ringTone: (freq) => ring(dev, freq),
    rest: async (ms) => { stopRing(dev); await sleep(ms); },
    stopAllSounds: () => stopRing(dev)
  };
  const inGrid = (x, y) => x >= 0 && x < 5 && y >= 0 && y < 5;
  const led = {
    plot: (x, y) => { x = Math.round(x); y = Math.round(y); if (inGrid(x, y)) dev.display[y * 5 + x] = 255; },
    unplot: (x, y) => { x = Math.round(x); y = Math.round(y); if (inGrid(x, y)) dev.display[y * 5 + x] = 0; },
    toggle: (x, y) => { x = Math.round(x); y = Math.round(y); if (inGrid(x, y)) dev.display[y * 5 + x] = dev.display[y * 5 + x] ? 0 : 255; },
    point: (x, y) => { x = Math.round(x); y = Math.round(y); return inGrid(x, y) && dev.display[y * 5 + x] > 0; },
    plotBarGraph: (v, hi) => { dev.displayToken++; hi = hi || 1; const n = Math.max(0, Math.min(25, Math.round(Math.abs(v) / hi * 25))); for (let i = 0; i < 25; i++) { const row = 4 - Math.floor(i / 5); dev.display[row * 5 + (i % 5)] = i < n ? 255 : 0; } }
  };
  const send = (kind, args) => {
    check();
    L.emit('radio', dev, kind, args);
    for (const d of Object.values(devices)) if (d !== dev && d.active && d.group === dev.group) later(0, () => fire(d, 'radio', kind, args));
  };
  const radio = {
    setGroup: (g) => { dev.group = Math.round(+g) || 0; },
    sendNumber: (n) => send('num', [+n || 0]),
    sendString: (s) => send('str', [String(s).slice(0, 19)]),
    sendValue: (name, v) => send('val', [String(name).slice(0, 8), +v || 0]),
    onReceivedNumber: (fn) => on(dev, 'radio', 'num', fn),
    onReceivedString: (fn) => on(dev, 'radio', 'str', fn),
    onReceivedValue: (fn) => on(dev, 'radio', 'val', fn)
  };
  const serial = {
    writeLine: (t) => L.emit('serial', dev, String(t)),
    writeNumber: (n) => L.emit('serial', dev, fmtNum(n)),
    writeValue: (name, v) => { L.emit('serial', dev, `${name}:${fmtNum(v)}`); L.emit('serialValue', dev, String(name), +v || 0); }
  };
  const setLight = (which, hex) => { if (which === 0 || which === 3) bot.lights[0] = hex; if (which === 1 || which === 3) bot.lights[1] = hex; };
  const cuteBot = {
    Direction: { forward: 0, backward: 1, left: 2, right: 3 },
    RGBLights: { RGB_L: 1, RGB_R: 0, ALL: 3 },
    TrackingState: { L_R_line: 0, L_unline_R_line: 1, L_line_R_unline: 2, L_R_unline: 3 },
    MbPins: { Left: 'L', Right: 'R' },
    MbEvents: { FindLine: 'find', LoseLine: 'lose' },
    SonarUnit: { Centimeters: 0, Inches: 1 },
    ServoList: { S1: 0, S2: 1 },
    IRButtons: Object.fromEntries(L.IR_BUTTONS.map(b => [b[0], b[1]])),
    motors(l = 50, r = 50) { check(); if (!isRobot) return; bot.cmdL = clamp(l, -100, 100); bot.cmdR = clamp(r, -100, 100); },
    async moveTime(dir, speed, time) {
      speed = clamp(speed, -100, 100);
      const m = [[speed, speed], [-speed, -speed], [-speed, speed], [speed, -speed]][dir] || [0, 0];
      cuteBot.motors(m[0], m[1]); await sleep((+time || 0) * 1000); cuteBot.motors(0, 0);
    },
    forward() { cuteBot.motors(80, 80); },
    backforward() { cuteBot.motors(-80, -80); },
    turnleft() { cuteBot.motors(0, 80); },
    turnright() { cuteBot.motors(80, 0); },
    stopcar() { cuteBot.motors(0, 0); },
    colorLight(light, color) { if (isRobot) setLight(light, toHex(color)); },
    singleheadlights(light, r, g, b) { if (isRobot) setLight(light, toHex((clamp(r, 0, 255) << 16) | (clamp(g, 0, 255) << 8) | clamp(b, 0, 255))); },
    closeheadlights() { if (isRobot) bot.lights = ['#000000', '#000000']; },
    tracking(state) { if (!isRobot) return false; const l = bot.lineL, r = bot.lineR; return [l === 0 && r === 0, l === 1 && r === 0, l === 0 && r === 1, l === 1 && r === 1][state] || false; },
    trackSide(side, state) { if (!isRobot) return false; const v = side === 'L' ? bot.lineL : bot.lineR; return state === 'find' ? v === 0 : v === 1; },
    trackEvent(sensor, event, fn) { on(dev, 'line', sensor + event, fn); },
    ultrasonic(unit) { if (!isRobot) return 0; const d = L.sonarReading(); return unit === 1 ? Math.floor(d * 0.3937) : d; },
    setServo(s, angle) { if (isRobot) bot.servo[s] = clamp(angle, 0, 180); },
    IR_callback(fn) { on(dev, 'ir', 'any', fn); },
    IR_Button(b) { const ir = dev.ir; return (ir.held || S.t < ir.until) && ir.code === b; }
  };
  const neopixel = {
    create(pin, numleds) {
      const real = isRobot && pin === 15;
      return {
        buf: new Array(Math.max(1, Math.round(numleds) || 1)).fill(0), bright: 128,
        show() { if (real) { bot.under = [this.buf[0] || 0, this.buf[1] || 0]; bot.underBright = this.bright; } },
        showColor(rgb) { this.buf.fill((+rgb || 0) & 0xffffff); this.show(); },
        setPixelColor(i, rgb) { i = Math.round(i); if (i >= 0 && i < this.buf.length) this.buf[i] = (+rgb || 0) & 0xffffff; },
        clear() { this.buf.fill(0); },
        setBrightness(b) { this.bright = clamp(b, 0, 255); },
        showRainbow(s = 1, e = 360) { const n = this.buf.length; for (let i = 0; i < n; i++) this.buf[i] = hsl(s + (e - s) * i / n, 100, 50); this.show(); }
      };
    },
    colors: (c) => +c || 0,
    rgb: (r, g, b) => (clamp(r, 0, 255) << 16) | (clamp(g, 0, 255) << 8) | clamp(b, 0, 255)
  };
  // runs before every block: remembers the block (for error messages) and lights it up in the editor
  const __hl = async (id) => { check(); dev.lastBlock = id; if (!RT.fast) RT.hits.set(id, performance.now()); };
  return { ...E, __hl, basic, loops, input, music, led, radio, serial, cuteBot, neopixel };
}
L.API_NAMES = Object.keys(makeApi(makeDevice('x', 'x')));

/* ---------- the clock ---------- */
async function step() {
  S.step++;
  if (S.replay) { const list = S.replay.get(S.step); if (list) list.forEach(applyInput); }
  else if (S.queue.length) for (const inp of S.queue.splice(0)) { S.record.push([S.step, ...inp]); applyInput(inp); }
  S.t += STEP;
  const ir = devices.robot.ir;
  if (ir.held && S.t >= ir.next) { ir.next += 110; fire(devices.robot, 'ir', 'any', [ir.code]); }
  L.physics(STEP / 1000);
  if (S.onStep) S.onStep(STEP / 1000);
  if (!RT.running) return;
  const due = S.timers.filter(x => x.due <= S.t);
  if (due.length) {
    S.timers = S.timers.filter(x => x.due > S.t);
    due.sort((a, b) => a.due - b.due || a.seq - b.seq);
    for (const x of due) x.fn ? x.fn() : x.res();
  }
  await flush();
}
const nextFrame = () => new Promise(r => { let done = false; const go = () => { if (!done) { done = true; r(); } }; requestAnimationFrame(go); setTimeout(go, 100); });
async function loop(gen) {
  await flush();               // let every program start before the first step, in live runs and replays alike
  RT.realBase = performance.now(); RT.simBase = S.t;
  while (RT.running && RT.gen === gen) {
    if (RT.fast) { await step(); continue; }
    const target = RT.simBase + (performance.now() - RT.realBase) * RT.speed;
    let n = 0;
    while (S.t + STEP <= target && n < 80 && RT.running && RT.gen === gen) { await step(); n++; }
    if (n >= 80) { RT.realBase = performance.now(); RT.simBase = S.t; }     // can't keep up: slow down rather than stall
    if (RT.running && RT.gen === gen) await nextFrame();
  }
}

/* ---------- run / stop ---------- */
const AsyncFunction = (async () => {}).constructor;
L.stopAll = function () {
  const was = RT.running;
  RT.running = false; RT.gen++;
  for (const x of S.timers) if (x.rej) x.rej(STOP);
  S.timers = []; S.onStep = null;
  for (const d of Object.values(devices)) { d.handlers = {}; d.forevers = []; d.active = false; d.ir.held = false; stopRing(d); }
  bot.cmdL = bot.cmdR = 0;
  RT.hits.clear();
  L.real.active = false;
  if (was) L.emit('stop');
  const w = RT.waiters.splice(0); w.forEach(f => f());
};
/** Resolves once the current run stops (passed, failed, error or Stop). */
L.whenStopped = () => RT.running ? new Promise(r => RT.waiters.push(r)) : Promise.resolve();
/**
 * codes: { robot, remote } simulator JavaScript from the generator (null to leave a micro:bit off).
 * opts: { seed, real, init, replay: [[step, ...input]], fast, onStep }
 */
L.runAll = function (codes, opts = {}) {
  L.stopAll();
  if (!opts.fast) L.audio();
  const compiled = [];
  for (const [id, code] of Object.entries(codes)) {
    if (!code) continue;
    const api = makeApi(devices[id]);
    try { compiled.push([devices[id], new AsyncFunction(...Object.keys(api), code), Object.values(api)]); }
    catch (e) { L.emit('error', devices[id], 'There is a problem in the code: ' + e.message); return false; }
  }
  Object.assign(S, { t: 0, step: 0, timers: [], seq: 0, queue: [], record: [], onStep: opts.onStep || null });
  S.replay = null;
  if (opts.replay) { S.replay = new Map(); for (const [st, ...inp] of opts.replay) { if (!S.replay.has(st)) S.replay.set(st, []); S.replay.get(st).push(inp); } }
  S.seed = opts.seed !== undefined ? opts.seed >>> 0 : (Math.random() * 4294967296) >>> 0;
  L.seedRand(S.seed);
  // starting sensor values are part of a run, so a replay starts from the same place
  if (opts.init) for (const id of ['robot', 'remote']) if (opts.init[id]) { Object.assign(devices[id].env, opts.init[id].env); Object.assign(devices[id].accel, opts.init[id].accel); }
  S.init = { robot: { env: { ...devices.robot.env }, accel: { ...devices.robot.accel } }, remote: { env: { ...devices.remote.env }, accel: { ...devices.remote.accel } } };
  bot.clock = 0; bot.bumpT = -1e9;
  RT.running = true; RT.fast = !!opts.fast; RT.ticks = 0;
  bot.lights = ['#000000', '#000000']; bot.under = [0, 0];
  L.real.active = opts.real !== undefined ? !!opts.real : L.real.on;
  if (L.real.active) { const g = 0.9 + L.rand() * 0.07; if (L.rand() < .5) { L.real.gainL = 1; L.real.gainR = g; } else { L.real.gainL = g; L.real.gainR = 1; } }
  else { L.real.gainL = L.real.gainR = 1; }
  for (const d of Object.values(devices)) { d.buttons.A = d.buttons.B = false; d.ir = { code: 0, held: false, until: -1, next: 0 }; }
  for (const [dev, fn, vals] of compiled) {
    dev.active = true; dev.display.fill(0); dev.group = 0; dev.tempo = 120; dev.lastBlock = null;
    startFiber(dev, async () => { await fn(...vals); for (const f of dev.forevers) startFiber(dev, f); });
  }
  L.emit('run');
  loop(RT.gen);
  return true;
};
const FRIENDLY = {
  receivedNumber: 'The “receivedNumber” block only works inside “on radio received receivedNumber”.',
  receivedString: 'The “receivedString” block only works inside “on radio received receivedString”.',
  name: 'The “name” block only works inside “on radio received name value”.',
  value: 'The “value” block only works inside “on radio received name value”.',
  code: 'The “IR code” block only works inside “on IR receiving”.'
};
function reportError(dev, e) {
  let msg = e && e.message ? e.message : String(e);
  const m = /^(\w+) is not defined$/.exec(msg);
  if (m && FRIENDLY[m[1]]) msg = FRIENDLY[m[1]];
  else if (e instanceof RangeError) msg = 'A function keeps calling itself and never stops (' + msg + ').';
  L.emit('error', dev, msg, dev.lastBlock);
  L.stopAll();
}
})();
