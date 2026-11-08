// SpendWise — Milestone 1
const sampleTransactions = [
  { id: 1, name: 'Monthly allowance', category: 'Salary', date: '2026-11-01', amount: 20000, type: 'income' },
  { id: 2, name: 'Freelance design work', category: 'Freelance', date: '2026-11-01', amount: 5000, type: 'income' },
  { id: 3, name: 'Groceries at Nature’s Basket', category: 'Food', date: '2026-11-01', amount: 1800, type: 'expense' },
  { id: 4, name: 'New headphones', category: 'Shopping', date: '2026-10-30', amount: 2500, type: 'expense' },
  { id: 5, name: 'Metro card recharge', category: 'Transport', date: '2026-10-29', amount: 900, type: 'expense' },
  { id: 6, name: 'Online course', category: 'Education', date: '2026-10-27', amount: 2000, type: 'expense' },
  { id: 7, name: 'Lunch with friends', category: 'Food', date: '2026-10-25', amount: 850, type: 'expense' },
  { id: 8, name: 'Monthly phone bill', category: 'Bills', date: '2026-10-23', amount: 650, type: 'expense' },
  { id: 9, name: 'Cafe study session', category: 'Food', date: '2026-10-20', amount: 450, type: 'expense' },
  { id: 10, name: 'Auto rides', category: 'Transport', date: '2026-10-18', amount: 700, type: 'expense' },
  { id: 11, name: 'Notebook and pens', category: 'Education', date: '2026-10-16', amount: 300, type: 'expense' },
  { id: 12, name: 'Skincare', category: 'Shopping', date: '2026-10-12', amount: 1800, type: 'expense' },
  { id: 13, name: 'Snacks', category: 'Food', date: '2026-10-08', amount: 900, type: 'expense' },
  { id: 14, name: 'Movie tickets', category: 'Other', date: '2026-10-04', amount: 900, type: 'expense' }
];
let transactions = [];
const categoryColors = {
  Food: '#BB232B', Shopping: '#B15CFF', Transport: '#2EA8FF',
  Education: '#17A974', Bills: '#F5A524', Health: '#FF4F8B',
  Salary: '#29845E', Freelance: '#69B6A5', Other: '#AAB4AE',
  Savings: '#8E8FD8', Stocks: '#6B71BD', 'Emergency fund': '#B3A9E6', Goals: '#C9A3E8'
};
const categoryIcons = {
  Food: '♨', Shopping: '◇', Transport: '↗', Education: '▤', Bills: '▣',
  Health: '+', Salary: '↓', Freelance: '✳', Other: '•••',
  Income: '↓', Savings: '◈', Stocks: '↟', 'Emergency fund': '⛑', Goals: '★'
};
const money = amount => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0
}).format(amount);
const prettyDate = date => new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric'
});
const sum = list => list.reduce((total, item) => total + item.amount, 0);

const incomeValue = document.querySelector('#income-value');
const expenseValue = document.querySelector('#expense-value');
const balanceValue = document.querySelector('#balance-value');
const savingsValue = document.querySelector('#savings-value');
const savingsFill = document.querySelector('#savings-track-fill');
const donutTotal = document.querySelector('#donut-total');
const transactionBody = document.querySelector('#transactions-body');
const categoryLegend = document.querySelector('#category-legend');
const insightsList = document.querySelector('#insights-list');
const transactionCount = document.querySelector('#transaction-count');
const modal = document.querySelector('#transaction-modal');
const form = document.querySelector('#transaction-form');
const searchInput = document.querySelector('#search-input');
const filterButton = document.querySelector('#filter-button');
const toast = document.querySelector('#toast');

let currentFilter = 'all';
let spendingChart = null;
let trendChart = null; // declared early: the theme switch may redraw it
let toastTimeout;

