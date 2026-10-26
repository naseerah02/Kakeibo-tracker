/**
 * @OnlyCurrentDoc
 * Family Expense Tracker (Kakeibo edition) - backend
 * Paste into Extensions > Apps Script in your Google Sheet, and add Form.html beside it.
 * 1) Run setup() once. 2) Deploy > New deployment > Web app
 *    (Execute as: Me, Who has access: Anyone). 3) Run showLinks() for the personal links.
 *
 * Expenses columns: Date | Month | Time | Category | Amount | Payment Mode | Remarks | Device Name | Person | ID | Kakeibo Type
 * Settings: B2 secret key, B3 currency, D categories, E Kakeibo type, F fixed cost? (Yes/No), H people, J payment modes.
 * Plan: one row per month with Income, Fixed costs (planned), Savings goal (household),
 *       and the part of savings set aside each month for the Zakat and Qurbani funds.
 * Funds: monthly ledger (set-aside from Plan, payments from Expenses, running balance). Settings L:M link each fund to a category.
 */

const EXPENSES = 'Expenses';
const SETTINGS = 'Settings';
const PLAN = 'Plan';
// After you host the offline app (see offline-app/), paste its web address here, e.g. 'https://yourname.github.io/expenses/'.
// showLinks() will then also print an offline-app link for each person.
const PWA_URL = '';

const FUNDS = 'Funds';
const DASHBOARD = 'Dashboard';
const HEADERS = ['Date', 'Month', 'Time', 'Category', 'Amount', 'Payment Mode', 'Remarks', 'Device Name', 'Person', 'ID', 'Kakeibo Type'];
const ID_COL = 10;
const KAKEIBO_TYPES = ['Needs', 'Wants', 'Culture', 'Extra', 'Savings'];

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
    st.getRange('A2:B3').setValues([
      ['Secret key', Utilities.getUuid().replace(/-/g, '')],
      ['Currency', 'PKR']
    ]);
    st.getRange('D1:F1').setValues([['Categories', 'Kakeibo type', 'Fixed cost?']]).setFontWeight('bold');
    st.getRange('H1').setValue('People').setFontWeight('bold');
    st.getRange('J1').setValue('Payment modes').setFontWeight('bold');
    st.getRange(2, 4, DEFAULT_CATEGORIES.length, 3).setValues(DEFAULT_CATEGORIES);
    st.getRange('H2:H4').setValues([['Person 1'], ['Person 2'], ['Person 3']]);
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

  buildDashboard();
  SpreadsheetApp.flush();
}

/**
 * Serves the expense form. Personal link format:
 *   <web app URL>?key=SECRET&person=Ali&device=iPhone
 * Run showLinks() after deploying to get a ready-made link for every person.
 */
