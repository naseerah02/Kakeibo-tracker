/* Text for the app in English and Urdu, and the switch between them.
   English here is exactly the wording the app always had. Placeholders look like {name}. */
(function (root) {
  'use strict';

  var STR = {};

  STR.en = {
    // ---- Funds tab (the statement for one fund)
    'tab.funds': `Funds`, 'fs.pick': `Fund`, 'fs.balance': `Balance`, 'fs.collected': `Set aside so far`, 'fs.paid': `Paid out`,
    'fs.target': `Target`, 'fs.togo': `Still to reach`, 'fs.opening': `Opening balance {amt}`,
    'fs.notarget': `No target is set for this fund. Add an amount and a date in Settings (columns N and O).`,
    'fs.months': `Month by month`, 'fs.h.month': `Month`, 'fs.h.set': `Set aside`, 'fs.h.paid': `Paid`, 'fs.h.bal': `Balance`,
    'fs.payments': `Payments`, 'fs.nopay': `No payments from this fund yet.`,
    'fs.total.one': `{n} payment, {amt} in total`, 'fs.total.other': `{n} payments, {amt} in total`,
    'fs.more': `Showing the latest {n} of {total}.`, 'fs.paybtn': `Pay from this fund`,
    'fs.none': `No funds yet. Add one from the sheet menu: Expense Tracker > Add a fund.`,
    'fs.offline': `<p class="hint">Connect to the internet to see this fund. After that it is kept on your phone.</p>`,
    'err.Fund not found': `Fund not found`,
    // ---- generic
    'online': `Online`, 'offline': `Offline`,
    'who.main': `Logging as {name}`, 'who.setup': `First-time setup`, 'who.activate': `Sign in`, 'who.pinSet': `Create your PIN`, 'who.lock': `Locked`,
    'over.by': `<b class="neg">over by {amt}</b>`, 'left.of': `<b>{amt}</b> left`,
    'lang.other': `اردو`,
    'kind.Weekly': `Weekly`, 'kind.Monthly': `Monthly`,
    'type.Needs': `Needs`, 'type.Wants': `Wants`, 'type.Culture': `Culture`, 'type.Extra': `Extra`, 'type.Savings': `Savings`,

    // ---- static screens (data-i18n in index.html)
    'app.title': `Expense Tracker`,
    'setup.hint': `Open the personal link for this phone, or fill in these two things. Run <b>showLinks()</b> in Apps Script to see them.`,
    'setup.api': `Web app URL (ends in /exec)`, 'setup.person': `Your name (as written in the sheet)`, 'setup.go': `Continue`,
    'act.intro': `To keep the family sheet private, each phone signs in once with a 6-digit code sent to the email address saved for you in the sheet.`,
    'act.send': `Email me a code`, 'act.code': `6-digit code`, 'act.verify': `Verify`, 'act.resend': `Send again`,
    'act.cancel': `Cancel`, 'act.change': `Use a different name`,
    'pinset.hint': `Choose a PIN of 4 to 6 digits. You will enter it whenever you open the app.`,
    'pinset.new': `New PIN`, 'pinset.repeat': `Repeat PIN`, 'pinset.save': `Save PIN`,
    'lock.enter': `Enter your PIN`, 'lock.go': `Unlock`, 'lock.forgot': `Forgot PIN?`,
    'tab.add': `Add`, 'tab.history': `History`, 'tab.month': `Month`, 'tab.reflect': `Reflect`,
    'edit.cancel': `Cancel`, 'edit.delete': `Delete entry`,
    'f.amount': `Amount`, 'f.category': `Category`, 'f.type': `Kakeibo type`, 'f.payment': `Payment mode`,
    'f.date': `Date`, 'f.time': `Time`, 'f.remarks': `Remarks / purpose`, 'f.remarks.ph': `e.g. Monthly groceries, lunch, cab`,
    'f.device': `Device logged`, 'save.record': `Save Record`, 'fav.save': `☆ Save as favourite`,
    'cfg.retry': `Try again`, 'fundnote.hide': `Hide for today`,
    'hist.hint': `Your latest entries. Tap Edit to change one, or Delete to remove it.`, 'hist.refresh': `Refresh`,
    'mon.label': `Month`, 'mon.0': `This month`, 'mon.1': `Last month`, 'mon.2': `2 months ago`, 'sum.loading': `Loading your numbers...`,
    'ref.hint': `Kakeibo is about looking back. Take two minutes.`, 'ref.period': `Period`,
    'ref.w0': `This week`, 'ref.w1': `Last week`, 'ref.m0': `This month`, 'ref.m1': `Last month`, 'ref.save': `Save reflection`,
    'sync.now': `Sync now`, 'fav.manage': `Manage favourites`,
    'foot.install': `Install app`, 'foot.lock': `Lock now`, 'foot.reset': `Reset this app`,
    'bio.use': `Use fingerprint`, 'bio.on': `Turn on fingerprint`, 'bio.off': `Turn off fingerprint`,

    // ---- the budget banner, warnings and the preview
    'alert.over.week': `Over this week's allowance`, 'alert.over.month': `Over this month's allowance`,
    'alert.near.week': `{pct}% of this week's allowance used`, 'alert.near.month': `{pct}% of this month's allowance used`,
    'banner.line': `Week {week}: {w} &middot; Month: {m}`,
    'banner.pending.one': `<small>Estimate: {n} entry not synced yet</small>`, 'banner.pending.other': `<small>Estimate: {n} entries not synced yet</small>`,
    'banner.offline': `<small>Offline: last known figures</small>`,
    'preview.after': `After this: week {w} &middot; month {m}`,
    'limit.note.near': `{cat}: {pct}% of its {limit} monthly limit used`,
    'limit.note.over': `{cat}: over its {limit} monthly limit by {amt}`,
    'limit.preview.left': `{cat}: <b>{amt}</b> left of its {limit} limit`,
    'limit.preview.over': `{cat}: <b class="neg">over its {limit} limit by {amt}</b>`,

    // ---- funds
    'fund.pay': `Pay from a fund:`,
    'fund.passed': `{name}: the target date has passed and {amt} is still short.`,
    'fund.behind.one': `{name}: {days} day to go. Set aside {needed} a month (plan: {planned}) to reach {target}.`,
    'fund.behind.other': `{name}: {days} days to go. Set aside {needed} a month (plan: {planned}) to reach {target}.`,
    'fund.track.one': `{name}: {days} day to go. On track: have {target} ready.`,
    'fund.track.other': `{name}: {days} days to go. On track: have {target} ready.`,
    'note.fund': `Paid from your {name} fund: {state}`, 'note.fund.over': `overdrawn by <b>{amt}</b>`, 'note.fund.ok': `balance now <b>{amt}</b>`,
    'note.saving': `Savings / investment: not counted as spending.`, 'note.fixed': `Fixed cost: not counted against your weekly allowance.`,

    // ---- lists and messages
    'fav.delete': `Delete`,
    'q.waiting': `{n} waiting to sync`, 'q.failed': `, {f} need attention`,
    'q.reflection': `<b>Reflection</b> &middot; {kind}`, 'q.notSaved': `Not saved: {err}`, 'q.retry': `Retry`, 'q.waitItem': `Waiting to sync`, 'q.delete': `Delete`,
    'cfg.auth': `This phone needs to sign in again. Your unsent entries are safe.`,
    'cfg.unreachable': `Could not reach your Google script. Check the link (it must end in /exec) and that access is set to Anyone.`,
    'cfg.offline': `Offline. Connect once to load your categories.`,
    'cfg.page': `Google sent a web page instead of data. In Apps Script use Deploy > Manage deployments > Edit > New version > Deploy, and make sure access is set to Anyone.`,
    'cfg.said': `Google said: {err}.`,
    'sync.failed.one': `{n} entry needs attention`, 'sync.failed.other': `{n} entries need attention`,
    'sync.waiting': `Saved on this phone: {n} waiting to sync`, 'sync.problem': ` ({p})`,
    'sync.done': `Synced to your sheet ✓`, 'sync.error': `Sync problem: {m}`, 'sync.syncing': `Syncing...`, 'cfg.trying': `Trying...`,
    'auth.default': `This phone needs to sign in.`, 'auth.short': `This phone needs to sign in again.`,
    'otp.resend.n': `Send again ({n})`, 'otp.sending': `Sending...`,
    'otp.sent': `If an email is saved for you, a 6-digit code is on its way (valid for 10 minutes). No email? Ask the sheet owner to add yours in Settings.`,
    'otp.fail': `Could not send a code.`,
    'otp.unreach.long': `Could not reach your Google script. Check the link and that access is set to Anyone.`,
    'otp.offline.get': `You are offline. Connect to the internet to get a code.`,
    'otp.enter': `Enter the 6-digit code from the email.`, 'otp.bad': `That code did not work.`,
    'otp.unreach': `Could not reach your Google script.`, 'otp.offline.try': `You are offline. Connect to the internet and try again.`,
    'otp.forgot': `We will email you a code to reset your PIN.`, 'otp.pinwrong': `Too many wrong PINs. Sign in again with a code.`,
    'pin.wait': `Too many tries. Wait {n} seconds.`, 'pin.nocheck': `This browser cannot check a PIN here.`,
    'pin.wrong': `Wrong PIN. {n} tries left before you must sign in again.`,
    'pin.digits': `Use 4 to 6 digits.`, 'pin.match': `The two PINs do not match.`,
    'pin.nosave': `This browser cannot protect a PIN here (it needs a secure https page).`,
    'bio.enabled': `Fingerprint is on. You can still use your PIN.`, 'bio.disabled': `Fingerprint is off.`,
    'bio.failed': `Fingerprint was cancelled or not recognised. Enter your PIN.`, 'bio.cannot': `Could not turn on the fingerprint on this phone.`,
    'save.changes': `Save changes`, 'edit.text': `Editing an entry.`, 'edit.text.q': `Editing an entry (not synced yet).`,
    'edit.savedLocal': `Changes saved on this phone ✓`, 'edit.saving': `Saving changes...`,
    'edit.offline': `Connect to the internet to change saved entries.`, 'edit.fail': `Could not save the changes.`, 'edit.saved': `Changes saved ✓`,
    'del.confirm': `Delete this entry? This cannot be undone.`, 'del.done': `Entry deleted`,
    'del.offline': `Connect to the internet to delete saved entries.`, 'del.fail': `Could not delete the entry.`,
    'hist.fail': `Could not load your history.`, 'hist.offline': `Offline: showing the last loaded list.`,
    'hist.none': `<p class="hint">No entries yet.</p>`, 'hist.edit': `Edit`, 'hist.delete': `Delete`,
    'f.invalid': `Enter a valid amount`, 'f.nocfg': `Connect to the internet once to load your categories`,
    'saved.local': `Saved on this phone ✓`, 'fav.prompt': `Name this favourite`, 'fav.saved': `Favourite saved ★`,
    'ref.empty': `Write at least one answer.`, 'ref.saved': `Reflection saved ✓`,
    'setup.invalid': `Enter the full /exec URL and your name.`,
    'change.confirm': `{n} unsent entries will be sent under the new name. Continue?`,
    'reset.confirm.n': `{n} entries have not reached your sheet yet and will be lost. Reset anyway?`, 'reset.confirm': `Reset this app on this phone?`,

    // ---- Reflect and Month
    'ref.q.w1': `What went well with money this week?`, 'ref.q.w2': `What was an unnecessary spend, and why?`, 'ref.q.w3': `One thing I will do better next week`,
    'ref.q.m1': `How did I do against my savings goal? What helped or got in the way?`, 'ref.q.m2': `Which Wants or Extra spending can I reduce?`, 'ref.q.m3': `My plan for next month`,
    'stats.spent': `Spent <b>{amt}</b>`, 'stats.spent.of': `Spent <b>{amt}</b> of {allow} &middot; {left}`,
    'stats.top': `<br>Top: {list}`, 'stats.prev': `<br>{label}: {amt} ({change})`,
    'chg.same': `no change`, 'chg.up': `up {pct}%`, 'chg.down': `down {pct}%`,
    'stats.leftafter': `<br>Left after spending: {amt} (goal {goal})`, 'stats.last': `<small>Last loaded numbers.</small>`,
    'sum.offline': `Connect to the internet to see your numbers. You can still write your reflection.`,
    'k.spent': `Spent`, 'k.allow': `Allowance`, 'k.left': `Left`, 'k.over': `Over by`, 'm.used': `Allowance used`,
    'm.perday': `{amt} a day`, 'm.fixed': `fixed costs paid {amt}`, 'm.savings': `savings and funds paid {amt}`,
    'm.same': `same as {label}`, 'm.up': `up {pct}% on {label}`, 'm.down': `down {pct}% on {label}`,
    'm.split': `Kakeibo split`, 'm.nospend': `No spending recorded yet.`, 'm.bycat': `By category`,
    'm.byweek': `By week <span class="meta">(dashed = allowance)</span>`, 'm.byday': `By day`, 'm.funds': `Funds`,
    'm.fund.over': `<b class="neg">overdrawn by {amt}</b>`, 'm.fund.ok': `<b>{amt}</b> set aside`,
    'm.targets': `Fund targets`, 'm.limits': `Category limits`, 'm.last': `<p class="meta">Last loaded numbers.</p>`,
    'm.offline': `<p class="hint">Connect to the internet to see your month. After that it is kept on your phone.</p>`,
    'chart.weeks': `Spending against allowance, by week`, 'chart.days': `Spending by day`,
    't.reached': `target reached`, 't.passed': `the target date has passed`,
    't.days.one': `{days} day to go`, 't.days.other': `{days} days to go`,
    't.behind': ` &middot; set aside {needed} a month (plan {planned})`, 't.ontrack': ` &middot; on track`,
    't.line': `{bal} of {target} by {date} &middot; {msg}`,

    // ---- messages that come back from Google
    'err.Invalid amount': `Invalid amount`, 'err.Invalid date': `Invalid date`, 'err.Invalid time': `Invalid time`
  };

  STR.ur = {
    'tab.funds': `فنڈز`, 'fs.pick': `فنڈ`, 'fs.balance': `بیلنس`, 'fs.collected': `اب تک الگ رکھے`, 'fs.paid': `ادا شدہ`,
    'fs.target': `ہدف`, 'fs.togo': `ہدف تک باقی`, 'fs.opening': `ابتدائی بیلنس {amt}`,
    'fs.notarget': `اس فنڈ کا ہدف مقرر نہیں۔ Settings میں رقم اور تاریخ ڈالیں (کالم N اور O)۔`,
    'fs.months': `مہینہ بہ مہینہ`, 'fs.h.month': `مہینہ`, 'fs.h.set': `الگ رکھے`, 'fs.h.paid': `ادا`, 'fs.h.bal': `بیلنس`,
    'fs.payments': `ادائیگیاں`, 'fs.nopay': `اس فنڈ سے ابھی کوئی ادائیگی نہیں۔`,
    'fs.total.one': `{n} ادائیگی، کل {amt}`, 'fs.total.other': `{n} ادائیگیاں، کل {amt}`,
    'fs.more': `{total} میں سے تازہ ترین {n} دکھائے جا رہے ہیں۔`, 'fs.paybtn': `اس فنڈ سے ادائیگی کریں`,
    'fs.none': `ابھی کوئی فنڈ نہیں۔ شیٹ کے مینو سے شامل کریں: Expense Tracker > Add a fund۔`,
    'fs.offline': `<p class="hint">یہ فنڈ دیکھنے کے لیے انٹرنیٹ سے جڑیں۔ اس کے بعد یہ آپ کے فون میں محفوظ رہتا ہے۔</p>`,
    'err.Fund not found': `فنڈ نہیں ملا`,
    'online': `آن لائن`, 'offline': `آف لائن`,
    'who.main': `{name} کے طور پر اندراج`, 'who.setup': `پہلی بار سیٹ اپ`, 'who.activate': `سائن اِن`, 'who.pinSet': `اپنا پن بنائیں`, 'who.lock': `مقفل`,
    'over.by': `<b class="neg">{amt} زیادہ</b>`, 'left.of': `<b>{amt}</b> باقی`,
    'lang.other': `English`,
    'kind.Weekly': `ہفتہ وار`, 'kind.Monthly': `ماہانہ`,
    'type.Needs': `ضروریات`, 'type.Wants': `خواہشات`, 'type.Culture': `علم و ثقافت`, 'type.Extra': `غیر متوقع`, 'type.Savings': `بچت`,

    'app.title': `خرچ ٹریکر`,
    'setup.hint': `اس فون کا ذاتی لنک کھولیں، یا یہ دو چیزیں بھر دیں۔ انہیں دیکھنے کے لیے Apps Script میں <b>showLinks()</b> چلائیں۔`,
    'setup.api': `ویب ایپ کا یو آر ایل (/exec پر ختم ہوتا ہے)`, 'setup.person': `آپ کا نام (جیسا شیٹ میں لکھا ہے)`, 'setup.go': `آگے بڑھیں`,
    'act.intro': `خاندانی شیٹ کو نجی رکھنے کے لیے ہر فون ایک بار 6 ہندسوں کے کوڈ سے سائن اِن کرتا ہے، جو شیٹ میں آپ کے محفوظ کردہ ای میل پر بھیجا جاتا ہے۔`,
    'act.send': `مجھے کوڈ ای میل کریں`, 'act.code': `6 ہندسوں کا کوڈ`, 'act.verify': `تصدیق کریں`, 'act.resend': `دوبارہ بھیجیں`,
    'act.cancel': `منسوخ کریں`, 'act.change': `کوئی اور نام استعمال کریں`,
    'pinset.hint': `4 سے 6 ہندسوں کا پن منتخب کریں۔ جب بھی ایپ کھولیں گے یہ درج کرنا ہوگا۔`,
    'pinset.new': `نیا پن`, 'pinset.repeat': `پن دوبارہ لکھیں`, 'pinset.save': `پن محفوظ کریں`,
    'lock.enter': `اپنا پن درج کریں`, 'lock.go': `کھولیں`, 'lock.forgot': `پن بھول گئے؟`,
    'tab.add': `شامل کریں`, 'tab.history': `ریکارڈ`, 'tab.month': `مہینہ`, 'tab.reflect': `جائزہ`,
    'edit.cancel': `منسوخ کریں`, 'edit.delete': `اندراج حذف کریں`,
    'f.amount': `رقم`, 'f.category': `زمرہ`, 'f.type': `کاکیبو کی قسم`, 'f.payment': `ادائیگی کا طریقہ`,
    'f.date': `تاریخ`, 'f.time': `وقت`, 'f.remarks': `تفصیل / مقصد`, 'f.remarks.ph': `مثلاً مہینے کا راشن، دوپہر کا کھانا، ٹیکسی`,
    'f.device': `ڈیوائس`, 'save.record': `ریکارڈ محفوظ کریں`, 'fav.save': `☆ پسندیدہ میں محفوظ کریں`,
    'cfg.retry': `دوبارہ کوشش کریں`, 'fundnote.hide': `آج کے لیے چھپائیں`,
    'hist.hint': `آپ کے تازہ ترین اندراجات۔ تبدیلی کے لیے ترمیم، ہٹانے کے لیے حذف دبائیں۔`, 'hist.refresh': `تازہ کریں`,
    'mon.label': `مہینہ`, 'mon.0': `یہ مہینہ`, 'mon.1': `پچھلا مہینہ`, 'mon.2': `دو مہینے پہلے`, 'sum.loading': `آپ کے اعداد و شمار لوڈ ہو رہے ہیں...`,
    'ref.hint': `کاکیبو پیچھے مڑ کر دیکھنے کا نام ہے۔ دو منٹ نکالیں۔`, 'ref.period': `مدت`,
    'ref.w0': `یہ ہفتہ`, 'ref.w1': `پچھلا ہفتہ`, 'ref.m0': `یہ مہینہ`, 'ref.m1': `پچھلا مہینہ`, 'ref.save': `جائزہ محفوظ کریں`,
    'sync.now': `ابھی سنک کریں`, 'fav.manage': `پسندیدہ کا انتظام`,
    'foot.install': `ایپ انسٹال کریں`, 'foot.lock': `ابھی لاک کریں`, 'foot.reset': `ایپ ری سیٹ کریں`,
    'bio.use': `فنگر پرنٹ استعمال کریں`, 'bio.on': `فنگر پرنٹ آن کریں`, 'bio.off': `فنگر پرنٹ بند کریں`,

    'alert.over.week': `اس ہفتے کی حد سے تجاوز`, 'alert.over.month': `اس مہینے کی حد سے تجاوز`,
    'alert.near.week': `اس ہفتے کی {pct}% حد استعمال ہو چکی`, 'alert.near.month': `اس مہینے کی {pct}% حد استعمال ہو چکی`,
    'banner.line': `ہفتہ {week}: {w} &middot; مہینہ: {m}`,
    'banner.pending.one': `<small>اندازہ: {n} اندراج ابھی سنک نہیں ہوا</small>`, 'banner.pending.other': `<small>اندازہ: {n} اندراجات ابھی سنک نہیں ہوئے</small>`,
    'banner.offline': `<small>آف لائن: آخری معلوم اعداد</small>`,
    'preview.after': `اس کے بعد: ہفتہ {w} &middot; مہینہ {m}`,
    'limit.note.near': `{cat}: ماہانہ حد {limit} میں سے {pct}% استعمال ہو چکی`,
    'limit.note.over': `{cat}: ماہانہ حد {limit} سے {amt} زیادہ`,
    'limit.preview.left': `{cat}: حد {limit} میں سے <b>{amt}</b> باقی`,
    'limit.preview.over': `{cat}: <b class="neg">حد {limit} سے {amt} زیادہ</b>`,

    'fund.pay': `فنڈ سے ادائیگی:`,
    'fund.passed': `{name}: ہدف کی تاریخ گزر چکی ہے اور {amt} اب بھی کم ہیں۔`,
    'fund.behind.one': `{name}: {days} دن باقی۔ {target} تک پہنچنے کے لیے ماہانہ {needed} الگ رکھیں (منصوبہ: {planned})۔`,
    'fund.behind.other': `{name}: {days} دن باقی۔ {target} تک پہنچنے کے لیے ماہانہ {needed} الگ رکھیں (منصوبہ: {planned})۔`,
    'fund.track.one': `{name}: {days} دن باقی۔ ٹھیک چل رہا ہے: {target} تیار رکھیں۔`,
    'fund.track.other': `{name}: {days} دن باقی۔ ٹھیک چل رہا ہے: {target} تیار رکھیں۔`,
    'note.fund': `آپ کے {name} فنڈ سے ادائیگی: {state}`, 'note.fund.over': `فنڈ سے <b>{amt}</b> زیادہ نکل گئے`, 'note.fund.ok': `اب بیلنس <b>{amt}</b>`,
    'note.saving': `بچت / سرمایہ کاری: خرچ میں شمار نہیں ہوتی۔`, 'note.fixed': `مقررہ خرچ: ہفتہ وار حد میں شمار نہیں ہوتا۔`,

    'fav.delete': `حذف کریں`,
    'q.waiting': `{n} سنک کے منتظر`, 'q.failed': `، {f} توجہ طلب`,
    'q.reflection': `<b>جائزہ</b> &middot; {kind}`, 'q.notSaved': `محفوظ نہیں ہوا: {err}`, 'q.retry': `دوبارہ کوشش`, 'q.waitItem': `سنک کا انتظار`, 'q.delete': `حذف کریں`,
    'cfg.auth': `اس فون کو دوبارہ سائن اِن کرنا ہوگا۔ آپ کے نہ بھیجے گئے اندراجات محفوظ ہیں۔`,
    'cfg.unreachable': `آپ کے گوگل اسکرپٹ تک رسائی نہیں ہو سکی۔ لنک چیک کریں (یہ /exec پر ختم ہونا چاہیے) اور یہ کہ رسائی "Anyone" پر ہے۔`,
    'cfg.offline': `آف لائن۔ زمرے لوڈ کرنے کے لیے ایک بار انٹرنیٹ سے جڑیں۔`,
    'cfg.page': `گوگل نے ڈیٹا کی جگہ ویب پیج بھیجا۔ Apps Script میں Deploy > Manage deployments > Edit > New version > Deploy کریں، اور رسائی "Anyone" پر رکھیں۔`,
    'cfg.said': `گوگل نے کہا: {err}۔`,
    'sync.failed.one': `{n} اندراج پر توجہ درکار ہے`, 'sync.failed.other': `{n} اندراجات پر توجہ درکار ہے`,
    'sync.waiting': `اس فون پر محفوظ: {n} سنک کے منتظر`, 'sync.problem': ` ({p})`,
    'sync.done': `آپ کی شیٹ میں سنک ہو گیا ✓`, 'sync.error': `سنک میں مسئلہ: {m}`, 'sync.syncing': `سنک ہو رہا ہے...`, 'cfg.trying': `کوشش ہو رہی ہے...`,
    'auth.default': `اس فون کو سائن اِن کرنا ہوگا۔`, 'auth.short': `اس فون کو دوبارہ سائن اِن کرنا ہوگا۔`,
    'otp.resend.n': `دوبارہ بھیجیں ({n})`, 'otp.sending': `بھیجا جا رہا ہے...`,
    'otp.sent': `اگر آپ کا ای میل محفوظ ہے تو 6 ہندسوں کا کوڈ بھیج دیا گیا ہے (10 منٹ تک کارآمد)۔ ای میل نہیں ملی؟ شیٹ کے مالک سے کہیں کہ Settings میں آپ کی ای میل ڈال دیں۔`,
    'otp.fail': `کوڈ نہیں بھیجا جا سکا۔`,
    'otp.unreach.long': `آپ کے گوگل اسکرپٹ تک رسائی نہیں ہو سکی۔ لنک چیک کریں اور یہ کہ رسائی "Anyone" پر ہے۔`,
    'otp.offline.get': `آپ آف لائن ہیں۔ کوڈ منگوانے کے لیے انٹرنیٹ سے جڑیں۔`,
    'otp.enter': `ای میل میں آیا 6 ہندسوں کا کوڈ درج کریں۔`, 'otp.bad': `یہ کوڈ کام نہیں کیا۔`,
    'otp.unreach': `آپ کے گوگل اسکرپٹ تک رسائی نہیں ہو سکی۔`, 'otp.offline.try': `آپ آف لائن ہیں۔ انٹرنیٹ سے جڑیں اور دوبارہ کوشش کریں۔`,
    'otp.forgot': `پن ری سیٹ کرنے کے لیے ہم آپ کو کوڈ ای میل کریں گے۔`, 'otp.pinwrong': `بہت زیادہ غلط پن۔ کوڈ کے ساتھ دوبارہ سائن اِن کریں۔`,
    'pin.wait': `بہت زیادہ کوششیں۔ {n} سیکنڈ انتظار کریں۔`, 'pin.nocheck': `یہ براؤزر یہاں پن چیک نہیں کر سکتا۔`,
    'pin.wrong': `غلط پن۔ دوبارہ سائن اِن کرنے سے پہلے {n} کوششیں باقی ہیں۔`,
    'pin.digits': `4 سے 6 ہندسے استعمال کریں۔`, 'pin.match': `دونوں پن آپس میں نہیں ملتے۔`,
    'pin.nosave': `یہ براؤزر یہاں پن محفوظ نہیں کر سکتا (اس کے لیے محفوظ https صفحہ چاہیے)۔`,
    'bio.enabled': `فنگر پرنٹ آن ہے۔ آپ پن بھی استعمال کر سکتے ہیں۔`, 'bio.disabled': `فنگر پرنٹ بند ہے۔`,
    'bio.failed': `فنگر پرنٹ منسوخ ہوا یا پہچانا نہیں گیا۔ اپنا پن درج کریں۔`, 'bio.cannot': `اس فون پر فنگر پرنٹ آن نہیں ہو سکا۔`,
    'save.changes': `تبدیلیاں محفوظ کریں`, 'edit.text': `ایک اندراج میں ترمیم ہو رہی ہے۔`, 'edit.text.q': `ایک اندراج میں ترمیم ہو رہی ہے (ابھی سنک نہیں ہوا)۔`,
    'edit.savedLocal': `تبدیلیاں اس فون پر محفوظ ہو گئیں ✓`, 'edit.saving': `تبدیلیاں محفوظ ہو رہی ہیں...`,
    'edit.offline': `محفوظ شدہ اندراجات بدلنے کے لیے انٹرنیٹ سے جڑیں۔`, 'edit.fail': `تبدیلیاں محفوظ نہیں ہو سکیں۔`, 'edit.saved': `تبدیلیاں محفوظ ہو گئیں ✓`,
    'del.confirm': `کیا یہ اندراج حذف کریں؟ یہ واپس نہیں ہو سکے گا۔`, 'del.done': `اندراج حذف ہو گیا`,
    'del.offline': `محفوظ شدہ اندراجات حذف کرنے کے لیے انٹرنیٹ سے جڑیں۔`, 'del.fail': `اندراج حذف نہیں ہو سکا۔`,
    'hist.fail': `آپ کا ریکارڈ لوڈ نہیں ہو سکا۔`, 'hist.offline': `آف لائن: آخری لوڈ شدہ فہرست دکھائی جا رہی ہے۔`,
    'hist.none': `<p class="hint">ابھی کوئی اندراج نہیں۔</p>`, 'hist.edit': `ترمیم`, 'hist.delete': `حذف`,
    'f.invalid': `درست رقم درج کریں`, 'f.nocfg': `زمرے لوڈ کرنے کے لیے ایک بار انٹرنیٹ سے جڑیں`,
    'saved.local': `اس فون پر محفوظ ہو گیا ✓`, 'fav.prompt': `اس پسندیدہ کا نام لکھیں`, 'fav.saved': `پسندیدہ محفوظ ہو گیا ★`,
    'ref.empty': `کم از کم ایک جواب لکھیں۔`, 'ref.saved': `جائزہ محفوظ ہو گیا ✓`,
    'setup.invalid': `پورا /exec یو آر ایل اور اپنا نام درج کریں۔`,
    'change.confirm': `{n} نہ بھیجے گئے اندراجات نئے نام سے بھیجے جائیں گے۔ جاری رکھیں؟`,
    'reset.confirm.n': `{n} اندراجات ابھی آپ کی شیٹ تک نہیں پہنچے اور ضائع ہو جائیں گے۔ پھر بھی ری سیٹ کریں؟`, 'reset.confirm': `اس فون پر ایپ ری سیٹ کریں؟`,

    'ref.q.w1': `اس ہفتے پیسوں کے معاملے میں کیا اچھا رہا؟`, 'ref.q.w2': `کون سا خرچ غیر ضروری تھا، اور کیوں؟`, 'ref.q.w3': `اگلے ہفتے میں ایک چیز بہتر کروں گا/گی`,
    'ref.q.m1': `بچت کے ہدف کے مقابلے میں میرا مہینہ کیسا رہا؟ کیا چیز مددگار یا رکاوٹ بنی؟`, 'ref.q.m2': `خواہشات یا غیر متوقع میں سے کون سا خرچ کم کر سکتا ہوں؟`, 'ref.q.m3': `اگلے مہینے کا میرا منصوبہ`,
    'stats.spent': `خرچ <b>{amt}</b>`, 'stats.spent.of': `خرچ <b>{amt}</b>، حد {allow} &middot; {left}`,
    'stats.top': `<br>سب سے زیادہ: {list}`, 'stats.prev': `<br>{label}: {amt} ({change})`,
    'chg.same': `کوئی فرق نہیں`, 'chg.up': `{pct}% زیادہ`, 'chg.down': `{pct}% کم`,
    'stats.leftafter': `<br>خرچ کے بعد بچا: {amt} (ہدف {goal})`, 'stats.last': `<small>آخری لوڈ شدہ اعداد۔</small>`,
    'sum.offline': `اعداد دیکھنے کے لیے انٹرنیٹ سے جڑیں۔ آپ پھر بھی اپنا جائزہ لکھ سکتے ہیں۔`,
    'k.spent': `خرچ`, 'k.allow': `حد`, 'k.left': `باقی`, 'k.over': `زیادہ`, 'm.used': `استعمال شدہ حد`,
    'm.perday': `روزانہ {amt}`, 'm.fixed': `مقررہ خرچ ادا {amt}`, 'm.savings': `بچت اور فنڈز میں ادا {amt}`,
    'm.same': `{label} کے برابر`, 'm.up': `{label} سے {pct}% زیادہ`, 'm.down': `{label} سے {pct}% کم`,
    'm.split': `کاکیبو تقسیم`, 'm.nospend': `ابھی کوئی خرچ درج نہیں۔`, 'm.bycat': `زمرے کے لحاظ سے`,
    'm.byweek': `ہفتے کے لحاظ سے <span class="meta">(نقطہ دار = حد)</span>`, 'm.byday': `دن کے لحاظ سے`, 'm.funds': `فنڈز`,
    'm.fund.over': `<b class="neg">فنڈ سے {amt} زیادہ نکل گئے</b>`, 'm.fund.ok': `<b>{amt}</b> الگ رکھے ہیں`,
    'm.targets': `فنڈ کے اہداف`, 'm.limits': `زمرے کی حدیں`, 'm.last': `<p class="meta">آخری لوڈ شدہ اعداد۔</p>`,
    'm.offline': `<p class="hint">اپنا مہینہ دیکھنے کے لیے انٹرنیٹ سے جڑیں۔ اس کے بعد یہ آپ کے فون میں محفوظ رہتا ہے۔</p>`,
    'chart.weeks': `ہفتہ وار خرچ بمقابلہ حد`, 'chart.days': `دن کے لحاظ سے خرچ`,
    't.reached': `ہدف پورا ہو گیا`, 't.passed': `ہدف کی تاریخ گزر چکی ہے`,
    't.days.one': `{days} دن باقی`, 't.days.other': `{days} دن باقی`,
    't.behind': ` &middot; ماہانہ {needed} الگ رکھیں (منصوبہ {planned})`, 't.ontrack': ` &middot; ٹھیک چل رہا ہے`,
    't.line': `{bal} میں سے ہدف {target}، تاریخ {date} &middot; {msg}`,

    'err.Invalid amount': `رقم درست نہیں`, 'err.Invalid date': `تاریخ درست نہیں`, 'err.Invalid time': `وقت درست نہیں`,
    'err.Invalid reflection': `جائزہ درست نہیں`, 'err.Entry not found': `اندراج نہیں ملا`, 'err.Not your entry': `یہ آپ کا اندراج نہیں`,
    'err.Not authorised': `اجازت نہیں`, 'err.Unknown action': `نامعلوم کارروائی`,
    'err.That code is not correct or has expired.': `یہ کوڈ درست نہیں یا اس کی مدت ختم ہو چکی ہے۔`,
    'err.Too many requests. Wait 10 minutes and try again.': `بہت زیادہ درخواستیں۔ 10 منٹ انتظار کریں اور دوبارہ کوشش کریں۔`,
    'err.Too many wrong attempts. Ask for a new code.': `بہت زیادہ غلط کوششیں۔ نیا کوڈ منگوائیں۔`,
    'err.The daily email limit was reached. Try again tomorrow.': `روزانہ ای میل کی حد پوری ہو گئی۔ کل دوبارہ کوشش کریں۔`
  };

  var UR_MONTHS = { January: 'جنوری', February: 'فروری', March: 'مارچ', April: 'اپریل', May: 'مئی', June: 'جون', July: 'جولائی',
                    August: 'اگست', September: 'ستمبر', October: 'اکتوبر', November: 'نومبر', December: 'دسمبر' };
  var UR_MON3 = { Jan: 'جنوری', Feb: 'فروری', Mar: 'مارچ', Apr: 'اپریل', May: 'مئی', Jun: 'جون', Jul: 'جولائی', Aug: 'اگست', Sep: 'ستمبر', Oct: 'اکتوبر', Nov: 'نومبر', Dec: 'دسمبر' };

  var lang = 'en';

  function has(key) { return !!(STR[lang] && STR[lang][key] !== undefined); }

  /** The text for a key in the current language (English if a translation is missing), with {placeholders} filled in. */
  function t(key, p) {
    var s = (STR[lang] && STR[lang][key] !== undefined) ? STR[lang][key] : (STR.en[key] !== undefined ? STR.en[key] : key);
    if (p) s = s.replace(/\{(\w+)\}/g, function (m, k) { return p[k] !== undefined ? p[k] : m; });
    return s;
  }
  /** One / other forms: key.one when n is 1, otherwise key.other. */
  function tn(key, n, p) { return t(key + (n === 1 ? '.one' : '.other'), Object.assign({ n: n }, p || {})); }
  /** Month and week names that come from Google in English, shown in the current language. */
  function label(s) {
    s = String(s == null ? '' : s);
    if (lang !== 'ur') return s;
    return s.replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/g, function (m) { return UR_MONTHS[m]; })
            .replace(/\b(Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g, function (m) { return UR_MON3[m]; })
            .replace(/\bWeek (\d+)/g, 'ہفتہ $1');
  }
  /** Fills every element marked data-i18n / data-i18n-html / data-i18n-ph in the page. */
  function apply() {
    var d = document;
    Array.prototype.forEach.call(d.querySelectorAll('[data-i18n]'), function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    Array.prototype.forEach.call(d.querySelectorAll('[data-i18n-html]'), function (el) { el.innerHTML = t(el.getAttribute('data-i18n-html')); });
    Array.prototype.forEach.call(d.querySelectorAll('[data-i18n-ph]'), function (el) { el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph'))); });
    d.title = t('app.title');
  }
  function setLang(l) {
    lang = STR[l] ? l : 'en';
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ur' ? 'rtl' : 'ltr';
    apply();
  }

  root.I18N = { t: t, tn: tn, has: has, label: label, apply: apply, setLang: setLang, getLang: function () { return lang; }, STR: STR };
})(window);