function getTotals() {
  const income = sum(transactions.filter(item => item.type === 'income'));
  const expenses = sum(transactions.filter(item => item.type === 'expense'));
  const savings = sum(transactions.filter(item => item.type === 'savings'));
  const balance = income - expenses - savings; // money left to spend
  const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0;
  return { income, expenses, savings, balance, savingsRate };
}

// Numbers roll up/down to their new value instead of just jumping.
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function countUp(element, value) {
  const from = Number(element.dataset.value || 0);
  element.dataset.value = value;
  const run = (element.dataset.run = Number(element.dataset.run || 0) + 1);
  if (from === value || reduceMotion()) { element.textContent = money(value); return; }
  const start = performance.now();
  const step = now => {
    if (Number(element.dataset.run) !== run) return; // a newer animation took over
    const t = Math.min(1, (now - start) / 750);
    element.textContent = money(from + (value - from) * (1 - Math.pow(1 - t, 3)));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function renderSummary() {
  const totals = getTotals();
  countUp(incomeValue, totals.income);
  countUp(expenseValue, totals.expenses);
  countUp(balanceValue, totals.balance);
  countUp(savingsValue, totals.savings);
  document.querySelector('#savings-caption').textContent = `${totals.savingsRate}% of income set aside`;
  savingsFill.style.width = `${Math.max(0, Math.min(100, totals.savingsRate))}%`;
  countUp(donutTotal, totals.expenses);
  document.querySelector('#balance-caption').textContent = totals.balance >= 0
    ? 'Income minus expenses and savings' : 'Expenses and savings are higher than income';
}

function getExpenseCategories() {
  const totals = {};
  transactions.filter(item => item.type === 'expense').forEach(item => {
    totals[item.category] = (totals[item.category] || 0) + item.amount;
  });
  return Object.entries(totals).sort((a, b) => b[1] - a[1]);
}

const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function renderChart() {
  const categories = getExpenseCategories();
  const canvas = document.querySelector('#spending-chart');
  if (spendingChart) spendingChart.destroy();
  spendingChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: categories.map(([category]) => category),
      datasets: [{
        data: categories.map(([, amount]) => amount),
        backgroundColor: categories.map(([category]) => categoryColors[category] || categoryColors.Other),
        borderWidth: 3,
        borderColor: cssVar('--surface') || '#ffffff', // matches the card in light and dark mode
        hoverOffset: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '76%',
      onClick: (event, elements) => { if (elements.length) exploreCategory(categories[elements[0].index][0]); },
      onHover: (event, elements) => { event.native.target.style.cursor = elements.length ? 'pointer' : 'default'; },
      plugins: { legend: { display: false }, tooltip: {
        callbacks: { label: context => ` ${context.label}: ${money(context.raw)}` }
      } }
    }
  });
  categoryLegend.innerHTML = categories.slice(0, 5).map(([category, amount]) => `
    <button type="button" class="legend-item" data-category="${escapeHTML(category)}" title="See ${escapeHTML(category)} transactions">
      <span class="legend-dot" style="background:${categoryColors[category] || categoryColors.Other}"></span>
      <span class="legend-name">${escapeHTML(category)}</span>
      <span class="legend-amount">${money(amount)}</span>
    </button>`).join('');
}

function getInsights() {
  const expenses = transactions.filter(item => item.type === 'expense');
  const categories = getExpenseCategories();
  const totals = getTotals();
  const insights = [];
  if (categories.length) {
    const [topCategory, topAmount] = categories[0];
    const share = totals.expenses ? Math.round(topAmount / totals.expenses * 100) : 0;
    insights.push({ icon: '↗', warm: false, title: `${topCategory} is your top category`, text: `${money(topAmount)} of your spending is in ${topCategory.toLowerCase()} (${share}% of expenses).` });
  }
  const expenseCount = expenses.length;
  const average = expenseCount ? totals.expenses / expenseCount : 0;
  if (expenseCount) {
    insights.push({ icon: '◎', warm: true, title: 'Your average transaction', text: `Your average expense is ${money(Math.round(average))} across ${expenseCount} recorded purchases.` });
  }
  if (totals.income > 0) {
    insights.push({ icon: totals.balance >= 0 ? '✦' : '!', warm: false, title: totals.balance >= 0 ? 'You have a positive balance' : 'Spending is above income', text: totals.balance >= 0 ? `${money(totals.balance)} is left to spend after expenses and savings.` : `Your expenses and savings exceed income by ${money(Math.abs(totals.balance))}.` });
  }
  return insights;
}

function renderInsights() {
  insightsList.innerHTML = getInsights().map(item => `
    <div class="insight-item">
      <span class="insight-item-icon ${item.warm ? 'warm' : ''}">${item.icon}</span>
      <div><strong>${escapeHTML(item.title)}</strong><p>${escapeHTML(item.text)}</p></div>
    </div>`).join('');
}

// e.g. "10 shares of TCS · ₹250/share"
function stockDetail(item) {
  if (!item.stock_name || !item.quantity) return '';
  const shares = `${item.quantity} share${item.quantity === 1 ? '' : 's'}`;
  return `<small class="stock-detail">${shares} of ${escapeHTML(item.stock_name)} · ${money(item.amount / item.quantity)}/share</small>`;
}

function renderTransactions() {
  // Overview: latest 5 of everything. Savings: only savings. Transactions: everything, with search + filter.
  const searchTerm = currentPage === 'transactions' ? searchInput.value.trim().toLowerCase() : '';
  const typeFilter = { overview: 'all', savings: 'savings' }[currentPage] || currentFilter;
  const filtered = transactions
    .filter(item => typeFilter === 'all' || item.type === typeFilter)
    .filter(item => `${item.name} ${item.category} ${item.date}`.toLowerCase().includes(searchTerm))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const visible = currentPage === 'overview' ? filtered.slice(0, 5) : filtered;
  if (!visible.length) {
    const message = searchTerm || typeFilter !== 'all' ? 'No transactions match.' : 'Nothing here yet — add your first transaction!';
    transactionBody.innerHTML = `<tr><td colspan="5" class="empty-state">${message}</td></tr>`;
  } else {
    transactionBody.innerHTML = visible.map(item => {
      const iconClass = item.type === 'expense' ? item.category.toLowerCase() : item.type;
      const sign = { income: '+', expense: '−', savings: '' }[item.type];
      const amountClass = { income: '', expense: 'negative', savings: 'saved' }[item.type];
      return `<tr>
        <td><div class="transaction-name"><span class="transaction-icon ${iconClass}">${categoryIcons[item.category] || '•'}</span><div>${escapeHTML(item.name)}${stockDetail(item)}</div></div></td>
        <td><span class="category-pill">${escapeHTML(item.category)}</span></td>
        <td>${prettyDate(item.date)}</td>
        <td class="amount ${amountClass}">${sign}${money(item.amount)}</td>
        <td><button class="row-menu" data-delete-id="${item.id}" aria-label="Delete ${escapeHTML(item.name)}" title="Delete transaction">···</button></td>
      </tr>`;
    }).join('');
  }
  transactionCount.textContent = `Showing ${visible.length} of ${filtered.length} transaction${filtered.length === 1 ? '' : 's'}`;
  document.querySelector('#show-all-button').classList.toggle('hidden', currentPage !== 'overview' || filtered.length <= visible.length);
  document.querySelector('#show-all-button').textContent = 'View all transactions →';
}

// Savings pots: running totals for each kind of savings (Emergency fund first).
const savingsPots = [
  { category: 'Emergency fund', note: 'your safety net for surprises' },
  { category: 'Stocks', note: 'invested in shares' },
  { category: 'Savings', note: 'general savings' }
];
const potTotal = category => sum(transactions.filter(item => item.type === 'savings' && item.category === category));

function renderSavingsPots() {
  document.querySelector('#pot-grid').innerHTML = savingsPots.map(pot => {
    const count = transactions.filter(item => item.type === 'savings' && item.category === pot.category).length;
    return `<div class="pot ${pot.category === 'Emergency fund' ? 'emergency' : ''}">
      <div class="pot-label"><span class="pot-icon">${categoryIcons[pot.category]}</span>${pot.category}</div>
      <div class="pot-value">${money(potTotal(pot.category))}</div>
      <div class="pot-note">${count ? `${count} deposit${count === 1 ? '' : 's'} · ${pot.note}` : 'Nothing added yet'}</div>
    </div>`;
  }).join('');
}

function renderApp() {
  renderSummary();
  renderSavingsPots();
  renderGoals();
  renderChart();
  renderInsights();
  renderTransactions();
  if (currentPage === 'analytics') { renderTrend(); renderCategoryBars(); }
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

// Each type has its own category list. Income has none, so its box is hidden.
const categoriesByType = {
  expense: ['Food', 'Shopping', 'Transport', 'Education', 'Bills', 'Health', 'Other'],
  savings: ['Savings', 'Stocks', 'Emergency fund']
};
const categoryField = document.querySelector('#category-field');
function updateCategoryField() {
  const type = form.elements.type.value;
  categoryField.classList.toggle('hidden', type === 'income');
  if (type === 'income') return;
  form.elements.category.innerHTML = categoriesByType[type]
    .map(category => `<option>${category}</option>`).join('');
}

// Stock name + number of shares only appear for Savings → Stocks.
const stockFields = document.querySelector('#stock-fields');
const isStock = () => form.elements.type.value === 'savings' && form.elements.category.value === 'Stocks';
const isEmergency = () => form.elements.type.value === 'savings' && form.elements.category.value === 'Emergency fund';
function updateStockFields() {
  stockFields.classList.toggle('hidden', !isStock());
  form.elements.name.placeholder = isStock() ? 'e.g. Bought TCS shares' : 'e.g. Coffee with friends';
  // Emergency fund deposits don't need a name: hide the box and fill it in automatically on save.
  document.querySelector('#name-field').classList.toggle('hidden', isEmergency());
  form.elements.name.required = !isEmergency();
}

form.elements.type.addEventListener('change', () => { updateCategoryField(); updateStockFields(); });
form.elements.category.addEventListener('change', updateStockFields);
function openModal() {
  form.reset();
  updateCategoryField();
  updateStockFields();
  form.elements.date.value = new Date().toISOString().slice(0, 10);
  document.querySelector('#form-error').textContent = '';
  modal.classList.remove('hidden');
  form.elements.type.focus();
}
function closeModal() { modal.classList.add('hidden'); }
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('visible'), 2600);
}

