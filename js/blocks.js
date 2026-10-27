/* Block definitions, the code generator (simulator + MakeCode modes), toolboxes and theme. */
(() => {
'use strict';
const L = window.Lab;
const C = L.C;

/* ---------- 5×5 LED grid field for "show leds" ---------- */
class FieldLeds extends Blockly.Field {
  constructor(value, validator) { super(value ?? '0'.repeat(25), validator); this.SERIALIZABLE = true; this.EDITABLE = true; this.CURSOR = 'pointer'; }
  static fromJson(o) { return new FieldLeds(o.value); }
  doClassValidation_(v) { return (typeof v === 'string' && /^[01]{25}$/.test(v)) ? v : null; }
  initView() {
    const S = 15, G = 3, P = 5, size = P * 2 + S * 5 + G * 4;
    Blockly.utils.dom.createSvgElement('rect', { x: 0, y: 0, width: size, height: size, rx: 6, ry: 6, fill: 'rgba(0,0,0,.25)' }, this.fieldGroup_);
    this.cells = [];
    for (let i = 0; i < 25; i++) this.cells.push(Blockly.utils.dom.createSvgElement('rect', { x: P + (i % 5) * (S + G), y: P + Math.floor(i / 5) * (S + G), width: S, height: S, rx: 3, ry: 3 }, this.fieldGroup_));
    this.boxSize = size;
  }
  updateSize_() { this.size_.width = this.boxSize || 100; this.size_.height = this.boxSize || 100; }
  render_() {
    const v = this.getValue() || '';
    this.cells?.forEach((c, i) => { const on = v[i] === '1'; c.setAttribute('fill', on ? '#ff4b3e' : 'rgba(255,255,255,.18)'); c.setAttribute('stroke', on ? '#ffd2cc' : 'rgba(255,255,255,.25)'); c.setAttribute('stroke-width', on ? 1 : .6); });
    this.updateSize_();
  }
  showEditor_(e) {
    if (!e || e.clientX === undefined || !this.cells) return;
    const v = this.getValue().split('');
    for (let i = 0; i < 25; i++) {
      const r = this.cells[i].getBoundingClientRect(), pad = 2;
      if (e.clientX >= r.left - pad && e.clientX <= r.right + pad && e.clientY >= r.top - pad && e.clientY <= r.bottom + pad) { v[i] = v[i] === '1' ? '0' : '1'; this.setValue(v.join('')); return; }
    }
  }
  getText_() { return this.getValue(); }
}
Blockly.fieldRegistry.register('field_leds', FieldLeds);

/* ---------- block definitions ---------- */
const num = (name) => ({ type: 'input_value', name, check: 'Number' });
const dd = (name, opts) => ({ type: 'field_dropdown', name, options: opts });
const txt = (name, value) => ({ type: 'field_input', name, text: value });
const hat = (type, msg, args, colour, tooltip) => ({ type, message0: msg + ' %' + (args.length + 1) + ' %' + (args.length + 2), args0: [...args, { type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }], colour, tooltip });
const stmt = (type, msg, args, colour, tooltip, extra = {}) => ({ type, message0: msg, args0: args, previousStatement: null, nextStatement: null, colour, tooltip, inputsInline: true, ...extra });
const val = (type, msg, args, colour, output, tooltip) => ({ type, message0: msg, args0: args, output, colour, tooltip, inputsInline: true });

const HATS = L.HATS = new Set(['mb_on_start', 'mb_forever', 'mb_on_button', 'mb_on_gesture', 'mb_every', 'cb_line_event', 'cb_ir_on',
  'radio_on_number', 'radio_on_string', 'radio_on_value', 'procedures_defnoreturn', 'procedures_defreturn']);
// reporters that only exist inside one kind of event block
const WHERE = { radio_number: 'radio_on_number', radio_string: 'radio_on_string', radio_name: 'radio_on_value', radio_value: 'radio_on_value', cb_ir_code: 'cb_ir_on' };
const HAT_LABEL = { radio_on_number: 'on radio received receivedNumber', radio_on_string: 'on radio received receivedString', radio_on_value: 'on radio received name value', cb_ir_on: 'on IR receiving' };

const iconOpts = Object.keys(L.ICONS).map(k => [L.ICON_LABELS[k] || k.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase(), k]);
const noteOpts = L.NOTES.map(n => [n[0], n[1]]);
const beatOpts = L.BEATS.map(b => [b[0] + ' beat', b[1]]);
const lightOpts = [['Left_RGB', 'RGB_R'], ['Right_RGB', 'RGB_L'], ['ALL', 'ALL']];
const sideOpts = [['Left', 'Left'], ['Right', 'Right']], foundOpts = [['Found', 'FindLine'], ['Lost', 'LoseLine']];
const btnOpts = [['A', 'A'], ['B', 'B'], ['A+B', 'AB']];
const irOpts = L.IR_BUTTONS.map(b => [b[2] === b[0] ? b[0] : `${b[0]} (${b[2]})`, b[0]]);

L.BLOCKS = [
  hat('mb_on_start', 'on start', [], C.basic, 'Runs once when the program starts'),
  hat('mb_forever', 'forever', [], C.basic, 'Repeats the code forever, after on start finishes'),
  stmt('mb_show_number', 'show number %1', [num('NUM')], C.basic, 'Scroll a number on the screen'),
  { type: 'mb_show_leds', message0: 'show leds %1', args0: [{ type: 'input_dummy' }], message1: '%1', args1: [{ type: 'field_leds', name: 'LEDS', value: '0'.repeat(25) }], previousStatement: null, nextStatement: null, colour: C.basic, tooltip: 'Click the squares to draw a picture' },
  stmt('mb_show_icon', 'show icon %1', [dd('ICON', iconOpts)], C.basic, 'Show a built-in picture'),
  stmt('mb_show_string', 'show string %1', [{ type: 'input_value', name: 'TEXT', check: 'String' }], C.basic, 'Scroll text on the screen'),
  stmt('mb_clear', 'clear screen', [], C.basic, 'Turn off all the LEDs'),
  stmt('mb_pause', 'pause (ms) %1', [num('MS')], C.basic, 'Wait this many milliseconds'),
  stmt('mb_show_arrow', 'show arrow %1', [dd('DIR', Object.keys(L.ARROWS).map(k => [k.replace(/([a-z])([A-Z])/g, '$1 $2'), k]))], C.basic, 'Show an arrow'),

  hat('mb_on_button', 'on button %1 pressed', [dd('BTN', btnOpts)], C.input, 'Runs when you press and release a button'),
  hat('mb_on_gesture', 'on %1', [dd('G', [['shake', 'Shake'], ['logo up', 'LogoUp'], ['logo down', 'LogoDown'], ['screen up', 'ScreenUp'], ['screen down', 'ScreenDown'], ['tilt left', 'TiltLeft'], ['tilt right', 'TiltRight']])], C.input, 'Runs when the micro:bit is moved this way'),
  val('mb_button_pressed', 'button %1 is pressed', [dd('BTN', btnOpts)], C.input, 'Boolean', 'True while the button is held down'),
  val('mb_acceleration', 'acceleration (mg) %1', [dd('DIM', [['x', 'X'], ['y', 'Y'], ['z', 'Z'], ['strength', 'Strength']])], C.input, 'Number', 'Tilt and movement, from -1023 to 1023 per direction'),
  val('mb_temperature', 'temperature (°C)', [], C.input, 'Number', 'Temperature in degrees Celsius'),
  val('mb_light', 'light level', [], C.input, 'Number', 'Light level from 0 (dark) to 255 (bright)'),
  val('mb_compass', 'compass heading (°)', [], C.input, 'Number', 'Direction the robot faces, 0 to 359 degrees'),
  val('mb_running_time', 'running time (ms)', [], C.input, 'Number', 'Milliseconds since the program started'),

  stmt('mb_play_tone', 'play tone %1 for %2', [dd('NOTE', noteOpts), dd('BEAT', beatOpts)], C.music, 'Play a note and wait until it finishes'),
  stmt('mb_ring_tone', 'ring tone (Hz) %1', [dd('NOTE', noteOpts)], C.music, 'Play a note until another sound or rest'),
  stmt('mb_rest', 'rest for %1', [dd('BEAT', beatOpts)], C.music, 'Silence for a number of beats'),
  stmt('mb_tempo', 'set tempo to (bpm) %1', [num('BPM')], C.music, 'Beats per minute'),
  stmt('mb_stop_sounds', 'stop all sounds', [], C.music, 'Stop any sound that is playing'),

  stmt('mb_plot', 'plot x %1 y %2', [num('X'), num('Y')], C.led, 'Turn on one LED (0-4)'),
  stmt('mb_unplot', 'unplot x %1 y %2', [num('X'), num('Y')], C.led, 'Turn off one LED'),
  stmt('mb_toggle', 'toggle x %1 y %2', [num('X'), num('Y')], C.led, 'Flip one LED'),
  val('mb_point', 'point x %1 y %2', [num('X'), num('Y')], C.led, 'Boolean', 'True if the LED is on'),
  stmt('mb_bargraph', 'plot bar graph of %1 up to %2', [num('V'), num('HI')], C.led, 'Show a value as a bar graph'),

  hat('radio_on_number', 'on radio received receivedNumber', [], C.radio, 'Runs when a number arrives from another micro:bit in the same group'),
  hat('radio_on_string', 'on radio received receivedString', [], C.radio, 'Runs when text arrives from another micro:bit in the same group'),
  hat('radio_on_value', 'on radio received name value', [], C.radio, 'Runs when a name and value arrive from another micro:bit'),
  val('radio_number', 'receivedNumber', [], C.radio, 'Number', 'The number that arrived. Use inside “on radio received receivedNumber”.'),
  val('radio_string', 'receivedString', [], C.radio, 'String', 'The text that arrived. Use inside “on radio received receivedString”.'),
  val('radio_name', 'name', [], C.radio, 'String', 'The name that arrived. Use inside “on radio received name value”.'),
  val('radio_value', 'value', [], C.radio, 'Number', 'The value that arrived. Use inside “on radio received name value”.'),
  stmt('radio_send_number', 'radio send number %1', [num('NUM')], C.radio, 'Send a number to every micro:bit in the same group'),
  stmt('radio_send_string', 'radio send string %1', [{ type: 'input_value', name: 'TEXT', check: 'String' }], C.radio, 'Send up to 19 characters of text'),
  stmt('radio_send_value', 'radio send value %1 = %2', [txt('NAME', 'name'), num('NUM')], C.radio, 'Send a name (up to 8 letters) and a number'),
  stmt('radio_set_group', 'radio set group %1', [num('GROUP')], C.radio, 'Only micro:bits in the same group (0-255) hear each other'),

  hat('mb_every', 'every %1 ms', [{ type: 'field_number', name: 'MS', value: 500, min: 1 }], C.loops, 'Runs the code over and over, with a gap between'),

  stmt('serial_line', 'serial write line %1', [{ type: 'input_value', name: 'TEXT', check: 'String' }], C.serial, 'Print a line in the Data panel'),
  stmt('serial_value', 'serial write value %1 = %2', [txt('NAME', 'x'), num('NUM')], C.serial, 'Print a named number. The Data panel graphs it.'),
  stmt('serial_number', 'serial write number %1', [num('NUM')], C.serial, 'Print a number in the Data panel'),

  stmt('cb_motors', 'set left wheel speed %1 %% right wheel speed %2 %%', [num('L'), num('R')], C.cute, 'Speeds from -100 to 100. Negative drives backwards.'),
  stmt('cb_move_time', 'go %1 at speed %2 %% for %3 seconds', [dd('DIR', [['Forward', 'forward'], ['Backward', 'backward'], ['Left', 'left'], ['Right', 'right']]), num('SPEED'), num('TIME')], C.cute, 'Drive, wait, then stop'),
  stmt('cb_forward', 'go straight at full speed', [], C.cute, 'Both wheels at 80%'),
  stmt('cb_back', 'reverse at full speed', [], C.cute, 'Both wheels at -80%'),
  stmt('cb_left', 'turn left at full speed', [], C.cute, 'Right wheel 80%, left wheel stopped'),
  stmt('cb_right', 'turn right at full speed', [], C.cute, 'Left wheel 80%, right wheel stopped'),
  stmt('cb_stop', 'stop car immediately', [], C.cute, 'Both wheels to 0'),
  stmt('cb_headlights', 'set LED headlights %1 color %2', [dd('LIGHT', lightOpts), { type: 'input_value', name: 'COLOR', check: 'Number' }], C.cute, 'Light the RGB headlights'),
  stmt('cb_headlights_rgb', 'set LED headlights %1 color R: %2 G: %3 B: %4', [dd('LIGHT', lightOpts), num('R'), num('G'), num('B')], C.cute, 'Red, green and blue from 0 to 255'),
  stmt('cb_lights_off', 'turn off all LED headlights', [], C.cute, 'Headlights off'),
  val('cb_color', '%1', [dd('C', L.COLORS)], C.cute, 'Number', 'A color'),
  val('cb_tracking', 'tracking state is %1', [dd('STATE', [['● ●  both on line', 'L_R_line'], ['◌ ●  only right on line', 'L_unline_R_line'], ['● ◌  only left on line', 'L_line_R_unline'], ['◌ ◌  both off line', 'L_R_unline']])], C.cute, 'Boolean', '● means that sensor sees the black line'),
  val('cb_track_side', '%1 line sensor %2', [dd('SIDE', sideOpts), dd('STATE', foundOpts)], C.cute, 'Boolean', 'Found = this sensor sees the black line'),
  hat('cb_line_event', 'on %1 line %2', [dd('SIDE', sideOpts), dd('STATE', foundOpts)], C.cute, 'Runs when a line sensor finds or loses the line'),
  val('cb_sonar', 'HC-SR04 sonar unit %1', [dd('UNIT', [['cm', 'Centimeters'], ['inches', 'Inches']])], C.cute, 'Number', 'Distance to the nearest object in front. 0 means nothing was heard.'),
  stmt('cb_servo', 'set servo %1 angle to %2 °', [dd('SERVO', [['S1', 'S1'], ['S2', 'S2']]), num('ANGLE')], C.cute, 'Servo angle from 0 to 180'),
  hat('cb_ir_on', 'on IR receiving', [], C.cute, 'Runs when the robot receives a button press from the IR remote'),
  val('cb_ir_code', 'IR code', [], C.cute, 'Number', 'The remote button code. Use inside “on IR receiving”.'),
  val('cb_ir_button', 'IR button %1 is pressed', [dd('BTN', irOpts)], C.cute, 'Boolean', 'True while that remote button is held'),
  stmt('np_show_color', 'underglow show color %1', [{ type: 'input_value', name: 'COLOR', check: 'Number' }], C.cute, 'Light both lights under the robot'),
  stmt('np_set_pixel', 'underglow set pixel %1 to %2', [num('I'), { type: 'input_value', name: 'COLOR', check: 'Number' }], C.cute, 'Pixel 0 or 1. Use “underglow show” afterwards.'),
  stmt('np_show', 'underglow show', [], C.cute, 'Send the pixel colors to the lights'),
  stmt('np_clear', 'underglow clear', [], C.cute, 'Turn the lights under the robot off'),
  stmt('np_brightness', 'underglow set brightness %1', [num('B')], C.cute, 'Brightness from 0 to 255'),
  stmt('np_rainbow', 'underglow show rainbow', [], C.cute, 'Rainbow colors across the lights'),
  val('np_color', '%1', [dd('C', L.NP_COLORS.map(c => [c[0], c[1]]))], C.cute, 'Number', 'A NeoPixel color'),
  val('np_rgb', 'red %1 green %2 blue %3', [num('R'), num('G'), num('B')], C.cute, 'Number', 'Mix a color from 0-255 values')
];
Blockly.common.defineBlocksWithJsonArray(L.BLOCKS);

/* ---------- generator: one generator, two modes ----------
   simulator mode: async/await + block highlighting so the simulator can pause
   MakeCode mode: plain MakeCode TypeScript to paste into makecode.microbit.org */
const G = javascript.javascriptGenerator, O = javascript.Order;
G.INDENT = '    ';
G.addReservedWords(L.API_NAMES.join(',') + ',pins,control,Math,strip,receivedNumber,receivedString,name,value,code');
let TS = false;
const AW = () => TS ? '' : 'await ';
const FN = (params = '') => (TS ? 'function (' : 'async function (') + params + ')';
const V = (b, n, d = '0') => G.valueToCode(b, n, O.NONE) || d;
const F = (b, n) => b.getFieldValue(n);
const def = (type, fn) => { G.forBlock[type] = fn; };
const beat = (b) => `music.beat(BeatFraction.${F(b, 'BEAT')})`;
const call = (code) => [code, O.FUNCTION_CALL];

def('mb_show_number', b => `${AW()}basic.showNumber(${V(b, 'NUM')})\n`);
def('mb_show_leds', b => { const v = F(b, 'LEDS'); let rows = ''; for (let y = 0; y < 5; y++) rows += '    ' + [0, 1, 2, 3, 4].map(x => v[y * 5 + x] === '1' ? '#' : '.').join(' ') + '\n'; return `${AW()}basic.showLeds(\`\n${rows}    \`)\n`; });
def('mb_show_icon', b => `${AW()}basic.showIcon(IconNames.${F(b, 'ICON')})\n`);
def('mb_show_string', b => `${AW()}basic.showString(${V(b, 'TEXT', '""')})\n`);
def('mb_clear', () => `basic.clearScreen()\n`);
def('mb_pause', b => `${AW()}basic.pause(${V(b, 'MS')})\n`);
def('mb_show_arrow', b => `${AW()}basic.showArrow(ArrowNames.${F(b, 'DIR')})\n`);
def('mb_button_pressed', b => call(`input.buttonIsPressed(Button.${F(b, 'BTN')})`));
def('mb_acceleration', b => call(`input.acceleration(Dimension.${F(b, 'DIM')})`));
def('mb_temperature', () => call('input.temperature()'));
def('mb_light', () => call('input.lightLevel()'));
def('mb_compass', () => call('input.compassHeading()'));
def('mb_running_time', () => call('input.runningTime()'));
def('mb_play_tone', b => `${AW()}music.playTone(Note.${F(b, 'NOTE')}, ${beat(b)})\n`);
def('mb_ring_tone', b => `music.ringTone(Note.${F(b, 'NOTE')})\n`);
def('mb_rest', b => `${AW()}music.rest(${beat(b)})\n`);
def('mb_tempo', b => `music.setTempo(${V(b, 'BPM', '120')})\n`);
def('mb_stop_sounds', () => `music.stopAllSounds()\n`);
def('mb_plot', b => `led.plot(${V(b, 'X')}, ${V(b, 'Y')})\n`);
def('mb_unplot', b => `led.unplot(${V(b, 'X')}, ${V(b, 'Y')})\n`);
def('mb_toggle', b => `led.toggle(${V(b, 'X')}, ${V(b, 'Y')})\n`);
def('mb_point', b => call(`led.point(${V(b, 'X')}, ${V(b, 'Y')})`));
def('mb_bargraph', b => `led.plotBarGraph(${V(b, 'V')}, ${V(b, 'HI', '255')})\n`);
def('radio_number', () => ['receivedNumber', O.ATOMIC]);
def('radio_string', () => ['receivedString', O.ATOMIC]);
def('radio_name', () => ['name', O.ATOMIC]);
def('radio_value', () => ['value', O.ATOMIC]);
def('radio_send_number', b => `radio.sendNumber(${V(b, 'NUM')})\n`);
def('radio_send_string', b => `radio.sendString(${V(b, 'TEXT', '""')})\n`);
def('radio_send_value', b => `radio.sendValue(${JSON.stringify(F(b, 'NAME'))}, ${V(b, 'NUM')})\n`);
def('radio_set_group', b => `radio.setGroup(${V(b, 'GROUP', '1')})\n`);
def('serial_line', b => `serial.writeLine(${V(b, 'TEXT', '""')})\n`);
def('serial_value', b => `serial.writeValue(${JSON.stringify(F(b, 'NAME'))}, ${V(b, 'NUM')})\n`);
def('serial_number', b => `serial.writeNumber(${V(b, 'NUM')})\n`);
def('cb_motors', b => `cuteBot.motors(${V(b, 'L')}, ${V(b, 'R')})\n`);
def('cb_move_time', b => `${AW()}cuteBot.moveTime(cuteBot.Direction.${F(b, 'DIR')}, ${V(b, 'SPEED')}, ${V(b, 'TIME')})\n`);
def('cb_forward', () => `cuteBot.forward()\n`);
def('cb_back', () => `cuteBot.backforward()\n`);
def('cb_left', () => `cuteBot.turnleft()\n`);
def('cb_right', () => `cuteBot.turnright()\n`);
def('cb_stop', () => `cuteBot.stopcar()\n`);
def('cb_headlights', b => `cuteBot.colorLight(cuteBot.RGBLights.${F(b, 'LIGHT')}, ${V(b, 'COLOR', '0xff0000')})\n`);
def('cb_headlights_rgb', b => `cuteBot.singleheadlights(cuteBot.RGBLights.${F(b, 'LIGHT')}, ${V(b, 'R')}, ${V(b, 'G')}, ${V(b, 'B')})\n`);
def('cb_lights_off', () => `cuteBot.closeheadlights()\n`);
def('cb_color', b => [F(b, 'C'), O.ATOMIC]);
def('cb_tracking', b => call(`cuteBot.tracking(cuteBot.TrackingState.${F(b, 'STATE')})`));
def('cb_track_side', b => call(`cuteBot.trackSide(cuteBot.MbPins.${F(b, 'SIDE')}, cuteBot.MbEvents.${F(b, 'STATE')})`));
def('cb_sonar', b => call(`cuteBot.ultrasonic(cuteBot.SonarUnit.${F(b, 'UNIT')})`));
def('cb_servo', b => `cuteBot.setServo(cuteBot.ServoList.${F(b, 'SERVO')}, ${V(b, 'ANGLE', '90')})\n`);
def('cb_ir_code', () => ['code', O.ATOMIC]);
def('cb_ir_button', b => call(`cuteBot.IR_Button(cuteBot.IRButtons.${F(b, 'BTN')})`));
def('np_show_color', b => `strip.showColor(${V(b, 'COLOR', 'neopixel.colors(NeoPixelColors.Red)')})\n`);
def('np_set_pixel', b => `strip.setPixelColor(${V(b, 'I')}, ${V(b, 'COLOR', 'neopixel.colors(NeoPixelColors.Red)')})\n`);
def('np_show', () => `strip.show()\n`);
def('np_clear', () => `strip.clear()\nstrip.show()\n`);
def('np_brightness', b => `strip.setBrightness(${V(b, 'B', '128')})\n`);
def('np_rainbow', () => `strip.showRainbow(1, 360)\n`);
def('np_color', b => call(`neopixel.colors(NeoPixelColors.${F(b, 'C')})`));
def('np_rgb', b => call(`neopixel.rgb(${V(b, 'R')}, ${V(b, 'G')}, ${V(b, 'B')})`));
// MakeCode-flavoured versions of Blockly built-ins
def('math_random_int', b => call(`randint(${V(b, 'FROM')}, ${V(b, 'TO')})`));
def('text', b => [JSON.stringify(F(b, 'TEXT')), O.ATOMIC]);
def('text_join', b => { const parts = ['""']; for (let i = 0; i < b.itemCount_; i++) parts.push(G.valueToCode(b, 'ADD' + i, O.ADDITION) || '""'); return [parts.join(' + '), O.ADDITION]; });
def('math_change', b => `${G.getVariableName(F(b, 'VAR'))} += ${G.valueToCode(b, 'DELTA', O.ADDITION) || '0'}\n`);
const origCall = G.forBlock.procedures_callnoreturn, origCallR = G.forBlock.procedures_callreturn;
def('procedures_callnoreturn', function (b, g) { const c = origCall.call(this, b, g); return TS ? c : 'await ' + c; });
def('procedures_callreturn', function (b, g) { const [c] = origCallR.call(this, b, g); return TS ? [c, O.FUNCTION_CALL] : ['(await ' + c + ')', O.ATOMIC]; });

const STRINGY = new Set(['text', 'text_join', 'radio_string', 'radio_name']);
function valueType(t) {
  if (!t) return 'number';
  const chk = t.outputConnection && t.outputConnection.getCheck();
  if (chk && chk.includes('String')) return 'string';
  if (chk && chk.includes('Boolean')) return 'boolean';
  if (STRINGY.has(t.type)) return 'string';
  if (/^logic_(compare|operation|negate|boolean)$/.test(t.type)) return 'boolean';
  return 'number';
}
const INIT = { number: '0', string: '""', boolean: 'false' };
L.hasStatementCode = (ws) => ws.getTopBlocks(false).some(b => b.isEnabled() && HATS.has(b.type) && (b.getInputTargetBlock('DO') || b.type.startsWith('procedures_')));

/** Generate code for one workspace. ts=true gives MakeCode TypeScript; false gives simulator JavaScript. */
L.generate = function (ws, ts) {
  TS = ts;
  G.INFINITE_LOOP_TRAP = ts ? null : 'await __tick();\n';
  G.STATEMENT_PREFIX = ts ? null : 'await __hl(%1);\n';
  G.init(ws);
  const body = (b) => G.statementToCode(b, 'DO');
  const events = [], start = [], forevers = [];
  for (const b of ws.getTopBlocks(true)) {
    if (!b.isEnabled()) continue;
    switch (b.type) {
      case 'mb_on_start': start.push(body(b).replace(/^ {4}/gm, '')); break;
      case 'mb_forever': forevers.push(`basic.forever(${FN()} {\n${body(b)}})\n`); break;
      case 'mb_every': forevers.push(`loops.everyInterval(${F(b, 'MS')}, ${FN()} {\n${body(b)}})\n`); break;
      case 'mb_on_button': events.push(`input.onButtonPressed(Button.${F(b, 'BTN')}, ${FN()} {\n${body(b)}})\n`); break;
      case 'mb_on_gesture': events.push(`input.onGesture(Gesture.${F(b, 'G')}, ${FN()} {\n${body(b)}})\n`); break;
      case 'cb_line_event': events.push(`cuteBot.trackEvent(cuteBot.MbPins.${F(b, 'SIDE')}, cuteBot.MbEvents.${F(b, 'STATE')}, ${FN()} {\n${body(b)}})\n`); break;
      case 'cb_ir_on': events.push(`cuteBot.IR_callback(${FN('code')} {\n${body(b)}})\n`); break;
      case 'radio_on_number': events.push(`radio.onReceivedNumber(${FN('receivedNumber')} {\n${body(b)}})\n`); break;
      case 'radio_on_string': events.push(`radio.onReceivedString(${FN('receivedString')} {\n${body(b)}})\n`); break;
      case 'radio_on_value': events.push(`radio.onReceivedValue(${FN('name, value')} {\n${body(b)}})\n`); break;
      case 'procedures_defnoreturn': case 'procedures_defreturn': G.blockToCode(b); break;
    }
  }
  const usesStrip = ws.getAllBlocks(false).some(b => b.isEnabled() && /^np_(show|set|clear|bright|rainbow)/.test(b.type) && HATS.has(b.getRootBlock().type));
  // MakeCode declares the strip and variables first, then event handlers, then "on start" code, then forever loops
  const pre = usesStrip ? 'let strip = neopixel.create(DigitalPin.P15, 2, NeoPixelMode.RGB)\n' : '';
  const types = {};
  for (const b of ws.getAllBlocks(false)) {
    if (b.type !== 'variables_set') continue;
    const n = G.getVariableName(F(b, 'VAR'));
    if (!types[n]) types[n] = valueType(b.getInputTargetBlock('VALUE'));
  }
  let code = G.finish(pre + [...events, ...start, ...forevers].join(''));
  const procs = Blockly.Procedures.allProcedures(ws).flat().map(p => G.getProcedureName(p[0]));
  if (ts) {
    code = code.replace(/^var (.+);$/m, (m, names) => names.split(', ').map(n => `let ${n} = ${INIT[types[n] || 'number']}`).join('\n'))
      .replace(/\bvar\b/g, 'let')
      .replace(/;$/gm, '');
    for (const p of procs) code = code.replace(new RegExp('^function ' + p + '\\(([^)]*)\\) \\{$', 'm'), (m, ps) => `function ${p}(${ps.split(', ').filter(Boolean).map(x => x + ': number').join(', ')}) {`);
  } else {
    for (const p of procs) code = code.replace(new RegExp('^function ' + p + '\\(([^)]*)\\) \\{$', 'm'), `async function ${p}($1) {\n    await __tick();`);
  }
  TS = false;
  G.STATEMENT_PREFIX = null;
  return code.trim() + '\n';
};
/** A throw-away workspace holding a saved program, for generating or checking a program that is not on screen. */
L.headless = (state) => { const w = new Blockly.Workspace(); if (state) Blockly.serialization.workspaces.load(state, w); return w; };

/** Grey out blocks that are not inside an event, and reporters used outside their event. */
L.updateOrphans = function (ws) {
  Blockly.Events.disable();
  try {
    for (const b of ws.getAllBlocks(false)) {
      const root = b.getRootBlock();
      const orphan = !HATS.has(root.type);
      if (orphan !== b.hasDisabledReason('orphan')) b.setDisabledReason(orphan, 'orphan');
      const need = WHERE[b.type];
      if (need) {
        let p = b, ok = false; while (p) { if (p.type === need) { ok = true; break; } p = p.getSurroundParent(); }
        if (!ok && !orphan && !b.isInFlyout) { b.setWarningText(`Put this inside “${HAT_LABEL[need]}”.`); }
        else b.setWarningText(null);
        if ((!ok && !orphan) !== b.hasDisabledReason('wrongplace')) b.setDisabledReason(!ok && !orphan, 'wrongplace');
      }
    }
  } finally { Blockly.Events.enable(); }
};

/* ---------- toolbox ---------- */
const sh = (v) => ({ shadow: { type: 'math_number', fields: { NUM: v } } });
const shText = (t) => ({ shadow: { type: 'text', fields: { TEXT: t } } });
const npc = (c) => ({ shadow: { type: 'np_color', fields: { C: c } } });
L.makeToolbox = function (devId) {
  const cats = [
    { kind: 'category', name: 'Basic', colour: C.basic, contents: [
      { kind: 'block', type: 'mb_show_number', inputs: { NUM: sh(0) } },
      { kind: 'block', type: 'mb_show_leds', fields: { LEDS: '0000001010000001000101110' } },
      { kind: 'block', type: 'mb_show_icon' },
      { kind: 'block', type: 'mb_show_string', inputs: { TEXT: shText('Hello!') } },
      { kind: 'block', type: 'mb_on_start' }, { kind: 'block', type: 'mb_forever' },
      { kind: 'block', type: 'mb_pause', inputs: { MS: sh(100) } },
      { kind: 'block', type: 'mb_clear' }, { kind: 'block', type: 'mb_show_arrow' } ] },
    { kind: 'category', name: 'Input', colour: C.input, contents: [
      { kind: 'block', type: 'mb_on_button' }, { kind: 'block', type: 'mb_on_gesture' }, { kind: 'block', type: 'mb_button_pressed' },
      { kind: 'block', type: 'mb_acceleration' }, { kind: 'block', type: 'mb_temperature' }, { kind: 'block', type: 'mb_light' },
      { kind: 'block', type: 'mb_compass' }, { kind: 'block', type: 'mb_running_time' } ] },
    { kind: 'category', name: 'Cutebot', colour: C.cute, contents: [
      { kind: 'label', text: 'Motors' },
      { kind: 'block', type: 'cb_motors', inputs: { L: sh(50), R: sh(50) } },
      { kind: 'block', type: 'cb_move_time', inputs: { SPEED: sh(50), TIME: sh(1) } },
      { kind: 'block', type: 'cb_forward' }, { kind: 'block', type: 'cb_back' }, { kind: 'block', type: 'cb_left' }, { kind: 'block', type: 'cb_right' }, { kind: 'block', type: 'cb_stop' },
      { kind: 'label', text: 'Headlights' },
      { kind: 'block', type: 'cb_headlights', inputs: { COLOR: { shadow: { type: 'cb_color', fields: { C: '0xff0000' } } } } },
      { kind: 'block', type: 'cb_headlights_rgb', inputs: { R: sh(255), G: sh(255), B: sh(255) } },
      { kind: 'block', type: 'cb_lights_off' },
      { kind: 'label', text: 'Line sensors' },
      { kind: 'block', type: 'cb_tracking' }, { kind: 'block', type: 'cb_track_side' }, { kind: 'block', type: 'cb_line_event' },
      { kind: 'label', text: 'Sonar and servos' },
      { kind: 'block', type: 'cb_sonar' }, { kind: 'block', type: 'cb_servo', inputs: { ANGLE: sh(180) } },
      { kind: 'label', text: 'IR remote' },
      { kind: 'block', type: 'cb_ir_on' }, { kind: 'block', type: 'cb_ir_code' }, { kind: 'block', type: 'cb_ir_button' },
      { kind: 'label', text: 'Underglow lights (NeoPixels on P15)' },
      { kind: 'block', type: 'np_show_color', inputs: { COLOR: npc('Red') } },
      { kind: 'block', type: 'np_set_pixel', inputs: { I: sh(0), COLOR: npc('Blue') } },
      { kind: 'block', type: 'np_show' }, { kind: 'block', type: 'np_clear' }, { kind: 'block', type: 'np_rainbow' },
      { kind: 'block', type: 'np_brightness', inputs: { B: sh(128) } },
      { kind: 'block', type: 'np_color' }, { kind: 'block', type: 'np_rgb', inputs: { R: sh(255), G: sh(255), B: sh(255) } } ] },
    { kind: 'category', name: 'Radio', colour: C.radio, contents: [
      { kind: 'block', type: 'radio_set_group', inputs: { GROUP: sh(1) } },
      { kind: 'block', type: 'radio_send_number', inputs: { NUM: sh(0) } },
      { kind: 'block', type: 'radio_send_string', inputs: { TEXT: shText('go') } },
      { kind: 'block', type: 'radio_send_value', inputs: { NUM: sh(0) } },
      { kind: 'block', type: 'radio_on_number' }, { kind: 'block', type: 'radio_number' },
      { kind: 'block', type: 'radio_on_string' }, { kind: 'block', type: 'radio_string' },
      { kind: 'block', type: 'radio_on_value' }, { kind: 'block', type: 'radio_name' }, { kind: 'block', type: 'radio_value' } ] },
    { kind: 'category', name: 'Music', colour: C.music, contents: [
      { kind: 'block', type: 'mb_play_tone' }, { kind: 'block', type: 'mb_ring_tone' }, { kind: 'block', type: 'mb_rest' },
      { kind: 'block', type: 'mb_tempo', inputs: { BPM: sh(120) } }, { kind: 'block', type: 'mb_stop_sounds' } ] },
    { kind: 'category', name: 'Led', colour: C.led, contents: [
      { kind: 'block', type: 'mb_plot', inputs: { X: sh(0), Y: sh(0) } }, { kind: 'block', type: 'mb_unplot', inputs: { X: sh(0), Y: sh(0) } },
      { kind: 'block', type: 'mb_toggle', inputs: { X: sh(0), Y: sh(0) } }, { kind: 'block', type: 'mb_point', inputs: { X: sh(0), Y: sh(0) } },
      { kind: 'block', type: 'mb_bargraph', inputs: { V: sh(0), HI: sh(255) } } ] },
    { kind: 'category', name: 'Loops', colour: C.loops, contents: [
      { kind: 'block', type: 'controls_repeat_ext', inputs: { TIMES: sh(4) } },
      { kind: 'block', type: 'controls_whileUntil', inputs: { BOOL: { shadow: { type: 'logic_boolean', fields: { BOOL: 'TRUE' } } } } },
      { kind: 'block', type: 'controls_for', fields: { VAR: { name: 'index' } }, inputs: { FROM: sh(0), TO: sh(4), BY: sh(1) } },
      { kind: 'block', type: 'mb_every' }, { kind: 'block', type: 'controls_flow_statements' } ] },
    { kind: 'category', name: 'Logic', colour: C.logic, contents: [
      { kind: 'block', type: 'controls_if' }, { kind: 'block', type: 'controls_if', extraState: { hasElse: true } },
      { kind: 'block', type: 'logic_compare', inputs: { A: sh(0), B: sh(0) } },
      { kind: 'block', type: 'logic_compare', fields: { OP: 'LT' }, inputs: { A: sh(0), B: sh(0) } },
      { kind: 'block', type: 'logic_operation' }, { kind: 'block', type: 'logic_operation', fields: { OP: 'OR' } },
      { kind: 'block', type: 'logic_negate' }, { kind: 'block', type: 'logic_boolean' } ] },
    { kind: 'category', name: 'Variables', colour: C.vars, custom: 'VARIABLE' },
    { kind: 'category', name: 'Math', colour: C.math, contents: [
      { kind: 'block', type: 'math_number' },
      { kind: 'block', type: 'math_arithmetic', inputs: { A: sh(0), B: sh(0) } },
      { kind: 'block', type: 'math_arithmetic', fields: { OP: 'MINUS' }, inputs: { A: sh(0), B: sh(0) } },
      { kind: 'block', type: 'math_arithmetic', fields: { OP: 'MULTIPLY' }, inputs: { A: sh(0), B: sh(0) } },
      { kind: 'block', type: 'math_random_int', inputs: { FROM: sh(0), TO: sh(10) } },
      { kind: 'block', type: 'math_modulo', inputs: { DIVIDEND: sh(0), DIVISOR: sh(1) } },
      { kind: 'block', type: 'math_single', fields: { OP: 'ABS' }, inputs: { NUM: sh(0) } },
      { kind: 'block', type: 'math_round', inputs: { NUM: sh(0) } },
      { kind: 'block', type: 'math_constrain', inputs: { VALUE: sh(0), LOW: sh(0), HIGH: sh(100) } } ] },
    { kind: 'category', name: 'Functions', colour: C.fn, custom: 'PROCEDURE' },
    { kind: 'category', name: 'Text', colour: C.text, contents: [
      { kind: 'block', type: 'text' }, { kind: 'block', type: 'text_join' }, { kind: 'block', type: 'text_length', inputs: { VALUE: shText('Hello') } } ] },
    { kind: 'category', name: 'Serial', colour: C.serial, contents: [
      { kind: 'block', type: 'serial_value', inputs: { NUM: sh(0) } },
      { kind: 'block', type: 'serial_line', inputs: { TEXT: shText('Hello') } },
      { kind: 'block', type: 'serial_number', inputs: { NUM: sh(0) } } ] }
  ];
  return { kind: 'categoryToolbox', contents: devId === 'remote' ? cats.filter(c => c.name !== 'Cutebot') : cats };
};

/* ---------- theme from page tokens ---------- */
const cssVar = L.cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
L.makeTheme = function () {
  return Blockly.Theme.defineTheme('cutebot-' + Math.random().toString(36).slice(2, 7), {
    base: Blockly.Themes.Classic,
    blockStyles: {
      logic_blocks: { colourPrimary: C.logic }, loop_blocks: { colourPrimary: C.loops }, math_blocks: { colourPrimary: C.math },
      text_blocks: { colourPrimary: C.text }, variable_blocks: { colourPrimary: C.vars }, variable_dynamic_blocks: { colourPrimary: C.vars },
      procedure_blocks: { colourPrimary: C.fn }, list_blocks: { colourPrimary: '#D83B01' }, colour_blocks: { colourPrimary: C.cute }
    },
    componentStyles: {
      workspaceBackgroundColour: cssVar('--panel-2'), toolboxBackgroundColour: cssVar('--panel'), toolboxForegroundColour: cssVar('--ink'),
      flyoutBackgroundColour: cssVar('--panel'), flyoutForegroundColour: cssVar('--muted'), flyoutOpacity: 0.97,
      scrollbarColour: cssVar('--line'), scrollbarOpacity: 0.9, insertionMarkerColour: cssVar('--ink'), insertionMarkerOpacity: 0.3
    },
    fontStyle: { family: 'Lexend, "Segoe UI", system-ui, sans-serif', weight: '500', size: 11 },
    startHats: false
  });
};
})();
