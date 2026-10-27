/* UI wiring: projects, workspaces, panels, challenges + proofs, turn-in, teacher checking, lessons, data. */
(() => {
'use strict';
const L = window.Lab;
const { $, esc, bot, RT, devices } = L;

let ws = null;
const proj = { active: 'robot', programs: { robot: null, remote: null } };
const ui = { speed: '1', real: false, highlight: true, sound: true, trail: true, tab: 'board', split: null, lessons: false, autorun: true, big: false, editArena: false };
const UISTORE = 'cutebot-lab-ui', PROOFS = 'cutebot-lab-proofs', LESSONSTORE = 'cutebot-lab-lessons', STUDENT = 'cutebot-lab-student', TURNED = 'cutebot-lab-turnedin';
const PINDEX = 'cutebot-lab-projects', pkey = (id) => 'cutebot-lab-project-' + id;
const readJSON = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch (e) { return d; } };
const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };

/* ---------- small UI helpers ---------- */
let toastT = 0;
function toast(msg) {
  let t = document.querySelector('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 3400);
}
L.toast = toast;
function modal(title, bodyHtml, actions, wide) {
  $('mTitle').textContent = title; $('mBody').innerHTML = bodyHtml;
  $('modal').querySelector('.dialog').classList.toggle('wide', !!wide);
  const a = $('mActions'); a.innerHTML = '';
  for (const [label, fn, primary] of actions) {
    const b = document.createElement('button'); b.className = 'btn' + (primary ? ' run' : ''); b.textContent = label;
    b.onclick = async () => { if ((await fn()) !== false) closeModal(); }; a.appendChild(b);
  }
  $('modal').hidden = false; a.lastChild?.focus();
}
function closeModal() { $('modal').hidden = true; }
$('modal').addEventListener('click', (e) => { if (e.target === $('modal')) closeModal(); });
async function copyText(text, ta) {
  try { await navigator.clipboard.writeText(text); toast('Copied to clipboard'); return true; }
  catch (e) { if (ta) { ta.focus(); ta.select(); } toast('Press Ctrl+C (or ⌘C) to copy the selected text'); return false; }
}
let downloads = null;   // claude.ai's download capability, when this runs as an artifact there
async function saveFile(filename, data) {
  if (downloads) {
    try { await downloads.save({ filename, data }); return true; }
    catch (e) { if (e && e.code !== 'declined') toast('The file could not be saved (' + (e.code || 'error') + '). Use Copy instead.'); return false; }
  }
  try {
    const url = URL.createObjectURL(new Blob([data], { type: filename.endsWith('.csv') ? 'text/csv' : filename.endsWith('.json') ? 'application/json' : 'text/plain' }));
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return true;
  } catch (e) { toast('The file could not be saved here. Use Copy instead.'); return false; }
}
const safeName = (s) => String(s || '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'cutebot';

/* popover menus: one open at a time, closed by Escape or a click elsewhere */
function popover(btnId, panelId) {
  const btn = $(btnId), panel = $(panelId);
  const set = (open) => { panel.hidden = !open; btn.setAttribute('aria-expanded', open); if (open) document.querySelectorAll('.pop').forEach(p => { if (p !== panel) p.hidden = true; }); };
  btn.onclick = (e) => { e.stopPropagation(); set(panel.hidden); };
  panel.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) set(false); });
  document.addEventListener('click', (e) => { if (!panel.hidden && !panel.contains(e.target) && e.target !== btn) set(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) { set(false); btn.focus(); } });
  return set;
}

/* ---------- programs ---------- */
function serializeActive() { proj.programs[proj.active] = Blockly.serialization.workspaces.save(ws); }
function wsFor(devId) { if (devId === proj.active) return ws; return L.headless(proj.programs[devId]); }
const genTS = (devId) => L.generate(wsFor(devId), true);
const hasCode = (devId) => L.hasStatementCode(wsFor(devId));
function projectData() {
  serializeActive();
  return { app: 'cutebot-code-lab', v: 2, name: $('projName').value, active: proj.active, programs: proj.programs, arena: { map: L.arena.map, edits: L.arena.edits } };
}
function loadXmlInto(w, xml) { w.clear(); Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(xml), w); }
function xmlToState(xml) { const w = new Blockly.Workspace(); loadXmlInto(w, xml); const s = Blockly.serialization.workspaces.save(w); w.dispose(); return s; }
const MAPS_OK = (m) => !!L.MAPS[m];
function loadProject(p) {
  L.stopAll(); exitChallenge(true);
  proj.programs = { robot: null, remote: null };
  if (p.programs) { proj.programs.robot = p.programs.robot || null; proj.programs.remote = p.programs.remote || null; }
  else if (p.ws) proj.programs.robot = p.ws;                 // version 1 projects
  $('projName').value = p.name || 'Untitled';
  L.arena.edits = (p.arena && p.arena.edits) || {};
  setMap(MAPS_OK(p.arena && p.arena.map) ? p.arena.map : MAPS_OK(p.map) ? p.map : 'track', true);
  showDevice(p.active === 'remote' ? 'remote' : 'robot', true);
  resetAll();
  ws.clearUndo(); updateUndo(); updateTabs();
}
function showDevice(devId, skipSave) {
  if (!skipSave) serializeActive();
  proj.active = devId;
  ws.updateToolbox(L.makeToolbox(devId));
  ws.clear();
  const st = proj.programs[devId];
  if (st) Blockly.serialization.workspaces.load(st, ws);
  else if (devId === 'robot') loadXmlInto(ws, L.BLANK);
  L.updateOrphans(ws);
  ws.scrollCenter(); ws.clearUndo(); updateUndo();
  document.querySelectorAll('#devSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.dev === devId));
  $('devNote').textContent = devId === 'remote' ? 'A second micro:bit you hold in your hand. It talks to the Cutebot by radio.' : 'The micro:bit plugged into the Cutebot.';
  $('remoteEmpty').hidden = !(devId === 'remote' && ws.getAllBlocks(false).length === 0);
  $('blockSearch').value = '';
  refreshCode(); updateDevDots(); updateTabs();
  lessonCheckSoon();
}
function updateDevDots() { const has = proj.active === 'remote' ? L.hasStatementCode(ws) : hasCode('remote'); $('devRemoteDot').hidden = !has; }

/* ---------- my projects (several, kept in this browser) ---------- */
let pindex = null;
const newId = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function save() {
  if (!pindex || !pindex.current) return;
  const d = projectData();
  if (!writeJSON(pkey(pindex.current), d)) { toast('This browser is out of space for projects. Delete old projects in My projects.'); return; }
  const e = pindex.list.find(x => x.id === pindex.current); if (e) { e.name = d.name; e.updated = Date.now(); }
  writeJSON(PINDEX, pindex);
}
/** Opens p as a new project. Whatever was open stays saved in My projects. */
function startNewProject(p) {
  if (pindex.current) save();
  const id = newId();
  pindex.list.unshift({ id, name: p.name || 'Untitled', updated: Date.now() });
  pindex.current = id;
  loadProject(p); save();
}
function openProject(id, skipSave) {
  if (!skipSave) save();
  const d = readJSON(pkey(id), null);
  if (!d) { toast('That project could not be opened.'); return false; }
  pindex.current = id; loadProject(d); save();
  return true;
}
const TRASH_DAYS = 7;
/** Moves a project to Recently deleted. Its data is kept for a week so it can be restored. */
function deleteProject(id) {
  const i = pindex.list.findIndex(x => x.id === id); if (i < 0) return;
  if (id === pindex.current) save();
  const [entry] = pindex.list.splice(i, 1);
  (pindex.trash ||= []).unshift({ ...entry, deletedAt: Date.now() });
  if (pindex.current === id) { pindex.current = null; if (pindex.list.length) openProject(pindex.list[0].id, true); else startNewProject(blankProject()); }
  writeJSON(PINDEX, pindex);
}
function restoreProject(id) {
  const i = (pindex.trash || []).findIndex(x => x.id === id); if (i < 0) return;
  const [entry] = pindex.trash.splice(i, 1); delete entry.deletedAt;
  pindex.list.unshift(entry); writeJSON(PINDEX, pindex);
}
function purgeProject(id) {
  pindex.trash = (pindex.trash || []).filter(x => x.id !== id);
  try { localStorage.removeItem(pkey(id)); } catch (e) {}
  writeJSON(PINDEX, pindex);
}
function purgeOldTrash() {
  const cutoff = Date.now() - TRASH_DAYS * 864e5;
  for (const t of (pindex.trash || []).slice()) if (t.deletedAt < cutoff) purgeProject(t.id);
}
const blankProject = (name = 'Untitled') => ({ name, programs: { robot: xmlToState(L.BLANK), remote: null }, arena: { map: L.arena.map, edits: {} } });
function exampleProject(key) { const ex = L.EXAMPLES[key]; return { name: ex.name, programs: { robot: xmlToState(ex.xml), remote: ex.remote ? xmlToState(ex.remote) : null }, arena: { map: ex.map, edits: {} } }; }
function openProjects() {
  save();
  const rows = pindex.list.map(p => `<li class="prow${p.id === pindex.current ? ' cur' : ''}"><div class="pname"><b>${esc(p.name || 'Untitled')}</b><span class="note">Changed ${esc(new Date(p.updated).toLocaleString())}</span></div>
    <div class="pacts">${p.id === pindex.current ? '<span class="badge pass">Open now</span>' : `<button class="btn small" data-open="${p.id}">Open</button>`}<button class="btn small" data-dup="${p.id}">Make a copy</button><button class="btn small" data-del="${p.id}">Delete</button></div></li>`).join('');
  const trash = (pindex.trash || []).map(p => `<li class="prow trash"><div class="pname"><b>${esc(p.name || 'Untitled')}</b><span class="note">Deleted ${esc(new Date(p.deletedAt).toLocaleString())} · kept until ${esc(new Date(p.deletedAt + TRASH_DAYS * 864e5).toLocaleDateString())}</span></div>
    <div class="pacts"><button class="btn small" data-restore="${p.id}">Restore</button><button class="btn small" data-purge="${p.id}">Delete forever</button></div></li>`).join('');
  modal('My projects', `<div class="row-actions"><button class="btn run" id="pjNewBlank">New blank project</button><span class="note">Projects are saved in this browser. Rename a project in the name box at the top of the page.</span></div><ul class="plist">${rows}</ul>
    ${trash ? `<span class="sec-label">Recently deleted</span><p class="note">Deleted projects are kept for ${TRASH_DAYS} days, then removed for good.</p><ul class="plist">${trash}</ul>` : ''}`, [['Close', () => {}]], true);
  $('mBody').querySelectorAll('[data-restore]').forEach(b => b.onclick = () => { restoreProject(b.dataset.restore); openProjects(); toast('Project restored'); });
  $('mBody').querySelectorAll('[data-purge]').forEach(b => b.onclick = () => {
    if (b.dataset.armed) { purgeProject(b.dataset.purge); openProjects(); toast('Project deleted for good'); return; }
    b.dataset.armed = '1'; b.textContent = 'Click again: this can’t be undone'; b.classList.add('danger');
    setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = 'Delete forever'; b.classList.remove('danger'); } }, 3500);
  });
  $('pjNewBlank').onclick = () => { closeModal(); startNewProject(blankProject()); toast('New project. Your other projects are in My projects.'); };
  $('mBody').querySelectorAll('[data-open]').forEach(b => b.onclick = () => { closeModal(); openProject(b.dataset.open); });
  $('mBody').querySelectorAll('[data-dup]').forEach(b => b.onclick = () => {
    const id = b.dataset.dup, d = id === pindex.current ? projectData() : readJSON(pkey(id), null); if (!d) return;
    closeModal(); startNewProject({ ...JSON.parse(JSON.stringify(d)), name: (d.name || 'Untitled') + ' (copy)' }); toast('Made a copy. You are now working on the copy.');
  });
  $('mBody').querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    deleteProject(b.dataset.del); openProjects(); toast('Moved to Recently deleted. You can restore it for 7 days.');
  });
}