function doGet(e) {
  const q = (e && e.parameter) || {};
  if (q.ping) return json_({ ok: true, message: 'Expense tracker is running' });

  const cfg = getConfig_();

  // Used by the offline app: returns the lists and budget as JSON (key required)
  if (q.action === 'config') {
    if (!q.key || String(q.key) !== cfg.key) return json_({ ok: false, error: 'Invalid key' });
    return json_({
      ok: true,
      currency: cfg.currency,
      categories: cfg.categories,
      types: cfg.types,
      fixed: cfg.fixed,
      kakeiboTypes: KAKEIBO_TYPES,
      payments: cfg.payments,
      budget: safeBudget_(new Date())
    });
  }

  if (!q.key || String(q.key) !== cfg.key) {
    return HtmlService.createHtmlOutput('<p style="font-family:sans-serif;padding:24px">Access denied. Please use your personal link.</p>')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  const tpl = HtmlService.createTemplateFromFile('Form');
  tpl.cfg = JSON.stringify({
    key: cfg.key,
    currency: cfg.currency,
    categories: cfg.categories,
    types: cfg.types,
    kakeiboTypes: KAKEIBO_TYPES,
    payments: cfg.payments,
    person: String(q.person || '').slice(0, 40),
    device: String(q.device || '').slice(0, 40),
    budget: safeBudget_(new Date())
  }).replace(/</g, '\\u003c');
  return tpl.evaluate()
    .setTitle('Add Expense')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Optional JSON API (same fields as the form). */
function doPost(e) {
  try {
    return json_(saveExpense_(parseParams_(e)));
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/** Called by the web form through google.script.run. */
function submitExpense(p) {
  return saveExpense_(p || {});
}

/**
 * Validates and saves one expense. Fields:
 *   key, amount, category, type, payment, remarks, device, person, id
 *   date ("YYYY-MM-DD" or "DD/MM/YYYY") and time ("HH:mm") are optional, default = now.
 *   type (Needs/Wants/Culture/Extra) is optional, default = the category's type in Settings.
 */
function saveExpense_(p) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const cfg = getConfig_();
    const tz = Session.getScriptTimeZone();
    const now = new Date();

    if (!p.key || String(p.key) !== cfg.key) return { ok: false, error: 'Invalid key' };

    const amount = parseFloat(String(p.amount).replace(/,/g, ''));
    if (!isFinite(amount) || amount <= 0) return { ok: false, error: 'Invalid amount' };

    const date = parseDate_(p.date || Utilities.formatDate(now, tz, 'yyyy-MM-dd'));
    if (!date) return { ok: false, error: 'Invalid date' };
    const time = parseTime_(p.time || Utilities.formatDate(now, tz, 'HH:mm'));
    if (time === null) return { ok: false, error: 'Invalid time' };

    const category = matchOption_(p.category, cfg.categories, 'Other');
    const payment = matchOption_(p.payment, cfg.payments, 'Other');
    const wantedType = String(p.type || '').trim().toLowerCase();
    const type = KAKEIBO_TYPES.find(t => t.toLowerCase() === wantedType) || cfg.types[category] || 'Extra';
    const remarks = String(p.remarks || p.note || '').trim().slice(0, 200);
    const device = String(p.device || '').trim().slice(0, 40);
    const person = String(p.person || 'Unknown').trim().slice(0, 40);
    const id = String(p.id || '').trim().slice(0, 60);
    const month = Utilities.formatDate(date, tz, 'MMMM');
    const fixed = cfg.fixed.indexOf(category) !== -1;

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EXPENSES);

    // Duplicate guard: the same ID in the last 100 rows is ignored (handles retries).
    if (id) {
      const last = sheet.getLastRow();
      if (last > 1) {
        const start = Math.max(2, last - 99);
        const ids = sheet.getRange(start, ID_COL, last - start + 1, 1).getValues().flat();
        if (ids.indexOf(id) !== -1) {
          return { ok: true, duplicate: true, message: 'Already saved', fixed: fixed, saving: type === 'Savings', fund: getFundInfo_(category, date), budget: safeBudget_(date) };
        }
      }
    }

    sheet.appendRow([date, month, time, category, amount, payment, remarks, device, person, id, type]);
    return { ok: true, message: 'Saved ' + amount + ' in ' + category, type: type, fixed: fixed, saving: type === 'Savings', fund: getFundInfo_(category, date), budget: safeBudget_(date) };
  } catch (err) {
    return { ok: false, error: String(err) };
  } finally {
    try { lock.releaseLock(); } catch (x) { /* not held */ }
  }
}

/**
 * Household budget status for the month and week containing `date`.
 * Only flexible spending counts (fixed-cost categories and Savings-type entries are excluded).
 */
function getBudget_(date) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const plan = ss.getSheetByName(PLAN);
  if (!plan) return { hasPlan: false };

  // Most recent plan row at or before this date
  let row = null;
  plan.getRange('A4:D39').getValues().forEach(function (r) {
    if (r[0] instanceof Date && r[0] <= date && (!row || r[0] > row[0])) row = r;
  });
  const income = row ? Number(row[1]) || 0 : 0;
  if (income <= 0) return { hasPlan: false };
  const planned = income - (Number(row[2]) || 0) - (Number(row[3]) || 0);

  const cfg = getConfig_();
  const y = date.getFullYear(), m = date.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const weekIndex = Math.floor((date.getDate() - 1) / 7);
  const wStart = weekIndex * 7 + 1;
  const wEnd = Math.min(wStart + 6, daysInMonth);

  let monthSpent = 0, weekSpent = 0;
  const ex = ss.getSheetByName(EXPENSES);
  const last = ex.getLastRow();
  if (last > 1) {
    ex.getRange(2, 1, last - 1, 11).getValues().forEach(function (r) {
      const d = r[0];
      if (!(d instanceof Date) || d.getFullYear() !== y || d.getMonth() !== m) return;
      if (cfg.fixed.indexOf(r[3]) !== -1) return;
      if (String(r[10]) === 'Savings') return;
      const amt = Number(r[4]) || 0;
      monthSpent += amt;
      if (d.getDate() >= wStart && d.getDate() <= wEnd) weekSpent += amt;
    });
  }

  const weekAllowance = planned / daysInMonth * (wEnd - wStart + 1);
  return {
    hasPlan: true,
    ym: y + '-' + ('0' + (m + 1)).slice(-2),
    week: weekIndex + 1,
    weekLeft: Math.round(weekAllowance - weekSpent),
    monthLeft: Math.round(planned - monthSpent),
    free: Math.round(planned)
  };
}

