# SpendWise — Milestone 1

A beginner-friendly personal finance dashboard built with HTML, CSS, and JavaScript.

## Run on macOS

1. Download and unzip `spendwise.zip`.
2. Open the `spendwise` folder in VS Code.
3. Open `index.html` in a browser. For a better development workflow, install the **Live Server** extension in VS Code, right-click `index.html`, and choose **Open with Live Server**.

No Node.js, Python packages, API keys, or database are required for this milestone. The spending donut chart uses Chart.js via a CDN, so an internet connection is required for that chart and the remote fonts.

## Project files

- `index.html` — dashboard structure and transaction form.
- `styles.css` — layout, colors, spacing, responsive behavior, and modal styles.
- `app.js` — sample transactions, calculations, chart rendering, insights, search/filter, add/delete interactions.

## Important notes

- All displayed transactions are fictional sample data.
- Data is stored in a JavaScript array in memory. Refreshing the page resets added/deleted transactions.
- This is a front-end learning demo, not a secure financial product. Do not enter real sensitive financial information.
- The date label is a static design label in this first milestone; later we can make it dynamic and add proper month filtering.
