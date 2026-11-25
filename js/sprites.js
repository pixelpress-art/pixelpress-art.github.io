/* PixelPress — starter sprites (original designs, PICO-8 palette).
   Chars: '.' = transparent, 0-9/a-f = PICO-8 colour index. sym:true rows are left halves mirrored. */
(function () {
  'use strict';
  var PP = window.PP;

  var SPRITES = [
    { title: 'Pocket Heart', joke: 'Full health. For now.', sym: false, frames: [[
      '.88..88.', '87888888', '88888888', '88888882', '.888882.', '..8882..', '...82...', '........']] },
    { title: 'Bouncy Slime', joke: 'Squishes on beat. Never on time.', sym: true, fps: 4, frames: [
      ['......', '......', '......', '....33', '...3bb', '..3bbb', '.3b70b', '.3b00b', '3bbbbb', '3b7bbb', '3bbbbb', '.33333'],
      ['......', '......', '......', '......', '....33', '..33bb', '.3bbbb', '3bb70b', '3bb00b', '3b7bbb', '3bbbbb', '333333']] },
    { title: 'Shy Ghost', joke: 'Boo-tiful, but introverted.', sym: true, fps: 4, frames: [
      ['....777', '..77777', '.777777', '.777777', '7770077', '7770077', '6777777', '67777e7', '6777777', '6777777', '6777777', '6777777', '67.7777', '6...77.'],
      ['....777', '..77777', '.777777', '.777777', '7770077', '7770077', '6777777', '67777e7', '6777777', '6777777', '6777777', '6777777', '6777.77', '.77..7.']] },
    { title: 'Spinning Coin', joke: 'Insert coin. Or just admire it.', sym: true, fps: 8, frames: [
      ['..999', '.9aaa', '9aa7a', '9a7aa', '9aaaa', '9aaaa', '9aaaa', '9aaaa', '.9aaa', '..999'],
      ['...99', '..9aa', '..9a7', '..9aa', '..9aa', '..9aa', '..9aa', '..9aa', '..9aa', '...99'],
      ['....9', '....9', '....a', '....a', '....a', '....a', '....a', '....a', '....9', '....9'],
      ['...99', '..9aa', '..9a7', '..9aa', '..9aa', '..9aa', '..9aa', '..9aa', '..9aa', '...99']] },
    { title: 'Mystery Potion', joke: 'Side effects may include pixels.', sym: true, frames: [[
      '...44', '...44', '...66', '...67', '..667', '.6777', '6e7ee', '6eeee', '6eeee', '6e2ee', '6ee2e', '.6eee', '..666', '.....']] },
    { title: 'Toadstool', joke: 'A fungi to be around.', sym: true, frames: [[
      '....22', '..2288', '.28888', '.27788', '287788', '288888', '222222', '..ffff', '..f0ff', '..ffff', '..ffff', '...444']] },
    { title: 'Pixel Cat', joke: 'Ignores you in 8-bit.', sym: true, frames: [[
      '.4....', '.44...', '.494..', '.49944', '.49999', '499999', '490999', '499999', '49999e', '499999', '.49999', '..4444']] },
    { title: 'Campfire', joke: 'Hot take, literally.', sym: true, fps: 6, frames: [
      ['....', '...8', '..88', '..89', '.889', '.89a', '889a', '89aa', '89a7', '89a7', '.89a', '..88'],
      ['....', '....', '...8', '..88', '..89', '.889', '.89a', '889a', '89aa', '89a7', '.89a', '..88']] }
  ];

  function rowsToFull(rows, sym) {
    return rows.map(function (r) { return sym ? r + r.split('').reverse().join('') : r; });
  }
  function charVal(ch) {
    if (ch === '.' || ch === ' ') return 0;
    var n = parseInt(ch, 16);
    return isNaN(n) ? 0 : n + 1;
  }
  PP.STARTERS = SPRITES;
  PP.starterDoc = function (i, size) {
    var sp = SPRITES[i], N = size || 16;
    var full = sp.frames.map(function (f) { return rowsToFull(f, sp.sym); });
    var sw = full[0][0].length, sh = full[0].length;
    var W = Math.max(N, sw), Hh = Math.max(N, sh);
    var ox = Math.floor((W - sw) / 2), oy = Math.floor((Hh - sh) / 2);
    var d = PP.createDoc(W, Hh, PP.PALETTES.pico8.colors, sp.title);
    d.fps = sp.fps || 8;
    d.frames = full.map(function (rows) {
      var c = new Uint8Array(W * Hh);
      rows.forEach(function (r, y) { for (var x = 0; x < r.length; x++) c[(y + oy) * W + x + ox] = charVal(r[x]); });
      return { cells: [c] };
    });
    d.layers = [{ name: 'Sprite', visible: true }];
    return d;
  };
})();
