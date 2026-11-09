# SpendWise — Milestone 11

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
- **Real pages** — Overview, Savings, Wishlist, Analytics, and Transactions each have their own page (the browser Back button works too).
- **Interactive dashboard** — clickable summary cards and chart slices, animated numbers, a month-by-month chart, top-category bars, confetti when you reach a goal, and keyboard shortcuts (N = new transaction, 1–5 = switch pages).
- **Profile page** — upload or remove a profile photo (cropped to a square automatically), set a display name, bio, and email, see your stats, and change your password. Your photo shows in the sidebar and top bar.
- **3D effects** — cards tilt towards your mouse with a moving shadow, numbers float above the cards, goal cards flip over to show stats, and the add-transaction pop-up swings open. Turned off automatically on touch screens and when "reduce motion" is on.
- **Light / dark mode** — royal blue, white, and tomato red theme with a switch in the top bar. Your choice is remembered.
- **Wishlist goals** — add something you want to buy and its cost, put money towards it, and watch a progress bar fill up with a motivating quote at each stage. Goal money counts as savings.
- **Stock purchases** — for Savings → Stocks, record the stock name and number of shares. The table shows e.g. "10 shares of TCS · ₹250/share".
- **Delete transactions** — via the "···" button on each row.
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

## Project files

- `index.html` — dashboard structure and transaction form.
- `login.html` — login and sign-up page.
- `styles.css` — layout, colors, spacing, responsive behavior, and modal styles.
- `app.js` — calculations, chart rendering, insights, search/filter, and talking to the server (load, add, delete, log out).
- `main.py` — Flask server: serves the pages, handles accounts, and saves transactions in the database.
- `spendwise.db` — SQLite database file (created automatically, not saved in Git).
- `.gitignore` — tells Git to skip `venv/`, the database, and Mac junk files.

## API endpoints

| Method | URL | What it does |
|---|---|---|
| POST | `/api/signup` | Create an account and log in |
| POST | `/api/login` | Log in |
| POST | `/api/logout` | Log out |
| GET | `/api/me` | Get the logged-in username |
| GET | `/api/transactions` | Get your transactions |
| POST | `/api/transactions` | Add a transaction |
| DELETE | `/api/transactions/<id>` | Delete a transaction |

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
- [x] **Milestone 11** — Profile page with photo upload, details, stats, and password change.
- [x] **Milestone 10** — 3D tilt cards, flip-over goal stats, and a swinging pop-up.
- [x] **Milestone 9** — Sidebar opens real pages instead of scrolling; interactive cards, charts, analytics page, confetti, and shortcuts.
- [x] **Sidebar navigation** — Savings and Wishlist links; the current section is highlighted as you scroll.