document.querySelector('#open-form-button').addEventListener('click', openModal);
document.querySelector('#close-modal-button').addEventListener('click', closeModal);
document.querySelector('#cancel-modal-button').addEventListener('click', closeModal);
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });
form.addEventListener('submit', async event => {
  event.preventDefault();
  const formData = new FormData(form);
  const name = isEmergency() ? 'Emergency fund deposit' : String(formData.get('name')).trim();
  const amount = Number(formData.get('amount'));
  const type = String(formData.get('type'));
  const category = type === 'income' ? 'Income' : String(formData.get('category'));
  const date = String(formData.get('date'));
  const error = document.querySelector('#form-error');
  if (!name || !Number.isFinite(amount) || amount <= 0 || !date) {
    error.textContent = 'Enter a name, a positive amount, and a date.';
    return;
  }
  const details = { name, amount, type, category, date };
  if (isStock()) {
    details.stock_name = String(formData.get('stock_name')).trim();
    details.quantity = Number(formData.get('quantity'));
    if (!details.stock_name || !(details.quantity > 0)) {
      error.textContent = 'Enter the stock name and how many shares you bought.';
      return;
    }
  }
  const res = await fetch('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(details)
  });
  if (!res.ok) { error.textContent = 'Could not save. Try again.'; return; }
  const saved = await res.json();
  transactions.push(saved);
  closeModal();
  renderApp();
  showToast(saved.type === 'savings'
    ? `Added! Your ${saved.category.toLowerCase()} is now ${money(potTotal(saved.category))}.`
    : 'Transaction added successfully.');
});

