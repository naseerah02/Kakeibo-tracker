/**
 * @OnlyCurrentDoc
 * Family Expense Tracker (Kakeibo) - Android edition, v2 - backend
 *
 * This script is the "server" for the Android app. Everything lives in this Google Sheet:
 *   Expenses     one row per expense
 *   Settings     summary email, currency, budget warning %, categories (+ Kakeibo type, fixed?), people + emails, payment modes, funds
 *   Plan         monthly household plan (income, fixed costs, savings goal, Zakat/Qurbani set-aside)
 *   Funds        Zakat and Qurbani ledger (set-aside, paid, balance)
 *   Recurring    expenses added automatically every month (rent, subscriptions...)
 *   Reflections  weekly / monthly Kakeibo reflections written in the app
 *   Devices      phones that signed in (revoke one by setting its Status to Revoked)
 *   Audit        log of device sign-ins, edits and deletes
 *   Dashboard    formulas and charts
 *
 * Sign-in: a person opens their link, the script emails a 6-digit code to the address in Settings (column I),
 * and the phone receives its own private token. There is no shared secret in the links any more.
 *
 * Setup: 1) run setup()  2) fill Settings (names, emails, summary email) and Plan
 *        3) Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone)
 *        4) host offline-app/, set PWA_URL below, run showLinks()  5) run installTriggers()
 */

// Address of the hosted Android app, e.g. 'https://yourname.github.io/expenses/'. Fill in after hosting.
const PWA_URL = '';

const EXPENSES = 'Expenses';
const SETTINGS = 'Settings';
const PLAN = 'Plan';
const FUNDS = 'Funds';
const DEVICES = 'Devices';
const RECURRING = 'Recurring';
const REFLECTIONS = 'Reflections';
const AUDIT = 'Audit';
const DASHBOARD = 'Dashboard';
const HEADERS = ['Date', 'Month', 'Time', 'Category', 'Amount', 'Payment Mode', 'Remarks', 'Device Name', 'Person', 'ID', 'Kakeibo Type'];
const ID_COL = 10;
const KAKEIBO_TYPES = ['Needs', 'Wants', 'Culture', 'Extra', 'Savings'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const OTP_TTL = 600;          // a code is valid for 10 minutes
const OTP_MAX_TRIES = 5;      // wrong guesses before the code is cancelled
const OTP_MAX_REQUESTS = 3;   // codes a person can request per 10 minutes
const LOCK_SECONDS = 60;      // the app asks for the PIN again after this long in the background
const RECENT_LIMIT = 40;      // entries shown in the app's History

// [category, Kakeibo type, fixed cost?]
const DEFAULT_CATEGORIES = [
  ['Groceries 🛒', 'Needs', 'No'],
  ['Food & Dining 🍔', 'Wants', 'No'],
  ['Transportation 🚗', 'Needs', 'No'],
  ['Entertainment 🎬', 'Culture', 'No'],
  ['Health & Medical 💊', 'Needs', 'No'],
  ['Shopping 🛍️', 'Wants', 'No'],
  ['Recharge & Subscriptions 📱', 'Needs', 'No'],
  ['Rent & Bills 🏠', 'Needs', 'Yes'],
  ['Travel ✈️', 'Wants', 'No'],
  ['Gifts 🎁', 'Wants', 'No'],
  ['Education 📚', 'Culture', 'No'],
  ['Insurance 🛡️', 'Needs', 'Yes'],
  ['Zakat 🤲', 'Savings', 'No'],
  ['Qurbani 🐐', 'Savings', 'No'],
  ['Investment 📈', 'Savings', 'No'],
  ['Other 📦', 'Extra', 'No']
];
const DEFAULT_PAYMENT_MODES = ['Cash', 'Debit Card', 'Credit Card', 'Bank Transfer', 'Raast', 'Easypaisa', 'JazzCash', 'Other'];

/** Run once: creates the tabs, headers, lists, plan table, and a random secret key. */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const ex = ss.getSheetByName(EXPENSES) || ss.insertSheet(EXPENSES);
  if (ex.getLastRow() === 0) {
    ex.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    ex.setFrozenRows(1);
    ex.getRange('A:A').setNumberFormat('dd/mm/yyyy');
    ex.getRange('C:C').setNumberFormat('hh:mm');
    ex.getRange('E:E').setNumberFormat('#,##0.00');
  }

  const st = ss.getSheetByName(SETTINGS) || ss.insertSheet(SETTINGS);
  if (st.getLastRow() === 0) {
    st.getRange('A1:B1').setValues([['Setting', 'Value']]).setFontWeight('bold');
    st.getRange('A2:B4').setValues([
      ['Summary email (comma-separated)', ''],
      ['Currency', 'PKR'],
      ['Budget warning at (% of allowance used)', 80]
    ]);
    st.getRange('D1:F1').setValues([['Categories', 'Kakeibo type', 'Fixed cost?']]).setFontWeight('bold');
    st.getRange('H1:I1').setValues([['People', 'Email']]).setFontWeight('bold');
    st.getRange('J1').setValue('Payment modes').setFontWeight('bold');
    st.getRange(2, 4, DEFAULT_CATEGORIES.length, 3).setValues(DEFAULT_CATEGORIES);
    st.getRange('H2:I4').setValues([['Person 1', ''], ['Person 2', ''], ['Person 3', '']]);
    st.getRange(2, 10, DEFAULT_PAYMENT_MODES.length, 1).setValues(DEFAULT_PAYMENT_MODES.map(c => [c]));
    st.autoResizeColumns(1, 10);
  }
  // Re-applied on every run so older sheets accept newly added types such as Savings.
  st.getRange('E2:E40').setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(KAKEIBO_TYPES, true).setAllowInvalid(false).build());
  st.getRange('F2:F40').setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['Yes', 'No'], true).setAllowInvalid(false).build());

  const pl = ss.getSheetByName(PLAN) || ss.insertSheet(PLAN);
  if (pl.getLastRow() === 0) {
    pl.getRange('A1').setValue('Household Plan (Kakeibo)').setFontSize(16).setFontWeight('bold');
    pl.getRange('A2').setValue('One row per month (type the 1st of the month). A month without a row uses the most recent row above it. Fill the yellow cells.');
    pl.getRange('A3:G3').setValues([['Month', 'Income', 'Fixed costs (planned)', 'Savings goal', 'Free to spend', 'Weekly allowance', 'Daily allowance']])
      .setFontWeight('bold').setBackground('#1e3a5f').setFontColor('#ffffff');
    const now = new Date();
    pl.getRange('A4').setValue(new Date(now.getFullYear(), now.getMonth(), 1));
    pl.getRange('A4:A39').setNumberFormat('mmm yyyy');
    pl.getRange('B4:D39').setBackground('#fff8dc').setNumberFormat('#,##0');
    const f = [];
    for (let r = 4; r <= 39; r++) {
      f.push([
        '=IF(OR($A' + r + '="",$B' + r + '=""),"",$B' + r + '-N($C' + r + ')-N($D' + r + '))',
        '=IF($E' + r + '="","",$E' + r + '/(DAY(EOMONTH($A' + r + ',0))/7))',
        '=IF($E' + r + '="","",$E' + r + '/DAY(EOMONTH($A' + r + ',0)))'
      ]);
    }
    pl.getRange(4, 5, f.length, 3).setFormulas(f).setNumberFormat('#,##0');
    pl.setFrozenRows(3);
    pl.setColumnWidth(1, 100);
    pl.setColumnWidths(2, 6, 150);
  }

  // Upgrade older sheets: the shared secret key is gone (each phone now gets its own token after an email code).
  if (String(st.getRange('A2').getValue()) === 'Secret key') st.getRange('A2:B2').setValues([['Summary email (comma-separated)', '']]);
  if (!String(st.getRange('I1').getValue())) st.getRange('I1').setValue('Email').setFontWeight('bold');

  if (!String(st.getRange('A4').getValue())) st.getRange('A4:B4').setValues([['Budget warning at (% of allowance used)', 80]]);

  // Earmarked funds: each fund is linked to one category (payments are logged in the form as that category)
  if (!String(st.getRange('L1').getValue())) {
    st.getRange('L1:M1').setValues([['Funds', 'Linked category']]).setFontWeight('bold');
    st.getRange('L2:M3').setValues([['Zakat', 'Zakat 🤲'], ['Qurbani', 'Qurbani 🐐']]);
  }

  // Plan: monthly set-aside for each fund (part of the Savings goal)
  if (!String(pl.getRange('H3').getValue())) {
    pl.getRange('H3:I3').setValues([['Zakat set-aside (part of savings)', 'Qurbani set-aside (part of savings)']])
      .setFontWeight('bold').setBackground('#1e3a5f').setFontColor('#ffffff');
    pl.getRange('H4:I39').setBackground('#fff8dc').setNumberFormat('#,##0');
    pl.setColumnWidths(8, 2, 210);
  }

  // Funds ledger
  const fu = ss.getSheetByName(FUNDS) || ss.insertSheet(FUNDS);
  if (fu.getLastRow() === 0) {
    fu.getRange('A1').setValue('Earmarked funds (Zakat & Qurbani)').setFontSize(16).setFontWeight('bold');
    fu.getRange('A2:C2').setValues([['Opening balance', 0, 0]]).setFontWeight('bold');
    fu.getRange('B2:C2').setBackground('#fff8dc').setNumberFormat('#,##0');
    fu.getRange('D2').setValue('Money you had already set aside before the first month on the Plan tab (yellow cells).');
    fu.getRange('A3:G3').setValues([['Month', 'Zakat set-aside', 'Qurbani set-aside', 'Zakat paid', 'Qurbani paid', 'Zakat balance', 'Qurbani balance']])
      .setFontWeight('bold').setBackground('#1e3a5f').setFontColor('#ffffff');
    const lk = col => '=N(IFERROR(ARRAYFORMULA(LOOKUP(2,1/((Plan!$A$4:$A$39<>"")*(Plan!$A$4:$A$39<=$A@)),Plan!$' + col + '$4:$' + col + '$39)),0))';
    const paid = cell => '=SUMIFS(Expenses!$E$2:$E,Expenses!$D$2:$D,' + cell + ',Expenses!$A$2:$A,">="&$A@,Expenses!$A$2:$A,"<"&EDATE($A@,1))';
    const rows = [];
    for (let r = 4; r <= 39; r++) {
      rows.push([
        r === 4 ? '=Plan!$A$4' : '=EDATE(A' + (r - 1) + ',1)',
        lk('H').replace(/@/g, r),
        lk('I').replace(/@/g, r),
        paid('Settings!$M$2').replace(/@/g, r),
        paid('Settings!$M$3').replace(/@/g, r),
        '=$B$2+SUM(B$4:B' + r + ')-SUM(D$4:D' + r + ')',
        '=$C$2+SUM(C$4:C' + r + ')-SUM(E$4:E' + r + ')'
      ]);
    }
    fu.getRange(4, 1, rows.length, 7).setFormulas(rows);
    fu.getRange('A4:A39').setNumberFormat('mmm yyyy');
    fu.getRange('B4:G39').setNumberFormat('#,##0');
    fu.setFrozenRows(3);
    fu.setColumnWidth(1, 120);
    fu.setColumnWidths(2, 6, 130);
  }

  ensureAuxSheets_(ss);
  buildDashboard();
  SpreadsheetApp.flush();
}