/* ---------- code view ---------- */
function highlight(code) {
  return code.replace(/(\/\/.*$)|(`[^`]*`|"(?:\\.|[^"])*"|'(?:\\.|[^'])*')|\b(let|function|if|else|while|for|return|true|false|break|continue)\b|\b(basic|input|music|led|loops|cuteBot|radio|serial|neopixel|strip)\b|\b(0x[0-9a-fA-F]+|\d+(?:\.\d+)?)\b|([^/`"'\w]+|\w+|.)/gm,
    (m, com, str, key, ns, num, other) => com ? `<span class="tk-com">${esc(com)}</span>` : str ? `<span class="tk-str">${esc(str)}</span>` : key ? `<span class="tk-key">${key}</span>` : ns ? `<span class="tk-ns">${ns}</span>` : num ? `<span class="tk-num">${num}</span>` : esc(other));
}
function refreshCode() {
  if ($('codeView').hidden) return;
  $('codeTitle').textContent = proj.active === 'remote' ? 'Remote micro:bit (no extension needed)' : 'Cutebot micro:bit (needs the Cutebot extension)';
  $('code').innerHTML = highlight(L.generate(ws, true));
}

/* ---------- undo / redo, search, tabs ---------- */
function updateUndo() { if (!ws) return; $('btnUndo').disabled = !ws.getUndoStack().length; $('btnRedo').disabled = !ws.getRedoStack().length; }
const KEYWORDS = {
  controls_if: 'if else decision condition', controls_repeat_ext: 'repeat loop times', controls_whileUntil: 'while loop until', controls_for: 'for count loop index',
  controls_flow_statements: 'break continue stop loop', logic_compare: 'compare equal less greater than', logic_operation: 'and or', logic_negate: 'not', logic_boolean: 'true false',
  math_number: 'number', math_arithmetic: 'add plus minus subtract times multiply divide', math_random_int: 'random pick', math_modulo: 'remainder', math_single: 'absolute square root',
  math_round: 'round', math_constrain: 'constrain limit', text: 'text string', text_join: 'join text', text_length: 'length text',
  cb_motors: 'motor wheel speed drive', cb_move_time: 'drive move forward backward turn time', cb_sonar: 'distance ultrasonic sonar obstacle', cb_tracking: 'line follow sensor track',
  cb_track_side: 'line sensor', cb_line_event: 'line event', cb_headlights: 'light led color headlight', cb_headlights_rgb: 'light led color headlight rgb', np_show_color: 'underglow neopixel light',
  cb_ir_on: 'infrared remote ir', cb_ir_button: 'infrared remote ir', mb_pause: 'wait delay sleep', mb_on_button: 'button press', radio_send_number: 'radio send', mb_play_tone: 'sound music note beep'
};
const searchIndex = {};
function indexFor(devId) {
  if (searchIndex[devId]) return searchIndex[devId];
  const w = new Blockly.Workspace(), out = [];
  for (const cat of L.makeToolbox(devId).contents) {
    if (!cat.contents) continue;
    for (const item of cat.contents) {
      if (item.kind !== 'block') continue;
      try { const b = Blockly.serialization.blocks.append({ type: item.type, fields: item.fields, inputs: item.inputs, extraState: item.extraState }, w); out.push({ item, text: [b.toString(), cat.name, KEYWORDS[item.type] || ''].join(' ').toLowerCase() }); } catch (e) {}
    }
  }
  w.dispose();
  return (searchIndex[devId] = out);
}
function doSearch(q) {
  const tb = ws.getToolbox(), fly = tb.getFlyout();
  q = q.trim().toLowerCase();
  if (!q) { fly.hide(); return; }
  const words = q.split(/\s+/), hits = indexFor(proj.active).filter(x => words.every(w => x.text.includes(w))).slice(0, 30);
  tb.clearSelection();
  fly.show(hits.length ? [{ kind: 'label', text: `Blocks matching “${q}”` }, ...hits.map(h => h.item)] : [{ kind: 'label', text: `No blocks match “${q}”. Try another word.` }]);
}
// Remote and IR tabs appear once a program uses them, so beginners see fewer tabs
function updateTabs() {
  if (!ws) return;
  const states = JSON.stringify(proj.programs) + JSON.stringify(Blockly.serialization.workspaces.save(ws));
  const radio = /"type":"radio_/.test(states) || proj.active === 'remote' || hasCode('remote');
  const ir = /"type":"cb_ir_/.test(states);
  document.querySelector('[data-tab="remote"]').hidden = !radio;
  document.querySelector('[data-tab="ir"]').hidden = !ir;
  if ((ui.tab === 'remote' && !radio) || (ui.tab === 'ir' && !ir)) showTab('board');
}

/* ---------- run / stop / reset ---------- */
let codeStale = false, runPrograms = null;
function setRunUI() {
  const b = $('btnRun');
  b.classList.toggle('stop', RT.running);
  b.classList.toggle('stale', RT.running && codeStale);
  b.querySelector('span').textContent = RT.running ? 'Stop' : 'Run';
  b.querySelector('svg').innerHTML = RT.running ? '<rect x="3" y="3" width="10" height="10" rx="1.5" fill="currentColor"/>' : '<path d="M4 2.5v11l9-5.5z" fill="currentColor"/>';
  b.title = RT.running && codeStale ? 'You changed the code. Stop and run again to use it.' : '';
}
/** Simulator code for a saved program, generated the same way the teacher's check will generate it. */
function codesFor(programs) {
  const remoteWs = programs.remote ? L.headless(programs.remote) : null;
  return { robot: L.generate(L.headless(programs.robot), false), remote: remoteWs && L.hasStatementCode(remoteWs) ? L.generate(remoteWs, false) : null };
}
function run() {
  hideError();
  serializeActive();
  runPrograms = JSON.parse(JSON.stringify(proj.programs));
  if (!runPrograms.robot) runPrograms.robot = xmlToState(L.BLANK);
  const codes = codesFor(runPrograms);
  const opts = {};
  if (challenge) {
    resetAll(true);
    crun = L.makeChallengeRun(challenge); crun.start(); L.activeRun = crun; replayOf = null;
    opts.onStep = (dt) => { const r = crun.tick(dt); if (r) finishChallenge(); };
    L.lockRobot = true;
  }
  codeStale = false;
  if (L.runAll(codes, opts)) { lessonFlags.ran = true; lessonFlags.odo0 = bot.odo; }
  renderChallengeStrip(true);
  setRunUI();
}
function resetAll(keepChallenge) {
  L.stopAll();
  Object.values(devices).forEach(d => d.display.fill(0));
  bot.lights = ['#000000', '#000000']; bot.servo = [90, 90]; bot.under = [0, 0];
  L.placeRobot();
  hideError();
  if (challenge && !keepChallenge) { crun = L.makeChallengeRun(challenge); if (challenge.setup) challenge.setup(crun.st); replayOf = null; renderChallengeStrip(true); }
  setRunUI();
}

/* errors: a banner, plus a warning on the block that was running */
let lastError = '', errMarks = [], errBlock = null;
function hideError() {
  $('console').hidden = true;
  for (const id of errMarks) { const b = ws && ws.getBlockById(id); if (b) b.setWarningText(null, 'runtime'); }
  errMarks = []; errBlock = null;
}
function markErrorBlock() {
  if (!errBlock || errBlock.dev !== proj.active) return false;
  const b = ws.getBlockById(errBlock.id); if (!b) return false;
  b.setWarningText(errBlock.msg, 'runtime'); errMarks.push(errBlock.id);
  return true;
}
L.on('error', (dev, msg, blockId) => {
  lastError = `${dev.name}: ${msg}`;
  if (verifying) return;
  hideError();
  errBlock = blockId ? { dev: dev.id, id: blockId, msg } : null;
  const c = $('console'); c.hidden = false;
  c.innerHTML = `<div><b>Your ${esc(dev.name)} program stopped.</b> ${esc(msg)}</div>${errBlock ? '<button class="btn small" id="btnShowErr">Show me the block</button>' : ''}`;
  markErrorBlock();
  if (errBlock) $('btnShowErr').onclick = () => {
    if (errBlock.dev !== proj.active) { const keep = errBlock; showDevice(keep.dev); errBlock = keep; markErrorBlock(); }
    const b = ws.getBlockById(errBlock.id); if (b) { ws.centerOnBlock(errBlock.id); b.select(); }
  };
});
L.on('stop', () => {
  setRunUI(); L.lockRobot = false; L.activeRun = null;
  if (challenge && crun && crun.state === 'running') { crun.state = 'stopped'; }
  renderChallengeStrip(true); clearHighlights();
});
L.on('run', setRunUI);
L.on('locked', () => toast('The robot can’t be moved by hand during a challenge run.'));