searchInput.addEventListener('input', renderTransactions);
filterButton.addEventListener('click', () => {
  const order = ['all', 'expense', 'income', 'savings'];
  setFilter(order[(order.indexOf(currentFilter) + 1) % order.length]);
  renderTransactions();
});
document.querySelector('#show-all-button').addEventListener('click', () => goTo('transactions'));
transactionBody.addEventListener('click', async event => {
  const button = event.target.closest('[data-delete-id]');
  if (!button) return;
  const id = Number(button.dataset.deleteId);
  const index = transactions.findIndex(item => item.id === id);
  if (index < 0) return;
  await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
  const [removed] = transactions.splice(index, 1);
  renderApp();
  showToast(`Removed “${removed.name}”.`);
});
document.querySelector('#period-button').addEventListener('click', () => {
  showToast('This demo currently displays all sample dates. Month filtering is a future improvement.');
});

// Draw the first view from the sample transaction array.
// ---------- Wishlist goals ----------
// Money put towards a goal is saved as a Savings → Goals transaction with a goal_id,
// so a goal's progress is simply the sum of its linked transactions.
let goals = [];
const todayISO = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in your own time zone
const goalSaved = goal => sum(transactions.filter(item => item.goal_id === goal.id));

const goalQuotes = [
  { upTo: 0, lines: ['Every big buy starts with a tiny first step. Add your first rupee!', 'The best time to start saving was yesterday. The next best is right now.'] },
  { upTo: 25, lines: ["You've started — and that's the hardest part!", 'Small steps, big dreams. Keep stacking!'] },
  { upTo: 50, lines: ['Momentum is building. Future you says thank you!', "You're on a roll — don't stop now."] },
  { upTo: 75, lines: ["Halfway there! It's starting to feel real.", 'More than half done. You can almost see it!'] },
  { upTo: 99.99, lines: ['So close you can almost unbox it!', 'The finish line is right there — one more push!'] },
  { upTo: Infinity, lines: ['Goal reached! 🎉 Treat yourself — you earned it.', 'You did it! 🏆 Patience pays off.'] }
];
function goalQuote(goal, percent) {
  const bucket = goalQuotes.find(quote => percent <= quote.upTo);
  return bucket.lines[goal.id % bucket.lines.length];
}

