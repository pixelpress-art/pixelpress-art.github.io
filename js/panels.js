/* PixelPress — panels: tools, palette, layers, frames, dialogs, gallery */
(function () {
  'use strict';
  var PP = window.PP, S = PP.state, $ = PP.byId;
  var TOOL_ORDER = ['pencil', 'eraser', 'fill', 'line', 'rect', 'circle', 'dither', 'picker', 'move', 'hand'];
  PP.TOOL_ORDER = TOOL_ORDER;
  var TOOL_QUIPS = {
    pencil: 'Pencil: one pixel at a time, like a monk.', eraser: 'Eraser: the undo button\'s cousin.',
    fill: 'Fill: for the commitment-ready.', line: 'Line: Shift snaps to 45°. Geometry teachers rejoice.',
    rect: 'Rectangle: hip to be square (hold Shift).', circle: 'Ellipse: rounder than your schedule.',
    dither: 'Dither: the checkerboard that fooled a generation of CRTs.', picker: 'Picker: steal colours ethically.',
    move: 'Move: nudge the whole layer around.', hand: 'Hand: grab the canvas. Gently.'
  };

  PP.initIcons = function () {
    PP.$$('[data-icon]').forEach(function (b) { b.insertAdjacentHTML('afterbegin', PP.iconSVG(b.getAttribute('data-icon'))); });
  };

  /* ---------- tools ---------- */
  PP.setTool = function (t, quiet) {
    if (TOOL_ORDER.indexOf(t) < 0) t = 'pencil';
    S.tool = t;
    PP.$$('[data-tool]').forEach(function (b) {
      var on = b.getAttribute('data-tool') === t;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    $('stage').setAttribute('data-tool', t);
    if (!quiet) { PP.sfx.tool(); if (Math.random() < 0.18) PP.toast(TOOL_QUIPS[t]); }
    PP.requestRender();
    PP.prefs.tool = t; PP.savePrefs();
  };
  PP.cycleTool = function () { PP.setTool(TOOL_ORDER[(TOOL_ORDER.indexOf(S.tool) + 1) % TOOL_ORDER.length]); };
  function setToggle(id, on) { var b = $(id); b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.classList.toggle('active', !!on); }
  PP.toggleOpt = function (key) {
    S[key] = !S[key];
    var ids = { mirrorX: 'mirrorX', mirrorY: 'mirrorY', shapeFill: 'shapeFill', grid: 'gridToggle', onion: 'onionToggle' };
    setToggle(ids[key], S[key]);
    PP.sfx.click(); PP.requestRender();
    PP.prefs[key] = S[key]; PP.savePrefs();
  };
  PP.setSize = function (n) { S.size = PP.clamp(n, 1, 8); $('sizeVal').textContent = S.size; PP.sfx.click(); PP.requestRender(); };
  function initTools() {
    PP.$$('[data-tool]').forEach(function (b) { b.addEventListener('click', function () { PP.setTool(b.getAttribute('data-tool')); }); });
    ['mirrorX', 'mirrorY', 'shapeFill'].forEach(function (id) { $(id).addEventListener('click', function () { PP.toggleOpt(id); }); });
    $('gridToggle').addEventListener('click', function () { PP.toggleOpt('grid'); });
    $('onionToggle').addEventListener('click', function () { PP.toggleOpt('onion'); });
    $('sizeDown').addEventListener('click', function () { PP.setSize(S.size - 1); });
    $('sizeUp').addEventListener('click', function () { PP.setSize(S.size + 1); });
    $('undoBtn').addEventListener('click', PP.undo);
    $('redoBtn').addEventListener('click', PP.redo);
    $('zoomIn').addEventListener('click', function () { PP.view.zoomStep(1); });
    $('zoomOut').addEventListener('click', function () { PP.view.zoomStep(-1); });
    $('zoomFit').addEventListener('click', function () { PP.view.fit(); PP.sfx.click(); });
  }
  PP.syncToggles = function () {
    setToggle('mirrorX', S.mirrorX); setToggle('mirrorY', S.mirrorY); setToggle('shapeFill', S.shapeFill);
    setToggle('gridToggle', S.grid); setToggle('onionToggle', S.onion);
    $('sizeVal').textContent = S.size;
  };

  /* ---------- palette ---------- */
  var editMode = null, editCommitted = false;
  PP.secretUnlocked = false;
  function paletteOptions(sel, includeCustom) {
    var h = '';
    Object.keys(PP.PALETTES).forEach(function (k) { h += '<option value="' + k + '">' + PP.PALETTES[k].name + ' · ' + PP.PALETTES[k].colors.length + '</option>'; });
    if (PP.secretUnlocked) h += '<option value="secret">' + PP.SECRET_PALETTE.name + '</option>';
    if (includeCustom) h += '<option value="custom">Custom (this artwork)</option>';
    sel.innerHTML = h;
  }
  PP.paletteOptions = paletteOptions;
  function presetColors(k) { return k === 'secret' ? PP.SECRET_PALETTE.colors : (PP.PALETTES[k] ? PP.PALETTES[k].colors : null); }
  PP.renderPalette = function () {
    var d = S.doc, sel = $('palSelect');
    paletteOptions(sel, true);
    sel.value = S.paletteKey === 'custom' || !presetColors(S.paletteKey) ? 'custom' : S.paletteKey;
    var box = $('palSwatches'), h = '';
    h += '<button type="button" class="sw clear' + (S.secondary === 0 ? ' is-b' : '') + '" data-i="0" role="option" aria-selected="false" aria-label="Transparent" title="Transparent"></button>';
    d.palette.forEach(function (c, i) {
      var v = i + 1, cls = (S.primary === v ? ' is-a' : '') + (S.secondary === v ? ' is-b' : '');
      h += '<button type="button" class="sw' + cls + '" data-i="' + v + '" role="option" aria-selected="' + (S.primary === v) + '" aria-label="Colour ' + v + ' ' + c + '" title="' + c + '" style="--c:' + c + '"></button>';
    });
    box.innerHTML = h;
    PP.renderChips();
  };
  PP.renderChips = function () {
    var d = S.doc;
    var a = S.primary ? d.palette[S.primary - 1] : null, b = S.secondary ? d.palette[S.secondary - 1] : null;
    $('chipPrimary').style.background = a || '';
    $('chipPrimary').classList.toggle('clear', !a);
    $('chipSecondary').style.background = b || '';
    $('chipSecondary').classList.toggle('clear', !b);
    $('hexOut').textContent = (a || 'clear') + ' / ' + (b || 'clear');
    PP.$$('#palSwatches .sw').forEach(function (s) {
      var v = +s.getAttribute('data-i');
      s.classList.toggle('is-a', v === S.primary && v !== 0);
      s.classList.toggle('is-b', v === S.secondary);
      s.setAttribute('aria-selected', v === S.primary ? 'true' : 'false');
    });
  };
  function setSlot(slot) {
    S.slot = slot;
    $('slotPrimary').classList.toggle('active', slot === 'primary');
    $('slotSecondary').classList.toggle('active', slot === 'secondary');
    $('slotPrimary').setAttribute('aria-pressed', slot === 'primary' ? 'true' : 'false');
    $('slotSecondary').setAttribute('aria-pressed', slot === 'secondary' ? 'true' : 'false');
    PP.sfx.click();
  }
  PP.swapColors = function () {
    var t = S.primary; S.primary = S.secondary || S.primary; S.secondary = t;
    if (!S.primary) S.primary = 1;
    PP.renderChips(); PP.sfx.click(); PP.requestRender();
  };
  function chooseColor(v, forceSecondary) {
    if (forceSecondary || S.slot === 'secondary') S.secondary = v;
    else if (v === 0) { S.secondary = 0; PP.toast('Transparent lives in slot B. Use the eraser for slot A vibes.'); }
    else S.primary = v;
    PP.sfx.pixel(v); PP.renderChips(); PP.requestRender();
  }
  function openEditor(mode) {
    var inp = $('palColorInput');
    editMode = mode; editCommitted = false;
    if (mode === 'edit') inp.value = (S.doc.palette[S.primary - 1] || '#ffffff').toLowerCase();
    else inp.value = '#ffffff';
    try { if (inp.showPicker) inp.showPicker(); else inp.click(); } catch (e) { inp.click(); }
  }
  function initPalette() {
    var box = $('palSwatches'), pressTimer = null, longPressed = false;
    box.addEventListener('click', function (e) {
      var s = e.target.closest('.sw'); if (!s) return;
      if (longPressed) { longPressed = false; return; }
      chooseColor(+s.getAttribute('data-i'));
    });
    box.addEventListener('contextmenu', function (e) {
      var s = e.target.closest('.sw'); if (!s) return;
      e.preventDefault(); chooseColor(+s.getAttribute('data-i'), true);
    });
    box.addEventListener('dblclick', function (e) {
      var s = e.target.closest('.sw'); if (!s || s.getAttribute('data-i') === '0') return;
      S.primary = +s.getAttribute('data-i'); openEditor('edit');
    });
    // long-press on touch = set secondary (tap equivalent of right-click)
    box.addEventListener('pointerdown', function (e) {
      var s = e.target.closest('.sw'); if (!s || e.pointerType === 'mouse') return;
      pressTimer = setTimeout(function () { longPressed = true; chooseColor(+s.getAttribute('data-i'), true); PP.toast('Long-press = colour B. You found the secret handshake.'); }, 480);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (n) { box.addEventListener(n, function () { clearTimeout(pressTimer); }); });

    $('slotPrimary').addEventListener('click', function () { setSlot('primary'); });
    $('slotSecondary').addEventListener('click', function () { setSlot('secondary'); });
    $('swapColors').addEventListener('click', PP.swapColors);
    $('palEdit').addEventListener('click', function () { if (S.primary) openEditor('edit'); });
    $('palAdd').addEventListener('click', function () {
      if (S.doc.palette.length >= PP.MAX_COLORS) { PP.toast('64 colours max. This is pixel art, not a paint store.', 'warn'); PP.sfx.err(); return; }
      openEditor('add');
    });
    $('palRemove').addEventListener('click', function () {
      if (S.doc.palette.length <= 1) { PP.toast('One colour must remain. Minimalism has limits.', 'warn'); PP.sfx.err(); return; }
      PP.commit(); PP.removeColor(S.primary); PP.emit('doc'); PP.emit('change');
      PP.toast('Colour removed — its pixels moved to the nearest neighbour.');
    });
    var inp = $('palColorInput');
    function applyEdit(final) {
      var hex = inp.value.toUpperCase(), d = S.doc;
      if (editMode === 'add') {
        if (!final) return;
        PP.commit(); d.palette.push(hex); S.paletteKey = 'custom'; S.primary = d.palette.length;
        editMode = null; PP.emit('doc'); PP.emit('change'); PP.toast('Colour ' + hex + ' joined the party.');
        return;
      }
      if (editMode !== 'edit' || !S.primary) return;
      if (!editCommitted) { PP.commit(); editCommitted = true; }
      d.palette[S.primary - 1] = hex; S.paletteKey = 'custom';
      PP.renderPalette(); PP.requestRender();
      if (final) { editMode = null; PP.emit('change'); PP.emit('doc'); }
    }
    inp.addEventListener('input', function () { applyEdit(false); });
    inp.addEventListener('change', function () { applyEdit(true); });
    $('palSelect').addEventListener('change', function (e) {
      var k = e.target.value, colors = presetColors(k);
      if (!colors) return;
      PP.commit();
      var keep = $('palKeep').checked;
      PP.setPalette(colors, k, keep);
      PP.emit('doc'); PP.emit('change');
      PP.sfx.jingle();
      PP.toast(keep ? 'Palette swapped by index — instant recolour!' : 'Remapped to the nearest colours in ' + (PP.PALETTES[k] ? PP.PALETTES[k].name : 'the new palette') + '.');
    });
  }

  /* ---------- layers ---------- */
  PP.renderLayers = function () {
    var d = S.doc, ul = $('layerList'), h = '';
    for (var i = d.layers.length - 1; i >= 0; i--) {
      var L = d.layers[i];
      h += '<li class="layer' + (i === S.layer ? ' active' : '') + (L.visible ? '' : ' hidden-layer') + '" data-l="' + i + '">' +
        '<button type="button" class="eye" data-act="eye" aria-pressed="' + L.visible + '" aria-label="' + (L.visible ? 'Hide' : 'Show') + ' ' + esc(L.name) + '">' + (L.visible ? '◉' : '○') + '</button>' +
        '<button type="button" class="lsel" data-act="sel" aria-current="' + (i === S.layer) + '" aria-label="Select ' + esc(L.name) + '"><canvas class="lthumb" width="32" height="32"></canvas><span class="lname">' + esc(L.name) + '</span></button>' +
        '<button type="button" class="ren" data-act="ren" aria-label="Rename ' + esc(L.name) + '">✎</button></li>';
    }
    ul.innerHTML = h;
    PP.updateLayerThumbs();
  };
  PP.updateLayerThumbs = function () {
    var d = S.doc;
    PP.$$('#layerList .layer').forEach(function (li) {
      var l = +li.getAttribute('data-l'), cv = li.querySelector('canvas');
      if (!cv || !d.layers[l]) return;
      drawThumb(cv, d.frames[S.frame].cells[l]);
    });
  };
  function drawThumb(cv, idx) {
    var d = S.doc, src = PP.indicesToCanvas(idx, d.w, d.h, d.palette);
    var x = cv.getContext('2d'), k = Math.min(cv.width / d.w, cv.height / d.h);
    x.clearRect(0, 0, cv.width, cv.height);
    x.imageSmoothingEnabled = false;
    x.drawImage(src, (cv.width - d.w * k) / 2, (cv.height - d.h * k) / 2, d.w * k, d.h * k);
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  PP.esc = esc;
  function initLayers() {
    $('layerList').addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var li = b.closest('.layer'), l = +li.getAttribute('data-l'), act = b.getAttribute('data-act'), d = S.doc;
      if (act === 'sel') { S.layer = l; PP.sfx.click(); PP.renderLayers(); }
      else if (act === 'eye') { PP.commit(); d.layers[l].visible = !d.layers[l].visible; PP.sfx.click(); PP.renderLayers(); PP.emit('change'); PP.requestRender(); }
      else if (act === 'ren') {
        var n = window.prompt('Rename layer', d.layers[l].name);
        if (n && n.trim()) { PP.commit(); d.layers[l].name = n.trim().slice(0, 24); PP.renderLayers(); PP.emit('change'); }
      }
    });
    $('layerAdd').addEventListener('click', function () { PP.commit(); if (PP.addLayer(false)) { PP.emit('doc'); PP.emit('change'); PP.sfx.tool(); } else { PP.dropLastCommit(); PP.toast('8 layers max. It\'s a lasagne, not a skyscraper.', 'warn'); PP.sfx.err(); } });
    $('layerDup').addEventListener('click', function () { PP.commit(); if (PP.addLayer(true)) { PP.emit('doc'); PP.emit('change'); PP.sfx.tool(); } else { PP.dropLastCommit(); PP.toast('Layer limit reached.', 'warn'); PP.sfx.err(); } });
    $('layerDel').addEventListener('click', function () { PP.commit(); if (PP.deleteLayer()) { PP.emit('doc'); PP.emit('change'); PP.sfx.undo(); } else { PP.dropLastCommit(); PP.toast('Can\'t delete the last layer. Something has to hold the pixels.', 'warn'); PP.sfx.err(); } });
    $('layerUp').addEventListener('click', function () { PP.commit(); if (PP.moveLayer(1)) { PP.emit('doc'); PP.emit('change'); PP.sfx.click(); } else PP.dropLastCommit(); });
    $('layerDown').addEventListener('click', function () { PP.commit(); if (PP.moveLayer(-1)) { PP.emit('doc'); PP.emit('change'); PP.sfx.click(); } else PP.dropLastCommit(); });
  }

  /* ---------- frames ---------- */
  PP.renderFrames = function () {
    var d = S.doc, ol = $('frameList'), h = '';
    d.frames.forEach(function (_, i) {
      h += '<li><button type="button" class="frame' + (i === S.frame ? ' active' : '') + '" data-f="' + i + '" aria-current="' + (i === S.frame) + '" aria-label="Frame ' + (i + 1) + '"><canvas width="48" height="48"></canvas><span>' + (i + 1) + '</span></button></li>';
    });
    ol.innerHTML = h;
    PP.updateFrameThumbs();
    var act = ol.querySelector('.frame.active');
    if (act && act.scrollIntoView) { try { act.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { } }
  };
  PP.updateFrameThumbs = function (only) {
    PP.$$('#frameList .frame').forEach(function (b) {
      var f = +b.getAttribute('data-f');
      if (only != null && f !== only) return;
      drawThumb(b.querySelector('canvas'), PP.composite(f));
    });
  };
  PP.selectFrame = function (f) {
    var n = S.doc.frames.length;
    S.frame = ((f % n) + n) % n;
    PP.$$('#frameList .frame').forEach(function (b) {
      var on = +b.getAttribute('data-f') === S.frame;
      b.classList.toggle('active', on); b.setAttribute('aria-current', on ? 'true' : 'false');
    });
    PP.updateLayerThumbs(); PP.requestRender();
  };
  function initFrames() {
    $('frameList').addEventListener('click', function (e) {
      var b = e.target.closest('.frame'); if (!b) return;
      if (S.playing) PP.emit('stopPlay');
      PP.selectFrame(+b.getAttribute('data-f')); PP.sfx.click();
    });
    function op(fn, okSfx, failMsg) {
      return function () {
        if (S.playing) PP.emit('stopPlay');
        PP.commit();
        if (fn()) { PP.emit('doc'); PP.emit('change'); okSfx(); }
        else { PP.dropLastCommit(); if (failMsg) { PP.toast(failMsg, 'warn'); PP.sfx.err(); } }
      };
    }
    $('frameAdd').addEventListener('click', op(function () { return PP.addFrame(false); }, PP.sfx.tool, '64 frames max. That\'s already a feature film in pixel years.'));
    $('frameDup').addEventListener('click', op(function () { return PP.addFrame(true); }, PP.sfx.tool, 'Frame limit reached.'));
    $('frameDel').addEventListener('click', op(PP.deleteFrame, PP.sfx.undo, 'One frame must remain. Even a still life needs a still.'));
    $('frameLeft').addEventListener('click', op(function () { return PP.moveFrame(-1); }, PP.sfx.click));
    $('frameRight').addEventListener('click', op(function () { return PP.moveFrame(1); }, PP.sfx.click));
    $('fpsInput').addEventListener('input', function (e) { S.doc.fps = +e.target.value; $('fpsVal').textContent = S.doc.fps; });
    $('fpsInput').addEventListener('change', function () { PP.emit('change'); });
  }

  /* ---------- dialogs ---------- */
  var SIZES = [8, 16, 24, 32, 48, 64, 96, 128];
  function initNew() {
    var w = $('newW'), h = $('newH'), opts = SIZES.map(function (s) { return '<option value="' + s + '">' + s + '</option>'; }).join('');
    w.innerHTML = opts; h.innerHTML = opts; w.value = '32'; h.value = '32';
    $('btnNew').addEventListener('click', function () {
      paletteOptions($('newPal'), false);
      $('newPal').value = presetColors(S.paletteKey) ? S.paletteKey : 'pico8';
      $('newTitle').value = 'Untitled';
      PP.openDialog($('dlgNew'));
    });
    $('newCancel').addEventListener('click', function () { PP.closeDialog($('dlgNew')); });
    $('newGo').addEventListener('click', function () {
      var k = $('newPal').value, colors = presetColors(k) || PP.PALETTES.pico8.colors;
      var d = PP.createDoc(+w.value, +h.value, colors, ($('newTitle').value || 'Untitled').trim());
      PP.closeDialog($('dlgNew'));
      PP.openDocument(d, { push: true, paletteKey: k });
      PP.sfx.jingle();
      PP.toast('Fresh cartridge inserted. The old one is one Back-button away.');
    });
    $('newForm').addEventListener('submit', function (e) { e.preventDefault(); $('newGo').click(); });
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (res, rej) {
      var ta = $('shareUrl'); ta.value = text; ta.focus(); ta.select();
      try { document.execCommand('copy') ? res() : rej(); } catch (e) { rej(e); }
    });
  }
  PP.copyText = copyText;
  function initShare() {
    $('btnShare').addEventListener('click', function () {
      var code = PP.encodeDoc(), url = PP.shareUrl(code);
      $('shareUrl').value = url;
      var kb = (url.length / 1024).toFixed(1);
      $('shareSize').textContent = url.length + ' characters (' + kb + ' KB). ' + (url.length > 8000 ? 'That\'s a chonky link — some chat apps may trim it. Export a project file as a backup.' : url.length > 2000 ? 'Medium-sized. Fits in most places that aren\'t a tweet.' : 'Tiny! Fits in a text message.');
      $('shareNative').hidden = !navigator.share;
      PP.openDialog($('dlgShare'));
      setTimeout(function () { $('shareUrl').select(); }, 50);
    });
    $('shareClose').addEventListener('click', function () { PP.closeDialog($('dlgShare')); });
    $('shareCopy').addEventListener('click', function () {
      copyText($('shareUrl').value).then(function () { PP.toast('Link copied. You are now holding a save file in your clipboard.', 'ok'); PP.sfx.jingle(); },
        function () { PP.toast('Copy blocked — select the link and copy it manually.', 'warn'); });
    });
    $('shareNative').addEventListener('click', function () {
      if (!navigator.share) return;
      navigator.share({ title: 'PixelPress: ' + S.doc.title, text: 'Open my pixel art (the link is the save file!)', url: $('shareUrl').value }).catch(function () { });
    });
    $('shareSaveGallery').addEventListener('click', function () { PP.saveToGallery(); });
  }

  function initExport() {
    function info() {
      var d = S.doc, s = +$('expScale').value, cap = PP.maxScaleFor(d.w, d.h), sc = Math.min(s, cap);
      $('expInfo').textContent = 'Output: ' + d.w * sc + '×' + d.h * sc + ' px per frame · ' + d.frames.length + ' frame' + (d.frames.length > 1 ? 's' : '') + ' @ ' + d.fps + ' fps' + (sc < s ? ' (scale capped to stay under 4096 px)' : '') + '.';
    }
    $('btnExport').addEventListener('click', function () { $('expCols').value = Math.min(8, S.doc.frames.length); info(); PP.openDialog($('dlgExport')); });
    $('expScale').addEventListener('change', info);
    $('expClose').addEventListener('click', function () { PP.closeDialog($('dlgExport')); });
    var name = function (ext) { return PP.safeName(S.doc.title) + ext; };
    $('expPng').addEventListener('click', function () {
      PP.exportPNG(+$('expScale').value, $('expBg').value, function (b) { PP.download(b, name('.png')); PP.sfx.jingle(); PP.toast('PNG exported. Frame it. Literally.', 'ok'); });
    });
    $('expSheet').addEventListener('click', function () {
      PP.exportSheet(+$('expScale').value, $('expBg').value, +$('expCols').value, function (b) { PP.download(b, name('-sheet.png')); PP.sfx.jingle(); PP.toast('Sprite sheet ready for your game engine.', 'ok'); });
    });
    $('expGif').addEventListener('click', function () {
      var btn = $('expGif'); btn.disabled = true; btn.textContent = 'Encoding…';
      setTimeout(function () {
        try {
          var b = PP.exportGIF(+$('expScale').value, $('expBg').value);
          PP.download(b, name('.gif')); PP.sfx.jingle();
          PP.toast('GIF encoded by hand-rolled LZW (' + Math.round(b.size / 1024) + ' KB). Pronounce it however you like.', 'ok');
        } catch (e) { console.warn(e); PP.toast('GIF encoding failed: ' + e.message, 'warn'); PP.sfx.err(); }
        btn.disabled = false; btn.textContent = 'Animated GIF';
      }, 30);
    });
    $('expJson').addEventListener('click', function () {
      PP.download(new Blob([PP.projectJSON()], { type: 'application/json' }), name('.pixelpress.json'));
      PP.toast('Project file saved — same data as your link, in a box.', 'ok');
    });
    $('expImport').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0]; if (!f) return;
      f.text().then(function (t) {
        var j = JSON.parse(t), d = PP.decodeDoc(j.code);
        PP.openDocument(d, { push: true }); PP.closeDialog($('dlgExport'));
        PP.toast('Project "' + d.title + '" loaded.', 'ok');
      }).catch(function () { PP.toast('That file isn\'t a PixelPress project. Nice try, though.', 'warn'); PP.sfx.err(); });
      e.target.value = '';
    });
  }

  /* ---------- gallery ---------- */
  function recordFor(doc, id) {
    return {
      id: id || ('pp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
      title: doc.title || 'Untitled', w: doc.w, h: doc.h, frames: doc.frames.length,
      code: PP.encodeDoc(doc), thumb: PP.thumbnail(doc, 0, 96).toDataURL('image/png'), updated: Date.now()
    };
  }
  PP.saveToGallery = function () {
    var rec = recordFor(S.doc, S.galleryId);
    S.galleryId = rec.id;
    return PP.store.put(rec).then(function () {
      PP.toast('Saved to My saves. Achievement unlocked: Archivist.', 'ok'); PP.sfx.jingle();
      if (!$('galMine').hidden) renderMine();
    }).catch(function () { PP.toast('Could not save locally (storage full or private mode). Your link still works!', 'warn'); PP.sfx.err(); });
  };
  function renderStarters() {
    var box = $('galStarter'), h = '';
    PP.STARTERS.forEach(function (sp, i) {
      var d = PP.starterDoc(i);
      h += '<button type="button" class="card" data-s="' + i + '"><img alt="" src="' + PP.thumbnail(d, 0, 96).toDataURL() + '" width="96" height="96"><b>' + esc(sp.title) + '</b><small>' + esc(sp.joke) + (d.frames.length > 1 ? ' · ' + d.frames.length + ' frames' : '') + '</small></button>';
    });
    box.innerHTML = h;
  }
  function renderMine() {
    var box = $('galMine');
    box.innerHTML = '<p class="empty">Loading cartridges…</p>';
    PP.store.all().then(function (list) {
      if (!list.length) { box.innerHTML = '<p class="empty">No saves yet. This shelf is emptier than a cartridge slot on a Sunday.<br>Hit <b>Save current</b> to start your collection.</p>'; return; }
      box.innerHTML = list.map(function (r) {
        var dt = new Date(r.updated || Date.now());
        return '<div class="card mine" data-id="' + esc(r.id) + '"><img alt="" src="' + esc(r.thumb || '') + '" width="96" height="96"><b>' + esc(r.title) + '</b><small>' + r.w + '×' + r.h + ' · ' + r.frames + 'f · ' + dt.toLocaleDateString() + '</small>' +
          '<span class="card-acts"><button type="button" class="mini wide" data-a="open">Open</button><button type="button" class="mini wide" data-a="link">Link</button><button type="button" class="mini danger" data-a="del" aria-label="Delete ' + esc(r.title) + '">✕</button></span></div>';
      }).join('');
      box._list = list;
    });
  }
  function initGallery() {
    function tab(which) {
      var mine = which === 'mine';
      $('tabStarter').setAttribute('aria-selected', mine ? 'false' : 'true');
      $('tabMine').setAttribute('aria-selected', mine ? 'true' : 'false');
      $('galStarter').hidden = mine; $('galMine').hidden = !mine;
      if (mine) renderMine();
      PP.sfx.click();
    }
    $('btnGallery').addEventListener('click', function () { renderStarters(); tab('starter'); PP.openDialog($('dlgGallery')); });
    $('tabStarter').addEventListener('click', function () { tab('starter'); });
    $('tabMine').addEventListener('click', function () { tab('mine'); });
    $('galClose').addEventListener('click', function () { PP.closeDialog($('dlgGallery')); });
    $('galSaveCurrent').addEventListener('click', function () { PP.saveToGallery().then(function () { tab('mine'); }); });
    $('galStarter').addEventListener('click', function (e) {
      var c = e.target.closest('.card'); if (!c) return;
      var d = PP.starterDoc(+c.getAttribute('data-s'));
      PP.openDocument(d, { push: true, paletteKey: 'pico8' });
      PP.closeDialog($('dlgGallery'));
      PP.toast('"' + d.title + '" loaded. Remix away — it\'s yours now.', 'ok');
    });
    $('galMine').addEventListener('click', function (e) {
      var b = e.target.closest('[data-a]'); if (!b) return;
      var card = b.closest('.card'), id = card.getAttribute('data-id'), list = $('galMine')._list || [];
      var rec = list.filter(function (r) { return r.id === id; })[0]; if (!rec) return;
      var a = b.getAttribute('data-a');
      if (a === 'open') {
        try { var d = PP.decodeDoc(rec.code); S.galleryId = rec.id; PP.openDocument(d, { push: true, keepGalleryId: true }); PP.closeDialog($('dlgGallery')); PP.toast('Loaded "' + rec.title + '".', 'ok'); }
        catch (err) { PP.toast('This save looks corrupted. Even cartridges get tired.', 'warn'); }
      } else if (a === 'link') {
        copyText(PP.shareUrl(rec.code)).then(function () { PP.toast('Link copied for "' + rec.title + '".', 'ok'); }, function () { PP.toast('Copy blocked by the browser.', 'warn'); });
      } else if (a === 'del') {
        if (!window.confirm('Delete "' + rec.title + '" from this browser? (Any links you shared still work.)')) return;
        PP.store.del(id).then(function () { if (S.galleryId === id) S.galleryId = null; renderMine(); PP.sfx.undo(); });
      }
    });
    $('galExportAll').addEventListener('click', function () {
      PP.store.all().then(function (list) {
        var data = { app: 'PixelPress', format: 1, kind: 'gallery', items: list.map(function (r) { return { title: r.title, code: r.code, updated: r.updated }; }) };
        PP.download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'pixelpress-gallery.json');
        PP.toast(list.length + ' artworks packed for travel.', 'ok');
      });
    });
    $('galImport').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0]; if (!f) return;
      f.text().then(function (t) {
        var j = JSON.parse(t), items = j.items || (j.code ? [j] : []), n = 0, jobs = [];
        items.forEach(function (it) {
          try { var d = PP.decodeDoc(it.code); var r = recordFor(d); if (it.updated) r.updated = it.updated; jobs.push(PP.store.put(r)); n++; } catch (err) { }
        });
        return Promise.all(jobs).then(function () { PP.toast('Imported ' + n + ' artwork' + (n === 1 ? '' : 's') + '.', 'ok'); tab('mine'); });
      }).catch(function () { PP.toast('Couldn\'t read that gallery file.', 'warn'); PP.sfx.err(); });
      e.target.value = '';
    });
  }

  PP.initPanels = function () {
    PP.initIcons();
    initTools(); initPalette(); initLayers(); initFrames();
    initNew(); initShare(); initExport(); initGallery();
    $('btnAbout').addEventListener('click', function () { PP.openDialog($('dlgAbout')); });
    $('aboutClose').addEventListener('click', function () { PP.closeDialog($('dlgAbout')); });
    // close dialogs by clicking the backdrop
    PP.$$('dialog').forEach(function (d) {
      d.addEventListener('click', function (e) { if (e.target === d) PP.closeDialog(d); });
    });
  };
})();
