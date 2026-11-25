/* PixelPress — app bootstrap: link-as-save, playback, preview, keyboard, deck, themes, easter eggs */
(function () {
  'use strict';
  var PP = window.PP, S = PP.state, $ = PP.byId, V;
  var lastCode = null, saveTimer = null;
  var SHELL_COLORS = { grape: '#2a1d4d', pea: '#8b8f74', atomic: '#3b2a5e', night: '#0d0f17', rainbow: '#1b0f2e' };

  /* ---------- link = save file ---------- */
  function writeHash(push) {
    var code;
    try { code = PP.encodeDoc(); } catch (e) { console.warn(e); return; }
    var url = '#' + PP.HASH_KEY + code;
    try {
      if (push) history.pushState(null, '', url);
      else if (code !== lastCode || PP.codeFromHash() !== code) history.replaceState(null, '', url);
    } catch (e) { /* some browsers limit URL size; local copy still kept */ }
    lastCode = code;
    try { localStorage.setItem('pixelpress:last', code); } catch (e) { }
    meter(code);
  }
  PP.scheduleSave = function () { clearTimeout(saveTimer); saveTimer = setTimeout(function () { writeHash(false); }, 350); };
  function meter(code) {
    var len = PP.shareUrl(code).length;
    $('linkMeterFill').style.width = Math.min(100, len / 8000 * 100) + '%';
    $('linkMeter').classList.toggle('warn', len > 8000);
    $('linkMeterText').textContent = (len < 1024 ? len + ' B' : (len / 1024).toFixed(1) + ' KB') + ' link';
  }

  PP.openDocument = function (doc, opts) {
    opts = opts || {};
    clearTimeout(saveTimer);
    writeHash(false);
    if (!opts.keepGalleryId) S.galleryId = null;
    stopPlay();
    PP.loadDoc(doc, { paletteKey: opts.paletteKey });
    if (opts.push) writeHash(true); else writeHash(false);
    V.fit();
  };

  function loadFromCode(code, quiet) {
    try {
      var d = PP.decodeDoc(code);
      lastCode = code;
      S.galleryId = null;
      stopPlay();
      PP.loadDoc(d);
      meter(code);
      V.fit();
      if (!quiet) PP.toast('Loaded "' + d.title + '" straight from the link.', 'ok');
      return true;
    } catch (e) {
      console.warn('Bad link', e);
      PP.toast('That link looks scrambled — like a cartridge with dust in it. Starting fresh.', 'warn');
      return false;
    }
  }
  function onHashNav() {
    var code = PP.codeFromHash();
    if (code && code !== lastCode) loadFromCode(code, false);
  }

  /* ---------- UI refresh ---------- */
  function refreshAll() {
    var d = S.doc;
    $('titleInput').value = d.title;
    $('fpsInput').value = d.fps; $('fpsVal').textContent = d.fps;
    PP.renderPalette(); PP.renderLayers(); PP.renderFrames();
    emptyHint(); PP.requestRender(); PP.updateHud();
    document.title = (d.title && d.title !== 'Untitled' ? d.title + ' · ' : '') + 'PixelPress — pocket pixel-art studio & animator';
  }
  function emptyHint() { $('emptyHint').classList.toggle('show', PP.isEmptyDoc()); }
  function historyButtons() {
    $('undoBtn').disabled = !PP.history.undo.length;
    $('redoBtn').disabled = !PP.history.redo.length;
  }

  /* ---------- playback + live preview ---------- */
  var playAcc = 0, playLast = 0, prevFrame = 0, prevAcc = 0, prevLast = 0;
  function togglePlay() { if (S.playing) stopPlay(); else startPlay(); }
  PP.togglePlay = togglePlay;
  function startPlay() {
    if (S.doc.frames.length < 2) { PP.toast('Add a second frame first — even flipbooks need two pages.'); PP.sfx.err(); return; }
    S.playing = true; playLast = performance.now(); playAcc = 0;
    $('playBtn').textContent = '❚❚ Pause'; $('playBtn').setAttribute('aria-pressed', 'true');
    document.body.classList.add('is-playing');
    PP.sfx.tool();
    requestAnimationFrame(playTick);
  }
  function stopPlay() {
    if (!S.playing) return;
    S.playing = false;
    $('playBtn').textContent = '▶ Play'; $('playBtn').setAttribute('aria-pressed', 'false');
    document.body.classList.remove('is-playing');
    PP.requestRender();
  }
  function playTick(t) {
    if (!S.playing) return;
    playAcc += t - playLast; playLast = t;
    var step = 1000 / S.doc.fps;
    if (playAcc >= step) { playAcc %= step; PP.selectFrame(S.frame + 1); }
    requestAnimationFrame(playTick);
  }
  function previewTick(t) {
    var cv = $('preview'), d = S.doc;
    if (!document.hidden && cv) {
      prevAcc += t - prevLast;
      var step = 1000 / d.fps;
      if (prevAcc >= step) { prevAcc %= step; prevFrame++; }
      if (prevFrame >= d.frames.length) prevFrame = 0;
      var f = S.playing ? S.frame : prevFrame;
      var src = PP.indicesToCanvas(PP.composite(f), d.w, d.h, d.palette, previewTick.buf);
      previewTick.buf = src;
      var x = cv.getContext('2d'), k = Math.min(cv.width / d.w, cv.height / d.h);
      if (k >= 1) k = Math.floor(k);
      x.clearRect(0, 0, cv.width, cv.height);
      x.imageSmoothingEnabled = false;
      x.drawImage(src, Math.round((cv.width - d.w * k) / 2), Math.round((cv.height - d.h * k) / 2), d.w * k, d.h * k);
    }
    prevLast = t;
    requestAnimationFrame(previewTick);
  }

  /* ---------- keyboard ---------- */
  var KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'], kpos = 0;
  var KEY_TOOLS = { b: 'pencil', e: 'eraser', g: 'fill', l: 'line', r: 'rect', c: 'circle', d: 'dither', i: 'picker', m: 'move', h: 'hand' };
  function canPanWithArrows() { var a = document.activeElement; return !a || a === document.body || a === $('stage') || a === $('view'); }
  function onKey(e) {
    var k = (e.key || '').toLowerCase();
    // konami tracker runs everywhere except text fields
    if (!PP.isTyping()) {
      kpos = (k === KONAMI[kpos]) ? kpos + 1 : (k === KONAMI[0] ? 1 : 0);
      if (kpos === KONAMI.length) { kpos = 0; secret(); }
    }
    if (PP.isTyping() || PP.anyDialogOpen()) return;
    var mod = e.ctrlKey || e.metaKey;
    if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) PP.redo(); else PP.undo(); return; }
    if (mod && k === 'y') { e.preventDefault(); PP.redo(); return; }
    if (mod && k === 's') { e.preventDefault(); PP.saveToGallery(); return; }
    if (mod || e.altKey) return;
    if (k === ' ' && canPanWithArrows()) { e.preventDefault(); if (!V.space) { V.space = true; $('stage').classList.add('grab'); } return; }
    if (k.indexOf('arrow') === 0 && canPanWithArrows()) {
      e.preventDefault();
      var dd = 24;
      if (k === 'arrowup') V.pan(0, dd); else if (k === 'arrowdown') V.pan(0, -dd);
      else if (k === 'arrowleft') V.pan(dd, 0); else if (k === 'arrowright') V.pan(-dd, 0);
      return;
    }
    if (KEY_TOOLS[k]) { PP.setTool(KEY_TOOLS[k]); return; }
    switch (k) {
      case 'v': PP.toggleOpt(e.shiftKey ? 'mirrorY' : 'mirrorX'); break;
      case 'f': PP.toggleOpt('shapeFill'); break;
      case 'x': PP.swapColors(); break;
      case 'k': PP.toggleOpt('grid'); break;
      case 'o': PP.toggleOpt('onion'); break;
      case 'p': togglePlay(); break;
      case '[': PP.setSize(S.size - 1); break;
      case ']': PP.setSize(S.size + 1); break;
      case '+': case '=': V.zoomStep(1); break;
      case '-': case '_': V.zoomStep(-1); break;
      case '0': V.fit(); break;
      case ',': case '<': stopPlay(); PP.selectFrame(S.frame - 1); PP.sfx.click(); break;
      case '.': case '>': stopPlay(); PP.selectFrame(S.frame + 1); PP.sfx.click(); break;
      default: return;
    }
  }
  function onKeyUp(e) { if (e.key === ' ') { V.space = false; $('stage').classList.remove('grab'); } }

  /* ---------- easter eggs ---------- */
  function burst() {
    if (PP.reducedMotion) return;
    var n = PP.lowPower ? 24 : 60, cols = PP.SECRET_PALETTE.colors;
    for (var i = 0; i < n; i++) {
      var s = document.createElement('i');
      s.className = 'px-burst';
      var a = Math.random() * Math.PI * 2, r = 120 + Math.random() * 320;
      s.style.setProperty('--dx', Math.cos(a) * r + 'px');
      s.style.setProperty('--dy', Math.sin(a) * r + 'px');
      s.style.background = cols[i % cols.length];
      s.style.animationDelay = (Math.random() * 0.15) + 's';
      document.body.appendChild(s);
      setTimeout((function (el) { return function () { el.remove(); }; })(s), 1500);
    }
  }
  function secret() {
    PP.secretUnlocked = true;
    document.body.setAttribute('data-shell', 'rainbow');
    PP.resetAccent();
    var opt = PP.$('#selShell option[value="rainbow"]');
    if (!opt) { opt = document.createElement('option'); opt.value = 'rainbow'; opt.textContent = '★ Rainbow Cart'; $('selShell').appendChild(opt); }
    $('selShell').value = 'rainbow';
    PP.renderPalette();
    var was = PP.sfx.on; PP.sfx.on = true; PP.sfx.unlock(); PP.sfx.secret(); PP.sfx.on = was;
    burst();
    PP.toast('★ CHEAT ACTIVATED: +30 lives, Rainbow shell, and a secret palette in the Palette menu.', 'ok');
  }
  var logoClicks = 0, logoTimer = null;
  function onLogo() {
    logoClicks++;
    clearTimeout(logoTimer);
    logoTimer = setTimeout(function () { logoClicks = 0; }, 1200);
    PP.sfx.click();
    if (logoClicks >= 5) {
      logoClicks = 0;
      PP.toast('*blows on the cartridge* … fffffff … works now. It always does.');
      var c = $('console');
      c.classList.remove('poweron'); void c.offsetWidth; c.classList.add('poweron');
      PP.sfx.boot();
    }
  }

  /* ---------- deck ---------- */
  function initDeck() {
    var rep = null;
    function panDir(dir) {
      var dd = 32;
      if (dir === 'up') V.pan(0, dd); else if (dir === 'down') V.pan(0, -dd);
      else if (dir === 'left') V.pan(dd, 0); else V.pan(-dd, 0);
      PP.sfx.tone(520, 0.02, 'square', 0, 0.3);
    }
    PP.$$('#dpad [data-dir]').forEach(function (b) {
      var dir = b.getAttribute('data-dir');
      b.addEventListener('pointerdown', function (e) {
        e.preventDefault(); panDir(dir);
        clearInterval(rep);
        rep = setInterval(function () { panDir(dir); }, 110);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (n) { b.addEventListener(n, function () { clearInterval(rep); }); });
      b.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); panDir(dir); } });
    });
    $('btnStart').addEventListener('click', togglePlay);
    $('btnSelect').addEventListener('click', PP.cycleTool);
    $('btnB').addEventListener('click', PP.undo);
    $('btnA').addEventListener('click', PP.redo);
    $('playBtn').addEventListener('click', togglePlay);
  }

  /* ---------- chrome: nav, themes, sound, crt ---------- */
  function setShell(v) {
    document.body.setAttribute('data-shell', v);
    var m = PP.$('meta[name="theme-color"]'); if (m) m.setAttribute('content', SHELL_COLORS[v] || '#2a1d4d');
    PP.resetAccent();
    if (v !== 'rainbow') { PP.prefs.shell = v; PP.savePrefs(); }
  }
  function setCrt(on) {
    document.body.classList.toggle('no-crt', !on);
    $('btnCrt').setAttribute('aria-pressed', on ? 'true' : 'false');
    PP.prefs.crt = on; PP.savePrefs();
  }
  function setSound(on) {
    PP.sfx.on = on;
    if (on) PP.sfx.unlock();
    $('btnSound').setAttribute('aria-pressed', on ? 'true' : 'false');
    $('btnSound').textContent = on ? '♪ On' : '♪ Off';
    PP.prefs.sound = on; PP.savePrefs();
  }
  function initChrome() {
    $('btnMenu').addEventListener('click', function () {
      var open = !$('nav').classList.contains('open');
      $('nav').classList.toggle('open', open);
      $('btnMenu').setAttribute('aria-expanded', open ? 'true' : 'false');
      $('btnMenu').textContent = open ? '✕' : '☰';
    });
    $('nav').addEventListener('click', function (e) {
      if (e.target.closest('button') && window.innerWidth < 900) {
        $('nav').classList.remove('open'); $('btnMenu').setAttribute('aria-expanded', 'false'); $('btnMenu').textContent = '☰';
      }
    });
    $('selShell').addEventListener('change', function (e) { setShell(e.target.value); PP.sfx.tool(); });
    $('btnCrt').addEventListener('click', function () { setCrt(document.body.classList.contains('no-crt')); PP.sfx.click(); });
    $('btnSound').addEventListener('click', function () {
      setSound(!PP.sfx.on);
      if (PP.sfx.on) { PP.sfx.jingle(); PP.toast('Chiptune clicks ON. Your pixels now have opinions.'); }
    });
    $('logoBtn').addEventListener('click', onLogo);
    $('titleInput').addEventListener('input', function (e) { S.doc.title = e.target.value.slice(0, 40) || 'Untitled'; PP.scheduleSave(); });
    $('titleInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') e.target.blur(); });
    // iOS: audio must be unlocked inside a user gesture
    document.addEventListener('pointerdown', function () { if (PP.sfx.on) PP.sfx.unlock(); }, { passive: true });
  }

  /* ---------- boot ---------- */
  function boot() {
    var bs = $('bootScreen');
    PP.pixelText($('bootLogo'), 'PIXELPRESS', { scale: 6, colors: ['#ff6f91', '#ffc75f', '#f9f871', '#4fd1c5', '#a98bff'], shadow: 'rgba(0,0,0,.55)' });
    PP.pixelText($('logoCanvas'), 'PIXELPRESS', { scale: 3, colors: ['#ff6f91', '#ffc75f', '#f9f871', '#4fd1c5', '#a98bff'], shadow: 'rgba(0,0,0,.5)' });
    var done = false;
    function dismiss() {
      if (done) return; done = true;
      bs.classList.add('gone');
      $('console').classList.add('poweron');
      PP.sfx.boot();
      setTimeout(function () { bs.hidden = true; }, 600);
    }
    $('bootSkip').addEventListener('click', dismiss);
    bs.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', function first(e) { if (!done && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) { e.preventDefault(); dismiss(); } }, { once: false });
    setTimeout(dismiss, PP.reducedMotion ? 250 : 1900);
  }

  /* ---------- init ---------- */
  function init() {
    V = PP.view;
    PP.initPanels();
    PP.initView();
    initDeck(); initChrome();

    // prefs
    var p = PP.prefs;
    if (p.shell && SHELL_COLORS[p.shell]) { $('selShell').value = p.shell; setShell(p.shell); }
    setCrt(p.crt !== false && !PP.lowPower ? true : p.crt === true);
    setSound(false); // always start muted; user opts in each visit
    if (typeof p.grid === 'boolean') S.grid = p.grid;
    if (typeof p.onion === 'boolean') S.onion = p.onion;
    PP.syncToggles();
    PP.setTool(p.tool || 'pencil', true);

    PP.on('doc', refreshAll);
    PP.on('change', function () { PP.updateFrameThumbs(S.frame); PP.updateLayerThumbs(); emptyHint(); PP.scheduleSave(); });
    PP.on('colors', PP.renderChips);
    PP.on('history', historyButtons);
    PP.on('stopPlay', stopPlay);

    // load: link first, then last session, else blank
    var code = PP.codeFromHash(), ok = false;
    if (code) ok = loadFromCode(code, true);
    if (!ok) {
      var last = null;
      try { last = localStorage.getItem('pixelpress:last'); } catch (e) { }
      if (last) ok = loadFromCode(last, true);
      if (ok) writeHash(false);
    }
    if (!ok) { PP.loadDoc(PP.createDoc(32, 32, PP.PALETTES.pico8.colors, 'Untitled'), { paletteKey: 'pico8' }); S.primary = 9; writeHash(false); PP.renderChips(); }
    historyButtons();
    V.fit();
    window.addEventListener('hashchange', onHashNav);
    window.addEventListener('popstate', onHashNav);
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', function () { V.space = false; $('stage').classList.remove('grab'); });
    requestAnimationFrame(function (t) { prevLast = t; previewTick(t); });
    boot();
    if (code && ok) setTimeout(function () { PP.toast('Opened "' + S.doc.title + '" from a link. Links are save files here!', 'ok'); }, 2100);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