// ======================================================================
// Extra tabs
// ======================================================================

function ensureAuxSheets_(ss) {
  const st = ss.getSheetByName(SETTINGS);
  const header = function (sh, headers) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#1e3a5f').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  };

  const dv = ss.getSheetByName(DEVICES) || ss.insertSheet(DEVICES);
  if (dv.getLastRow() === 0) {
    header(dv, ['Device ID', 'Person', 'Label', 'Token hash', 'Created', 'Last used', 'Status']);
    dv.getRange('E2:F200').setNumberFormat('dd/mm/yyyy hh:mm');
    dv.getRange('G2:G200').setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(['Active', 'Revoked'], true).setAllowInvalid(false).build());
    dv.setColumnWidths(1, 7, 140);
  }

  const rc = ss.getSheetByName(RECURRING) || ss.insertSheet(RECURRING);
  if (rc.getLastRow() === 0) {
    header(rc, ['Name', 'Amount', 'Category', 'Payment mode', 'Remarks', 'Person', 'Day of month', 'Start month', 'End month (optional)', 'Active', 'Last added']);
    const now = new Date();
    // An example row, switched off. Edit it, set Active to Yes, and it is added automatically every month.
    rc.getRange('A2:K2').setValues([['Monthly rent', 40000, 'Rent & Bills 🏠', 'Bank Transfer', 'Monthly rent', 'Person 1', 1,
      new Date(now.getFullYear(), now.getMonth(), 1), '', 'No', '']]);
    rc.getRange('K2:K200').setNumberFormat('@');            // keep "2026-10" as text
    rc.getRange('H2:I200').setNumberFormat('mmm yyyy');
    rc.getRange('B2:B200').setNumberFormat('#,##0');
    rc.getRange('J2:J200').setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(['Yes', 'No'], true).setAllowInvalid(false).build());
    rc.getRange('C2:C200').setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInRange(st.getRange('D2:D40'), true).setAllowInvalid(false).build());
    rc.getRange('F2:F200').setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInRange(st.getRange('H2:H20'), true).setAllowInvalid(true).build());
    rc.setColumnWidths(1, 11, 130);
  }

  const rf = ss.getSheetByName(REFLECTIONS) || ss.insertSheet(REFLECTIONS);
  if (rf.getLastRow() === 0) {
    header(rf, ['Saved at', 'Person', 'Type', 'Period', 'What went well / what I saved', 'What I can reduce / unnecessary spend', 'What I will do next', 'Numbers', 'ID']);
    rf.getRange('A2:A500').setNumberFormat('dd/mm/yyyy hh:mm');
    rf.getRange('E2:H500').setWrap(true);
    rf.setColumnWidths(1, 4, 120);
    rf.setColumnWidths(5, 3, 260);
    rf.setColumnWidth(8, 220);
  }

  const au = ss.getSheetByName(AUDIT) || ss.insertSheet(AUDIT);
  if (au.getLastRow() === 0) {
    header(au, ['Time', 'Person', 'Action', 'Details']);
    au.getRange('A2:A2000').setNumberFormat('dd/mm/yyyy hh:mm');
    au.setColumnWidths(1, 3, 150);
    au.setColumnWidth(4, 480);
  }
}

// ======================================================================
// Web API used by the Android app
// ======================================================================

/** GET ?ping=1 is a health check. Everything else is a POST (see route_). */
function doGet() {
  return json_({ ok: true, message: 'Expense tracker is running' });
}