/* ---------- map + arena tools ---------- */
function setMap(m, quiet) {
  L.arena.map = m; $('mapSel').value = m; L.buildFloor();
  if (!quiet) resetAll();
  updateArenaButtons();
}
function setTool(t) {
  L.tool = t;
  document.querySelectorAll('#toolSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === t));
  const hints = { move: 'Drag the robot to move it · 1 square = 10 cm', draw: 'Drag to draw black tape on the floor', erase: 'Drag to erase tape', box: 'Click to add a 10 cm box · click a box to remove it' };
  $('arenaHint').textContent = hints[t];
  $('arena').dataset.tool = t;
}
function updateArenaButtons() { $('btnRestore').disabled = !L.mapEdited() || !!challenge; }
function setEditArena(open) {
  ui.editArena = open; $('arenaTools').hidden = !open; $('btnEditArena').setAttribute('aria-pressed', open);
  if (!open) setTool('move');
  writeJSON(UISTORE, ui);
}

/* ---------- boards (robot + remote micro:bits) ---------- */
const ledEls = { robot: [], remote: [] };
function buildBoard(svg, devId) {
  const ns = 'http://www.w3.org/2000/svg';
  const el = (t, a, p = svg) => { const e = document.createElementNS(ns, t); for (const k in a) e.setAttribute(k, a[k]); p.appendChild(e); return e; };
  el('rect', { x: 4, y: 4, width: 232, height: 188, rx: 16, fill: devId === 'remote' ? '#262a33' : '#1c1c1e' });
  for (let i = 0; i < 40; i++) el('rect', { x: 10 + i * 5.6, y: 174, width: 2.6, height: 18, fill: '#b89548' });
  [[10, 34, '0'], [62, 34, '1'], [114, 34, '2'], [166, 30, '3V'], [200, 30, 'GND']].forEach(([x, w, t]) => {
    el('rect', { x, y: 158, width: w, height: 34, rx: 4, fill: '#d3ad55' }); el('circle', { cx: x + w / 2, cy: 168, r: 6, fill: '#1c1c1e' });
    const tx = el('text', { x: x + w / 2, y: 188, 'text-anchor': 'middle', 'font-size': 9, 'font-family': 'Lexend, sans-serif', fill: '#3a2c10', 'font-weight': 600 }); tx.textContent = t;
  });
  el('ellipse', { cx: 120, cy: 22, rx: 13, ry: 8, fill: 'none', stroke: '#b89548', 'stroke-width': 2.4 });
  el('circle', { cx: 114, cy: 22, r: 2.4, fill: '#b89548' }); el('circle', { cx: 126, cy: 22, r: 2.4, fill: '#b89548' });
  for (let i = 0; i < 25; i++) { const x = 84 + (i % 5) * 18, y = 44 + Math.floor(i / 5) * 20; ledEls[devId].push(el('rect', { x: x - 3, y: y - 6, width: 6, height: 12, rx: 1.5, fill: '#3a2a2a' })); }
  const wire = (g, key) => {
    let down = false;
    const press = (d) => { if (down === d) return; down = d; L.input('p', devId, key, d); };
    g.addEventListener('pointerdown', (e) => { e.preventDefault(); press(true); });
    g.addEventListener('pointerup', () => press(false));
    g.addEventListener('pointerleave', () => press(false));
    g.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); press(true); setTimeout(() => press(false), 120); } });
  };
  [[30, 'A'], [210, 'B']].forEach(([cx, key]) => {
    const g = el('g', { class: 'mbtn', role: 'button', tabindex: 0, 'aria-label': 'Button ' + key });
    el('rect', { x: cx - 18, y: 70, width: 36, height: 36, rx: 6, fill: '#8a8f96' }, g);
    el('circle', { class: 'cap', cx, cy: 88, r: 12, fill: '#262626' }, g);
    const t = el('text', { x: cx, y: 126, 'text-anchor': 'middle', 'font-size': 14, 'font-family': 'Lexend, sans-serif', fill: '#e9efea', 'font-weight': 600 }, g); t.textContent = key;
    wire(g, key);
  });
  const g = el('g', { class: 'mbtn', role: 'button', tabindex: 0, 'aria-label': 'Buttons A and B together' });
  el('rect', { x: 196, y: 10, width: 34, height: 20, rx: 10, fill: '#3b3f44' }, g);
  const t = el('text', { x: 213, y: 24, 'text-anchor': 'middle', 'font-size': 10, 'font-family': 'Lexend, sans-serif', fill: '#e9efea', 'font-weight': 600 }, g); t.textContent = 'A+B';
  wire(g, 'AB');
}
function drawBoards() {
  for (const id of ['robot', 'remote']) {
    const d = devices[id].display, els = ledEls[id];
    for (let i = 0; i < 25; i++) {
      const v = d[i] / 255;
      els[i].setAttribute('fill', v > 0 ? `rgb(${Math.round(90 + 165 * v)},${Math.round(30 + 30 * v)},${Math.round(30 + 20 * v)})` : '#3a2a2a');
      els[i].style.filter = v > .5 ? 'drop-shadow(0 0 3px rgba(255,60,40,.9))' : '';
    }
  }
}

/* ---------- readout chips ---------- */
function drawReadout() {
  const bump = bot.clock - bot.bumpT < 400;
  const hd = Math.round(((bot.a * 180 / Math.PI) % 360 + 360) % 360);
  let h = `<span class="chip">Sonar <b>${Math.floor(bot.sonar)} cm</b></span>` +
    `<span class="chip">Line sensors L <span class="dot ${bot.lineL === 0 ? 'on' : ''}"></span> R <span class="dot ${bot.lineR === 0 ? 'on' : ''}"></span></span>` +
    `<span class="chip">Wheels <b>${Math.round(bot.cmdL)}%</b> / <b>${Math.round(bot.cmdR)}%</b></span>` +
    `<span class="chip">Heading <b>${hd}°</b></span>`;
  if (L.real.active && RT.running) h += `<span class="chip real">Motor strength L <b>${Math.round(L.real.gainL * 100)}%</b> R <b>${Math.round(L.real.gainR * 100)}%</b></span>`;
  if (bump) h += `<span class="chip bump">Bump!</span>`;
  $('readout').innerHTML = h;
}

/* ---------- block highlighting ---------- */
const lit = new Set();
function clearHighlights() { if (!ws) return; for (const id of lit) if (ws.getBlockById(id)) ws.highlightBlock(id, false); lit.clear(); }
function syncHighlights(now) {
  if (!ui.highlight || !RT.running || RT.fast || replayOf || !$('codeView').hidden) { if (lit.size) clearHighlights(); return; }
  const win = 140 / Math.min(1, RT.speed);
  const want = new Set();
  for (const [id, t] of RT.hits) { if (now - t < win) want.add(id); else if (now - t > 5000) RT.hits.delete(id); }
  for (const id of lit) if (!want.has(id)) { if (ws.getBlockById(id)) ws.highlightBlock(id, false); lit.delete(id); }
  for (const id of want) if (!lit.has(id) && ws.getBlockById(id)) { ws.highlightBlock(id, true); lit.add(id); }
}

/* ---------- data panel ---------- */
const SERIES_COLORS = ['#2f6cf6', '#e0592a', '#0b8f2f', '#a845d6', '#c9a000', '#0aa3a3', '#d6336c', '#6b7280'];
const data = { series: new Map(), log: [], sensors: { sonar: true, lineL: false, lineR: false, wheels: false, heading: false }, lastSample: -1 };
const simT = () => L.simNow() / 1000;
function addPoint(name, v) {
  let s = data.series.get(name);
  if (!s) { s = { color: SERIES_COLORS[data.series.size % SERIES_COLORS.length], pts: [] }; data.series.set(name, s); }
  s.pts.push([simT(), v]); if (s.pts.length > 4000) s.pts.splice(0, 1000);
}
let logDirty = false;
function addLog(line) { data.log.push(line); if (data.log.length > 300) data.log.shift(); logDirty = true; }
L.on('serial', (dev, line) => { if (verifying) return; addLog((dev.id === 'remote' ? 'remote: ' : '') + line); lessonFlags.serial = true; });
L.on('serialValue', (dev, name, v) => { if (!verifying) addPoint((dev.id === 'remote' ? 'remote.' : '') + name, v); });
L.on('radio', (dev) => { if (dev.id === 'remote' && !verifying) lessonFlags.radio = true; });
L.on('run', () => { if (verifying) return; data.series.clear(); data.log = []; logDirty = true; data.lastSample = -1; });
function sampleSensors() {
  if (!RT.running || verifying) return;
  const t = simT(); if (t - data.lastSample < 0.1) return; data.lastSample = t;
  const s = data.sensors;
  if (s.sonar) addPoint('sonar (cm)', Math.floor(bot.sonar));
  if (s.lineL) addPoint('left line sensor', bot.lineL);
  if (s.lineR) addPoint('right line sensor', bot.lineR);
  if (s.wheels) { addPoint('left wheel %', bot.cmdL); addPoint('right wheel %', bot.cmdR); }
  if (s.heading) addPoint('heading (°)', Math.round(((bot.a * 180 / Math.PI) % 360 + 360) % 360));
}
function drawChart() {
  const cv = $('chart'); if (!cv || $('tab-data').hidden) return;
  const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
  const ink = L.cssVar('--muted'), grid = L.cssVar('--line');
  const now = simT(), span = 20, t0 = Math.max(0, now - span);
  let lo = Infinity, hi = -Infinity;
  for (const s of data.series.values()) for (const [t, v] of s.pts) if (t >= t0) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const padL = 40, padR = 10, padT = 8, padB = 20, pw = w - padL - padR, ph = h - padT - padB;
  c.font = '11px Lexend, system-ui, sans-serif'; c.fillStyle = ink; c.strokeStyle = grid; c.lineWidth = 1;
  if (!isFinite(lo)) { c.textAlign = 'center'; c.fillText(RT.running ? 'Waiting for data…' : 'Press Run to start recording', w / 2, h / 2); legend(); return; }
  if (hi - lo < 1) { hi += .5; lo -= .5; }
  const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
  const stepv = niceStep((hi - lo) / 4);
  c.textAlign = 'right';
  for (let v = Math.ceil(lo / stepv) * stepv; v <= hi; v += stepv) {
    const y = padT + ph - (v - lo) / (hi - lo) * ph;
    c.beginPath(); c.moveTo(padL, y + .5); c.lineTo(w - padR, y + .5); c.stroke();
    c.fillText(+v.toFixed(2), padL - 6, y + 4);
  }
  c.textAlign = 'center';
  for (let s = Math.ceil(t0 / 5) * 5; s <= t0 + span; s += 5) { const x = padL + (s - t0) / span * pw; c.fillText(s + ' s', x, h - 5); }
  for (const s of data.series.values()) {
    c.strokeStyle = s.color; c.lineWidth = 1.8; c.beginPath(); let started = false, last = null;
    for (const [t, v] of s.pts) { if (t < t0) continue; const x = padL + (t - t0) / span * pw, y = padT + ph - (v - lo) / (hi - lo) * ph; started ? c.lineTo(x, y) : c.moveTo(x, y); started = true; last = [x, y]; }
    c.stroke();
    if (last) { c.fillStyle = s.color; c.beginPath(); c.arc(last[0], last[1], 3, 0, 7); c.fill(); }
  }
  legend();
}
function niceStep(x) { const p = Math.pow(10, Math.floor(Math.log10(x))), m = x / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }
let legendKey = '';
function legend() {
  const parts = [...data.series.entries()].map(([n, s]) => { const last = s.pts[s.pts.length - 1]; return `<span><i style="background:${s.color}"></i>${esc(n)} <b>${last ? +last[1].toFixed(2) : ''}</b></span>`; });
  const k = parts.join('');
  if (k !== legendKey) { $('legend').innerHTML = k || '<span class="note">Readings appear here. Tick a sensor or use the Serial blocks.</span>'; legendKey = k; }
}
function dataCSV() {
  const rows = ['time_s,series,value'];
  for (const [n, s] of data.series) for (const [t, v] of s.pts) rows.push(`${t.toFixed(3)},"${n.replace(/"/g, '""')}",${v}`);
  return rows.join('\n') + '\n';
}

