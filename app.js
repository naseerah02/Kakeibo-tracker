/* The Android app: sign-in, PIN and fingerprint lock, Add / History / Month / Reflect, favourites, funds,
   category limits, English and Urdu, and the offline queue. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var t = I18N.t, tn = I18N.tn;
  var SCREENS = ['setup', 'activate', 'pinSet', 'lock', 'main'];
  var KAKEIBO = ['Needs', 'Wants', 'Culture', 'Extra'];

  var conn = null;          // { api, person, token, deviceId, device }
  var deviceId = '';
  var cfg = null;           // lists + budget from Google, kept for offline use
  var queue = [];           // entries and reflections saved on this phone, not yet in the sheet
  var recent = [];          // last loaded History from Google
  var pinRec = null;        // { salt, hash, len, fails, until }
  var bioRec = null, bioOk = false, bioBusy = false;   // fingerprint: saved credential, available on this phone, prompt open
  var favs = [], prefs = {}, lang = 'en';
  var locked = true, hiddenAt = 0, forceActivate = false, forgot = false;
  var screen = '', lastScreen = '', tab = 'add', editing = null, formReady = false;
  var syncing = false, cfgMsg = '', histNote = '', installPrompt = null, resendTimer = null, fundNoteDay = '', fsFund = '';

  // ---------- small helpers ----------
  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function todayStr() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function daysBetween(a, b) {
    return Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86400000);
  }
  function shiftDate(str, days) {
    var d = new Date(Date.UTC(+str.slice(0, 4), +str.slice(5, 7) - 1, +str.slice(8, 10) + days));
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }
  function setNow() { var d = new Date(); $('date').value = todayStr(); $('time').value = pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function cur() { return (cfg && cfg.currency) || 'PKR'; }
  function fmt(n) { return Math.abs(Math.round(n)).toLocaleString('en-US'); }
  function money(n) { return cur() + ' ' + fmt(n); }
  function paint(el, text, kind) { el.textContent = text; el.className = kind || ''; }
  function say(text, kind) { paint($('status'), text, kind); }
  // Shows a message on whichever tab is open
  function msg(text, kind) { paint(tab === 'history' ? $('histNote') : tab === 'reflect' ? $('refStatus') : $('status'), text, kind); }
  // Messages that come back from Google, in the current language when we have a translation
  function errText(m) { m = String(m == null ? '' : m); return I18N.has('err.' + m) ? t('err.' + m) : m; }
  function typeLabel(v) { return I18N.STR.en['type.' + v] !== undefined ? t('type.' + v) : v; }
  function lvClass(lev) { return lev === 2 ? 'over' : 'warn'; }
  function b64(buf) { var s = '', a = new Uint8Array(buf); for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function unb64(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; var bin = atob(s), out = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }

  // ---------- screens ----------
  function route() {
    var s = !conn ? 'setup' : (!conn.token || forceActivate) ? 'activate' : !pinRec ? 'pinSet' : locked ? 'lock' : 'main';
    SCREENS.forEach(function (n) { $(n).hidden = n !== s; });
    screen = s;
    var titles = { setup: 'who.setup', activate: 'who.activate', pinSet: 'who.pinSet', lock: 'who.lock' };
    $('who').textContent = s === 'main' ? t('who.main', { name: conn.person }) : (t(titles[s]) + (conn && conn.person && s !== 'setup' ? ' \u00b7 ' + conn.person : ''));
    $('actCancel').hidden = !forgot;
    $('lockNow').hidden = !(s === 'main' && pinRec);
    $('langBtn').textContent = t('lang.other');
    renderNet(); renderBioUi();
    if (s === 'lock') {
      $('pinIn').value = '';
      setTimeout(function () { $('pinIn').focus(); }, 50);
      if (lastScreen !== 'lock') { $('bioMsg').textContent = ''; if (bioRec && bioOk) setTimeout(bioUnlock, 350); }   // ask for the fingerprint as soon as the lock appears
    }
    if (s === 'main') { renderTabs(); renderAll(); }
    lastScreen = s;
  }
  function renderNet() {
    var n = $('net');
    n.textContent = navigator.onLine ? t('online') : t('offline');
    n.className = 'chip' + (navigator.onLine ? '' : ' off');
  }
  function renderTabs() {
    ['add', 'history', 'month', 'funds', 'reflect'].forEach(function (x) {
      $('tab' + x.charAt(0).toUpperCase() + x.slice(1)).hidden = x !== tab;
    });
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (b) { b.className = 'tab' + (b.getAttribute('data-tab') === tab ? ' on' : ''); });
  }
  function onTab(x) {
    if (x === 'history') { renderHistory(); loadHistory(); }
    if (x === 'month') loadMonth();
    if (x === 'funds') loadFunds();
    if (x === 'reflect') loadSummary();
  }
  function switchTab(x) { tab = x; renderTabs(); onTab(x); }
  function renderAll() {
    renderNet();
    if (screen !== 'main') return;
    renderBanner(); renderLimitNote(); renderFundNote(); renderFundChips(); renderPreview(); renderQueue(); renderFavs(); renderEdit();
    if (tab === 'history') renderHistory();
  }
  async function refresh() {
    cfg = (await Core.kvGet('cfg')) || null;
    queue = await Core.qAll();
    recent = (await Core.kvGet('recent')) || [];
    renderAll();
  }

  // ---------- language ----------
  function applyLang() {
    I18N.setLang(lang);
    say('', ''); $('otpMsg').textContent = ''; $('pinMsg').textContent = ''; $('bioMsg').textContent = '';
    if (cfg) buildForm();
    $('amount').placeholder = '0.00';
    route();
    if (screen === 'main') onTab(tab);
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
  function leftHtml(n) { return n < 0 ? t('over.by', { amt: money(n) }) : t('left.of', { amt: money(n) }); }

  // How much of an allowance is used, and whether that deserves a warning: 0 = fine, 1 = getting close, 2 = over.
  function level(allowance, left) {
    if (!(allowance > 0)) return { lev: 0, pct: 0 };
    var pct = Math.round((allowance - left) / allowance * 100), warn = (cfg && cfg.warnAt) || 80;
    return { lev: left < 0 ? 2 : (pct >= warn ? 1 : 0), pct: pct };
  }
  function budgetLevels(weekLeft, monthLeft) {
    var b = cfg && cfg.budget;
    return { week: level(b && b.weekAllowance, weekLeft), month: level(b && b.free, monthLeft) };
  }
  function alertLines(weekLeft, monthLeft) {
    var lv = budgetLevels(weekLeft, monthLeft), out = [];
    [['week', lv.week], ['month', lv.month]].forEach(function (x) {
      if (x[1].lev === 2) out.push({ lev: 2, text: t('alert.over.' + x[0]) });
      else if (x[1].lev === 1) out.push({ lev: 1, text: t('alert.near.' + x[0], { pct: x[1].pct }) });
    });
    return out;
  }
  function alertHtml(lines) {
    return lines.map(function (l) { return '<span class="alertline ' + lvClass(l.lev) + '">' + (l.lev === 2 ? '\u26a0 ' : '') + esc(l.text) + '</span>'; }).join('');
  }
  function renderBanner() {
    var est = estimate(), box = $('banner');
    if (!est) { box.hidden = true; return; }
    var lines = alertLines(est.weekLeft, est.monthLeft);
    var worst = lines.reduce(function (m, l) { return Math.max(m, l.lev); }, 0);
    box.className = 'banner' + (worst === 2 ? ' over' : worst === 1 ? ' warn' : '');
    var html = t('banner.line', { week: est.week, w: leftHtml(est.weekLeft), m: leftHtml(est.monthLeft) }) + alertHtml(lines);
    if (est.pending) html += tn('banner.pending', est.pending);
    else if (!navigator.onLine) html += t('banner.offline');
    box.innerHTML = html; box.hidden = false;
  }

  // ---------- category limits (Settings column G) ----------
  // Spending this month for each category that has a limit: what Google knows, plus entries still waiting on this phone,
  // plus (optionally) an entry that is being typed.
  function limitList(extraCat, extraAmt) {
    var b = cfg && cfg.budget, out = [];
    if (!b || !b.limits) return out;
    var warn = cfg.warnAt || 80;
    b.limits.forEach(function (l) {
      if (!(l.limit > 0)) return;
      var spent = l.spent;
      queue.forEach(function (e) {
        if (e.failed || e.kind === 'reflection') return;
        var p = e.payload;
        if (p.category === l.category && p.type !== 'Savings' && String(p.date).slice(0, 7) === b.ym) spent += p.amount;
      });
      if (extraCat === l.category) spent += extraAmt;
      var pct = Math.round(spent / l.limit * 100);
      out.push({ category: l.category, limit: l.limit, spent: spent, pct: pct, lev: spent > l.limit ? 2 : pct >= warn ? 1 : 0 });
    });
    return out;
  }
  function limitAlerts(list) {
    return list.filter(function (l) { return l.lev > 0; }).sort(function (a, b) { return b.pct - a.pct; }).slice(0, 3).map(function (l) {
      return { lev: l.lev, text: l.lev === 2 ? t('limit.note.over', { cat: l.category, limit: money(l.limit), amt: money(l.spent - l.limit) })
                                               : t('limit.note.near', { cat: l.category, pct: l.pct, limit: money(l.limit) }) };
    });
  }
  function renderLimitNote() {
    var box = $('limitNote'), items = limitAlerts(limitList());
    if (!items.length) { box.hidden = true; return; }
    var worst = items.reduce(function (m, i) { return Math.max(m, i.lev); }, 0);
    box.className = 'banner ' + lvClass(worst);
    box.innerHTML = alertHtml(items);
    box.hidden = false;
  }

  // ---------- fund targets: reminders on the Add tab ----------
  // Shown only when a fund needs attention: behind within 90 days, on track in the last week, or the date just passed.
  function fundAlerts() {
    var out = [], today = todayStr();
    ((cfg && cfg.fundTargets) || []).forEach(function (f) {
      if (!(f.target > 0) || !f.targetDate || f.status === 'reached' || f.status === 'none' || f.status === 'past') return;
      var days = daysBetween(today, f.targetDate);
      if (days < 0) {
        if (days >= -30) out.push({ lev: 2, text: t('fund.passed', { name: f.name, amt: money(f.remaining) }) });
      } else if (f.status === 'behind' && days <= 90) {
        out.push({ lev: days <= 30 ? 2 : 1, text: tn('fund.behind', days, { name: f.name, days: days, needed: money(f.needed), planned: money(f.planned), target: money(f.target) }) });
      } else if (f.status === 'on-track' && days <= 7) {
        out.push({ lev: 1, text: tn('fund.track', days, { name: f.name, days: days, target: money(f.target) }) });
      }
    });
    return out;
  }
  function renderFundNote() {
    var box = $('fundNote'), items = fundAlerts();
    if (!items.length || fundNoteDay === todayStr()) { box.hidden = true; return; }
    var worst = items.reduce(function (m, i) { return Math.max(m, i.lev); }, 0);
    box.className = 'banner ' + lvClass(worst);
    $('fundNoteText').innerHTML = items.map(function (i) { return '<span class="alertline ' + lvClass(i.lev) + '">' + esc(i.text) + '</span>'; }).join('');
    box.hidden = false;
  }

  // Under the amount: what the week, the month and the category limit would look like if you save this entry.
  function renderPreview() {
    var box = $('preview'), est = estimate();
    var amount = parseFloat(($('amount').value || '').replace(/,/g, ''));
    if (editing || !cfg || !(amount > 0)) { box.hidden = true; return; }
    var b = cfg.budget, date = $('date').value || todayStr(), cat = $('category').value, lines = [], worst = 0;
    var spending = $('type').value !== 'Savings';
    var sameMonth = !!b && String(date).slice(0, 7) === b.ym;
    if (est && spending && sameMonth && (cfg.fixed || []).indexOf(cat) === -1) {
      var wl = est.weekLeft, ml = est.monthLeft - amount;
      if (weekOf(date) === b.week) wl -= amount;
      worst = Math.max(worst, alertLines(wl, ml).reduce(function (m, l) { return Math.max(m, l.lev); }, 0));
      lines.push(t('preview.after', { w: leftHtml(wl), m: leftHtml(ml) }));
    }
    if (spending && sameMonth) {
      var lim = limitList(cat, amount).filter(function (l) { return l.category === cat; })[0];
      if (lim) {
        worst = Math.max(worst, lim.lev);
        lines.push(lim.spent > lim.limit
          ? t('limit.preview.over', { cat: esc(cat), limit: money(lim.limit), amt: money(lim.spent - lim.limit) })
          : t('limit.preview.left', { cat: esc(cat), limit: money(lim.limit), amt: money(lim.limit - lim.spent) }));
      }
    }
    if (!lines.length) { box.hidden = true; return; }
    box.className = worst === 2 ? 'err' : worst === 1 ? 'warn' : 'hint';
    box.innerHTML = lines.join('<br>');
    box.hidden = false;
  }

  // ---------- the Add form ----------
  function fill(sel, items, labelOf) {
    var keep = sel.value; sel.innerHTML = '';
    (items || []).forEach(function (v) { var o = document.createElement('option'); o.value = v; o.textContent = labelOf ? labelOf(v) : v; sel.appendChild(o); });
    if (keep && (items || []).indexOf(keep) >= 0) sel.value = keep;
  }
  function ensureOption(sel, value, labelOf) {
    if (!value) return;
    for (var i = 0; i < sel.options.length; i++) if (sel.options[i].value === value) return;
    var o = document.createElement('option'); o.value = value; o.textContent = labelOf ? labelOf(value) : value; sel.appendChild(o);
  }
  function syncType() { if (cfg && cfg.types) $('type').value = cfg.types[$('category').value] || 'Extra'; renderPreview(); }
  function buildForm() {
    if (!cfg) return;
    $('cur').textContent = cur(); $('curTag').textContent = cur();
    fill($('category'), cfg.categories); fill($('type'), cfg.kakeiboTypes, typeLabel); fill($('payment'), cfg.payments);
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
  function afterUnlock() { buildForm(); if (!editing) setNow(); renderAll(); tryFund(); onTab(tab); loadConfig(); runSync(); }

  // ---------- home-screen shortcuts: the app can open straight to a screen, or to a fund payment ----------
  var pendingFund = '';
  function applyHash() {
    var h = location.hash.replace('#', '');
    if (h === 'zakat' || h === 'qurbani') { tab = 'add'; pendingFund = h; }
    else if (/^fund-./.test(h)) { tab = 'add'; pendingFund = norm(h.slice(5)); }          // #fund-hajj for any fund you add
    else if (['add', 'history', 'month', 'funds', 'reflect'].indexOf(h) >= 0) { tab = h; pendingFund = ''; }
    else return;
    if (screen === 'main') { renderTabs(); onTab(tab); tryFund(); }
  }
  // The category linked to a fund, found by its name (the funds list comes from Settings).
  function fundCategory(name) {
    var cat = '';
    if (!name) return cat;
    (cfg.funds || []).forEach(function (f) { if (norm(f.name) === name) cat = f.category; });
    if (!cat) cfg.categories.forEach(function (c) { if (!cat && norm(c).indexOf(name) >= 0) cat = c; });
    return cat;
  }
  function chooseFund(name) {
    var cat = cfg ? fundCategory(name) : '';
    if (!cat || cfg.categories.indexOf(cat) < 0) return false;
    if (editing) endEdit();
    $('category').value = cat; syncType(); renderTabs(); $('amount').focus();
    return true;
  }
  function tryFund() {
    if (!pendingFund || screen !== 'main' || !cfg || !formReady) return;
    var name = pendingFund; pendingFund = ''; chooseFund(name);
  }
  // One button for each fund, so paying from any of them is a single tap.
  function renderFundChips() {
    var box = $('fundChips'), list = (cfg && cfg.funds) || [];
    box.hidden = !list.length;
    box.innerHTML = list.length ? '<span class="meta" style="align-self:center">' + esc(t('fund.pay')) + '</span>' + list.map(function (f) {
      return '<button class="fav" type="button" data-fundchip="' + esc(f.name) + '">' + esc(f.name) + '</button>';
    }).join('') : '';
  }

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
        '</span><br><button class="small danger" type="button" data-favdel="' + esc(f.id) + '">' + esc(t('fav.delete')) + '</button></div>';
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
    $('qsum').textContent = t('q.waiting', { n: queue.length - failed }) + (failed ? t('q.failed', { f: failed }) : '');
    $('qlist').innerHTML = queue.map(function (e) {
      var p = e.payload, head = e.kind === 'reflection'
        ? t('q.reflection', { kind: esc(t('kind.' + p.kind)) }) : '<b>' + esc(money(p.amount)) + '</b> &middot; ' + esc(p.category);
      var meta = e.kind === 'reflection' ? esc(p.date) : esc(p.date) + ' ' + esc(p.time) + (p.remarks ? ' &middot; ' + esc(p.remarks) : '');
      return '<div class="qrow"><div>' + head + '</div><div class="meta">' + meta + '</div>' +
        (e.failed ? '<div class="bad">' + esc(t('q.notSaved', { err: errText(e.error) })) + '</div><button class="small" data-act="retry" data-id="' + esc(e.id) + '">' + esc(t('q.retry')) + '</button>'
                  : '<div class="meta">' + esc(t('q.waitItem')) + '</div>') +
        '<button class="small" data-act="del" data-id="' + esc(e.id) + '">' + esc(t('q.delete')) + '</button></div>';
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
      buildForm(); renderAll(); tryFund();
      $('retryCfg').hidden = true;
      if (cfgMsg && $('status').textContent === cfgMsg) { say('', ''); cfgMsg = ''; }
    } else if (r.kind === 'auth') {
      needAuth(t('cfg.auth'));
    } else if (r.kind === 'server') {
      configProblem(r.code === 'page' ? t('cfg.page') : t('cfg.said', { err: errText(r.detail) }), false);
    } else if (navigator.onLine) {
      configProblem(t('cfg.unreachable'), false);
    } else {
      configProblem(t('cfg.offline'), true);
    }
  }

  function noteFor(res) {
    if (!res) return '';
    if (res.fund) return t('note.fund', { name: esc(res.fund.name), state: res.fund.balance < 0 ? t('note.fund.over', { amt: money(res.fund.balance) }) : t('note.fund.ok', { amt: money(res.fund.balance) }) });
    if (res.saving) return t('note.saving');
    if (res.fixed) return t('note.fixed');
    return '';
  }

  async function runSync() {
    if (syncing || !conn) return;
    syncing = true;
    try {
      var touched = {};
      queue.forEach(function (e) { if (!e.failed && e.kind !== 'reflection') touched[e.payload.category] = 1; });
      var r = await Core.syncQueue();
      await refresh();
      if (r.auth) { await needAuth(t('cfg.auth')); return; }
      if (screen !== 'main') return;
      if (r.failed) say(tn('sync.failed', r.failed), 'err');
      else if (r.waiting) say(t('sync.waiting', { n: r.waiting }) + (r.problem && navigator.onLine ? t('sync.problem', { p: errText(r.problem) }) : ''), 'warn');
      else if (r.synced) {
        say(t('sync.done'), 'ok');
        var est = estimate(), parts = [];
        var note = noteFor(r.lastRes); if (note) parts.push(note);
        var warn = est ? alertHtml(alertLines(est.weekLeft, est.monthLeft)) : ''; if (warn) parts.push(warn);
        var lw = alertHtml(limitAlerts(limitList().filter(function (l) { return touched[l.category]; }))); if (lw) parts.push(lw);
        $('after').innerHTML = parts.join(note && (warn || lw) ? '<br>' : '');
      }
    } catch (e) {
      say(t('sync.error', { m: (e && e.message || e) }), 'err');
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
    $('otpMsg').textContent = text || t('auth.default');
    route();
  }

  // ---------- sign-in with an emailed code ----------
  function startResend() {
    var n = 60, btn = $('otpResend');
    btn.disabled = true; btn.textContent = t('otp.resend.n', { n: 60 });
    clearInterval(resendTimer);
    resendTimer = setInterval(function () {
      n--; btn.textContent = n > 0 ? t('otp.resend.n', { n: n }) : t('act.resend');
      if (n <= 0) { btn.disabled = false; clearInterval(resendTimer); }
    }, 1000);
  }
  async function sendCode() {
    $('otpSend').disabled = true; $('otpMsg').textContent = t('otp.sending');
    try {
      var r = await Core.api(conn, 'otp_request', { person: conn.person });
      if (r && r.ok) {
        $('otpBox').hidden = false; $('otpSend').hidden = true;
        $('otpMsg').textContent = t('otp.sent');
        startResend(); $('otpCode').focus();
      } else { $('otpMsg').textContent = errText((r && r.error) || t('otp.fail')); }
    } catch (e) {
      $('otpMsg').textContent = navigator.onLine ? t('otp.unreach.long') : t('otp.offline.get');
    }
    $('otpSend').disabled = false;
  }
  async function verifyCode() {
    var code = $('otpCode').value.trim();
    if (!/^\d{6}$/.test(code)) { $('otpMsg').textContent = t('otp.enter'); return; }
    $('otpVerify').disabled = true;
    try {
      var r = await Core.api(conn, 'otp_verify', { person: conn.person, code: code, deviceId: conn.deviceId || deviceId, label: conn.device || 'Android' });
      if (r && r.ok) {
        conn.token = r.token; conn.person = r.person; await Core.kvSet('conn', conn);
        if (forgot) { await Core.kvDel('pin'); pinRec = null; await Core.kvDel('bio'); bioRec = null; }
        forgot = false; forceActivate = false; locked = false;
        $('otpCode').value = ''; $('otpBox').hidden = true; $('otpSend').hidden = false; $('otpMsg').textContent = '';
        route();
        if (screen === 'main') afterUnlock();
      } else { $('otpMsg').textContent = errText((r && r.error) || t('otp.bad')); }
    } catch (e) {
      $('otpMsg').textContent = navigator.onLine ? t('otp.unreach') : t('otp.offline.try');
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
  function unlockNow() { locked = false; hiddenAt = 0; route(); afterUnlock(); }
  async function tryUnlock() {
    var pin = $('pinIn').value;
    if (!pin || !pinRec) return;
    var wait = Math.ceil((pinRec.until - Date.now()) / 1000);
    if (wait > 0) { $('pinMsg').textContent = t('pin.wait', { n: wait }); $('pinIn').value = ''; return; }
    var h;
    try { h = await pinHash(pin, pinRec.salt); } catch (e) { $('pinMsg').textContent = t('pin.nocheck'); return; }
    if (h === pinRec.hash) {
      pinRec.fails = 0; pinRec.until = 0; await Core.kvSet('pin', pinRec);
      unlockNow(); return;
    }
    pinRec.fails++;
    $('pinIn').value = '';
    if (pinRec.fails >= 10) {   // too many wrong PINs: forget the PIN, the fingerprint and the sign-in, an email code is needed again
      await Core.kvDel('pin'); pinRec = null; await Core.kvDel('bio'); bioRec = null;
      conn.token = ''; await Core.kvSet('conn', conn);
      forgot = false; forceActivate = false;
      $('otpMsg').textContent = t('otp.pinwrong'); route(); return;
    }
    if (pinRec.fails % 5 === 0) pinRec.until = Date.now() + 30000;
    await Core.kvSet('pin', pinRec);
    $('pinMsg').textContent = t('pin.wrong', { n: 10 - pinRec.fails });
  }

  // ---------- fingerprint (the phone's own fingerprint or screen-lock check, through WebAuthn) ----------
  // This is a local lock like the PIN: the browser asks the phone to verify you, and the app opens when it says yes.
  async function detectBio() {
    try { bioOk = !!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.create && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); }
    catch (e) { bioOk = false; }
  }
  function renderBioUi() {
    $('bioBtn').hidden = !(bioOk && bioRec);
    var tg = $('bioToggle');
    tg.hidden = !(screen === 'main' && bioOk && pinRec);
    tg.textContent = bioRec ? t('bio.off') : t('bio.on');
  }
  async function enableBio() {
    try {
      var cred = await navigator.credentials.create({ publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: 'Expense Tracker', id: location.hostname },
        user: { id: crypto.getRandomValues(new Uint8Array(16)), name: (conn && conn.person) || 'user', displayName: (conn && conn.person) || 'user' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
        timeout: 60000, attestation: 'none' } });
      if (!cred) throw new Error('cancelled');
      bioRec = { id: b64(cred.rawId) };
      await Core.kvSet('bio', bioRec);
      renderBioUi(); msg(t('bio.enabled'), 'ok');
    } catch (e) { msg(t('bio.cannot'), 'err'); }
  }
  async function disableBio() { await Core.kvDel('bio'); bioRec = null; renderBioUi(); msg(t('bio.disabled'), ''); }
  async function bioUnlock() {
    if (!bioRec || !bioOk || bioBusy || screen !== 'lock') return;
    bioBusy = true; $('bioMsg').textContent = '';
    try {
      var r = await navigator.credentials.get({ publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rpId: location.hostname,
        allowCredentials: [{ type: 'public-key', id: unb64(bioRec.id), transports: ['internal'] }],
        userVerification: 'required', timeout: 60000 } });
      bioBusy = false;
      if (r) { unlockNow(); return; }
    } catch (e) { /* cancelled or not recognised */ }
    bioBusy = false;
    $('bioMsg').textContent = t('bio.failed');
  }

  // ---------- edit and delete ----------
  function renderEdit() {
    $('editBar').hidden = !editing;
    $('save').textContent = editing ? t('save.changes') : t('save.record');
    if (editing) $('editText').textContent = editing.src === 'q' ? t('edit.text.q') : t('edit.text');
  }
  function startEdit(src, id) {
    var item = src === 'q' ? (queue.filter(function (e) { return e.id === id; })[0] || {}).payload
                           : recent.filter(function (e) { return e.id === id; })[0];
    if (!item) return;
    editing = { src: src, id: id };
    ensureOption($('category'), item.category); ensureOption($('payment'), item.payment); ensureOption($('type'), item.type, typeLabel);
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
      endEdit(); await refresh(); say(t('edit.savedLocal'), 'ok'); runSync(); return;
    }
    say(t('edit.saving'), '');
    var r;
    try { r = await Core.api(conn, 'update', Object.assign({ id: editing.id }, f)); }
    catch (err) { say(t('edit.offline'), 'err'); return; }
    if (r && r.error === 'Not authorised') { needAuth(t('auth.short')); return; }
    if (!(r && r.ok)) { say(errText((r && r.error) || t('edit.fail')), 'err'); return; }
    var id = editing.id;
    recent = recent.map(function (x) { return x.id === id ? Object.assign({}, x, f) : x; });
    await Core.kvSet('recent', recent);
    if (r.budget && cfg) { cfg.budget = r.budget; await Core.kvSet('cfg', cfg); }
    endEdit(); renderAll(); say(t('edit.saved'), 'ok');
  }

  async function deleteEntry(src, id) {
    if (!confirm(t('del.confirm'))) return;
    if (src === 'q') {
      await Core.qDel(id); if (editing && editing.id === id) endEdit();
      await refresh(); msg(t('del.done'), 'ok'); return;
    }
    var r;
    try { r = await Core.api(conn, 'delete', { id: id }); }
    catch (err) { msg(t('del.offline'), 'err'); return; }
    if (r && r.error === 'Not authorised') { needAuth(t('auth.short')); return; }
    if (!(r && r.ok)) { msg(errText((r && r.error) || t('del.fail')), 'err'); return; }
    recent = recent.filter(function (x) { return x.id !== id; });
    await Core.kvSet('recent', recent);
    if (r.budget && cfg) { cfg.budget = r.budget; await Core.kvSet('cfg', cfg); }
    if (editing && editing.id === id) endEdit();
    renderAll(); msg(t('del.done'), 'ok');
  }

  // ---------- History ----------
  async function loadHistory() {
    if (!conn || !conn.token) return;
    try {
      var r = await Core.api(conn, 'recent');
      if (r && r.ok) { recent = r.entries; await Core.kvSet('recent', recent); histNote = ''; }
      else if (r && r.error === 'Not authorised') { needAuth(t('auth.short')); return; }
      else histNote = errText((r && r.error) || t('hist.fail'));
    } catch (e) { histNote = t('hist.offline'); }
    renderHistory();
  }
  function rowHtml(src, id, p, note) {
    return '<div class="qrow"><div><b>' + esc(money(p.amount)) + '</b> &middot; ' + esc(p.category) + '</div>' +
      '<div class="meta">' + esc(p.date) + ' ' + esc(p.time) + (p.remarks ? ' &middot; ' + esc(p.remarks) : '') + '</div>' +
      (note ? '<div class="meta">' + esc(note) + '</div>' : '') +
      '<button class="small" type="button" data-act="edit" data-src="' + src + '" data-id="' + esc(id) + '">' + esc(t('hist.edit')) + '</button>' +
      '<button class="small danger" type="button" data-act="del" data-src="' + src + '" data-id="' + esc(id) + '">' + esc(t('hist.delete')) + '</button></div>';
  }
  function renderHistory() {
    if (histNote) paint($('histNote'), histNote, 'warn');
    else if ($('histNote').className === 'warn') paint($('histNote'), '', '');
    var pend = queue.filter(function (e) { return e.kind !== 'reflection'; }), seen = {};
    pend.forEach(function (e) { seen[e.id] = 1; });
    var rows = pend.map(function (e) { return rowHtml('q', e.id, e.payload, e.failed ? t('q.notSaved', { err: errText(e.error) }) : t('q.waitItem')); });
    rows = rows.concat(recent.filter(function (x) { return !seen[x.id]; }).map(function (x) { return rowHtml('s', x.id, x, ''); }));
    $('histList').innerHTML = rows.length ? rows.join('') : t('hist.none');
  }

  // ---------- Reflect ----------
  function periodDate(sel) { var d = todayStr(); return sel === 'week1' ? shiftDate(d, -7) : sel === 'month1' ? shiftDate(d.slice(0, 7) + '-01', -1) : d; }
  function periodKind(sel) { return sel.indexOf('week') === 0 ? 'Weekly' : 'Monthly'; }
  function renderReflectQs() {
    var k = periodKind($('refPeriod').value) === 'Weekly' ? 'w' : 'm';
    ['q1', 'q2', 'q3'].forEach(function (id, i) { $(id + 'l').textContent = t('ref.q.' + k + (i + 1)); });
  }
  function changeText(s, p) {
    var diff = Math.round((s.spent - p.spent) / p.spent * 100);
    return diff === 0 ? t('chg.same') : diff > 0 ? t('chg.up', { pct: Math.abs(diff) }) : t('chg.down', { pct: Math.abs(diff) });
  }
  function showStats(d, stale) {
    var s = d.stats, p = d.prev;
    var h = '<b>' + esc(I18N.label(s.label)) + '</b><br>';
    h += s.allowance !== null
      ? t('stats.spent.of', { amt: money(s.spent), allow: money(s.allowance), left: s.remaining < 0 ? t('over.by', { amt: money(s.remaining) }) : t('left.of', { amt: money(s.remaining) }) })
      : t('stats.spent', { amt: money(s.spent) });
    h += '<br>' + KAKEIBO.map(function (ty) { return typeLabel(ty) + ' ' + fmt(s.byType[ty]); }).join(' &middot; ');
    if (s.top && s.top.length) h += t('stats.top', { list: s.top.map(function (x) { return esc(x.category) + ' ' + fmt(x.amount); }).join(', ') });
    if (p && p.spent > 0) h += t('stats.prev', { label: esc(I18N.label(p.label)), amt: money(p.spent), change: changeText(s, p) });
    if (s.period === 'month' && s.leftAfterSpending !== null) h += t('stats.leftafter', { amt: (s.leftAfterSpending < 0 ? '-' : '') + money(s.leftAfterSpending), goal: money(s.goal) });
    if (stale) h += t('stats.last');
    $('refStats').innerHTML = h;
  }
  async function loadSummary() {
    var sel = $('refPeriod').value;
    renderReflectQs();
    var cached = await Core.kvGet('summary:' + sel);
    if (cached) showStats(cached, true); else $('refStats').textContent = t('sum.loading');
    if (!conn || !conn.token) return;
    try {
      var r = await Core.api(conn, 'summary', { period: periodKind(sel) === 'Weekly' ? 'week' : 'month', date: periodDate(sel) });
      if (sel !== $('refPeriod').value) return;
      if (r && r.ok) { var d = { stats: r.stats, prev: r.prev }; await Core.kvSet('summary:' + sel, d); showStats(d, false); }
      else if (r && r.error === 'Not authorised') needAuth(t('auth.short'));
    } catch (e) {
      if (!cached) $('refStats').textContent = t('sum.offline');
    }
  }

  // ---------- Month ----------
  var TYPE_COLORS = { Needs: '#2563eb', Wants: '#f59e0b', Culture: '#10b981', Extra: '#ef4444' };
  function monthDate(n) {
    var d0 = todayStr(), d = new Date(Date.UTC(+d0.slice(0, 4), +d0.slice(5, 7) - 1 - n, 1));
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + (n === 0 ? d0.slice(8, 10) : '01');
  }
  function short(n) { return n >= 1000 ? (Math.round(n / 100) / 10) + 'k' : String(Math.round(n)); }
  function barRow(label, value, pct, color) {
    return '<div class="bar"><span class="lab">' + esc(label) + '</span><div class="track"><div class="fill" style="width:' + Math.max(2, Math.min(100, pct)) + '%' +
      (color ? ';background:' + color : '') + '"></div></div><span class="val">' + esc(value) + '</span></div>';
  }
  function weeksSvg(weeks) {
    var n = weeks.length, bw = 300 / n, base = 92, top = 14, max = 1;
    weeks.forEach(function (w) { max = Math.max(max, w.spent, w.allowance || 0); });
    var out = '<svg class="chart" viewBox="0 0 300 110" role="img" aria-label="' + esc(t('chart.weeks')) + '">';
    weeks.forEach(function (w, i) {
      var x = i * bw + bw * 0.2, wd = bw * 0.6, hs = w.spent / max * (base - top), ha = w.allowance ? w.allowance / max * (base - top) : 0;
      var over = w.allowance && w.spent > w.allowance;
      if (ha) out += '<rect x="' + x.toFixed(1) + '" y="' + (base - ha).toFixed(1) + '" width="' + wd.toFixed(1) + '" height="' + ha.toFixed(1) + '" style="fill:none;stroke:var(--muted);stroke-dasharray:3 2"/>';
      out += '<rect x="' + x.toFixed(1) + '" y="' + (base - hs).toFixed(1) + '" width="' + wd.toFixed(1) + '" height="' + Math.max(hs, 0.5).toFixed(1) + '" style="fill:' + (over ? 'var(--err)' : 'var(--accent)') + '"/>';
      out += '<text x="' + (x + wd / 2).toFixed(1) + '" y="' + (base - Math.max(hs, ha) - 3).toFixed(1) + '" text-anchor="middle">' + short(w.spent) + '</text>';
      out += '<text x="' + (x + wd / 2).toFixed(1) + '" y="103" text-anchor="middle">' + esc(w.label) + '</text>';
    });
    return out + '<line x1="0" y1="' + base + '" x2="300" y2="' + base + '" style="stroke:var(--line)"/></svg>';
  }
  function daysSvg(days, today) {
    var n = days.length, bw = 300 / n, base = 56, max = 1;
    days.forEach(function (d) { max = Math.max(max, d.spent); });
    var out = '<svg class="chart" viewBox="0 0 300 70" role="img" aria-label="' + esc(t('chart.days')) + '">';
    days.forEach(function (d, i) {
      var h = d.spent / max * (base - 6);
      out += '<rect x="' + (i * bw + bw * 0.12).toFixed(1) + '" y="' + (base - h).toFixed(1) + '" width="' + (bw * 0.76).toFixed(1) + '" height="' + Math.max(h, d.spent ? 1 : 0).toFixed(1) +
        '" style="fill:' + (d.d === today ? 'var(--warn)' : 'var(--accent)') + '"/>';
    });
    [0, Math.floor((n - 1) / 2), n - 1].forEach(function (i, k) {
      if (k && i === 0) return;
      out += '<text x="' + (i * bw + bw / 2).toFixed(1) + '" y="67" text-anchor="middle">' + days[i].d + '</text>';
    });
    return out + '<line x1="0" y1="' + base + '" x2="300" y2="' + base + '" style="stroke:var(--line)"/></svg>';
  }
  function targetRow(f) {
    var days = daysBetween(todayStr(), f.targetDate);
    var color = f.status === 'reached' ? 'var(--ok)' : (f.status === 'behind' || f.status === 'overdue' || f.status === 'past') ? 'var(--warn)' : '';
    var m = f.status === 'reached' ? t('t.reached') : (f.status === 'overdue' || f.status === 'past') ? t('t.passed') : tn('t.days', days, { days: days });
    if (f.status === 'behind') m += t('t.behind', { needed: money(f.needed), planned: money(f.planned) });
    else if (f.status === 'on-track') m += t('t.ontrack');
    return barRow(f.name, f.progress + '%', f.progress, color) +
      '<p class="meta" style="margin:0 0 6px">' + t('t.line', { bal: money(f.balance), target: money(f.target), date: esc(f.targetDate), msg: m }) + '</p>';
  }
  function showMonth(d, stale, n) {
    var s = d.stats, p = d.prev, h = '<b>' + esc(I18N.label(s.label)) + '</b>';
    var left = s.remaining, isOver = left !== null && left < 0;
    h += '<div class="kpis"><div><small>' + esc(t('k.spent')) + '</small><b>' + money(s.spent) + '</b></div>' +
         '<div><small>' + esc(t('k.allow')) + '</small><b>' + (s.allowance === null ? '-' : money(s.allowance)) + '</b></div>' +
         '<div><small>' + esc(isOver ? t('k.over') : t('k.left')) + '</small><b class="' + (isOver ? 'neg' : '') + '">' + (left === null ? '-' : money(left)) + '</b></div></div>';
    if (s.allowance) {
      var lv = level(s.allowance, left), color = lv.lev === 2 ? 'var(--err)' : lv.lev === 1 ? 'var(--warn)' : '';
      h += barRow(t('m.used'), lv.pct + '%', lv.pct, color);
    }
    var days = n === 0 ? +todayStr().slice(8, 10) : (s.daily ? s.daily.length : 1);
    var note = [];
    if (s.count) note.push(t('m.perday', { amt: money(s.spent / days) }));
    if (s.fixedPaid) note.push(t('m.fixed', { amt: money(s.fixedPaid) }));
    if (s.savingsPaid) note.push(t('m.savings', { amt: money(s.savingsPaid) }));
    if (p && p.spent > 0) {
      var diff = Math.round((s.spent - p.spent) / p.spent * 100), lab = esc(I18N.label(p.label));
      note.push(diff === 0 ? t('m.same', { label: lab }) : diff > 0 ? t('m.up', { pct: Math.abs(diff), label: lab }) : t('m.down', { pct: Math.abs(diff), label: lab }));
    }
    if (note.length) h += '<p class="hint" style="margin:6px 0 0">' + note.join(' &middot; ') + '</p>';

    var total = 0; KAKEIBO.forEach(function (ty) { total += s.byType[ty]; });
    h += '<h3 class="sec">' + t('m.split') + '</h3>';
    if (!total) h += '<p class="hint">' + esc(t('m.nospend')) + '</p>';
    else {
      h += '<div class="stack">' + KAKEIBO.map(function (ty) {
        return s.byType[ty] ? '<div style="width:' + (s.byType[ty] / total * 100).toFixed(1) + '%;background:' + TYPE_COLORS[ty] + '"></div>' : '';
      }).join('') + '</div><div class="legend">' + KAKEIBO.map(function (ty) {
        return '<span><span class="dot" style="background:' + TYPE_COLORS[ty] + '"></span>' + esc(typeLabel(ty)) + ' ' + fmt(s.byType[ty]) + ' (' + Math.round(s.byType[ty] / total * 100) + '%)</span>';
      }).join('') + '</div>';
    }
    var cats = (s.byCategory || []).slice(0, 8);
    if (cats.length) {
      h += '<h3 class="sec">' + t('m.bycat') + '</h3>';
      cats.forEach(function (c) { h += barRow(c.category, fmt(c.amount), c.amount / cats[0].amount * 100); });
    }
    var lims = d.limits || [];
    if (lims.length) {
      h += '<h3 class="sec">' + t('m.limits') + '</h3>';
      lims.forEach(function (l) {
        var pct = Math.round(l.spent / l.limit * 100);
        h += barRow(l.category, fmt(l.spent) + ' / ' + fmt(l.limit), pct, l.spent > l.limit ? 'var(--err)' : pct >= ((cfg && cfg.warnAt) || 80) ? 'var(--warn)' : '');
      });
    }
    if (s.weeks && s.weeks.length) h += '<h3 class="sec">' + t('m.byweek') + '</h3>' + weeksSvg(s.weeks);
    if (s.daily && s.daily.length) h += '<h3 class="sec">' + t('m.byday') + '</h3>' + daysSvg(s.daily, n === 0 ? +todayStr().slice(8, 10) : 0);
    if (d.funds && d.funds.length) {
      h += '<h3 class="sec">' + t('m.funds') + '</h3>' + d.funds.map(function (f) {
        return '<div class="bar"><span class="lab"><a class="link" data-fs="' + esc(f.name) + '">' + esc(f.name) + '</a></span><span class="val" style="flex:1;text-align:start;color:var(--text)">' +
          (f.balance < 0 ? t('m.fund.over', { amt: money(f.balance) }) : t('m.fund.ok', { amt: money(f.balance) })) + '</span></div>';
      }).join('');
    }
    var targets = n === 0 ? (d.targets || []).filter(function (f) { return f.target > 0 && f.targetDate; }) : [];
    if (targets.length) h += '<h3 class="sec">' + t('m.targets') + '</h3>' + targets.map(targetRow).join('');
    if (stale) h += t('m.last');
    $('monBody').innerHTML = h;
  }
  async function loadMonth() {
    var n = +$('monPeriod').value, date = monthDate(n), key = 'month:' + date.slice(0, 7);
    var cached = await Core.kvGet(key);
    if (cached) showMonth(cached, true, n); else $('monBody').innerHTML = '<p class="hint">' + esc(t('sum.loading')) + '</p>';
    if (!conn || !conn.token) return;
    try {
      var r = await Core.api(conn, 'summary', { period: 'month', date: date, detail: true });
      if (n !== +$('monPeriod').value) return;
      if (r && r.ok) { var d = { stats: r.stats, prev: r.prev, funds: r.funds || [], targets: r.targets || [], limits: r.limits || [] }; await Core.kvSet(key, d); showMonth(d, false, n); }
      else if (r && r.error === 'Not authorised') needAuth(t('auth.short'));
    } catch (e) {
      if (!cached) $('monBody').innerHTML = t('m.offline');
    }
  }

  // ---------- Funds: the statement for one fund ----------
  var MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function monthText(ym) { return I18N.label(MON3[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4)); }
  function signed(n) { return (n < 0 ? '-' : '') + money(n); }

  function showFund(d, stale) {
    var f = d.fund, h = '';
    h += '<div class="kpis"><div><small>' + esc(t('fs.balance')) + '</small><b class="' + (f.balance < 0 ? 'neg' : '') + '">' + signed(f.balance) + '</b></div>' +
         '<div><small>' + esc(t('fs.collected')) + '</small><b>' + money(f.setAsideToDate) + '</b></div>' +
         '<div><small>' + esc(t('fs.paid')) + '</small><b>' + money(f.paidToDate) + '</b></div></div>';
    if (f.opening) h += '<p class="meta" style="margin:0 0 6px">' + esc(t('fs.opening', { amt: money(f.opening) })) + '</p>';
    if (f.target > 0 && f.targetDate) {
      h += '<div class="kpis"><div><small>' + esc(t('fs.target')) + '</small><b>' + money(f.target) + '</b></div>' +
           '<div><small>' + esc(t('fs.togo')) + '</small><b>' + money(f.remaining) + '</b></div></div>' + targetRow(f);
    } else {
      h += '<p class="hint">' + esc(t('fs.notarget')) + '</p>';
    }
    var ms = d.months || [];
    if (ms.length) {
      h += '<h3 class="sec">' + esc(t('fs.months')) + '</h3><table class="tbl"><thead><tr><th>' + esc(t('fs.h.month')) + '</th><th>' + esc(t('fs.h.set')) +
           '</th><th>' + esc(t('fs.h.paid')) + '</th><th>' + esc(t('fs.h.bal')) + '</th></tr></thead><tbody>' +
        ms.slice().reverse().map(function (m) {
          return '<tr><td>' + esc(monthText(m.month)) + '</td><td>' + fmt(m.setAside) + '</td><td>' + fmt(m.paid) + '</td><td class="' + (m.balance < 0 ? 'neg' : '') + '">' +
                 (m.balance < 0 ? '-' : '') + fmt(m.balance) + '</td></tr>';
        }).join('') + '</tbody></table>';
    }
    h += '<h3 class="sec">' + esc(t('fs.payments')) + '</h3>';
    if (!d.paymentCount) {
      h += '<p class="hint">' + esc(t('fs.nopay')) + '</p>';
    } else {
      h += '<p class="hint" style="margin:0 0 4px">' + esc(tn('fs.total', d.paymentCount, { amt: money(d.paymentTotal) })) + '</p>' +
        d.payments.map(function (p) {
          return '<div class="qrow"><div><b>' + esc(money(p.amount)) + '</b> &middot; ' + esc(p.person) + '</div><div class="meta">' + esc(p.date) + ' ' + esc(p.time) +
                 (p.payment ? ' &middot; ' + esc(p.payment) : '') + (p.remarks ? ' &middot; ' + esc(p.remarks) : '') + '</div></div>';
        }).join('');
      if (d.paymentCount > d.payments.length) h += '<p class="meta">' + esc(t('fs.more', { n: d.payments.length, total: d.paymentCount })) + '</p>';
    }
    h += '<button class="primary" type="button" data-fspay="' + esc(f.name) + '">' + esc(t('fs.paybtn')) + '</button>';
    if (stale) h += t('m.last');
    $('fsBody').innerHTML = h;
  }
  async function loadFunds() {
    var list = (cfg && cfg.funds) || [];
    fill($('fsPick'), list.map(function (f) { return f.name; }));
    if (!cfg) { $('fsBody').innerHTML = '<p class="hint">' + esc(t('sum.loading')) + '</p>'; return; }
    if (!list.length) { $('fsBody').innerHTML = '<p class="hint">' + esc(t('fs.none')) + '</p>'; return; }
    if (fsFund && list.some(function (f) { return f.name === fsFund; })) $('fsPick').value = fsFund;
    var name = $('fsPick').value; fsFund = name;
    var key = 'fund:' + norm(name);
    var cached = await Core.kvGet(key);
    if (cached) showFund(cached, true); else $('fsBody').innerHTML = '<p class="hint">' + esc(t('sum.loading')) + '</p>';
    if (!conn || !conn.token) return;
    try {
      var r = await Core.api(conn, 'fund_statement', { fund: name });
      if (name !== $('fsPick').value) return;
      if (r && r.ok) { await Core.kvSet(key, r); showFund(r, false); }
      else if (r && r.error === 'Not authorised') needAuth(t('auth.short'));
      else if (!cached) $('fsBody').innerHTML = '<p class="hint">' + esc(errText((r && r.error) || '')) + '</p>';
    } catch (e) {
      if (!cached) $('fsBody').innerHTML = t('fs.offline');
    }
  }

  // ---------- events ----------
  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (b) {
    b.addEventListener('click', function () { switchTab(b.getAttribute('data-tab')); });
  });
  $('category').addEventListener('change', syncType);
  $('type').addEventListener('change', renderPreview);
  $('amount').addEventListener('input', renderPreview);
  $('date').addEventListener('change', renderPreview);
  $('monPeriod').addEventListener('change', loadMonth);
  $('fsPick').addEventListener('change', function () { fsFund = $('fsPick').value; loadFunds(); });
  $('fsBody').addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-fspay]');
    if (b) { switchTab('add'); chooseFund(norm(b.getAttribute('data-fspay'))); }
  });
  $('monBody').addEventListener('click', function (ev) {
    var a = ev.target.closest('a[data-fs]');
    if (a) { fsFund = a.getAttribute('data-fs'); switchTab('funds'); }
  });
  $('fundChips').addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (b) chooseFund(norm(b.getAttribute('data-fundchip')));
  });
  $('fundNoteX').addEventListener('click', async function () { fundNoteDay = todayStr(); await Core.kvSet('fundNoteDay', fundNoteDay); renderFundNote(); });
  window.addEventListener('hashchange', applyHash);
  $('refPeriod').addEventListener('change', loadSummary);
  $('histRefresh').addEventListener('click', function () { loadHistory(); });

  $('langBtn').addEventListener('click', async function () { lang = lang === 'ur' ? 'en' : 'ur'; await Core.kvSet('lang', lang); applyLang(); });
  $('bioToggle').addEventListener('click', function () { if (bioRec) disableBio(); else enableBio(); });
  $('bioBtn').addEventListener('click', bioUnlock);

  $('save').addEventListener('click', async function () {
    var amount = parseFloat(($('amount').value || '').replace(/,/g, ''));
    if (!isFinite(amount) || amount <= 0) { say(t('f.invalid'), 'err'); $('amount').focus(); return; }
    if (!cfg) { say(t('f.nocfg'), 'err'); return; }
    var f = collect(amount);
    if (editing) { await saveEdit(f); return; }
    var id = newId();
    var entry = { id: id, savedAt: Date.now(), kind: 'expense',
                  payload: Object.assign({ id: id, device: (conn && conn.device) || 'Android', person: conn.person }, f) };
    await Core.qPut(entry); queue.push(entry);
    prefs = { category: f.category, payment: f.payment }; Core.kvSet('prefs', prefs);   // remembered for next time
    $('amount').value = ''; $('remarks').value = ''; setNow(); $('after').innerHTML = '';
    say(t('saved.local'), 'ok');
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
    var label = window.prompt(t('fav.prompt'), ($('remarks').value || cat).trim().slice(0, 20));
    label = label ? label.trim().slice(0, 24) : '';
    if (!label) return;
    var amount = parseFloat(($('amount').value || '').replace(/,/g, '')) || 0;
    favs.push({ id: newId(), label: label, amount: amount, category: cat, payment: $('payment').value, remarks: $('remarks').value });
    await Core.kvSet('favs', favs); renderFavs(); say(t('fav.saved'), 'ok');
  });

  $('histList').addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (!b) return;
    var act = b.getAttribute('data-act'), src = b.getAttribute('data-src'), id = b.getAttribute('data-id');
    if (act === 'edit') startEdit(src, id);
    if (act === 'del') deleteEntry(src, id);
  });

  $('refSave').addEventListener('click', async function () {
    var sel = $('refPeriod').value, q1 = $('q1').value.trim(), q2 = $('q2').value.trim(), q3 = $('q3').value.trim();
    if (!q1 && !q2 && !q3) { paint($('refStatus'), t('ref.empty'), 'err'); return; }
    var id = newId();
    var entry = { id: id, savedAt: Date.now(), kind: 'reflection',
                  payload: { action: 'reflect', id: id, kind: periodKind(sel), date: periodDate(sel), q1: q1, q2: q2, q3: q3 } };
    await Core.qPut(entry); queue.push(entry);
    $('q1').value = ''; $('q2').value = ''; $('q3').value = '';
    paint($('refStatus'), t('ref.saved'), 'ok');
    renderAll(); registerBackgroundSync(); runSync();
  });

  $('syncBtn').addEventListener('click', async function () { say(t('sync.syncing'), ''); await runSync(); loadConfig(); });
  $('retryCfg').addEventListener('click', function () { say(t('cfg.trying'), ''); loadConfig(); });
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
    if (!/^https:\/\/script\.google\.com\/.+\/exec/.test(api) || !person) { $('sMsg').textContent = t('setup.invalid'); return; }
    conn = { api: api, person: person, token: '', deviceId: deviceId, device: 'Android' };
    await Core.kvSet('conn', conn); route();
  });
  $('otpSend').addEventListener('click', sendCode);
  $('otpResend').addEventListener('click', sendCode);
  $('otpVerify').addEventListener('click', verifyCode);
  $('otpCode').addEventListener('input', function () { if (this.value.length === 6) verifyCode(); });
  $('actCancel').addEventListener('click', function () { forceActivate = false; forgot = false; route(); });
  $('actChange').addEventListener('click', async function () {
    if (queue.length && !confirm(t('change.confirm', { n: queue.length }))) return;
    await Core.kvDel('conn'); await Core.kvDel('cfg'); await Core.kvDel('pin'); await Core.kvDel('bio');
    conn = null; cfg = null; pinRec = null; bioRec = null; forceActivate = false; forgot = false; route();
  });
  $('pinSave').addEventListener('click', async function () {
    var a = $('pin1').value, b = $('pin2').value, m = $('pinSetMsg');
    if (!/^\d{4,6}$/.test(a)) { m.textContent = t('pin.digits'); return; }
    if (a !== b) { m.textContent = t('pin.match'); return; }
    try { await savePin(a); } catch (e) { m.textContent = t('pin.nosave'); return; }
    $('pin1').value = ''; $('pin2').value = ''; m.textContent = '';
    unlockNow();
  });
  $('pinGo').addEventListener('click', tryUnlock);
  $('pinIn').addEventListener('input', function () { if (pinRec && this.value.length === pinRec.len) tryUnlock(); });
  $('forgotPin').addEventListener('click', function () { forceActivate = true; forgot = true; $('otpMsg').textContent = t('otp.forgot'); $('otpBox').hidden = true; $('otpSend').hidden = false; route(); });
  $('lockNow').addEventListener('click', function () { locked = true; route(); });

  $('resetLink').addEventListener('click', async function () {
    var n = queue.length;
    if (!confirm(n ? t('reset.confirm.n', { n: n }) : t('reset.confirm'))) return;
    ['conn', 'cfg', 'pin', 'bio', 'prefs', 'favs', 'recent', 'fundNoteDay'].forEach(function (k) { Core.kvDel(k); });
    (await Core.kvKeys()).forEach(function (k) { if (/^(summary|month|fund):/.test(String(k))) Core.kvDel(k); });
    await Core.qClear();
    conn = null; cfg = null; pinRec = null; bioRec = null; queue = []; favs = []; prefs = {}; recent = []; fundNoteDay = ''; forceActivate = false; forgot = false; formReady = false;
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
    bioRec = (await Core.kvGet('bio')) || null;
    prefs = (await Core.kvGet('prefs')) || {};
    favs = (await Core.kvGet('favs')) || [];
    fundNoteDay = (await Core.kvGet('fundNoteDay')) || '';
    deviceId = (await Core.kvGet('deviceId')) || '';
    if (!deviceId) { deviceId = newId(); await Core.kvSet('deviceId', deviceId); }
    lang = (await Core.kvGet('lang')) || (/^ur/i.test(navigator.language || '') ? 'ur' : 'en');
    I18N.setLang(lang);
    await detectBio();
    if (!bioOk) bioRec = null;

    // A personal link carries the web app address and the person's name (never a secret).
    var p = new URLSearchParams(location.search);
    if (p.get('api') && p.get('person')) {
      var api = p.get('api'), person = p.get('person');
      if (!conn || conn.api !== api || norm(conn.person) !== norm(person)) {
        conn = { api: api, person: person, token: '', deviceId: deviceId, device: 'Android' };
        await Core.kvSet('conn', conn); await Core.kvDel('pin'); await Core.kvDel('bio'); await Core.kvDel('cfg'); pinRec = null; bioRec = null;
      }
      try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {}
    }
    applyHash();

    await refresh();
    locked = !!pinRec;               // the PIN (or fingerprint) is asked for every time the app starts
    route();
    if (screen === 'main') onTab(tab);
    if (conn && conn.token) { await loadConfig(); await runSync(); }   // sending entries does not need the PIN
    if (navigator.storage && navigator.storage.persist) { try { navigator.storage.persist(); } catch (e) {} }
  }

  boot();
  if ('serviceWorker' in navigator) { window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); }); }
})();