/** POST: JSON body (sent as text/plain). Field "action" picks what to do; "token" proves which phone it is. */
function doPost(e) {
  try {
    return json_(route_(parseBody_(e)));
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function route_(p) {
  const action = String(p.action || 'save');
  if (action === 'otp_request') return otpRequest_(p);     // no token yet
  if (action === 'otp_verify') return otpVerify_(p);

  const auth = authenticate_(p);
  if (!auth) return { ok: false, error: 'Not authorised' };
  switch (action) {
    case 'config': return configFor_(auth);
    case 'save': return saveExpense_(p, auth);
    case 'recent': return recentEntries_(auth);
    case 'update': return updateEntry_(p, auth);
    case 'delete': return deleteEntry_(p, auth);
    case 'summary': return summaryFor_(p);
    case 'reflect': return saveReflection_(p, auth);
    default: return { ok: false, error: 'Unknown action' };
  }
}

function configFor_(auth) {
  const cfg = getConfig_();
  return {
    ok: true,
    person: auth.person,
    currency: cfg.currency,
    categories: cfg.categories,
    types: cfg.types,
    fixed: cfg.fixed,
    kakeiboTypes: KAKEIBO_TYPES,
    payments: cfg.payments,
    lockSeconds: LOCK_SECONDS,
    warnAt: cfg.warnAt,
    funds: cfg.funds.slice(0, 2),
    budget: safeBudget_(today_())
  };
}

// ======================================================================
// Sign-in: email code (OTP) -> private device token
// ======================================================================

/** Emails a 6-digit code to the address on file for this person. The reply never reveals whether the person exists. */
function otpRequest_(p) {
  return withLock_(function () {
    const generic = { ok: true, message: 'If this person has an email on file, a code has been sent.' };
    const person = findPerson_(p.person);
    if (!person || !person.email) return generic;

    const cache = CacheService.getScriptCache();
    const k = personKey_(person.name);
    const requests = Number(cache.get('otpreq:' + k) || 0);
    if (requests >= OTP_MAX_REQUESTS) return { ok: false, error: 'Too many requests. Wait 10 minutes and try again.' };
    cache.put('otpreq:' + k, String(requests + 1), OTP_TTL);
    if (MailApp.getRemainingDailyQuota() < 1) return { ok: false, error: 'The daily email limit was reached. Try again tomorrow.' };

    const code = randomCode_();
    cache.put('otp:' + k, sha256hex_(code + ':' + k), OTP_TTL);
    cache.remove('otptry:' + k);
    MailApp.sendEmail({
      to: person.email,
      subject: 'Your Family Expense Tracker code',
      name: 'Family Expense Tracker',
      body: 'Your code is: ' + code + '\n\nIt is valid for 10 minutes. Enter it in the app on the phone you are setting up.\n' +
            'If you did not ask for this code, ignore this email.'
    });
    return generic;
  });
}

/** Checks the code. On success the phone receives a long random token; only its hash is stored in the sheet. */
function otpVerify_(p) {
  return withLock_(function () {
    const bad = { ok: false, error: 'That code is not correct or has expired.' };
    const person = findPerson_(p.person);
    if (!person) return bad;
    const cache = CacheService.getScriptCache();
    const k = personKey_(person.name);
    const stored = cache.get('otp:' + k);
    if (!stored) return bad;

    const tries = Number(cache.get('otptry:' + k) || 0);
    if (tries >= OTP_MAX_TRIES) { cache.remove('otp:' + k); return { ok: false, error: 'Too many wrong attempts. Ask for a new code.' }; }
    if (sha256hex_(String(p.code || '').trim() + ':' + k) !== stored) {
      cache.put('otptry:' + k, String(tries + 1), OTP_TTL);
      return bad;
    }
    cache.remove('otp:' + k);
    cache.remove('otptry:' + k);

    const deviceId = String(p.deviceId || '').trim().slice(0, 60) || Utilities.getUuid();
    const label = String(p.label || 'Android').trim().slice(0, 40);
    const token = newToken_();
    upsertDevice_(deviceId, person.name, label, sha256hex_(token));
    audit_(person.name, 'Device signed in', label + ' (' + deviceId.slice(0, 8) + ')');
    return { ok: true, token: token, person: person.name };
  });
}

/** Finds the active device that owns this token. Returns { person, deviceId } or null. */
function authenticate_(p) {
  const token = String(p.token || '');
  if (token.length < 32) return null;
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DEVICES);
  if (!sh || sh.getLastRow() < 2) return null;
  const hash = sha256hex_(token);
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues();
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][3] !== hash) continue;
    if (String(rows[i][6]).trim().toLowerCase() !== 'active') return null;
    const lu = rows[i][5];
    if (!(lu instanceof Date) || Date.now() - lu.getTime() > 3600000) sh.getRange(i + 2, 6).setValue(new Date());
    return { person: String(rows[i][1]), deviceId: String(rows[i][0]) };
  }
  return null;
}

function upsertDevice_(deviceId, person, label, hash) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DEVICES);
  const last = sh.getLastRow();
  if (last > 1) {
    const ids = sh.getRange(2, 1, last - 1, 1).getValues().flat();
    const idx = ids.indexOf(deviceId);
    if (idx >= 0) {
      sh.getRange(idx + 2, 2, 1, 6).setValues([[person, label, hash, sh.getRange(idx + 2, 5).getValue() || new Date(), new Date(), 'Active']]);
      return;
    }
  }
  sh.appendRow([deviceId, person, label, hash, new Date(), new Date(), 'Active']);
}

function findPerson_(name) {
  const want = norm_(name);
  if (!want) return null;
  return getConfig_().people.find(function (x) { return norm_(x.name) === want; }) || null;
}
function personKey_(name) { return norm_(name).replace(/ /g, '_'); }

function randomCode_() {
  const d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + ':' + Date.now(), Utilities.Charset.UTF_8);
  const n = (((d[0] & 0xff) << 16) | ((d[1] & 0xff) << 8) | (d[2] & 0xff)) % 1000000;
  return ('00000' + n).slice(-6);
}
function newToken_() { return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''); }
function sha256hex_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b < 0 ? b + 256 : b).toString(16)).slice(-2); }).join('');
}

function audit_(person, action, details) {
  try {
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(AUDIT)
      .appendRow([new Date(), person, action, String(details || '').slice(0, 500)]);
  } catch (err) { /* the log must never break the real work */ }
}

// ======================================================================
// Expenses: save, list, edit, delete
// ======================================================================

/** Saves one expense for the signed-in person. The same id is never saved twice, so the app can safely retry. */
function saveExpense_(p, auth) {
  const cfg = getConfig_();
  const v = validateEntry_(p, cfg);
  if (v.error) return { ok: false, error: v.error };
  const f = v.fields;
  f.person = auth.person;
  f.device = String(p.device || 'Android').trim().slice(0, 40);
  f.id = String(p.id || '').trim().slice(0, 60);
  return withLock_(function () { return addExpense_(f, cfg); });
}

/** Checks amount, date, time, category, payment and type. Returns { fields } or { error }. */
function validateEntry_(p, cfg) {
  const amount = parseFloat(String(p.amount).replace(/,/g, ''));
  if (!isFinite(amount) || amount <= 0) return { error: 'Invalid amount' };
  const dateStr = cleanDate_(p.date || today_());
  if (!dateStr) return { error: 'Invalid date' };
  const time = parseTime_(p.time || nowTime_());
  if (time === null) return { error: 'Invalid time' };
  const category = matchOption_(p.category, cfg.categories, 'Other');
  const payment = matchOption_(p.payment, cfg.payments, 'Other');
  const wanted = String(p.type || '').trim().toLowerCase();
  const type = KAKEIBO_TYPES.find(function (t) { return t.toLowerCase() === wanted; }) || cfg.types[category] || 'Extra';
  const remarks = String(p.remarks || '').trim().slice(0, 200);
  return { fields: { amount: amount, dateStr: dateStr, time: time, category: category, payment: payment, type: type, remarks: remarks } };
}

/** Appends the row. Call inside withLock_. */
function addExpense_(f, cfg) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EXPENSES);
  const flags = { fixed: cfg.fixed.indexOf(f.category) !== -1, saving: f.type === 'Savings' };

  if (f.id) {   // duplicate guard: an id already in the last 100 rows is ignored
    const last = sheet.getLastRow();
    if (last > 1) {
      const start = Math.max(2, last - 99);
      const ids = sheet.getRange(start, ID_COL, last - start + 1, 1).getValues().flat();
      if (ids.indexOf(f.id) !== -1) {
        return { ok: true, duplicate: true, message: 'Already saved', fixed: flags.fixed, saving: flags.saving,
                 fund: getFundInfo_(f.category, f.dateStr), budget: safeBudget_(f.dateStr) };
      }
    }
  }
  const tz = tz_();
  const date = Utilities.parseDate(f.dateStr, tz, 'yyyy-MM-dd');
  const month = Utilities.formatDate(date, tz, 'MMMM');
  sheet.appendRow([date, month, f.time, f.category, f.amount, f.payment, f.remarks, f.device, f.person, f.id, f.type]);
  SpreadsheetApp.flush();
  return { ok: true, message: 'Saved ' + f.amount + ' in ' + f.category, type: f.type, fixed: flags.fixed, saving: flags.saving,
           fund: getFundInfo_(f.category, f.dateStr), budget: safeBudget_(f.dateStr) };
}