/* ---------- challenges + proofs ---------- */
let challenge = null, crun = null, replayOf = null, verifying = false;
// proofs[challengeId] = the best passing run: programs, seed, inputs, time. A teacher's copy replays it to confirm.
const proofs = readJSON(PROOFS, {});
const turned = readJSON(TURNED, {});      // challengeId -> the proof time-stamp that was last turned in
const notTurnedIn = () => Object.values(proofs).filter(p => !turned[p.c] || turned[p.c] < p.at);
function updateTurnBadge() {
  const n = notTurnedIn().length, b = $('turnBadge');
  b.hidden = !n; b.textContent = n;
  $('btnTurnIn').title = n ? `${n} challenge proof${n === 1 ? '' : 's'} not turned in yet` : 'Turn in your work';
}
function roundRectPath(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function tag(c, x, y, text, color = 'rgba(11,110,40,.92)') {
  c.save(); c.font = '600 2.4px Lexend, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = c.measureText(text).width + 2.4, h = 3.6;
  x = Math.max(w / 2 + .5, Math.min(L.W - w / 2 - .5, x)); y = Math.max(h / 2 + .5, Math.min(L.H - h / 2 - .5, y));
  c.fillStyle = color; roundRectPath(c, x - w / 2, y - h / 2, w, h, 1.4); c.fill();
  c.fillStyle = '#fff'; c.fillText(text, x, y + .1); c.restore();
}
L.drawOverlay = (c, s) => {
  if (!challenge || !crun) return;
  if (challenge.draw) challenge.draw(c, s, crun.st);
  const marks = typeof challenge.marks === 'function' ? challenge.marks(crun.st) : challenge.marks;
  if (marks && crun.state !== 'running') marks.forEach(([x, y, t]) => tag(c, x, y, t));
  if (crun.state === 'fail' && crun.failAt) {          // show where the attempt went wrong
    const { x, y } = crun.failAt;
    c.save(); c.strokeStyle = '#d33a12'; c.lineWidth = .7; c.lineCap = 'round';
    c.beginPath(); c.arc(x, y, 3.2, 0, 7); c.stroke();
    c.beginPath(); c.moveTo(x - 1.6, y - 1.6); c.lineTo(x + 1.6, y + 1.6); c.moveTo(x + 1.6, y - 1.6); c.lineTo(x - 1.6, y + 1.6); c.stroke(); c.restore();
    tag(c, x, y - 6, 'Went wrong here', 'rgba(190,45,10,.95)');
  }
};
const hintsShown = {};      // challenge id -> how many hints the student has opened
function enterArena(ch) {
  L.pristine = true; L.startOverride = ch.start || null;
  setMap(ch.map, true);
  L.stopAll();
  Object.values(devices).forEach(d => d.display.fill(0));
  bot.lights = ['#000000', '#000000']; bot.servo = [90, 90]; bot.under = [0, 0];
  L.placeRobot();
}
function armChallenge(id) {
  const ch = L.CHALLENGES.find(c => c.id === id); if (!ch) return;
  challenge = ch; crun = L.makeChallengeRun(ch); replayOf = null;
  setTool('move'); document.querySelectorAll('#toolSeg button').forEach(b => b.disabled = b.dataset.tool !== 'move'); $('btnSetStart').disabled = true;
  enterArena(ch); hideError();
  if (ch.setup) ch.setup(crun.st);
  renderChallengeStrip(true); renderChallengeList(); updateArenaButtons();
}
function exitChallenge(quiet) {
  if (!challenge) return;
  L.stopAll();
  challenge = null; crun = null; replayOf = null; L.pristine = false; L.startOverride = null; L.activeRun = null;
  document.querySelectorAll('#toolSeg button').forEach(b => b.disabled = false); $('btnSetStart').disabled = false;
  $('challengeStrip').hidden = true; $('goalCard').hidden = true;
  L.buildFloor(); if (!quiet) resetAll();
  renderChallengeList(); updateArenaButtons();
}
function finishChallenge() {
  const ch = challenge, r = crun, S = L.sched;
  let celebrate = null;
  if (r.state === 'pass' && !replayOf) {
    const t = +r.t.toFixed(2);
    const proof = { c: ch.id, t, steps: r.n, seed: S.seed, real: L.real.active, init: S.init, inputs: S.record.slice(), programs: runPrograms, at: Date.now(), v: L.VERSION };
    const old = proofs[ch.id];
    const better = !old || t < old.t || (t === old.t && proof.real && !old.real);
    if (better) { proofs[ch.id] = proof; writeJSON(PROOFS, proofs); }
    r.msg = better ? (old ? 'New best time! Proof saved.' : 'Proof saved.') : `Your best is ${old.t} s.`;
    lessonFlags.passed.add(ch.id);
    celebrate = { ch, t, better, best: better ? t : old.t, real: L.real.active };
  }
  if (replayOf) r.msg = r.state === 'pass' ? `Replay confirmed: passed in ${r.t.toFixed(2)} s.` : `Replay did not pass: ${r.msg}`;
  L.stopAll();
  renderChallengeStrip(true); renderChallengeList(); updateTurnBadge();
  lessonCheckSoon();
  if (celebrate) setTimeout(() => showPassed(celebrate), 350);
}
function showPassed({ ch, t, better, best, real }) {
  const next = L.CHALLENGES.find(c => !proofs[c.id] && c.id !== ch.id);
  const actions = [['Stay here', () => {}]];
  if (next) actions.push([`Next: ${next.title}`, () => armChallenge(next.id)]);
  actions.push(['Turn in now', () => { openTurnIn(); return false; }, true]);
  modal('Challenge passed!', `<div class="passed"><div class="passed-big" aria-hidden="true">✓</div><div><b>${esc(ch.title)}</b> in <b>${t} s</b>${real ? ' in real-world mode' : ''}.<br>
    ${better ? 'Your proof is saved in this browser.' : `Your best time is still ${best} s.`} Turn in your work so your teacher can check it.</div></div>`, actions);
}
let stripKey = '';
function renderChallengeStrip(force) {
  const el = $('challengeStrip'), card = $('goalCard');
  if (!challenge || !crun) { el.hidden = true; card.hidden = true; return; }
  el.hidden = false;
  const ch = challenge, s = crun.state;
  const badge = s === 'pass' ? '<span class="badge pass">Passed</span>' : s === 'fail' ? '<span class="badge fail">Not yet</span>' : s === 'running' ? '<span class="badge run">Running</span>' : s === 'stopped' ? '<span class="badge">Stopped</span>' : '<span class="badge">Ready</span>';
  const prog = ch.progress ? ch.progress(crun.st) : '';
  const nh = hintsShown[ch.id] || 0, hints = ch.hints || [];
  const key = [s, crun.t.toFixed(1), prog, crun.msg, !!replayOf, nh].join('|');
  if (key === stripKey && !force) return; stripKey = key;
  el.innerHTML = `<div class="cs-top"><b>${replayOf ? 'Replay: ' + esc(replayOf) + ' · ' : ''}${esc(ch.title)}</b>${badge}${L.real.active ? '<span class="badge run">Real-world</span>' : ''}<span class="cs-time">${crun.t.toFixed(1)} s / ${ch.limit} s</span><button class="btn small" id="btnExitCh">${replayOf ? 'Close replay' : 'Exit challenge'}</button></div>
    <div class="cs-prog">${esc(prog)}${crun.msg ? ' · <b>' + esc(crun.msg) + '</b>' : ''}${!replayOf && (s === 'fail' || s === 'stopped') ? ' Press Run to try again.' : ''}</div>
    ${!replayOf && hints.length && s !== 'running' ? `<div class="cs-hints">${hints.slice(0, nh).map((h, i) => `<p><b>Hint ${i + 1}:</b> ${esc(h)}</p>`).join('')}${nh < hints.length ? `<button class="btn small" id="btnHint">${nh ? 'Another hint' : 'Need a hint?'}</button>` : ''}</div>` : ''}`;
  $('btnExitCh').onclick = () => { const back = !!replayOf; exitChallenge(); if (back) openTeacher(); };
  if ($('btnHint')) $('btnHint').onclick = () => { hintsShown[ch.id] = nh + 1; renderChallengeStrip(true); };
  // the goal sits on the arena until the run starts
  const showCard = !replayOf && s !== 'running' && s !== 'pass';
  card.hidden = !showCard;
  if (showCard) card.innerHTML = `<span class="sec-label">Goal</span><b>${esc(ch.goal)}</b><span class="gc-hint">${s === 'ready' ? 'Write your program, then press Run.' : 'Change your program and press Run to try again.'}</span>`;
}
function renderChallengeList() {
  $('chList').innerHTML = L.CHALLENGES.map(ch => {
    const p = proofs[ch.id];
    return `<li class="ch-row${challenge && challenge.id === ch.id ? ' active' : ''}"><div><b>${esc(ch.title)}</b>${ch.level ? `<span class="lvl lvl-${ch.level.toLowerCase()}">${esc(ch.level)}</span>` : ''}<span class="ch-map">${esc(L.MAPS[ch.map].name)}</span><p>${esc(ch.goal)}</p></div>
      <div class="ch-side">${p ? `<span class="badge pass">Best ${p.t} s${p.real ? ' · real-world' : ''}</span>` : '<span class="badge">Not passed</span>'}<button class="btn small" data-ch="${ch.id}">${challenge && challenge.id === ch.id ? 'Restart' : 'Start'}</button></div></li>`;
  }).join('');
  $('chList').querySelectorAll('button[data-ch]').forEach(b => b.onclick = () => armChallenge(b.dataset.ch));
  const pend = notTurnedIn().length;
  $('chCount').textContent = `${Object.keys(proofs).length} of ${L.CHALLENGES.length} challenges passed.${pend ? ` ${pend} not turned in yet.` : ''}`;
}

/* ---------- checking a proof (teacher) ---------- */
/** Replays a proof from scratch. fast = no waiting; otherwise it plays in the arena for watching. */
async function verifyProof(proof, { fast = true, who = '' } = {}) {
  const ch = L.CHALLENGES.find(c => c.id === proof.c);
  if (!ch) return { status: 'fail', msg: 'Unknown challenge.' };
  let codes;
  try { codes = codesFor(proof.programs || {}); } catch (e) { return { status: 'fail', msg: 'The program in this file could not be read.' }; }
  exitChallenge(true);
  challenge = ch; enterArena(ch);
  crun = L.makeChallengeRun(ch); crun.start(); L.activeRun = crun; replayOf = fast ? null : (who || 'student');
  verifying = fast; lastError = '';
  L.lockRobot = true;
  const started = L.runAll(codes, { seed: proof.seed, real: !!proof.real, init: proof.init, replay: proof.inputs || [], fast, onStep: (dt) => { if (crun.tick(dt)) { if (fast) L.stopAll(); else finishChallenge(); } } });
  if (!started) { verifying = false; return { status: 'fail', msg: lastError || 'The program could not start.' }; }
  if (!fast) { renderChallengeStrip(true); return null; }
  await L.whenStopped();
  verifying = false;
  const r = crun, out = r.state === 'pass'
    ? (r.n === proof.steps && Math.abs(r.t - proof.t) < 0.006
      ? { status: 'ok', t: +r.t.toFixed(2), msg: '' }
      : { status: 'differs', t: +r.t.toFixed(2), msg: `The replay passed in ${r.t.toFixed(2)} s, but the file says ${esc(proof.t)} s. The file may have been edited.` })
    : { status: 'fail', msg: r.state === 'fail' ? r.msg : (lastError || 'The replay did not finish the challenge.') };
  if (proof.v !== L.VERSION) out.msg = (out.msg ? out.msg + ' ' : '') + `Made with version ${esc(proof.v || '?')}; this page is version ${L.VERSION}.`;
  challenge = null; crun = null; L.pristine = false; L.startOverride = null; L.activeRun = null;
  return out;
}

/* ---------- turn in (student) ---------- */
function openTurnIn() {
  const st = readJSON(STUDENT, { name: '', period: '' });
  const list = L.CHALLENGES.map(ch => {
    const p = proofs[ch.id], fresh = p && (!turned[p.c] || turned[p.c] < p.at);
    return `<li><label class="ti-row"><input type="checkbox" value="${ch.id}" ${p ? 'checked' : 'disabled'}><span><b>${esc(ch.title)}</b>${p ? ` · ${p.t} s${p.real ? ' · real-world mode' : ''}` : ' · not passed yet'}</span>${fresh ? '<span class="badge run">New</span>' : p ? '<span class="badge">Turned in before</span>' : ''}</label></li>`;
  }).join('');
  modal('Turn in your work', `
    <div class="ti-form"><label for="tiName">Your name <input type="text" id="tiName" maxlength="60" autocomplete="name" value="${esc(st.name)}" placeholder="First and last name"></label>
    <label for="tiPeriod">Class or period <input type="text" id="tiPeriod" maxlength="30" value="${esc(st.period)}" placeholder="e.g. 3rd hour"></label></div>
    <p class="note big" style="padding:0">Your file includes your project “<b>${esc($('projName').value)}</b>” (both micro:bit programs) and proof for each challenge you tick. Your teacher’s copy of Cutebot Code Lab replays each proof to check it.</p>
    <ul class="ti-list">${list}</ul>
    <p class="note">Hand in the file the way your teacher asks, for example by uploading it to Google Classroom.</p>`,
    [['Copy as text', async () => { const t = turnInText(); if (t && await copyText(t)) markTurnedIn(); return false; }],
     ['Download turn-in file', async () => { const t = turnInText(); if (!t) return false; if (await saveFile(`${safeName($('tiName').value)} - ${safeName($('projName').value)}.cutebot.json`, t)) { markTurnedIn(); toast('Saved. Now hand in the file to your teacher.'); } return false; }, true]]);
}
let lastTurnIn = [];
function turnInText() {
  const name = $('tiName').value.trim(), period = $('tiPeriod').value.trim();
  if (!name) { toast('Type your name first.'); $('tiName').focus(); return null; }
  writeJSON(STUDENT, { name, period });
  const chosen = [...document.querySelectorAll('.ti-list input:checked')].map(i => proofs[i.value]).filter(Boolean);
  lastTurnIn = chosen;
  return JSON.stringify({ app: 'cutebot-code-lab', kind: 'turn-in', version: L.VERSION, student: { name, period }, at: Date.now(), project: projectData(), proofs: chosen });
}
function markTurnedIn() { for (const p of lastTurnIn) turned[p.c] = p.at; writeJSON(TURNED, turned); updateTurnBadge(); renderChallengeList(); }

/* ---------- teacher panel ---------- */
const subs = [];     // { id, file, data, results: { [challengeId]: {status,t,msg} }, hash }
let checking = false;
function hashStr(s) { let h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909); return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36); }
function codeHash(programs) {
  try { const r = L.generate(L.headless(programs.robot), true), rm = programs.remote ? L.generate(L.headless(programs.remote), true) : ''; return hashStr(r + '\n//remote\n' + rm); } catch (e) { return null; }
}
function openTeacher() { $('teacher').hidden = false; renderTeacher(); }
function closeTeacher() { $('teacher').hidden = true; }
async function addFiles(files) {
  let added = 0;
  for (const f of files) {
    if (f.size > 8e6) { toast(`${f.name} is too big to be a turn-in file.`); continue; }
    let d; try { d = JSON.parse(await f.text()); } catch (e) { toast(`${f.name} is not a turn-in file.`); continue; }
    if (!d || d.kind !== 'turn-in' || !d.project || !Array.isArray(d.proofs)) { toast(`${f.name} is not a Cutebot Code Lab turn-in file.`); continue; }
    const sub = { id: 's' + Math.random().toString(36).slice(2), file: f.name, data: d, results: {}, hash: codeHash(d.project.programs || {}) };
    for (const p of d.proofs) if (p && p.c) { sub.results[p.c] = { status: 'pending' }; p.hash = codeHash(p.programs || {}); }
    subs.push(sub); added++;
  }
  renderTeacher();
  if (added) checkAll();
}
async function checkAll() {
  if (checking) return; checking = true;
  const prevMap = challenge ? 'track' : L.arena.map;
  try {
    const todo = subs.flatMap(s => s.data.proofs.filter(p => p && s.results[p.c] && s.results[p.c].status === 'pending').map(p => [s, p]));
    let i = 0;
    for (const [s, p] of todo) {
      i++; $('tProgress').textContent = `Checking ${i} of ${todo.length}: ${s.data.student?.name || s.file} · ${(L.CHALLENGES.find(c => c.id === p.c) || {}).title || p.c}…`;
      s.results[p.c] = await verifyProof(p);
      renderTeacher();
    }
    $('tProgress').textContent = todo.length ? `Checked ${todo.length} proof${todo.length === 1 ? '' : 's'}.` : '';
  } finally {
    checking = false;
    setMap(prevMap, true); resetAll(); renderChallengeList();
  }
}
function dupMap() {
  const by = new Map(), shown = new Map();
  const key = (s) => { const n = (s.data.student && s.data.student.name || s.file).trim(); shown.set(n.toLowerCase(), n); return n.toLowerCase(); };
  for (const s of subs) {
    const who = key(s);
    for (const h of new Set([s.hash, ...s.data.proofs.map(p => p && p.hash)].filter(Boolean))) { if (!by.has(h)) by.set(h, new Set()); by.get(h).add(who); }
  }
  const out = new Map();
  for (const s of subs) {
    const who = key(s), others = new Set();
    for (const h of [s.hash, ...s.data.proofs.map(p => p && p.hash)]) if (h && by.get(h)) for (const o of by.get(h)) if (o !== who) others.add(shown.get(o));
    if (others.size) out.set(s.id, [...others]);
  }
  return out;
}
const CELL = { ok: ['ok', '✓'], differs: ['warn', '!'], fail: ['bad', '✗'], pending: ['pend', '…'] };
function renderTeacher() {
  const body = $('tBody'); if (!body) return;
  if (!subs.length) { body.innerHTML = `<p class="note big">Add the turn-in files your students sent you. You can select many at once or drag them onto this panel. Each proof is replayed from scratch with the student’s own program, so a time only shows as checked if that program really passes.</p>`; return; }
  const dups = dupMap();
  const head = `<tr><th>Student</th><th>Class</th><th>Project</th><th>Turned in</th>${L.CHALLENGES.map(c => `<th title="${esc(c.goal)}">${esc(c.title)}</th>`).join('')}<th></th></tr>`;
  const rows = subs.map(s => {
    const d = s.data, st = d.student || {};
    const cells = L.CHALLENGES.map(c => {
      const r = s.results[c.id]; if (!r) return '<td class="tc none">–</td>';
      const p = d.proofs.find(x => x && x.c === c.id), [cls, mark] = CELL[r.status] || CELL.fail;
      const label = r.status === 'ok' || r.status === 'differs' ? `${r.t} s` : r.status === 'pending' ? '' : 'failed';
      return `<td class="tc"><button class="tcell ${cls}" data-sub="${s.id}" data-c="${c.id}" title="${esc(r.msg || (r.status === 'ok' ? 'Checked: the replay passed with the same time.' : ''))}">${mark} ${esc(label)}${p && p.real ? ' <small>real</small>' : ''}</button></td>`;
    }).join('');
    const dup = dups.get(s.id);
    return `<tr><td><b>${esc(st.name || '(no name)')}</b>${dup ? `<div class="dupe" title="Identical code">Same code as ${esc(dup.join(', '))}</div>` : ''}</td><td>${esc(st.period || '')}</td><td>${esc(d.project.name || '')}</td>
      <td class="when">${d.at ? esc(new Date(d.at).toLocaleString()) : ''}</td>${cells}
      <td class="tact"><button class="btn small" data-code="${s.id}">View code</button><button class="btn small" data-open="${s.id}">Open project</button><button class="btn small" data-rm="${s.id}" aria-label="Remove ${esc(st.name || s.file)}">Remove</button></td></tr>`;
  }).join('');
  body.innerHTML = `<div class="ttable-wrap"><table class="ttable"><thead>${head}</thead><tbody>${rows}</tbody></table></div>
    <p class="note">✓ checked: the replay passed in the same time · ! passed, but the time differs · ✗ the replay did not pass · <i>real</i> = passed in real-world mode. Click a result to watch the replay.</p>`;
  body.querySelectorAll('.tcell').forEach(b => b.onclick = () => openProofDetail(b.dataset.sub, b.dataset.c));
  body.querySelectorAll('[data-code]').forEach(b => b.onclick = () => showSubCode(subs.find(s => s.id === b.dataset.code)));
  body.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openSubProject(subs.find(s => s.id === b.dataset.open)));
  body.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { const i = subs.findIndex(s => s.id === b.dataset.rm); if (i >= 0) subs.splice(i, 1); renderTeacher(); });
}
function codeBlocks(programs) {
  const out = [];
  try { out.push(['Cutebot micro:bit', L.generate(L.headless(programs.robot), true)]); } catch (e) { out.push(['Cutebot micro:bit', '// could not read this program']); }
  if (programs.remote) { try { const w = L.headless(programs.remote); if (L.hasStatementCode(w)) out.push(['Remote micro:bit', L.generate(w, true)]); } catch (e) {} }
  return out.map(([t, c]) => `<div class="code-head"><b>${t}</b></div><pre class="mini-code">${highlight(c)}</pre>`).join('');
}
function showSubCode(s) {
  if (!s) return;
  modal(`${s.data.student?.name || s.file}: “${s.data.project.name || 'project'}”`, codeBlocks(s.data.project.programs || {}), [['Close', () => {}]], true);
}
function openProofDetail(subId, cid) {
  const s = subs.find(x => x.id === subId); if (!s) return;
  const p = s.data.proofs.find(x => x && x.c === cid), r = s.results[cid], ch = L.CHALLENGES.find(c => c.id === cid);
  if (!p || !ch) return;
  const status = r.status === 'ok' ? `<span class="badge pass">Checked · ${r.t} s</span>` : r.status === 'differs' ? `<span class="badge run">Passed in ${r.t} s</span>` : r.status === 'pending' ? '<span class="badge">Checking…</span>' : '<span class="badge fail">Did not pass</span>';
  modal(`${s.data.student?.name || s.file}: ${ch.title}`, `<p>${status} ${p.real ? '<span class="badge run">Real-world mode</span>' : ''}</p>
    <p class="note big" style="padding:0">Time in the file: <b>${esc(p.t)} s</b> · Recorded ${p.at ? esc(new Date(p.at).toLocaleString()) : ''} · ${p.inputs ? p.inputs.length : 0} button presses during the run.${r.msg ? '<br>' + esc(r.msg) : ''}</p>
    <span class="sec-label">Program used for this run</span>${codeBlocks(p.programs || {})}`,
    [['Close', () => {}], ['Watch the replay', () => { closeTeacher(); verifyProof(p, { fast: false, who: s.data.student?.name || s.file }); }, true]], true);
}
function openSubProject(s) {
  if (!s) return;
  closeTeacher();
  startNewProject({ ...JSON.parse(JSON.stringify(s.data.project)), name: `${s.data.student?.name || 'Student'} – ${s.data.project.name || 'project'}` });
  toast(`Opened ${s.data.student?.name || 'the student'}’s project as a new project. Your own projects are in My projects.`);
}
function resultsCSV() {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['Student', 'Class', 'Project', 'Turned in', ...L.CHALLENGES.map(c => c.title), 'Same code as'].map(q).join(',')];
  const dups = dupMap();
  for (const s of subs) {
    const d = s.data;
    rows.push([d.student?.name, d.student?.period, d.project.name, d.at ? new Date(d.at).toISOString() : '',
      ...L.CHALLENGES.map(c => { const r = s.results[c.id]; if (!r) return ''; return r.status === 'ok' ? `checked ${r.t} s` : r.status === 'differs' ? `passed ${r.t} s (time differs)` : r.status === 'pending' ? 'not checked yet' : 'did not pass'; }),
      (dups.get(s.id) || []).join('; ')].map(q).join(','));
  }
  return rows.join('\n') + '\n';
}

