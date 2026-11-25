/* PixelPress — document model, history, raster operations, compositing */
(function () {
  'use strict';
  var PP = window.PP;

  PP.MAX_LAYERS = 8;
  PP.MAX_FRAMES = 64;
  PP.MAX_COLORS = 64;

  PP.createDoc = function (w, h, colors, title) {
    return {
      w: w, h: h, title: title || 'Untitled', fps: 8,
      palette: colors.slice(0, PP.MAX_COLORS),
      layers: [{ name: 'Layer 1', visible: true }],
      frames: [{ cells: [new Uint8Array(w * h)] }]
    };
  };

  var S = PP.state = {
    doc: PP.createDoc(32, 32, PP.PALETTES.pico8.colors, 'Untitled'),
    paletteKey: 'pico8',
    frame: 0, layer: 0,
    tool: 'pencil', primary: 8, secondary: 0, slot: 'primary',
    size: 1, mirrorX: false, mirrorY: false, shapeFill: false,
    onion: true, grid: true, playing: false
  };

  PP.cell = function (f, l) {
    var d = S.doc;
    f = f == null ? S.frame : f; l = l == null ? S.layer : l;
    return d.frames[f].cells[l];
  };

  /* ---------- history (whole-document snapshots; cheap at pixel-art sizes) ---------- */
  var H = PP.history = { undo: [], redo: [] };
  function cloneDoc(d) {
    return {
      w: d.w, h: d.h, title: d.title, fps: d.fps,
      palette: d.palette.slice(),
      layers: d.layers.map(function (l) { return { name: l.name, visible: l.visible }; }),
      frames: d.frames.map(function (f) { return { cells: f.cells.map(function (c) { return c.slice(); }) }; })
    };
  }
  PP.cloneDoc = cloneDoc;
  function snap() { return { doc: cloneDoc(S.doc), frame: S.frame, layer: S.layer, paletteKey: S.paletteKey }; }
  function maxSteps() {
    var d = S.doc, bytes = d.w * d.h * d.frames.length * d.layers.length;
    return PP.clamp(Math.floor(48e6 / Math.max(1, bytes)), 8, 120);
  }
  PP.commit = function () {
    H.undo.push(snap());
    var m = maxSteps();
    while (H.undo.length > m) H.undo.shift();
    H.redo.length = 0;
    PP.emit('history');
  };
  PP.dropLastCommit = function () { H.undo.pop(); PP.emit('history'); };
  function restore(s) {
    S.doc = cloneDoc(s.doc);
    S.frame = PP.clamp(s.frame, 0, S.doc.frames.length - 1);
    S.layer = PP.clamp(s.layer, 0, S.doc.layers.length - 1);
    S.paletteKey = s.paletteKey;
    if (S.primary > S.doc.palette.length) S.primary = 1;
    if (S.secondary > S.doc.palette.length) S.secondary = 0;
  }
  PP.undo = function () {
    if (!H.undo.length) { PP.sfx.err(); return false; }
    H.redo.push(snap()); restore(H.undo.pop());
    PP.sfx.undo(); PP.emit('doc'); PP.emit('history');
    return true;
  };
  PP.redo = function () {
    if (!H.redo.length) { PP.sfx.err(); return false; }
    H.undo.push(snap()); restore(H.redo.pop());
    PP.sfx.redo(); PP.emit('doc'); PP.emit('history');
    return true;
  };
  PP.resetHistory = function () { H.undo.length = 0; H.redo.length = 0; PP.emit('history'); };

  /* ---------- load a whole new doc ---------- */
  PP.loadDoc = function (doc, opts) {
    opts = opts || {};
    if (!opts.keepHistory) PP.resetHistory();
    S.doc = doc;
    S.frame = 0; S.layer = Math.max(0, doc.layers.length - 1);
    S.paletteKey = opts.paletteKey || PP.guessPaletteKey(doc.palette);
    S.primary = Math.min(doc.palette.length, S.primary || 1) || 1;
    if (S.primary < 1) S.primary = 1;
    if (S.secondary > doc.palette.length) S.secondary = 0;
    S.playing = false;
    PP.emit('doc', { fresh: true });
  };
  PP.guessPaletteKey = function (colors) {
    var j = colors.join(',').toUpperCase();
    for (var k in PP.PALETTES) if (PP.PALETTES[k].colors.join(',').toUpperCase() === j) return k;
    if (PP.SECRET_PALETTE.colors.join(',').toUpperCase() === j) return 'secret';
    return 'custom';
  };

  /* ---------- pixel writing with mirror + dither ---------- */
  var touched = 0;
  PP.resetTouched = function () { touched = 0; };
  PP.getTouched = function () { return touched; };

  function setRaw(cell, x, y, v) {
    var d = S.doc;
    if (v < 0 || x < 0 || y < 0 || x >= d.w || y >= d.h) return;
    var i = y * d.w + x;
    if (cell[i] !== v) { cell[i] = v; touched++; }
  }
  /* value may be a number or a function(x,y) for patterns */
  function setPx(cell, x, y, v) {
    var d = S.doc;
    var pts = [[x, y]];
    if (S.mirrorX) pts.push([d.w - 1 - x, y]);
    if (S.mirrorY) pts.push([x, d.h - 1 - y]);
    if (S.mirrorX && S.mirrorY) pts.push([d.w - 1 - x, d.h - 1 - y]);
    for (var k = 0; k < pts.length; k++) {
      var px = pts[k][0], py = pts[k][1];
      setRaw(cell, px, py, typeof v === 'function' ? v(px, py) : v);
    }
  }
  PP.setPx = setPx;
  function stamp(cell, cx, cy, v, size) {
    size = size || 1;
    var off = Math.floor((size - 1) / 2);
    for (var dy = 0; dy < size; dy++) for (var dx = 0; dx < size; dx++) setPx(cell, cx - off + dx, cy - off + dy, v);
  }
  PP.stamp = stamp;

  PP.linePts = function (x0, y0, x1, y1) {
    var pts = [], dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy, guard = 0;
    while (guard++ < 100000) {
      pts.push([x0, y0]);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return pts;
  };
  PP.drawLine = function (cell, x0, y0, x1, y1, v, size) {
    PP.linePts(x0, y0, x1, y1).forEach(function (p) { stamp(cell, p[0], p[1], v, size); });
  };
  PP.drawRect = function (cell, x0, y0, x1, y1, v, size, filled) {
    var ax = Math.min(x0, x1), bx = Math.max(x0, x1), ay = Math.min(y0, y1), by = Math.max(y0, y1), x, y;
    if (filled) { for (y = ay; y <= by; y++) for (x = ax; x <= bx; x++) setPx(cell, x, y, v); return; }
    for (x = ax; x <= bx; x++) { stamp(cell, x, ay, v, size); stamp(cell, x, by, v, size); }
    for (y = ay; y <= by; y++) { stamp(cell, ax, y, v, size); stamp(cell, bx, y, v, size); }
  };
  PP.drawEllipse = function (cell, x0, y0, x1, y1, v, size, filled) {
    var ax = Math.min(x0, x1), bx = Math.max(x0, x1), ay = Math.min(y0, y1), by = Math.max(y0, y1);
    var rx = (bx - ax + 1) / 2, ry = (by - ay + 1) / 2, cx = ax + rx, cy = ay + ry;
    function inside(x, y) {
      if (x < ax || x > bx || y < ay || y > by) return false;
      var nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      return nx * nx + ny * ny <= 1.0001;
    }
    for (var y = ay; y <= by; y++) for (var x = ax; x <= bx; x++) {
      if (!inside(x, y)) continue;
      if (filled) setPx(cell, x, y, v);
      else if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) stamp(cell, x, y, v, size);
    }
  };
  function floodOne(cell, sx, sy, v) {
    var d = S.doc, w = d.w, h = d.h;
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;
    var target = cell[sy * w + sx];
    var test = typeof v === 'function' ? null : v;
    if (test === target) return;
    var seen = new Uint8Array(w * h), stack = [sx, sy];
    while (stack.length) {
      var y = stack.pop(), x = stack.pop();
      var i = y * w + x;
      if (seen[i] || cell[i] !== target) continue;
      seen[i] = 1;
      setRaw(cell, x, y, typeof v === 'function' ? v(x, y) : v);
      if (x > 0) stack.push(x - 1, y);
      if (x < w - 1) stack.push(x + 1, y);
      if (y > 0) stack.push(x, y - 1);
      if (y < h - 1) stack.push(x, y + 1);
    }
  }
  PP.flood = function (cell, x, y, v) {
    var d = S.doc;
    floodOne(cell, x, y, v);
    if (S.mirrorX) floodOne(cell, d.w - 1 - x, y, v);
    if (S.mirrorY) floodOne(cell, x, d.h - 1 - y, v);
    if (S.mirrorX && S.mirrorY) floodOne(cell, d.w - 1 - x, d.h - 1 - y, v);
  };
  PP.ditherValue = function (a, b) { return function (x, y) { return ((x + y) & 1) ? b : a; }; };

  /* ---------- compositing ---------- */
  PP.composite = function (f, docArg) {
    var d = docArg || S.doc, out = new Uint8Array(d.w * d.h), fr = d.frames[f];
    for (var l = 0; l < d.layers.length; l++) {
      if (!d.layers[l].visible) continue;
      var c = fr.cells[l];
      for (var i = 0; i < out.length; i++) if (c[i]) out[i] = c[i];
    }
    return out;
  };
  PP.pickAt = function (x, y) {
    var d = S.doc;
    if (x < 0 || y < 0 || x >= d.w || y >= d.h) return -1;
    var comp = PP.composite(S.frame);
    return comp[y * d.w + x];
  };
  /* RGBA lookup: index 0 = transparent */
  PP.lut = function (palette) {
    var lut = new Uint32Array(256), le = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
    for (var i = 0; i < palette.length; i++) {
      var c = PP.hexToRgb(palette[i]);
      lut[i + 1] = le ? ((255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0 : ((c[0] << 24) | (c[1] << 16) | (c[2] << 8) | 255) >>> 0;
    }
    return lut;
  };
  /* paint indices into a canvas of size w×h */
  PP.indicesToCanvas = function (idx, w, h, palette, canvas) {
    canvas = canvas || document.createElement('canvas');
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    var ctx = canvas.getContext('2d'), img = ctx.createImageData(w, h), u32 = new Uint32Array(img.data.buffer), lut = PP.lut(palette);
    for (var i = 0; i < idx.length; i++) u32[i] = lut[idx[i]];
    ctx.putImageData(img, 0, 0);
    return canvas;
  };
  PP.thumbnail = function (docArg, f, size) {
    var d = docArg || S.doc, c = PP.indicesToCanvas(PP.composite(f || 0, d), d.w, d.h, d.palette);
    var t = document.createElement('canvas'), s = size || 96, k = Math.max(1, Math.floor(s / Math.max(d.w, d.h)));
    t.width = d.w * k; t.height = d.h * k;
    var x = t.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(c, 0, 0, t.width, t.height);
    return t;
  };

  /* ---------- palette ops ---------- */
  function nearest(rgb, colors) {
    var best = 0, bd = 1e9;
    for (var i = 0; i < colors.length; i++) {
      var c = PP.hexToRgb(colors[i]);
      var dr = c[0] - rgb[0], dg = c[1] - rgb[1], db = c[2] - rgb[2];
      var dd = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
      if (dd < bd) { bd = dd; best = i; }
    }
    return best;
  }
  PP.nearestIndex = nearest;
  function remapAll(map) {
    S.doc.frames.forEach(function (f) { f.cells.forEach(function (c) { for (var i = 0; i < c.length; i++) c[i] = map[c[i]]; }); });
  }
  PP.setPalette = function (colors, key, keepIndices) {
    var d = S.doc, old = d.palette, map = new Uint8Array(256);
    colors = colors.slice(0, PP.MAX_COLORS);
    for (var i = 1; i <= old.length; i++) {
      if (keepIndices && i <= colors.length) map[i] = i;
      else map[i] = nearest(PP.hexToRgb(old[i - 1]), colors) + 1;
    }
    remapAll(map);
    d.palette = colors;
    S.paletteKey = key || 'custom';
    S.primary = S.primary ? (map[S.primary] || 1) : 0;
    S.secondary = S.secondary ? (map[S.secondary] || 0) : 0;
    if (S.primary < 1 || S.primary > colors.length) S.primary = 1;
  };
  PP.removeColor = function (idx) {
    var d = S.doc;
    if (d.palette.length <= 1) return false;
    var rest = d.palette.filter(function (_, i) { return i !== idx - 1; });
    var map = new Uint8Array(256);
    for (var i = 1; i <= d.palette.length; i++) {
      if (i === idx) map[i] = nearest(PP.hexToRgb(d.palette[i - 1]), rest) + 1;
      else map[i] = i < idx ? i : i - 1;
    }
    remapAll(map);
    d.palette = rest;
    S.paletteKey = 'custom';
    S.primary = PP.clamp(map[S.primary] || 1, 1, rest.length);
    S.secondary = S.secondary ? map[S.secondary] : 0;
    return true;
  };

  /* ---------- layers ---------- */
  PP.addLayer = function (dup) {
    var d = S.doc;
    if (d.layers.length >= PP.MAX_LAYERS) return false;
    var at = S.layer + 1;
    d.layers.splice(at, 0, { name: dup ? d.layers[S.layer].name + ' copy' : 'Layer ' + (d.layers.length + 1), visible: true });
    d.frames.forEach(function (f) { f.cells.splice(at, 0, dup ? f.cells[S.layer].slice() : new Uint8Array(d.w * d.h)); });
    S.layer = at;
    return true;
  };
  PP.deleteLayer = function () {
    var d = S.doc;
    if (d.layers.length <= 1) return false;
    d.layers.splice(S.layer, 1);
    d.frames.forEach(function (f) { f.cells.splice(S.layer, 1); });
    S.layer = PP.clamp(S.layer - 1, 0, d.layers.length - 1);
    return true;
  };
  PP.moveLayer = function (dir) {
    var d = S.doc, to = S.layer + dir;
    if (to < 0 || to >= d.layers.length) return false;
    var t = d.layers[to]; d.layers[to] = d.layers[S.layer]; d.layers[S.layer] = t;
    d.frames.forEach(function (f) { var c = f.cells[to]; f.cells[to] = f.cells[S.layer]; f.cells[S.layer] = c; });
    S.layer = to;
    return true;
  };

  /* ---------- frames ---------- */
  PP.addFrame = function (dup) {
    var d = S.doc;
    if (d.frames.length >= PP.MAX_FRAMES) return false;
    var src = d.frames[S.frame];
    var nf = { cells: d.layers.map(function (_, l) { return dup ? src.cells[l].slice() : new Uint8Array(d.w * d.h); }) };
    d.frames.splice(S.frame + 1, 0, nf);
    S.frame++;
    return true;
  };
  PP.deleteFrame = function () {
    var d = S.doc;
    if (d.frames.length <= 1) return false;
    d.frames.splice(S.frame, 1);
    S.frame = PP.clamp(S.frame - 1, 0, d.frames.length - 1);
    if (S.frame < 0) S.frame = 0;
    return true;
  };
  PP.moveFrame = function (dir) {
    var d = S.doc, to = S.frame + dir;
    if (to < 0 || to >= d.frames.length) return false;
    var t = d.frames[to]; d.frames[to] = d.frames[S.frame]; d.frames[S.frame] = t;
    S.frame = to;
    return true;
  };

  /* shift current layer cell by dx,dy from a base copy (no wrap) */
  PP.shiftCell = function (cell, base, dx, dy) {
    var d = S.doc, w = d.w, h = d.h;
    cell.fill(0);
    for (var y = 0; y < h; y++) {
      var sy = y - dy;
      if (sy < 0 || sy >= h) continue;
      for (var x = 0; x < w; x++) {
        var sx = x - dx;
        if (sx < 0 || sx >= w) continue;
        cell[y * w + x] = base[sy * w + sx];
      }
    }
  };

  PP.isEmptyDoc = function () {
    var d = S.doc;
    for (var f = 0; f < d.frames.length; f++) for (var l = 0; l < d.layers.length; l++) {
      var c = d.frames[f].cells[l];
      for (var i = 0; i < c.length; i++) if (c[i]) return false;
    }
    return true;
  };
})();
