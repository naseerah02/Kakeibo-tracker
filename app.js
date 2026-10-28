/* The Android app: sign-in, PIN lock, Add / History / Reflect, favourites, offline queue. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var SCREENS = ['setup', 'activate', 'pinSet', 'lock', 'main'];
  var REFLECT_Q = {
    Weekly: ['What went well with money this week?', 'What was an unnecessary spend, and why?', 'One thing I will do better next week'],
    Monthly: ['How did I do against my savings goal? What helped or got in the way?', 'Which Wants or Extra spending can I reduce?', 'My plan for next month']
  };

  var conn = null;          // { api, person, token, deviceId, device }
  var deviceId = '';
  var cfg = null;           // lists + budget from Google, kept for offline use
  var queue = [];           // entries and reflections saved on this phone, not yet in the sheet
  var recent = [];          // last loaded History from Google
  var pinRec = null;        // { salt, hash, len, fails, until }
  var favs = [], prefs = {};
  var locked = true, hiddenAt = 0, forceActivate = false, forgot = false;
  var screen = '', tab = 'add', editing = null, formReady = false;
  var syncing = false, cfgMsg = '', histNote = '', installPrompt = null, resendTimer = null;

  // ---------- small helpers ----------
  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function todayStr() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function shiftDate(str, days) {
    var d = new Date(Date.UTC(+str.slice(0, 4), +str.slice(5, 7) - 1, +str.slice(8, 10) + days));
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }
  function setNow() { var d = new Date(); $('date').value = todayStr(); $('time').value = pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function cur() { return (cfg && cfg.currency) || 'PKR'; }
  function fmt(n) { return Math.abs(Math.round(n)).toLocaleString(); }
  function money(n) { return cur() + ' ' + fmt(n); }
  function paint(el, text, kind) { el.textContent = text; el.className = kind || ''; }
  function say(text, kind) { paint($('status'), text, kind); }
  // Shows a message on whichever tab is open
  function msg(text, kind) { paint(tab === 'history' ? $('histNote') : tab === 'reflect' ? $('refStatus') : $('status'), text, kind); }

  // ---------- screens ----------
  function route() {
    var s = !conn ? 'setup' : (!conn.token || forceActivate) ? 'activate' : !pinRec ? 'pinSet' : locked ? 'lock' : 'main';
    SCREENS.forEach(function (n) { $(n).hidden = n !== s; });
    screen = s;
    var titles = { setup: 'First-time setup', activate: 'Sign in', pinSet: 'Create your PIN', lock: 'Locked' };
    $('who').textContent = s === 'main' ? 'Logging as ' + conn.person : (titles[s] + (conn && conn.person && s !== 'setup' ? ' \u00b7 ' + conn.person : ''));
    $('actCancel').hidden = !forgot;
    $('lockNow').hidden = !(s === 'main' && pinRec);
    renderNet();
    if (s === 'lock') { $('pinIn').value = ''; setTimeout(function () { $('pinIn').focus(); }, 50); }
    if (s === 'main') { renderTabs(); renderAll(); }
  }
  function renderNet() {
    var n = $('net');
    n.textContent = navigator.onLine ? 'Online' : 'Offline';
    n.className = 'chip' + (navigator.onLine ? '' : ' off');
  }
  function renderTabs() {
    ['add', 'history', 'reflect'].forEach(function (t) {
      $('tab' + t.charAt(0).toUpperCase() + t.slice(1)).hidden = t !== tab;
    });
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (b) { b.className = 'tab' + (b.getAttribute('data-tab') === tab ? ' on' : ''); });
  }
  function switchTab(t) {
    tab = t; renderTabs();
    if (t === 'history') { renderHistory(); loadHistory(); }
    if (t === 'reflect') { loadSummary(); }
  }
  function renderAll() {
    renderNet();
    if (screen !== 'main') return;
    renderBanner(); renderQueue(); renderFavs(); renderEdit();
    if (tab === 'history') renderHistory();
  }
  async function refresh() {
    cfg = (await Core.kvGet('cfg')) || null;
    queue = await Core.qAll();
    recent = (await Core.kvGet('recent')) || [];
    renderAll();
  }

  // ---------- budget banner (works offline: last known figures minus entries not yet synced) ----------
  function weekOf(dateStr) { return Math.floor((parseInt(dateStr.slice(8, 10), 10) - 1) / 7) + 1; }
  function estimate() {
    var b = cfg && cfg.budget;
    if (!b || !b.hasPlan) return null;
    var wl = b.weekLeft, ml = b.monthLeft, pending = 0;
    queue.forEach(function (e) {
      if (e.failed || e.kind === 'reflection') return;
      pending++;
      var p = e.payload;
      if (p.type === 'Savings' || (cfg.fixed || []).indexOf(p.category) !== -1) return;
      if (String(p.date).slice(0, 7) === b.ym) { ml -= p.amount; if (weekOf(p.date) === b.week) wl -= p.amount; }
    });
    return { week: b.week, weekLeft: wl, monthLeft: ml, pending: pending };
  }
  function leftHtml(n) { return n < 0 ? '<b class="neg">over by ' + money(n) + '</b>' : '<b>' + money(n) + '</b> left'; }
  function renderBanner() {
    var est = estimate(), box = $('banner');
    if (!est) { box.hidden = true; return; }
    var html = 'Week ' + est.week + ': ' + leftHtml(est.weekLeft) + ' &middot; Month: ' + leftHtml(est.monthLeft);
    if (est.pending) html += '<small>Estimate: ' + est.pending + ' entr' + (est.pending === 1 ? 'y' : 'ies') + ' not synced yet</small>';
    else if (!navigator.onLine) html += '<small>Offline: last known figures</small>';
    box.innerHTML = html; box.hidden = false;
  }

  // ---------- the Add form ----------
  function fill(sel, items) {
    var keep = sel.value; sel.innerHTML = '';
    (items || []).forEach(function (t) { var o = document.createElement('option'); o.value = t; o.textContent = t; sel.appendChild(o); });
    if (keep && (items || []).indexOf(keep) >= 0) sel.value = keep;
  }
  function ensureOption(sel, value) {
    if (!value) return;
    for (var i = 0; i < sel.options.length; i++) if (sel.options[i].value === value) return;
    var o = document.createElement('option'); o.value = value; o.textContent = value; sel.appendChild(o);
  }
  function syncType() { if (cfg && cfg.types) $('type').value = cfg.types[$('category').value] || 'Extra'; }
  function buildForm() {
    if (!cfg) return;
    $('cur').textContent = cur(); $('curTag').textContent = cur();
    fill($('category'), cfg.categories); fill($('type'), cfg.kakeiboTypes); fill($('payment'), cfg.payments);
    if (!formReady) {   // first time only: start from the last category and payment mode you used
      if (prefs.category && cfg.categories.indexOf(prefs.category) >= 0) $('category').value = prefs.category;
      if (prefs.payment && cfg.payments.indexOf(prefs.payment) >= 0) $('payment').value = prefs.payment;
      formReady = true;
    }
    syncType();
    $('device').value = (conn && conn.device) || 'Android';
  }
  function collect(amount) {
    return { amount: amount, category: $('category').value, type: $('type').value, payment: $('payment').value,
             remarks: $('remarks').value, date: $('date').value || todayStr(), time: $('time').value || '' };
  }
  function afterUnlock() { buildForm(); if (!editing) setNow(); renderAll(); loadConfig(); runSync(); }

  // ---------- favourites ----------
  function renderFavs() {
    var box = $('favs');
    box.hidden = !favs.length;
    box.innerHTML = favs.map(function (f) {
      return '<button class="fav" type="button" data-fav="' + esc(f.id) + '">' + esc(f.label) + (f.amount ? ' &middot; ' + esc(fmt(f.amount)) : '') + '</button>';
    }).join('');
    $('favManage').hidden = !favs.length;
    $('favList').innerHTML = favs.map(function (f) {
      return '<div class="qrow"><b>' + esc(f.label) + '</b> <span class="meta">' + esc(f.category) + (f.amount ? ' &middot; ' + esc(fmt(f.amount)) : '') +
        '</span><br><button class="small danger" type="button" data-favdel="' + esc(f.id) + '">Delete</button></div>';
    }).join('');
  }
  function applyFav(f) {
    if (editing) endEdit();
    if (cfg.categories.indexOf(f.category) >= 0) $('category').value = f.category;
    syncType();
    if (cfg.payments.indexOf(f.payment) >= 0) $('payment').value = f.payment;
    $('remarks').value = f.remarks || '';
    $('amount').value = f.amount ? String(f.amount) : '';
    setNow(); $('amount').focus();
  }

  // ---------- waiting entries ----------
  function renderQueue() {
    var box = $('queueBox');
    if (!queue.length) { box.hidden = true; return; }
    box.hidden = false;
    var failed = queue.filter(function (e) { return e.failed; }).length;
    $('qsum').textContent = (queue.length - failed) + ' waiting to sync' + (failed ? ', ' + failed + ' need attention' : '');
    $('qlist').innerHTML = queue.map(function (e) {
      var p = e.payload, head = e.kind === 'reflection'
        ? '<b>Reflection</b> &middot; ' + esc(p.kind) : '<b>' + esc(money(p.amount)) + '</b> &middot; ' + esc(p.category);
      var meta = e.kind === 'reflection' ? esc(p.date) : esc(p.date) + ' ' + esc(p.time) + (p.remarks ? ' &middot; ' + esc(p.remarks) : '');
      return '<div class="qrow"><div>' + head + '</div><div class="meta">' + meta + '</div>' +
        (e.failed ? '<div class="bad">Not saved: ' + esc(e.error) + '</div><button class="small" data-act="retry" data-id="' + esc(e.id) + '">Retry</button>'
                  : '<div class="meta">Waiting to sync</div>') +
        '<button class="small" data-act="del" data-id="' + esc(e.id) + '">Delete</button></div>';
    }).join('');
  }

  // ---------- talking to Google ----------
  function configProblem(text, quiet) {
    if (!cfg || !quiet) { cfgMsg = text; say(text, 'err'); }
    $('retryCfg').hidden = !!cfg;
  }
  async function loadConfig() {
    if (!conn || !conn.token) return;
    var r = await Core.fetchConfig(conn);
    if (r.kind === 'ok') {
      await Core.kvSet('cfg', r.cfg); cfg = r.cfg;
      if (r.cfg.person && r.cfg.person !== conn.person) { conn.person = r.cfg.person; await Core.kvSet('conn', conn); }
      buildForm(); renderAll();
      $('retryCfg').hidden = true;
      if (cfgMsg && $('status').textContent === cfgMsg) { say('', ''); cfgMsg = ''; }
    } else if (r.kind === 'auth') {
      needAuth('This phone needs to sign in again. Your unsent entries are safe.');
    } else if (r.kind === 'server') {
      configProblem(r.text, false);
    } else if (navigator.onLine) {
      configProblem('Could not reach your Google script. Check the link (it must end in /exec) and that access is set to Anyone.', false);
    } else {
      configProblem('Offline. Connect once to load your categories.', true);
    }
  }

  function noteFor(res) {
    if (!res) return '';
    if (res.fund) return 'Paid from your ' + esc(res.fund.name) + ' fund: ' + (res.fund.balance < 0 ? 'overdrawn by <b>' + money(res.fund.balance) + '</b>' : 'balance now <b>' + money(res.fund.balance) + '</b>');
    if (res.saving) return 'Savings / investment: not counted as spending.';
    if (res.fixed) return 'Fixed cost: not counted against your weekly allowance.';
    return '';
  }

  async function runSync() {
    if (syncing || !conn) return;
    syncing = true;
    try {
      var r = await Core.syncQueue();
      await refresh();
      if (r.auth) { await needAuth('This phone needs to sign in again. Your unsent entries are safe.'); return; }
      if (screen !== 'main') return;
      if (r.failed) say(r.failed + ' entr' + (r.failed === 1 ? 'y needs' : 'ies need') + ' attention', 'err');
      else if (r.waiting) say('Saved on this phone: ' + r.waiting + ' waiting to sync' + (r.problem && navigator.onLine ? ' (' + r.problem + ')' : ''), 'warn');
      else if (r.synced) { say('Synced to your sheet \u2713', 'ok'); $('after').innerHTML = noteFor(r.lastRes); }
    } catch (e) {
      say('Sync problem: ' + (e && e.message || e), 'err');
    } finally { syncing = false; }
  }

  // Ask Android Chrome to send waiting entries later, even if the app is closed by then.
  async function registerBackgroundSync() {
    try {
      if (!('serviceWorker' in navigator)) return;
      var reg = await navigator.serviceWorker.ready;
      if (reg.sync) await reg.sync.register('sync-expenses');
    } catch (e) { /* not supported: syncing on open and when back online still works */ }
  }

  async function needAuth(text) {
    if (conn) { conn.token = ''; await Core.kvSet('conn', conn); }
    forgot = false; forceActivate = false;
    $('otpBox').hidden = true; $('otpSend').hidden = false;
    $('otpMsg').textContent = text || 'This phone needs to sign in.';
    route();
  }

  // ---------- sign-in with an emailed code ----------
  function startResend() {
    var n = 60, btn = $('otpResend');
    btn.disabled = true; btn.textContent = 'Send again (60)';
    clearInterval(resendTimer);
    resendTimer = setInterval(function () {
      n--; btn.textContent = n > 0 ? 'Send again (' + n + ')' : 'Send again';
      if (n <= 0) { btn.disabled = false; clearInterval(resendTimer); }
    }, 1000);
  }
  async function sendCode() {
    $('otpSend').disabled = true; $('otpMsg').textContent = 'Sending...';
    try {
      var r = await Core.api(conn, 'otp_request', { person: conn.person });
      if (r && r.ok) {
        $('otpBox').hidden = false; $('otpSend').hidden = true;
        $('otpMsg').textContent = 'If an email is saved for you, a 6-digit code is on its way (valid for 10 minutes). No email? Ask the sheet owner to add yours in Settings.';
        startResend(); $('otpCode').focus();
      } else { $('otpMsg').textContent = (r && r.error) || 'Could not send a code.'; }
    } catch (e) {
      $('otpMsg').textContent = navigator.onLine ? 'Could not reach your Google script. Check the link and that access is set to Anyone.' : 'You are offline. Connect to the internet to get a code.';
    }
    $('otpSend').disabled = false;
  }
  async function verifyCode() {
    var code = $('otpCode').value.trim();
    if (!/^\d{6}$/.test(code)) { $('otpMsg').textContent = 'Enter the 6-digit code from the email.'; return; }
    $('otpVerify').disabled = true;
    try {
      var r = await Core.api(conn, 'otp_verify', { person: conn.person, code: code, deviceId: conn.deviceId || deviceId, label: conn.device || 'Android' });
      if (r && r.ok) {
        conn.token = r.token; conn.person = r.person; await Core.kvSet('conn', conn);
        if (forgot) { await Core.kvDel('pin'); pinRec = null; }
        forgot = false; forceActivate = false; locked = false;
        $('otpCode').value = ''; $('otpBox').hidden = true; $('otpSend').hidden = false; $('otpMsg').textContent = '';
        route();
        if (screen === 'main') afterUnlock();
      } else { $('otpMsg').textContent = (r && r.error) || 'That code did not work.'; }
    } catch (e) {
      $('otpMsg').textContent = navigator.onLine ? 'Could not reach your Google script.' : 'You are offline. Connect to the internet and try again.';
    }
    $('otpVerify').disabled = false;
  }

  // ---------- PIN ----------
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  async function pinHash(pin, saltHex) {
    var salt = new Uint8Array(saltHex.match(/../g).map(function (h) { return parseInt(h, 16); }));
    var key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
    return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt, iterations: 150000, hash: 'SHA-256' }, key, 256));
  }
  async function savePin(pin) {
    var salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    pinRec = { salt: salt, hash: await pinHash(pin, salt), len: pin.length, fails: 0, until: 0 };
    await Core.kvSet('pin', pinRec);
  }
  async function tryUnlock() {
    var pin = $('pinIn').value;
    if (!pin || !pinRec) return;
    var wait = Math.ceil((pinRec.until - Date.now()) / 1000);
    if (wait > 0) { $('pinMsg').textContent = 'Too many tries. Wait ' + wait + ' seconds.'; $('pinIn').value = ''; return; }
    var h;
    try { h = await pinHash(pin, pinRec.salt); } catch (e) { $('pinMsg').textContent = 'This browser cannot check a PIN here.'; return; }
    if (h === pinRec.hash) {
      pinRec.fails = 0; pinRec.until = 0; await Core.kvSet('pin', pinRec);
      locked = false; hiddenAt = 0; route(); afterUnlock(); return;
    }
    pinRec.fails++;
    $('pinIn').value = '';
    if (pinRec.fails >= 10) {   // too many wrong PINs: forget the PIN and the sign-in, an email code is needed again
      await Core.kvDel('pin'); pinRec = null; conn.token = ''; await Core.kvSet('conn', conn);
      forgot = false; forceActivate = false;
      $('otpMsg').textContent = 'Too many wrong PINs. Sign in again with a code.'; route(); return;
    }
    if (pinRec.fails % 5 === 0) pinRec.until = Date.now() + 30000;
    await Core.kvSet('pin', pinRec);
    $('pinMsg').textContent = 'Wrong PIN. ' + (10 - pinRec.fails) + ' tries left before you must sign in again.';
  }

  // ---------- edit and delete ----------
  function renderEdit() {
    $('editBar').hidden = !editing;
    $('save').textContent = editing ? 'Save changes' : 'Save Record';
    if (editing) $('editText').textContent = 'Editing an entry' + (editing.src === 'q' ? ' (not synced yet)' : '') + '.';
  }
  function startEdit(src, id) {
    var item = src === 'q' ? (queue.filter(function (e) { return e.id === id; })[0] || {}).payload
                           : recent.filter(function (e) { return e.id === id; })[0];
    if (!item) return;
    editing = { src: src, id: id };
    ensureOption($('category'), item.category); ensureOption($('payment'), item.payment); ensureOption($('type'), item.type);
    $('amount').value = item.amount; $('category').value = item.category; $('payment').value = item.payment;
    $('type').value = item.type || (cfg.types && cfg.types[item.category]) || 'Extra';
    $('date').value = item.date; $('time').value = item.time; $('remarks').value = item.remarks || '';
    switchTab('add'); renderEdit(); say('', '');
  }
  function endEdit() { editing = null; $('amount').value = ''; $('remarks').value = ''; setNow(); syncType(); renderEdit(); }

  async function saveEdit(f) {
    if (editing.src === 'q') {   // not sent yet: change it on the phone
      var e = queue.filter(function (x) { return x.id === editing.id; })[0];
      if (e) { e.payload = Object.assign({}, e.payload, f); e.failed = false; e.error = ''; await Core.qPut(e); }
      endEdit(); await refresh(); say('Changes saved on this phone \u2713', 'ok'); runSync(); return;
    }
    say('Saving changes...', '');
    var r;
    try { r = await Core.api(conn, 'update', Object.assign({ id: editing.id }, f)); }
    catch (err) { say('Connect to the internet to change saved entries.', 'err'); return; }
    if (r && r.error === 'Not authorised') { needAuth('This phone needs to sign in again.'); return; }
    if (!(r && r.ok)) { say((r && r.error) || 'Could not save the changes.', 'err'); return; }
    var id = editing.id;
    recent = recent.map(function (x) { return x.id === id ? Object.assign({}, x, f) : x; });
    await Core.kvSet('recent', recent);
    if (r.budget && cfg) { cfg.budget = r.budget; await Core.kvSet('cfg', cfg); }
    endEdit(); renderAll(); say('Changes saved \u2713', 'ok');
  }

  async function deleteEntry(src, id) {
    if (!confirm('Delete this entry? This cannot be undone.')) return;
    if (src === 'q') {
      await Core.qDel(id); if (editing && editing.id === id) endEdit();
      await refresh(); msg('Entry deleted', 'ok'); return;
    }
    var r;
    try { r = await Core.api(conn, 'delete', { id: id }); }
    catch (err) { msg('Connect to the internet to delete saved entries.', 'err'); return; }
    if (r && r.error === 'Not authorised') { needAuth('This phone needs to sign in again.'); return; }
    if (!(r && r.ok)) { msg((r && r.error) || 'Could not delete the entry.', 'err'); return; }
    recent = recent.filter(function (x) { return x.id !== id; });
    await Core.kvSet('recent', recent);
    if (r.budget && cfg) { cfg.budget = r.budget; await Core.kvSet('cfg', cfg); }
    if (editing && editing.id === id) endEdit();
    renderAll(); msg('Entry deleted', 'ok');
  }

  // ---------- History ----------
  async function loadHistory() {
    if (!conn || !conn.token) return;
    try {
      var r = await Core.api(conn, 'recent');
      if (r && r.ok) { recent = r.entries; await Core.kvSet('recent', recent); histNote = ''; }
      else if (r && r.error === 'Not authorised') { needAuth('This phone needs to sign in again.'); return; }
      else histNote = (r && r.error) || 'Could not load your history.';
    } catch (e) { histNote = 'Offline: showing the last loaded list.'; }
    renderHistory();
  }
  function rowHtml(src, id, p, note) {
    return '<div class="qrow"><div><b>' + esc(money(p.amount)) + '</b> &middot; ' + esc(p.category) + '</div>' +
      '<div class="meta">' + esc(p.date) + ' ' + esc(p.time) + (p.remarks ? ' &middot; ' + esc(p.remarks) : '') + '</div>' +
      (note ? '<div class="meta">' + esc(note) + '</div>' : '') +
      '<button class="small" type="button" data-act="edit" data-src="' + src + '" data-id="' + esc(id) + '">Edit</button>' +
      '<button class="small danger" type="button" data-act="del" data-src="' + src + '" data-id="' + esc(id) + '">Delete</button></div>';
  }
  function renderHistory() {
    if (histNote) paint($('histNote'), histNote, 'warn');
    else if ($('histNote').className === 'warn') paint($('histNote'), '', '');
    var pend = queue.filter(function (e) { return e.kind !== 'reflection'; }), seen = {};
    pend.forEach(function (e) { seen[e.id] = 1; });
    var rows = pend.map(function (e) { return rowHtml('q', e.id, e.payload, e.failed ? 'Not saved: ' + e.error : 'Waiting to sync'); });
    rows = rows.concat(recent.filter(function (x) { return !seen[x.id]; }).map(function (x) { return rowHtml('s', x.id, x, ''); }));
    $('histList').innerHTML = rows.length ? rows.join('') : '<p class="hint">No entries yet.</p>';
  }

  // ---------- Reflect ----------
  function periodDate(sel) { var t = todayStr(); return sel === 'week1' ? shiftDate(t, -7) : sel === 'month1' ? shiftDate(t.slice(0, 7) + '-01', -1) : t; }
  function periodKind(sel) { return sel.indexOf('week') === 0 ? 'Weekly' : 'Monthly'; }
  function renderReflectQs() {
    var qs = REFLECT_Q[periodKind($('refPeriod').value)];
    ['q1', 'q2', 'q3'].forEach(function (id, i) { $(id + 'l').textContent = qs[i]; });
  }
  function showStats(d, stale) {
    var s = d.stats, p = d.prev;
    var h = '<b>' + esc(s.label) + '</b><br>';
    h += s.allowance !== null
      ? 'Spent <b>' + money(s.spent) + '</b> of ' + money(s.allowance) + ' &middot; ' + (s.remaining < 0 ? '<b class="neg">over by ' + money(s.remaining) + '</b>' : '<b>' + money(s.remaining) + '</b> left')
      : 'Spent <b>' + money(s.spent) + '</b>';
    h += '<br>Needs ' + fmt(s.byType.Needs) + ' &middot; Wants ' + fmt(s.byType.Wants) + ' &middot; Culture ' + fmt(s.byType.Culture) + ' &middot; Extra ' + fmt(s.byType.Extra);
    if (s.top && s.top.length) h += '<br>Top: ' + s.top.map(function (t) { return esc(t.category) + ' ' + fmt(t.amount); }).join(', ');
    if (p && p.spent > 0) {
      var diff = Math.round((s.spent - p.spent) / p.spent * 100);
      h += '<br>' + esc(p.label) + ': ' + money(p.spent) + ' (' + (diff === 0 ? 'no change' : (diff > 0 ? 'up ' : 'down ') + Math.abs(diff) + '%') + ')';
    }
    if (s.period === 'month' && s.leftAfterSpending !== null) h += '<br>Left after spending: ' + (s.leftAfterSpending < 0 ? '-' : '') + money(s.leftAfterSpending) + ' (goal ' + money(s.goal) + ')';
    if (stale) h += '<small>Last loaded numbers.</small>';
    $('refStats').innerHTML = h;
  }
  async function loadSummary() {
    var sel = $('refPeriod').value;
    renderReflectQs();
    var cached = await Core.kvGet('summary:' + sel);
    if (cached) showStats(cached, true); else $('refStats').textContent = 'Loading your numbers...';
    if (!conn || !conn.token) return;
    try {
      var r = await Core.api(conn, 'summary', { period: periodKind(sel) === 'Weekly' ? 'week' : 'month', date: periodDate(sel) });
      if (sel !== $('refPeriod').value) return;
      if (r && r.ok) { var d = { stats: r.stats, prev: r.prev }; await Core.kvSet('summary:' + sel, d); showStats(d, false); }
      else if (r && r.error === 'Not authorised') needAuth('This phone needs to sign in again.');
    } catch (e) {
      if (!cached) $('refStats').textContent = 'Connect to the internet to see your numbers. You can still write your reflection.';
    }
  }

  // ---------- events ----------
  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (b) {
    b.addEventListener('click', function () { switchTab(b.getAttribute('data-tab')); });
  });
  $('category').addEventListener('change', syncType);
  $('refPeriod').addEventListener('change', loadSummary);
  $('histRefresh').addEventListener('click', function () { loadHistory(); });

  $('save').addEventListener('click', async function () {
    var amount = parseFloat(($('amount').value || '').replace(/,/g, ''));
    if (!isFinite(amount) || amount <= 0) { say('Enter a valid amount', 'err'); $('amount').focus(); return; }
    if (!cfg) { say('Connect to the internet once to load your categories', 'err'); return; }
    var f = collect(amount);
    if (editing) { await saveEdit(f); return; }
    var id = newId();
    var entry = { id: id, savedAt: Date.now(), kind: 'expense',
                  payload: Object.assign({ id: id, device: (conn && conn.device) || 'Android', person: conn.person }, f) };
    await Core.qPut(entry); queue.push(entry);
    prefs = { category: f.category, payment: f.payment }; Core.kvSet('prefs', prefs);   // remembered for next time
    $('amount').value = ''; $('remarks').value = ''; setNow(); $('after').innerHTML = '';
    say('Saved on this phone \u2713', 'ok');
    renderAll(); registerBackgroundSync(); runSync();
  });

  $('editCancel').addEventListener('click', function () { endEdit(); say('', ''); });
  $('editDelete').addEventListener('click', function () { if (editing) deleteEntry(editing.src, editing.id); });

  $('favs').addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (!b) return;
    var f = favs.filter(function (x) { return x.id === b.getAttribute('data-fav'); })[0];
    if (f && cfg) applyFav(f);
  });
  $('favList').addEventListener('click', async function (ev) {
    var b = ev.target.closest('button'); if (!b) return;
    var id = b.getAttribute('data-favdel');
    favs = favs.filter(function (x) { return x.id !== id; }); await Core.kvSet('favs', favs); renderFavs();
  });
  $('favSave').addEventListener('click', async function () {
    var cat = $('category').value;
    if (!cat) return;
    var label = window.prompt('Name this favourite', ($('remarks').value || cat).trim().slice(0, 20));
    label = label ? label.trim().slice(0, 24) : '';
    if (!label) return;
    var amount = parseFloat(($('amount').value || '').replace(/,/g, '')) || 0;
    favs.push({ id: newId(), label: label, amount: amount, category: cat, payment: $('payment').value, remarks: $('remarks').value });
    await Core.kvSet('favs', favs); renderFavs(); say('Favourite saved \u2605', 'ok');
  });

  $('histList').addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (!b) return;
    var act = b.getAttribute('data-act'), src = b.getAttribute('data-src'), id = b.getAttribute('data-id');
    if (act === 'edit') startEdit(src, id);
    if (act === 'del') deleteEntry(src, id);
  });

  $('refSave').addEventListener('click', async function () {
    var sel = $('refPeriod').value, q1 = $('q1').value.trim(), q2 = $('q2').value.trim(), q3 = $('q3').value.trim();
    if (!q1 && !q2 && !q3) { paint($('refStatus'), 'Write at least one answer.', 'err'); return; }
    var id = newId();
    var entry = { id: id, savedAt: Date.now(), kind: 'reflection',
                  payload: { action: 'reflect', id: id, kind: periodKind(sel), date: periodDate(sel), q1: q1, q2: q2, q3: q3 } };
    await Core.qPut(entry); queue.push(entry);
    $('q1').value = ''; $('q2').value = ''; $('q3').value = '';
    paint($('refStatus'), 'Reflection saved \u2713', 'ok');
    renderAll(); registerBackgroundSync(); runSync();
  });

  $('syncBtn').addEventListener('click', async function () { say('Syncing...', ''); await runSync(); loadConfig(); });
  $('retryCfg').addEventListener('click', function () { say('Trying...', ''); loadConfig(); });
  $('qlist').addEventListener('click', async function (ev) {
    var b = ev.target.closest('button'); if (!b) return;
    var id = b.getAttribute('data-id'), act = b.getAttribute('data-act');
    if (act === 'del') { await Core.qDel(id); await refresh(); }
    if (act === 'retry') {
      var e = queue.filter(function (x) { return x.id === id; })[0];
      if (e) { e.failed = false; e.error = ''; await Core.qPut(e); await refresh(); registerBackgroundSync(); runSync(); }
    }
  });

  // setup, sign-in and PIN screens
  $('sSave').addEventListener('click', async function () {
    var api = $('sApi').value.trim(), person = $('sPerson').value.trim();
    if (!/^https:\/\/script\.google\.com\/.+\/exec/.test(api) || !person) { $('sMsg').textContent = 'Enter the full /exec URL and your name.'; return; }
    conn = { api: api, person: person, token: '', deviceId: deviceId, device: 'Android' };
    await Core.kvSet('conn', conn); route();
  });
  $('otpSend').addEventListener('click', sendCode);
  $('otpResend').addEventListener('click', sendCode);
  $('otpVerify').addEventListener('click', verifyCode);
  $('otpCode').addEventListener('input', function () { if (this.value.length === 6) verifyCode(); });
  $('actCancel').addEventListener('click', function () { forceActivate = false; forgot = false; route(); });
  $('actChange').addEventListener('click', async function () {
    if (queue.length && !confirm(queue.length + ' unsent entries will be sent under the new name. Continue?')) return;
    await Core.kvDel('conn'); await Core.kvDel('cfg'); await Core.kvDel('pin');
    conn = null; cfg = null; pinRec = null; forceActivate = false; forgot = false; route();
  });
  $('pinSave').addEventListener('click', async function () {
    var a = $('pin1').value, b = $('pin2').value, m = $('pinSetMsg');
    if (!/^\d{4,6}$/.test(a)) { m.textContent = 'Use 4 to 6 digits.'; return; }
    if (a !== b) { m.textContent = 'The two PINs do not match.'; return; }
    try { await savePin(a); } catch (e) { m.textContent = 'This browser cannot protect a PIN here (it needs a secure https page).'; return; }
    $('pin1').value = ''; $('pin2').value = ''; m.textContent = '';
    locked = false; hiddenAt = 0; route(); afterUnlock();
  });
  $('pinGo').addEventListener('click', tryUnlock);
  $('pinIn').addEventListener('input', function () { if (pinRec && this.value.length === pinRec.len) tryUnlock(); });
  $('forgotPin').addEventListener('click', function () { forceActivate = true; forgot = true; $('otpMsg').textContent = 'We will email you a code to reset your PIN.'; $('otpBox').hidden = true; $('otpSend').hidden = false; route(); });
  $('lockNow').addEventListener('click', function () { locked = true; route(); });

  $('resetLink').addEventListener('click', async function () {
    var n = queue.length;
    if (!confirm(n ? n + ' entries have not reached your sheet yet and will be lost. Reset anyway?' : 'Reset this app on this phone?')) return;
    ['conn', 'cfg', 'pin', 'prefs', 'favs', 'recent', 'summary:week0', 'summary:week1', 'summary:month0', 'summary:month1'].forEach(function (k) { Core.kvDel(k); });
    await Core.qClear();
    conn = null; cfg = null; pinRec = null; queue = []; favs = []; prefs = {}; recent = []; forceActivate = false; forgot = false; formReady = false;
    say('', ''); route();
  });

  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installPrompt = e; $('installBtn').hidden = false; });
  window.addEventListener('appinstalled', function () { $('installBtn').hidden = true; installPrompt = null; });
  $('installBtn').addEventListener('click', function () { if (installPrompt) { installPrompt.prompt(); installPrompt = null; $('installBtn').hidden = true; } });

  window.addEventListener('online', async function () { renderNet(); await runSync(); loadConfig(); });
  window.addEventListener('offline', renderNet);
  document.addEventListener('visibilitychange', async function () {
    if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
    var limit = ((cfg && cfg.lockSeconds) || 60) * 1000;
    if (pinRec && conn && conn.token && !locked && hiddenAt && Date.now() - hiddenAt > limit) { locked = true; route(); }
    await refresh(); await runSync(); loadConfig();
  });
  setInterval(function () { if (queue.some(function (e) { return !e.failed; })) runSync(); }, 30000);

  // ---------- start ----------
  async function boot() {
    conn = (await Core.kvGet('conn')) || null;
    pinRec = (await Core.kvGet('pin')) || null;
    prefs = (await Core.kvGet('prefs')) || {};
    favs = (await Core.kvGet('favs')) || [];
    deviceId = (await Core.kvGet('deviceId')) || '';
    if (!deviceId) { deviceId = newId(); await Core.kvSet('deviceId', deviceId); }

    // A personal link carries the web app address and the person's name (never a secret).
    var p = new URLSearchParams(location.search);
    if (p.get('api') && p.get('person')) {
      var api = p.get('api'), person = p.get('person');
      if (!conn || conn.api !== api || norm(conn.person) !== norm(person)) {
        conn = { api: api, person: person, token: '', deviceId: deviceId, device: 'Android' };
        await Core.kvSet('conn', conn); await Core.kvDel('pin'); await Core.kvDel('cfg'); pinRec = null;
      }
      try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {}
    }
    var h = location.hash.replace('#', '');
    if (['add', 'history', 'reflect'].indexOf(h) >= 0) tab = h;

    await refresh();
    locked = !!pinRec;               // the PIN is asked for every time the app starts
    route();
    if (tab === 'history' && screen === 'main') loadHistory();
    if (conn && conn.token) { await loadConfig(); await runSync(); }   // sending entries does not need the PIN
    if (navigator.storage && navigator.storage.persist) { try { navigator.storage.persist(); } catch (e) {} }
  }

  boot();
  if ('serviceWorker' in navigator) { window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); }); }
})();