/* ---------- my progress ---------- */
function openProgress() {
  const lessonRows = L.LESSONS.map(ls => {
    const st = lessonState[ls.id], done = st && st.done ? st.done.length : 0, all = ls.steps.length;
    const status = done >= all ? '<span class="badge pass">Finished</span>' : done ? `<span class="badge run">${done} of ${all} steps</span>` : '<span class="badge">Not started</span>';
    return `<li class="pg-row"><span class="pg-name"><b>${esc(ls.title)}</b><span class="note">${esc(ls.level)}</span></span>${status}<span class="pg-bar"><i style="width:${Math.round(done / all * 100)}%"></i></span></li>`;
  }).join('');
  const chRows = L.CHALLENGES.map(ch => {
    const p = proofs[ch.id], turnedIn = p && turned[p.c] >= p.at;
    const status = !p ? '<span class="badge">Not passed</span>' : `<span class="badge pass">Passed · ${p.t} s${p.real ? ' · real-world' : ''}</span>${turnedIn ? '<span class="badge">Turned in</span>' : '<span class="badge run">Not turned in</span>'}`;
    return `<li class="pg-row"><span class="pg-name"><b>${esc(ch.title)}</b><span class="note">${esc(ch.level || '')}</span></span><span class="pg-badges">${status}</span></li>`;
  }).join('');
  const nextLesson = L.LESSONS.find(ls => { const st = lessonState[ls.id]; return !st || !st.done || st.done.length < ls.steps.length; });
  const nextCh = L.CHALLENGES.find(ch => !proofs[ch.id]);
  const pend = notTurnedIn().length;
  const tip = pend ? `You have ${pend} passed challenge${pend === 1 ? '' : 's'} that ${pend === 1 ? 'is' : 'are'} not turned in yet.`
    : nextCh ? `Try the “${nextCh.title}” challenge next.` : nextLesson ? `Try the “${nextLesson.title}” lesson next.` : 'You have finished every lesson and challenge. Try them in real-world mode!';
  const passedCount = Object.keys(proofs).length, lessonsDone = L.LESSONS.filter(ls => { const st = lessonState[ls.id]; return st && st.done && st.done.length >= ls.steps.length; }).length;
  const actions = [['Close', () => {}]];
  if (pend) actions.push(['Turn in now', () => { openTurnIn(); return false; }, true]);
  else if (nextCh) actions.push([`Start “${nextCh.title}”`, () => { armChallenge(nextCh.id); showTab('challenges'); }, true]);
  else if (nextLesson) actions.push([`Start “${nextLesson.title}”`, () => { setLessons(true); startLesson(nextLesson.id); }, true]);
  modal('My progress', `<div class="pg-sum"><div><b>${lessonsDone}</b> of ${L.LESSONS.length}<span>lessons finished</span></div><div><b>${passedCount}</b> of ${L.CHALLENGES.length}<span>challenges passed</span></div><div><b>${pend}</b><span>not turned in</span></div></div>
    <p class="pg-tip"><b>Next:</b> ${esc(tip)}</p>
    <div class="pg-cols"><section><span class="sec-label">Lessons</span><ul class="pg-list">${lessonRows}</ul></section><section><span class="sec-label">Challenges</span><ul class="pg-list">${chRows}</ul></section></div>
    <p class="note">Progress is saved in this browser.</p>`, actions, true);
}

