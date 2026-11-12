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
  Food: '#B8674A', Shopping: '#8A6BA3', Transport: '#4F7E9C',
  Education: '#3E8C70', Bills: '#D6B77A', Health: '#B5617A',
  Salary: '#174C3C', Freelance: '#6FA08A', Other: '#AAB0A6',
  Savings: '#A8C3A0', Stocks: '#5E8C73', 'Emergency fund': '#D6B77A', Goals: '#C2A36A'
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
let profile = null;    // your profile (name, photo...) once loaded
let homeBuddy = null;  // SpendBuddy the crab on the Overview (see buddy.js)
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
    return `<div class="pot tilt ${pot.category === 'Emergency fund' ? 'emergency' : ''}">
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
  renderProfile();
  renderSpotlight();
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
  let res;
  try {
    res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(details)
    });
  } catch {
    error.textContent = 'Can\'t reach the server. Is "python main.py" still running in the terminal?';
    return;
  }
  if (res.status === 401) { window.location.href = '/login'; return; } // logged out
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    error.textContent = data.error || 'Could not save. Try again.';
    return;
  }
  const saved = await res.json();
  transactions.push(saved);
  closeModal();
  renderApp();
  buddyReact(type);
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
  const result = await sendJSON(`/api/transactions/${id}`, 'DELETE');
  if (!result) return;
  if (!result.ok) { showToast(result.data.error || 'Could not delete. Try again.'); return; }
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
    // Back-of-card stats
    const deposits = transactions.filter(item => item.goal_id === goal.id).sort((a, b) => a.date.localeCompare(b.date));
    const average = deposits.length ? saved / deposits.length : 0;
    const left = Math.max(0, goal.target - saved);
    const depositsToGo = average > 0 ? Math.ceil(left / average) : 0;
    const pace = done ? 'Fully funded. Enjoy it! 🎉'
      : depositsToGo ? `About ${depositsToGo} more deposit${depositsToGo === 1 ? '' : 's'} like your average and it's yours!`
      : 'Add your first deposit to see your pace.';
    const stat = (label, value) => `<div class="goal-stat"><span>${label}</span><strong>${value}</strong></div>`;
    return `<article class="goal-card tilt ${done ? 'done' : ''}">
      <div class="goal-flip-inner">
        <div class="goal-face goal-front">
          <div class="goal-top">
            <span class="goal-emoji">${escapeHTML(goal.emoji)}</span>
            <div class="goal-title"><strong>${escapeHTML(goal.name)}</strong><span>${money(saved)} of ${money(goal.target)}</span></div>
            <button type="button" class="goal-flip-button" data-flip title="Flip for stats" aria-label="Show stats for ${escapeHTML(goal.name)}">↻</button>
            <button type="button" class="goal-delete" data-delete-goal="${goal.id}" title="Delete goal" aria-label="Delete goal ${escapeHTML(goal.name)}">×</button>
          </div>
          <div class="goal-track"><span style="width:${percent}%"></span></div>
          <div class="goal-meta"><strong>${percent}%</strong><span>${done ? 'Ready to buy! 🛍️' : `${money(left)} to go`}</span></div>
          <p class="goal-quote">“${goalQuote(goal, exactPercent)}”</p>
          ${done ? '' : `<form class="goal-deposit" data-goal-id="${goal.id}">
            <input name="amount" type="number" min="1" step="0.01" required placeholder="Add ₹" aria-label="Amount to add to ${escapeHTML(goal.name)}" />
            <button type="submit">Add money</button>
          </form>`}
        </div>
        <div class="goal-face goal-back" aria-hidden="true">
          <div class="goal-top">
            <span class="goal-emoji">${escapeHTML(goal.emoji)}</span>
            <div class="goal-title"><strong>${escapeHTML(goal.name)} stats</strong><span>${percent}% there</span></div>
          </div>
          <div class="goal-stats">
            ${stat('Deposits', deposits.length)}
            ${stat('Started', deposits.length ? prettyDate(deposits[0].date) : '—')}
            ${stat('Last added', deposits.length ? prettyDate(deposits[deposits.length - 1].date) : '—')}
            ${stat('Biggest deposit', deposits.length ? money(Math.max(...deposits.map(item => item.amount))) : '—')}
            ${stat('Average deposit', deposits.length ? money(average) : '—')}
          </div>
          <p class="goal-pace">${pace}</p>
          <button type="button" class="goal-back-button" data-flip>← Back</button>
        </div>
      </div>
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
  const result = await sendJSON('/api/goals', 'POST', {
    name: goalForm.elements.name.value,
    target: Number(goalForm.elements.target.value),
    emoji: goalForm.elements.emoji.value
  });
  if (!result) return;
  if (!result.ok) { showToast(result.data.error || 'Could not add the goal.'); return; }
  const goal = result.data;
  goals.push(goal);
  goalForm.reset();
  goalForm.classList.add('hidden');
  renderApp(); // also updates the Overview spotlight and profile stats
  showToast(`New goal: ${goal.emoji} ${goal.name}. Let's make it happen!`);
});