/** The signed-in person's latest entries (newest first), for the app's History screen. */
function recentEntries_(auth) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EXPENSES);
  const last = sh.getLastRow();
  if (last < 2) return { ok: true, entries: [] };
  const rows = sh.getRange(2, 1, last - 1, 11).getValues();
  const out = [];
  for (let i = rows.length - 1; i >= 0 && out.length < RECENT_LIMIT; i--) {
    const r = rows[i];
    if (!r[9] || !(r[0] instanceof Date)) continue;                 // entries without an id cannot be edited
    if (norm_(r[8]) !== norm_(auth.person)) continue;               // you only see and change your own entries
    out.push({ id: String(r[9]), date: dayStr_(r[0]), time: timeStr_(r[2]), category: String(r[3]), amount: Number(r[4]),
               payment: String(r[5]), remarks: String(r[6] || ''), type: String(r[10] || ''), device: String(r[7] || '') });
  }
  out.sort(function (a, b) { return (b.date + b.time).localeCompare(a.date + a.time); });
  return { ok: true, entries: out };
}

function updateEntry_(p, auth) {
  const cfg = getConfig_();
  const v = validateEntry_(p, cfg);
  if (v.error) return { ok: false, error: v.error };
  const f = v.fields;
  return withLock_(function () {
    const found = findOwnRow_(p.id, auth);
    if (found.error) return { ok: false, error: found.error };
    const sh = found.sheet, row = found.row, old = found.values;
    const tz = tz_();
    const date = Utilities.parseDate(f.dateStr, tz, 'yyyy-MM-dd');
    sh.getRange(row, 1, 1, 7).setValues([[date, Utilities.formatDate(date, tz, 'MMMM'), f.time, f.category, f.amount, f.payment, f.remarks]]);
    sh.getRange(row, 11).setValue(f.type);
    SpreadsheetApp.flush();
    audit_(auth.person, 'Entry updated', describeRow_(old) + '  ->  ' + f.dateStr + ' ' + f.category + ' ' + f.amount + ' ' + f.type);
    return { ok: true, fixed: cfg.fixed.indexOf(f.category) !== -1, saving: f.type === 'Savings',
             fund: getFundInfo_(f.category, f.dateStr), budget: safeBudget_(f.dateStr) };
  });
}

function deleteEntry_(p, auth) {
  return withLock_(function () {
    const found = findOwnRow_(p.id, auth);
    if (found.error) return { ok: false, error: found.error };
    const dateStr = dayStr_(found.values[0]);
    audit_(auth.person, 'Entry deleted', describeRow_(found.values));
    found.sheet.deleteRow(found.row);
    SpreadsheetApp.flush();
    return { ok: true, budget: safeBudget_(dateStr) };
  });
}

/** Locates an entry by id and checks that it belongs to this person. */
function findOwnRow_(id, auth) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EXPENSES);
  const last = sh.getLastRow();
  id = String(id || '').trim();
  if (!id || last < 2) return { error: 'Entry not found' };
  const ids = sh.getRange(2, ID_COL, last - 1, 1).getValues().flat();
  const idx = ids.lastIndexOf(id);
  if (idx < 0) return { error: 'Entry not found' };
  const row = idx + 2;
  const values = sh.getRange(row, 1, 1, 11).getValues()[0];
  if (norm_(values[8]) !== norm_(auth.person)) return { error: 'Not your entry' };
  return { sheet: sh, row: row, values: values };
}

function describeRow_(v) {
  return (v[0] instanceof Date ? dayStr_(v[0]) : v[0]) + ' ' + v[3] + ' ' + v[4] + ' ' + v[5] + (v[6] ? ' "' + v[6] + '"' : '');
}

// ======================================================================
// Budget and funds
// ======================================================================

/** Plan row in force on dateStr: { income, fixed, savings, free } or null when no income is planned. */
function planFor_(dateStr) {
  const plan = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PLAN);
  if (!plan) return null;
  let row = null, rowDay = '';
  plan.getRange('A4:D39').getValues().forEach(function (r) {
    if (!(r[0] instanceof Date)) return;
    const d = dayStr_(r[0]);
    if (d <= dateStr && d > rowDay) { row = r; rowDay = d; }
  });
  const income = row ? Number(row[1]) || 0 : 0;
  if (income <= 0) return null;
  const fixed = Number(row[2]) || 0, savings = Number(row[3]) || 0;
  return { income: income, fixed: fixed, savings: savings, free: income - fixed - savings };
}

/**
 * Household budget status for the month and week containing dateStr ("YYYY-MM-DD").
 * Only flexible spending counts: fixed-cost categories and Savings-type entries are excluded.
 */
function getBudget_(dateStr) {
  const plan = planFor_(dateStr);
  if (!plan) return { hasPlan: false };
  const cfg = getConfig_();
  const y = +dateStr.slice(0, 4), m = +dateStr.slice(5, 7), day = +dateStr.slice(8, 10);
  const ym = dateStr.slice(0, 7);
  const daysInMonth = new Date(y, m, 0).getDate();
  const weekIndex = Math.floor((day - 1) / 7);
  const wStart = weekIndex * 7 + 1;
  const wEnd = Math.min(wStart + 6, daysInMonth);

  let monthSpent = 0, weekSpent = 0;
  readExpenses_().forEach(function (r) {
    if (r.ds.slice(0, 7) !== ym || r.type === 'Savings' || cfg.fixed.indexOf(r.cat) !== -1) return;
    monthSpent += r.amt;
    const dd = +r.ds.slice(8, 10);
    if (dd >= wStart && dd <= wEnd) weekSpent += r.amt;
  });
  const weekAllowance = plan.free / daysInMonth * (wEnd - wStart + 1);
  return { hasPlan: true, ym: ym, week: weekIndex + 1, weekAllowance: Math.round(weekAllowance), weekLeft: Math.round(weekAllowance - weekSpent),
           monthLeft: Math.round(plan.free - monthSpent), free: Math.round(plan.free) };
}

function safeBudget_(dateStr) {
  try { return getBudget_(dateStr); } catch (err) { return { hasPlan: false }; }
}

/** All expenses as light objects: { ds: 'YYYY-MM-DD', cat, amt, type, person }. */
function readExpenses_() {
  const ex = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EXPENSES);
  const last = ex.getLastRow();
  if (last < 2) return [];
  return ex.getRange(2, 1, last - 1, 11).getValues()
    .filter(function (r) { return r[0] instanceof Date; })
    .map(function (r) { return { ds: dayStr_(r[0]), cat: String(r[3]), amt: Number(r[4]) || 0, type: String(r[10] || ''), person: String(r[8] || '') }; });
}

/** The Funds ledger row (month) at or before dateStr, or null. */
function fundRow_(dateStr) {
  const fu = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FUNDS);
  if (!fu) return null;
  let hit = null, hitDay = '';
  fu.getRange('A4:G39').getValues().forEach(function (r) {
    if (!(r[0] instanceof Date)) return;
    const d = dayStr_(r[0]);
    if (d <= dateStr && d > hitDay) { hit = r; hitDay = d; }
  });
  return hit;
}

/** If `category` is linked to a fund (Settings L:M), returns { name, balance } as of the month of dateStr. */
function getFundInfo_(category, dateStr) {
  try {
    const cfg = getConfig_();
    const idx = cfg.funds.findIndex(function (f) { return norm_(f.category) === norm_(category); });
    if (idx < 0 || idx > 1) return null;
    const hit = fundRow_(dateStr);
    if (!hit) return null;
    return { name: cfg.funds[idx].name, balance: Math.round(Number(hit[5 + idx]) || 0) };
  } catch (err) {
    return null;
  }
}

function fundBalances_(dateStr) {
  try {
    const cfg = getConfig_();
    const hit = fundRow_(dateStr);
    return cfg.funds.slice(0, 2).map(function (f, i) { return { name: f.name, balance: hit ? Math.round(Number(hit[5 + i]) || 0) : 0 }; });
  } catch (err) { return []; }
}

// ======================================================================
// Summaries, reflections and email
// ======================================================================