/* ---------- first-visit tour ---------- */
const TOUR = 'cutebot-lab-tour';
const TOUR_STEPS = [
  { el: '.blocklyToolboxDiv', title: 'Blocks', text: 'Open a category and drag blocks into your program. Use the search box above to find a block by name.' },
  { el: '#blockly', title: 'Your program', text: 'Blocks inside “on start” run once. Blocks inside “forever” repeat. Drag blocks to the trash can to delete them.' },
  { el: '#btnRun', title: 'Run', text: 'Press Run (or the space bar) to try your program on the virtual Cutebot. Press it again to stop.' },
  { el: '.arena-wrap', title: 'The arena', text: 'Watch the robot drive here. Drag it to move it, and choose other arenas from the list above.' },
  { el: '#btnLessons', title: 'Lessons', text: 'New to this? Start with a lesson. It walks you through step by step.' },
  { el: '#simTabs [data-tab="challenges"]', title: 'Challenges and turning in', text: 'Pass challenges, then press Turn in to send your work to your teacher.' }
];
let tourStep = -1;
function startTour() { closeModal(); tourStep = 0; renderTour(); }
function endTour() { tourStep = -1; $('tour').hidden = true; writeJSON(TOUR, 1); }
function renderTour() {
  const step = TOUR_STEPS[tourStep], target = document.querySelector(step.el);
  if (!target || !target.getClientRects().length) { if (tourStep < TOUR_STEPS.length - 1) { tourStep++; return renderTour(); } return endTour(); }
  target.scrollIntoView({ block: 'nearest' });
  const r = target.getBoundingClientRect(), pad = 6, vw = innerWidth, vh = innerHeight;
  const spot = $('tourSpot'), box = $('tourBox');
  $('tour').hidden = false;
  Object.assign(spot.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: Math.min(r.height, vh) + pad * 2 + 'px' });
  $('tourText').innerHTML = `<span class="sec-label">${tourStep + 1} of ${TOUR_STEPS.length}</span><b>${esc(step.title)}</b><p>${esc(step.text)}</p>`;
  $('tourNext').textContent = tourStep === TOUR_STEPS.length - 1 ? 'Done' : 'Next';
  const bw = Math.min(320, vw - 32), bh = box.offsetHeight || 150;
  let left = r.right + 14, top = r.top;
  if (left + bw > vw - 16) { left = Math.max(16, Math.min(vw - bw - 16, r.left)); top = r.bottom + 14; }
  if (top + bh > vh - 16) top = Math.max(16, r.top - bh - 14);
  Object.assign(box.style, { left: left + 'px', top: Math.max(16, top) + 'px', width: bw + 'px' });
  $('tourNext').focus();
}

/* ---------- send to real robot ---------- */
function openSend() {
  const robotCode = genTS('robot'), remote = hasCode('remote') ? genTS('remote') : null;
  modal('Run this on a real Cutebot', `<ol>
      <li>Open <a href="https://makecode.microbit.org/" target="_blank" rel="noopener">makecode.microbit.org</a> and create a new project.</li>
      <li>Click <b>Extensions</b> at the bottom of the block list, search for <b>cutebot</b>, and add the ELECFREAKS Cutebot extension. It brings the NeoPixel blocks for the underglow lights with it.</li>
      <li>Switch to <b>JavaScript</b>, select all the code there, and paste this code over it.</li>
      <li>Switch back to <b>Blocks</b> to check it, then click <b>Download</b> and copy the file to the micro:bit in the Cutebot.</li></ol>
    <div class="code-head"><b>Cutebot micro:bit</b><span><button class="btn small" id="cpRobot">Copy</button><button class="btn small" id="dlRobot">Download .txt</button></span></div>
    <textarea id="tsRobot" spellcheck="false" aria-label="Cutebot micro:bit code" readonly></textarea>
    ${remote ? `<div class="code-head"><b>Remote micro:bit</b><span><button class="btn small" id="cpRemote">Copy</button><button class="btn small" id="dlRemote">Download .txt</button></span></div>
    <p class="note">Make a second MakeCode project for the micro:bit you hold. It needs no extension.</p>
    <textarea id="tsRemote" spellcheck="false" aria-label="Remote micro:bit code" readonly></textarea>` : ''}
    <p class="note">Cutebot guide: <a href="https://wiki.elecfreaks.com/en/microbit/microbit-smart-car/microbit-samrt-cutebot/" target="_blank" rel="noopener">ELECFREAKS wiki</a></p>`,
    [['Close', () => {}]], true);
  $('tsRobot').value = robotCode;
  $('cpRobot').onclick = () => copyText(robotCode, $('tsRobot'));
  $('dlRobot').onclick = () => saveFile(safeName($('projName').value) + ' - cutebot.txt', robotCode);
  if (remote) { $('tsRemote').value = remote; $('cpRemote').onclick = () => copyText(remote, $('tsRemote')); $('dlRemote').onclick = () => saveFile(safeName($('projName').value) + ' - remote.txt', remote); }
}

/* ---------- files ---------- */
function openFileModal() {
  const text = JSON.stringify(projectData());
  modal('Save or open a file', `<p class="note" style="font-size:14px">Projects are saved in this browser automatically (see My projects). To move a project to another computer, download it as a file or copy its text. Opening a file adds it as a new project.</p>
    <div class="row-actions"><button class="btn" id="pjDownload">Download this project</button><label class="btn" for="pjFile">Open a project file</label><input type="file" id="pjFile" accept=".json,.txt,application/json" hidden></div>
    <textarea id="projText" spellcheck="false" aria-label="Project text"></textarea>`,
    [['Copy project text', () => { copyText($('projText').value, $('projText')); return false; }], ['Open pasted text', () => tryLoad($('projText').value), true]]);
  $('projText').value = text;
  $('pjDownload').onclick = () => saveFile(safeName($('projName').value) + '.json', text);
  $('pjFile').onchange = (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { if (tryLoad(r.result) !== false) closeModal(); }; r.readAsText(f); };
}
function tryLoad(text) {
  try {
    let s = JSON.parse(text);
    if (s && s.kind === 'turn-in') s = s.project;                   // a turn-in file also opens as a project
    if (!s || (!s.programs && !s.ws)) throw new Error('missing blocks');
    if (text === JSON.stringify(projectData())) { toast('That is the project you already have open.'); return; }
    startNewProject(s); toast('Opened as a new project');
  } catch (e) { toast('That is not a Cutebot Code Lab project. Copy the whole text and try again.'); return false; }
}

/* ---------- examples ---------- */
function openExample(key) {
  if (!L.EXAMPLES[key]) return;
  startNewProject(exampleProject(key));
  toast(`Opened the “${L.EXAMPLES[key].name}” example as a new project. Your other work is in My projects.`);
}

