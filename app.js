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
  Food: '#E8A36D', Shopping: '#A49AE3', Transport: '#7BA9DF',
  Education: '#69B88A', Bills: '#D5BD70', Health: '#DF8E9B',
  Salary: '#29845E', Freelance: '#69B6A5', Other: '#AAB4AE',
  Savings: '#8E8FD8', Stocks: '#6B71BD', 'Emergency fund': '#B3A9E6'
};
const categoryIcons = {
  Food: '♨', Shopping: '◇', Transport: '↗', Education: '▤', Bills: '▣',
  Health: '+', Salary: '↓', Freelance: '✳', Other: '•••',
  Income: '↓', Savings: '◈', Stocks: '↟', 'Emergency fund': '⛑'
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
let showAll = false;
let spendingChart = null;
let toastTimeout;

function getTotals() {
  const income = sum(transactions.filter(item => item.type === 'income'));
  const expenses = sum(transactions.filter(item => item.type === 'expense'));
  const savings = sum(transactions.filter(item => item.type === 'savings'));
  const balance = income - expenses - savings; // money left to spend
  const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0;
  return { income, expenses, savings, balance, savingsRate };
}

function renderSummary() {
  const totals = getTotals();
  incomeValue.textContent = money(totals.income);
  expenseValue.textContent = money(totals.expenses);
  balanceValue.textContent = money(totals.balance);
  savingsValue.textContent = money(totals.savings);
  document.querySelector('#savings-caption').textContent = `${totals.savingsRate}% of income set aside`;
  savingsFill.style.width = `${Math.max(0, Math.min(100, totals.savingsRate))}%`;
  donutTotal.textContent = money(totals.expenses);
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
        borderColor: '#ffffff',
        hoverOffset: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '76%',
      plugins: { legend: { display: false }, tooltip: {
        callbacks: { label: context => ` ${context.label}: ${money(context.raw)}` }
      } }
    }
  });
  categoryLegend.innerHTML = categories.slice(0, 5).map(([category, amount]) => `
    <div class="legend-item">
      <span class="legend-dot" style="background:${categoryColors[category] || categoryColors.Other}"></span>
      <span class="legend-name">${escapeHTML(category)}</span>
      <span class="legend-amount">${money(amount)}</span>
    </div>`).join('');
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
  const searchTerm = searchInput.value.trim().toLowerCase();
  const filtered = transactions
    .filter(item => currentFilter === 'all' || item.type === currentFilter)
    .filter(item => `${item.name} ${item.category} ${item.date}`.toLowerCase().includes(searchTerm))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const visible = showAll ? filtered : filtered.slice(0, 6);
  if (!visible.length) {
    transactionBody.innerHTML = '<tr><td colspan="5" class="empty-state">No transactions match your search.</td></tr>';
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
  document.querySelector('#show-all-button').classList.toggle('hidden', filtered.length <= 6 || showAll);
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
  renderChart();
  renderInsights();
  renderTransactions();
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
function updateStockFields() {
  stockFields.classList.toggle('hidden', !isStock());
  form.elements.name.placeholder = isStock() ? 'e.g. Bought TCS shares' : 'e.g. Coffee with friends';
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
  const name = String(formData.get('name')).trim();
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
  const filters = ['all', 'expense', 'income', 'savings'];
  const labels = ['All types', 'Expenses only', 'Income only', 'Savings only'];
  const nextIndex = (filters.indexOf(currentFilter) + 1) % filters.length;
  currentFilter = filters[nextIndex];
  filterButton.innerHTML = `${labels[nextIndex]} <span>⌄</span>`;
  showAll = false;
  renderTransactions();
});
document.querySelector('#show-all-button').addEventListener('click', () => {
  showAll = true;
  renderTransactions();
});
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
async function loadTransactions() {
  const res = await fetch('/api/transactions');
  if (res.status === 401) { window.location.href = '/login'; return; } // not logged in
  transactions = await res.json();
  renderApp();
  const me = await fetch('/api/me');
  if (me.ok) document.querySelector('#username-label').textContent = (await me.json()).username;
}

document.querySelector('#logout-button').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login';
});
loadTransactions();