/** Numbers for one week block (days 1-7, 8-14...) or one month, containing dateStr. */
function computeStats_(rows, period, dateStr, cfg, detail) {
  const y = +dateStr.slice(0, 4), m = +dateStr.slice(5, 7), day = +dateStr.slice(8, 10);
  const dim = new Date(y, m, 0).getDate();
  const ym = dateStr.slice(0, 7);
  let a = 1, b = dim, label;
  if (period === 'week') {
    const wi = Math.floor((day - 1) / 7);
    a = wi * 7 + 1; b = Math.min(a + 6, dim);
    label = 'Week ' + (wi + 1) + ' (' + MONTH_NAMES[m - 1].slice(0, 3) + ' ' + a + '-' + b + ')';
  } else {
    label = MONTH_NAMES[m - 1] + ' ' + y;
  }
  const byType = { Needs: 0, Wants: 0, Culture: 0, Extra: 0 };
  const cats = {}, dailyFlex = {}, weekFlex = [0, 0, 0, 0, 0];
  let flex = 0, fixedPaid = 0, savingsPaid = 0, count = 0;
  rows.forEach(function (r) {
    if (r.ds.slice(0, 7) !== ym) return;
    const d = +r.ds.slice(8, 10);
    if (d < a || d > b) return;
    if (r.type === 'Savings') { savingsPaid += r.amt; return; }
    if (cfg.fixed.indexOf(r.cat) !== -1) { fixedPaid += r.amt; return; }
    flex += r.amt; count++;
    byType[byType.hasOwnProperty(r.type) ? r.type : 'Extra'] += r.amt;
    cats[r.cat] = (cats[r.cat] || 0) + r.amt;
    dailyFlex[d] = (dailyFlex[d] || 0) + r.amt;
    weekFlex[Math.floor((d - 1) / 7)] += r.amt;
  });
  const plan = planFor_(dateStr);
  const allowance = plan ? (period === 'week' ? plan.free / dim * (b - a + 1) : plan.free) : null;
  const top = Object.keys(cats).map(function (c) { return { category: c, amount: Math.round(cats[c]) }; })
    .sort(function (x, y2) { return y2.amount - x.amount; }).slice(0, 3);
  const out = {
    period: period, label: label, from: ym + '-' + ('0' + a).slice(-2), to: ym + '-' + ('0' + b).slice(-2),
    spent: Math.round(flex), fixedPaid: Math.round(fixedPaid), savingsPaid: Math.round(savingsPaid), count: count,
    byType: { Needs: Math.round(byType.Needs), Wants: Math.round(byType.Wants), Culture: Math.round(byType.Culture), Extra: Math.round(byType.Extra) },
    top: top, hasPlan: !!plan, allowance: allowance === null ? null : Math.round(allowance),
    remaining: allowance === null ? null : Math.round(allowance - flex),
    income: plan ? plan.income : null, goal: plan ? plan.savings : null,
    leftAfterSpending: plan ? Math.round(plan.income - flex - fixedPaid) : null
  };
  if (detail) {   // extra figures for the app's Month tab
    out.byCategory = Object.keys(cats).map(function (c) { return { category: c, amount: Math.round(cats[c]) }; })
      .sort(function (x, y2) { return y2.amount - x.amount; }).slice(0, 12);
    out.daily = [];
    for (let d = a; d <= b; d++) out.daily.push({ d: d, spent: Math.round(dailyFlex[d] || 0) });
    if (period === 'month') {
      out.weeks = [];
      for (let w = 0; w * 7 < dim; w++) {
        const ws = w * 7 + 1, we = Math.min(ws + 6, dim);
        out.weeks.push({ label: ws + '-' + we, spent: Math.round(weekFlex[w]), allowance: plan ? Math.round(plan.free / dim * (we - ws + 1)) : null });
      }
    }
  }
  return out;
}

function shiftDate_(dateStr, days) {
  const t = Date.UTC(+dateStr.slice(0, 4), +dateStr.slice(5, 7) - 1, +dateStr.slice(8, 10) + days);
  const d = new Date(t);
  return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
}

/** The period before the one containing dateStr: the previous week block, or the previous month. */
function previousDate_(period, dateStr) {
  return period === 'week' ? shiftDate_(dateStr, -7) : shiftDate_(dateStr.slice(0, 7) + '-01', -1);
}

function summaryFor_(p) {
  const period = p.period === 'week' ? 'week' : 'month';
  const dateStr = cleanDate_(p.date || today_());
  if (!dateStr) return { ok: false, error: 'Invalid date' };
  const cfg = getConfig_();
  const rows = readExpenses_();
  const stats = computeStats_(rows, period, dateStr, cfg, !!p.detail);
  const prev = computeStats_(rows, period, previousDate_(period, dateStr), cfg);
  const res = { ok: true, stats: stats, prev: { label: prev.label, spent: prev.spent } };
  if (p.detail) res.funds = fundBalances_(dateStr);   // fund balances for the app's Month tab
  return res;
}

function saveReflection_(p, auth) {
  const kind = p.kind === 'Weekly' ? 'Weekly' : 'Monthly';
  const dateStr = cleanDate_(p.date || today_());
  if (!dateStr) return { ok: false, error: 'Invalid date' };
  const clip = function (s) { return String(s || '').trim().slice(0, 1500); };
  const q1 = clip(p.q1), q2 = clip(p.q2), q3 = clip(p.q3);
  if (!q1 && !q2 && !q3) return { ok: false, error: 'Invalid reflection' };
  const id = String(p.id || '').trim().slice(0, 60);
  return withLock_(function () {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(REFLECTIONS);
    const last = sh.getLastRow();
    if (id && last > 1) {
      const start = Math.max(2, last - 99);
      if (sh.getRange(start, 9, last - start + 1, 1).getValues().flat().indexOf(id) !== -1) return { ok: true, duplicate: true };
    }
    const stats = computeStats_(readExpenses_(), kind === 'Weekly' ? 'week' : 'month', dateStr, getConfig_());
    const numbers = 'Spent ' + stats.spent + (stats.allowance !== null ? ' of ' + stats.allowance : '') +
      '; Needs ' + stats.byType.Needs + ', Wants ' + stats.byType.Wants + ', Culture ' + stats.byType.Culture + ', Extra ' + stats.byType.Extra +
      (stats.leftAfterSpending !== null && kind === 'Monthly' ? '; left after spending ' + stats.leftAfterSpending + ' (goal ' + stats.goal + ')' : '');
    sh.appendRow([new Date(), auth.person, kind, stats.label, q1, q2, q3, numbers, id]);
    return { ok: true };
  });
}

function getSummaryEmails_() { return getConfig_().summaryEmails; }

