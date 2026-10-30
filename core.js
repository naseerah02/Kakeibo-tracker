/* Shared by the page and the service worker.
   - Local storage in IndexedDB (sign-in, cached lists, PIN, favourites, and the queue of entries not yet sent)
   - Talking to your Google script, and sending queued entries */
(function (root) {
  'use strict';
  var DB_NAME = 'expense-tracker', DB_VERSION = 1;
  var PERMANENT = /^Invalid /;   // the server will never accept these: flag them, do not retry
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
    kvKeys: function () { return run('kv', 'readonly', function (s) { return s.getAllKeys(); }).then(function (k) { return k || []; }); },
    qAll: function () {
      return run('queue', 'readonly', function (s) { return s.getAll(); })
        .then(function (a) { return (a || []).sort(function (x, y) { return x.savedAt - y.savedAt; }); });
    },
    qPut: function (e) { return run('queue', 'readwrite', function (s) { return s.put(e); }); },
    qDel: function (id) { return run('queue', 'readwrite', function (s) { return s.delete(id); }); },
    qClear: function () { return run('queue', 'readwrite', function (s) { return s.clear(); }); },

    /** One call to your Google script. The body goes as plain text so the browser needs no pre-check that Google would not answer. */
    api: function (conn, action, payload) {
      var body = JSON.stringify(Object.assign({}, payload || {}, { action: action, token: conn && conn.token ? conn.token : undefined }));
      return fetch(conn.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body })
        .then(function (r) { return r.text(); })
        .then(function (t) {
          try { return JSON.parse(t); } catch (x) { throw new Error('Google sent an unexpected reply'); }
        });
    },

    /** Loads categories, types, payment modes and the current budget. */
    fetchConfig: function (conn) {
      return Core.api(conn, 'config').then(function (j) {
        if (j && j.ok) return { kind: 'ok', cfg: j };
        if (j && j.error === 'Not authorised') return { kind: 'auth' };
        return { kind: 'server', text: 'Google said: ' + ((j && j.error) || 'rejected') };
      }, function (err) {
        if (err && /unexpected reply/.test(err.message)) {
          return { kind: 'server', text: 'Google sent a web page instead of data. In Apps Script use Deploy > Manage deployments > Edit > New version > Deploy, and make sure access is set to Anyone.' };
        }
        return { kind: 'network' };
      });
    },

    /** Sends every waiting entry (expenses and reflections), oldest first. Safe to run from the page and the service
        worker at once: the server ignores an id it has already saved. */
    syncQueue: async function () {
      var conn = await Core.kvGet('conn');
      var result = { synced: 0, waiting: 0, failed: 0, retry: false, auth: false, problem: '', lastRes: null };
      if (conn && !conn.token) result.auth = true;
      if (conn && conn.token) {
        var cfg = await Core.kvGet('cfg');
        var items = (await Core.qAll()).filter(function (e) { return !e.failed; });
        for (var i = 0; i < items.length; i++) {
          var e = items[i], res, action = e.payload.action || 'save';
          try {
            res = await Core.api(conn, action, e.payload);
          } catch (err) {
            result.retry = true; result.problem = String(err && err.message || err); break;
          }
          if (res && res.ok) {
            await Core.qDel(e.id);
            result.synced++;
            if (action === 'save') {
              result.lastRes = res;
              if (res.budget && cfg) { cfg.budget = res.budget; await Core.kvSet('cfg', cfg); }
            }
          } else {
            var msg = (res && res.error) || 'Rejected';
            if (msg === 'Not authorised') { result.auth = true; break; }      // this phone must sign in again; entries stay queued
            if (PERMANENT.test(msg)) { e.failed = true; e.error = msg; await Core.qPut(e); }
            else { result.retry = true; result.problem = msg; break; }
          }
        }
      }
      var all = await Core.qAll();
      result.failed = all.filter(function (x) { return x.failed; }).length;
      result.waiting = all.length - result.failed;
      return result;
    }
  };

  root.Core = Core;
})(typeof self !== 'undefined' ? self : this);