/* ---------- lessons ---------- */
const lessonState = readJSON(LESSONSTORE, {});
let lesson = null;
const lessonFlags = { ran: false, odo0: 0, radio: false, serial: false, passed: new Set(Object.keys(proofs)) };
function blocksOf(devId) { return (devId === proj.active ? ws : wsFor(devId)).getAllBlocks(false).filter(b => b.isEnabled() && !b.isShadow()); }
function inside(b, type) { if (!type) return true; let p = b.getParent(); while (p) { if (p.type === type) return true; p = p.getParent(); } return false; }
const Q = {
  find: (dev, type, within) => blocksOf(dev).filter(b => b.type === type && inside(b, within)),
  has: (dev, type, within) => Q.find(dev, type, within).length > 0,
  count: (dev, type, within) => Q.find(dev, type, within).length,
  passed: (id) => lessonFlags.passed.has(id),
  get ran() { return lessonFlags.ran; }, get moved() { return bot.odo - lessonFlags.odo0 > 8 || bot.odo > 8; },
  get radio() { return lessonFlags.radio; }, get serial() { return lessonFlags.serial; }, get activeDev() { return proj.active; }
};
function renderLessonList() {
  $('lessonBody').innerHTML = `<p class="note">Short guided activities. Each one starts a new project and sets up the arena for you.</p><ol class="lesson-list">${L.LESSONS.map(ls => {
    const s = lessonState[ls.id], done = s && s.done ? s.done.length : 0;
    return `<li><button data-lesson="${ls.id}"><span class="lv">${esc(ls.level)}</span><b>${esc(ls.title)}</b><span class="lp">${done ? `${done} of ${ls.steps.length} steps done` : `${ls.steps.length} steps`}</span></button></li>`;
  }).join('')}</ol>`;
  $('lessonBody').querySelectorAll('button[data-lesson]').forEach(b => b.onclick = () => startLesson(b.dataset.lesson));
  $('lessonTitle').textContent = 'Lessons';
}
function startLesson(id) {
  const ls = L.LESSONS.find(x => x.id === id);
  startNewProject({ name: ls.title, programs: { robot: xmlToState(L.BLANK), remote: null }, arena: { map: ls.map, edits: {} } });
  Object.assign(lessonFlags, { ran: false, odo0: 0, radio: false, serial: false });
  lesson = ls; lessonState[id] ||= { step: 0, done: [] }; lessonState[id].step = 0; writeJSON(LESSONSTORE, lessonState);
  renderLesson();
  toast(`Started “${ls.title}” as a new project. Your other work is in My projects.`);
}
function renderLesson() {
  if (!lesson) return renderLessonList();
  const s = lessonState[lesson.id], i = s.step, step = lesson.steps[i];
  const ok = step.check ? safeCheck(step) : null;
  if (ok && !s.done.includes(i)) { s.done.push(i); writeJSON(LESSONSTORE, lessonState); }
  const dots = lesson.steps.map((_, k) => `<span class="ldot${k === i ? ' cur' : ''}${s.done.includes(k) ? ' done' : ''}"></span>`).join('');
  $('lessonTitle').textContent = lesson.title;
  $('lessonBody').innerHTML = `<button class="linkbtn" id="lsBack">← All lessons</button>
    <div class="ldots" aria-label="Step ${i + 1} of ${lesson.steps.length}">${dots}</div>
    <h3>${i + 1}. ${esc(step.t)}</h3><div class="lstep">${step.html}</div>
    ${step.check ? `<div class="lcheck ${ok ? 'ok' : ''}">${ok ? '✓ Done' : 'Not done yet. The check updates as you work.'}</div>` : ''}
    <div class="lnav"><button class="btn" id="lsPrev" ${i === 0 ? 'disabled' : ''}>Back</button><button class="btn run" id="lsNext">${i === lesson.steps.length - 1 ? 'Finish' : 'Next'}</button></div>`;
  $('lsBack').onclick = () => { lesson = null; renderLessonList(); };
  $('lsPrev').onclick = () => { s.step = Math.max(0, i - 1); writeJSON(LESSONSTORE, lessonState); renderLesson(); };
  $('lsNext').onclick = () => {
    if (!step.check && !s.done.includes(i)) s.done.push(i);
    if (i === lesson.steps.length - 1) { toast(`Lesson “${lesson.title}” finished.`); lesson = null; writeJSON(LESSONSTORE, lessonState); return renderLessonList(); }
    s.step = i + 1; writeJSON(LESSONSTORE, lessonState); renderLesson();
  };
  lastLessonOk = ok;
}
function safeCheck(step) { try { return !!step.check(Q); } catch (e) { return false; } }
let lastLessonOk = null, lessonT = 0;
function lessonCheckSoon() { clearTimeout(lessonT); lessonT = setTimeout(() => { if (lesson && ui.lessons) { const step = lesson.steps[lessonState[lesson.id].step]; if (step.check && safeCheck(step) !== lastLessonOk) renderLesson(); } }, 300); }

/* ---------- splitter ---------- */
function initSplitter() {
  const sp = $('splitter'), body = document.querySelector('.body');
  const apply = (px) => { if (px) body.style.gridTemplateColumns = `${px}px 8px 1fr`; };
  apply(ui.split);
  sp.addEventListener('pointerdown', (e) => {
    sp.setPointerCapture(e.pointerId);
    const move = (ev) => { const px = Math.max(320, Math.min(window.innerWidth * 0.7, ev.clientX - body.getBoundingClientRect().left)); ui.split = Math.round(px); apply(ui.split); };
    const up = () => { sp.removeEventListener('pointermove', move); sp.removeEventListener('pointerup', up); writeJSON(UISTORE, ui); };
    sp.addEventListener('pointermove', move); sp.addEventListener('pointerup', up);
  });
  sp.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { const cur = document.querySelector('.sim').getBoundingClientRect().width; ui.split = Math.round(Math.max(320, cur + (e.key === 'ArrowLeft' ? -24 : 24))); apply(ui.split); writeJSON(UISTORE, ui); } });
}

