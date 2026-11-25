/* PixelPress — canvas view: rendering, zoom/pan/pinch, pointer drawing */
(function () {
  'use strict';
  var PP = window.PP, S = PP.state;
  var V = PP.view = { zoom: 8, panX: 0, panY: 0, hover: null, W: 300, H: 300, space: false };
  var ZOOMS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64];
  var canvas, stage, ctx, buf, tintBuf, checker = null, queued = false;

  function art(e) {
    var r = canvas.getBoundingClientRect();
    var sx = e.clientX - r.left, sy = e.clientY - r.top;
    return { sx: sx, sy: sy, x: Math.floor((sx - V.panX) / V.zoom), y: Math.floor((sy - V.panY) / V.zoom) };
  }

  PP.requestRender = function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; draw(); });
  };

  function resize() {
    var r = stage.getBoundingClientRect(), dpr = PP.dpr();
    V.W = Math.max(50, Math.round(r.width)); V.H = Math.max(50, Math.round(r.height));
    canvas.width = Math.round(V.W * dpr); canvas.height = Math.round(V.H * dpr);
    canvas.style.width = V.W + 'px'; canvas.style.height = V.H + 'px';
    checker = null;
    PP.requestRender();
  }
  V.fit = function () {
    var d = S.doc, k = Math.min(V.W / d.w, V.H / d.h) * 0.88;
    var z = k >= 1 ? Math.floor(k) : 1;
    V.zoom = PP.clamp(z, 1, 64);
    V.panX = Math.round((V.W - d.w * V.zoom) / 2);
    V.panY = Math.round((V.H - d.h * V.zoom) / 2);
    PP.requestRender(); hud();
  };
  V.zoomTo = function (z, cx, cy) {
    z = PP.clamp(z, 1, 64);
    if (cx == null) { cx = V.W / 2; cy = V.H / 2; }
    var ax = (cx - V.panX) / V.zoom, ay = (cy - V.panY) / V.zoom;
    V.zoom = z;
    V.panX = Math.round(cx - ax * z); V.panY = Math.round(cy - ay * z);
    PP.requestRender(); hud();
  };
  V.zoomStep = function (dir, cx, cy) {
    var z = V.zoom, i, nz = z;
    if (dir > 0) { for (i = 0; i < ZOOMS.length; i++) if (ZOOMS[i] > z + 0.01) { nz = ZOOMS[i]; break; } }
    else { for (i = ZOOMS.length - 1; i >= 0; i--) if (ZOOMS[i] < z - 0.01) { nz = ZOOMS[i]; break; } }
    if (nz !== z) PP.sfx.tone(dir > 0 ? 880 : 440, 0.04, 'square', 0, 0.4);
    V.zoomTo(nz, cx, cy);
  };
  V.pan = function (dx, dy) { V.panX += dx; V.panY += dy; PP.requestRender(); };

  function hud() {
    var el = PP.byId('hud'), d = S.doc, h = V.hover;
    if (!el) return;
    var pos = h && h.x >= 0 && h.y >= 0 && h.x < d.w && h.y < d.h ? h.x + ',' + h.y : '–,–';
    el.textContent = pos + ' · ' + d.w + '×' + d.h + ' · ' + (Math.round(V.zoom * 10) / 10) + '× · F' + (S.frame + 1) + '/' + d.frames.length;
  }
  PP.updateHud = hud;

  function checkerPattern() {
    if (checker) return checker;
    var c = document.createElement('canvas'), s = Math.round(8 * PP.dpr());
    c.width = c.height = s * 2;
    var x = c.getContext('2d');
    var cs = getComputedStyle(document.body);
    x.fillStyle = cs.getPropertyValue('--check-a').trim() || '#2b2b38'; x.fillRect(0, 0, s * 2, s * 2);
    x.fillStyle = cs.getPropertyValue('--check-b').trim() || '#353546'; x.fillRect(0, 0, s, s); x.fillRect(s, s, s, s);
    checker = ctx.createPattern(c, 'repeat');
    return checker;
  }
  PP.resetChecker = function () { checker = null; PP.requestRender(); };

  function tinted(src, color) {
    if (!tintBuf) tintBuf = document.createElement('canvas');
    tintBuf.width = src.width; tintBuf.height = src.height;
    var t = tintBuf.getContext('2d');
    t.globalCompositeOperation = 'source-over';
    t.clearRect(0, 0, src.width, src.height);
    t.drawImage(src, 0, 0);
    t.globalCompositeOperation = 'source-atop';
    t.globalAlpha = 0.55; t.fillStyle = color; t.fillRect(0, 0, src.width, src.height);
    t.globalAlpha = 1; t.globalCompositeOperation = 'source-over';
    return tintBuf;
  }

  function draw() {
    if (!ctx) return;
    var d = S.doc, dpr = PP.dpr(), z = V.zoom, x0 = V.panX, y0 = V.panY, aw = d.w * z, ah = d.h * z;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    // glow under the art
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
    ctx.fillStyle = checkerPattern();
    ctx.fillRect(x0, y0, aw, ah);
    ctx.restore();
    var n = d.frames.length;
    if (S.onion && n > 1 && !S.playing) {
      if (S.frame > 0) {
        var pc = PP.indicesToCanvas(PP.composite(S.frame - 1), d.w, d.h, d.palette);
        ctx.globalAlpha = 0.38; ctx.drawImage(tinted(pc, '#ff3b6b'), x0, y0, aw, ah);
      }
      if (S.frame < n - 1) {
        var nc = PP.indicesToCanvas(PP.composite(S.frame + 1), d.w, d.h, d.palette);
        ctx.globalAlpha = 0.22; ctx.drawImage(tinted(nc, '#3bd1ff'), x0, y0, aw, ah);
      }
      ctx.globalAlpha = 1;
    }
    buf = PP.indicesToCanvas(PP.composite(S.frame), d.w, d.h, d.palette, buf);
    ctx.drawImage(buf, x0, y0, aw, ah);

    // grid
    if (S.grid && z >= 6) {
      var lw = 1 / dpr, i;
      ctx.lineWidth = lw;
      ctx.beginPath();
      for (i = 1; i < d.w; i++) if (i % 8) { ctx.moveTo(x0 + i * z, y0); ctx.lineTo(x0 + i * z, y0 + ah); }
      for (i = 1; i < d.h; i++) if (i % 8) { ctx.moveTo(x0, y0 + i * z); ctx.lineTo(x0 + aw, y0 + i * z); }
      ctx.strokeStyle = 'rgba(255,255,255,.09)'; ctx.stroke();
      ctx.beginPath();
      for (i = 8; i < d.w; i += 8) { ctx.moveTo(x0 + i * z, y0); ctx.lineTo(x0 + i * z, y0 + ah); }
      for (i = 8; i < d.h; i += 8) { ctx.moveTo(x0, y0 + i * z); ctx.lineTo(x0 + aw, y0 + i * z); }
      ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.stroke();
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.strokeRect(x0 - 0.5, y0 - 0.5, aw + 1, ah + 1);

    // mirror axes
    var accent = getAccent();
    if (S.mirrorX || S.mirrorY) {
      ctx.save(); ctx.setLineDash([6, 5]); ctx.strokeStyle = accent; ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (S.mirrorX) { ctx.moveTo(x0 + aw / 2, y0 - 8); ctx.lineTo(x0 + aw / 2, y0 + ah + 8); }
      if (S.mirrorY) { ctx.moveTo(x0 - 8, y0 + ah / 2); ctx.lineTo(x0 + aw + 8, y0 + ah / 2); }
      ctx.stroke(); ctx.restore();
    }

    // hover brush preview
    var h = V.hover, t = S.tool;
    if (h && t !== 'hand' && t !== 'move' && mode !== 'pan' && mode !== 'pinch') {
      var size = (t === 'fill' || t === 'picker') ? 1 : S.size, off = Math.floor((size - 1) / 2);
      var pts = [[h.x - off, h.y - off]];
      if (S.mirrorX) pts.push([d.w - (h.x - off) - size, h.y - off]);
      if (S.mirrorY) pts.push([h.x - off, d.h - (h.y - off) - size]);
      if (S.mirrorX && S.mirrorY) pts.push([d.w - (h.x - off) - size, d.h - (h.y - off) - size]);
      var col = t === 'eraser' ? 'rgba(255,255,255,.25)' : (S.primary ? d.palette[S.primary - 1] : 'rgba(255,255,255,.25)');
      pts.forEach(function (p, k) {
        ctx.globalAlpha = k ? 0.35 : 0.6;
        ctx.fillStyle = col; ctx.fillRect(x0 + p[0] * z, y0 + p[1] * z, size * z, size * z);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = k ? accent : '#fff';
        ctx.strokeRect(x0 + p[0] * z + 0.5, y0 + p[1] * z + 0.5, size * z - 1, size * z - 1);
      });
    }
    hud();
  }
  var accentCache = null;
  function getAccent() {
    if (!accentCache) accentCache = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#ffd166';
    return accentCache;
  }
  PP.resetAccent = function () { accentCache = null; checker = null; PP.requestRender(); };

  /* ---------------- input ---------------- */
  var pointers = new Map(), mode = null, stroke = null, panStart = null, pinch = null, wheelAcc = 0;

  function valueFor(tool, alt) {
    var a = alt ? S.secondary : S.primary, b = alt ? S.primary : S.secondary;
    if (tool === 'eraser') return 0;
    if (tool === 'dither') return PP.ditherValue(a, b === 0 ? -1 : b);
    return a;
  }
  function snap45(s, p) {
    var dx = p.x - s.x, dy = p.y - s.y, ax = Math.abs(dx), ay = Math.abs(dy);
    if (ax > ay * 2) return { x: p.x, y: s.y };
    if (ay > ax * 2) return { x: s.x, y: p.y };
    var m = Math.max(ax, ay);
    return { x: s.x + Math.sign(dx) * m, y: s.y + Math.sign(dy) * m };
  }
  function squareEnd(s, p) {
    var dx = p.x - s.x, dy = p.y - s.y, m = Math.max(Math.abs(dx), Math.abs(dy));
    return { x: s.x + (dx < 0 ? -m : m), y: s.y + (dy < 0 ? -m : m) };
  }
  function soundFor(tool, v) {
    if (tool === 'eraser') PP.sfx.erase();
    else PP.sfx.pixel(typeof v === 'number' ? v : S.primary);
  }

  function pick(p) {
    var v = PP.pickAt(p.x, p.y);
    if (v < 0) return;
    if (stroke && stroke.alt) S.secondary = v; else if (v > 0) S.primary = v; else S.secondary = 0;
    PP.emit('colors');
  }

  function startStroke(e, p) {
    var d = S.doc, tool = S.tool;
    var alt = e.button === 2;
    if (tool === 'picker') { stroke = { alt: alt }; mode = 'pick'; pick(p); return; }
    if (!d.layers[S.layer].visible) { PP.toast('That layer is hidden. Drawing on invisible ink is a bold strategy.', 'warn'); PP.sfx.err(); return; }
    var cell = PP.cell();
    PP.commit();
    stroke = { tool: tool, start: p, last: p, base: cell.slice(), alt: alt, shift: e.shiftKey };
    PP.resetTouched();
    var v = valueFor(tool, alt);
    if (tool === 'fill') {
      PP.flood(cell, p.x, p.y, v);
      PP.sfx.fill();
      mode = 'draw';
      PP.emit('pixels');
      return;
    }
    mode = 'draw';
    applyStroke(p, e.shiftKey);
  }
  function applyStroke(p, shift) {
    var s = stroke, cell = PP.cell(), v = valueFor(s.tool, s.alt), before = PP.getTouched(), end;
    switch (s.tool) {
      case 'pencil': case 'eraser': case 'dither':
        PP.drawLine(cell, s.last.x, s.last.y, p.x, p.y, v, S.size); s.last = p; break;
      case 'line':
        cell.set(s.base); end = shift ? snap45(s.start, p) : p;
        PP.drawLine(cell, s.start.x, s.start.y, end.x, end.y, v, S.size); break;
      case 'rect':
        cell.set(s.base); end = shift ? squareEnd(s.start, p) : p;
        PP.drawRect(cell, s.start.x, s.start.y, end.x, end.y, v, S.size, S.shapeFill); break;
      case 'circle':
        cell.set(s.base); end = shift ? squareEnd(s.start, p) : p;
        PP.drawEllipse(cell, s.start.x, s.start.y, end.x, end.y, v, S.size, S.shapeFill); break;
      case 'move':
        PP.shiftCell(cell, s.base, p.x - s.start.x, p.y - s.start.y); break;
      case 'fill': break;
    }
    if (PP.getTouched() > before) soundFor(s.tool, v);
    PP.emit('pixels');
  }
  function sameArr(a, b) { for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }
  function finishStroke() {
    if (stroke && stroke.base) {
      if (sameArr(PP.cell(), stroke.base)) PP.dropLastCommit();
      else PP.emit('change');
    }
    stroke = null;
  }
  function cancelStroke() {
    if (mode === 'draw' && stroke && stroke.base) {
      PP.cell().set(stroke.base);
      PP.dropLastCommit();
      PP.emit('pixels');
    }
    stroke = null;
  }
  function startPinch() {
    var pts = Array.from(pointers.values());
    var a = pts[0], b = pts[1];
    pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, z0: V.zoom, px: V.panX, py: V.panY };
    mode = 'pinch';
  }
  function updatePinch() {
    var pts = Array.from(pointers.values());
    if (pts.length < 2 || !pinch) return;
    var a = pts[0], b = pts[1], dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    var cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
    var z = PP.clamp(pinch.z0 * dist / pinch.d0, 1, 64);
    var ax = (pinch.cx - pinch.px) / pinch.z0, ay = (pinch.cy - pinch.py) / pinch.z0;
    V.zoom = z; V.panX = cx - ax * z; V.panY = cy - ay * z;
    PP.requestRender();
  }
  function localXY(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  function onDown(e) {
    if (e.pointerType === 'mouse' && e.button > 2) return;
    PP.emit('userGesture');
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
    pointers.set(e.pointerId, localXY(e));
    if (pointers.size === 2) { if (mode === 'draw' || mode === 'pick') cancelStroke(); startPinch(); return; }
    if (pointers.size > 2) return;
    var p = art(e);
    V.hover = e.pointerType === 'mouse' ? p : null;
    if (e.button === 1 || S.tool === 'hand' || V.space) {
      mode = 'pan'; panStart = { x: p.sx, y: p.sy, px: V.panX, py: V.panY };
      stage.classList.add('panning');
      e.preventDefault();
      return;
    }
    if (S.playing) PP.emit('stopPlay');
    startStroke(e, p);
    e.preventDefault();
  }
  function onMove(e) {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, localXY(e));
    if (mode === 'pinch') { updatePinch(); return; }
    var p = art(e);
    if (e.pointerType === 'mouse' || mode === 'draw') V.hover = p;
    if (mode === 'pan' && panStart) { V.panX = panStart.px + (p.sx - panStart.x); V.panY = panStart.py + (p.sy - panStart.y); PP.requestRender(); return; }
    if (mode === 'pick') { pick(p); return; }
    if (mode === 'draw' && stroke && stroke.tool !== 'fill') {
      var evs = (e.getCoalescedEvents && stroke.tool === 'pencil') ? e.getCoalescedEvents() : null;
      if (evs && evs.length > 1) evs.forEach(function (ce) { applyStroke(art(ce), e.shiftKey); });
      else applyStroke(p, e.shiftKey);
      return;
    }
    PP.requestRender();
  }
  function onUp(e) {
    pointers.delete(e.pointerId);
    if (mode === 'pinch') {
      if (pointers.size < 2) {
        var r = Math.round(V.zoom);
        if (Math.abs(r - V.zoom) > 0.01 && pinch) {
          var pts = Array.from(pointers.values()), cx = V.W / 2, cy = V.H / 2;
          if (pts.length) { cx = pts[0].x; cy = pts[0].y; }
          V.zoomTo(Math.max(1, r), cx, cy);
        }
        pinch = null; mode = pointers.size ? 'wait' : null;
      }
      return;
    }
    if (pointers.size) return;
    if (mode === 'draw') finishStroke();
    if (mode === 'pan') stage.classList.remove('panning');
    mode = null; stroke = null; panStart = null;
    if (e.pointerType !== 'mouse') V.hover = null;
    PP.requestRender();
  }
  function onLeave(e) { if (e.pointerType === 'mouse' && !pointers.size) { V.hover = null; PP.requestRender(); } }
  function onWheel(e) {
    e.preventDefault();
    var p = localXY(e);
    if (!e.ctrlKey && Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.5) { V.pan(-e.deltaX, 0); return; }
    wheelAcc += e.deltaY * (e.deltaMode === 1 ? 33 : 1);
    if (Math.abs(wheelAcc) >= (e.ctrlKey ? 18 : 45)) { V.zoomStep(wheelAcc < 0 ? 1 : -1, p.x, p.y); wheelAcc = 0; }
  }

  PP.isDrawing = function () { return mode === 'draw'; };

  PP.initView = function () {
    canvas = PP.byId('view'); stage = PP.byId('stage');
    ctx = canvas.getContext('2d');
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    // Safari gesture events would otherwise zoom the page
    ['gesturestart', 'gesturechange'].forEach(function (n) { stage.addEventListener(n, function (e) { e.preventDefault(); }); });
    if (window.ResizeObserver) new ResizeObserver(function () { resize(); }).observe(stage);
    else window.addEventListener('resize', resize);
    resize();
    PP.on('pixels', PP.requestRender);
  };
})();