function money_(n) {
  return getConfig_().currency + ' ' + String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** The HTML for the weekly and monthly emails. */
function summaryHtml_(title, s, prev, funds, monthStats) {
  const row = function (a, b) { return '<tr><td style="padding:3px 12px 3px 0">' + a + '</td><td style="padding:3px 0;text-align:right"><b>' + b + '</b></td></tr>'; };
  let h = '<div style="font-family:Arial,sans-serif;max-width:480px;color:#0f172a">';
  h += '<h2 style="margin:0 0 4px">' + title + '</h2><div style="color:#64748b;margin-bottom:12px">' + s.label + '</div>';
  if (s.allowance !== null) {
    const over = s.remaining < 0;
    h += '<p style="font-size:16px">Spent <b>' + money_(s.spent) + '</b> of ' + money_(s.allowance) + ' &mdash; ' +
      (over ? '<b style="color:#b91c1c">over by ' + money_(s.remaining) + '</b>' : '<b style="color:#15803d">' + money_(s.remaining) + ' left</b>') + '</p>';
  } else {
    h += '<p style="font-size:16px">Spent <b>' + money_(s.spent) + '</b> <span style="color:#64748b">(add this month\'s income on the Plan tab to see your allowance)</span></p>';
  }
  if (prev && prev.spent > 0) {
    const diff = Math.round((s.spent - prev.spent) / prev.spent * 100);
    h += '<p style="color:#64748b;margin-top:0">Before: ' + money_(prev.spent) + ' (' + (diff === 0 ? 'no change' : (diff > 0 ? 'up ' : 'down ') + Math.abs(diff) + '%') + ')</p>';
  }
  h += '<table style="border-collapse:collapse;width:100%">' +
    row('Needs', money_(s.byType.Needs)) + row('Wants', money_(s.byType.Wants)) + row('Culture', money_(s.byType.Culture)) + row('Extra', money_(s.byType.Extra)) +
    (s.fixedPaid ? row('Fixed costs paid', money_(s.fixedPaid)) : '') + '</table>';
  if (s.top.length) h += '<p style="margin-bottom:4px"><b>Top categories</b></p>' + s.top.map(function (t) { return t.category + ': ' + money_(t.amount); }).join('<br>');
  if (s.period === 'month' && s.leftAfterSpending !== null) {
    h += '<p><b>Left after spending:</b> ' + (s.leftAfterSpending < 0 ? '-' : '') + money_(s.leftAfterSpending) + ' (savings goal ' + money_(s.goal) + ')</p>';
  } else if (monthStats && monthStats.allowance !== null) {
    h += '<p style="color:#64748b">This month so far: ' + money_(monthStats.spent) + ' of ' + money_(monthStats.allowance) + '</p>';
  }
  if (funds && funds.length) h += '<p><b>Funds:</b> ' + funds.map(function (f) { return f.name + ' ' + (f.balance < 0 ? '-' : '') + money_(f.balance); }).join(' &middot; ') + '</p>';
  const link = PWA_URL ? PWA_URL.replace(/\/?$/, '/') + '#reflect' : '';
  h += '<p style="margin-top:18px">Take two minutes to reflect: what went well, and what will you do differently?' +
    (link ? ' <a href="' + link + '">Open the app</a>' : '') + '</p></div>';
  return h;
}

function sendEmail_(subject, html) {
  const to = getSummaryEmails_().join(',');
  if (!to) { Logger.log('No summary email set in Settings!B2, nothing sent.'); return; }
  MailApp.sendEmail({ to: to, subject: subject, htmlBody: html, name: 'Family Expense Tracker' });
}

/** Scheduled (see installTriggers): the budget week and the month so far. */
function sendWeeklySummary() {
  const cfg = getConfig_(), today = today_(), rows = readExpenses_();
  const wk = computeStats_(rows, 'week', today, cfg);
  const prev = computeStats_(rows, 'week', previousDate_('week', today), cfg);
  const mo = computeStats_(rows, 'month', today, cfg);
  sendEmail_('Weekly money summary: ' + wk.label, summaryHtml_('Your weekly summary', wk, prev, fundBalances_(today), mo));
}

/** Scheduled on the 1st of the month: the month that just ended. */
function sendMonthlySummary() {
  const cfg = getConfig_(), rows = readExpenses_();
  const last = previousDate_('month', today_());
  const mo = computeStats_(rows, 'month', last, cfg);
  const prev = computeStats_(rows, 'month', previousDate_('month', last), cfg);
  sendEmail_('Monthly money summary: ' + mo.label, summaryHtml_('Your monthly summary', mo, prev, fundBalances_(last), null));
}

// ======================================================================
// Recurring expenses
// ======================================================================

/**
 * Scheduled daily (see installTriggers). For every active row on the Recurring tab, adds this month's expense
 * once its day of the month has arrived. Missed days are caught up, and an expense is never added twice.
 */
function runRecurring() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(RECURRING);
  if (!sh || sh.getLastRow() < 2) return;
  const cfg = getConfig_(), today = today_(), ym = today.slice(0, 7);
  const dim = new Date(+today.slice(0, 4), +today.slice(5, 7), 0).getDate();
  const people = cfg.people;
  const asYm = function (v) { return v instanceof Date ? dayStr_(v).slice(0, 7) : String(v || '').slice(0, 7); };

  sh.getRange(2, 1, sh.getLastRow() - 1, 11).getValues().forEach(function (r, i) {
    const name = String(r[0]).trim();
    if (!name || String(r[9]).trim().toLowerCase() !== 'yes') return;
    const amount = Number(r[1]);
    if (!(amount > 0)) return;
    if (r[7] instanceof Date && asYm(r[7]) > ym) return;               // not started yet
    if (r[8] instanceof Date && asYm(r[8]) < ym) return;               // already ended
    if (asYm(r[10]) === ym) return;                                    // already added this month
    const dueDay = Math.min(Math.max(parseInt(r[6], 10) || 1, 1), dim);
    if (+today.slice(8, 10) < dueDay) return;                          // not due yet

    const dueStr = ym + '-' + ('0' + dueDay).slice(-2);
    const v = validateEntry_({ amount: amount, category: r[2], payment: r[3], remarks: r[4] || name, date: dueStr, time: '08:00' }, cfg);
    if (v.error) { Logger.log('Recurring "' + name + '" skipped: ' + v.error); return; }
    const person = String(r[5] || '').trim() || (people[0] ? people[0].name : 'Unknown');
    const f = v.fields;
    f.person = person; f.device = 'Recurring'; f.id = 'rec-' + personKey_(name) + '-' + ym;
    const res = withLock_(function () { return addExpense_(f, cfg); });
    if (res.ok) sh.getRange(i + 2, 11).setValue(ym);
    else Logger.log('Recurring "' + name + '" failed: ' + res.error);
  });
}

/** Run once. Creates the daily recurring check, the weekly email (Sunday evening) and the monthly email (1st). */
function installTriggers() {
  const mine = ['runRecurring', 'sendWeeklySummary', 'sendMonthlySummary'];
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (mine.indexOf(t.getHandlerFunction()) !== -1) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('runRecurring').timeBased().everyDays(1).atHour(6).create();
  ScriptApp.newTrigger('sendWeeklySummary').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(20).create();
  ScriptApp.newTrigger('sendMonthlySummary').timeBased().onMonthDay(1).atHour(8).create();
  Logger.log('Triggers installed: recurring daily ~6am, weekly summary Sunday ~8pm, monthly summary on the 1st ~8am (script time zone).');
}

// ======================================================================
// Settings and small helpers
// ======================================================================

function getConfig_() {
  const st = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTINGS);
  const catRows = st.getRange('D2:F40').getValues().filter(function (r) { return String(r[0]).trim(); });
  const types = {};
  catRows.forEach(function (r) {
    const t = KAKEIBO_TYPES.find(function (x) { return x.toLowerCase() === String(r[1]).trim().toLowerCase(); });
    types[String(r[0])] = t || 'Extra';
  });
  return {
    currency: String(st.getRange('B3').getValue() || ''),
    warnAt: (function (v) { return v >= 50 && v <= 99 ? Math.round(v) : 80; })(Number(st.getRange('B4').getValue())),
    summaryEmails: String(st.getRange('B2').getValue() || '').split(/[,;\s]+/).filter(function (x) { return x.indexOf('@') > 0; }),
    categories: catRows.map(function (r) { return String(r[0]); }),
    types: types,
    fixed: catRows.filter(function (r) { return String(r[2]).trim().toLowerCase() === 'yes'; }).map(function (r) { return String(r[0]); }),
    payments: st.getRange('J2:J40').getValues().flat().filter(String),
    people: st.getRange('H2:I20').getValues()
      .filter(function (r) { return String(r[0]).trim(); })
      .map(function (r) { return { name: String(r[0]).trim(), email: String(r[1] || '').trim() }; }),
    funds: st.getRange('L2:M10').getValues()
      .filter(function (r) { return String(r[0]).trim() && String(r[1]).trim(); })
      .map(function (r) { return { name: String(r[0]), category: String(r[1]) }; })
  };
}

function parseBody_(e) {
  if (e && e.postData && e.postData.contents) {
    try {
      const body = JSON.parse(e.postData.contents);
      if (body && typeof body === 'object') return body;
    } catch (x) { /* fall through */ }
  }
  return (e && e.parameter) || {};
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    return fn();
  } catch (err) {
    return { ok: false, error: String(err) };
  } finally {
    try { lock.releaseLock(); } catch (x) { /* not held */ }
  }
}

/** Time zone of the spreadsheet. All dates are read and written in this zone so days never shift. */
function tz_() { return SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(); }
function dayStr_(d) { return Utilities.formatDate(d, tz_(), 'yyyy-MM-dd'); }
function today_() { return dayStr_(new Date()); }
function nowTime_() { return Utilities.formatDate(new Date(), tz_(), 'HH:mm'); }

