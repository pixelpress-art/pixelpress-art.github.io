/* PixelPress — hand-written GIF89a encoder (LZW, no library) + PNG / sprite-sheet export */
(function () {
  'use strict';
  var PP = window.PP;

  function ByteOut() { this.b = new Uint8Array(4096); this.n = 0; }
  ByteOut.prototype.ensure = function (k) {
    if (this.n + k <= this.b.length) return;
    var nb = new Uint8Array(Math.max(this.b.length * 2, this.n + k)); nb.set(this.b); this.b = nb;
  };
  ByteOut.prototype.u8 = function (v) { this.ensure(1); this.b[this.n++] = v & 255; };
  ByteOut.prototype.u16 = function (v) { this.u8(v & 255); this.u8((v >> 8) & 255); };
  ByteOut.prototype.str = function (s) { for (var i = 0; i < s.length; i++) this.u8(s.charCodeAt(i)); };
  ByteOut.prototype.done = function () { return this.b.slice(0, this.n); };

  /* LZW compress an index stream; writes min code size + data sub-blocks + terminator */
  function lzw(out, idx, minCode) {
    var clear = 1 << minCode, eoi = clear + 1;
    var codeSize = minCode + 1, next = eoi + 1;
    var dict = new Map();
    var cur = 0, curBits = 0;
    var block = new Uint8Array(255), bl = 0;
    out.u8(minCode);
    function flushBlock() { if (!bl) return; out.u8(bl); for (var i = 0; i < bl; i++) out.u8(block[i]); bl = 0; }
    function emitByte(b) { block[bl++] = b; if (bl === 255) flushBlock(); }
    function write(code) {
      cur |= code << curBits; curBits += codeSize;
      while (curBits >= 8) { emitByte(cur & 255); cur >>>= 8; curBits -= 8; }
    }
    write(clear);
    var prefix = idx[0];
    for (var i = 1; i < idx.length; i++) {
      var k = idx[i], key = (prefix << 8) | k, hit = dict.get(key);
      if (hit !== undefined) { prefix = hit; continue; }
      write(prefix);
      if (next === 4096) {
        write(clear);
        dict.clear(); next = eoi + 1; codeSize = minCode + 1;
      } else {
        if (next >= (1 << codeSize)) codeSize++;
        dict.set(key, next++);
      }
      prefix = k;
    }
    write(prefix);
    write(eoi);
    if (curBits > 0) emitByte(cur & 255);
    flushBlock();
    out.u8(0);
  }
  PP._lzw = lzw;

  /* frames: array of Uint8Array (indices 0..n, where 0 = background/transparent)
     colors: palette hex list for indices 1..n; bg: null (transparent) or hex */
  PP.encodeGIF = function (frames, w, h, colors, delayCs, bg) {
    var entries = colors.length + 1, bits = 1;
    while ((1 << bits) < entries) bits++;
    var tableSize = 1 << bits, minCode = Math.max(2, bits);
    var o = new ByteOut();
    o.str('GIF89a');
    o.u16(w); o.u16(h);
    o.u8(0x80 | ((bits - 1) << 4) | (bits - 1));
    o.u8(0); o.u8(0);
    var bgc = bg ? PP.hexToRgb(bg) : [0, 0, 0];
    for (var i = 0; i < tableSize; i++) {
      var c = i === 0 ? bgc : (i <= colors.length ? PP.hexToRgb(colors[i - 1]) : [0, 0, 0]);
      o.u8(c[0]); o.u8(c[1]); o.u8(c[2]);
    }
    if (frames.length > 1) { // NETSCAPE2.0 looping extension
      o.u8(0x21); o.u8(0xFF); o.u8(11); o.str('NETSCAPE2.0'); o.u8(3); o.u8(1); o.u16(0); o.u8(0);
    }
    frames.forEach(function (idx) {
      o.u8(0x21); o.u8(0xF9); o.u8(4);
      o.u8((2 << 2) | (bg ? 0 : 1)); // disposal: restore to background; transparency flag
      o.u16(delayCs); o.u8(0); o.u8(0);
      o.u8(0x2C); o.u16(0); o.u16(0); o.u16(w); o.u16(h); o.u8(0);
      lzw(o, idx, minCode);
    });
    o.u8(0x3B);
    return o.done();
  };

  function scaleIdx(src, w, h, s) {
    if (s === 1) return src;
    var W = w * s, out = new Uint8Array(W * h * s);
    for (var y = 0; y < h; y++) {
      var row = new Uint8Array(W);
      for (var x = 0; x < w; x++) row.fill(src[y * w + x], x * s, x * s + s);
      for (var k = 0; k < s; k++) out.set(row, (y * s + k) * W);
    }
    return out;
  }
  PP.scaleIdx = scaleIdx;

  function bgHex(mode) {
    var S = PP.state;
    if (mode === 'white') return '#FFFFFF';
    if (mode === 'black') return '#000000';
    if (mode === 'secondary') return S.secondary ? S.doc.palette[S.secondary - 1] : null;
    return null;
  }
  PP.maxScaleFor = function (w, h, cols, rows) {
    var big = Math.max(w * (cols || 1), h * (rows || 1));
    return Math.max(1, Math.floor(4096 / big));
  };

  PP.exportGIF = function (scale, bgMode) {
    var S = PP.state, d = S.doc;
    var s = Math.min(scale, PP.maxScaleFor(d.w, d.h));
    var frames = d.frames.map(function (_, f) { return scaleIdx(PP.composite(f), d.w, d.h, s); });
    var delay = Math.max(2, Math.round(100 / d.fps));
    var bytes = PP.encodeGIF(frames, d.w * s, d.h * s, d.palette, delay, bgHex(bgMode));
    return new Blob([bytes], { type: 'image/gif' });
  };

  function renderScaled(idx, w, h, s, bg) {
    var src = PP.indicesToCanvas(idx, w, h, PP.state.doc.palette);
    var c = document.createElement('canvas');
    c.width = w * s; c.height = h * s;
    var x = c.getContext('2d');
    if (bg) { x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height); }
    x.imageSmoothingEnabled = false;
    x.drawImage(src, 0, 0, c.width, c.height);
    return c;
  }
  function toBlob(canvas, cb) {
    if (canvas.toBlob) canvas.toBlob(function (b) { cb(b); }, 'image/png');
    else {
      var data = atob(canvas.toDataURL('image/png').split(',')[1]), u = new Uint8Array(data.length);
      for (var i = 0; i < data.length; i++) u[i] = data.charCodeAt(i);
      cb(new Blob([u], { type: 'image/png' }));
    }
  }
  PP.exportPNG = function (scale, bgMode, cb) {
    var S = PP.state, d = S.doc, s = Math.min(scale, PP.maxScaleFor(d.w, d.h));
    toBlob(renderScaled(PP.composite(S.frame), d.w, d.h, s, bgHex(bgMode)), cb);
  };
  PP.exportSheet = function (scale, bgMode, cols, cb) {
    var d = PP.state.doc, n = d.frames.length;
    cols = PP.clamp(cols | 0 || n, 1, n);
    var rows = Math.ceil(n / cols), s = Math.min(scale, PP.maxScaleFor(d.w, d.h, cols, rows));
    var sheet = document.createElement('canvas');
    sheet.width = d.w * s * cols; sheet.height = d.h * s * rows;
    var x = sheet.getContext('2d');
    var bg = bgHex(bgMode);
    if (bg) { x.fillStyle = bg; x.fillRect(0, 0, sheet.width, sheet.height); }
    x.imageSmoothingEnabled = false;
    for (var f = 0; f < n; f++) {
      var src = PP.indicesToCanvas(PP.composite(f), d.w, d.h, d.palette);
      x.drawImage(src, (f % cols) * d.w * s, Math.floor(f / cols) * d.h * s, d.w * s, d.h * s);
    }
    toBlob(sheet, cb);
  };
})();