// "Add money" on a goal card
goalGrid.addEventListener('submit', async event => {
  const depositForm = event.target.closest('.goal-deposit');
  if (!depositForm) return;
  event.preventDefault();
  const goal = goals.find(item => item.id === Number(depositForm.dataset.goalId));
  const amount = Number(depositForm.elements.amount.value);
  const result = await sendJSON(`/api/goals/${goal.id}/deposit`, 'POST', { amount, date: todayISO() });
  if (result && result.ok && homeBuddy) { homeBuddy.celebrate(); homeBuddy.say(`Closer to your ${goal.name}! 🎯`); }
  if (!result) return;
  if (!result.ok) { showToast(result.data.error || 'Could not add money. Try again.'); return; }
  transactions.push(result.data);
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
  const result = await sendJSON(`/api/goals/${goal.id}`, 'DELETE');
  if (!result) return;
  if (!result.ok) { showToast(result.data.error || 'Could not delete the goal.'); return; }
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
  const colours = [cssVar('--gold'), cssVar('--primary'), '#A8C3A0', '#F6F5EF', '#B8975A'];
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
  transactions: { name: 'Transactions', title: 'Every transaction', subtitle: 'Search, filter and tidy up your money history.' },
  profile: { name: 'Profile', title: 'Your profile', subtitle: 'Your photo, your details, your money story.' }
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
  document.querySelector('.profile-row').classList.toggle('active', page === 'profile');
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
  if (page === 'overview') renderHeadline();
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

// ---------- 3D tilt ----------
// Cards with class "tilt" lean towards the mouse. Skipped on touch screens and with "reduce motion".
const canTilt = () => matchMedia('(hover: hover) and (pointer: fine)').matches && !reduceMotion();
let tiltTarget = null;
function resetTilt(card) {
  card.classList.remove('tilting');
  ['--rx', '--ry', '--px', '--py'].forEach(name => card.style.removeProperty(name));
}
document.addEventListener('pointermove', event => {
  let card = canTilt() ? event.target.closest('.tilt') : null;
  if (card && card.contains(document.activeElement) && document.activeElement.matches('input, select')) card = null; // hold still while typing
  if (tiltTarget && tiltTarget !== card) resetTilt(tiltTarget);
  tiltTarget = card;
  if (!card) return;
  const box = card.getBoundingClientRect();
  const x = ((event.clientX - box.left) / box.width) * 2 - 1;  // -1 = left edge, 1 = right edge
  const y = ((event.clientY - box.top) / box.height) * 2 - 1;  // -1 = top edge, 1 = bottom edge
  const strength = card.classList.contains('goal-card') ? 6 : 10;  // degrees
  card.classList.add('tilting');
  card.style.setProperty('--rx', `${(-y * strength).toFixed(2)}deg`);
  card.style.setProperty('--ry', `${(x * strength).toFixed(2)}deg`);
  card.style.setProperty('--px', x.toFixed(3));
  card.style.setProperty('--py', y.toFixed(3));
});
document.documentElement.addEventListener('pointerleave', () => {
  if (tiltTarget) resetTilt(tiltTarget);
  tiltTarget = null;
});

// Flip goal cards to see their stats
goalGrid.addEventListener('click', event => {
  const button = event.target.closest('[data-flip]');
  if (!button) return;
  const card = button.closest('.goal-card');
  const flipped = card.classList.toggle('flipped');
  card.querySelector('.goal-front').setAttribute('aria-hidden', String(flipped));
  card.querySelector('.goal-back').setAttribute('aria-hidden', String(!flipped));
});

// ---------- Personal touches on the Overview page ----------
const localDay = date => date.toLocaleDateString('en-CA'); // "2026-11-09" in your own time zone

function monthStats() {
  const now = new Date();
  const thisMonth = localDay(now).slice(0, 7);
  const lastMonth = localDay(new Date(now.getFullYear(), now.getMonth() - 1, 1)).slice(0, 7);
  const expensesIn = month => transactions.filter(item => item.type === 'expense' && item.date.startsWith(month));
  const spent = sum(expensesIn(thisMonth));
  const lastSpent = sum(expensesIn(lastMonth));
  const byCategory = {};
  expensesIn(thisMonth).forEach(item => { byCategory[item.category] = (byCategory[item.category] || 0) + item.amount; });
  return {
    name: now.toLocaleDateString('en-IN', { month: 'long' }),
    spent,
    change: lastSpent ? Math.round((spent - lastSpent) / lastSpent * 100) : null, // % vs last month
    top: Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0] || null
  };
}

// How many days in a row you've logged at least one transaction (today, or up to yesterday).
function loggingStreak() {
  const days = new Set(transactions.map(item => item.date));
  const day = new Date();
  if (!days.has(localDay(day))) day.setDate(day.getDate() - 1);
  let streak = 0;
  while (days.has(localDay(day))) { streak++; day.setDate(day.getDate() - 1); }
  return streak;
}

function closestGoal() {
  return goals
    .map(goal => ({ goal, percent: goalSaved(goal) / goal.target * 100 }))
    .filter(item => item.percent < 100)
    .sort((a, b) => b.percent - a.percent)[0] || null;
}

function greetingTitle() {
  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'Up late' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : hour < 21 ? 'Good evening' : 'Good night';
  const firstName = profile ? (profile.display_name || profile.username).trim().split(/\s+/)[0] : '';
  return firstName ? `${greeting}, ${firstName}` : greeting;
}

// One line about YOUR money, picked from whatever is most worth saying right now.
function personalMessage() {
  if (!transactions.length) return "Let's get started: add your first transaction and watch this page come alive.";
  const totals = getTotals();
  const month = monthStats();
  const near = closestGoal();
  if (totals.balance < 0) return `Heads up: you've spent and saved ${money(-totals.balance)} more than you've earned. Time to rebalance.`;
  if (near && near.percent >= 75) return `You're ${Math.floor(near.percent)}% of the way to your ${near.goal.name}. So close! 🎯`;
  if (month.change !== null && month.change < 0) return `You've spent ${Math.abs(month.change)}% less than last month so far. Nice work! 🙌`;
  if (totals.savingsRate >= 20) return `You're putting ${totals.savingsRate}% of your income aside. That's brilliant! 💪`;
  return "Here's what's happening with your money today.";
}

function renderHeadline() {
  if (currentPage !== 'overview') return;
  document.querySelector('#page-title').innerHTML = `${escapeHTML(greetingTitle())}<span>.</span><i class="wave" aria-hidden="true">👋</i>`;
  document.querySelector('#page-subtitle').textContent = personalMessage();
  if (homeBuddy) homeBuddy.setMood(buddyMood());
}

function renderSpotlight() {
  // 1) Closest wishlist goal
  const goalBox = document.querySelector('#goal-spotlight');
  const near = closestGoal();
  if (near) {
    const percent = Math.floor(near.percent);
    goalBox.innerHTML = `
      <p class="spotlight-label">🎯 Closest goal</p>
      <div class="spotlight-goal">
        <span class="goal-emoji">${escapeHTML(near.goal.emoji)}</span>
        <div><strong>${escapeHTML(near.goal.name)}</strong><span>${money(near.goal.target - goalSaved(near.goal))} to go</span></div>
        <b>${percent}%</b>
      </div>
      <div class="goal-track"><span style="width:${percent}%"></span></div>
      <p class="spotlight-note">“${goalQuote(near.goal, near.percent)}”</p>`;
  } else if (goals.length) {
    goalBox.innerHTML = `<p class="spotlight-label">🏆 Wishlist</p><p class="spotlight-big">All goals reached!</p><p class="spotlight-note">Time to dream up a new one?</p>`;
  } else {
    goalBox.innerHTML = `<p class="spotlight-label">✨ Wishlist</p><p class="spotlight-big">Dreaming of something?</p><p class="spotlight-note">Add a wishlist goal and watch your progress here.</p>`;
  }

  // 2) This month vs last month + logging streak
  const month = monthStats();
  const streak = loggingStreak();
  const change = month.change === null
    ? '<span class="pill">First month tracked</span>'
    : `<span class="pill ${month.change <= 0 ? 'good' : 'bad'}">${month.change <= 0 ? '↓' : '↑'} ${Math.abs(month.change)}% vs last month</span>`;
  document.querySelector('#month-spotlight').innerHTML = `
    <p class="spotlight-label">📅 ${month.name} so far</p>
    <p class="spotlight-big">${money(month.spent)}<small>spent</small></p>
    ${change}
    <p class="spotlight-line">${month.top ? `Most spent on <strong>${escapeHTML(month.top[0])}</strong> (${money(month.top[1])})` : 'No spending yet this month 🎉'}</p>
    <p class="spotlight-note">${streak ? `🔥 ${streak}-day logging streak. Keep it going!` : 'Log something today to start a streak 🔥'}</p>`;
}

// 3) Tip of the day (a different one each day; the button shows another)
const moneyTips = [
  'Try the 24-hour rule: wait a day before buying anything you don\'t need right now.',
  'Pay yourself first: move money into savings on the day your income arrives.',
  'Small daily spends add up. ₹100 a day is ₹36,500 a year.',
  'Give every rupee a job: spending, saving or investing.',
  'An emergency fund covering 3–6 months of expenses is a great safety net.',
  'Cancel subscriptions you haven\'t used in the last month.',
  'Cook at home one extra night a week and watch your Food category shrink.',
  'Check your top spending category once a week. Noticing is half the battle.',
  'Saving ₹437? Round it up to ₹500. Future you will say thanks.',
  'Celebrate milestones. Progress deserves a small reward.'
];
const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
let tipIndex = dayOfYear % moneyTips.length;
const tipText = document.querySelector('#tip-text');
tipText.textContent = moneyTips[tipIndex];
document.querySelector('#tip-button').addEventListener('click', () => {
  tipIndex = (tipIndex + 1) % moneyTips.length;
  tipText.style.opacity = 0;
  setTimeout(() => { tipText.textContent = moneyTips[tipIndex]; tipText.style.opacity = 1; }, 200);
});

// ---------- Profile ----------
const initials = person => (person.display_name || person.username || '?')
  .split(/\s+/).filter(Boolean).map(word => word[0]).join('').slice(0, 2).toUpperCase();

// Every element with data-avatar shows your photo, or your initials if you haven't added one.
function renderAvatars() {
  document.querySelectorAll('[data-avatar]').forEach(element => {
    if (profile && profile.avatar_version) {
      element.innerHTML = `<img src="/api/profile/photo?v=${profile.avatar_version}" alt="" />`;
    } else {
      element.textContent = profile ? initials(profile) : 'SW';
    }
  });
}

function renderProfile() {
  if (!profile) return;
  const name = profile.display_name || profile.username;
  document.querySelector('#username-label').textContent = name;
  document.querySelector('#profile-handle').textContent = `@${profile.username}`;
  renderAvatars();
  document.querySelector('#profile-name').textContent = name;
  document.querySelector('#profile-username').textContent = `@${profile.username}`;
  const bio = document.querySelector('#profile-bio');
  bio.textContent = profile.bio || "No bio yet. Tell us what you're saving for!";
  bio.classList.toggle('empty', !profile.bio);
  document.querySelector('#profile-since').textContent = profile.created_at
    ? `Member since ${new Date(`${profile.created_at}T12:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`
    : '';
  document.querySelector('#remove-photo-button').classList.toggle('hidden', !profile.avatar_version);
  renderHeadline();
  const reached = goals.filter(goal => goalSaved(goal) >= goal.target).length;
  document.querySelector('#profile-stats').innerHTML = [
    ['Transactions', transactions.length],
    ['Saved & invested', money(getTotals().savings)],
    ['Goals reached', `${reached}/${goals.length}`]
  ].map(([label, value]) => `<div class="profile-stat"><strong>${value}</strong><span>${label}</span></div>`).join('');
}

const profileForm = document.querySelector('#profile-form');
function fillProfileForm() {
  profileForm.elements.display_name.value = profile.display_name;
  profileForm.elements.bio.value = profile.bio;
  profileForm.elements.email.value = profile.email;
  updateBioCount();
}
function updateBioCount() {
  document.querySelector('#bio-count').textContent = `${profileForm.elements.bio.value.length}/160`;
}
profileForm.elements.bio.addEventListener('input', updateBioCount);

// Small helper: send JSON, and turn "server is off" into a friendly message.
async function sendJSON(url, method, body) {
  try {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.status === 401 && url !== '/api/profile/password') { window.location.href = '/login'; return null; }
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: { error: 'Can\'t reach the server. Is "python main.py" still running?' } };
  }
}

profileForm.addEventListener('submit', async event => {
  event.preventDefault();
  const errorText = document.querySelector('#profile-error');
  errorText.textContent = '';
  const result = await sendJSON('/api/profile', 'PUT', {
    display_name: profileForm.elements.display_name.value,
    bio: profileForm.elements.bio.value,
    email: profileForm.elements.email.value
  });
  if (!result) return;
  if (!result.ok) { errorText.textContent = result.data.error || 'Could not save. Try again.'; return; }
  profile = result.data;
  fillProfileForm();
  renderProfile();
  showToast('Profile saved ✨');
});

const passwordForm = document.querySelector('#password-form');
passwordForm.addEventListener('submit', async event => {
  event.preventDefault();
  const errorText = document.querySelector('#password-error');
  errorText.textContent = '';
  const { current, new: newPassword, confirm } = passwordForm.elements;
  if (newPassword.value !== confirm.value) { errorText.textContent = "The two new passwords don't match."; return; }
  const result = await sendJSON('/api/profile/password', 'POST', { current: current.value, new: newPassword.value });
  if (!result.ok) { errorText.textContent = result.data.error || 'Could not change the password.'; return; }
  passwordForm.reset();
  showToast('Password changed 🔒');
});

// Photos are cropped to a square and shrunk in the browser before uploading, so they're small and fast.
function squarePhoto(file, size = 320) {
  return createImageBitmap(file).then(bitmap => new Promise((resolve, reject) => {
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    canvas.getContext('2d').drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Could not convert'))), 'image/jpeg', 0.88);
  }));
}

const photoInput = document.querySelector('#photo-input');
photoInput.addEventListener('change', async () => {
  const file = photoInput.files[0];
  photoInput.value = '';
  if (!file) return;
  let photo;
  try { photo = await squarePhoto(file); } catch { showToast("Couldn't read that image. Try a JPG or PNG."); return; }
  const body = new FormData();
  body.append('photo', photo, 'photo.jpg');
  const bigAvatar = document.querySelector('#profile-photo');
  bigAvatar.classList.add('uploading');
  try {
    const res = await fetch('/api/profile/photo', { method: 'POST', body });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { showToast(data.error || 'Could not upload the photo.'); return; }
    profile = data;
    renderProfile();
    showToast('Looking good! 📸 Photo updated.');
  } catch {
    showToast('Can\'t reach the server. Is "python main.py" still running?');
  } finally {
    bigAvatar.classList.remove('uploading');
  }
});

document.querySelector('#remove-photo-button').addEventListener('click', async () => {
  const result = await sendJSON('/api/profile/photo', 'DELETE');
  if (!result) return;
  if (!result.ok) { showToast(result.data.error || 'Could not remove the photo.'); return; }
  profile = result.data;
  renderProfile();
  showToast('Photo removed.');
});

// ---------- SpendBuddy 🦀 ----------
const firstName = () => (profile ? (profile.display_name || profile.username).trim().split(/\s+/)[0] : 'friend');

// Mood follows your money (and the clock)
function buddyMood() {
  const hour = new Date().getHours();
  if (hour >= 23 || hour < 5) return 'sleepy';
  if (!transactions.length) return 'happy';
  const totals = getTotals();
  if (totals.balance < 0) return 'worried';
  const near = closestGoal();
  if ((near && near.percent >= 75) || totals.savingsRate >= 20) return 'excited';
  return 'happy';
}

// Cheeky things SpendBuddy might say when you click it
function buddyLines() {
  const lines = [
    `Hey ${firstName()}! 👋`,
    'Snip snip! ✂️ That\'s me trimming your expenses.',
    'Pinch your pennies, not me! 🦀',
    'I\'m a crab. Holding on to money is kind of my thing 💰',
    'Who, me? I didn\'t touch your savings 👀',
    'Psst… press N. I love new transactions.',
    'Click me again. I dare you 😏'
  ];
  if (!transactions.length) return [...lines, 'No transactions yet? I\'m bored. Add one! 🥱'];
  const totals = getTotals();
  const month = monthStats();
  const near = closestGoal();
  const streak = loggingStreak();
  lines.push(totals.balance >= 0
    ? `You've got ${money(totals.balance)} left to spend. Don't make me snap 😤`
    : `We're ${money(-totals.balance)} over. Hide the wallet! 🙈`);
  if (totals.savings > 0) lines.push(`${money(totals.savings)} tucked away. I'm guarding it 🛡️`);
  if (near) lines.push(`Only ${money(near.goal.target - goalSaved(near.goal))} to go for your ${near.goal.name}! ${near.goal.emoji}`);
  if (month.top) lines.push(`I saw all that ${month.top[0]} spending 👀 ${money(month.top[1])} this ${month.name}!`);
  if (month.change !== null) lines.push(month.change <= 0
    ? `Spending is down ${Math.abs(month.change)}% vs last month. Proud of you 🥹`
    : `Spending is up ${month.change}% vs last month. Hmm… 🤨`);
  if (streak > 1) lines.push(`🔥 ${streak}-day streak! Break it and I pinch.`);
  return lines;
}

function buddyReact(type) {
  if (!homeBuddy) return;
  if (type === 'expense') {
    homeBuddy.sideEye();
    homeBuddy.say(Math.random() < 0.5 ? '👀 Spending again? I\'m watching…' : 'Noted. Judging a little 😏');
    return;
  }
  homeBuddy.celebrate();
  homeBuddy.say(type === 'income' ? 'Ka-ching! 💰🦀' : 'Snip snip, saved! ✨');
}

let greeted = false;
function greetWithBuddy() {
  if (greeted || currentPage !== 'overview' || !homeBuddy) return;
  greeted = true;
  setTimeout(() => homeBuddy.say(`Hey ${firstName()}! SpendBuddy here 🦀 Click me!`), 900);
}

homeBuddy = SpendBuddy.create(document.querySelector('#buddy-home'));
homeBuddy.setLines(buddyLines);
homeBuddy.setMood(buddyMood());

async function loadTransactions() {
  const res = await fetch('/api/transactions');
  if (res.status === 401) { window.location.href = '/login'; return; } // not logged in
  transactions = await res.json();
  const goalsRes = await fetch('/api/goals');
  if (goalsRes.ok) goals = await goalsRes.json();
  renderApp();
  const me = await fetch('/api/me');
  if (me.ok) {
    profile = await me.json();
    fillProfileForm();
    renderProfile();
    greetWithBuddy();
  }
}

document.querySelector('#logout-button').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login';
});
loadTransactions();