function renderGoals() {
  const grid = document.querySelector('#goal-grid');
  const totalSaved = goals.reduce((total, goal) => total + Math.min(goalSaved(goal), goal.target), 0);
  const totalTarget = goals.reduce((total, goal) => total + goal.target, 0);
  document.querySelector('#goals-summary').textContent = goals.length
    ? `${goals.length} goal${goals.length === 1 ? '' : 's'} · ${money(totalSaved)} saved of ${money(totalTarget)}`
    : "Things you're saving up to buy";
  if (!goals.length) {
    grid.innerHTML = `<p class="goal-empty">No goals yet. What are you dreaming of buying? ✨</p>`;
    return;
  }
  grid.innerHTML = goals.map(goal => {
    const saved = goalSaved(goal);
    const exactPercent = saved / goal.target * 100;
    const percent = Math.min(100, Math.floor(exactPercent));
    const done = saved >= goal.target;
    return `<article class="goal-card ${done ? 'done' : ''}">
      <div class="goal-top">
        <span class="goal-emoji">${escapeHTML(goal.emoji)}</span>
        <div class="goal-title"><strong>${escapeHTML(goal.name)}</strong><span>${money(saved)} of ${money(goal.target)}</span></div>
        <button type="button" class="goal-delete" data-delete-goal="${goal.id}" title="Delete goal" aria-label="Delete goal ${escapeHTML(goal.name)}">×</button>
      </div>
      <div class="goal-track"><span style="width:${percent}%"></span></div>
      <div class="goal-meta"><strong>${percent}%</strong><span>${done ? 'Ready to buy! 🛍️' : `${money(goal.target - saved)} to go`}</span></div>
      <p class="goal-quote">“${goalQuote(goal, exactPercent)}”</p>
      ${done ? '' : `<form class="goal-deposit" data-goal-id="${goal.id}">
        <input name="amount" type="number" min="1" step="0.01" required placeholder="Add ₹" aria-label="Amount to add to ${escapeHTML(goal.name)}" />
        <button type="submit">Add money</button>
      </form>`}
    </article>`;
  }).join('');
}

