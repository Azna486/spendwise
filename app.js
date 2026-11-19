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
  Education: '#3E8C70', Bills: '#D4B06A', Health: '#B5617A',
  Salary: '#142B52', Freelance: '#6FA08A', Other: '#A9AEB9',
  Savings: '#5D7EA8', Stocks: '#5E8C73', 'Emergency fund': '#D4B06A', Goals: '#C9A660'
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
let homeBuddy = null;  // Fin, the SpendBuddy jellyfish that floats around the app (see buddy.js)
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

// The transactions the current page shows (newest first), after search + type filter.
function filteredTransactions() {
  // Overview: latest 5 of everything. Savings: only savings. Transactions: everything, with search + filter.
  const searchTerm = currentPage === 'transactions' ? searchInput.value.trim().toLowerCase() : '';
  const typeFilter = { overview: 'all', savings: 'savings' }[currentPage] || currentFilter;
  return transactions
    .filter(item => typeFilter === 'all' || item.type === typeFilter)
    .filter(item => `${item.name} ${item.category} ${item.date}`.toLowerCase().includes(searchTerm))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
}

function renderTransactions() {
  const searchTerm = currentPage === 'transactions' ? searchInput.value.trim() : '';
  const typeFilter = { overview: 'all', savings: 'savings' }[currentPage] || currentFilter;
  const filtered = filteredTransactions();
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
        <td><div class="transaction-name"><span class="transaction-icon ${iconClass}" ${iconStyle(item.category)}>${escapeHTML(categoryIcons[item.category] || '•')}</span><div>${escapeHTML(item.name)}${stockDetail(item)}${txMeta(item)}</div></div></td>
        <td><span class="category-pill">${escapeHTML(item.category)}</span></td>
        <td>${prettyDate(item.date)}</td>
        <td class="amount ${amountClass}">${sign}${money(item.amount)}</td>
        <td><div class="row-actions">
          <button class="row-menu" data-edit-id="${item.id}" aria-label="Edit ${escapeHTML(item.name)}" title="Edit transaction">✎</button>
          <button class="row-menu delete" data-delete-id="${item.id}" aria-label="Delete ${escapeHTML(item.name)}" title="Delete transaction">×</button>
        </div></td>
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
  // Organisations don't invest in shares, so they only get the Emergency fund and Savings pots
  document.querySelector('#pot-grid').innerHTML = savingsPots.filter(pot => !(isOrg() && pot.category === 'Stocks')).map(pot => {
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
  renderBudgets();
  renderReport();
  renderEvents();
  renderOrgPanel();
  renderCalendar();
  renderCategoryManager();
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
  // Organisations say where income came from (sponsorship, contributions…); individuals don't need to
  categoryField.classList.toggle('hidden', type === 'income' && !isOrg());
  document.querySelector('#quick-category').classList.add('hidden');
  if (type === 'income' && !isOrg()) return;
  categoryField.firstChild.textContent = type === 'income' ? 'Where it came from' : 'Category';
  const list = type === 'income' ? incomeSources
    : type === 'savings' && isOrg() ? categoriesByType.savings.filter(name => name !== 'Stocks') // no stocks for organisations
    : categoriesByType[type];
  form.elements.category.innerHTML = list
    .map(category => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`).join('')
    + (type === 'expense' ? '<option value="__new">＋ New category…</option>' : '');
  document.querySelector('#quick-category').classList.add('hidden');
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

form.elements.type.addEventListener('change', () => { updateCategoryField(); updateStockFields(); updateEventFields(); });
form.elements.category.addEventListener('change', updateStockFields);
let editingId = null; // id of the transaction being edited, or null when adding a new one
const submitButton = form.querySelector('button[type="submit"]');

function openModal(prefill = {}) {
  if (prefill instanceof Event) prefill = {}; // when used directly as a click handler
  editingId = null;
  form.reset();
  form.elements.type.disabled = false;
  form.elements.category.disabled = false;
  if (prefill.type) form.elements.type.value = prefill.type;
  // From inside an event the type is already decided ("Add expense" / "Add money collected"), so hide it
  document.querySelector('#type-field').classList.toggle('hidden', Boolean(prefill.lockType));
  document.querySelector('#type-row').classList.toggle('type-locked', Boolean(prefill.lockType));
  updateCategoryField();
  updateStockFields();
  updateEventFields(prefill.event_id ? String(prefill.event_id) : '', '');
  // nothing left in that row (an individual's income has no category): hide it completely
  document.querySelector('#type-row').classList.toggle('hidden', Boolean(prefill.lockType) && categoryField.classList.contains('hidden'));
  form.elements.date.value = todayISO();
  document.querySelector('#modal-title').textContent = prefill.title || 'Add a transaction';
  submitButton.innerHTML = `${prefill.lockType ? (prefill.type === 'income' ? 'Save money collected' : 'Save expense') : 'Save transaction'} <span>→</span>`;
  document.querySelector('#form-error').textContent = '';
  modal.classList.remove('hidden');
  form.elements.type.focus();
}

// Same pop-up, filled in with an existing transaction so you can fix a mistake.
function openEditModal(item) {
  openModal();
  editingId = item.id;
  const isGoal = item.goal_id != null;
  form.elements.type.value = item.type;
  updateCategoryField();
  if (isGoal) {
    // Wishlist deposits stay Savings → Goals; you can still fix the amount, date or name.
    form.elements.category.innerHTML = '<option>Goals</option>';
    form.elements.type.disabled = true;
    form.elements.category.disabled = true;
  } else if (item.type !== 'income') {
    form.elements.category.value = item.category;
  }
  if (item.type === 'income' && isOrg()) form.elements.category.value = incomeSources.includes(item.category) ? item.category : 'Income';
  updateStockFields();
  updateEventFields(item.event_id ? String(item.event_id) : '', item.paid_by ? String(item.paid_by) : '');
  form.elements.name.value = item.name;
  form.elements.amount.value = item.amount;
  form.elements.date.value = item.date;
  form.elements.stock_name.value = item.stock_name || '';
  form.elements.quantity.value = item.quantity || '';
  document.querySelector('#modal-title').textContent = 'Edit transaction';
  submitButton.innerHTML = 'Save changes <span>✓</span>';
  form.elements.amount.focus();
  form.elements.amount.select();
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
  const type = form.elements.type.value;
  const category = type === 'income' && !isOrg() ? 'Income' : form.elements.category.value;
  if (category === '__new') {
    document.querySelector('#form-error').textContent = 'Add your new category first, or pick one from the list.';
    return;
  }
  const date = String(formData.get('date'));
  const error = document.querySelector('#form-error');
  if (!name || !Number.isFinite(amount) || amount <= 0 || !date) {
    error.textContent = 'Enter a name, a positive amount, and a date.';
    return;
  }
  const details = { name, amount, type, category, date,
    event_id: form.elements.event_id.value ? Number(form.elements.event_id.value) : null,
    paid_by: type === 'expense' && isOrg() && form.elements.paid_by.value ? Number(form.elements.paid_by.value) : null };
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
    res = await fetch(editingId ? `/api/transactions/${editingId}` : '/api/transactions', {
      method: editingId ? 'PUT' : 'POST',
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
  if (editingId) {
    // Swap the old version for the corrected one; everything (totals, budgets, charts) redraws.
    const index = transactions.findIndex(item => item.id === saved.id);
    transactions[index] = saved;
    editingId = null;
    closeModal();
    renderApp();
    showToast(`Updated “${saved.name}” ✓`);
    return;
  }
  transactions.push(saved);
  closeModal();
  renderApp();
  const warning = budgetWarning(saved);
  // SpendBuddy reacts to any expense in a category that's near (80%+) or over its budget this month
  const check = saved.type === 'expense' && saved.date.startsWith(thisMonth())
    && budgetCheck().find(entry => entry.category === saved.category);
  if (check && check.status !== 'ok') buddyBudgetReact(saved); else buddyReact(type);
  showToast(warning || (saved.type === 'savings'
    ? `Added! Your ${saved.category.toLowerCase()} is now ${money(potTotal(saved.category))}.`
    : 'Transaction added successfully.'));
});

searchInput.addEventListener('input', renderTransactions);
filterButton.addEventListener('click', () => {
  const order = ['all', 'expense', 'income', 'savings'];
  setFilter(order[(order.indexOf(currentFilter) + 1) % order.length]);
  renderTransactions();
});
document.querySelector('#show-all-button').addEventListener('click', () => goTo('transactions'));
transactionBody.addEventListener('click', async event => {
  const editButton = event.target.closest('[data-edit-id]');
  if (editButton) {
    const item = transactions.find(entry => entry.id === Number(editButton.dataset.editId));
    if (item) openEditModal(item);
    return;
  }
  const button = event.target.closest('[data-delete-id]');
  if (!button) return;
  const id = Number(button.dataset.deleteId);
  const index = transactions.findIndex(item => item.id === id);
  if (index < 0) return;
  if (!confirm(`Delete “${transactions[index].name}” (${money(transactions[index].amount)})? This can't be undone.`)) return;
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

// ---------- Budgets ----------
// A budget is a monthly limit for one expense category. Spending is worked out here
// from your expense transactions, so budgets update the moment you add or delete one.
let budgets = [];
let budgetsLoaded = false; // becomes true once budgets arrive from the server
const thisMonth = () => todayISO().slice(0, 7);          // "2026-11"
let budgetMonth = thisMonth();
const budgetCategories = () => categoriesByType.expense;
const budgetForm = document.querySelector('#budget-form');
const budgetGrid = document.querySelector('#budget-grid');

const monthLabel = month => new Date(`${month}-01T12:00:00`)
  .toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
function shiftMonth(month, by) {
  const [year, mon] = month.split('-').map(Number);
  const date = new Date(year, mon - 1 + by, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
const daysInMonth = month => { const [y, m] = month.split('-').map(Number); return new Date(y, m, 0).getDate(); };
const spentIn = (category, month) => sum(transactions.filter(item =>
  item.type === 'expense' && item.category === category && item.date.startsWith(month)));

// ok → under 80%, warn → 80–100%, over → past the limit
const budgetStatus = (spent, limit) => spent > limit ? 'over' : spent >= limit * 0.8 ? 'warn' : 'ok';
const statusLabel = { ok: 'On track', warn: 'Almost there', over: 'Over budget' };

// Days you still have to spend in, counting today (0 for past months).
function daysLeft(month) {
  const current = thisMonth();
  if (month < current) return 0;
  if (month > current) return daysInMonth(month);
  return daysInMonth(month) - new Date().getDate() + 1;
}

// Your average monthly spend on a category over the last 3 months (to suggest a limit).
function typicalSpend(category) {
  const months = [1, 2, 3].map(back => shiftMonth(thisMonth(), -back));
  const active = months.filter(month => transactions.some(item => item.date.startsWith(month)));
  if (!active.length) return 0;
  return active.reduce((total, month) => total + spentIn(category, month), 0) / active.length;
}

function renderBudgets() {
  const month = budgetMonth;
  const current = thisMonth();
  document.querySelector('#budget-month-label').textContent = month === current ? `${monthLabel(month)} · this month` : monthLabel(month);
  document.querySelector('#budget-next').disabled = month >= current;

  const rows = budgets.map(budget => {
    const spent = spentIn(budget.category, month);
    return { ...budget, spent, left: budget.monthly_limit - spent, status: budgetStatus(spent, budget.monthly_limit) };
  }).sort((a, b) => b.spent / b.monthly_limit - a.spent / a.monthly_limit);

  const planned = sum(rows.map(row => ({ amount: row.monthly_limit })));
  const spent = sum(rows.map(row => ({ amount: row.spent })));
  const left = planned - spent;
  const days = daysLeft(month);
  const usedPercent = planned ? spent / planned * 100 : 0;
  const totalStatus = budgetStatus(spent, planned || 1);

  const stat = (label, value, extra = '') => `<div class="budget-stat ${extra}"><span>${label}</span><strong>${value}</strong></div>`;
  document.querySelector('#budget-stats').innerHTML = [
    stat('Budgeted', money(planned)),
    stat('Spent', money(spent)),
    left >= 0 ? stat('Left to spend', money(left), 'good') : stat('Over by', money(-left), 'bad'),
    month < current ? stat('Month', 'Finished')
      : stat('Safe to spend / day', planned && left > 0 && days ? money(left / days) : '—')
  ].join('');
  const fill = document.querySelector('#budget-total-fill');
  fill.style.width = `${Math.min(100, usedPercent)}%`;
  fill.className = totalStatus;

  // A friendly sentence about how the month is going
  let note;
  if (!budgets.length) note = 'Add your first budget below to start planning your month. 🌱';
  else if (left < 0) note = `You're ${money(-left)} over your total budget${month === current ? ' this month' : ''}. Next month is a fresh start!`;
  else if (month < current) note = `You stayed within budget in ${monthLabel(month)} and kept ${money(left)}. Well done! 🏆`;
  else if (month === current) {
    const monthPercent = (new Date().getDate() / daysInMonth(month)) * 100;
    note = usedPercent > monthPercent + 10
      ? `You've used ${Math.round(usedPercent)}% of your budget, but only ${Math.round(monthPercent)}% of the month has passed. Maybe slow down a little.`
      : `You've used ${Math.round(usedPercent)}% of your budget and ${Math.round(monthPercent)}% of the month has passed. You're on track! ✨`;
  } else note = 'Plan ahead: your budgets apply to this month too.';
  document.querySelector('#budget-note').textContent = note;

  if (homeBuddy) homeBuddy.setMood(buddyMood());
  document.querySelector('#budgets-summary').textContent = budgets.length
    ? `${budgets.length} budget${budgets.length === 1 ? '' : 's'} · ${money(planned)} a month`
    : 'Set a monthly limit for each kind of spending';

  budgetGrid.innerHTML = rows.length ? rows.map(row => {
    const percent = Math.round(row.spent / row.monthly_limit * 100);
    const color = categoryColors[row.category] || categoryColors.Other;
    const detail = row.status === 'over' ? `${money(-row.left)} over budget`
      : days && month >= current ? `${money(row.left)} left · about ${money(row.left / days)}/day`
      : `${money(row.left)} left`;
    return `<article class="budget-card ${row.status}">
      <div class="budget-top">
        <span class="budget-icon" style="color:${color};background:color-mix(in srgb,${color} 16%,transparent)">${escapeHTML(categoryIcons[row.category] || '•')}</span>
        <div class="goal-title"><strong>${escapeHTML(row.category)}</strong><span>${money(row.spent)} of ${money(row.monthly_limit)}</span></div>
        <button type="button" class="budget-edit" data-edit-budget="${row.id}" title="Change limit" aria-label="Change the ${escapeHTML(row.category)} budget">✎</button>
        <button type="button" class="goal-delete" data-delete-budget="${row.id}" title="Delete budget" aria-label="Delete the ${escapeHTML(row.category)} budget">×</button>
      </div>
      <div class="budget-bar"><span class="${row.status}" style="width:${Math.min(100, percent)}%"></span></div>
      <div class="budget-meta"><span class="budget-pill ${row.status}">${statusLabel[row.status]} · ${percent}%</span><span>${detail}</span></div>
    </article>`;
  }).join('') : `<p class="goal-empty">No budgets yet. Try one for Food or Shopping. Those are usually the sneakiest! 🍔🛍️</p>`;

  // Spending this month in categories that have no budget yet
  const unplanned = budgetCategories()
    .filter(category => !budgets.some(budget => budget.category === category))
    .map(category => ({ category, spent: spentIn(category, month) }))
    .filter(item => item.spent > 0)
    .sort((a, b) => b.spent - a.spent);
  document.querySelector('#budget-unplanned').innerHTML = unplanned.length ? `
    <p class="spotlight-label">SPENDING WITHOUT A BUDGET</p>
    <div class="budget-chips">${unplanned.map(item => `<button type="button" class="budget-chip" data-budget-category="${escapeHTML(item.category)}">
      ${categoryIcons[item.category] || '•'} ${escapeHTML(item.category)} · ${money(item.spent)} <b>Set a budget →</b></button>`).join('')}</div>` : '';
}

function openBudgetForm(category, limit) {
  budgetForm.elements.category.innerHTML = budgetCategories().map(name => {
    const has = budgets.some(budget => budget.category === name);
    return `<option value="${name}">${categoryIcons[name] || ''} ${name}${has ? ' (change limit)' : ''}</option>`;
  }).join('');
  const firstFree = budgetCategories().find(name => !budgets.some(budget => budget.category === name)) || budgetCategories()[0];
  budgetForm.elements.category.value = category || firstFree;
  budgetForm.elements.monthly_limit.value = limit || '';
  budgetForm.classList.remove('hidden');
  updateBudgetHint();
  budgetForm.elements.monthly_limit.focus();
}
function closeBudgetForm() { budgetForm.reset(); budgetForm.classList.add('hidden'); }

function updateBudgetHint() {
  const category = budgetForm.elements.category.value;
  const existing = budgets.find(budget => budget.category === category);
  const typical = typicalSpend(category);
  const hint = document.querySelector('#budget-hint');
  hint.innerHTML = typical > 0
    ? `💡 You usually spend about <b>${money(typical)}</b> a month on ${escapeHTML(category)}. <button type="button" class="text-button" id="use-typical">Use ${money(Math.ceil(typical / 100) * 100)}</button>`
    : `💡 Not enough history for ${escapeHTML(category)} yet. Pick a number that feels comfortable.`;
  document.querySelector('#budget-save-button').textContent = existing ? 'Update budget' : 'Save budget';
}

document.querySelector('#new-budget-button').addEventListener('click', () => openBudgetForm());
document.querySelector('#cancel-budget-button').addEventListener('click', closeBudgetForm);
budgetForm.elements.category.addEventListener('change', () => {
  const existing = budgets.find(budget => budget.category === budgetForm.elements.category.value);
  budgetForm.elements.monthly_limit.value = existing ? existing.monthly_limit : '';
  updateBudgetHint();
});
budgetForm.addEventListener('click', event => {
  if (event.target.id !== 'use-typical') return;
  budgetForm.elements.monthly_limit.value = Math.ceil(typicalSpend(budgetForm.elements.category.value) / 100) * 100;
});
document.querySelector('#budget-prev').addEventListener('click', () => { budgetMonth = shiftMonth(budgetMonth, -1); renderBudgets(); });
document.querySelector('#budget-next').addEventListener('click', () => {
  if (budgetMonth < thisMonth()) { budgetMonth = shiftMonth(budgetMonth, 1); renderBudgets(); }
});

budgetForm.addEventListener('submit', async event => {
  event.preventDefault();
  const category = budgetForm.elements.category.value;
  const result = await sendJSON('/api/budgets', 'POST', {
    category, monthly_limit: Number(budgetForm.elements.monthly_limit.value)
  });
  if (!result) return;
  if (!result.ok) { showToast(result.data.error || 'Could not save the budget.'); return; }
  const isNew = !budgets.some(budget => budget.category === category);
  budgets = budgets.filter(budget => budget.category !== category).concat(result.data);
  closeBudgetForm();
  renderApp();
  if (homeBuddy) { homeBuddy.celebrate(); homeBuddy.say(`I'll keep an eye on your ${category} budget 🛡️✨`); }
  showToast(isNew ? `Budget set: ${category} · ${money(result.data.monthly_limit)} a month 🎯`
                  : `${category} budget updated to ${money(result.data.monthly_limit)}.`);
});

budgetGrid.addEventListener('click', async event => {
  const edit = event.target.closest('[data-edit-budget]');
  if (edit) {
    const budget = budgets.find(item => item.id === Number(edit.dataset.editBudget));
    openBudgetForm(budget.category, budget.monthly_limit);
    return;
  }
  const remove = event.target.closest('[data-delete-budget]');
  if (!remove) return;
  const budget = budgets.find(item => item.id === Number(remove.dataset.deleteBudget));
  if (!confirm(`Delete your ${budget.category} budget? Your transactions stay as they are.`)) return;
  const result = await sendJSON(`/api/budgets/${budget.id}`, 'DELETE');
  if (!result) return;
  if (!result.ok) { showToast(result.data.error || 'Could not delete the budget.'); return; }
  budgets = budgets.filter(item => item !== budget);
  renderApp();
  showToast(`${budget.category} budget removed.`);
});
document.querySelector('#budget-unplanned').addEventListener('click', event => {
  const chip = event.target.closest('[data-budget-category]');
  if (!chip) return;
  const category = chip.dataset.budgetCategory;
  openBudgetForm(category, Math.ceil(Math.max(typicalSpend(category), spentIn(category, budgetMonth)) / 100) * 100 || '');
});

// This month's status of every budget, worst first (used by SpendBuddy).
function budgetCheck() {
  return budgets.map(budget => {
    const spent = spentIn(budget.category, thisMonth());
    return { ...budget, spent, percent: Math.round(spent / budget.monthly_limit * 100), status: budgetStatus(spent, budget.monthly_limit) };
  }).sort((a, b) => b.percent - a.percent);
}

// After you add an expense: warn when it pushes a budget past 80% or past its limit.
function budgetWarning(item) {
  if (item.type !== 'expense' || !item.date.startsWith(thisMonth())) return '';
  const budget = budgets.find(entry => entry.category === item.category);
  if (!budget) return '';
  const after = spentIn(item.category, thisMonth());
  const before = after - item.amount;
  const limit = budget.monthly_limit;
  if (after > limit && before <= limit) return `⚠️ That puts you ${money(after - limit)} over your ${item.category} budget.`;
  if (after > limit) return `Added. ${item.category} is now ${money(after - limit)} over budget.`;
  if (after >= limit * 0.8 && before < limit * 0.8) return `Heads up: ${Math.round(after / limit * 100)}% of your ${item.category} budget is used. ${money(limit - after)} left.`;
  return '';
}

// ---------- Custom categories ----------
// Your own expense categories live next to the built-in ones. "Other" always stays last.
let customCategories = [];
const builtInExpense = ['Food', 'Shopping', 'Transport', 'Education', 'Bills', 'Health', 'Other'];
const categoryEmojis = ['🏷️', '🐾', '🏋️', '☕', '🎬', '🎮', '🎁', '🏠', '👶', '💄', '🍺', '✈️', '📱', '🧾', '💊', '🚗', '📚', '🎵', '🛠️', '🌱', '💇', '🧺'];
const categoryPalette = ['#6FA08A', '#B8674A', '#8A6BA3', '#4F7E9C', '#3E8C70', '#D4B06A', '#B5617A', '#142B52', '#5D7EA8', '#C9A660', '#7A8B5C', '#5E6F8C'];
const isCustom = name => customCategories.some(category => category.name === name);
// First palette colour no expense category is using yet (so new categories stand out).
const freeColour = () => categoryPalette.find(colour =>
  !categoriesByType.expense.some(name => (categoryColors[name] || '').toUpperCase() === colour)) || categoryPalette[0];

function applyCustomCategories() {
  customCategories.forEach(category => {
    categoryColors[category.name] = category.color;
    categoryIcons[category.name] = category.icon;
  });
  categoriesByType.expense = [...builtInExpense.slice(0, -1), ...customCategories.map(category => category.name), 'Other'];
}

// Coloured icon style for a category (custom ones don't have a CSS class).
const iconStyle = name => isCustom(name)
  ? `style="color:${categoryColors[name]};background:color-mix(in srgb,${categoryColors[name]} 18%,transparent)"` : '';

const categoryForm = document.querySelector('#category-form');
let chosenColour = categoryPalette[0];
categoryForm.elements.icon.innerHTML = categoryEmojis.map(emoji => `<option>${emoji}</option>`).join('');
form.elements.new_icon.innerHTML = categoryForm.elements.icon.innerHTML;

function renderCategoryManager() {
  const spentOn = name => transactions.filter(item => item.type === 'expense' && item.category === name).length;
  document.querySelector('#categories-summary').textContent = customCategories.length
    ? `${builtInExpense.length} built-in + ${customCategories.length} of your own`
    : 'Add your own, like Pets, Gym or Coffee';
  const chip = (name, removable, id) => `<span class="category-chip ${removable ? 'custom' : ''}">
      <span class="chip-icon" style="color:${categoryColors[name] || categoryColors.Other};background:color-mix(in srgb,${categoryColors[name] || categoryColors.Other} 16%,transparent)">${escapeHTML(categoryIcons[name] || '•')}</span>
      ${escapeHTML(name)}${spentOn(name) ? `<small>${spentOn(name)}</small>` : ''}
      ${removable ? `<button type="button" data-delete-category="${id}" aria-label="Delete ${escapeHTML(name)}" title="Delete category">×</button>` : ''}
    </span>`;
  document.querySelector('#category-chips').innerHTML =
    builtInExpense.map(name => chip(name, false)).join('') +
    customCategories.map(category => chip(category.name, true, category.id)).join('');
  document.querySelector('#colour-swatches').innerHTML = categoryPalette.map(colour =>
    `<button type="button" class="swatch ${colour === chosenColour ? 'chosen' : ''}" data-colour="${colour}" style="background:${colour}" role="radio" aria-checked="${colour === chosenColour}" aria-label="Colour ${colour}"></button>`).join('');
}

async function createCategory(name, icon, colour) {
  const result = await sendJSON('/api/categories', 'POST', { name, icon, color: colour });
  if (!result) return null;
  if (!result.ok) return { error: result.data.error || 'Could not add the category.' };
  customCategories.push(result.data);
  customCategories.sort((a, b) => a.name.localeCompare(b.name));
  applyCustomCategories();
  renderApp();
  renderCategoryManager();
  return result.data;
}

document.querySelector('#colour-swatches').addEventListener('click', event => {
  const swatch = event.target.closest('[data-colour]');
  if (!swatch) return;
  chosenColour = swatch.dataset.colour;
  renderCategoryManager();
});

categoryForm.addEventListener('submit', async event => {
  event.preventDefault();
  const error = document.querySelector('#category-error');
  error.textContent = '';
  const made = await createCategory(categoryForm.elements.name.value, categoryForm.elements.icon.value, chosenColour);
  if (!made) return;
  if (made.error) { error.textContent = made.error; return; }
  categoryForm.reset();
  chosenColour = freeColour();
  renderCategoryManager();
  showToast(`New category: ${made.icon} ${made.name}. It's ready in the Add transaction form.`);
});

document.querySelector('#category-chips').addEventListener('click', async event => {
  const button = event.target.closest('[data-delete-category]');
  if (!button) return;
  const category = customCategories.find(item => item.id === Number(button.dataset.deleteCategory));
  const used = transactions.filter(item => item.type === 'expense' && item.category === category.name).length;
  const hasBudget = budgets.some(budget => budget.category === category.name);
  const extra = [used ? `its ${used} transaction${used === 1 ? '' : 's'} will move to "Other"` : '', hasBudget ? 'its budget will be removed' : '']
    .filter(Boolean).join(' and ');
  if (!confirm(`Delete the "${category.name}" category?${extra ? ` ${extra[0].toUpperCase()}${extra.slice(1)}.` : ''}`)) return;
  const result = await sendJSON(`/api/categories/${category.id}`, 'DELETE');
  if (!result) return;
  if (!result.ok) { showToast(result.data.error || 'Could not delete the category.'); return; }
  transactions.forEach(item => { if (item.type === 'expense' && item.category === category.name) item.category = 'Other'; });
  budgets = budgets.filter(budget => budget.category !== category.name);
  customCategories = customCategories.filter(item => item !== category);
  delete categoryColors[category.name];
  delete categoryIcons[category.name];
  applyCustomCategories();
  renderApp();
  renderCategoryManager();
  showToast(`"${category.name}" deleted.`);
});

// Inside the Add transaction pop-up: pick "＋ New category…" to make one on the spot.
const quickCategory = document.querySelector('#quick-category');
form.elements.category.addEventListener('change', () => {
  const wantsNew = form.elements.category.value === '__new';
  quickCategory.classList.toggle('hidden', !wantsNew);
  if (wantsNew) form.elements.new_category.focus();
});
async function quickAddCategory() {
  const error = document.querySelector('#form-error');
  const made = await createCategory(form.elements.new_category.value, form.elements.new_icon.value,
    freeColour());
  if (!made) return;
  if (made.error) { error.textContent = made.error; return; }
  error.textContent = '';
  updateCategoryField();
  form.elements.category.value = made.name;
  form.elements.new_category.value = '';
  quickCategory.classList.add('hidden');
}
document.querySelector('#quick-category-add').addEventListener('click', quickAddCategory);
form.elements.new_category.addEventListener('keydown', event => {
  if (event.key === 'Enter') { event.preventDefault(); quickAddCategory(); }
});

// ---------- Monthly report ----------
// A "month in review": totals, changes since last month, where the money went, and highlights.
let reportMonth = thisMonth();

function monthNumbers(month) {
  const items = transactions.filter(item => item.date.startsWith(month));
  const total = type => sum(items.filter(item => item.type === type));
  const byCategory = {};
  items.filter(item => item.type === 'expense')
    .forEach(item => { byCategory[item.category] = (byCategory[item.category] || 0) + item.amount; });
  return { items, income: total('income'), spent: total('expense'), saved: total('savings'), byCategory };
}

// "+12%" style change between two numbers (null when there's nothing to compare with).
const percentChange = (now, before) => before ? Math.round((now - before) / before * 100) : null;
function changeBadge(now, before, goodWhenUp) {
  const change = percentChange(now, before);
  if (change === null) return '<small class="report-change">No data last month</small>';
  if (change === 0) return '<small class="report-change">Same as last month</small>';
  const good = (change > 0) === goodWhenUp;
  return `<small class="report-change ${good ? 'up' : 'down'}">${change > 0 ? '↑' : '↓'} ${Math.abs(change)}% vs last month</small>`;
}

function renderReport() {
  const month = reportMonth;
  const current = thisMonth();
  const previous = shiftMonth(month, -1);
  const now = monthNumbers(month);
  const before = monthNumbers(previous);
  const shortName = new Date(`${month}-01T12:00:00`).toLocaleDateString('en-IN', { month: 'long' });
  document.querySelector('#report-title').textContent = `${monthLabel(month)}${month === current ? ' · so far' : ''}`;
  document.querySelector('#report-next').disabled = month >= current;

  const leftOver = now.income - now.spent - now.saved;
  const rate = now.income ? Math.round(now.saved / now.income * 100) : null;
  const beforeRate = before.income ? before.saved / before.income * 100 : 0;

  if (!now.items.length) {
    document.querySelector('#report-summary').textContent = `Nothing was logged in ${monthLabel(month)}. Add transactions with that date to see a report here.`;
    ['#report-stats', '#report-categories', '#report-highlights', '#report-foot'].forEach(id => { document.querySelector(id).innerHTML = ''; });
    return;
  }

  // One friendly sentence about the month
  const spentChange = percentChange(now.spent, before.spent);
  document.querySelector('#report-summary').innerHTML = [
    `In ${shortName} you earned <b>${money(now.income)}</b>, spent <b>${money(now.spent)}</b> and saved <b>${money(now.saved)}</b>.`,
    spentChange === null ? '' : spentChange < 0 ? `That's ${Math.abs(spentChange)}% less spending than ${monthLabel(previous).split(' ')[0]}. Nice work! 🌿`
      : spentChange > 0 ? `That's ${spentChange}% more spending than ${monthLabel(previous).split(' ')[0]}.` : ''
  ].join(' ');

  const stat = (label, value, badge = '', extra = '') => `<div class="budget-stat ${extra}"><span>${label}</span><strong>${value}</strong>${badge}</div>`;
  document.querySelector('#report-stats').innerHTML = [
    stat('Income', money(now.income), changeBadge(now.income, before.income, true)),
    stat('Spent', money(now.spent), changeBadge(now.spent, before.spent, false)),
    stat('Saved & invested', money(now.saved), changeBadge(now.saved, before.saved, true)),
    stat('Left over', money(leftOver), '<small class="report-change">Income − spent − saved</small>', leftOver < 0 ? 'bad' : 'good'),
    stat('Savings rate', rate === null ? '—' : `${rate}%`,
      rate === null ? '' : `<small class="report-change ${rate >= beforeRate ? 'up' : 'down'}">${rate >= 20 ? 'Great habit! 🌟' : 'Aim for 20%'}</small>`)
  ].join('');

  // Categories, biggest first, with the change since last month
  const categories = Object.entries(now.byCategory).sort((a, b) => b[1] - a[1]);
  document.querySelector('#report-categories').innerHTML = categories.length ? categories.map(([name, amount]) => {
    const share = Math.round(amount / now.spent * 100);
    const was = before.byCategory[name] || 0;
    const diff = amount - was;
    const note = !was ? 'new this month' : diff === 0 ? 'same as before' : `${diff > 0 ? '↑' : '↓'} ${money(Math.abs(diff))}`;
    return `<div class="report-row">
      <div class="report-row-top">
        <span><span class="report-dot" style="background:${categoryColors[name] || categoryColors.Other}"></span>${escapeHTML(categoryIcons[name] || '•')} ${escapeHTML(name)}</span>
        <span><b>${money(amount)}</b> · ${share}%</span>
      </div>
      <div class="budget-bar"><span style="width:${share}%;background:${categoryColors[name] || categoryColors.Other}"></span></div>
      <small class="report-change ${!was ? '' : diff > 0 ? 'down' : diff < 0 ? 'up' : ''}">${note}</small>
    </div>`;
  }).join('') : '<p class="goal-empty">No spending this month. 🎉</p>';

  // Highlights
  const expenses = now.items.filter(item => item.type === 'expense');
  const daysCounted = month === current ? new Date().getDate() : daysInMonth(month);
  const spendDays = new Set(expenses.map(item => item.date));
  const byDay = {};
  expenses.forEach(item => { byDay[item.date] = (byDay[item.date] || 0) + item.amount; });
  const busiest = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];
  const biggest = [...expenses].sort((a, b) => b.amount - a.amount)[0];
  const goalMoney = sum(now.items.filter(item => item.goal_id != null));
  const budgetRows = budgets.map(budget => ({ ...budget, spent: now.byCategory[budget.category] || 0 }));
  const over = budgetRows.filter(row => row.spent > row.monthly_limit);
  const highlights = [
    biggest && ['💸', 'Biggest expense', `${escapeHTML(biggest.name)}: ${money(biggest.amount)} on ${prettyDate(biggest.date)}`],
    busiest && ['📅', 'Busiest day', `${prettyDate(busiest[0])}: ${money(busiest[1])} spent`],
    ['🧘', 'No-spend days', `${Math.max(0, daysCounted - spendDays.size)} of ${daysCounted} days`],
    ['📊', 'Average a day', money(now.spent / daysCounted)],
    categories[0] && ['🏆', 'Top category', `${escapeHTML(categories[0][0])}: ${Math.round(categories[0][1] / now.spent * 100)}% of your spending`],
    budgetRows.length && ['🎯', 'Budgets', over.length
      ? `${budgetRows.length - over.length} of ${budgetRows.length} on track. Over: ${over.map(row => escapeHTML(row.category)).join(', ')}`
      : `All ${budgetRows.length} budget${budgetRows.length === 1 ? '' : 's'} on track ✨`],
    goalMoney && ['⭐', 'Wishlist', `${money(goalMoney)} put towards your goals`],
    ['🧾', 'Transactions logged', `${now.items.length}`]
  ].filter(Boolean);
  document.querySelector('#report-highlights').innerHTML = highlights.map(([icon, title, text]) =>
    `<li><span class="report-hl-icon">${icon}</span><div><strong>${title}</strong><span>${text}</span></div></li>`).join('');

  document.querySelector('#report-foot').textContent =
    `SpendWise report for ${monthLabel(month)}${profile ? ` · ${profile.display_name || profile.username}` : ''} · made ${prettyDate(todayISO())}`;
}

document.querySelector('#report-prev').addEventListener('click', () => { reportMonth = shiftMonth(reportMonth, -1); renderReport(); });
document.querySelector('#report-next').addEventListener('click', () => {
  if (reportMonth < thisMonth()) { reportMonth = shiftMonth(reportMonth, 1); renderReport(); }
});
document.querySelector('#report-print').addEventListener('click', () => window.print());


// ---------- Export to CSV ----------
// Downloads the transactions you're looking at (search + filter included) as a file Excel can open.
function csvCell(value) {
  let text = value == null ? '' : String(value);
  // A cell starting with = + - @ could run as a formula in Excel, so we put a ' in front of text like that.
  // (Plain numbers like -450.00 are left alone so Excel can still add them up.)
  const isNumber = /^-?\d+(\.\d+)?$/.test(text);
  if (!isNumber && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportCSV() {
  const rows = filteredTransactions();
  if (!rows.length) { showToast('Nothing to export. Try clearing the search or filter.'); return; }
  const typeName = { income: 'Income', expense: 'Expense', savings: 'Savings' };
  const goalName = id => (goals.find(goal => goal.id === id) || {}).name || '';
  const header = ['Date', 'Name', 'Type', 'Category', 'Amount (INR)', 'Signed amount (INR)', 'Stock', 'Shares', 'Wishlist goal'];
  const lines = rows.map(item => [
    item.date,
    item.name,
    typeName[item.type],
    item.category,
    item.amount.toFixed(2),
    (item.type === 'income' ? item.amount : -item.amount).toFixed(2), // + money in, − money out
    item.stock_name || '',
    item.quantity || '',
    item.goal_id != null ? goalName(item.goal_id) : ''
  ].map(csvCell).join(','));
  // \uFEFF at the start tells Excel the file is UTF-8, so ₹ and emoji show correctly.
  const csv = '\uFEFF' + [header.join(','), ...lines].join('\r\n') + '\r\n';
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const filtered = currentFilter !== 'all' || searchInput.value.trim();
  link.download = `spendwise-${filtered ? `${currentFilter === 'all' ? 'filtered' : currentFilter}-` : ''}transactions-${todayISO()}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  showToast(`Downloaded ${rows.length} transaction${rows.length === 1 ? '' : 's'} as CSV 📄`);
}
document.querySelector('#export-button').addEventListener('click', exportCSV);

// ---------- Spending calendar ----------
// A month grid where each day is shaded by how much you spent, like GitHub's contribution graph.
let calendarMonth = thisMonth();
let calendarDay = null; // the day you clicked ("2026-11-05")

// ₹450 / ₹4.1k / ₹12k / ₹1.2L: short enough to fit in a calendar square
const shortMoney = amount => amount >= 100000 ? `₹${(amount / 100000).toFixed(1).replace('.0', '')}L`
  : amount >= 1000 ? `₹${(amount / 1000).toFixed(amount >= 10000 ? 0 : 1).replace('.0', '')}k` : `₹${Math.round(amount)}`;

function renderCalendar() {
  const month = calendarMonth;
  const [year, mon] = month.split('-').map(Number);
  const total = daysInMonth(month);
  const offset = (new Date(year, mon - 1, 1).getDay() + 6) % 7; // Monday = 0
  const today = todayISO();
  const expenses = transactions.filter(item => item.type === 'expense' && item.date.startsWith(month));
  const byDay = {};
  expenses.forEach(item => { byDay[item.date] = (byDay[item.date] || 0) + item.amount; });
  const biggest = Math.max(0, ...Object.values(byDay));

  document.querySelector('#calendar-month').textContent = monthLabel(month);
  document.querySelector('#calendar-next').disabled = month >= thisMonth();

  const cells = [];
  for (let i = 0; i < offset; i++) cells.push('<span class="calendar-cell empty"></span>');
  for (let d = 1; d <= total; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    const spent = byDay[date] || 0;
    const future = date > today;
    // 4 shades: a quarter of your biggest day or less is level 1, the biggest days are level 4
    const level = future ? 'future' : spent ? `lvl-${Math.min(4, Math.max(1, Math.ceil(spent / biggest * 4)))}` : 'lvl-none';
    const label = future ? prettyDate(date) : `${prettyDate(date)}: ${spent ? money(spent) : 'no spending'}`;
    cells.push(`<button type="button" class="calendar-cell ${level} ${date === today ? 'today' : ''} ${date === calendarDay ? 'selected' : ''}"
      data-day="${date}" ${future ? 'disabled' : ''} title="${label}" aria-label="${label}"><span>${d}</span>${spent ? `<small>${shortMoney(spent)}</small>` : ''}</button>`);
  }
  document.querySelector('#calendar-grid').innerHTML = cells.join('');

  // Summary line
  const counted = month === thisMonth() ? new Date().getDate() : total;
  const spendDays = Object.keys(byDay).filter(date => date <= today).length;
  const top = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];
  document.querySelector('#calendar-summary').textContent = expenses.length
    ? `${money(sum(expenses))} over ${spendDays} day${spendDays === 1 ? '' : 's'} · ${counted - spendDays} no-spend day${counted - spendDays === 1 ? '' : 's'} · biggest: ${prettyDate(top[0])}`
    : `No spending logged in ${monthLabel(month)} yet`;

  // Day details (the clicked day, or your biggest day)
  const day = calendarDay && calendarDay.startsWith(month) ? calendarDay : top ? top[0] : null;
  const box = document.querySelector('#calendar-day');
  if (!day) { box.innerHTML = '<p class="goal-empty">Tap a day to see what you spent. 🗓️</p>'; return; }
  const items = expenses.filter(item => item.date === day).sort((a, b) => b.amount - a.amount);
  box.innerHTML = `
    <p class="spotlight-label">${day === calendarDay ? 'SELECTED DAY' : 'BIGGEST DAY'}</p>
    <h3>${new Date(`${day}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
    <strong class="calendar-day-total">${money(sum(items))}</strong>
    ${items.length ? `<ul>${items.map(item => `<li><span class="transaction-icon ${item.category.toLowerCase()}" ${iconStyle(item.category)}>${escapeHTML(categoryIcons[item.category] || '•')}</span>
      <div><b>${escapeHTML(item.name)}</b><small>${escapeHTML(item.category)}</small></div><span>${money(item.amount)}</span></li>`).join('')}</ul>
      <button type="button" class="text-button" data-calendar-search="${day}">See in Transactions →</button>`
    : '<p class="goal-empty">No spending on this day. 🌿 Nice!</p>'}`;
}

document.querySelector('#calendar-grid').addEventListener('click', event => {
  const cell = event.target.closest('[data-day]');
  if (!cell) return;
  calendarDay = cell.dataset.day;
  renderCalendar();
});
document.querySelector('#calendar-day').addEventListener('click', event => {
  const button = event.target.closest('[data-calendar-search]');
  if (!button) return;
  setFilter('expense');
  searchInput.value = button.dataset.calendarSearch;
  goTo('transactions');
});
document.querySelector('#calendar-prev').addEventListener('click', () => { calendarMonth = shiftMonth(calendarMonth, -1); calendarDay = null; renderCalendar(); });
document.querySelector('#calendar-next').addEventListener('click', () => {
  if (calendarMonth < thisMonth()) { calendarMonth = shiftMonth(calendarMonth, 1); calendarDay = null; renderCalendar(); }
});

// ---------- Organisations & events ----------
// Organisation accounts share one set of data between members. Everyone (individuals too)
// can create events with an allowance and link expenses and money collected to them.
let events = [];
let org = null;          // { name, invite_code (admin only), members: [...] } for organisation accounts
let currentEventId = null;
let eventFilter = 'open';
const isOrg = () => Boolean(profile && profile.org);
const isAdmin = () => isOrg() && profile.role === 'admin';
const incomeSources = ['Income', 'Sponsorship', 'Member contribution', 'Ticket sales', 'Donation', 'Grant', 'Other income'];
const memberName = id => {
  if (id == null) return '';
  if (profile && id === profile.id) return 'you';
  const member = org && org.members.find(person => person.id === id);
  return member ? (member.display_name || member.username) : 'a former member';
};
const eventName = id => (events.find(event => event.id === id) || {}).name || '';

// Little line under a transaction's name: event · who paid · who added it
function txMeta(item) {
  const bits = [];
  if (isOrg() && item.event_id && eventName(item.event_id)) bits.push(`<span class="tx-event">⚑ ${escapeHTML(eventName(item.event_id))}</span>`);
  if (isOrg() && item.paid_by) {
    bits.push(item.settled_at ? `paid by ${escapeHTML(memberName(item.paid_by))} · <span class="tx-settled">paid back ✓</span>`
      : `paid by ${escapeHTML(memberName(item.paid_by))} · <span class="tx-owed">owed</span>`);
  }
  if (isOrg() && item.added_by && item.added_by !== (profile && profile.id)) bits.push(`added by ${escapeHTML(memberName(item.added_by))}`);
  return bits.length ? `<small class="tx-meta">${bits.join(' · ')}</small>` : '';
}

// Sub-events: an event can be part of a main event (one level deep)
const subEvents = id => events.filter(event => event.parent_id === id).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
const parentOf = event => event.parent_id ? events.find(item => item.id === event.parent_id) : null;

// Numbers for an event. A main event includes everything from its sub-events.
// Its allowance is its own, or (if it has none) its sub-events' allowances added up.
function eventStats(event) {
  const children = subEvents(event.id);
  const ids = new Set([event.id, ...children.map(child => child.id)]);
  const items = transactions.filter(item => ids.has(item.event_id));
  const expenses = items.filter(item => item.type === 'expense');
  const spent = sum(expenses);
  const collected = sum(items.filter(item => item.type === 'income'));
  const owed = sum(expenses.filter(item => item.paid_by && !item.settled_at));
  const allocated = children.reduce((total, child) => total + child.allowance, 0);
  const allowance = event.allowance || allocated;
  return { items, expenses, spent, collected, owed, allowance, allocated, children, left: allowance - spent, net: collected - spent,
    status: allowance ? budgetStatus(spent, allowance) : 'ok' };
}

// --- Transaction pop-up: event, who paid, and where income came from (organisations)
const eventFields = document.querySelector('#event-fields');
function updateEventFields(selectedEvent, selectedPayer) {
  const type = form.elements.type.value;
  const keepEvent = selectedEvent !== undefined ? selectedEvent : form.elements.event_id.value;
  const keepPayer = selectedPayer !== undefined ? selectedPayer : form.elements.paid_by.value;
  const usable = event => !event.closed || String(event.id) === String(keepEvent || '');
  const choices = [];
  events.filter(event => !event.parent_id).sort((a, b) => b.date.localeCompare(a.date))
    .forEach(main => {
      const kids = subEvents(main.id).filter(usable);
      if (usable(main) || kids.length) choices.push(main, ...kids);
    });
  form.elements.event_id.innerHTML = '<option value="">No event</option>' +
    choices.map(event => `<option value="${event.id}">${event.parent_id ? '\u2003↳ ' : ''}${escapeHTML(event.name)}${event.closed ? ' (closed)' : ''}</option>`).join('');
  form.elements.event_id.value = keepEvent && choices.some(event => String(event.id) === String(keepEvent)) ? keepEvent : '';
  const showPayer = isOrg() && type === 'expense';
  if (showPayer) {
    const people = org ? org.members.filter(person => person.role !== 'removed' || String(person.id) === String(keepPayer || '')) : [];
    form.elements.paid_by.innerHTML = '<option value="">🏛️ Organisation funds</option>' +
      people.map(person => `<option value="${person.id}">👤 ${escapeHTML(person.id === profile.id ? `Me (${person.display_name || person.username})` : person.display_name || person.username)}</option>`).join('');
    form.elements.paid_by.value = keepPayer && people.some(person => String(person.id) === String(keepPayer)) ? keepPayer : '';
  }
  const showEvent = isOrg() && choices.length > 0;
  document.querySelector('#event-field').classList.toggle('hidden', !showEvent);
  document.querySelector('#paid-by-field').classList.toggle('hidden', !showPayer);
  eventFields.classList.toggle('hidden', !showEvent && !showPayer);
  document.querySelector('#paid-by-hint').classList.toggle('hidden', !showPayer || !form.elements.paid_by.value);
}
form.elements.paid_by.addEventListener('change', () => updateEventFields());

// --- Events page
const eventForm = document.querySelector('#event-form');
let editingEventId = null;

function renderEvents() {
  const listPanel = document.querySelector('#events-list');
  const detailPanel = document.querySelector('#event-detail');
  const showing = currentEventId && events.find(event => event.id === currentEventId);
  listPanel.classList.toggle('off', Boolean(showing));
  detailPanel.classList.toggle('off', !showing);
  if (showing) renderEventDetail(showing); else renderEventList();
  renderReimbursements();
}

let eventSort = { key: 'date', dir: -1 };   // comparison table sort

function renderEventList() {
  const open = events.filter(event => !event.closed);
  document.querySelector('#events-summary').textContent = events.length
    ? `${open.length} active · ${events.length - open.length} closed`
    : isOrg() ? 'Plan your events, give each an allowance, and log every rupee' : 'Trips, weddings, parties: give each one a budget';
  document.querySelectorAll('[data-event-filter]').forEach(button => button.classList.toggle('active', button.dataset.eventFilter === eventFilter));
  const matches = event => eventFilter === 'all' || (eventFilter === 'closed' ? event.closed : !event.closed);
  // a main event shows if it matches, or if any of its sub-events do
  const shown = events.filter(event => !event.parent_id && (matches(event) || subEvents(event.id).some(matches)));
  renderEventDashboard(shown, matches);
  const grid = document.querySelector('#event-grid');
  if (!shown.length) {
    grid.innerHTML = `<p class="goal-empty">${events.length ? 'Nothing here.' : 'No events yet. Create your first one, e.g. "Annual Fest" with a ₹50,000 allowance. 🎪'}</p>`;
    return;
  }
  grid.innerHTML = shown.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).map(event => {
    const stats = eventStats(event);
    const percent = stats.allowance ? Math.round(stats.spent / stats.allowance * 100) : 0;
    return `<article class="event-card ${event.closed ? 'closed' : ''} ${stats.status}" data-open-event="${event.id}" tabindex="0" role="button" aria-label="Open ${escapeHTML(event.name)}">
      <div class="event-card-top">
        <div><strong>${escapeHTML(event.name)}</strong><span>${prettyDate(event.date)}${stats.children.length ? ` · ${stats.children.length} sub-event${stats.children.length === 1 ? '' : 's'}` : ''}</span></div>
        <span class="budget-pill ${event.closed ? '' : stats.status}">${event.closed ? 'Closed' : stats.allowance ? statusLabel[stats.status] : 'Active'}</span>
      </div>
      ${stats.allowance ? `<div class="budget-bar"><span class="${stats.status}" style="width:${Math.min(100, percent)}%"></span></div>
        <div class="budget-meta"><span>${money(stats.spent)} of ${money(stats.allowance)}</span><span>${stats.left >= 0 ? `${money(stats.left)} left` : `${money(-stats.left)} over`}</span></div>`
      : `<div class="budget-meta"><span>${money(stats.spent)} spent</span><span>No allowance set</span></div>`}
      ${stats.children.length ? `<div class="sub-chips">${stats.children.map(child => {
        const cs = eventStats(child);
        return `<span class="sub-chip ${cs.status}" title="${escapeHTML(child.name)}: ${money(cs.spent)}${cs.allowance ? ` of ${money(cs.allowance)}` : ''}"><i style="width:${cs.allowance ? Math.min(100, cs.spent / cs.allowance * 100) : 0}%"></i>${escapeHTML(child.name)}</span>`;
      }).join('')}</div>` : ''}
      <div class="event-card-foot">
        <span>💸 ${stats.expenses.length} expense${stats.expenses.length === 1 ? '' : 's'}</span>
        ${stats.collected ? `<span>💰 ${money(stats.collected)} collected</span>` : ''}
        ${isOrg() && stats.owed ? `<span class="tx-owed">↩ ${money(stats.owed)} to pay back</span>` : ''}
      </div>
    </article>`;
  }).join('');
}

// "All events at a glance": combined totals + a table comparing every event (sub-events indented)
function renderEventDashboard(mains, matches) {
  const box = document.querySelector('#events-dashboard');
  if (!mains.length) { box.innerHTML = ''; return; }
  const all = mains.map(event => ({ event, stats: eventStats(event) }));
  const total = key => all.reduce((sumSoFar, row) => sumSoFar + row.stats[key], 0);
  const allowance = total('allowance');
  const spent = total('spent');
  const left = allowance - spent;
  const count = mains.length + mains.reduce((n, event) => n + subEvents(event.id).filter(matches).length, 0);
  const stat = (label, value, extra = '') => `<div class="budget-stat ${extra}"><span>${label}</span><strong>${value}</strong></div>`;
  const label = { open: 'active', closed: 'closed', all: '' }[eventFilter];
  // sorting
  const value = (row, key) => ({ name: row.event.name.toLowerCase(), date: row.event.date, allowance: row.stats.allowance, spent: row.stats.spent,
    used: row.stats.allowance ? row.stats.spent / row.stats.allowance : -1, left: row.stats.allowance ? row.stats.left : -Infinity,
    collected: row.stats.collected, owed: row.stats.owed })[key];
  const sortRows = rows => rows.sort((a, b) => {
    const x = value(a, eventSort.key); const y = value(b, eventSort.key);
    return (x < y ? -1 : x > y ? 1 : 0) * eventSort.dir;
  });
  const columns = [['name', 'Event'], ['date', 'Date'], ['allowance', 'Allowance'], ['spent', 'Spent'], ['used', 'Used'], ['left', 'Left'], ['collected', 'Collected'], ...(isOrg() ? [['owed', 'To pay back']] : [])];
  const row = ({ event, stats }, isSub) => {
    const percent = stats.allowance ? Math.round(stats.spent / stats.allowance * 100) : null;
    return `<tr class="${isSub ? 'sub-row' : ''} ${event.closed ? 'closed' : ''}" data-open-event="${event.id}" tabindex="0">
      <td><span class="event-name-cell">${isSub ? '<span class="sub-arrow">↳</span>' : ''}${escapeHTML(event.name)}${event.closed ? ' <small class="closed-tag">closed</small>' : ''}</span></td>
      <td>${prettyDate(event.date)}</td>
      <td>${stats.allowance ? money(stats.allowance) : '—'}</td>
      <td>${money(stats.spent)}</td>
      <td>${percent === null ? '<span class="muted-cell">—</span>' : `<div class="used-cell"><div class="budget-bar"><span class="${stats.status}" style="width:${Math.min(100, percent)}%"></span></div><b class="${stats.status}">${percent}%</b></div>`}</td>
      <td class="${stats.left < 0 ? 'neg-cell' : ''}">${stats.allowance ? (stats.left >= 0 ? money(stats.left) : `−${money(-stats.left)}`) : '—'}</td>
      <td>${stats.collected ? money(stats.collected) : '—'}</td>
      ${isOrg() ? `<td class="${stats.owed ? 'neg-cell' : ''}">${stats.owed ? money(stats.owed) : '—'}</td>` : ''}
    </tr>`;
  };
  const body = sortRows([...all]).map(main => row(main, false) +
    sortRows(subEvents(main.event.id).filter(matches).map(child => ({ event: child, stats: eventStats(child) }))).map(child => row(child, true)).join('')).join('');
  box.innerHTML = `
    <div class="report-stats events-totals">
      ${stat(`${label ? `${label[0].toUpperCase()}${label.slice(1)} e` : 'E'}vents`, count)}
      ${stat('Total allowance', allowance ? money(allowance) : '—')}
      ${stat('Total spent', money(spent))}
      ${allowance ? (left >= 0 ? stat('Left overall', money(left), 'good') : stat('Over overall', money(-left), 'bad')) : stat('Left overall', '—')}
      ${stat('Total collected', money(total('collected')), total('collected') ? 'good' : '')}
      ${isOrg() ? stat('To pay back', money(total('owed')), total('owed') ? 'bad' : '') : ''}
    </div>
    <div class="table-wrap events-table-wrap"><table class="events-table">
      <thead><tr>${columns.map(([key, name]) => `<th><button type="button" data-sort="${key}" class="${eventSort.key === key ? 'sorted' : ''}">${name}${eventSort.key === key ? (eventSort.dir > 0 ? ' ↑' : ' ↓') : ''}</button></th>`).join('')}</tr></thead>
      <tbody>${body}</tbody>
      <tfoot><tr><td>Total</td><td></td><td>${allowance ? money(allowance) : '—'}</td><td>${money(spent)}</td><td>${allowance ? `<b>${Math.round(spent / allowance * 100)}%</b>` : ''}</td><td class="${left < 0 ? 'neg-cell' : ''}">${allowance ? (left >= 0 ? money(left) : `−${money(-left)}`) : '—'}</td><td>${money(total('collected'))}</td>${isOrg() ? `<td>${money(total('owed'))}</td>` : ''}</tr></tfoot>
    </table></div>`;
}

function renderEventDetail(event) {
  const stats = eventStats(event);
  const parent = parentOf(event);
  const stat = (label, value, extra = '', note = '') => `<div class="budget-stat ${extra}"><span>${label}</span><strong>${value}</strong>${note}</div>`;
  const byCategory = {};
  stats.expenses.forEach(item => { byCategory[item.category] = (byCategory[item.category] || 0) + item.amount; });
  const categories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const byPayer = {};
  stats.expenses.forEach(item => { const key = item.paid_by || 'org'; byPayer[key] = (byPayer[key] || 0) + item.amount; });
  const incomes = stats.items.filter(item => item.type === 'income');
  const rows = list => [...list].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).map(item => `<tr>
      <td><div class="transaction-name"><span class="transaction-icon ${item.type === 'expense' ? item.category.toLowerCase() : 'income'}" ${iconStyle(item.category)}>${escapeHTML(categoryIcons[item.category] || (item.type === 'income' ? '↓' : '•'))}</span>
        <div>${escapeHTML(item.name)}<small class="tx-meta">${item.event_id !== event.id && eventName(item.event_id) ? `<span class="tx-event">⚑ ${escapeHTML(eventName(item.event_id))}</span> · ` : ''}${escapeHTML(item.category)}${isOrg() && item.added_by ? ` · added by ${escapeHTML(memberName(item.added_by))}` : ''}</small></div></div></td>
      <td>${prettyDate(item.date)}</td>
      ${isOrg() ? `<td>${item.type !== 'expense' ? '' : item.paid_by
        ? `${escapeHTML(memberName(item.paid_by))} ${item.settled_at ? '<span class="tx-settled">✓ paid back</span>' : `<button type="button" class="settle-button" data-settle="${item.id}">Mark paid back</button>`}`
        : '<span class="tx-org">Organisation</span>'}</td>` : ''}
      <td class="amount ${item.type === 'expense' ? 'negative' : ''}">${item.type === 'expense' ? '−' : '+'}${money(item.amount)}</td>
      <td><div class="row-actions"><button class="row-menu" data-edit-id="${item.id}" title="Edit" aria-label="Edit ${escapeHTML(item.name)}">✎</button></div></td>
    </tr>`).join('');
  const table = (list, empty) => list.length ? `<div class="table-wrap"><table><tbody>${rows(list)}</tbody></table></div>` : `<p class="goal-empty">${empty}</p>`;

  document.querySelector('#event-detail').innerHTML = `
    <button type="button" class="text-button event-back" data-event-back="${parent ? parent.id : ''}">← ${parent ? escapeHTML(parent.name) : 'All events'}</button>
    <div class="event-head">
      <div>
        <p class="spotlight-label">${event.closed ? 'CLOSED ' : ''}${parent ? `SUB-EVENT OF ${escapeHTML(parent.name.toUpperCase())}` : stats.children.length ? `MAIN EVENT · ${stats.children.length} SUB-EVENT${stats.children.length === 1 ? '' : 'S'}` : 'EVENT'}</p>
        <h2>${escapeHTML(event.name)}</h2>
        <p class="event-sub">${new Date(`${event.date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${isOrg() && event.created_by ? ` · created by ${escapeHTML(memberName(event.created_by))}` : ''}</p>
      </div>
      <div class="event-head-actions">
        <button type="button" class="secondary-button" data-event-edit>✎ Edit</button>
        <button type="button" class="secondary-button" data-event-close>${event.closed ? '↺ Reopen' : '✓ Close event'}</button>
        <button type="button" class="secondary-button danger" data-event-delete>Delete</button>
      </div>
    </div>
    <div class="report-stats event-stats">
      ${stat('Allowance', stats.allowance ? money(stats.allowance) : '—', '', stats.allowance ? (stats.children.length && !event.allowance ? '<small class="report-change">Sub-events added up</small>' : '') : '<small class="report-change">Not set</small>')}
      ${stat(stats.children.length ? 'Spent (incl. sub-events)' : 'Spent', money(stats.spent))}
      ${stats.allowance ? (stats.left >= 0 ? stat('Left in allowance', money(stats.left), 'good') : stat('Over allowance', money(-stats.left), 'bad')) : stat('Left in allowance', '—')}
      ${stat('Money collected', money(stats.collected), stats.collected ? 'good' : '')}
      ${stat('Collected − spent', `${stats.net < 0 ? '−' : ''}${money(Math.abs(stats.net))}`, stats.net < 0 ? 'bad' : 'good', `<small class="report-change">${stats.net >= 0 ? 'Paid for itself' : 'Covered by the allowance'}</small>`)}
    </div>
    ${stats.allowance ? `<div class="budget-bar budget-bar-big"><span class="${stats.status}" style="width:${Math.min(100, stats.spent / stats.allowance * 100)}%"></span></div>` : ''}
    <div class="event-buttons">
      <button type="button" class="primary-button" data-event-add="expense"><span>＋</span> Add expense</button>
      <button type="button" class="secondary-button" data-event-add="income">＋ Add money collected</button>
      ${parent ? '' : '<button type="button" class="secondary-button" data-add-sub>＋ Add sub-event</button>'}
    </div>
    ${stats.children.length ? `<div class="report-block sub-events-block">
      <h3>Sub-events <span class="muted-count">${stats.children.length}</span></h3>
      ${event.allowance && stats.allocated ? `<p class="allocation-note ${stats.allocated > event.allowance ? 'over' : ''}">${stats.allocated > event.allowance
        ? `⚠️ Sub-event allowances add up to ${money(stats.allocated)}, which is ${money(stats.allocated - event.allowance)} more than this event's ${money(event.allowance)}.`
        : `${money(stats.allocated)} of the ${money(event.allowance)} allowance is given to sub-events · ${money(event.allowance - stats.allocated)} not yet allocated.`}</p>` : ''}
      <div class="event-grid sub-grid">${stats.children.map(child => {
        const cs = eventStats(child);
        const pct = cs.allowance ? Math.round(cs.spent / cs.allowance * 100) : 0;
        return `<article class="event-card small ${child.closed ? 'closed' : ''} ${cs.status}" data-open-sub="${child.id}" tabindex="0" role="button" aria-label="Open ${escapeHTML(child.name)}">
          <div class="event-card-top"><div><strong>${escapeHTML(child.name)}</strong><span>${prettyDate(child.date)}</span></div>
            <span class="budget-pill ${child.closed ? '' : cs.status}">${child.closed ? 'Closed' : cs.allowance ? `${pct}%` : 'Active'}</span></div>
          ${cs.allowance ? `<div class="budget-bar"><span class="${cs.status}" style="width:${Math.min(100, pct)}%"></span></div>` : ''}
          <div class="budget-meta"><span>${money(cs.spent)}${cs.allowance ? ` of ${money(cs.allowance)}` : ' spent'}</span><span>${cs.expenses.length} expense${cs.expenses.length === 1 ? '' : 's'}</span></div>
        </article>`;
      }).join('')}</div>
    </div>` : ''}
    <div class="event-columns">
      <div class="report-block">
        <h3>Expenses${stats.children.length ? ' (all sub-events)' : ''} <span class="muted-count">${stats.expenses.length}</span></h3>
        ${table(stats.expenses, 'No expenses yet.')}
      </div>
      <div class="event-side">
        <div class="report-block">
          <h3>Where it went</h3>
          ${categories.length ? categories.map(([name, amount]) => `<div class="report-row"><div class="report-row-top"><span><span class="report-dot" style="background:${categoryColors[name] || categoryColors.Other}"></span>${escapeHTML(name)}</span><span><b>${money(amount)}</b> · ${Math.round(amount / stats.spent * 100)}%</span></div>
            <div class="budget-bar"><span style="width:${amount / stats.spent * 100}%;background:${categoryColors[name] || categoryColors.Other}"></span></div></div>`).join('') : '<p class="goal-empty">Nothing spent yet.</p>'}
        </div>
        ${isOrg() ? `<div class="report-block"><h3>Who paid</h3>
          ${Object.keys(byPayer).length ? Object.entries(byPayer).sort((a, b) => b[1] - a[1]).map(([key, amount]) => `<div class="report-row-top payer-row"><span>${key === 'org' ? '🏛️ Organisation funds' : `👤 ${escapeHTML(memberName(Number(key)))}`}</span><b>${money(amount)}</b></div>`).join('') : '<p class="goal-empty">—</p>'}
        </div>` : ''}
      </div>
    </div>
    <div class="report-block event-collections">
      <h3>Money collected <span class="muted-count">${incomes.length}</span></h3>
      ${table(incomes, isOrg() ? 'No sponsorships, contributions or ticket sales yet.' : 'No money collected for this event.')}
    </div>`;
}

// Reimbursements: members who paid from their own pocket and haven't been paid back yet
function renderReimbursements() {
  const panel = document.querySelector('#reimburse-panel');
  const show = isOrg() && !currentEventId;
  panel.classList.toggle('off', !show);
  if (!show) return;
  const owed = transactions.filter(item => item.type === 'expense' && item.paid_by && !item.settled_at);
  const recent = transactions.filter(item => item.paid_by && item.settled_at)
    .sort((a, b) => b.settled_at.localeCompare(a.settled_at) || b.id - a.id).slice(0, 4);
  const byPerson = {};
  owed.forEach(item => { (byPerson[item.paid_by] = byPerson[item.paid_by] || []).push(item); });
  const people = Object.keys(byPerson).length;
  panel.innerHTML = `
    <div class="panel-heading"><div><h2>Reimbursements</h2><p>${owed.length ? `${money(sum(owed))} to pay back to ${people} member${people === 1 ? '' : 's'}` : 'Nobody is waiting to be paid back 🎉'}</p></div></div>
    ${owed.length ? `<div class="reimburse-grid">${Object.entries(byPerson).sort((a, b) => sum(b[1]) - sum(a[1])).map(([person, items]) => `
      <article class="reimburse-card">
        <div class="reimburse-top"><span class="avatar">${escapeHTML(memberName(Number(person)).slice(0, 2).toUpperCase())}</span>
          <div><strong>${escapeHTML(memberName(Number(person)))}</strong><span>${items.length} expense${items.length === 1 ? '' : 's'}</span></div>
          <b>${money(sum(items))}</b></div>
        <ul>${items.map(item => `<li><span>${escapeHTML(item.name)}<small>${prettyDate(item.date)}${item.event_id && eventName(item.event_id) ? ` · ⚑ ${escapeHTML(eventName(item.event_id))}` : ''}</small></span><b>${money(item.amount)}</b>
          <button type="button" class="settle-button" data-settle="${item.id}" title="Mark as paid back" aria-label="Mark ${escapeHTML(item.name)} as paid back">✓</button></li>`).join('')}</ul>
        <button type="button" class="secondary-button settle-all" data-settle-all="${person}">Mark all ${money(sum(items))} as paid back</button>
      </article>`).join('')}</div>` : ''}
    ${recent.length ? `<p class="spotlight-label recent-label">RECENTLY PAID BACK</p><div class="recent-settled">${recent.map(item => `<span>✓ ${escapeHTML(memberName(item.paid_by))} · ${escapeHTML(item.name)} · ${money(item.amount)} <button type="button" class="text-button" data-unsettle="${item.id}">Undo</button></span>`).join('')}</div>` : ''}`;
}

async function settle(ids, settled) {
  let done = 0;
  for (const id of ids) {
    const result = await sendJSON(`/api/transactions/${id}/settle`, 'POST', { settled });
    if (!result) return;
    if (!result.ok) { showToast(result.data.error || 'Could not update that.'); break; }
    transactions = transactions.map(item => item.id === id ? result.data : item);
    done++;
  }
  renderApp();
  if (done) {
    const total = sum(transactions.filter(item => ids.includes(item.id)));
    showToast(settled ? `Marked ${money(total)} as paid back ✓` : 'Moved back to "to pay back".');
    if (settled && homeBuddy) homeBuddy.celebrate();
  }
}

document.querySelector('#events-list').addEventListener('click', event => {
  const filter = event.target.closest('[data-event-filter]');
  if (filter) { eventFilter = filter.dataset.eventFilter; renderEvents(); return; }
  const sortButton = event.target.closest('[data-sort]');
  if (sortButton) {
    const key = sortButton.dataset.sort;
    eventSort = eventSort.key === key ? { key, dir: -eventSort.dir } : { key, dir: key === 'name' ? 1 : -1 };
    renderEvents();
    return;
  }
  const card = event.target.closest('[data-open-event]');
  if (card) { currentEventId = Number(card.dataset.openEvent); renderEvents(); window.scrollTo({ top: 0 }); }
});
document.querySelector('#event-detail').addEventListener('keydown', event => {
  const card = event.target.closest('[data-open-sub]');
  if (card && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); card.click(); }
});
document.querySelector('#events-list').addEventListener('keydown', event => {
  const card = event.target.closest('[data-open-event]');
  if (card && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); card.click(); }
});

function openEventForm(existing, parentId) {
  editingEventId = existing ? existing.id : null;
  if (existing || parentId) { currentEventId = null; renderEvents(); }
  // "Part of": any main event except this one (an event that has sub-events can't become one itself)
  const canNest = !existing || !subEvents(existing.id).length;
  const mains = events.filter(event => !event.parent_id && (!existing || event.id !== existing.id) && (!event.closed || event.id === (existing && existing.parent_id) || event.id === parentId));
  eventForm.elements.parent_id.innerHTML = '<option value="">Main event (not part of another)</option>' +
    mains.map(event => `<option value="${event.id}">Part of: ${escapeHTML(event.name)}</option>`).join('');
  eventForm.elements.parent_id.value = String(parentId || (existing && existing.parent_id) || '');
  eventForm.elements.parent_id.classList.toggle('hidden', !canNest || !mains.length);
  eventForm.elements.name.placeholder = parentId ? 'Sub-event name, e.g. Day 1, Hackathon' : 'Event name, e.g. Annual Fest 2026';
  eventForm.elements.name.value = existing ? existing.name : '';
  eventForm.elements.date.value = existing ? existing.date : todayISO();
  eventForm.elements.allowance.value = existing && existing.allowance ? existing.allowance : '';
  document.querySelector('#event-save-button').textContent = existing ? 'Save changes' : parentId ? 'Create sub-event' : 'Create event';
  eventForm.classList.remove('hidden');
  eventForm.elements.name.focus();
}
document.querySelector('#new-event-button').addEventListener('click', () => openEventForm());
document.querySelector('#cancel-event-button').addEventListener('click', () => {
  const back = editingEventId;
  eventForm.reset(); eventForm.classList.add('hidden'); editingEventId = null;
  if (back) { currentEventId = back; renderEvents(); }
});
eventForm.addEventListener('submit', async event => {
  event.preventDefault();
  const body = { name: eventForm.elements.name.value, date: eventForm.elements.date.value, allowance: Number(eventForm.elements.allowance.value || 0),
    parent_id: eventForm.elements.parent_id.value ? Number(eventForm.elements.parent_id.value) : null };
  const wasEditing = editingEventId;
  const result = await sendJSON(wasEditing ? `/api/events/${wasEditing}` : '/api/events', wasEditing ? 'PUT' : 'POST', body);
  if (!result) return;
  if (!result.ok) { showToast(result.data.error || 'Could not save the event.'); return; }
  const saved = result.data;
  events = wasEditing ? events.map(item => item.id === saved.id ? saved : item) : [saved, ...events];
  eventForm.reset(); eventForm.classList.add('hidden'); editingEventId = null;
  currentEventId = saved.id;
  renderApp();
  const parent = parentOf(saved);
  showToast(wasEditing ? 'Event updated.' : `🎪 ${saved.name} created${parent ? ` inside ${parent.name}` : ''}${saved.allowance ? ` with a ${money(saved.allowance)} allowance` : ''}. Add its first expense!`);
});

document.querySelector('#event-detail').addEventListener('click', async click => {
  const event = events.find(item => item.id === currentEventId);
  if (!event) return;
  const target = click.target;
  const back = target.closest('[data-event-back]');
  if (back) { currentEventId = back.dataset.eventBack ? Number(back.dataset.eventBack) : null; renderEvents(); window.scrollTo({ top: 0 }); return; }
  const sub = target.closest('[data-open-sub]');
  if (sub) { currentEventId = Number(sub.dataset.openSub); renderEvents(); window.scrollTo({ top: 0 }); return; }
  if (target.closest('[data-add-sub]')) { openEventForm(null, event.id); return; }
  if (target.closest('[data-event-edit]')) { openEventForm(event); return; }
  const editTx = target.closest('[data-edit-id]');
  if (editTx) { const item = transactions.find(entry => entry.id === Number(editTx.dataset.editId)); if (item) openEditModal(item); return; }
  const settleButton = target.closest('[data-settle]');
  if (settleButton) { settle([Number(settleButton.dataset.settle)], true); return; }
  const add = target.closest('[data-event-add]');
  if (add) {
    const isIncome = add.dataset.eventAdd === 'income';
    openModal({ type: add.dataset.eventAdd, event_id: event.id, lockType: true,
      title: `${isIncome ? 'Add money collected' : 'Add expense'} · ${event.name}` });
    // the pop-up starts on the name for income (no category to pick for individuals)
    if (isIncome && !isOrg()) form.elements.name.focus(); else form.elements.category.focus();
    return;
  }
  if (target.closest('[data-event-close]')) {
    const result = await sendJSON(`/api/events/${event.id}`, 'PUT', { closed: !event.closed });
    if (!result || !result.ok) { showToast((result && result.data.error) || 'Could not update the event.'); return; }
    await reloadEvents(); // closing a main event closes its sub-events too
    renderApp();
    showToast(result.data.closed ? `${event.name} closed${subEvents(event.id).length ? ' (with its sub-events)' : ''}. Its numbers stay in your reports.` : `${event.name} reopened${subEvents(event.id).length ? ' (with its sub-events)' : ''}.`);
    return;
  }
  if (target.closest('[data-event-delete]')) {
    const count = transactions.filter(item => item.event_id === event.id).length;
    const kids = subEvents(event.id).length;
    if (!confirm(`Delete "${event.name}"?${count ? ` Its ${count} transaction${count === 1 ? '' : 's'} will stay, just not linked to an event.` : ''}${kids ? ` Its ${kids} sub-event${kids === 1 ? '' : 's'} will become separate events.` : ''}`)) return;
    const result = await sendJSON(`/api/events/${event.id}`, 'DELETE');
    if (!result || !result.ok) { showToast((result && result.data.error) || 'Could not delete the event.'); return; }
    transactions.forEach(item => { if (item.event_id === event.id) item.event_id = null; });
    currentEventId = event.parent_id || null;
    await reloadEvents();
    renderApp();
    showToast(`"${event.name}" deleted.`);
  }
});

document.querySelector('#reimburse-panel').addEventListener('click', event => {
  const one = event.target.closest('[data-settle]');
  if (one) { settle([Number(one.dataset.settle)], true); return; }
  const all = event.target.closest('[data-settle-all]');
  if (all) {
    const person = Number(all.dataset.settleAll);
    const ids = transactions.filter(item => item.paid_by === person && !item.settled_at && item.type === 'expense').map(item => item.id);
    if (confirm(`Mark ${money(sum(transactions.filter(item => ids.includes(item.id))))} as paid back to ${memberName(person)}?`)) settle(ids, true);
    return;
  }
  const undo = event.target.closest('[data-unsettle]');
  if (undo) settle([Number(undo.dataset.unsettle)], false);
});

// --- Organisation panel (Profile page)
function renderOrgPanel() {
  const panel = document.querySelector('#org-panel');
  panel.classList.toggle('off', !isOrg() || !org);
  if (!isOrg() || !org) return;
  const inviteLink = org.invite_code ? `${location.origin}/login?join=${org.invite_code}` : '';
  const active = org.members.filter(person => person.role !== 'removed');
  panel.innerHTML = `
    <div class="panel-heading"><div><h2>🏛️ ${escapeHTML(org.name)}</h2><p>${active.length} member${active.length === 1 ? '' : 's'} · you're ${isAdmin() ? 'the admin' : 'a member'}</p></div>
      ${isAdmin() ? '<button type="button" class="text-button" data-org-rename>Rename</button>' : ''}</div>
    ${isAdmin() ? `<div class="invite-box">
        <div><p class="spotlight-label">INVITE CODE</p><strong class="invite-code">${escapeHTML(org.invite_code)}</strong>
          <p class="invite-help">Share this with your members. When they sign up they choose <b>Organisation → Join with code</b>.</p></div>
        <div class="invite-actions">
          <button type="button" class="primary-button" data-copy="${escapeHTML(org.invite_code)}">Copy code</button>
          <button type="button" class="secondary-button" data-copy="${escapeHTML(inviteLink)}">Copy invite link</button>
          <button type="button" class="text-button" data-new-code>Make a new code</button>
        </div>
      </div>` : '<p class="invite-help">Want to add someone? Ask your admin for the invite code.</p>'}
    <ul class="member-list">${org.members.map(person => `<li class="${person.role === 'removed' ? 'removed' : ''}">
        <span class="avatar">${escapeHTML((person.display_name || person.username).slice(0, 2).toUpperCase())}</span>
        <div><strong>${escapeHTML(person.display_name || person.username)}${person.id === profile.id ? ' (you)' : ''}</strong>
          <small>@${escapeHTML(person.username)} · ${person.added} added${person.owed ? ` · <span class="tx-owed">${money(person.owed)} owed to them</span>` : ''}</small></div>
        <span class="role-pill ${person.role}">${person.role === 'admin' ? 'Admin' : person.role === 'removed' ? 'Removed' : 'Member'}</span>
        ${isAdmin() && person.role === 'member' ? `<button type="button" class="goal-delete" data-remove-member="${person.id}" title="Remove from organisation" aria-label="Remove ${escapeHTML(person.username)}">×</button>` : ''}
      </li>`).join('')}</ul>`;
}

document.querySelector('#org-panel').addEventListener('click', async event => {
  const copy = event.target.closest('[data-copy]');
  if (copy) {
    try { await navigator.clipboard.writeText(copy.dataset.copy); showToast('Copied! Send it to your members 📋'); }
    catch { prompt('Copy this:', copy.dataset.copy); }
    return;
  }
  if (event.target.closest('[data-new-code]')) {
    if (!confirm('Make a new invite code? The old one will stop working (people who already joined stay).')) return;
    const result = await sendJSON('/api/org/invite-code', 'POST');
    if (!result || !result.ok) { showToast((result && result.data.error) || 'Could not make a new code.'); return; }
    org.invite_code = result.data.invite_code;
    renderOrgPanel();
    showToast(`New invite code: ${org.invite_code}`);
    return;
  }
  if (event.target.closest('[data-org-rename]')) {
    const name = prompt('Organisation name', org.name);
    if (!name || name.trim() === org.name) return;
    const result = await sendJSON('/api/org', 'PUT', { name });
    if (!result || !result.ok) { showToast((result && result.data.error) || 'Could not rename.'); return; }
    org.name = result.data.name; profile.org.name = result.data.name;
    renderOrgPanel(); renderOrgBadge();
    return;
  }
  const remove = event.target.closest('[data-remove-member]');
  if (remove) {
    const person = org.members.find(item => item.id === Number(remove.dataset.removeMember));
    if (!confirm(`Remove ${person.display_name || person.username} from ${org.name}? They won't be able to log in. What they added stays.`)) return;
    const result = await sendJSON(`/api/org/members/${person.id}`, 'DELETE');
    if (!result || !result.ok) { showToast((result && result.data.error) || 'Could not remove them.'); return; }
    person.role = 'removed';
    renderOrgPanel();
    showToast(`${person.display_name || person.username} was removed.`);
  }
});

// Sidebar: show the organisation's name under your name
function renderOrgBadge() {
  if (!profile) return;
  document.querySelector('#profile-handle').textContent = isOrg() ? `${profile.org.name} · ${isAdmin() ? 'Admin' : 'Member'}` : `@${profile.username}`;
}

// Organisation accounts: no Wishlist link, and the Overview spotlight shows an event instead of a goal
function applyAccountType() {
  document.querySelector('.nav-link[data-page="wishlist"]').classList.toggle('hidden', isOrg());
  document.querySelector('.nav-link[data-page="events"]').classList.toggle('hidden', !isOrg());
  const spotlight = document.querySelector('#goal-spotlight');
  spotlight.dataset.go = isOrg() ? 'events' : 'wishlist';
  spotlight.title = isOrg() ? 'Open your events' : 'Open your wishlist';
  if (!pageAvailable(currentPage)) goTo('overview');
}

async function reloadEvents() {
  const res = await fetch('/api/events');
  if (res.ok) events = await res.json();
}

async function loadOrg() {
  if (!isOrg()) return;
  const res = await fetch('/api/org');
  if (res.ok) org = await res.json();
}

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
  const series = [['Income', 'income', '--success'], ['Expenses', 'expense', '--danger'], ['Savings', 'savings', '--primary']];
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
  const colours = [cssVar('--gold'), cssVar('--primary'), '#5D7EA8', '#F8F6EE', '#B8934A'];
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
  events: { name: 'Events', title: 'Your events', subtitle: 'Give every event an allowance, then log what was spent, who paid, and what came in.' },
  savings: { name: 'Savings', title: 'Your savings', subtitle: "Every rupee you've put aside, and where it lives." },
  wishlist: { name: 'Wishlist', title: 'Your wishlist', subtitle: 'Save up for the things you love, one step at a time.' },
  analytics: { name: 'Analytics', title: 'Your spending, decoded', subtitle: 'See where your money goes and how it changes month to month.' },
  transactions: { name: 'Transactions', title: 'Every transaction', subtitle: 'Search, filter and tidy up your money history.' },
  budgets: { name: 'Budgets', title: 'Your monthly budgets', subtitle: 'Give every rupee a job, and see how the month is going.' },
  reports: { name: 'Reports', title: 'Your month in review', subtitle: 'A one-page story of each month: what came in, what went out, and what stood out.' },
  profile: { name: 'Profile', title: 'Your profile', subtitle: 'Your photo, your details, your money story.' }
};
const transactionPanelText = {
  overview: ['Recent transactions', 'Your latest activity'],
  savings: ['Savings history', 'Every deposit into your pots and goals'],
  transactions: ['All transactions', 'Search by name, category or date']
};
let currentPage = 'overview';
// Organisations don't have a wishlist (it's for saving up for personal things)
// Organisations have no wishlist; individual accounts have no events (events are for organisations)
const pageAvailable = name => Boolean(pages[name]) && !(name === 'wishlist' && isOrg()) && !(name === 'events' && profile && !isOrg());
const visiblePages = () => Object.keys(pages).filter(pageAvailable);
const pageFromHash = () => { const name = location.hash.replace('#/', ''); return pageAvailable(name) ? name : 'overview'; };

function goTo(page) {
  if (location.hash === `#/${page}`) showPage(page);
  else location.hash = `#/${page}`; // changing the hash triggers showPage (and makes Back work)
}

function showPage(page) {
  if (page !== 'events') currentEventId = null; // coming back to Events starts at the overview
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
  if (page === 'events') renderEvents();
  if (page === 'budgets' && budgetsLoaded) setTimeout(buddyBudgetHello, 500);
  window.scrollTo({ top: 0 });
}
window.addEventListener('hashchange', () => showPage(pageFromHash()));


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

// Keyboard shortcuts: N = new transaction, 1–9 = switch pages (in the order of the pages list)
document.addEventListener('keydown', event => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.target.closest('input, select, textarea') || !modal.classList.contains('hidden')) return;
  if (event.key === 'n' || event.key === 'N') { event.preventDefault(); openModal(); return; }
  const page = visiblePages()[Number(event.key) - 1];
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

function renderEventSpotlight(box) {
  // The active event that has used the biggest share of its allowance (or the newest one)
  const active = events.filter(event => !event.closed && !event.parent_id)
    .map(event => ({ event, stats: eventStats(event) }))
    .sort((a, b) => (b.stats.allowance ? b.stats.spent / b.stats.allowance : -1) - (a.stats.allowance ? a.stats.spent / a.stats.allowance : -1)
      || b.event.date.localeCompare(a.event.date));
  if (!active.length) {
    box.innerHTML = `<p class="spotlight-label">⚑ Events</p><p class="spotlight-big">${events.length ? 'No active events' : 'Plan your first event'}</p><p class="spotlight-note">Give it an allowance and log every expense against it.</p>`;
    return;
  }
  const { event, stats } = active[0];
  const percent = stats.allowance ? Math.round(stats.spent / stats.allowance * 100) : 0;
  box.innerHTML = `
    <p class="spotlight-label">⚑ ${active.length > 1 ? `${active.length} active events` : 'Active event'}</p>
    <div class="spotlight-goal">
      <span class="goal-emoji">🎪</span>
      <div><strong>${escapeHTML(event.name)}</strong><span>${stats.allowance ? (stats.left >= 0 ? `${money(stats.left)} left` : `${money(-stats.left)} over`) : `${money(stats.spent)} spent`}</span></div>
      ${stats.allowance ? `<b>${percent}%</b>` : ''}
    </div>
    ${stats.allowance ? `<div class="budget-bar"><span class="${stats.status}" style="width:${Math.min(100, percent)}%"></span></div>` : ''}
    <p class="spotlight-note">${stats.owed ? `↩ ${money(stats.owed)} to pay back to members` : `${stats.expenses.length} expense${stats.expenses.length === 1 ? '' : 's'}${stats.collected ? ` · ${money(stats.collected)} collected` : ''}`}</p>`;
}

function renderSpotlight() {
  // 1) Closest wishlist goal (organisations: their most pressing event)
  const goalBox = document.querySelector('#goal-spotlight');
  const near = closestGoal();
  if (isOrg()) {
    renderEventSpotlight(goalBox);
  } else if (near) {
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
      element.textContent = profile ? initials(profile) : '';
    }
  });
}

function renderProfile() {
  if (!profile) return;
  const name = profile.display_name || profile.username;
  document.querySelector('#username-label').textContent = name;
  document.querySelector('#profile-handle').textContent = `@${profile.username}`;
  renderOrgBadge();
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
  renderAccountSecurity();
  renderHeadline();
  const reached = goals.filter(goal => goalSaved(goal) >= goal.target).length;
  document.querySelector('#profile-stats').innerHTML = [
    ['Transactions', transactions.length],
    ['Saved & invested', money(getTotals().savings)],
    isOrg() ? ['Events', events.length] : ['Goals reached', `${reached}/${goals.length}`]
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

// ---------- Password + delete account ----------
// Members who joined with just an invite code have no password yet: they can add one, and
// deleting their account only needs DELETE typed in.
function renderAccountSecurity() {
  const hasPassword = profile.has_password !== false;
  document.querySelector('#password-title').textContent = hasPassword ? 'Change password' : 'Add a password';
  document.querySelector('#current-password-field').classList.toggle('hidden', !hasPassword);
  passwordForm.elements.current.required = hasPassword;
  document.querySelector('#delete-password-field').classList.toggle('hidden', !hasPassword);
  const orgName = profile.org ? profile.org.name : '';
  const [summary, warning] = isAdmin()
    ? [`You're the admin of ${orgName}. Deleting your account deletes the whole organisation.`,
       `This deletes ${orgName}: every transaction, budget and event, and every member's account. Members won't be able to log in any more. This can't be undone. Download a CSV first (Transactions → Export) if you want a copy.`]
    : isOrg()
      ? [`Leave ${orgName} and delete your account.`,
         `Your account is deleted and you can't log in any more. What you added stays in ${orgName}, shown as added by "a former member". This can't be undone.`]
      : ['Permanently delete your account and all your data.',
         'This deletes your account and everything in it: transactions, budgets, savings, goals and categories. This can\'t be undone. Download a CSV first (Transactions → Export) if you want a copy.'];
  document.querySelector('#delete-summary').textContent = summary;
  document.querySelector('#delete-warning').textContent = warning;
}

const deleteForm = document.querySelector('#delete-form');
const deleteOpenButton = document.querySelector('#delete-open-button');
const deleteConfirmButton = document.querySelector('#delete-confirm-button');
function closeDeleteForm() {
  deleteForm.reset();
  deleteForm.classList.add('hidden');
  deleteOpenButton.classList.remove('hidden');
  deleteConfirmButton.disabled = true;
  document.querySelector('#delete-error').textContent = '';
}
deleteOpenButton.addEventListener('click', () => {
  deleteForm.classList.remove('hidden');
  deleteOpenButton.classList.add('hidden');
  (profile.has_password !== false ? deleteForm.elements.password : deleteForm.elements.confirm).focus();
});
document.querySelector('#delete-cancel-button').addEventListener('click', closeDeleteForm);
deleteForm.elements.confirm.addEventListener('input', () => {
  deleteConfirmButton.disabled = deleteForm.elements.confirm.value.trim() !== 'DELETE';
});
deleteForm.addEventListener('submit', async event => {
  event.preventDefault();
  const errorText = document.querySelector('#delete-error');
  errorText.textContent = '';
  deleteConfirmButton.disabled = true;
  const result = await sendJSON('/api/account/delete', 'POST', {
    password: deleteForm.elements.password.value, confirm: deleteForm.elements.confirm.value.trim()
  });
  if (!result.ok) {
    errorText.textContent = result.data.error || 'Could not delete the account.';
    deleteConfirmButton.disabled = false;
    return;
  }
  try { sessionStorage.clear(); } catch (e) {}   // forget FIN's chat history in this tab too
  window.location.href = '/login';
});

// Show / Hide button on every password box (change password, delete account)
function addPasswordToggles(form) {
  form.querySelectorAll('input[type="password"]').forEach(input => {
    const wrap = document.createElement('span');
    wrap.className = 'pw-wrap';
    input.replaceWith(wrap);
    wrap.append(input);
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'pw-toggle'; button.textContent = 'Show';
    button.setAttribute('aria-label', 'Show password'); button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      button.textContent = showing ? 'Show' : 'Hide';
      button.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
      button.setAttribute('aria-pressed', String(!showing));
      input.focus();
    });
    wrap.append(button);
    // hide them again whenever the form is cleared
    form.addEventListener('reset', () => { input.type = 'password'; button.textContent = 'Show'; button.setAttribute('aria-pressed', 'false'); });
  });
}

const passwordForm = document.querySelector('#password-form');
addPasswordToggles(passwordForm);
addPasswordToggles(document.querySelector('#delete-form'));
passwordForm.addEventListener('submit', async event => {
  event.preventDefault();
  const errorText = document.querySelector('#password-error');
  errorText.textContent = '';
  const { current, new: newPassword, confirm } = passwordForm.elements;
  if (newPassword.value !== confirm.value) { errorText.textContent = "The two new passwords don't match."; return; }
  const result = await sendJSON('/api/profile/password', 'POST', { current: current.value, new: newPassword.value });
  if (!result.ok) { errorText.textContent = result.data.error || 'Could not change the password.'; return; }
  passwordForm.reset();
  const added = profile.has_password === false;
  profile.has_password = true;
  renderAccountSecurity();
  showToast(added ? `Password added 🔒 You can now log in as @${profile.username}.` : 'Password changed 🔒');
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

// ---------- Fin 🌙 (SpendBuddy, the jellyfish) ----------
const firstName = () => (profile ? (profile.display_name || profile.username).trim().split(/\s+/)[0] : 'friend');

// Mood follows your money (and the clock)
function buddyMood() {
  const hour = new Date().getHours();
  if (hour >= 23 || hour < 5) return 'sleepy';
  if (!transactions.length) return 'happy';
  const totals = getTotals();
  if (totals.balance < 0) return 'worried';
  const checks = budgetCheck();
  if (checks.some(check => check.status === 'over')) return 'worried';
  if (checks.length && checks.every(check => check.status === 'ok') && new Date().getDate() >= 20) return 'excited';
  const near = closestGoal();
  if ((near && near.percent >= 75) || totals.savingsRate >= 20) return 'excited';
  return 'happy';
}

// Cheeky things SpendBuddy might say when you click it
function buddyLines() {
  const lines = [
    `Hey ${firstName()}! 👋`,
    'It\'s me, Fin! Just floating through your finances 🌙',
    'I\'m 95% water and 5% money advice 💧',
    'No brain, no bones, still great at budgets 😌',
    'Drag me anywhere. I\'m very portable ✨',
    'Psst… press N. I love new transactions.',
    'Boop me again. I dare you 😏'
  ];
  if (!transactions.length) return [...lines, 'No transactions yet? I\'m bored. Add one! 🥱'];
  const totals = getTotals();
  const month = monthStats();
  const near = closestGoal();
  const streak = loggingStreak();
  lines.push(totals.balance >= 0
    ? `You've got ${money(totals.balance)} left to spend. Don't make me sting 😤`
    : `We're ${money(-totals.balance)} over. Hide the wallet! 🙈`);
  if (totals.savings > 0) lines.push(`${money(totals.savings)} tucked away. I'm guarding it 🛡️`);
  if (near) lines.push(`Only ${money(near.goal.target - goalSaved(near.goal))} to go for your ${near.goal.name}! ${near.goal.emoji}`);
  if (month.top) lines.push(`I saw all that ${month.top[0]} spending 👀 ${money(month.top[1])} this ${month.name}!`);
  if (month.change !== null) lines.push(month.change <= 0
    ? `Spending is down ${Math.abs(month.change)}% vs last month. Proud of you 🥹`
    : `Spending is up ${month.change}% vs last month. Hmm… 🤨`);
  if (streak > 1) lines.push(`🔥 ${streak}-day streak! Break it and I sting ⚡`);
  const checks = budgetCheck();
  const over = checks.filter(check => check.status === 'over');
  const close = checks.filter(check => check.status === 'warn');
  if (over.length) over.forEach(check => lines.push(`${check.category} is ${money(check.spent - check.monthly_limit)} over budget. My tentacles are tingling 😰`));
  if (close.length) close.forEach(check => lines.push(`Careful! ${check.category} is at ${check.percent}%. Only ${money(check.monthly_limit - check.spent)} left 🫣`));
  if (checks.length && !over.length && !close.length) lines.push(`All ${checks.length} budget${checks.length === 1 ? '' : 's'} on track. Smooth sailing! 🌊✨`);
  if (!checks.length) lines.push('No budgets yet? Give me a limit to guard 🛡️ (Budgets page!)');
  // upcoming reminders (next 7 days)
  reminders.filter(item => daysFromToday(item.due_date) <= 7).slice(0, 2).forEach(item => {
    const days = daysFromToday(item.due_date);
    lines.push(`Don't forget: ${item.title}${item.amount ? ` (${money(item.amount)})` : ''} ${days < 0 ? 'is overdue 👀' : days === 0 ? 'is due today 🔔' : days === 1 ? 'is due tomorrow 💡' : `is due in ${days} days 🌙`}`);
  });
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
  homeBuddy.say(type === 'income' ? 'Ka-ching! 💰✨' : 'Saved! So shiny ✨');
}

// SpendBuddy reacts when an expense pushes a budget near (80%) or past its limit.
function buddyBudgetReact(item) {
  if (!homeBuddy) return;
  const check = budgetCheck().find(entry => entry.category === item.category);
  if (!check) return;
  homeBuddy.setMood(buddyMood());
  homeBuddy.sideEye();
  homeBuddy.say(check.status === 'over'
    ? `Eek! 😱 ${check.category} is ${money(check.spent - check.monthly_limit)} over budget!`
    : `Easy there! ${check.category} is at ${check.percent}% 🫣 ${money(check.monthly_limit - check.spent)} left.`, 6000);
}

// When you open the Budgets page, SpendBuddy gives you the headline.
function buddyBudgetHello() {
  if (!homeBuddy) return;
  const checks = budgetCheck();
  const over = checks.filter(check => check.status === 'over');
  const close = checks.filter(check => check.status === 'warn');
  homeBuddy.say(!checks.length ? 'Set a limit and I\'ll float guard 🛡️'
    : over.length ? `Uh-oh… ${over.map(check => check.category).join(' & ')} went over 😬`
    : close.length ? `${close[0].category} is getting close (${close[0].percent}%). Steady! 🫣`
    : `All ${checks.length} on track. I'm so proud 🥹`, 5000);
}

let greeted = false;
function greetWithBuddy() {
  if (greeted || !homeBuddy) return;
  greeted = true;
  setTimeout(() => homeBuddy.say(`Hey ${firstName()}! It's me, Fin 🌙 Boop me or drag me around!`, 6000), 900);
}

homeBuddy = SpendBuddy.create();
homeBuddy.setLines(buddyLines);
homeBuddy.setMood(buddyMood());

// Profile → Fin: Roaming / Stay in corner / Hidden (remembered in this browser)
function renderBuddySetting() {
  document.querySelectorAll('[data-buddy-setting]').forEach(button => {
    const on = button.dataset.buddySetting === homeBuddy.getSetting();
    button.classList.toggle('active', on);
    button.setAttribute('aria-checked', on);
    button.setAttribute('role', 'radio');
  });
}
document.querySelector('#buddy-setting').addEventListener('click', event => {
  const button = event.target.closest('[data-buddy-setting]');
  if (!button) return;
  homeBuddy.setSetting(button.dataset.buddySetting);
  renderBuddySetting();
  if (button.dataset.buddySetting === 'roam') homeBuddy.say('Free to roam! Wheee 💫', 2500);
  if (button.dataset.buddySetting === 'corner') homeBuddy.say('I\'ll stay right here 🌙', 2500);
});
renderBuddySetting();

// ---------- Reminders 🔔 (bills and payments Fin nudges you about) ----------
let reminders = [];
let editingReminder = null;
const reminderForm = document.querySelector('#reminder-form');
const reminderList = document.querySelector('#reminder-list');
const daysFromToday = iso => Math.round((new Date(`${iso}T00:00:00`) - new Date(`${todayISO()}T00:00:00`)) / 86400000);
const repeatLabel = { weekly: 'every week', monthly: 'every month', yearly: 'every year' };

function dueLabel(iso) {
  const days = daysFromToday(iso);
  if (days < -1) return `${-days} days overdue`;
  if (days === -1) return 'Overdue since yesterday';
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days <= 6) return `Due in ${days} days · ${new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' })}`;
  return `Due ${prettyDate(iso)}`;
}
const urgency = iso => { const d = daysFromToday(iso); return d < 0 ? 'overdue' : d === 0 ? 'today' : d <= 3 ? 'soon' : 'later'; };

async function loadReminders() {
  const res = await fetch('/api/reminders');
  if (!res.ok) return;
  reminders = await res.json();
  renderReminders();
}

function renderReminders() {
  document.querySelector('#reminders-subtitle').textContent = isOrg()
    ? 'Bills and payments for your team. Fin nudges everyone when they\'re due'
    : 'Bills and payments Fin will nudge you about';
  if (!reminders.length) {
    reminderList.innerHTML = `<li class="reminder-empty">Nothing to remember yet. Add a bill here, or ask FIN: <em>"remind me to pay rent on the 1st"</em> 🌙</li>`;
    return;
  }
  reminderList.innerHTML = reminders.map(item => `
    <li class="reminder-item ${urgency(item.due_date)}" data-reminder-id="${item.id}">
      <span class="reminder-dot" aria-hidden="true"></span>
      <div class="reminder-text">
        <strong>${escapeHTML(item.title)}${item.amount ? ` <span class="reminder-amount">${money(item.amount)}</span>` : ''}</strong>
        <span>${dueLabel(item.due_date)}${item.repeat !== 'none' ? ` · ↻ ${repeatLabel[item.repeat]}` : ''}</span>
      </div>
      <div class="reminder-actions">
        <button type="button" class="reminder-done" data-reminder-action="done" title="${item.repeat === 'none' ? 'Mark as done' : 'Paid: move to the next date'}">✓ ${item.amount ? 'Paid' : 'Done'}</button>
        <button type="button" class="icon-action" data-reminder-action="edit" title="Edit" aria-label="Edit ${escapeHTML(item.title)}">✎</button>
        <button type="button" class="icon-action" data-reminder-action="delete" title="Delete" aria-label="Delete ${escapeHTML(item.title)}">✕</button>
      </div>
    </li>`).join('');
}

function openReminderForm(item = null) {
  editingReminder = item;
  reminderForm.reset();
  reminderForm.elements.title.value = item ? item.title : '';
  reminderForm.elements.amount.value = item && item.amount ? item.amount : '';
  reminderForm.elements.due_date.value = item ? item.due_date : todayISO();
  reminderForm.elements.repeat.value = item ? item.repeat : 'none';
  document.querySelector('#reminder-save').textContent = item ? 'Save changes' : 'Save reminder';
  document.querySelector('#reminder-error').textContent = '';
  reminderForm.classList.remove('hidden');
  reminderForm.elements.title.focus();
}
const closeReminderForm = () => { reminderForm.classList.add('hidden'); editingReminder = null; };

document.querySelector('#add-reminder-button').addEventListener('click', () =>
  reminderForm.classList.contains('hidden') || editingReminder ? openReminderForm() : closeReminderForm());
document.querySelector('#reminder-cancel').addEventListener('click', closeReminderForm);
reminderForm.addEventListener('submit', async event => {
  event.preventDefault();
  const body = {
    title: reminderForm.elements.title.value, amount: reminderForm.elements.amount.value,
    due_date: reminderForm.elements.due_date.value, repeat: reminderForm.elements.repeat.value
  };
  const result = editingReminder
    ? await sendJSON(`/api/reminders/${editingReminder.id}`, 'PUT', body)
    : await sendJSON('/api/reminders', 'POST', body);
  if (!result.ok) { document.querySelector('#reminder-error').textContent = result.data.error || 'Could not save that.'; return; }
  const wasEditing = Boolean(editingReminder);
  closeReminderForm();
  await loadReminders();
  showToast(wasEditing ? 'Reminder updated 🔔' : 'Got it! Fin will nudge you 🔔');
  if (!wasEditing && homeBuddy) homeBuddy.say(`Noted! I'll remind you about "${result.data.title}" 🔔`, 3500);
});

reminderList.addEventListener('click', async event => {
  const button = event.target.closest('[data-reminder-action]');
  if (!button) return;
  const id = Number(button.closest('[data-reminder-id]').dataset.reminderId);
  const item = reminders.find(r => r.id === id);
  if (!item) return;
  const action = button.dataset.reminderAction;
  if (action === 'edit') { openReminderForm(item); return; }
  if (action === 'delete') {
    if (!confirm(`Delete the reminder "${item.title}"?`)) return;
    await sendJSON(`/api/reminders/${id}`, 'DELETE');
    await loadReminders();
    showToast('Reminder deleted');
    return;
  }
  if (action === 'done') {
    const result = await sendJSON(`/api/reminders/${id}/done`, 'POST', { today: todayISO() });
    if (!result.ok) { showToast(result.data.error || 'Could not update that.'); return; }
    await loadReminders();
    if (result.data.done) showToast(`Ticked off: ${item.title} ✓`);
    else showToast(`${item.title}: next one ${prettyDate(result.data.reminder.due_date)} 🔁`);
    if (homeBuddy) { homeBuddy.setMood('excited'); homeBuddy.say(['Look at you, on top of things! ✨', 'One less thing to worry about 🌙', 'Paid and proud 💪'][Math.floor(Math.random() * 3)], 3000); setTimeout(() => homeBuddy.setMood(buddyMood()), 3200); }
  }
});
// FIN's chat adds reminders too (after you tap "Add reminder" there)
window.addEventListener('spendwise:reminders-changed', loadReminders);

// Fin lowkey nudges you about anything overdue or due within 2 days (once per reminder per visit).
function reminderNudge() {
  if (!homeBuddy || homeBuddy.getSetting() === 'hidden') return;
  const today = todayISO();
  let nudged = [];
  try { nudged = JSON.parse(sessionStorage.getItem('fin-nudged') || '[]'); } catch (e) {}
  const due = reminders
    .filter(item => daysFromToday(item.due_date) <= 2 && !(item.snooze_until && item.snooze_until > today))
    .filter(item => !nudged.includes(`${item.id}:${item.due_date}`));
  if (!due.length) return;
  const item = due[0]; // the most urgent (they're sorted by date)
  const days = daysFromToday(item.due_date);
  const what = `${item.title}${item.amount ? ` (${money(item.amount)})` : ''}`;
  const line = days < 0 ? `Psst… ${what} was due ${days === -1 ? 'yesterday' : `${-days} days ago`} 👀`
    : days === 0 ? `Psst… ${what} is due today 🔔`
    : days === 1 ? `Heads up: ${what} is due tomorrow 💡`
    : `Lowkey reminder: ${what} is due in 2 days 🌙`;
  homeBuddy.say(due.length > 1 ? `${line} (+${due.length - 1} more on your Overview)` : line, 7000);
  nudged.push(`${item.id}:${item.due_date}`);
  try { sessionStorage.setItem('fin-nudged', JSON.stringify(nudged)); } catch (e) {}
}
setInterval(reminderNudge, 20 * 60 * 1000); // check again every 20 minutes while the app is open

async function loadTransactions() {
  const res = await fetch('/api/transactions');
  if (res.status === 401) { window.location.href = '/login'; return; } // not logged in
  transactions = await res.json();
  const goalsRes = await fetch('/api/goals');
  if (goalsRes.ok) goals = await goalsRes.json();
  const budgetsRes = await fetch('/api/budgets');
  if (budgetsRes.ok) budgets = await budgetsRes.json();
  budgetsLoaded = true;
  const eventsRes = await fetch('/api/events');
  if (eventsRes.ok) events = await eventsRes.json();
  const categoriesRes = await fetch('/api/categories');
  if (categoriesRes.ok) { customCategories = await categoriesRes.json(); applyCustomCategories(); }
  chosenColour = freeColour();
  renderCategoryManager();
  renderApp();
  const me = await fetch('/api/me');
  if (me.ok) {
    profile = await me.json();
    await loadOrg();
    fillProfileForm();
    applyAccountType();
    renderApp(); // again, now that we know if this is an organisation (who paid, members…)
    renderProfile();
    greetWithBuddy();
  }
  await loadReminders();
  setTimeout(reminderNudge, greeted ? 8000 : 2000); // after Fin's hello
}

document.querySelector('#logout-button').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  try { sessionStorage.clear(); } catch (e) {}   // forget FIN's chat in this tab
  window.location.href = '/login';
});
loadTransactions();