/* ---------- settings ---------- */
const SPEEDS = { '2': 2, '1': 1, '0.5': 0.5, '0.25': 0.25, '0.1': 0.1 };
const SCALE = () => ui.big ? 1.05 : 0.85;
function applyUI() {
  L.setSpeed(SPEEDS[ui.speed] || 1); $('speedSel').value = ui.speed;
  L.real.on = ui.real; $('btnReal').setAttribute('aria-pressed', ui.real); $('btnReal').textContent = ui.real ? 'Real-world: On' : 'Real-world: Off';
  L.soundOn = ui.sound; L.trailOn = ui.trail;
  $('optHL').checked = ui.highlight; $('optAuto').checked = ui.autorun; $('optSound').checked = ui.sound; $('optTrail').checked = ui.trail; $('optBig').checked = ui.big;
}
function showTab(t) {
  ui.tab = t;
  document.querySelectorAll('#simTabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t));
  document.querySelectorAll('.tabpanel').forEach(p => p.hidden = p.id !== 'tab-' + t);
  writeJSON(UISTORE, ui);
}
function setLessons(open) {
  ui.lessons = open; $('lessons').hidden = !open; $('btnLessons').setAttribute('aria-pressed', open);
  if (open) renderLesson(); writeJSON(UISTORE, ui);
}

/* ---------- init ---------- */
function init() {
  Object.assign(ui, readJSON(UISTORE, {}));
  if (!SPEEDS[ui.speed]) ui.speed = '1';
  // real-world mode was on by default for a while; switch it off once for anyone who got it that way
  if ((ui.realDefault || 0) < 2) { ui.real = false; ui.realDefault = 2; writeJSON(UISTORE, ui); }
  buildBoard($('mbRobot'), 'robot'); buildBoard($('mbRemote'), 'remote');
  L.buildFloor(); L.sizeArena();

  ws = Blockly.inject('blockly', {
    toolbox: L.makeToolbox('robot'), theme: L.makeTheme(), renderer: 'zelos', sounds: false, trashcan: true, media: 'media/',
    zoom: { controls: false, wheel: true, startScale: SCALE(), maxScale: 2, minScale: 0.35 },
    move: { scrollbars: true, drag: true, wheel: false },
    grid: { spacing: 24, length: 2, colour: L.cssVar('--line'), snap: true }
  });
  L.ws = () => ws;

  // projects: move a single saved project from earlier versions into My projects
  pindex = readJSON(PINDEX, null);
  if (!pindex || !Array.isArray(pindex.list)) {
    pindex = { current: null, list: [] };
    const old = readJSON('cutebot-lab-v2', null) || readJSON('cutebot-lab-v1', null);
    startNewProject(old && (old.programs || old.ws) ? old : exampleProject('linefollow'));
  } else {
    const id = pindex.list.some(x => x.id === pindex.current) ? pindex.current : pindex.list[0] && pindex.list[0].id;
    if (!id || !openProject(id, true)) { pindex.current = null; startNewProject(exampleProject('linefollow')); }
  }
  purgeOldTrash();
  if (innerWidth < 700) setTimeout(() => ws.zoomToFit(), 50);

  let saveT = 0, autoT = 0;
  ws.addChangeListener((e) => {
    updateUndo();
    if (e.isUiEvent) return;
    if (e.type === Blockly.Events.BLOCK_MOVE || e.type === Blockly.Events.BLOCK_CREATE) L.updateOrphans(ws);
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      save(); refreshCode(); updateDevDots(); updateTabs(); lessonCheckSoon();
      $('remoteEmpty').hidden = !(proj.active === 'remote' && ws.getAllBlocks(false).length === 0);
      if (RT.running) { codeStale = true; setRunUI(); }
    }, 250);
    // auto-restart: rerun from the start a moment after the code changes (not during challenges or replays)
    if (ui.autorun && RT.running && !challenge && !replayOf) {
      clearTimeout(autoT);
      autoT = setTimeout(() => { if (RT.running && !challenge && !replayOf && !ws.isDragging()) { resetAll(); run(); toast('Restarted with your new code'); } }, 900);
    }
  });
  L.on('change', () => { save(); updateArenaButtons(); });

  new ResizeObserver(() => Blockly.svgResize(ws)).observe($('blockly'));
  new ResizeObserver(() => L.sizeArena()).observe($('arena').parentElement);

  // sim controls
  $('btnRun').onclick = () => { if (RT.running) L.stopAll(); else if (replayOf) toast('Close the replay first.'); else run(); };
  $('btnReset').onclick = () => { if (replayOf) { exitChallenge(); return; } resetAll(); };
  $('mapSel').onchange = (e) => { if (challenge) exitChallenge(true); setMap(e.target.value); save(); };
  $('speedSel').onchange = (e) => { ui.speed = e.target.value; applyUI(); writeJSON(UISTORE, ui); };
  $('btnReal').onclick = () => { ui.real = !ui.real; applyUI(); writeJSON(UISTORE, ui); toast(ui.real ? 'Real-world mode on: uneven motors, a stall below 15 %, noisy sensors, like a real Cutebot. Starts with the next Run.' : 'Real-world mode off: a perfect robot with exact motors and sensors. Starts with the next Run.'); };
  $('btnEditArena').onclick = () => setEditArena(!ui.editArena);
  popover('btnOptions', 'optionsPop');
  const opt = (id, key, after) => { $(id).onchange = (e) => { ui[key] = e.target.checked; applyUI(); writeJSON(UISTORE, ui); if (after) after(); }; };
  opt('optHL', 'highlight'); opt('optAuto', 'autorun'); opt('optSound', 'sound', () => { if (!ui.sound) L.stopSounds(); }); opt('optTrail', 'trail');
  opt('optBig', 'big', () => ws.setScale(SCALE()));
  const rotate = (d) => { if (L.lockRobot) return L.emit('locked'); bot.a += d; L.sense(true); };
  $('btnRotL').onclick = () => rotate(-Math.PI / 12);
  $('btnRotR').onclick = () => rotate(Math.PI / 12);
  document.querySelectorAll('#toolSeg button').forEach(b => b.onclick = () => setTool(b.dataset.tool));
  $('btnSetStart').onclick = () => { L.edits().start = { x: +bot.x.toFixed(2), y: +bot.y.toFixed(2), a: +bot.a.toFixed(4) }; L.trail = []; save(); updateArenaButtons(); toast('Start position saved for this arena'); };
  $('btnRestore').onclick = () => modal('Restore this arena?', `<p class="note" style="font-size:14px">This removes your drawing, box changes and start position from “${esc(L.MAPS[L.arena.map].name)}”.</p>`,
    [['Cancel', () => {}], ['Restore arena', () => { delete L.arena.edits[L.arena.map]; setMap(L.arena.map); save(); }, true]]);
  const syncZoom = () => { $('zFollow').setAttribute('aria-pressed', L.view.zoom > 1 && L.view.follow); $('zOutA').disabled = L.view.zoom <= 1; };
  $('zIn').onclick = () => { L.view.zoom = Math.min(4, L.view.zoom * 1.5); L.view.follow = true; syncZoom(); };
  $('zOutA').onclick = () => { L.view.zoom = Math.max(1, L.view.zoom / 1.5); if (L.view.zoom < 1.05) L.view.zoom = 1; syncZoom(); };
  $('zFollow').onclick = () => { if (L.view.zoom === 1) { L.view.zoom = 2.25; L.view.follow = true; } else L.view.follow = !L.view.follow; syncZoom(); };
  L.on('change', (k) => { if (k === 'view') syncZoom(); });
  syncZoom();

  // sensors and gestures (all routed through L.input so challenge runs can be replayed)
  const slider = (id, out, fmt, fn) => { $(id).oninput = (e) => { $(out).textContent = fmt(e.target.value); fn(+e.target.value); }; };
  slider('temp', 'tempOut', v => v + ' °C', v => L.input('e', 'robot', 'temp', v));
  slider('light', 'lightOut', v => v, v => L.input('e', 'robot', 'light', v));
  slider('tiltX', 'tiltXOut', v => v, v => L.input('a', 'remote', 'x', v));
  slider('tiltY', 'tiltYOut', v => v, v => L.input('a', 'remote', 'y', v));
  $('btnTiltZero').onclick = () => { ['tiltX', 'tiltY'].forEach(id => { $(id).value = 0; $(id).dispatchEvent(new Event('input')); }); };
  $('btnGesture').onclick = () => L.input('g', 'robot', $('gestSel').value);
  $('btnGestureR').onclick = () => L.input('g', 'remote', $('gestSelR').value);

  // IR remote
  $('irPad').innerHTML = L.IR_BUTTONS.map(b => `<button class="irb${b[0] === 'Off' ? ' off' : ''}" data-code="${b[1]}" data-name="${b[0]}" aria-label="${b[0]}">${esc(b[2])}</button>`).join('');
  $('irPad').querySelectorAll('button').forEach(b => {
    const code = +b.dataset.code;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.classList.add('down'); L.input('i', code, true); $('irLast').textContent = `Last button: ${b.dataset.name} (code ${code})`; });
    const up = () => { if (b.classList.contains('down')) { b.classList.remove('down'); L.input('i', code, false); } };
    b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up);
    b.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); L.input('i', code, true); setTimeout(() => L.input('i', code, false), 150); } });
  });

  // data panel
  document.querySelectorAll('#sensorPick input').forEach(cb => { cb.checked = data.sensors[cb.value]; cb.onchange = () => { data.sensors[cb.value] = cb.checked; }; });
  $('btnDataClear').onclick = () => { data.series.clear(); data.log = []; logDirty = true; };
  $('btnDataCopy').onclick = () => copyText(dataCSV());
  $('btnDataCSV').onclick = () => saveFile(safeName($('projName').value) + ' data.csv', dataCSV());

  // header and editor bar
  document.querySelectorAll('#simTabs button').forEach(b => b.onclick = () => showTab(b.dataset.tab));
  document.querySelectorAll('#devSeg button').forEach(b => b.onclick = () => { if (b.dataset.dev !== proj.active) showDevice(b.dataset.dev); });
  $('projName').onchange = save;
  popover('btnMenu', 'menuPop');
  const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
  $('menuPop').innerHTML = `<button role="menuitem" data-act="projects" data-close>My projects…</button>
    <button role="menuitem" data-act="new" data-close>New blank project</button>
    <button role="menuitem" data-act="file" data-close>Save or open a file…</button>
    <div class="menu-label">Examples (open as a new project)</div>
    ${Object.entries(L.EXAMPLES).filter(([k]) => k !== 'blank').sort((a, b) => LEVELS.indexOf(a[1].level) - LEVELS.indexOf(b[1].level)).map(([k, ex]) => `<button role="menuitem" data-ex="${k}" data-close><span>${esc(ex.name)}</span>${ex.level ? `<span class="lvl lvl-${ex.level.toLowerCase()}">${esc(ex.level)}</span>` : ''}</button>`).join('')}
    <div class="menu-sep"></div>
    <button role="menuitem" data-act="progress" data-close>My progress…</button>
    <button role="menuitem" data-act="tour" data-close>Show the tour again</button>
    <div class="menu-sep"></div>
    <button role="menuitem" data-act="teacher" data-close>Teacher: check student work…</button>`;
  $('menuPop').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.ex) openExample(b.dataset.ex);
    else if (b.dataset.act === 'projects') openProjects();
    else if (b.dataset.act === 'new') { startNewProject(blankProject()); toast('New project. Your other projects are in My projects.'); }
    else if (b.dataset.act === 'file') openFileModal();
    else if (b.dataset.act === 'teacher') openTeacher();
    else if (b.dataset.act === 'progress') openProgress();
    else if (b.dataset.act === 'tour') startTour();
  });
  $('btnLessons').onclick = () => setLessons(!ui.lessons);
  $('btnLessonsClose').onclick = () => setLessons(false);
  $('btnTurnIn').onclick = openTurnIn;
  $('btnChTurnIn').onclick = openTurnIn;
  $('btnCopy').onclick = openSend;
  $('btnUndo').onclick = () => ws.undo(false);
  $('btnRedo').onclick = () => ws.undo(true);
  let searchT = 0;
  $('blockSearch').addEventListener('input', (e) => { clearTimeout(searchT); searchT = setTimeout(() => doSearch(e.target.value), 150); });
  $('blockSearch').addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.target.value = ''; doSearch(''); } if (e.key === 'Enter') doSearch(e.target.value); });
  $('zIn2').onclick = () => ws.zoomCenter(1); $('zOut2').onclick = () => ws.zoomCenter(-1); $('zFit').onclick = () => ws.zoomToFit();
  const showView = (js) => {
    $('tabBlocks').setAttribute('aria-pressed', !js); $('tabJs').setAttribute('aria-pressed', js);
    $('codeView').hidden = !js; $('zoomer').hidden = js;
    if (js) refreshCode(); else setTimeout(() => Blockly.svgResize(ws), 0);
  };
  $('tabBlocks').onclick = () => showView(false);
  $('tabJs').onclick = () => showView(true);
  $('btnCopyCode').onclick = () => copyText(L.generate(ws, true));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('modal').hidden) closeModal(); });
  // space bar runs and stops, unless the student is typing or working in the blocks
  document.addEventListener('keydown', (e) => {
    if (e.key !== ' ' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (!$('modal').hidden || !$('teacher').hidden || !$('tour').hidden) return;
    if (t.closest && (t.closest('input, textarea, select, button, [contenteditable], .blocklyWidgetDiv, .blocklyDropDownDiv') || t.closest('#blockly'))) return;
    e.preventDefault(); $('btnRun').click();
  });
  $('tourNext').onclick = () => { if (tourStep >= TOUR_STEPS.length - 1) endTour(); else { tourStep++; renderTour(); } };
  $('tourSkip').onclick = endTour;
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('tour').hidden) endTour(); });
  addEventListener('resize', () => { if (tourStep >= 0) renderTour(); });

  // teacher panel
  $('tClose').onclick = closeTeacher;
  $('tFiles').onchange = (e) => { addFiles([...e.target.files]); e.target.value = ''; };
  $('tExport').onclick = () => { if (!subs.length) return toast('Add turn-in files first.'); saveFile('Cutebot challenge results.csv', resultsCSV()); };
  $('tCopy').onclick = () => { if (!subs.length) return toast('Add turn-in files first.'); copyText(resultsCSV()); };
  $('tClear').onclick = () => { subs.length = 0; renderTeacher(); $('tProgress').textContent = ''; };
  const tp = $('teacher');
  tp.addEventListener('dragover', (e) => { e.preventDefault(); tp.classList.add('drop'); });
  tp.addEventListener('dragleave', (e) => { if (e.target === tp) tp.classList.remove('drop'); });
  tp.addEventListener('drop', (e) => { e.preventDefault(); tp.classList.remove('drop'); addFiles([...e.dataTransfer.files]); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !tp.hidden && $('modal').hidden) closeTeacher(); });

  initSplitter();
  applyUI(); setTool('move'); setEditArena(!!ui.editArena); showTab(ui.tab || 'board'); setLessons(!!ui.lessons);
  updateTabs(); renderChallengeList(); updateTurnBadge(); setRunUI(); updateUndo();

  let lastSlow = 0;
  L.on('frame', (t) => {
    drawBoards(); syncHighlights(performance.now()); sampleSensors();
    if (t - lastSlow > 100) {
      lastSlow = t; drawReadout(); drawChart();
      if (challenge) renderChallengeStrip();
      if (logDirty && !$('tab-data').hidden) { const el = $('serialLog'); el.textContent = data.log.slice(-120).join('\n'); el.scrollTop = el.scrollHeight; logDirty = false; }
      if (lesson && ui.lessons && t % 1000 < 110) lessonCheckSoon();
    }
  });
  L.startLoop();

  const retheme = () => ws.setTheme(L.makeTheme());
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', retheme);
  new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if (window.claude && window.claude.use) window.claude.use('downloads').then(d => { downloads = d; }).catch(() => {});
  if (!readJSON(TOUR, 0)) setTimeout(() => { if ($('modal').hidden && tourStep < 0) startTour(); }, 900);
  L.ready = true;
}

const fontsReady = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]) : Promise.resolve();
fontsReady.then(init);
L.app = { openProgress, startTour, endTour, deleteProject, restoreProject, get trash() { return pindex.trash || []; }, run, resetAll, openExample, armChallenge, exitChallenge, showDevice, verifyProof, addFiles, subs, proofs, turnInText, openTurnIn, openTeacher, openProjects, startNewProject, doSearch,
  startLessonNow: (id) => { lesson = L.LESSONS.find(x => x.id === id); lessonState[id] ||= { step: 0, done: [] }; setLessons(true); },
  genTS, projectData, loadProject, get pindex() { return pindex; }, get challenge() { return challenge; }, get crun() { return crun; }, data, Q };
})();
