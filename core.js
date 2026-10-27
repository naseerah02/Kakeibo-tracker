/* Shared by the page and the service worker.
   - Local storage in IndexedDB (settings, cached lists, and the queue of entries not yet sent)
   - Sending queued entries to your Google script */
(function (root) {
  'use strict';
  var DB_NAME = 'expense-tracker', DB_VERSION = 1;
  var PERMANENT = /^Invalid (key|amount|date|time)/;   // the server will never accept these: flag them, don't retry
  var dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
        if (!db.objectStoreNames.contains('queue')) db.createObjectStore('queue', { keyPath: 'id' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { dbPromise = null; reject(req.error); };
    });
    return dbPromise;
  }

  function run(store, mode, fn) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(store, mode);
        var req = fn(t.objectStore(store));
        t.oncomplete = function () { resolve(req && 'result' in req ? req.result : undefined); };
        t.onerror = t.onabort = function () { reject(t.error || new Error('Storage error')); };
      });
    });
  }

  var Core = {
    kvGet: function (k) { return run('kv', 'readonly', function (s) { return s.get(k); }); },
    kvSet: function (k, v) { return run('kv', 'readwrite', function (s) { return s.put(v, k); }); },
    kvDel: function (k) { return run('kv', 'readwrite', function (s) { return s.delete(k); }); },
    qAll: function () {
      return run('queue', 'readonly', function (s) { return s.getAll(); })
        .then(function (a) { return (a || []).sort(function (x, y) { return x.savedAt - y.savedAt; }); });
    },
    qPut: function (e) { return run('queue', 'readwrite', function (s) { return s.put(e); }); },
    qDel: function (id) { return run('queue', 'readwrite', function (s) { return s.delete(id); }); },
    qClear: function () { return run('queue', 'readwrite', function (s) { return s.clear(); }); },

    /** Loads categories, types, payment modes and the current budget from Google. */
    fetchConfig: function (conn) {
      var url = conn.api + (conn.api.indexOf('?') < 0 ? '?' : '&') + 'action=config&key=' + encodeURIComponent(conn.key);
      return fetch(url).then(function (r) { return r.text(); }).then(function (t) {
        var j = null; try { j = JSON.parse(t); } catch (x) {}
        if (j && j.ok) return { kind: 'ok', cfg: j };
        if (j) return { kind: 'server', text: 'Google said: ' + (j.error || 'rejected') + '. Check the secret key in your link.' };
        return { kind: 'server', text: 'Google sent a web page instead of data. In Apps Script use Deploy > Manage deployments > Edit > New version > Deploy, and make sure access is set to Anyone.' };
      }, function () { return { kind: 'network' }; });
    },

    /** Sends every waiting entry, oldest first. Safe to run from the page and the service worker at the same time:
        the server ignores an entry id it has already saved. */
    syncQueue: async function () {
      var conn = await Core.kvGet('conn');
      var result = { synced: 0, waiting: 0, failed: 0, retry: false, problem: '', lastRes: null };
      if (!conn) { result.problem = 'not set up'; return result; }
      var cfg = await Core.kvGet('cfg');
      var items = (await Core.qAll()).filter(function (e) { return !e.failed; });
      for (var i = 0; i < items.length; i++) {
        var e = items[i], res;
        try {
          var r = await fetch(conn.api, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // plain text avoids a browser pre-check Google does not answer
            body: JSON.stringify(Object.assign({ key: conn.key }, e.payload))
          });
          var text = await r.text();
          try { res = JSON.parse(text); } catch (x) { throw new Error('Google sent an unexpected reply'); }
        } catch (err) {
          result.retry = true; result.problem = String(err && err.message || err); break;
        }
        if (res && res.ok) {
          await Core.qDel(e.id);
          result.synced++; result.lastRes = res;
          if (res.budget) { cfg = cfg || {}; cfg.budget = res.budget; await Core.kvSet('cfg', cfg); }
        } else {
          var msg = (res && res.error) || 'Rejected';
          if (PERMANENT.test(msg)) { e.failed = true; e.error = msg; await Core.qPut(e); }
          else { result.retry = true; result.problem = msg; break; }
        }
      }
      var all = await Core.qAll();
      result.failed = all.filter(function (e) { return e.failed; }).length;
      result.waiting = all.length - result.failed;
      return result;
    }
  };

  root.Core = Core;
})(typeof self !== 'undefined' ? self : this);
