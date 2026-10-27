/* Examples, challenges and lessons. */
(() => {
'use strict';
const L = window.Lab;
const bot = L.bot;

/* ---------- example programs (Blockly XML) ---------- */
const n = (v) => `<shadow type="math_number"><field name="NUM">${v}</field></shadow>`;
const motors = (l, r) => `<block type="cb_motors"><value name="L">${n(l)}</value><value name="R">${n(r)}</value>`;
const lights = (c) => `<block type="cb_headlights"><field name="LIGHT">ALL</field><value name="COLOR"><shadow type="cb_color"><field name="C">${c}</field></shadow></value>`;
const move = (d, s, t) => `<block type="cb_move_time"><field name="DIR">${d}</field><value name="SPEED">${n(s)}</value><value name="TIME">${n(t)}</value>`;
const icon = (i) => `<block type="mb_show_icon"><field name="ICON">${i}</field>`;
const track = (s) => `<block type="cb_tracking"><field name="STATE">${s}</field></block>`;
const nx = (inner) => `<next>${inner}</next>`;
const chain = (...blocks) => blocks.reduceRight((acc, b) => b + (acc ? nx(acc) : '') + '</block>', '');
const group = (g) => `<block type="radio_set_group"><value name="GROUP">${n(g)}</value>`;
const sendNum = (v) => `<block type="radio_send_number"><value name="NUM">${n(v)}</value>`;
const eqNum = (v) => `<block type="logic_compare"><field name="OP">EQ</field><value name="A"><block type="radio_number"></block></value><value name="B">${n(v)}</value></block>`;
const irIs = (b) => `<block type="cb_ir_button"><field name="BTN">${b}</field></block>`;
const BLANK = `<xml><block type="mb_on_start" x="30" y="30"></block><block type="mb_forever" x="260" y="30"></block></xml>`;
L.BLANK = BLANK;

L.EXAMPLES = {
  linefollow: { name: 'Line follower', map: 'track', xml: `<xml>
    <block type="mb_on_start" x="30" y="30"><statement name="DO">${chain(icon('Happy'), lights('0x00ff00'))}</statement></block>
    <block type="mb_forever" x="30" y="190"><statement name="DO">
      <block type="controls_if"><mutation elseif="2"></mutation>
        <value name="IF0">${track('L_R_line')}</value><statement name="DO0">${chain(motors(40, 40))}</statement>
        <value name="IF1">${track('L_unline_R_line')}</value><statement name="DO1">${chain(motors(40, 5))}</statement>
        <value name="IF2">${track('L_line_R_unline')}</value><statement name="DO2">${chain(motors(5, 40))}</statement>
      </block></statement></block></xml>` },
  avoid: { name: 'Obstacle avoider', map: 'room', xml: `<xml>
    <block type="mb_on_start" x="30" y="30"><statement name="DO">${chain(icon('Happy'))}</statement></block>
    <block type="mb_forever" x="30" y="150"><statement name="DO">
      <block type="controls_if"><mutation else="1"></mutation>
        <value name="IF0"><block type="logic_compare"><field name="OP">LT</field><value name="A"><block type="cb_sonar"><field name="UNIT">Centimeters</field></block></value><value name="B">${n(15)}</value></block></value>
        <statement name="DO0">${chain(lights('0xff0000'), icon('Surprised'), move('backward', 40, 0.3), move('right', 40, 0.4))}</statement>
        <statement name="ELSE">${chain(lights('0x00ff00'), motors(50, 50))}</statement>
      </block></statement></block></xml>` },
  square: { name: 'Drive a square', map: 'open', xml: `<xml>
    <block type="mb_on_start" x="30" y="30"><statement name="DO">
      <block type="controls_repeat_ext"><value name="TIMES">${n(4)}</value><statement name="DO">${chain(move('forward', 50, 1), move('right', 40, 0.5))}</statement>
      ${nx(chain(icon('Yes')))}</block></statement></block></xml>` },
  buttons: { name: 'Button remote', map: 'open', xml: `<xml>
    <block type="mb_on_start" x="30" y="30"><statement name="DO"><block type="mb_show_string"><value name="TEXT"><shadow type="text"><field name="TEXT">GO</field></shadow></value></block></statement></block>
    <block type="mb_on_button" x="30" y="140"><field name="BTN">A</field><statement name="DO">${chain('<block type="mb_show_arrow"><field name="DIR">West</field>', move('left', 40, 0.25))}</statement></block>
    <block type="mb_on_button" x="30" y="280"><field name="BTN">B</field><statement name="DO">${chain('<block type="mb_show_arrow"><field name="DIR">East</field>', move('right', 40, 0.25))}</statement></block>
    <block type="mb_on_button" x="30" y="420"><field name="BTN">AB</field><statement name="DO">${chain('<block type="mb_show_arrow"><field name="DIR">North</field>', lights('0xffffff'), move('forward', 60, 1), '<block type="cb_lights_off">')}</statement></block>
    <block type="mb_on_gesture" x="30" y="600"><field name="G">Shake</field><statement name="DO"><block type="mb_play_tone"><field name="NOTE">C5</field><field name="BEAT">Quarter</field></block></statement></block></xml>` },
  sumo: { name: 'Stay in the ring', map: 'sumo', xml: `<xml>
    <block type="mb_forever" x="30" y="30"><statement name="DO">
      <block type="controls_if"><mutation else="1"></mutation>
        <value name="IF0"><block type="logic_negate"><value name="BOOL">${track('L_R_unline')}</value></block></value>
        <statement name="DO0">${chain(lights('0xff0000'), move('backward', 50, 0.5), move('right', 50, 0.35))}</statement>
        <statement name="ELSE">${chain(lights('0x0000ff'), motors(45, 45))}</statement>
      </block></statement></block></xml>` },
  radio: { name: 'Radio remote control', map: 'open',
    remote: `<xml>
      <block type="mb_on_start" x="30" y="30"><statement name="DO">${chain(group(1), icon('Target'))}</statement></block>
      <block type="mb_on_button" x="30" y="170"><field name="BTN">A</field><statement name="DO">${chain(sendNum(1))}</statement></block>
      <block type="mb_on_button" x="30" y="280"><field name="BTN">B</field><statement name="DO">${chain(sendNum(2))}</statement></block>
      <block type="mb_on_button" x="30" y="390"><field name="BTN">AB</field><statement name="DO">${chain(sendNum(0))}</statement></block></xml>`,
    xml: `<xml>
      <block type="mb_on_start" x="30" y="30"><statement name="DO">${chain(group(1), icon('Happy'))}</statement></block>
      <block type="radio_on_number" x="30" y="170"><statement name="DO">
        <block type="controls_if"><mutation elseif="2"></mutation>
          <value name="IF0">${eqNum(1)}</value><statement name="DO0">${chain(move('left', 40, 0.25))}</statement>
          <value name="IF1">${eqNum(2)}</value><statement name="DO1">${chain(move('right', 40, 0.25))}</statement>
          <value name="IF2">${eqNum(0)}</value><statement name="DO2">${chain(move('forward', 60, 1))}</statement>
        </block></statement></block></xml>` },
  ir: { name: 'IR remote driving', map: 'open', xml: `<xml>
    <block type="mb_on_start" x="30" y="30"><statement name="DO">${chain('<block type="np_show_color"><value name="COLOR"><shadow type="np_color"><field name="C">Blue</field></shadow></value>')}</statement></block>
    <block type="mb_forever" x="30" y="140"><statement name="DO">
      <block type="controls_if"><mutation elseif="3" else="1"></mutation>
        <value name="IF0">${irIs('Up')}</value><statement name="DO0">${chain(motors(60, 60))}</statement>
        <value name="IF1">${irIs('Down')}</value><statement name="DO1">${chain(motors(-50, -50))}</statement>
        <value name="IF2">${irIs('Left')}</value><statement name="DO2">${chain(motors(-30, 30))}</statement>
        <value name="IF3">${irIs('Right')}</value><statement name="DO3">${chain(motors(30, -30))}</statement>
        <statement name="ELSE">${chain('<block type="cb_stop">')}</statement>
      </block></statement></block></xml>` },
  data: { name: 'Graph the sonar', map: 'room', xml: `<xml>
    <block type="mb_on_start" x="30" y="30"><statement name="DO">${chain(motors(25, 25))}</statement></block>
    <block type="mb_forever" x="30" y="130"><statement name="DO">${chain('<block type="serial_value"><field name="NAME">distance</field><value name="NUM"><block type="cb_sonar"><field name="UNIT">Centimeters</field></block></value>',
      `<block type="controls_if"><value name="IF0"><block type="logic_compare"><field name="OP">LT</field><value name="A"><block type="cb_sonar"><field name="UNIT">Centimeters</field></block></value><value name="B">${n(8)}</value></block></value><statement name="DO0">${chain('<block type="cb_stop">')}</statement>`)}</statement></block></xml>` }
};

/* ---------- challenges ---------- */
const distToStadium = L.distToStadium, distToPolyline = L.distToPolyline;
const stopped = () => bot.cmdL === 0 && bot.cmdR === 0 && Math.abs(bot.vl) < 0.3 && Math.abs(bot.vr) < 0.3;
const FLAG = { x: 104, y: 32, w: 14, h: 16 };
function drawFlag(c) {
  c.fillStyle = 'rgba(15,188,17,.18)'; c.fillRect(FLAG.x, FLAG.y, FLAG.w, FLAG.h);
  c.strokeStyle = 'rgba(11,143,47,.9)'; c.lineWidth = .4; c.setLineDash([1, .8]); c.strokeRect(FLAG.x, FLAG.y, FLAG.w, FLAG.h); c.setLineDash([]);
  c.fillStyle = '#0b8f2f'; c.fillRect(FLAG.x + 6.6, FLAG.y + 3, .5, 9); c.beginPath(); c.moveTo(FLAG.x + 7.1, FLAG.y + 3); c.lineTo(FLAG.x + 12, FLAG.y + 5); c.lineTo(FLAG.x + 7.1, FLAG.y + 7); c.fill();
}
const inFlag = () => bot.x > FLAG.x && bot.x < FLAG.x + FLAG.w && bot.y > FLAG.y && bot.y < FLAG.y + FLAG.h;
const CURVY_CP = [70, 130, 190, 250, 310];

L.CHALLENGES = [
  { id: 'flag', title: 'Reach the flag', map: 'room', limit: 60, goal: 'Drive from the start to the green flag zone without help.',
    tick(st) { if (inFlag()) return ['pass']; }, draw: drawFlag, marks: [[FLAG.x + 7, FLAG.y - 3, 'Finish here']], progress: (st) => `Bumps: ${bot.bumps}` },
  { id: 'laps', title: 'Three laps', map: 'track', limit: 150, goal: 'Follow the line for 3 full laps. Stay within 7 cm of the line.',
    setup(st) { st.laps = 0; st.top = false; st.px = bot.x; },
    tick(st) {
      if (distToStadium(bot.x, bot.y) > 7) return ['fail', 'The robot left the track.'];
      if (bot.y < 25) st.top = true;
      if (st.px < 60 && bot.x >= 60 && bot.y > 50 && st.top) { st.laps++; st.top = false; }
      st.px = bot.x;
      if (st.laps >= 3) return ['pass'];
    },
    draw(c) { c.fillStyle = 'rgba(15,188,17,.25)'; c.fillRect(59, 55, 2, 14); },
    marks: [[60, 51.5, 'Start / finish line']],
    progress: (st) => `Laps: ${st.laps || 0} / 3` },
  { id: 'park', title: 'Park at the wall', map: 'open', limit: 30, start: { x: 60, y: 66, a: 0 }, goal: 'Stop with the sonar 4 to 8 cm from the top wall, without touching it.',
    setup(st) { st.still = 0; },
    tick(st, dt) {
      if (bot.bumps > 0) return ['fail', 'The robot hit the wall.'];
      const ok = bot.sonar >= 4 && bot.sonar <= 8 && Math.abs(Math.sin(bot.a)) < 0.35 && Math.cos(bot.a) > 0;
      st.still = ok && stopped() ? st.still + dt : 0;
      if (st.still >= 1) return ['pass'];
    },
    draw(c) { c.fillStyle = 'rgba(15,188,17,.2)'; c.fillRect(0, 4, L.W, 4); c.strokeStyle = 'rgba(11,143,47,.8)'; c.lineWidth = .3; c.strokeRect(0, 4, L.W, 4); },
    marks: [[60, 12, 'Stop with the sonar in the green band']],
    progress: () => `Sonar: ${Math.floor(bot.sonar)} cm` },
  { id: 'square', title: 'Square dance', map: 'open', limit: 30, goal: 'Drive a square (at least 50 cm of driving, 4 turns) and stop within 6 cm of where you started.',
    setup(st) { const s = L.startPose(); st.sx = s.x; st.sy = s.y; },
    tick(st) {
      const back = Math.hypot(bot.x - st.sx, bot.y - st.sy) < 6;
      if (bot.odo >= 50 && Math.abs(bot.turn) >= Math.PI * 1.7 && back && stopped()) return ['pass'];
    },
    draw(c, s, st) { if (st.sx === undefined) return; c.strokeStyle = 'rgba(11,143,47,.9)'; c.lineWidth = .4; c.setLineDash([1, .8]); c.beginPath(); c.arc(st.sx, st.sy, 6, 0, 7); c.stroke(); c.setLineDash([]); },
    marks: (st) => st.sx === undefined ? [] : [[st.sx, st.sy + 9.5, 'Start and finish here']],
    progress: () => `Driven: ${Math.round(bot.odo)} cm · Turned: ${Math.round(Math.abs(bot.turn) * 180 / Math.PI)}°` },
  { id: 'sumo', title: 'Survive the ring', map: 'sumo', limit: 30, passAtLimit: true, goal: 'Keep driving inside the ring for 30 seconds. Drive at least 100 cm.',
    tick(st, dt, t) {
      if (Math.hypot(bot.x - 60, bot.y - 40) > 35) return ['fail', 'The robot left the ring.'];
      if (t >= 30) return bot.odo >= 100 ? ['pass'] : ['fail', `Only ${Math.round(bot.odo)} cm driven. Keep moving.`];
    },
    marks: [[60, 40, 'Stay inside the ring']],
    progress: () => `Driven: ${Math.round(bot.odo)} cm` },
  { id: 'curvy', title: 'Curvy lap', map: 'curvy', limit: 120, goal: 'Follow the curvy line all the way round once. Stay within 7 cm of the line.',
    setup(st) { st.cp = 0; },
    tick(st) {
      const [d, i] = distToPolyline(bot.x, bot.y, L.CURVY);
      if (d > 7) return ['fail', 'The robot left the track.'];
      if (st.cp < CURVY_CP.length && Math.abs(i - CURVY_CP[st.cp]) < 8) st.cp++;
      if (st.cp === CURVY_CP.length && Math.abs(i - 20) < 4) return ['pass'];
    },
    draw(c, s, st) { CURVY_CP.forEach((k, j) => { const p = L.CURVY[k]; c.fillStyle = j < (st.cp || 0) ? 'rgba(15,188,17,.8)' : 'rgba(15,188,17,.25)'; c.beginPath(); c.arc(p[0], p[1], 2.2, 0, 7); c.fill(); }); },
    marks: () => [...CURVY_CP.map((k, j) => [L.CURVY[k][0], L.CURVY[k][1] - 4, String(j + 1)]), [L.CURVY[20][0], L.CURVY[20][1] + 5, 'Start / finish']],
    progress: (st) => `Checkpoints: ${st.cp || 0} / ${CURVY_CP.length}` },
  { id: 'remote', title: 'Remote driver', map: 'room', limit: 120, goal: 'Steer the Cutebot to the flag using radio messages from the Remote micro:bit.',
    setup(st) { st.radio = 0; },
    tick(st) { if (inFlag()) return st.radio > 0 ? ['pass'] : ['fail', 'No radio messages came from the Remote micro:bit.']; },
    draw: drawFlag, marks: [[FLAG.x + 7, FLAG.y - 3, 'Finish here']], progress: (st) => `Radio messages: ${st.radio || 0}` }
];

/** One attempt at a challenge. The same object runs live runs and teacher replays, so the rules can't drift apart. */
L.makeChallengeRun = function (ch) {
  const run = { ch, st: {}, t: 0, n: 0, state: 'ready', msg: '' };
  run.start = () => { run.state = 'running'; run.t = 0; run.n = 0; run.st = {}; run.msg = ''; if (ch.setup) ch.setup(run.st); };
  run.tick = (dt) => {
    if (run.state !== 'running') return null;
    run.n++; run.t = Math.round(run.n * dt * 1000) / 1000;     // exact step count, so a replay reports the identical time
    let r = ch.tick(run.st, dt, run.t);
    if (!r && run.t >= ch.limit) r = ['fail', 'Time is up.'];
    if (r) { run.state = r[0]; run.msg = r[1] || ''; }
    return r;
  };
  return run;
};
L.on('radio', (dev) => { const r = L.activeRun; if (r && r.state === 'running' && dev.id === 'remote') r.st.radio = (r.st.radio || 0) + 1; });

/* ---------- lessons ---------- */
const pill = (text, k) => `<span class="pill" style="--pc:${L.C[k]}">${text}</span>`;
const P = {
  on: pill('on start', 'basic'), fv: pill('forever', 'basic'), icon: pill('show icon', 'basic'),
  move: pill('go Forward at speed 50 % for 1 seconds', 'cute'), motors: pill('set left wheel speed 50 % right wheel speed 50 %', 'cute'),
  rep: pill('repeat 4 times', 'loops'), ifelse: pill('if … else', 'logic'), iff: pill('if', 'logic'), cmp: pill('0 &lt; 0', 'logic'), and: pill('and', 'logic'),
  sonar: pill('HC-SR04 sonar unit cm', 'cute'), track: pill('tracking state is', 'cute'), group: pill('radio set group 1', 'radio'),
  btn: pill('on button A pressed', 'input'), send: pill('radio send number 0', 'radio'), rx: pill('on radio received receivedNumber', 'radio'),
  rxn: pill('receivedNumber', 'radio'), sv: pill('serial write value "x" = 0', 'serial')
};
L.LESSONS = [
  { id: 'hello', title: 'Hello, Cutebot', level: 'Start here', map: 'open', steps: [
    { t: 'Meet the editor', html: `Programs are built from <b>events</b>. ${P.on} runs once when the program starts. ${P.fv} runs over and over. Open a category on the left and drag blocks into the events.` },
    { t: 'Show a face', html: `Open <b>Basic</b> and drag ${P.icon} into ${P.on}. Pick any picture.`, check: (q) => q.has('robot', 'mb_show_icon', 'mb_on_start') },
    { t: 'Make it drive', html: `Open <b>Cutebot</b> and snap ${P.move} under the show icon block.`, check: (q) => q.has('robot', 'cb_move_time', 'mb_on_start') },
    { t: 'Run it', html: `Press <b>Run</b> above the arena. The robot should drive forward about 15 cm and stop.`, check: (q) => q.ran && q.moved },
    { t: 'Predict, then test', html: `Change the speed to <b>100</b> and the time to <b>0.5</b> seconds. Before you press Run, predict: will it go farther, less far, or the same? Then test it. When you are happy, use <b>Send to real Cutebot</b> to try it on the real robot.` }
  ] },
  { id: 'square', title: 'Drive a square', level: 'Loops', map: 'open', steps: [
    { t: 'Repeat', html: `Drag ${P.rep} from <b>Loops</b> into ${P.on}.`, check: (q) => q.has('robot', 'controls_repeat_ext', 'mb_on_start') },
    { t: 'One side and one corner', html: `Inside the loop, add ${P.move}, then another go block set to <b>Right</b> at <b>40 %</b> for <b>0.5</b> seconds.`, check: (q) => q.count('robot', 'cb_move_time', 'controls_repeat_ext') >= 2 },
    { t: 'Tune the corners', html: `Make sure <b>Trail</b> is on and press Run. If the corners are not square, change the turn time a little and run again. This is called <b>calibrating</b>.`, check: (q) => q.ran },
    { t: 'Real motors drift', html: `Switch on <b>Real-world</b> mode and run again. Like on a real robot, the two motors are never exactly the same, so the square bends. To correct the drift, make the weaker wheel a little faster with ${P.motors}. Then try the <b>Square dance</b> challenge.`, check: (q) => q.passed('square') }
  ] },
  { id: 'avoid', title: 'Don’t crash', level: 'Sensors + logic', map: 'room', steps: [
    { t: 'Make a decision', html: `Drag ${P.ifelse} from <b>Logic</b> into ${P.fv}.`, check: (q) => q.has('robot', 'controls_if', 'mb_forever') },
    { t: 'Ask the sonar', html: `Put a ${P.cmp} block in the if. Put ${P.sonar} on the left and type <b>15</b> on the right. The sonar measures the distance in front of the robot.`, check: (q) => q.has('robot', 'cb_sonar', 'logic_compare') },
    { t: 'Back up and turn', html: `In the <b>if</b> part: go <b>Backward</b> 40 % for 0.3 s, then go <b>Right</b> 40 % for 0.4 s. In the <b>else</b> part: ${P.motors}.`, check: (q) => q.has('robot', 'cb_move_time', 'controls_if') && q.has('robot', 'cb_motors', 'controls_if') },
    { t: 'Real sensors glitch', html: `Run it, then switch on <b>Real-world</b> mode and run it again. Now the sonar sometimes hears no echo and reports <b>0</b>, just like a real one, so the robot backs up for no reason. Fix it with ${P.and}: sonar &lt; 15 <b>and</b> sonar &gt; 0.`, check: (q) => q.has('robot', 'logic_operation', 'mb_forever') },
    { t: 'Challenge', html: `Open the <b>Challenges</b> tab and try <b>Reach the flag</b>.`, check: (q) => q.passed('flag') }
  ] },
  { id: 'line', title: 'Follow the line', level: 'Sensors + logic', map: 'track', steps: [
    { t: 'How the line sensors work', html: `Two sensors under the front of the robot look at the floor. In the arena, a sensor turns <b style="color:#2f6cf6">blue</b> when it sees the black line. Drag the robot onto the line and watch the chips under the arena.` },
    { t: 'Three choices', html: `Drag ${P.iff} into ${P.fv}. Click the small gear on the if block and drag <b>else if</b> in twice.`, check: (q) => q.find('robot', 'controls_if', 'mb_forever').some(b => (b.elseifCount_ || 0) >= 2) },
    { t: 'Ask the sensors', html: `Fill the three conditions with ${P.track}: <b>● ●</b> (both on the line), <b>◌ ●</b> (only right on the line), and <b>● ◌</b> (only left on the line).`, check: (q) => q.count('robot', 'cb_tracking', 'mb_forever') >= 3 },
    { t: 'Steer', html: `Both on the line: wheels 40 and 40. Only right on the line: the line is to the right, so wheels 40 and 5. Only left: wheels 5 and 40.`, check: (q) => q.count('robot', 'cb_motors', 'mb_forever') >= 3 },
    { t: 'Race', html: `Run it and tune the speeds. Faster is better, but too fast and the robot loses the line. Then try the <b>Three laps</b> challenge.`, check: (q) => q.passed('laps') }
  ] },
  { id: 'radio', title: 'Radio remote control', level: 'Two micro:bits', map: 'open', steps: [
    { t: 'A second micro:bit', html: `Above the blocks, switch to <b>Remote micro:bit</b>. This is a second micro:bit that you hold in your hand.`, check: (q) => q.activeDev === 'remote' },
    { t: 'Program the remote', html: `On the remote: put ${P.group} in ${P.on}. Add ${P.btn} with ${P.send} inside. Make button A send 1, button B send 2, and A+B send 0.`, check: (q) => q.has('remote', 'radio_set_group', 'mb_on_start') && q.count('remote', 'radio_send_number', 'mb_on_button') >= 2 },
    { t: 'Program the robot', html: `Switch back to <b>Cutebot micro:bit</b>. Put ${P.group} in ${P.on}. Add ${P.rx}. Inside it, use if blocks that check ${P.rxn}: 1 turns left, 2 turns right, 0 drives forward.`, check: (q) => q.has('robot', 'radio_on_number') && q.has('robot', 'radio_number', 'radio_on_number') && q.has('robot', 'radio_set_group', 'mb_on_start') },
    { t: 'Drive by radio', html: `Press Run, then open the <b>Remote</b> tab under the arena and press its A and B buttons. Both micro:bits must use the same radio group.`, check: (q) => q.ran && q.radio },
    { t: 'Challenge', html: `Try the <b>Remote driver</b> challenge: steer to the flag using only the remote.`, check: (q) => q.passed('remote') }
  ] },
  { id: 'data', title: 'Graph your sonar', level: 'Data', map: 'room', steps: [
    { t: 'Send a reading', html: `Put ${P.sv} in ${P.fv}. Change “x” to <b>distance</b> and put ${P.sonar} in the number slot.`, check: (q) => q.has('robot', 'cb_sonar', 'serial_value') },
    { t: 'Drive slowly', html: `Put ${P.motors} in ${P.on} with both speeds at <b>25</b>.`, check: (q) => q.has('robot', 'cb_motors', 'mb_on_start') },
    { t: 'Watch the graph', html: `Run it and open the <b>Data</b> tab. As the robot gets closer to a box, the line goes down.`, check: (q) => q.ran && q.serial },
    { t: 'Spot the glitches', html: `Switch on <b>Real-world</b> mode and run again. Do you see readings drop to 0? Those are missed echoes. A program can ignore readings of 0 so they don’t fool it. Use <b>Download CSV</b> to open the data in a spreadsheet.` }
  ] }
];
})();
