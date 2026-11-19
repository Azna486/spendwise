# SpendWise — Milestone 23

A beginner-friendly personal finance dashboard built with HTML, CSS, JavaScript, and a Python (Flask) backend with a SQLite database.

## Features

- **User accounts** — sign up, log in, and log out. Each user only sees their own transactions.
- **Three transaction types** — Expense (Food, Shopping, Transport, …), Income (no category), and Savings (Savings, Stocks, Emergency fund).
- **Summary cards** — total income, total expenses, saved & invested, and available balance (income − expenses − savings).
- **Spending breakdown** — donut chart of expenses by category (Chart.js).
- **Smart insights** — top spending category, average expense, and whether you're spending more than you earn.
- **Transactions table** — search, filter by type (all / expenses / income / savings), and "View all".
- **Add transactions** — form with name, amount, type, category, and date, with validation. Pick the type first; the category list changes with it.
- **Savings pots** — running totals for Emergency fund, Stocks, and Savings that update as soon as you add a savings transaction.
- **Real pages** — Overview, Events, Savings, Wishlist, Analytics, Transactions, Budgets, and Reports each have their own page (the browser Back button works too).
- **Interactive dashboard** — clickable summary cards and chart slices, animated numbers, a month-by-month chart, top-category bars, confetti when you reach a goal, and keyboard shortcuts (N = new transaction, 1–9 = switch pages).
- **FIN, your AI financial assistant 💬** — the "Ask FIN" button (bottom-right) opens a chat where you can ask about your money in plain English: "How much did I spend this month?", "Am I exceeding my budget?", "Help me create a savings plan." FIN reads your real SpendWise data (transactions, categories, budgets, savings goals, events) through read-only tools and only quotes numbers that come from your database. It shows which data it checked under each answer. Includes suggested questions, a typing indicator, timestamps, minimise and close. Works with Groq or Claude (Anthropic); see **Set up FIN** below.
- **Fin 🌙, your SpendBuddy** — a little glowing jellyfish that floats around every page and greets you on the login page (he says hi by name, covers his eyes while you type your password, worries if the login fails and celebrates when you get in). It wanders, peeks over your cards, follows your cursor (and sometimes dodges it), does loop-the-loops and leaves a trail of stardust. Boop it to chat, or drag it anywhere and toss it. It celebrates income and savings, side-eyes spending, worries when a budget goes over, and gets sleepy late at night. Choose **Roaming**, **Stay in corner** or **Hidden** on the Profile page; it stays still if your device has "reduce motion" on.
- **Personal overview** — a greeting with your name and photo, a message based on your own numbers, your closest goal, this month vs last month, a logging streak, and a money tip of the day.
- **Profile page** — upload or remove a profile photo (cropped to a square automatically), set a display name, bio, and email, see your stats, and change your password. Your photo shows in the sidebar and top bar.
- **3D effects** — cards tilt towards your mouse with a moving shadow, numbers float above the cards, goal cards flip over to show stats, and the add-transaction pop-up swings open. Turned off automatically on touch screens and when "reduce motion" is on.
- **Light / dark mode** — Night Sky theme (deep space, midnight and moonlight blue, starlight gold, and ivory) with a switch in the top bar. Your choice is remembered.
- **Budgets** — set a monthly limit for each spending category (with a suggested amount based on your last 3 months). See spent vs left, a "safe to spend per day" number, colour-coded progress (on track, almost there, over), past months, and spending that has no budget yet. You get a warning when a new expense takes a budget past 80% or over its limit.
- **Spending calendar** — on the Analytics page, a month grid where each day is shaded by how much you spent (like GitHub's contribution graph). Tap a day to see what you bought, or jump to those transactions.
- **Export to CSV** — on the Transactions page, "⤓ Export CSV" downloads the transactions you see (search and filter included) as a file that opens in Excel, Numbers, or Google Sheets.
- **Organisation accounts** — when signing up, choose **Individual** or **Organisation**. Create an organisation (for a committee, club or team) and you become its admin with an invite code; members choose **Organisation → Join with code** (or open the invite link). Everyone in an organisation shares the same transactions, budgets, categories and events, and every transaction shows who added it. Organisation accounts skip the personal bits: no Wishlist, and Savings has just Savings and Emergency fund (no Stocks). Events are only for organisation accounts. The admin can share or reset the invite code and remove members (what they added stays).
- **Events** (organisation accounts) — create an event (a fest, a trip, a meeting) with an allowance. Link expenses and money collected (sponsorships, member contributions, ticket sales…) to it and see spent vs allowance, what's left, where the money went, and whether the event paid for itself. Close events when they're done.
- **All events at a glance** — the top of the Events page adds up every event in view (allowance, spent, left, collected, to pay back) and shows a comparison table you can sort by any column. Click a row to open that event.
- **Sub-events** — put events inside a main event (e.g. "Tech Fest" → Day 1, Day 2, Hackathon) with "Part of" or the "＋ Add sub-event" button. The main event's numbers include all its sub-events; its page lists them with their own progress and warns if their allowances add up to more than the main event's. Closing or reopening a main event does the same to its sub-events; deleting it turns them into separate events.
- **Who paid & reimbursements** — in an organisation, each expense records who paid: organisation funds, or a member from their own pocket. Money owed to members shows under **Reimbursements** until you mark it as paid back (one at a time or all at once, with undo).
- **Custom categories** — add your own expense categories (like Pets, Gym or Coffee) with an emoji and a colour, from the Profile page or straight from the Add transaction form ("＋ New category…"). They work everywhere: charts, budgets, and reports. Deleting one moves its transactions to "Other".
- **Monthly report** — a "month in review" page: income, spending, savings and savings rate compared with last month, where your money went by category, and highlights (biggest expense, busiest day, no-spend days, budgets). Look back at any month and print it or save it as a PDF.
- **Wishlist goals** — add something you want to buy and its cost, put money towards it, and watch a progress bar fill up with a motivating quote at each stage. Goal money counts as savings.
- **Stock purchases** — for Savings → Stocks, record the stock name and number of shares. The table shows e.g. "10 shares of TCS · ₹250/share".
- **Edit and delete transactions** — fix a wrong amount, name, date, type, or category with the ✎ button on each row (it opens the same pop-up, filled in), or delete with × (asks first).
- **Saved data** — transactions are stored in a database, so they stay after refreshing the page.

## Run on macOS

1. Open the `spendwise` folder in VS Code.
2. Open a terminal (**Terminal → New Terminal**) and run:

   ```bash
   cd ~/Desktop/spendwise
   python3 -m venv venv        # first time only
   source venv/bin/activate
   pip install flask           # first time only
   python main.py
   ```

3. Open **http://127.0.0.1:5001** in your browser and create an account.
4. Keep that terminal open — closing it or pressing Ctrl + C stops the server.

> Don't use Live Server for this project anymore. The page needs the Python server to load and save data.

## Set up FIN (the AI assistant)

FIN needs an API key from **Groq** (https://console.groq.com, keys start with `gsk_`) or **Anthropic** (https://console.anthropic.com, keys start with `sk-ant-`). The key stays on your computer, in the server only. It's never sent to the browser.

1. Get a key from Groq or Anthropic (usage limits and billing are set by that provider).
2. In the `spendwise` folder, copy `.env.example` and name the copy `.env`:

   ```bash
   cp .env.example .env
   ```

3. Open `.env` and paste your key after `GROQ_API_KEY=` or `ANTHROPIC_API_KEY=` (no quotes or spaces). FIN works out which provider to use from the key.
4. Restart SpendWise (`Ctrl + C`, then `python main.py`) and click **Ask FIN**.

`.env` is in `.gitignore`, so your key is never committed. Without a key, everything else in SpendWise works as normal and FIN explains that it isn't set up yet.

**How FIN works:** your question goes to `/api/fin/chat` on your own server → the AI model asks for the data it needs → `fin_tools.py` reads your database (only your account, read-only) and does the maths in Python → the model answers using only those numbers. To answer, the figures it looks up are sent to the AI provider (Groq or Anthropic).

**If FIN says it can't reach the AI service or can't make a secure connection:** With your venv active, run `pip install truststore` and restart SpendWise. FIN then trusts the same certificates as your Mac, which fixes python.org Python on a Mac and college/office Wi-Fi, VPNs or antivirus that check secure connections. (`pip install certifi` also helps in the first case.) The exact error is also printed in the terminal as `FIN AI error: …`.

**Note:** when SpendWise starts, Flask may print *"There are .env files present. Install python-dotenv to use them."* This is harmless: FIN reads `.env` itself. Run `pip install python-dotenv` if you'd like the message gone.

**Optional settings in `.env`:** `FIN_PROVIDER` (`groq` or `anthropic`), `FIN_MODEL` (default `openai/gpt-oss-120b` on Groq, `claude-sonnet-5-5` on Anthropic), `FIN_MAX_TOKENS` (1200), `FIN_RATE_LIMIT` (questions per minute per user, default 10).

**Ready for more:** FIN is read-only today. The code is set up for future tools (create or update budgets, savings goals, reports, monitoring), specialised agents and saved memory. Any tool that would change data is marked as a "write" tool and is never run without your explicit approval.

## Project files

- `index.html` — dashboard structure and transaction form.
- `login.html` — login and sign-up page.
- `styles.css` — layout, colors, spacing, responsive behavior, and modal styles.
- `buddy.js` + `buddy.css` — Fin the jellyfish (drawn in SVG; floats around the app and the login page).
- `app.js` — calculations, chart rendering, insights, search/filter, and talking to the server (load, add, delete, log out).
- `main.py` — Flask server: serves the pages, handles accounts, and saves transactions in the database.
- `fin_ai.py` — FIN's AI backend: talks to the AI model, the secure `/api/fin/chat` endpoint, rate limiting, error handling.
- `fin_tools.py` — FIN's read-only finance tools (overview, categories, monthly summary, transactions, budgets, savings goals, events).
- `fin-chat.js` / `fin-chat.css` — FIN's chat panel.
- `.env.example` — template for your AI settings (copy to `.env`).
- `spendwise.db` — SQLite database file (created automatically, not saved in Git).
- `.gitignore` — tells Git to skip `venv/`, the database, and Mac junk files.

## API endpoints

| Method | URL | What it does |
|---|---|---|
| POST | `/api/signup` | Create an account (individual, new organisation, or join with a code) and log in |
| POST | `/api/login` | Log in |
| POST | `/api/logout` | Log out |
| GET | `/api/me` | Get the logged-in username |
| GET | `/api/transactions` | Get your transactions |
| POST | `/api/transactions` | Add a transaction |
| PUT | `/api/transactions/<id>` | Edit a transaction |
| DELETE | `/api/transactions/<id>` | Delete a transaction |
| GET | `/api/org` | Your organisation and its members |
| PUT | `/api/org` | Rename the organisation (admin) |
| POST | `/api/org/invite-code` | Make a new invite code (admin) |
| DELETE | `/api/org/members/<id>` | Remove a member (admin) |
| GET | `/api/events` | Get your events |
| POST | `/api/events` | Create an event |
| PUT | `/api/events/<id>` | Edit, close, reopen or move an event (`parent_id` makes it a sub-event) |
| DELETE | `/api/events/<id>` | Delete an event (its transactions stay) |
| POST | `/api/transactions/<id>/settle` | Mark a member as paid back (or undo) |
| GET | `/api/categories` | Get your custom categories |
| POST | `/api/categories` | Add a custom category |
| DELETE | `/api/categories/<id>` | Delete a custom category (its transactions move to Other) |
| GET | `/api/fin/status` | Is FIN's AI set up? (logged in) |
| POST | `/api/fin/chat` | Ask FIN a question: `{message, history}` → `{reply, tools_used, time}` (logged in, JSON only, rate-limited) |
| GET | `/api/budgets` | Get your monthly budgets |
| POST | `/api/budgets` | Set or change a category budget |
| DELETE | `/api/budgets/<id>` | Delete a budget |

## Important notes

- Passwords are stored as secure hashes, never as plain text.
- The secret key in `main.py` is a placeholder (`dev-only-change-me`). Set a real random value in the `SPENDWISE_SECRET_KEY` environment variable before putting this online.
- `debug=True` is for learning on your own computer only.
- This is a learning project, not a secure financial product. Do not enter real sensitive financial information.

## Progress log

- [x] **Milestone 1** — Front-end dashboard with sample data (HTML, CSS, JavaScript, Chart.js).
- [x] **Milestone 2** — Python Flask backend + SQLite database, so data survives a refresh.
- [x] **Milestone 3** — User accounts with sign-up, login, and logout.
- [x] **Milestone 4** — Savings type (Savings / Stocks / Emergency fund), income without a category, and balance that subtracts savings.
- [x] **Milestone 5** — Type-first transaction form and stock details (stock name + number of shares).
- [x] **Milestone 6** — Savings pots panel showing your Emergency fund, Stocks, and Savings totals.
- [x] **Milestone 7** — Wishlist goals with progress bars, "Add money", and fun quotes.
- [x] **Milestone 8** — New royal blue + tomato red theme with a light/dark mode switch. All colours live in the THEME section at the top of `styles.css`.
- [x] **Milestone 23** — FIN, an AI financial assistant (Groq or Claude) that answers from your real SpendWise data.
- [x] **Milestone 22** — The jellyfish gets a name, Fin, and says hi on the login page.
- [x] **Milestone 21** — Night Sky theme, and SpendBuddy becomes a jellyfish that roams the whole app.
- [x] **Milestone 20** — Events dashboard with a sortable comparison table, and sub-events under a main event.
- [x] **Milestone 19** — Organisation accounts with invite codes, events with allowances, who paid, money collected, and reimbursements.
- [x] **Milestone 18** — Spending calendar; SpendBuddy reacts to budgets.
- [x] **Milestone 17** — Export transactions to CSV for Excel.
- [x] **Milestone 16** — Custom categories and a printable monthly report.
- [x] **Milestone 15** — Edit transactions to fix mistakes, and a confirm step before deleting.
- [x] **Milestone 14** — Budgets page: monthly limits per category, safe-to-spend per day, and over-budget warnings.
- [x] **Milestone 13** — SpendBuddy (later redesigned as a floating jellyfish) (`buddy.js`).
- [x] **Milestone 12** — Personalised Overview: greeting, smart message, goal spotlight, month comparison, streak, and daily tip.
- [x] **Milestone 11** — Profile page with photo upload, details, stats, and password change.
- [x] **Milestone 10** — 3D tilt cards, flip-over goal stats, and a swinging pop-up.
- [x] **Milestone 9** — Sidebar opens real pages instead of scrolling; interactive cards, charts, analytics page, confetti, and shortcuts.
- [x] **Sidebar navigation** — Savings and Wishlist links; the current section is highlighted as you scroll.

## Deleting an account

Profile → **Delete account** (at the bottom). You type `DELETE`, plus your password if you have one.
- **Individual:** your account and all your data (transactions, budgets, savings, goals, categories) are deleted.
- **Organisation member:** your account is deleted; what you added stays, shown as "a former member".
- **Organisation admin:** the whole organisation is deleted, including its data and every member's account.

Members who joined with just an invite code can **Add a password** on their profile, then log in with their @username too.

## Reminders 🔔

On the **Overview** page, **Reminders** keeps track of bills and payments: what it is, an optional amount, the due date, and whether it repeats (weekly, monthly or yearly).
- **Fin nudges you**: when something is overdue or due within 2 days, Fin mentions it in a speech bubble (once per reminder per visit), and slips upcoming ones into what he says when you boop him.
- **✓ Paid / Done**: a one-off reminder is ticked off; a repeating one moves on to its next date (monthly ones keep their day, e.g. the 31st becomes the 28th/30th in shorter months).
- **Ask FIN**: "remind me to pay rent on the 1st of every month, 15000". FIN shows a card, and the reminder is only saved when you tap **Add reminder**. FIN can also answer "what bills are coming up?".
- Organisation accounts share their reminders with the whole team.
