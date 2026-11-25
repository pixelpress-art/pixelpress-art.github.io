/* PixelPress — core: namespace, utils, palettes, pixel font, icons, chiptune sfx, events */
(function () {
  'use strict';
  var PP = window.PP = window.PP || {};

  PP.$ = function (s, r) { return (r || document).querySelector(s); };
  PP.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  PP.byId = function (id) { return document.getElementById(id); };
  PP.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  PP.hexToRgb = function (h) {
    h = String(h || '#000').replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h, 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  PP.rgbToHex = function (r, g, b) {
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase();
  };
  PP.reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  PP.lowPower = (navigator.hardwareConcurrency || 4) <= 2 || (navigator.deviceMemory && navigator.deviceMemory <= 2);
  PP.dpr = function () { return Math.min(window.devicePixelRatio || 1, 2); };
  PP.isTyping = function (el) {
    el = el || document.activeElement;
    if (!el) return false;
    var t = el.tagName;
    return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || el.isContentEditable;
  };

  /* ---------- tiny event bus ---------- */
  var handlers = {};
  PP.on = function (ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); };
  PP.emit = function (ev, data) { (handlers[ev] || []).forEach(function (fn) { try { fn(data); } catch (e) { console.warn(e); } }); };

  /* ---------- palettes ---------- */
  PP.PALETTES = {
    pico8: { name: 'PICO-8', colors: ['#000000', '#1D2B53', '#7E2553', '#008751', '#AB5236', '#5F574F', '#C2C3C7', '#FFF1E8', '#FF004D', '#FFA300', '#FFEC27', '#00E436', '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA'] },
    gameboy: { name: 'Game Boy green (approx.)', colors: ['#0F380F', '#306230', '#8BAC0F', '#9BBC0F'] },
    nes: { name: 'NES (common emulator approx.)', colors: [
      '#7C7C7C', '#0000FC', '#0000BC', '#4428BC', '#940084', '#A80020', '#A81000', '#881400', '#503000', '#007800', '#006800', '#005800', '#004058', '#000000',
      '#BCBCBC', '#0078F8', '#0058F8', '#6844FC', '#D800CC', '#E40058', '#F83800', '#E45C10', '#AC7C00', '#00B800', '#00A800', '#00A844', '#008888',
      '#F8F8F8', '#3CBCFC', '#6888FC', '#9878F8', '#F878F8', '#F85898', '#F87858', '#FCA044', '#F8B800', '#B8F818', '#58D854', '#58F898', '#00E8D8', '#787878',
      '#FCFCFC', '#A4E4FC', '#B8B8F8', '#D8B8F8', '#F8B8F8', '#F8A4C0', '#F0D0B0', '#FCE0A8', '#F8D878', '#D8F878', '#B8F8B8', '#B8F8D8', '#00FCFC', '#F8D8F8'] },
    grape: { name: 'Pocket Grape (original)', colors: ['#1A1028', '#3B2361', '#6B4FB3', '#A98BFF', '#F2E9FF', '#FF6F91', '#FFC75F', '#4FD1C5'] },
    mono: { name: '1-bit Ink', colors: ['#111111', '#F4F1E8'] }
  };
  PP.SECRET_PALETTE = { name: '★ Sunset Cartridge (secret)', colors: ['#0D0221', '#261447', '#541388', '#A01A7D', '#EC4067', '#F57F5B', '#FFD166', '#FFF3B0', '#2EC4B6', '#118AB2'] };

  /* ---------- 3x5 pixel font ---------- */
  var FONT = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
    F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
    K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
    P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
    Z: '111001010100111', '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110',
    '4': '101101111001001', '5': '111100110001110', '6': '011100111101111', '7': '111001010010010', '8': '111101111101111',
    '9': '111101111001110', ' ': '000000000000000', '!': '010010010000010', '-': '000000111000000', '.': '000000000000010',
    ':': '000010000010000', '?': '110001010000010', '/': '001001010100100', '+': '000010111010000'
  };
  /* draw pixel text; returns width in pixels (unscaled) */
  PP.pixelText = function (canvas, text, opts) {
    opts = opts || {};
    var s = opts.scale || 4, gap = 1, ctx = canvas.getContext('2d');
    text = String(text).toUpperCase();
    var cols = text.length * (3 + gap) - gap;
    if (opts.fit !== false) { canvas.width = (cols + 2) * s; canvas.height = 7 * s; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var colors = opts.colors || ['#fff'];
    function drawAll(ox, oy, col) {
      for (var i = 0; i < text.length; i++) {
        var g = FONT[text[i]] || FONT['?'];
        ctx.fillStyle = typeof col === 'function' ? col(i) : col;
        for (var p = 0; p < 15; p++) {
          if (g[p] === '1') ctx.fillRect((1 + ox + i * (3 + gap) + (p % 3)) * s, (1 + oy + Math.floor(p / 3)) * s, s, s);
        }
      }
    }
    if (opts.shadow) drawAll(0, 1, opts.shadow);
    drawAll(0, 0, function (i) { return colors[i % colors.length]; });
    return cols;
  };

  /* ---------- 8x8 pixel icons for tool buttons ---------- */
  var ICONS = {
    pencil: ['......11', '.....1.1', '....1.1.', '...1.1..', '..1.1...', '.111....', '.11.....', '1.......'],
    eraser: ['....111.', '...1..11', '..1..1.1', '.1..1.1.', '1111.1..', '1..11...', '.11.....', '........'],
    fill: ['...1....', '..1.1...', '.1...1..', '1.....1.', '.1...1.1', '..1.1..1', '...1...1', '......1.'],
    line: ['.......1', '......1.', '.....1..', '....1...', '...1....', '..1.....', '.1......', '1.......'],
    rect: ['11111111', '1......1', '1......1', '1......1', '1......1', '1......1', '1......1', '11111111'],
    circle: ['..1111..', '.1....1.', '1......1', '1......1', '1......1', '1......1', '.1....1.', '..1111..'],
    dither: ['1.1.1.1.', '.1.1.1.1', '1.1.1.1.', '.1.1.1.1', '1.1.1.1.', '.1.1.1.1', '1.1.1.1.', '.1.1.1.1'],
    picker: ['......11', '.....111', '....111.', '...1.1..', '..1.1...', '.1.1....', '1.1.....', '11......'],
    move: ['...11...', '..1111..', '.1.11.1.', '11111111', '11111111', '.1.11.1.', '..1111..', '...11...'],
    hand: ['..1.1...', '.1.1.1..', '.1.1.1.1', '.1111111', '11111111', '1111111.', '.11111..', '..111...'],
    mirror: ['...11...', '.1.11.1.', '11.11.11', '11.11.11', '11.11.11', '.1.11.1.', '...11...', '...11...'],
    filled: ['11111111', '11111111', '11111111', '11111111', '11111111', '11111111', '11111111', '11111111'],
    undo: ['..1.....', '.11.....', '1111111.', '.11....1', '..1....1', '.......1', '..11111.', '........'],
    redo: ['.....1..', '.....11.', '.1111111', '1....11.', '1....1..', '1.......', '.11111..', '........']
  };
  PP.iconSVG = function (name) {
    var rows = ICONS[name];
    if (!rows) return '';
    var r = '';
    for (var y = 0; y < 8; y++) for (var x = 0; x < 8; x++) if (rows[y][x] === '1') r += '<rect x="' + x + '" y="' + y + '" width="1.02" height="1.02"/>';
    return '<svg viewBox="0 0 8 8" width="22" height="22" aria-hidden="true" focusable="false" shape-rendering="crispEdges">' + r + '</svg>';
  };

  /* ---------- chiptune SFX (Web Audio, muted until enabled) ---------- */
  var Sfx = PP.sfx = { on: false, ctx: null, master: null, lastPix: 0 };
  Sfx.unlock = function () {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      if (!Sfx.ctx) {
        Sfx.ctx = new AC();
        Sfx.master = Sfx.ctx.createGain();
        Sfx.master.gain.value = 0.14;
        Sfx.master.connect(Sfx.ctx.destination);
      }
      if (Sfx.ctx.state === 'suspended') Sfx.ctx.resume();
    } catch (e) { /* audio unavailable */ }
  };
  Sfx.tone = function (freq, dur, type, when, vol, slide) {
    if (!Sfx.on || !Sfx.ctx) return;
    dur = dur || 0.06; when = when || 0; vol = vol == null ? 1 : vol;
    var t = Sfx.ctx.currentTime + when;
    var o = Sfx.ctx.createOscillator(), g = Sfx.ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(Sfx.master);
    o.start(t); o.stop(t + dur + 0.03);
  };
  Sfx.noise = function (dur, vol) {
    if (!Sfx.on || !Sfx.ctx) return;
    var c = Sfx.ctx, n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var s = c.createBufferSource(), g = c.createGain();
    s.buffer = b; g.gain.value = vol || 0.4; s.connect(g); g.connect(Sfx.master); s.start();
  };
  var NOTES = [262, 294, 330, 349, 392, 440, 494, 523, 587, 659, 698, 784, 880, 988, 1047, 1175];
  Sfx.click = function () { Sfx.tone(1400, 0.025, 'square', 0, 0.5); };
  Sfx.tool = function () { Sfx.tone(660, 0.04, 'square', 0, 0.6); Sfx.tone(990, 0.05, 'square', 0.04, 0.5); };
  Sfx.pixel = function (i) {
    var now = performance.now();
    if (now - Sfx.lastPix < 55) return;
    Sfx.lastPix = now;
    Sfx.tone(NOTES[(i || 0) % NOTES.length] * 2, 0.03, 'square', 0, 0.35);
  };
  Sfx.erase = function () { var now = performance.now(); if (now - Sfx.lastPix < 70) return; Sfx.lastPix = now; Sfx.noise(0.03, 0.25); };
  Sfx.undo = function () { Sfx.tone(700, 0.08, 'square', 0, 0.5, 0.5); };
  Sfx.redo = function () { Sfx.tone(350, 0.08, 'square', 0, 0.5, 2); };
  Sfx.fill = function () { Sfx.tone(200, 0.15, 'triangle', 0, 0.8, 4); };
  Sfx.err = function () { Sfx.tone(110, 0.12, 'sawtooth', 0, 0.5); Sfx.tone(98, 0.14, 'sawtooth', 0.1, 0.5); };
  Sfx.jingle = function () { [523, 659, 784, 1047].forEach(function (f, i) { Sfx.tone(f, 0.09, 'square', i * 0.08, 0.6); }); };
  Sfx.boot = function () { Sfx.tone(1568, 0.08, 'square', 0, 0.5); Sfx.tone(2093, 0.35, 'square', 0.09, 0.45); };
  Sfx.secret = function () { [392, 523, 659, 784, 659, 784, 1047, 1319].forEach(function (f, i) { Sfx.tone(f, 0.1, i % 2 ? 'triangle' : 'square', i * 0.09, 0.6); }); };

  /* ---------- toasts ---------- */
  PP.toast = function (msg, kind) {
    var box = PP.byId('toasts');
    if (!box) return;
    var t = document.createElement('div');
    t.className = 'toast' + (kind ? ' ' + kind : '');
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(function () { t.classList.add('out'); }, 2600);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3200);
  };

  /* ---------- download helper ---------- */
  PP.download = function (blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name; a.rel = 'noopener';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
  };
  PP.safeName = function (s) {
    return (String(s || 'pixelpress').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pixelpress');
  };

  /* ---------- dialogs with fallback ---------- */
  PP.openDialog = function (d) {
    if (!d) return;
    if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); }
    else d.setAttribute('open', '');
    PP.sfx.click();
  };
  PP.closeDialog = function (d) {
    if (!d) return;
    if (typeof d.close === 'function' && d.open) d.close();
    else d.removeAttribute('open');
  };
  PP.anyDialogOpen = function () { return PP.$$('dialog[open]').length > 0; };

  /* ---------- prefs ---------- */
  PP.prefs = (function () {
    var p = {};
    try { p = JSON.parse(localStorage.getItem('pixelpress:prefs') || '{}') || {}; } catch (e) { p = {}; }
    return p;
  })();
  PP.savePrefs = function () { try { localStorage.setItem('pixelpress:prefs', JSON.stringify(PP.prefs)); } catch (e) { } };
})();