/** A time cell comes back as a Date (or a fraction of a day); returns "HH:mm". */
function timeStr_(t) {
  if (t instanceof Date) return Utilities.formatDate(t, tz_(), 'HH:mm');
  const mins = Math.round((Number(t) || 0) * 1440);
  return ('0' + (Math.floor(mins / 60) % 24)).slice(-2) + ':' + ('0' + (mins % 60)).slice(-2);
}

/** Accepts "YYYY-MM-DD" or "DD/MM/YYYY"; returns "YYYY-MM-DD" or null if it is not a real date. */
function cleanDate_(s) {
  s = String(s || '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/), y, mo, d;
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/))) { d = +m[1]; mo = +m[2]; y = +m[3]; }
  else return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return y + '-' + ('0' + mo).slice(-2) + '-' + ('0' + d).slice(-2);
}

function parseTime_(s) {
  const m = String(s || '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  return (h < 24 && mi < 60) ? (h * 60 + mi) / 1440 : null;
}

/** Compares ignoring case, emoji and punctuation, so "Food & Dining" matches "Food & Dining 🍔". */
function norm_(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function matchOption_(input, list, fallback) {
  const want = norm_(input);
  if (want) {
    const hit = list.find(function (x) { return norm_(x) === want; });
    if (hit) return hit;
  }
  return list.find(function (x) { return norm_(x) === norm_(fallback); }) || fallback;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ======================================================================
// Helpers you run from the editor
// ======================================================================

/** Adds one test expense so you can check the sheet and dashboard. Delete the row afterwards. */
function testInsert() {
  const res = saveExpense_({ amount: '1250', category: 'Food & Dining', payment: 'Cash', remarks: 'test lunch', device: 'Editor', id: 'test-' + Date.now() },
                           { person: 'Test' });
  Logger.log(JSON.stringify(res));
}

/** Sends a test email to the summary address (also makes Google ask for the permission to send email). */
function sendTestEmail() {
  const to = getSummaryEmails_().join(',') || Session.getEffectiveUser().getEmail();
  MailApp.sendEmail({ to: to, subject: 'Family Expense Tracker: test email', body: 'Emails from your tracker work.' });
  Logger.log('Test email sent to ' + to);
}

/** Logs each person's link (no secret inside) and warns about people with no email. Run after deploying. */
function showLinks() {
  const base = ScriptApp.getService().getUrl();
  Logger.log('Web app URL (must end in /exec): ' + base);
  if (!PWA_URL) {
    Logger.log('PWA_URL is empty. Host the offline-app folder, paste its address into PWA_URL at the top of Code.gs, deploy a new version, then run showLinks() again.');
    return;
  }
  const app = PWA_URL.replace(/\/?$/, '/');
  getConfig_().people.forEach(function (x) {
    Logger.log(x.name + (x.email ? '' : '   <-- NO EMAIL in Settings column I: this person cannot sign in yet') +
      '\n' + app + '?api=' + encodeURIComponent(base) + '&person=' + encodeURIComponent(x.name));
  });
}

/**
 * Builds (or rebuilds) the Dashboard tab with formulas and charts.
 * Safe to re-run any time, e.g. after changing the currency in Settings.
 * Change the month by typing the first day of any month into Dashboard!B3.
 */
function buildDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(DASHBOARD) || ss.insertSheet(DASHBOARD);
  sh.clear();
  sh.clearConditionalFormatRules();
  sh.getCharts().forEach(c => sh.removeChart(c));

  const cur = String(ss.getSheetByName(SETTINGS).getRange('B3').getValue() || '');
  const money = '"' + cur + '" #,##0';
  const T = 'Expenses!$A$2:$A', C = 'Expenses!$D$2:$D', A = 'Expenses!$E$2:$E',
        PM = 'Expenses!$F$2:$F', P = 'Expenses!$I$2:$I', K = 'Expenses!$K$2:$K';
  const FIX = 'FILTER(Settings!$D$2:$D$40,Settings!$F$2:$F$40="Yes")';
  const dateM = T + ',">="&$B$3,' + T + ',"<"&EDATE($B$3,1)';
  const notSav = ',' + K + ',"<>Savings"';   // spending only: Savings-type entries are not spending
  const inMonth = dateM + notSav;
  const fixedSum = 'IFERROR(SUMPRODUCT(SUMIFS(' + A + ',' + inMonth + ',' + C + ',' + FIX + ')),0)';
  const plan = col => '=N(IFERROR(ARRAYFORMULA(LOOKUP(2,1/((Plan!$A$4:$A$39<>"")*(Plan!$A$4:$A$39<=$B$3)),Plan!$' + col + '$4:$' + col + '$39)),0))';

  // Title and summary
  sh.getRange('A1').setValue('Family Expense Dashboard').setFontSize(18).setFontWeight('bold');
  sh.getRange('A3:A9').setValues([['Month (type 1st of any month)'], ['Total spent'], ['Transactions'], ['Daily average'], ['Top category'], ['Fixed costs paid'], ['Invested / saved']]).setFontWeight('bold');
  sh.getRange('B3').setFormula('=DATE(YEAR(TODAY()),MONTH(TODAY()),1)').setNumberFormat('mmm yyyy');
  sh.getRange('B4').setFormula('=SUMIFS(' + A + ',' + inMonth + ')').setNumberFormat(money);
  sh.getRange('B5').setFormula('=COUNTIFS(' + inMonth + ')');
  sh.getRange('B6').setFormula('=IFERROR(B4/IF(EOMONTH($B$3,0)>=TODAY(),IF($B$3>TODAY(),1,DAY(TODAY())),DAY(EOMONTH($B$3,0))),0)').setNumberFormat(money);
  sh.getRange('B7').setFormula('=IF(B4=0,"-",INDEX(A11:A30,MATCH(MAX(B11:B30),B11:B30,0)))');
  sh.getRange('B8').setFormula('=' + fixedSum).setNumberFormat(money);
  sh.getRange('B9').setFormula('=SUMIFS(' + A + ',' + K + ',"Savings",' + C + ',"<>"&Settings!$M$2,' + C + ',"<>"&Settings!$M$3,' + dateM + ')').setNumberFormat(money);
  sh.getRange('B3:B9').setHorizontalAlignment('right').setBackground('#f1f5f9');

  // Household budget (from the Plan tab)
  sh.getRange('G2').setValue('Household budget').setFontWeight('bold').setFontSize(12);
  sh.getRange('G3:G9').setValues([['Income'], ['Fixed costs (planned)'], ['Savings goal'], ['Free to spend'], ['Flexible spent'], ['Remaining'], ['Saved so far (income - spent)']]).setFontWeight('bold');
  sh.getRange('H3').setFormula(plan('B'));
  sh.getRange('H4').setFormula(plan('C'));
  sh.getRange('H5').setFormula(plan('D'));
  sh.getRange('H6').setFormula('=H3-H4-H5');
  sh.getRange('H7').setFormula('=B4-B8');
  sh.getRange('H8').setFormula('=H6-H7');
  sh.getRange('H9').setFormula('=IF(H3=0,"-",H3-B4)');
  sh.getRange('H3:H9').setNumberFormat(money).setHorizontalAlignment('right').setBackground('#f1f5f9');
  sh.getRange('H8').setFontWeight('bold');

  // By category (rows 11-30)
  sh.getRange('A10:E10').setValues([['Category', 'Spent', 'Share', 'Type', 'Fixed?']]);
  const cat = [];
  for (let r = 11; r <= 30; r++) {
    const k = r - 9;
    cat.push([
      '=IF(Settings!D' + k + '="","",Settings!D' + k + ')',
      '=IF(A' + r + '="","",SUMIFS(' + A + ',' + C + ',A' + r + ',' + inMonth + '))',
      '=IF(OR(B' + r + '="",$B$4=0),"",B' + r + '/$B$4)',
      '=IF(A' + r + '="","",Settings!E' + k + ')',
      '=IF(A' + r + '="","",Settings!F' + k + ')'
    ]);
  }
  sh.getRange(11, 1, cat.length, 5).setFormulas(cat);
  sh.getRange('B11:B30').setNumberFormat(money);
  sh.getRange('C11:C30').setNumberFormat('0%');

  // By person (rows 11-18)
  sh.getRange('G10:H10').setValues([['Person', 'Spent']]);
  const ppl = [];
  for (let r = 11; r <= 18; r++) {
    ppl.push(['=IF(Settings!H' + (r - 9) + '="","",Settings!H' + (r - 9) + ')',
              '=IF(G' + r + '="","",SUMIFS(' + A + ',' + P + ',G' + r + ',' + inMonth + '))']);
  }
  sh.getRange(11, 7, ppl.length, 2).setFormulas(ppl);
  sh.getRange('H11:H18').setNumberFormat(money);

  // By payment mode (rows 21-28)
  sh.getRange('G20:H20').setValues([['Payment mode', 'Spent']]);
  const pay = [];
  for (let r = 21; r <= 28; r++) {
    pay.push(['=IF(Settings!J' + (r - 19) + '="","",Settings!J' + (r - 19) + ')',
              '=IF(G' + r + '="","",SUMIFS(' + A + ',' + PM + ',G' + r + ',' + inMonth + '))']);
  }
  sh.getRange(21, 7, pay.length, 2).setFormulas(pay);
  sh.getRange('H21:H28').setNumberFormat(money);

  // Daily trend (rows 11-41)
  sh.getRange('J10:K10').setValues([['Day', 'Spent']]);
  const day = [];
  for (let r = 11; r <= 41; r++) {
    day.push(['=IF(ROW()-10<=DAY(EOMONTH($B$3,0)),ROW()-10,"")',
              '=IF(J' + r + '="","",SUMIFS(' + A + ',' + T + ',">="&($B$3+J' + r + '-1),' + T + ',"<"&($B$3+J' + r + ')' + notSav + '))']);
  }
  sh.getRange(11, 10, day.length, 2).setFormulas(day);
  sh.getRange('K11:K41').setNumberFormat(money);

  // Kakeibo split (rows 35-39, includes Savings)
  sh.getRange('A33').setValue('Kakeibo split').setFontWeight('bold').setFontSize(12);
  sh.getRange('A34:C34').setValues([['Type', 'Spent', 'Share']]);
  sh.getRange(35, 1, 5, 1).setValues(KAKEIBO_TYPES.map(t => [t]));
  const kk = KAKEIBO_TYPES.map(function (t, i) {
    const r = 35 + i;
    return ['=SUMIFS(' + A + ',' + K + ',A' + r + ',' + dateM + ')', '=IF(SUM($B$35:$B$39)=0,"",B' + r + '/SUM($B$35:$B$39))'];
  });
  sh.getRange(35, 2, 5, 2).setFormulas(kk);
  sh.getRange('B35:B39').setNumberFormat(money);
  sh.getRange('C35:C39').setNumberFormat('0%');

  // Weekly flexible spending vs allowance (rows 43-47)
  sh.getRange('A41').setValue('Weekly flexible spending (fixed costs excluded)').setFontWeight('bold').setFontSize(12);
  sh.getRange('A42:D42').setValues([['Week', 'Spent', 'Allowance', 'Left']]);
  const wk = [];
  for (let n = 1; n <= 5; n++) {
    const r = 42 + n, s = (n - 1) * 7 + 1;
    const E = 'MIN(' + (n * 7) + ',DAY(EOMONTH($B$3,0)))';
    const dc = T + ',">="&($B$3+' + (s - 1) + '),' + T + ',"<"&($B$3+' + E + ')';
    wk.push([
      '=IF(' + s + '>DAY(EOMONTH($B$3,0)),"","Week ' + n + ' (days ' + s + '-"&' + E + '&")")',
      '=IF(A' + r + '="","",SUMIFS(' + A + ',' + dc + notSav + ')-IFERROR(SUMPRODUCT(SUMIFS(' + A + ',' + dc + ',' + C + ',' + FIX + notSav + ')),0))',
      '=IF(A' + r + '="","",$H$6/DAY(EOMONTH($B$3,0))*(' + E + '-' + (s - 1) + '))',
      '=IF(A' + r + '="","",C' + r + '-B' + r + ')'
    ]);
  }
  sh.getRange(43, 1, 5, 4).setFormulas(wk);
  sh.getRange('B43:D47').setNumberFormat(money);

  // Earmarked funds (Zakat & Qurbani) from the Funds tab (rows 50-53)
  sh.getRange('A50').setValue('Earmarked funds').setFontWeight('bold').setFontSize(12);
  sh.getRange('A51:E51').setValues([['Fund', 'Set aside to date', 'Paid out to date', 'Balance', 'Paid this month']]);
  const fn = [['B', 'D', '$B$2'], ['C', 'E', '$C$2']].map(function (c, i) {
    const r = 52 + i;
    const col = x => 'Funds!$' + x + '$4:$' + x + '$39';
    return [
      '=IF(Settings!L' + (i + 2) + '="","",Settings!L' + (i + 2) + ')',
      '=IF(A' + r + '="","",Funds!' + c[2] + '+SUMIFS(' + col(c[0]) + ',Funds!$A$4:$A$39,"<="&$B$3))',
      '=IF(A' + r + '="","",SUMIFS(' + col(c[1]) + ',Funds!$A$4:$A$39,"<="&$B$3))',
      '=IF(A' + r + '="","",B' + r + '-C' + r + ')',
      '=IF(A' + r + '="","",SUMIFS(' + col(c[1]) + ',Funds!$A$4:$A$39,$B$3))'
    ];
  });
  sh.getRange(52, 1, 2, 5).setFormulas(fn);
  sh.getRange('B52:E53').setNumberFormat(money);

  // Latest 10 expenses
  sh.getRange('A56').setValue('Latest 10 expenses').setFontWeight('bold').setFontSize(12);
  sh.getRange('A57:H57').setValues([['Category', 'Amount', 'Date', 'Time', 'Type', 'Remarks', 'Payment', 'Person']]);
  sh.getRange('A58').setFormula('=IFERROR(QUERY(Expenses!A2:K,"select D,E,A,C,K,G,F,I where A is not null order by A desc, C desc limit 10",0),"No expenses yet")');
  sh.getRange('B58:B67').setNumberFormat(money);
  sh.getRange('C58:C67').setNumberFormat('dd/mm/yyyy');
  sh.getRange('D58:D67').setNumberFormat('hh:mm');

  // Styling
  ['A10:E10', 'G10:H10', 'G20:H20', 'J10:K10', 'A34:C34', 'A42:D42', 'A51:E51', 'A57:H57'].forEach(a =>
    sh.getRange(a).setFontWeight('bold').setBackground('#1e3a5f').setFontColor('#ffffff'));
  [[1, 230], [2, 110], [3, 100], [4, 100], [5, 90], [6, 160], [7, 190], [8, 110], [9, 24], [10, 50], [11, 110]]
    .forEach(w => sh.setColumnWidth(w[0], w[1]));
  sh.setHiddenGridlines(true);
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenNumberLessThan(0).setFontColor('#b91c1c')
      .setRanges([sh.getRange('H8'), sh.getRange('D43:D47'), sh.getRange('D52:D53')]).build()
  ]);

  // Charts (two columns, from column M)
  const mk = (type, range, title, row, col, legend) => sh.insertChart(
    sh.newChart().setChartType(type).addRange(sh.getRange(range)).setNumHeaders(1)
      .setPosition(row, col, 0, 0)
      .setOption('title', title).setOption('legend', { position: legend || 'none' })
      .setOption('width', 520).setOption('height', 290).build());
  mk(Charts.ChartType.BAR, 'A10:B30', 'Spending by category', 2, 13);
  mk(Charts.ChartType.PIE, 'A34:B39', 'Kakeibo split', 2, 20, 'right');
  mk(Charts.ChartType.COLUMN, 'A42:C47', 'Weekly spending vs allowance', 18, 13, 'bottom');
  mk(Charts.ChartType.COLUMN, 'J10:K41', 'Daily spending', 18, 20);
  mk(Charts.ChartType.COLUMN, 'G10:H18', 'Spending by person', 34, 13);
  mk(Charts.ChartType.COLUMN, 'G20:H28', 'Spending by payment mode', 34, 20);
}