const goalForm = document.querySelector('#goal-form');
const goalGrid = document.querySelector('#goal-grid');

document.querySelector('#new-goal-button').addEventListener('click', () => {
  goalForm.classList.remove('hidden');
  goalForm.elements.name.focus();
});
document.querySelector('#cancel-goal-button').addEventListener('click', () => {
  goalForm.reset();
  goalForm.classList.add('hidden');
});

goalForm.addEventListener('submit', async event => {
  event.preventDefault();
  const res = await fetch('/api/goals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: goalForm.elements.name.value,
      target: Number(goalForm.elements.target.value),
      emoji: goalForm.elements.emoji.value
    })
  });
  if (!res.ok) { showToast((await res.json().catch(() => ({}))).error || 'Could not add the goal.'); return; }
  const goal = await res.json();
  goals.push(goal);
  goalForm.reset();
  goalForm.classList.add('hidden');
  renderGoals();
  showToast(`New goal: ${goal.emoji} ${goal.name}. Let's make it happen!`);
});

// "Add money" on a goal card
goalGrid.addEventListener('submit', async event => {
  const depositForm = event.target.closest('.goal-deposit');
  if (!depositForm) return;
  event.preventDefault();
  const goal = goals.find(item => item.id === Number(depositForm.dataset.goalId));
  const amount = Number(depositForm.elements.amount.value);
  const res = await fetch(`/api/goals/${goal.id}/deposit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, date: todayISO() })
  });
  if (!res.ok) { showToast('Could not add money. Try again.'); return; }
  transactions.push(await res.json());
  renderApp();
  const left = goal.target - goalSaved(goal);
  if (left <= 0) launchConfetti();
  showToast(left <= 0
    ? `🎉 You reached your goal for ${goal.name}!`
    : `${money(amount)} added to ${goal.name}. Only ${money(left)} to go!`);
});

// Delete a goal (the money stays in your savings)
goalGrid.addEventListener('click', async event => {
  const button = event.target.closest('[data-delete-goal]');
  if (!button) return;
  const goal = goals.find(item => item.id === Number(button.dataset.deleteGoal));
  if (!confirm(`Delete the goal "${goal.name}"? Money you saved for it stays in your savings.`)) return;
  await fetch(`/api/goals/${goal.id}`, { method: 'DELETE' });
  goals = goals.filter(item => item !== goal);
  transactions.forEach(item => { if (item.goal_id === goal.id) item.goal_id = null; });
  renderApp();
  showToast(`Goal "${goal.name}" removed.`);
});

// ---------- Light / dark mode ----------
const themeToggle = document.querySelector('#theme-toggle');
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.querySelector('.theme-toggle-knob').textContent = theme === 'dark' ? '🌙' : '☀️';
  themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  try { localStorage.setItem('spendwise-theme', theme); } catch (e) {}
  if (spendingChart) renderChart(); // redraw so the chart colours match the new theme
  if (trendChart) renderTrend();
}
themeToggle.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});
applyTheme(document.documentElement.dataset.theme || 'light');

// ---------- Analytics page ----------

function getMonthlyTotals() {
  const months = {};
  transactions.forEach(item => {
    const key = item.date.slice(0, 7); // "2026-11"
    months[key] = months[key] || { income: 0, expense: 0, savings: 0 };
    months[key][item.type] += item.amount;
  });
  return Object.keys(months).sort().slice(-6).map(key => [key, months[key]]); // last 6 months
}

function renderTrend() {
  if (trendChart) trendChart.destroy();
  const months = getMonthlyTotals();
  const monthLabel = key => new Date(`${key}-01T12:00:00`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
  const series = [['Income', 'income', '--success'], ['Expenses', 'expense', '--accent'], ['Savings', 'savings', '--primary']];
  trendChart = new Chart(document.querySelector('#trend-chart'), {
    type: 'bar',
    data: {
      labels: months.map(([key]) => monthLabel(key)),
      datasets: series.map(([label, key, colour]) => ({
        label, data: months.map(([, totals]) => totals[key]),
        backgroundColor: cssVar(colour), borderRadius: 6, maxBarThickness: 30
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: cssVar('--muted'), usePointStyle: true, boxWidth: 8, font: { family: 'DM Sans' } } },
        tooltip: { callbacks: { label: context => ` ${context.dataset.label}: ${money(context.raw)}` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: cssVar('--muted') } },
        y: { grid: { color: cssVar('--line') }, border: { display: false }, ticks: { color: cssVar('--muted'), callback: value => money(value) } }
      }
    }
  });
}

function renderCategoryBars() {
  const box = document.querySelector('#category-bars');
  const categories = getExpenseCategories();
  if (!categories.length) { box.innerHTML = '<p class="goal-empty">No expenses yet.</p>'; return; }
  const biggest = categories[0][1];
  box.innerHTML = categories.map(([category, amount]) => `
    <button type="button" class="category-bar" data-category="${escapeHTML(category)}">
      <span class="category-bar-top"><span>${categoryIcons[category] || '•'} ${escapeHTML(category)}</span><span>${money(amount)}</span></span>
      <span class="category-bar-track"><span style="background:${categoryColors[category] || categoryColors.Other}" data-width="${(amount / biggest * 100).toFixed(1)}"></span></span>
    </button>`).join('');
  // grow the bars after they're on screen, so they animate
  requestAnimationFrame(() => requestAnimationFrame(() => {
    box.querySelectorAll('[data-width]').forEach(bar => { bar.style.width = `${bar.dataset.width}%`; });
  }));
}

// Clicking a category anywhere jumps to Transactions, searched for that category.
const filterLabels = { all: 'All types', expense: 'Expenses only', income: 'Income only', savings: 'Savings only' };
function setFilter(type) {
  currentFilter = type;
  filterButton.innerHTML = `${filterLabels[type]} <span>⌄</span>`;
}
function exploreCategory(category) {
  setFilter('all');
  searchInput.value = category;
  goTo('transactions');
}
document.addEventListener('click', event => {
  const target = event.target.closest('.legend-item[data-category], .category-bar[data-category]');
  if (target) exploreCategory(target.dataset.category);
});

// ---------- Confetti ----------
function launchConfetti() {
  if (reduceMotion()) return;
  const colours = [cssVar('--accent'), cssVar('--primary'), '#FFFFFF', '#F5A524', '#17A974'];
  for (let i = 0; i < 90; i++) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.setProperty('--x', `${Math.random() * 100}vw`);
    piece.style.setProperty('--dx', `${(Math.random() - 0.5) * 240}px`);
    piece.style.setProperty('--rot', `${Math.random() * 720 - 360}deg`);
    piece.style.setProperty('--dur', `${1.6 + Math.random() * 1.4}s`);
    piece.style.animationDelay = `${Math.random() * 0.3}s`;
    piece.style.background = colours[i % colours.length];
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 3600);
  }
}

// ---------- Pages ----------
// Each sidebar link is its own page. Sections say which pages they belong to with data-views="...".
const pages = {
  overview: { name: 'Overview', title: 'Your money, at a glance', subtitle: "Here's what's happening with your finances." },
  savings: { name: 'Savings', title: 'Your savings', subtitle: "Every rupee you've put aside, and where it lives." },
  wishlist: { name: 'Wishlist', title: 'Your wishlist', subtitle: 'Save up for the things you love, one step at a time.' },
  analytics: { name: 'Analytics', title: 'Your spending, decoded', subtitle: 'See where your money goes and how it changes month to month.' },
  transactions: { name: 'Transactions', title: 'Every transaction', subtitle: 'Search, filter and tidy up your money history.' }
};
const transactionPanelText = {
  overview: ['Recent transactions', 'Your latest activity'],
  savings: ['Savings history', 'Every deposit into your pots and goals'],
  transactions: ['All transactions', 'Search by name, category or date']
};
let currentPage = 'overview';
const pageFromHash = () => { const name = location.hash.replace('#/', ''); return pages[name] ? name : 'overview'; };

function goTo(page) {
  if (location.hash === `#/${page}`) showPage(page);
  else location.hash = `#/${page}`; // changing the hash triggers showPage (and makes Back work)
}

function showPage(page) {
  currentPage = page;
  const info = pages[page];
  document.querySelectorAll('[data-views]').forEach(section => {
    section.classList.toggle('hidden', !section.dataset.views.split(' ').includes(page));
  });
  // replay the entrance animation, one section after another
  document.querySelectorAll('.page-heading, [data-views]:not(.hidden)').forEach((section, index) => {
    section.classList.remove('view-enter');
    void section.offsetWidth;
    section.style.setProperty('--i', index);
    section.classList.add('view-enter');
  });
  document.querySelectorAll('.nav-link[data-page]').forEach(link => link.classList.toggle('active', link.dataset.page === page));
  document.querySelector('#page-title').innerHTML = `${escapeHTML(info.title)}<span>.</span>`;
  document.querySelector('#page-subtitle').textContent = info.subtitle;
  document.querySelector('#breadcrumb-current').textContent = info.name;
  document.title = `${info.name} · SpendWise`;
  if (transactionPanelText[page]) {
    document.querySelector('#tx-title').textContent = transactionPanelText[page][0];
    document.querySelector('#tx-subtitle').textContent = transactionPanelText[page][1];
    document.querySelector('.transaction-actions').classList.toggle('hidden', page !== 'transactions');
    renderTransactions();
  }
  if (page === 'overview' || page === 'analytics') renderChart();
  if (page === 'analytics') { renderTrend(); renderCategoryBars(); }
  window.scrollTo({ top: 0 });
}
window.addEventListener('hashchange', () => showPage(pageFromHash()));

document.querySelector('[data-soon]').addEventListener('click', event => {
  event.preventDefault();
  showToast('Budgets are coming soon. Stay tuned! 🚧');
});

// Summary cards are shortcuts: Income → income transactions, Saved → Savings page, etc.
document.querySelectorAll('[data-go]').forEach(card => {
  const open = () => {
    if (card.dataset.filter) { setFilter(card.dataset.filter); searchInput.value = ''; }
    goTo(card.dataset.go);
  };
  card.addEventListener('click', open);
  card.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); }
  });
});

// Keyboard shortcuts: N = new transaction, 1–5 = switch pages
document.addEventListener('keydown', event => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.target.closest('input, select, textarea') || !modal.classList.contains('hidden')) return;
  if (event.key === 'n' || event.key === 'N') { event.preventDefault(); openModal(); return; }
  const page = Object.keys(pages)[Number(event.key) - 1];
  if (page) goTo(page);
});

document.querySelector('#page-date').textContent = new Date()
  .toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
showPage(pageFromHash());

async function loadTransactions() {
  const res = await fetch('/api/transactions');
  if (res.status === 401) { window.location.href = '/login'; return; } // not logged in
  transactions = await res.json();
  const goalsRes = await fetch('/api/goals');
  if (goalsRes.ok) goals = await goalsRes.json();
  renderApp();
  const me = await fetch('/api/me');
  if (me.ok) document.querySelector('#username-label').textContent = (await me.json()).username;
}

document.querySelector('#logout-button').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login';
});
loadTransactions();