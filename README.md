# Kakeibo Family Expense Tracker (Android)

A private, family expense tracker built on a Google Sheet and an installable Android app. Log an expense in a few taps, even with no internet, and it syncs to one shared sheet with a dashboard based on the Japanese **Kakeibo** budgeting method.

- **You own the data.** Everything is stored in your own Google Sheet.
- **No subscription, no server to rent.** Google Apps Script runs the backend, GitHub Pages hosts the app (both free).
- **Works offline.** Entries are saved on the phone first and sent to the sheet when the connection returns.
- **One family, one sheet.** Each person uses their own phone and personal link.

---

## Contents

1. [Features](#features)
2. [How it works](#how-it-works)
3. [What you need](#what-you-need)
4. [Project files](#project-files)
5. [Installation, step by step](#installation-step-by-step)
6. [Daily use](#daily-use)
7. [Kakeibo in this project](#kakeibo-in-this-project)
8. [The Plan, the budget banner and the dashboard](#the-plan-the-budget-banner-and-the-dashboard)
9. [Zakat and Qurbani funds](#zakat-and-qurbani-funds)
10. [Offline behaviour](#offline-behaviour)
11. [Customising](#customising)
12. [Updating](#updating)
13. [Security and privacy](#security-and-privacy)
14. [Troubleshooting](#troubleshooting)
15. [Limits and known limitations](#limits-and-known-limitations)
16. [API reference](#api-reference)
17. [Testing checklist](#testing-checklist)

---

## Features

- Fast entry form: amount, category, Kakeibo type, payment mode, date, time, remarks, device
- Offline queue with automatic and background sync (Android Chrome)
- Kakeibo types: **Needs, Wants, Culture, Extra, Savings**
- Monthly household **Plan**: income, fixed costs, savings goal
- Budget banner in the app: "Week 4: PKR 7,000 left, Month: PKR 35,000 left"
- Fixed costs (rent, insurance) tracked separately from the weekly allowance
- **Zakat** and **Qurbani** earmarked funds with a running balance
- Dashboard: totals, category, person, payment mode, daily and weekly charts, Kakeibo split, funds, latest expenses
- Pakistan-friendly payment modes: Cash, Debit Card, Credit Card, Bank Transfer, Raast, Easypaisa, JazzCash
- Duplicate protection: a retried entry is never saved twice

## How it works

```
 Android phone (installed web app)             Google
 ┌─────────────────────────────┐        ┌──────────────────────────┐
 │ index.html + core.js        │  POST  │ Apps Script web app      │
 │ saves entry on the phone    ├───────>│ (Code.gs) checks key,    │
 │ (IndexedDB queue)           │        │ validates, writes a row  │
 │                             │  GET   │                          │
 │ loads categories + budget   │<───────┤ Google Sheet             │
 │ sw.js: offline + background │        │ Expenses / Settings /    │
 │ sync                        │        │ Plan / Funds / Dashboard │
 └─────────────────────────────┘        └──────────────────────────┘
        hosted on GitHub Pages            runs under your account
        (code only, no data)
```

1. You save an expense. It is stored on the phone immediately.
2. The app sends it to your Apps Script web address. If there is no connection, it waits in the queue.
3. When the connection returns, the app (or Android in the background) sends it. The script writes one row to the `Expenses` tab.
4. The script replies with your updated budget, which the app shows.

## What you need

| Item | Notes |
|---|---|
| A **personal Google account** (Gmail) | Owns the sheet. Some work or school accounts block the "Anyone" access this project needs. |
| A **GitHub account** (free) | Hosts the app files with GitHub Pages. Free Pages needs a public repository. |
| An **Android phone with Chrome** | Each family member. Chrome is needed for install and background sync. |
| A computer | For the one-time setup. It is possible on a phone but slow. |

## Project files

```
Code.gs                    Google Apps Script backend (paste into your Sheet)
offline-app/
  index.html               The Android app (form, queue, banner)
  core.js                  Local storage + syncing, shared by the app and service worker
  sw.js                    Service worker: offline support + background sync
  manifest.webmanifest     Makes the app installable
  icon-192.png             App icons
  icon-512.png
README.md                  This file
```

`offline-app.zip` contains the six files inside `offline-app/`.

### What the sheet contains

| Tab | Purpose |
|---|---|
| `Expenses` | One row per expense: Date, Month, Time, Category, Amount, Payment Mode, Remarks, Device Name, Person, ID, Kakeibo Type |
| `Settings` | Secret key, currency, categories (with Kakeibo type and fixed-cost flag), people, payment modes, fund links |
| `Plan` | One row per month: income, planned fixed costs, savings goal, Zakat and Qurbani set-asides |
| `Funds` | Monthly Zakat and Qurbani ledger: set-aside, paid, running balance |
| `Dashboard` | Formulas and charts, rebuilt by `buildDashboard()` |

---

## Installation, step by step

Allow about 30 minutes the first time.

### Part 1. Create the sheet and the backend

1. Go to **sheets.new** while signed in to your personal Google account. Name the sheet, for example "Family Expenses".
2. Check the time zone: **File > Settings > Time zone**. Choose your local one. All dates use this zone.
3. Open **Extensions > Apps Script**.
4. Delete the default code, paste in the full contents of `Code.gs`, and save (Ctrl+S).
5. In the function dropdown at the top, choose **setup** and click **Run**.
6. Google asks for permission. Click **Review permissions**, choose your account, then **Advanced > Go to (project name) (unsafe) > Allow**.
   This warning is normal for your own scripts that have not been through Google's review.
7. When it finishes, your sheet has the tabs `Expenses`, `Settings`, `Plan`, `Funds` and `Dashboard`.

### Part 2. Fill in your details

1. **Settings tab**
   - Replace `Person 1`, `Person 2`, `Person 3` in column **H** with real names (these names appear in the app and dashboard).
   - Check the currency in **B3** (default `PKR`).
   - Review the categories in column D. Column E is the Kakeibo type and column F marks fixed costs.
2. **Plan tab** (yellow cells): enter this month's **Income**, **Fixed costs (planned)**, **Savings goal**, and, if you use the funds, the monthly **Zakat** and **Qurbani** set-asides. Plain numbers only.
3. **Funds tab** (optional): enter opening balances in **B2** and **C2** if you already hold money aside for Zakat or Qurbani.
4. Test the backend: choose **testInsert** in Apps Script and click **Run**. A test row appears in `Expenses`. Delete that row afterwards.

### Part 3. Publish the backend as a web app

1. In Apps Script click **Deploy > New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Set **Execute as: Me** and **Who has access: Anyone**.
4. Click **Deploy** and authorise if asked.
5. Copy the **Web app URL**. It must end in `/exec`.
6. Check it works: open `YOUR_WEB_APP_URL?ping=1` in a browser. You should see `{"ok":true,"message":"Expense tracker is running"}`.

> "Anyone" only means anyone can reach the address. Every request still needs your secret key, and nobody can read your expenses through it.

### Part 4. Host the app on GitHub Pages

1. Sign in at **github.com** and click **+ > New repository**.
2. Name it (for example `kakeibo-tracker`), choose **Public**, and create it.
3. Unzip `offline-app.zip`. In the empty repository click **uploading an existing file** and drag in the **six files** themselves (not the zip and not a folder): `index.html`, `core.js`, `sw.js`, `manifest.webmanifest`, `icon-192.png`, `icon-512.png`. Click **Commit changes**.
   `index.html` must sit at the top level of the repository.
4. Open **Settings > Pages**. Under "Build and deployment" choose **Deploy from a branch**, branch **main**, folder **/(root)**, and click **Save**.
5. After a minute or two, the page shows your address, such as `https://yourname.github.io/kakeibo-tracker/`. Open it: you should see a "First-time setup" screen.

The repository contains only code. It holds no keys and no data.

### Part 5. Connect the app to your sheet

1. In `Code.gs`, set `PWA_URL` near the top to your GitHub Pages address:
   ```js
   const PWA_URL = 'https://yourname.github.io/kakeibo-tracker/';
   ```
2. Save, then publish the change **without changing your web address**:
   **Deploy > Manage deployments > pencil icon (Edit) > Version: New version > Deploy**.
   Do not choose "New deployment": that creates a different address.
3. Choose **showLinks** and click **Run**. Open the **Execution log**. It prints one personal link per person. Each link looks like:
   ```
   https://yourname.github.io/kakeibo-tracker/?api=...&key=...&person=Ali
   ```
4. Send each person their own link, privately.

### Part 6. Install on each Android phone

1. Open the person's link in **Chrome**. You should see "Logging as (name)" and a category list.
2. Save a small test expense and confirm a row appears in the sheet.
3. Install the app: tap **Install app** at the bottom of the form, or Chrome menu (⋮) > **Install app** / **Add to Home screen**.
4. From now on, open the app from its home-screen icon. The link is not needed again.

After first open the key is removed from the address bar and kept only in the phone's app storage.

---

## Daily use

1. Open the app and tap the amount field.
2. Type the amount, choose a **category**. The **Kakeibo type** fills in automatically (you can change it for one entry).
3. Choose the **payment mode**. Date and time default to now and can be changed to backdate.
4. Add **remarks** if you like, then tap **Save Record**.

What the messages mean:

| Message | Meaning |
|---|---|
| Saved on this phone ✓ | Stored locally, sending now. |
| Synced to your sheet ✓ | The row is in the sheet. |
| Saved on this phone: N waiting to sync | No connection or a temporary problem. It will retry. |
| N entry needs attention | Google rejected an entry (for example a bad amount). Open the list to Retry or Delete. |
| Offline chip (orange) | No connection. You can still save entries. |

The **budget banner** at the top shows the week and month remaining. While offline it shows the last known figures minus entries not yet synced, labelled as an estimate.

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

A growing **Extra** slice usually means your plan is missing something, such as an emergency fund or yearly costs not spread over the months.

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

You decide the type: change any category's type in `Settings`, or override it on a single entry in the app.

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

The sheet calculates:

- **Free to spend** = Income - Fixed costs - Savings goal
- **Weekly allowance** = Free to spend / days in the month x 7
- **Daily allowance** = Free to spend / days in the month

A month without its own row uses the most recent row above it, so add a row only when something changes. Plan numbers are plain figures (no currency symbol or commas).

### What counts against the allowance

- Counted: ordinary (flexible) spending.
- **Not counted:** categories marked **Fixed cost? = Yes** (tracked against the planned fixed costs instead) and any entry whose type is **Savings**.

If you put school fees or instalments in the planned fixed costs, mark their category as fixed too. Otherwise they are subtracted in the plan and counted again against the weekly allowance.

Weeks are blocks of days: 1-7, 8-14, 15-21, 22-28 and 29 to month end (the last block is prorated).

### The Dashboard

Type the first day of any month into **Dashboard!B3** to view that month (it defaults to the current month).

- **Summary:** total spent, transactions, daily average, top category, fixed costs paid, invested/saved
- **Household budget:** income, fixed costs, savings goal, free to spend, flexible spent, remaining (red when over), saved so far
- **Tables and charts:** by category, Kakeibo split, weekly spending vs allowance, by person, by payment mode, daily spending
- **Earmarked funds:** Zakat and Qurbani set aside, paid out, balance
- **Latest 10 expenses**

If the dashboard looks wrong after a change, run `buildDashboard()` in Apps Script. It only rebuilds that tab and does not touch your data.

---

## Zakat and Qurbani funds

These are savings you build up over months and pay out later, so they are handled as **earmarked funds**:

1. **Set aside** (automatic): enter the monthly amounts in the `Plan` tab. They count as part of your savings goal and accrue in the `Funds` ledger. You do not log them in the app.
2. **Pay out** (in the app): log the payment under the **Zakat 🤲** or **Qurbani 🐐** category. These categories are type **Savings**, so a payment does not reduce your monthly budget.
3. **Balance:** `Funds` shows set-aside minus paid. The app shows the balance after each payment, and the balance turns red if you pay more than you have set aside.

Zakat can be paid in portions: each payment lowers the balance. Qurbani is usually one payment around Eid-ul-Adha. The date of Eid moves about ten days earlier each year, so plan the monthly amount for the month you expect to pay.

> The tracker only records and totals. It does **not** calculate how much Zakat is due, which depends on your wealth on your Zakat date. Use a scholar or a trusted calculator for the amount.

The set-aside is a plan, not a bank transfer: the ledger counts it whether or not you actually move the money.

---

## Offline behaviour

- The app opens with no internet from a saved copy, using the category lists from the last time it was online.
- Saving works offline. Each entry keeps the date and time you made it, even if it syncs hours later.
- Waiting entries are sent: when the app opens, when the connection returns, every 30 seconds while the app is open, on **Sync now**, and by Android in the background (Chrome Background Sync) even if the app is closed.
- Each entry has a unique ID, so retries never create duplicates.
- Entries rejected permanently (bad amount, date, time or key) are flagged, never retried forever, and can be corrected or deleted.
- Temporary server problems keep the entry queued.
- The very first use needs internet once, to load your categories.

---

## Customising

| To change | Do this |
|---|---|
| Categories, types, fixed flag | `Settings` columns D, E, F. New categories appear in the app next time it is online. The dashboard shows the first 20. |
| People | `Settings` column H, then run `showLinks()` for new links |
| Payment modes | `Settings` column J (the dashboard shows the first 8) |
| Currency label | `Settings!B3`, then run `buildDashboard()` |
| Funds | `Settings` columns L:M link a fund name to its category (Zakat and Qurbani by default) |
| Months for the plan | Add rows to `Plan` (up to 36 months) |
| Time zone | **File > Settings** in the spreadsheet |

### Changing the secret key

1. Type a new value into `Settings!B2`.
2. Run `showLinks()` and send everyone the new links.
3. On each phone, open the new link once. Any entries flagged "Invalid key" can then be retried from the list.

---

## Updating

**Backend (`Code.gs`):** paste the new code, save, then **Deploy > Manage deployments > pencil > New version > Deploy**. If the dashboard changed, also run `buildDashboard()`. If the code adds tabs or columns, run `setup()` again (it is safe to re-run).

**App files (GitHub):** in your repository choose **Add file > Upload files** and upload the changed files, replacing the old ones. If you changed any app file, also raise the version in `sw.js` (`expense-app-v3` becomes `expense-app-v4`), so phones fetch the new copy. Each phone updates the next time you open the app with internet; closing and reopening it once more may be needed.

---

## Security and privacy

- **Your data** lives only in your Google Sheet. GitHub hosts code only, and the repository can be public safely.
- **The secret key** is in each personal link. Treat links like passwords and share them privately. Anyone with a link can add expenses as that person.
- Without the key, nobody can add entries or read the category list. The web app has no endpoint that returns your expenses.
- The script runs as **you** and is limited to this sheet (`@OnlyCurrentDoc`).
- Each phone stores its connection details and unsent entries in the app's local storage. **Reset this app** (bottom of the app) clears them.
- Anyone with edit access to the sheet can see all data, including income in the `Plan` tab. Share the sheet carefully.

---

## Troubleshooting

| Problem or message | Cause and fix |
|---|---|
| **"Google hasn't verified this app"** while running `setup()` | Normal for your own script. Click **Advanced > Go to (project) (unsafe) > Allow**. |
| **"Google sent a web page instead of data"** | The live script is an old version. Use **Deploy > Manage deployments > pencil > New version > Deploy**, and set access to **Anyone**. |
| **"Could not reach your Google script"** | The link is wrong (it must end in `/exec`), access is not set to Anyone, or you are on a work/school account. Test `YOUR_URL?ping=1` in a browser. |
| **"Google said: Invalid key"** | The key in the link does not match `Settings!B2`. Run `showLinks()` and use the fresh link. |
| Entries stay "waiting to sync" | Open the app with internet and tap **Sync now**. Read the status line for the reason. |
| **"Not saved: Invalid amount / date / time"** | The entry was rejected. Open the waiting list and **Delete** it, then enter it again correctly. |
| No budget banner | The `Plan` tab has no income for the current month. Fill in the yellow cells. |
| Category does not appear | It must be in `Settings` column D with a type. Reopen the app while online to refresh. |
| `#NAME?` or blank cells on the dashboard | Run `buildDashboard()`. |
| Wrong day on some entries | Set the spreadsheet time zone (**File > Settings**). |
| GitHub page shows 404 | The files are inside a folder. `index.html` must be at the top level of the repository. |
| GitHub page is not live yet | Wait a few minutes after enabling Pages, then refresh. |
| "Install app" is not offered | Use Chrome, open the hosted address (not a file), and use the ⋮ menu > **Install app** or **Add to Home screen**. |
| App does not show new changes | Raise the `CACHE` version in `sw.js`, upload it, then open the app online and reopen it once. |
| Open the app and see "First-time setup" | The phone has no saved link. Open the personal link once, or fill the form with the values from `showLinks()`. |

---

## Limits and known limitations

| Item | Limit |
|---|---|
| Platform | Android with Chrome. iPhone is not supported by this version. |
| Dashboard category rows | 20 |
| People on the dashboard | 8 (links work for up to 19 names) |
| Payment modes on the dashboard | 8 |
| Funds | 2 (Zakat and Qurbani) |
| Plan months | 36 rows; the `Funds` ledger covers 36 months from the first Plan month |
| Daily chart | up to 31 days |

Other things to know:

- **One-way sync.** Phones send entries to the sheet. The app does not show other people's expenses, only the household budget figures.
- **No editing in the app.** To correct a saved expense, edit or delete its row in the `Expenses` tab (the Plan, Funds and dashboard update automatically).
- **Background sync** depends on Android and Chrome. Battery savers can delay it. Opening the app always syncs.
- The app depends on Google allowing a web page to read your script's reply. If a browser change ever blocks it, the app shows the "Could not reach your Google script" message.
- Free Google Apps Script has daily quotas that are far above family use.
- Deleting or renaming the `Expenses`, `Settings`, `Plan`, `Funds` or `Dashboard` tabs breaks the script. Run `setup()` to recreate missing ones.

---

## API reference

For developers. The app uses these calls; the web app address is the `/exec` URL.

**Health check** (no key)
```
GET  <exec>?ping=1
-> {"ok":true,"message":"Expense tracker is running"}
```

**Config** (needs key)
```
GET  <exec>?action=config&key=SECRET
-> {"ok":true,"currency":"PKR","categories":[...],"types":{...},"fixed":[...],
    "kakeiboTypes":[...],"payments":[...],"budget":{...}}
```

**Save an expense** (send the body as `text/plain` to avoid a browser pre-check)
```
POST <exec>
{"key":"SECRET","amount":1250,"category":"Food & Dining","type":"Wants",
 "payment":"Cash","remarks":"lunch","device":"Android","person":"Ali",
 "date":"2026-10-27","time":"13:45","id":"unique-id-per-entry"}
-> {"ok":true,"type":"Wants","fixed":false,"saving":false,"fund":null,
    "budget":{"hasPlan":true,"ym":"2026-10","week":4,"weekLeft":7000,"monthLeft":35000,"free":40000}}
```

- `date` accepts `YYYY-MM-DD` or `DD/MM/YYYY`; `time` is `HH:mm`. Both default to now.
- Category and payment names match ignoring case, emoji and punctuation. Unknown values become "Other".
- An `id` already saved in the last 100 rows returns `{"ok":true,"duplicate":true}` without a new row.
- Errors return `{"ok":false,"error":"Invalid key" | "Invalid amount" | "Invalid date" | "Invalid time" | ...}`.

---

## Testing checklist

After installing, check each of these once:

- [ ] `?ping=1` shows `{"ok":true,...}`
- [ ] The personal link opens the form with your name and a category list
- [ ] A saved expense appears in `Expenses` with the right date, category, type and person
- [ ] Airplane mode: save an expense, see "Saved on this phone". Turn it off: it syncs and the row appears
- [ ] Closing the app while an entry is waiting, then reopening, still sends it
- [ ] The budget banner shows figures (after filling in the `Plan`)
- [ ] A Zakat or Qurbani payment shows the fund balance and does not change the weekly figure
- [ ] The dashboard updates for the current month
- [ ] A second family member's link saves entries with their own name