/** If `category` is linked to a fund (Settings L:M), returns { name, balance } as of the month of `date`. */
function getFundInfo_(category, date) {
  try {
    const cfg = getConfig_();
    const idx = cfg.funds.findIndex(f => norm_(f.category) === norm_(category));
    if (idx < 0 || idx > 1) return null;
    const fu = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FUNDS);
    if (!fu) return null;
    SpreadsheetApp.flush();
    let hit = null;
    fu.getRange('A4:G39').getValues().forEach(function (r) {
      if (r[0] instanceof Date && r[0] <= date && (!hit || r[0] > hit[0])) hit = r;
    });
    if (!hit) return null;
    return { name: cfg.funds[idx].name, balance: Math.round(Number(hit[5 + idx]) || 0) };
  } catch (err) {
    return null;
  }
}

function safeBudget_(date) {
  try { return getBudget_(date); } catch (err) { return { hasPlan: false }; }
}

function parseParams_(e) {
  if (e && e.postData && e.postData.contents) {
    try {
      const body = JSON.parse(e.postData.contents);
      if (body && typeof body === 'object') return body;
    } catch (x) { /* fall through to form params */ }
  }
  return (e && e.parameter) || {};
}

function getConfig_() {
  const st = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTINGS);
  const catRows = st.getRange('D2:F40').getValues().filter(r => String(r[0]).trim());
  const types = {};
  catRows.forEach(function (r) {
    const t = KAKEIBO_TYPES.find(x => x.toLowerCase() === String(r[1]).trim().toLowerCase());
    types[String(r[0])] = t || 'Extra';
  });
  return {
    key: String(st.getRange('B2').getValue()),
    currency: String(st.getRange('B3').getValue() || ''),
    categories: catRows.map(r => String(r[0])),
    types: types,
    fixed: catRows.filter(r => String(r[2]).trim().toLowerCase() === 'yes').map(r => String(r[0])),
    payments: st.getRange('J2:J40').getValues().flat().filter(String),
    funds: st.getRange('L2:M10').getValues()
      .filter(r => String(r[0]).trim() && String(r[1]).trim())
      .map(r => ({ name: String(r[0]), category: String(r[1]) }))
  };
}

function parseDate_(s) {
  s = String(s || '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/), y, mo, d;
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/))) { d = +m[1]; mo = +m[2]; y = +m[3]; }
  else return null;
  const dt = new Date(y, mo - 1, d);
  return (dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d) ? dt : null;
}

function parseTime_(s) {
  const m = String(s || '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  return (h < 24 && mi < 60) ? (h * 60 + mi) / 1440 : null;
}

/** Compares ignoring case, emoji, and punctuation, so phones can send "Food & Dining" for "Food & Dining 🍔". */
function norm_(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function matchOption_(input, list, fallback) {
  const want = norm_(input);
  if (want) {
    const hit = list.find(x => norm_(x) === want);
    if (hit) return hit;
  }
  return list.find(x => norm_(x) === norm_(fallback)) || fallback;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Optional: run from the editor to add a test row without a phone. */
function testInsert() {
  const out = doPost({ parameter: {
    key: getConfig_().key, amount: '1250', category: 'Food & Dining', payment: 'Cash',
    remarks: 'test lunch', device: 'Editor', person: 'Test', id: 'test-' + Date.now()
  } });
  Logger.log(out.getContent());
}

/**
 * Run after deploying. Logs a personal link for each person in Settings (column H),
 * one for iPhone and one for Android. Treat these links like passwords.
 * If a link ends in /dev instead of /exec, replace /dev with /exec.
 */
function showLinks() {
  const st = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTINGS);
  const key = getConfig_().key;
  const base = ScriptApp.getService().getUrl();
  const people = st.getRange('H2:H20').getValues().flat().filter(String);
  people.forEach(function (name) {
    ['iPhone', 'Android'].forEach(function (dev) {
      Logger.log(name + ' / ' + dev + ':\n' + base + '?key=' + key +
        '&person=' + encodeURIComponent(name) + '&device=' + dev);
      if (PWA_URL) {
        Logger.log(name + ' / ' + dev + ' (offline app):\n' + PWA_URL.replace(/\/?$/, '/') +
          '?api=' + encodeURIComponent(base) + '&key=' + key +
          '&person=' + encodeURIComponent(name) + '&device=' + dev);
      }
    });
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
