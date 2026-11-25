/* PixelPress — local gallery in IndexedDB (falls back to localStorage) */
(function () {
  'use strict';
  var PP = window.PP;
  var DB = 'pixelpress', STORE = 'art', LS = 'pixelpress:gallery';
  var dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      if (!window.indexedDB) { rej(new Error('no idb')); return; }
      var req;
      try { req = indexedDB.open(DB, 1); } catch (e) { rej(e); return; }
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = function () { res(req.result); };
      req.onerror = function () { rej(req.error); };
      req.onblocked = function () { rej(new Error('blocked')); };
    });
    return dbp;
  }
  function tx(mode, fn) {
    return open().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(STORE, mode), st = t.objectStore(STORE), out;
        var r = fn(st);
        if (r) r.onsuccess = function () { out = r.result; };
        t.oncomplete = function () { res(out); };
        t.onerror = function () { rej(t.error); };
        t.onabort = function () { rej(t.error); };
      });
    });
  }
  function lsAll() { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch (e) { return []; } }
  function lsSave(a) { try { localStorage.setItem(LS, JSON.stringify(a)); return true; } catch (e) { return false; } }

  PP.store = {
    put: function (rec) {
      return tx('readwrite', function (st) { return st.put(rec); }).catch(function () {
        var a = lsAll().filter(function (r) { return r.id !== rec.id; }); a.push(rec);
        if (!lsSave(a)) throw new Error('Storage full');
      });
    },
    all: function () {
      return tx('readonly', function (st) { return st.getAll(); }).then(function (a) { return a || []; }).catch(function () { return lsAll(); })
        .then(function (a) { return a.sort(function (x, y) { return (y.updated || 0) - (x.updated || 0); }); });
    },
    del: function (id) {
      return tx('readwrite', function (st) { return st.delete(id); }).catch(function () {
        lsSave(lsAll().filter(function (r) { return r.id !== id; }));
      });
    }
  };

  PP.makeRecord = function (id) {
    var d = PP.state.doc;
    return {
      id: id || ('pp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
      title: d.title || 'Untitled', w: d.w, h: d.h, frames: d.frames.length,
      code: PP.encodeDoc(d), thumb: PP.thumbnail(d, 0, 96).toDataURL('image/png'), updated: Date.now()
    };
  };
})();
