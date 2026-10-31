# Kakeibo Family Expense Tracker (Android, v2.2)

A private family expense tracker built on a Google Sheet and an installable Android app. Log an expense in a few taps, even with no internet. Each phone signs in with an emailed code and a PIN, and everything lands in one shared sheet with a dashboard based on the Japanese **Kakeibo** budgeting method.

- **You own the data.** Everything is stored in your own Google Sheet.
- **No subscription, no server to rent.** Google Apps Script runs the backend and GitHub Pages hosts the app (both free).
- **Private.** Each phone signs in once with a 6-digit email code and opens behind its own PIN. There is no shared secret in any link.
- **Works offline.** Entries are saved on the phone first and sent when the connection returns.

---

## Contents

1. [Features](#features)
2. [How it works](#how-it-works)
3. [What you need](#what-you-need)
4. [Project files](#project-files)
5. [Installation, step by step](#installation-step-by-step)
6. [Upgrading from version 1](#upgrading-from-version-1)
7. [Daily use](#daily-use)
8. [Sign-in, PIN and privacy](#sign-in-pin-and-privacy)
9. [Kakeibo in this project](#kakeibo-in-this-project)
10. [The Plan, the budget banner and the dashboard](#the-plan-the-budget-banner-and-the-dashboard)
11. [Zakat and Qurbani funds](#zakat-and-qurbani-funds)
12. [Recurring expenses](#recurring-expenses)
13. [Reflection and the summary emails](#reflection-and-the-summary-emails)
14. [Offline behaviour](#offline-behaviour)
15. [Customising](#customising)
16. [Updating](#updating)
17. [Troubleshooting](#troubleshooting)
18. [Limits and known limitations](#limits-and-known-limitations)
19. [API reference](#api-reference)
20. [Testing checklist](#testing-checklist)

---

## Features

| Area | What you get |
|---|---|
| **Entry** | Amount, category, Kakeibo type, payment mode, date, time, remarks. The app remembers your last category and payment mode, and you can save **favourites** (for example "Tea, 50") as one-tap chips. |
| **History** | See your latest entries and **edit or delete** them from the app. |
| **Budget warnings** | The budget banner turns amber when you have used 80% of the week's or month's allowance (you choose the level) and red when you are over. Under the amount, a preview shows what the purchase would do before you save it. |
| **Month** | A month summary inside the app: key figures, Kakeibo split, categories, weeks, days and fund balances. |
| **Shortcuts** | Long-press the app icon for Add expense, Pay Zakat, History and Month summary. |
| **Offline** | Entries are queued on the phone and sent later, also in the background when Android allows. |
| **Sign-in** | Email code (OTP) once per phone, then a PIN each time the app opens. Phones can be revoked. |
| **Kakeibo** | Needs, Wants, Culture, Extra and Savings. A monthly household **Plan** gives a weekly allowance and a budget banner. |
| **Funds** | Zakat and Qurbani earmarked funds with a running balance, an optional **target amount and date** for each, and reminders (in the app and by email) when a fund is behind. |
| **Recurring** | Rent, subscriptions and instalments are added automatically each month. |
| **Reflect** | A weekly or monthly reflection screen with your numbers and three Kakeibo questions, saved to the sheet. |
| **Emails** | A weekly summary (Sunday evening) and a monthly summary (the 1st). |
| **Dashboard** | Totals, charts by category, person, payment mode, day and week, Kakeibo split, funds, latest expenses. |

## How it works

```
 Android phone (installed web app)             Google
 ┌─────────────────────────────┐        ┌───────────────────────────────┐
 │ index.html, app.js, core.js │  POST  │ Apps Script web app (Code.gs) │
 │ PIN lock, queue on the phone├───────>│ checks the phone's token,     │
 │ (IndexedDB)                 │<───────┤ validates, writes to the sheet│
 │ sw.js: offline + background │        │                               │
 │ sync                        │        │ Google Sheet                  │
 └─────────────────────────────┘        │ Expenses / Settings / Plan /  │
   hosted on GitHub Pages               │ Funds / Recurring / Reflections│
   (code only, no data)                 │ Devices / Audit / Dashboard   │
                                        └───────────────────────────────┘
```

1. You save an expense. It is stored on the phone immediately.
2. The app sends it to your Apps Script web address, with the phone's private token. If there is no connection, it waits in the queue.
3. The script checks the token, finds out which person the phone belongs to, and writes one row to `Expenses`.
4. The script replies with your updated budget, which the app shows.

## What you need

| Item | Notes |
|---|---|
| A **personal Google account** (Gmail) | Owns the sheet and sends the code and summary emails. Some work or school accounts block the "Anyone" access this project needs. |
| A **GitHub account** (free) | Hosts the app files with GitHub Pages. Free Pages needs a public repository. |
| An **Android phone with Chrome** | For every family member. |
| An **email address for each person** | The sign-in code is sent there. |
| A computer | For the one-time setup. |

## Project files

```
Code.gs                    Google Apps Script backend (paste into your Sheet)
offline-app/
  index.html               The Android app page
  app.js                   App logic: sign-in, PIN, Add / History / Reflect
  core.js                  Phone storage and syncing, shared with the service worker
  sw.js                    Service worker: offline support + background sync
  manifest.webmanifest     Makes the app installable (with home-screen shortcuts)
  icon-192.png, icon-512.png
README.md                  This file
```

`offline-app.zip` contains the seven files inside `offline-app/`.

### What the sheet contains

| Tab | Purpose |
|---|---|
| `Expenses` | One row per expense: Date, Month, Time, Category, Amount, Payment Mode, Remarks, Device Name, Person, ID, Kakeibo Type |
| `Settings` | Summary email (B2), currency (B3), budget warning level (B4), categories with Kakeibo type and fixed flag, people with emails, payment modes, fund links and fund targets |
| `Plan` | One row per month: income, planned fixed costs, savings goal, Zakat and Qurbani set-asides |
| `Funds` | Monthly Zakat and Qurbani ledger |
| `Recurring` | Expenses added automatically every month |
| `Reflections` | The reflections written in the app, with the numbers of that period |
| `Devices` | Phones that have signed in. Set Status to `Revoked` to block one |
| `Audit` | Log of device sign-ins, edits and deletes |
| `Dashboard` | Formulas and charts, rebuilt by `buildDashboard()` |

---

## Installation, step by step

Allow about 40 minutes the first time.

### Part 1. Create the sheet and the backend

1. Go to **sheets.new** while signed in to your personal Google account. Name it, for example "Family Expenses".
2. Check the time zone: **File > Settings > Time zone**. Choose your local one. All dates use it.
3. Open **Extensions > Apps Script**.
4. Delete the default code, paste in the full contents of `Code.gs`, and save (Ctrl+S).
5. In Apps Script open **Project Settings** (gear icon) and set the **time zone** to your local one too. It controls when the scheduled emails and recurring expenses run.
6. In the function dropdown choose **setup** and click **Run**.
7. Google asks for permission. Click **Review permissions**, choose your account, then **Advanced > Go to (project name) (unsafe) > Allow**. This warning is normal for your own scripts. The permissions are: use this spreadsheet, send email as you (for sign-in codes and summaries), and run on a schedule.
8. When it finishes, the sheet has the tabs `Expenses`, `Settings`, `Plan`, `Funds`, `Recurring`, `Reflections`, `Devices`, `Audit` and `Dashboard`.

### Part 2. Fill in your details

1. **Settings tab**
   - Column **H**: replace `Person 1`, `Person 2`, `Person 3` with real names.
   - Column **I**: enter each person's **email address**. A person without an email cannot sign in.
   - **B2**: the email address(es) that receive the weekly and monthly summaries (several can be separated by commas).
   - **B3**: the currency label (default `PKR`).
   - **B4**: the budget warning level, as a percentage of the allowance used (default `80`, allowed 50 to 99).
   - **N and O** (rows 2 and 3, next to Zakat and Qurbani): an optional **target amount** and **target date** for each fund. See [Fund targets and reminders](#fund-targets-and-reminders).
   - Columns D to F: review the categories, their Kakeibo type and the fixed-cost flag.
2. **Plan tab** (yellow cells): this month's **Income**, **Fixed costs (planned)**, **Savings goal**, and the **Zakat** and **Qurbani** set-asides. Plain numbers only.
3. **Funds tab** (optional): opening balances in **B2** and **C2**.
4. Run **testInsert** in Apps Script and check that a test row appears in `Expenses`. Delete that row afterwards.
5. Run **sendTestEmail** and check that the email arrives. If it does not, see [Troubleshooting](#troubleshooting).

### Part 3. Publish the backend as a web app

1. **Deploy > New deployment**, click the gear icon, choose **Web app**.
2. Set **Execute as: Me** and **Who has access: Anyone**, then click **Deploy**.
3. Copy the **Web app URL** (it ends in `/exec`).
4. Check it: open `YOUR_WEB_APP_URL?ping=1` in a browser. You should see `{"ok":true,"message":"Expense tracker is running"}`.

> "Anyone" only means anyone can reach the address. Every other request needs a phone token that exists only after an email code, and nothing returns your expenses to someone without one.

### Part 4. Host the app on GitHub Pages

1. On **github.com** click **+ > New repository**. Name it (for example `kakeibo-tracker`), choose **Public**, and create it.
2. Unzip `offline-app.zip`. In the empty repository click **uploading an existing file** and drag in the **seven files** themselves (not the zip and not a folder): `index.html`, `app.js`, `core.js`, `sw.js`, `manifest.webmanifest`, `icon-192.png`, `icon-512.png`. Click **Commit changes**. `index.html` must be at the top level.
3. Open **Settings > Pages**. Under "Build and deployment" choose **Deploy from a branch**, branch **main**, folder **/(root)**, and click **Save**.
4. After a minute or two the page shows your address, such as `https://yourname.github.io/kakeibo-tracker/`. Open it: you should see the "First-time setup" screen.

The repository holds only code. It has no keys and no data.

### Part 5. Connect the app and schedule the emails

1. In `Code.gs`, set `PWA_URL` near the top:
   ```js
   const PWA_URL = 'https://yourname.github.io/kakeibo-tracker/';
   ```
2. Save, then update the live script **without changing the address**: **Deploy > Manage deployments > pencil icon > Version: New version > Deploy**. Do not choose "New deployment".
3. Run **showLinks**. The Execution log prints one link per person. It also warns about anyone without an email. The links look like:
   ```
   https://yourname.github.io/kakeibo-tracker/?api=...&person=Ali
   ```
   They contain no secret, only the script address and the person's name.
4. Run **installTriggers** once. It schedules the recurring expenses (daily, about 6am), the fund reminders (daily, about 7am), the weekly summary (Sunday, about 8pm) and the monthly summary (the 1st, about 8am).
5. Send each person their link.

### Part 6. Sign in on each Android phone

1. Open the link in **Chrome**. The app asks you to sign in.
2. Tap **Email me a code**. Open the email, then type the 6-digit code into the app.
3. Choose a **PIN** of 4 to 6 digits.
4. The app opens. Save a small test expense and check it appears in the sheet.
5. Install it: tap **Install app** at the bottom, or Chrome menu (⋮) > **Install app** / **Add to Home screen**. From now on, open the app from its icon.

---

## Upgrading from version 1

1. Paste the new `Code.gs`, save, and run **setup** (it is safe to re-run). It adds the new tabs and an Email column for people, and replaces the old secret key row with the summary-email row.
2. Enter each person's email in `Settings` column I, and the summary email in B2.
3. **Deploy > Manage deployments > pencil > New version > Deploy**, then run **installTriggers**.
4. Upload the seven new app files to GitHub, replacing the old ones.
5. On each phone open the app: it asks for an email code and a PIN. Entries that were waiting are kept and sent after signing in.
6. The old secret key no longer exists, so old links with `key=...` are harmless: the app ignores it.

---

### From version 2 to 2.1

1. Paste the new `Code.gs`, save, and run **setup** (safe to re-run). It adds the warning level to `Settings!B4`.
2. **Deploy > Manage deployments > pencil > New version > Deploy.**
3. Upload the changed app files to GitHub, replacing the old ones: `index.html`, `app.js`, `core.js`, `sw.js` and `manifest.webmanifest`.
4. Open the app online on each phone. The warnings and the Month tab appear after the app updates. The new shortcuts follow when Android refreshes the installed app, or after you reinstall it.

### From version 2.1 to 2.2

1. Paste the new `Code.gs`, save, and run **setup** (safe to re-run). It adds the target columns (N, O, P) to `Settings`.
2. Run **installTriggers** again so the new daily fund reminder is scheduled. It replaces the old triggers and does not duplicate them.
3. **Deploy > Manage deployments > pencil > New version > Deploy.**
4. Upload `index.html`, `app.js` and `sw.js` to GitHub, replacing the old ones.
5. Enter a target amount and date for Zakat and/or Qurbani in `Settings` columns N and O.

---

## Daily use

The app has four tabs: **Add**, **History**, **Month** and **Reflect**.

### Add

1. Tap the amount and type it. Pick a **category**: the **Kakeibo type** fills in automatically (you can change it for one entry).
2. Choose the **payment mode**. Date and time default to now and can be changed to backdate. Add **remarks** if you like.
3. Tap **Save Record**.

The app starts with your **last category and payment mode** selected.

**Favourites:** fill in the form (for example "Tea", Food & Dining, Cash, 50), tap **Save as favourite** and name it. It appears as a chip at the top of the Add tab. Tapping the chip fills the form, so you only confirm and save. Delete favourites under **Manage favourites** at the bottom. Favourites are stored on that phone only.

### History: edit and delete

The **History** tab lists your latest entries (up to 40), including ones still waiting to sync.

- **Edit** loads the entry into the form. Change anything and tap **Save changes**.
- **Delete** removes it after a confirmation.
- Changing or deleting an entry that is **already in the sheet needs internet**. Entries still waiting on the phone can be edited or deleted offline.
- You can only change your own entries. Every edit and delete is recorded in the `Audit` tab.
- Rows without an ID (typed into the sheet by hand, or saved before version 2) do not appear. Correct those in the sheet.

### Budget warnings

The banner at the top of the Add tab shows the week and month remaining. It changes colour so you notice without reading numbers:

| Colour | Meaning |
|---|---|
| Normal | Less than your warning level of the allowance is used (80% unless you changed `Settings!B4`) |
| **Amber** | The warning level is reached, for example "83% of this week's allowance used" |
| **Red** | You are over the allowance, for example "Over this week's allowance" |

The week and the month are checked separately, so you may see a warning for one and not the other.

- **Before you save:** as soon as you type an amount, a line under it says "After this: week PKR 6,000 left, month PKR 34,000 left". It turns amber or red if saving would reach the warning level or go over. It does not appear for fixed costs or Savings entries, because those do not count against the allowance.
- **After you save:** the same warning is repeated under the button.
- **Offline:** the figures are estimates built from the last known budget minus entries not yet synced, and the banner says so.
- The preview is a nudge, not a block: you can still save.

### Month

The **Month** tab is a summary of the whole month without opening the sheet. Choose **This month**, **Last month** or **2 months ago**:

- **Key figures:** spent, allowance and what is left (or by how much you are over), a meter showing the percentage of the allowance used, the average per day, and how this month compares with the one before.
- **Kakeibo split:** Needs, Wants, Culture and Extra as a bar, with amounts and percentages.
- **By category:** your biggest categories.
- **By week:** spending for each week block against its allowance (the dashed outline). A bar turns red when the week went over.
- **By day:** a small chart of daily spending, with today highlighted.
- **Funds:** the Zakat and Qurbani balances (red if overdrawn). In the **This month** view, funds that have a target also show a progress bar, the days to go, and how much to set aside each month.
- Fixed costs paid and savings or funds paid are shown as separate lines, because they do not count against the allowance.

The numbers are kept on the phone, so a month you have already opened still shows offline, marked "Last loaded numbers".

### Home-screen shortcuts

After installing, touch and hold the app icon on the home screen to see up to four shortcuts:

| Shortcut | Opens |
|---|---|
| **Add expense** | The Add tab |
| **Pay Zakat** | The Add tab with the Zakat category already chosen |
| **History** | Your latest entries |
| **Month summary** | The Month tab |

The app still asks for the PIN first, then goes straight to the screen you picked. Android shows at most four shortcuts. The Reflect tab opens from the link in the weekly summary email, and `#qurbani` works the same way as Zakat if you add a link to it yourself. A shortcut can take up to a day to appear after an update, because Android refreshes an installed app's shortcuts on its own schedule. Reinstalling the app makes it immediate.

### Status messages

| Message | Meaning |
|---|---|
| Saved on this phone ✓ | Stored locally, sending now. |
| Synced to your sheet ✓ | The row is in the sheet. |
| Saved on this phone: N waiting to sync | No connection or a temporary problem. It will retry. |
| N entry needs attention | Google rejected an entry (for example a bad amount). Open the waiting list to Retry or Delete. |
| Offline chip (orange) | No connection. You can still save entries. |

The **budget banner** shows the week and month remaining. Offline it shows the last known figures minus entries not yet synced, labelled as an estimate.

---

## Sign-in, PIN and privacy

### How a phone signs in

1. The person opens their link. The app asks Google to email a code. Google sends it **only** to the address saved for that person in `Settings` column I. Nobody can send a code to an address they typed in.
2. The person enters the code. Google replies with a long random **token** for that phone. Only a hash of the token is saved in the `Devices` tab.
3. Every later request carries the token. Google works out who the person is from the token, so a phone cannot save entries as someone else.

Limits: a code is valid for 10 minutes, five wrong tries cancel it, and a person can request three codes per 10 minutes. The reply never reveals whether a name exists. Gmail allows about 100 emails per day for a personal account, which is far above what a family needs.

### The PIN

- The app asks for the PIN every time it opens, and again after about a minute in the background. **Lock now** (bottom of the app) locks it immediately.
- Five wrong tries make you wait 30 seconds. Ten wrong tries sign the phone out, so a new email code is needed. Unsent entries are kept.
- **Forgot PIN?** sends an email code and lets you set a new PIN.
- The PIN is stored only as a salted hash on the phone.

> The PIN is a convenience lock on top of your phone's screen lock. It stops someone casually opening the app on an unlocked phone. It is not protection against a determined attacker who has full control of the device, so keep Android's own screen lock on.

### Managing phones

- The `Devices` tab lists every phone that signed in, with the person, label, and last-used time.
- **To block a lost phone:** set its **Status** to `Revoked`. It stops working immediately and must sign in again with a new email code to come back.
- If a person's email account itself is at risk, remove or change their email in `Settings` column I.
- The `Audit` tab records sign-ins, edits and deletes.

### What is stored where

- **Your data** lives only in your Google Sheet. GitHub hosts code only.
- The script runs as **you** and is limited to this spreadsheet.
- Anyone with edit access to the sheet can see all data, including income on the `Plan` tab.
- **Reset this app** (bottom of the app) wipes the app's data from that phone.

---

## Kakeibo in this project

Kakeibo asks four questions every month: how much comes in, how much you want to save, how much you spend, and how you can improve. Spending is sorted into types. A quick test: *"Could I skip this for a month without real harm?"* and *"Did I see it coming?"*

| Type | Meaning | Examples |
|---|---|---|
| **Needs** | Things you cannot reasonably go without, or must pay | Groceries, rent, utilities, transport to work, medicine, school fees, insurance |
| **Wants** | Comfort and enjoyment that could wait | Restaurants, extra clothes, gadgets, trips, gifts |
| **Culture** | Feeds your mind, skills or spirit | Books, courses, cinema, hobby supplies, classes |
| **Extra** | Unexpected or irregular costs | Emergency repair, unplanned medical bill, fines |
| **Savings** | Money put aside, not spent | Investments, Zakat and Qurbani funds |

A growing **Extra** slice usually means your plan is missing something, such as an emergency fund or yearly costs not spread across the months.

### Default categories

| Category | Type | Fixed cost? |
|---|---|---|
| Groceries 🛒 | Needs | No |
| Food & Dining 🍔 | Wants | No |
| Transportation 🚗 | Needs | No |
| Entertainment 🎬 | Culture | No |
| Health & Medical 💊 | Needs | No |
| Shopping 🛍️ | Wants | No |
| Recharge & Subscriptions 📱 | Needs | No |
| Rent & Bills 🏠 | Needs | **Yes** |
| Travel ✈️ | Wants | No |
| Gifts 🎁 | Wants | No |
| Education 📚 | Culture | No |
| Insurance 🛡️ | Needs | **Yes** |
| Zakat 🤲 | Savings | No |
| Qurbani 🐐 | Savings | No |
| Investment 📈 | Savings | No |
| Other 📦 | Extra | No |

You decide the type: change a category's type in `Settings`, or override it on a single entry in the app.

---

## The Plan, the budget banner and the dashboard

### The Plan tab

One row per month. Type the **first day of the month** in column A, then fill the yellow cells:

| Column | What to enter |
|---|---|
| Income | Total household income expected this month |
| Fixed costs (planned) | Bills you must pay every month, added up |
| Savings goal | What you set aside first (includes the Zakat and Qurbani set-asides) |
| Zakat / Qurbani set-aside | The part of the savings goal reserved for each fund |

The sheet calculates **Free to spend** = Income - Fixed costs - Savings goal, a **weekly allowance** (free to spend / days in the month x 7), and a **daily allowance**.

A month without its own row uses the most recent row above it, so add a row only when something changes. Use plain numbers (no currency symbol or commas).

### What counts against the allowance

- Counted: ordinary (flexible) spending.
- **Not counted:** categories marked **Fixed cost? = Yes** (tracked against the planned fixed costs) and any entry whose type is **Savings**.

If you put school fees or instalments in the planned fixed costs, mark their category as fixed too. Otherwise they are subtracted in the plan and counted again against the weekly allowance. Weeks are blocks of days: 1-7, 8-14, 15-21, 22-28 and 29 to the end of the month (the last block is prorated).

### The Dashboard

Type the first day of any month into **Dashboard!B3** to view that month (it defaults to the current month).

- **Summary:** total spent, transactions, daily average, top category, fixed costs paid, invested/saved
- **Household budget:** income, fixed costs, savings goal, free to spend, flexible spent, remaining (red when over), saved so far
- **Tables and charts:** by category, Kakeibo split, weekly spending vs allowance, by person, by payment mode, daily spending
- **Earmarked funds** and the **latest 10 expenses**

If the dashboard looks wrong after a change, run `buildDashboard()`. It only rebuilds that tab.

---

## Zakat and Qurbani funds

These are savings built up over months and paid out later, so they are **earmarked funds**:

1. **Set aside (automatic):** enter the monthly amounts on the `Plan` tab. They count as part of your savings goal and accrue in the `Funds` ledger. You do not log them in the app.
2. **Pay out (in the app):** log the payment under **Zakat 🤲** or **Qurbani 🐐**. These categories are type **Savings**, so a payment does not reduce your monthly budget.
3. **Balance:** `Funds` shows set-aside minus paid. The app shows the balance after each payment, and it turns red if you pay more than you have set aside.

Zakat can be paid in portions: each payment lowers the balance. Qurbani is usually one payment around Eid-ul-Adha. Eid moves about ten days earlier each year, so plan the monthly amount for the month you expect to pay.

> The tracker only records and totals. It does **not** calculate how much Zakat is due, which depends on your wealth on your Zakat date. Use a scholar or a trusted calculator. The set-aside is a plan, not a bank transfer.

### Fund targets and reminders

A target turns a fund from "money I have set aside" into "money I need by a date". Both are optional.

**Setting a target.** In `Settings`, next to each fund (Zakat is row 2, Qurbani is row 3):

| Column | Enter |
|---|---|
| **N: Target amount** | How much the fund should hold, for example `60000` |
| **O: Target date** | When you need it, for example the date you expect Eid-ul-Adha, or your Zakat date |
| **P: Last reminder** | Filled in by the script. Do not edit |

The target is compared with the fund's **balance**. If you pay part of it early (for example Zakat in portions), the balance falls, so lower the target by the amount you paid, or set a new one.

**What the app works out.**

| Status | Meaning |
|---|---|
| **On track** | Your plan's monthly set-aside, carried to the target date, reaches the target |
| **Behind** | It would fall short. The app shows how much to set aside **each month from now** instead, next to what the Plan tab sets aside today |
| **Reached** | The balance is already at or above the target |
| **Overdue** | The date passed in the last 30 days and the target was not reached |
| **Past** | The date passed more than 30 days ago. Nothing more is shown, so set a new date when you are ready |

"Months left" counts from this month to the month of the target date, and the amount needed each month is the remaining amount divided by that number (rounded up). If the target date is in the current month, the whole remainder is needed now.

**Where you see it.**

- **Add tab:** a banner appears only when a fund needs attention: behind and within 90 days (amber, red from 30 days), on track but within the last week ("have it ready"), or the date has just passed (red). **Hide for today** hides it until tomorrow.
- **Month tab (This month):** every fund with a target shows a progress bar, the amounts, the days to go and the monthly amount needed.
- **Weekly and monthly emails:** a "Fund targets" section.
- **Reminder emails:** once a day (about 7am) the script checks each fund and emails the summary address at **90, 30 and 7 days** before the target date, and **on the day**. Behind funds get all four. A fund that is on track is only mentioned at 7 days and on the day. Nothing is sent once the target is reached, and nothing is repeated: the last reminder sent is noted in column P. If you change the target date, reminders start again for the new date.
- **Dashboard:** the Earmarked funds block gains Target, Target date and Needed / month columns.

Reminder emails need `installTriggers` to have been run, and an address in `Settings!B2`. If B2 is empty nothing is sent and nothing is recorded, so the reminders start as soon as you add an address.

---

## Recurring expenses

For bills that repeat every month, use the **Recurring** tab. It starts with one example row (rent) switched off.

| Column | Meaning |
|---|---|
| Name | Used as the remarks if you leave Remarks empty |
| Amount | The monthly amount |
| Category / Payment mode | Pick from the lists |
| Person | Whose entry it is (a person from `Settings`) |
| Day of month | 1 to 31. Day 31 in a shorter month means the last day |
| Start month / End month | When it begins, and optionally when it stops |
| Active | `Yes` to switch it on |
| Last added | Filled in by the script. Do not edit |

Every morning (about 6am) the script adds this month's entry once its day has come. If the script missed a day, it catches up the next time, and the entry is dated on its due day. An entry is never added twice. Recurring entries appear in the person's History and can be edited there like any other. They need `installTriggers` to have been run.

---

## Reflection and the summary emails

### Reflect tab

Kakeibo is about looking back. Choose **This week**, **Last week**, **This month** or **Last month**. The app shows your numbers for that period: spent against allowance, the Needs/Wants/Culture/Extra split, top categories, the change from the previous period, and for months the amount left after spending against your goal.

Then answer three short questions (different for weeks and months) and tap **Save reflection**. It goes to the `Reflections` tab with the numbers of that period. It works offline: it is saved on the phone and sent later.

### Summary emails

- **Weekly:** Sunday around 8pm. This week's spending against the allowance, the month so far, top categories, fund balances and targets, and a link to open the app.
- **Monthly:** the 1st around 8am, covering the month that just ended, with the amount left after spending against your goal.

They go to the address in `Settings!B2`. Run `installTriggers` once to schedule them, and `sendTestEmail` to check that email works.

---

## Offline behaviour

- The app opens with no internet from a saved copy, using the lists from the last time it was online. After the first sign-in it needs internet only to sync, to load History and Reflect numbers, and to change entries already in the sheet.
- Saving works offline. Each entry keeps the date and time you made it, even if it syncs hours later.
- Waiting entries are sent: when the app opens, when the connection returns, every 30 seconds while the app is open, on **Sync now**, and by Android in the background (Chrome Background Sync) even if the app is closed.
- Each entry has a unique ID, so retries never create duplicates.
- Entries Google rejects permanently (bad amount, date, time) are flagged and can be corrected or deleted. Temporary server problems keep the entry queued.
- If a phone is signed out (revoked, or too many wrong PINs), unsent entries stay safe and go through after signing in again.
- The first use needs internet, to sign in and to load your categories.

---

## Customising

| To change | Do this |
|---|---|
| Categories, types, fixed flag | `Settings` columns D, E, F. They appear in the app the next time it is online. The dashboard shows the first 20 categories. |
| People and emails | `Settings` columns H and I. Run `showLinks()` for new links |
| Summary email | `Settings!B2` |
| Payment modes | `Settings` column J (the dashboard shows the first 8) |
| Currency label | `Settings!B3`, then run `buildDashboard()` |
| Budget warning level | `Settings!B4` (percentage of the allowance used, 50 to 99, default 80) |
| Home-screen shortcuts | `shortcuts` in `manifest.webmanifest` (Android shows at most four) |
| Funds | `Settings` columns L:M link a fund name to its category |
| Fund targets | `Settings` columns N (amount) and O (date), next to each fund. The reminder days (90, 30, 7 and 0) are `FUND_MILESTONES` in `Code.gs` |
| Plan months | Add rows to `Plan` (up to 36 months) |
| When emails and recurring run | Edit the hours in `installTriggers()` and run it again |
| How long until the PIN is asked again | `LOCK_SECONDS` at the top of `Code.gs` |

---

## Updating

**Backend (`Code.gs`):** paste the new code, save, then **Deploy > Manage deployments > pencil > New version > Deploy**. If the dashboard changed, run `buildDashboard()`. If new tabs or columns were added, run `setup()` again (safe to re-run).

**App files (GitHub):** upload the changed files to your repository (**Add file > Upload files**), replacing the old ones. If you changed any app file, also raise the version in `sw.js` (`expense-app-v6` becomes `v7`) so phones fetch the new copy. Each phone updates the next time you open the app with internet. Close and reopen the app once more if the old version still shows.

---

## Troubleshooting

| Problem or message | Cause and fix |
|---|---|
| **"Google hasn't verified this app"** while running a function | Normal for your own script. Click **Advanced > Go to (project) (unsafe) > Allow**. |
| **No code email arrives** | Check the spam folder. Check the person's email in `Settings` column I. Run `sendTestEmail` to confirm sending works and that you approved the email permission. |
| **"That code is not correct or has expired"** | Codes last 10 minutes and work once. Request a new one. |
| **"Too many requests"** | Three codes per 10 minutes is the limit. Wait and try again. |
| **"Too many wrong attempts. Ask for a new code."** | Five wrong tries cancel a code. Request a new one. |
| **"This phone needs to sign in again"** | The phone was revoked, or signed out after wrong PINs. Request an email code. Unsent entries are kept. |
| **"Google sent a web page instead of data"** | The live script is an old version. **Deploy > Manage deployments > pencil > New version > Deploy**, and set access to **Anyone**. |
| **"Could not reach your Google script"** | The link is wrong (it must end in `/exec`) or access is not set to Anyone. Test `YOUR_URL?ping=1` in a browser. |
| Entries stay "waiting to sync" | Open the app with internet and tap **Sync now**. Read the status line for the reason. |
| **"Not saved: Invalid amount / date / time"** | The entry was rejected. Delete it from the waiting list and enter it again. |
| **"Connect to the internet to change saved entries"** | Editing or deleting an entry already in the sheet needs a connection. |
| **"Not your entry"** | You can only change your own entries. |
| No amber or red warning | The `Plan` tab needs income for the month, since the allowance comes from it. The warning level is `Settings!B4`. |
| The Month tab says "Connect to the internet" | That month has not been opened online yet. Open it once with internet and it is kept. |
| The long-press shortcuts are missing or old | Android refreshes them on its own schedule (up to a day). Reinstalling the app updates them at once. Only four are shown. |
| No fund reminder emails | Both a target amount and a target date are needed, the fund must not be reached or long past, an address must be in `Settings!B2`, and `installTriggers` must have been run. An on-track fund is only emailed in its last week. |
| A fund shows "behind" although I have paid part of it | The target is compared with the balance. Lower the target by what you paid, or set a new one. |
| The fund banner keeps coming back | **Hide for today** hides it for one day. Clear the target in `Settings` (or set the next date) to stop it. |
| An entry is missing from History | Only your own entries with an ID appear, and only the latest 40. |
| No budget banner | The `Plan` tab has no income for the current month. |
| Recurring expense was not added | `Active` must be `Yes`, the start month must have begun, and `installTriggers` must have been run. Check the day of month. |
| No weekly email | Run `installTriggers`, check `Settings!B2`, and check the script's time zone in **Project Settings**. |
| `#NAME?` or blank cells on the dashboard | Run `buildDashboard()`. |
| Wrong day on some entries | Set the spreadsheet time zone (**File > Settings**). |
| GitHub page shows 404 | The files are inside a folder. `index.html` must be at the top level of the repository. |
| "Install app" is not offered | Use Chrome, open the hosted address, and use the ⋮ menu > **Install app** or **Add to Home screen**. |
| App does not show new changes | Raise the `CACHE` version in `sw.js`, upload it, then open the app online and reopen it once. |

---

## Limits and known limitations

| Item | Limit |
|---|---|
| Platform | Android with Chrome. iPhone is not supported by this version. |
| Dashboard category rows | 20 |
| People on the dashboard | 8 (sign-in works for up to 19 names) |
| Payment modes on the dashboard | 8 |
| Funds | 2 (Zakat and Qurbani) |
| Plan months | 36 rows; the `Funds` ledger covers 36 months from the first Plan month |
| History | Your latest 40 entries that have an ID |
| Recurring rows | up to 199 |
| Emails | About 100 per day on a personal Google account |

Other things to know:

- **One-way sync.** Phones send entries to the sheet. The app does not show other people's expenses, only the household budget figures.
- **Background sync** depends on Android and Chrome. Battery savers can delay it. Opening the app always syncs.
- **The PIN is a convenience lock**, not a defence against someone with full control of the phone (see [Sign-in, PIN and privacy](#sign-in-pin-and-privacy)).
- **Editing the sheet by hand is fine** (change or delete rows), and the Plan, Funds and dashboard update automatically. Rows typed by hand have no ID, so they cannot be edited from the app.
- The app depends on Google allowing a web page to read your script's reply. If a browser change ever blocks it, the app shows "Could not reach your Google script".
- Deleting or renaming the tabs breaks the script. Run `setup()` to recreate missing ones.

---

## API reference

For developers. Everything except the health check is a `POST` to the `/exec` address with a JSON body sent as `text/plain` (this avoids a browser pre-check that Google does not answer). Include `"action"` and, after sign-in, `"token"`.

**Health check:** `GET <exec>?ping=1` returns `{"ok":true,"message":"Expense tracker is running"}`.

| action | token needed | Fields | Reply |
|---|---|---|---|
| `otp_request` | no | `person` | `{"ok":true}` (the same reply whether or not the person exists) |
| `otp_verify` | no | `person`, `code`, `deviceId`, `label` | `{"ok":true,"token":"...","person":"Ali"}` |
| `config` | yes | none | currency, categories, types, fixed list, payments, `funds`, `fundTargets`, `warnAt`, `lockSeconds`, `budget` (including `weekAllowance`) |
| `save` (default) | yes | `amount`, `category`, `type`, `payment`, `remarks`, `device`, `date`, `time`, `id` | `{"ok":true,"type":...,"fixed":...,"saving":...,"fund":...,"budget":{...}}` |
| `recent` | yes | none | `{"ok":true,"entries":[...]}` (own entries) |
| `update` | yes | `id` plus the `save` fields | `{"ok":true,"budget":{...}}` |
| `delete` | yes | `id` | `{"ok":true,"budget":{...}}` |
| `summary` | yes | `period` (`week` or `month`), `date`, optional `detail: true` | `{"ok":true,"stats":{...},"prev":{...}}`. With `detail`, `stats` also has `byCategory`, `daily` and (for months) `weeks`, and the reply includes fund balances in `funds` and the fund targets in `targets`. |
| `reflect` | yes | `kind` (`Weekly`/`Monthly`), `date`, `q1`, `q2`, `q3`, `id` | `{"ok":true}` |

- `date` accepts `YYYY-MM-DD` or `DD/MM/YYYY`; `time` is `HH:mm`. Both default to now.
- The person on an entry always comes from the token, never from the request.
- Category and payment names match ignoring case, emoji and punctuation. Unknown values become "Other".
- An `id` already saved returns `{"ok":true,"duplicate":true}` without a new row.
- Errors return `{"ok":false,"error":"..."}`: for example `Not authorised`, `Invalid amount`, `Invalid date`, `Invalid time`, `Entry not found`, `Not your entry`.

---

## Testing checklist

After installing, check each of these once:

- [ ] `?ping=1` shows `{"ok":true,...}` and `sendTestEmail` delivers an email
- [ ] A personal link opens the sign-in screen, the emailed code works, and the PIN screen follows
- [ ] A saved expense appears in `Expenses` with the right date, category, type and person
- [ ] Airplane mode: save an expense, see "Saved on this phone". Turn it off: it syncs and the row appears
- [ ] Closing the app while an entry is waiting, then reopening, still sends it
- [ ] Reopening the app asks for the PIN; a wrong PIN is refused
- [ ] History: edit an entry's amount, then delete a test entry. Both show in the sheet, and in the `Audit` tab
- [ ] The budget banner shows figures (after filling in the `Plan`)
- [ ] A favourite saves and fills the form when tapped
- [ ] Budget warnings: with the week close to its allowance the banner turns amber, and a large amount shows an amber or red line under the amount field
- [ ] The Month tab shows figures, the Kakeibo split and charts, and still shows a month you opened before when you go offline
- [ ] Touch and hold the app icon: the Pay Zakat shortcut opens the form with the Zakat category chosen
- [ ] Set a Qurbani target and date in `Settings`: the Month tab shows its progress and the monthly amount needed
- [ ] Set the target date about 20 days away with a low balance: the Add tab shows a red fund banner, and running `checkFundReminders` sends an email once (and not a second time)
- [ ] A Zakat or Qurbani payment shows the fund balance and does not change the weekly figure
- [ ] Reflect shows numbers and a saved reflection appears on the `Reflections` tab
- [ ] A Recurring row set to Active: run `runRecurring` once and the entry appears
- [ ] Set a phone's Status to `Revoked` in `Devices`: it asks to sign in again, and recovers with a new code
- [ ] A second family member's phone saves entries under their own name
