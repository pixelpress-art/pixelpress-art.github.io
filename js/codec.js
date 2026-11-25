/* PixelPress — the link IS the save file.
   Binary layout (v1), then base64url:
   [ver=1][w-1][h-1][fps][nColors][rgb*n][titleLen][title utf8]
   [nLayers] per layer: [flags bit0=visible][nameLen][name utf8]
   [nFrames varint] per frame, per layer: [mode] 0=RLE, 1=same as previous frame, 2=empty
   RLE = repeated (value byte, run-length varint) until w*h pixels are covered. */
(function () {
  'use strict';
  var PP = window.PP;
  var VERSION = 1;

  function Writer() { this.buf = new Uint8Array(1024); this.len = 0; }
  Writer.prototype.byte = function (b) {
    if (this.len >= this.buf.length) { var n = new Uint8Array(this.buf.length * 2); n.set(this.buf); this.buf = n; }
    this.buf[this.len++] = b & 255;
  };
  Writer.prototype.varint = function (v) {
    while (v >= 128) { this.byte((v & 127) | 128); v = Math.floor(v / 128); }
    this.byte(v);
  };
  Writer.prototype.str = function (s, max) {
    var b = new TextEncoder().encode(String(s || '')).slice(0, max);
    this.byte(b.length);
    for (var i = 0; i < b.length; i++) this.byte(b[i]);
  };
  Writer.prototype.bytes = function () { return this.buf.slice(0, this.len); };

  function Reader(u8) { this.u = u8; this.p = 0; }
  Reader.prototype.byte = function () { if (this.p >= this.u.length) throw new Error('Link ends early'); return this.u[this.p++]; };
  Reader.prototype.varint = function () {
    var v = 0, m = 1, b, guard = 0;
    do { b = this.byte(); v += (b & 127) * m; m *= 128; if (++guard > 5) throw new Error('Bad number'); } while (b & 128);
    return v;
  };
  Reader.prototype.str = function () {
    var n = this.byte(), a = new Uint8Array(n);
    for (var i = 0; i < n; i++) a[i] = this.byte();
    try { return new TextDecoder().decode(a); } catch (e) { return ''; }
  };

  function same(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }
  function isEmpty(a) { for (var i = 0; i < a.length; i++) if (a[i]) return false; return true; }

  PP.encodeBytes = function (d) {
    var w = new Writer();
    w.byte(VERSION); w.byte(d.w - 1); w.byte(d.h - 1); w.byte(PP.clamp(d.fps | 0, 1, 60));
    w.byte(d.palette.length);
    d.palette.forEach(function (hex) { var c = PP.hexToRgb(hex); w.byte(c[0]); w.byte(c[1]); w.byte(c[2]); });
    w.str(d.title, 60);
    w.byte(d.layers.length);
    d.layers.forEach(function (l) { w.byte(l.visible ? 1 : 0); w.str(l.name, 24); });
    w.varint(d.frames.length);
    d.frames.forEach(function (fr, fi) {
      fr.cells.forEach(function (c, li) {
        if (fi > 0 && same(c, d.frames[fi - 1].cells[li])) { w.byte(1); return; }
        if (isEmpty(c)) { w.byte(2); return; }
        w.byte(0);
        var i = 0;
        while (i < c.length) {
          var v = c[i], run = 1;
          while (i + run < c.length && c[i + run] === v) run++;
          w.byte(v); w.varint(run);
          i += run;
        }
      });
    });
    return w.bytes();
  };

  PP.decodeBytes = function (u8) {
    var r = new Reader(u8);
    var ver = r.byte();
    if (ver !== VERSION) throw new Error('Unknown save version ' + ver);
    var W = r.byte() + 1, Hh = r.byte() + 1, fps = r.byte() || 8, nc = r.byte();
    if (!nc) throw new Error('Empty palette');
    var palette = [];
    for (var i = 0; i < nc; i++) palette.push(PP.rgbToHex(r.byte(), r.byte(), r.byte()));
    var title = r.str() || 'Untitled';
    var nl = r.byte();
    if (nl < 1 || nl > 16) throw new Error('Bad layer count');
    var layers = [];
    for (i = 0; i < nl; i++) { var fl = r.byte(); layers.push({ visible: !!(fl & 1), name: r.str() || 'Layer ' + (i + 1) }); }
    var nf = r.varint();
    if (nf < 1 || nf > 256) throw new Error('Bad frame count');
    var frames = [], N = W * Hh;
    for (var f = 0; f < nf; f++) {
      var cells = [];
      for (var l = 0; l < nl; l++) {
        var mode = r.byte(), c;
        if (mode === 1) { if (!f) throw new Error('Bad frame ref'); c = frames[f - 1].cells[l].slice(); }
        else if (mode === 2) c = new Uint8Array(N);
        else if (mode === 0) {
          c = new Uint8Array(N);
          var p = 0;
          while (p < N) {
            var v = r.byte(), run = r.varint();
            if (run < 1 || p + run > N) throw new Error('Bad run');
            if (v > nc) v = 0;
            c.fill(v, p, p + run); p += run;
          }
        } else throw new Error('Bad cell mode');
        cells.push(c);
      }
      frames.push({ cells: cells });
    }
    return { w: W, h: Hh, fps: Math.min(fps, 30), palette: palette, title: title, layers: layers, frames: frames };
  };

  /* base64url (no padding) */
  PP.b64u = function (u8) {
    var s = '', CH = 0x8000;
    for (var i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  PP.unb64u = function (str) {
    str = String(str).replace(/[^A-Za-z0-9\-_]/g, '').replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    var bin = atob(str), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  };

  PP.encodeDoc = function (d) { return PP.b64u(PP.encodeBytes(d || PP.state.doc)); };
  PP.decodeDoc = function (code) { return PP.decodeBytes(PP.unb64u(code)); };

  PP.HASH_KEY = 'art=';
  PP.codeFromHash = function (h) {
    h = (h == null ? location.hash : h) || '';
    var m = h.match(/[#&]art=([A-Za-z0-9\-_]+)/);
    return m ? m[1] : null;
  };
  PP.shareUrl = function (code) {
    return location.href.split('#')[0] + '#' + PP.HASH_KEY + code;
  };
  /* accept a full link or a bare code */
  PP.codeFromAny = function (s) {
    s = String(s || '').trim();
    var c = PP.codeFromHash(s.indexOf('#') >= 0 ? s.slice(s.indexOf('#')) : '');
    return c || (/^[A-Za-z0-9\-_]+$/.test(s) ? s : null);
  };

  /* project file: same code, wrapped in JSON */
  PP.projectJSON = function (d) {
    d = d || PP.state.doc;
    return JSON.stringify({ app: 'PixelPress', format: 1, title: d.title, w: d.w, h: d.h, frames: d.frames.length, code: PP.encodeDoc(d), saved: new Date().toISOString() }, null, 2);
  };
})();
