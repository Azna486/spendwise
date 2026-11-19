// FIN — the SpendWise AI financial assistant (chat panel).
// A floating button (bottom-right) opens a chat panel. Questions go to POST /api/fin/chat on our own
// server, which reads your real SpendWise data and asks the AI model. No API keys live in this file.
(function () {
  const SUGGESTIONS = [
    'Analyse my spending this month.',
    'What is my biggest expense?',
    'How much did I save this month?',
    'Am I exceeding my budget?',
    'Compare my spending over the last three months.',
    'Help me create a savings plan.',
    'Where can I reduce my expenses?',
    'What bills are coming up?',
    'Remind me to pay rent on the 1st of every month.'
  ];
  const TOOL_LABELS = {
    get_financial_overview: 'overview', get_spending_by_category: 'categories', get_monthly_summary: 'monthly totals',
    search_transactions: 'transactions', get_budget_status: 'budgets', get_savings_and_goals: 'savings & goals',
    get_events: 'events', get_reminders: 'reminders'
  };
  const REPEAT_TEXT = { none: '', weekly: 'Every week', monthly: 'Every month', yearly: 'Every year' };
  const MAX_CHARS = 2000;
  const STORE_KEY = 'spendwise-fin-chat';

  let history = [];      // [{ role: 'user' | 'assistant', content, time, tools }] (sent back for context)
  let busy = false;
  let status = null;     // from /api/fin/status
  let lastQuestion = '';

  // ---------- small helpers ----------
  const escapeText = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const clock = iso => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  const nowIso = () => new Date().toISOString();
  const firstName = () => {
    const me = typeof profile !== 'undefined' && profile ? profile : null; // `profile` comes from app.js
    return me ? (me.display_name || me.username || '').trim().split(/\s+/)[0] : '';
  };
  const isOrgAccount = () => typeof profile !== 'undefined' && profile && profile.org;

  // Tiny, safe markdown: we escape everything first, then allow **bold**, *italics*, `code`, lists and line breaks.
  function renderMarkdown(text) {
    // `code` first (so nothing inside it gets formatted), then bold and italics
    const inline = line => String(line).split(/(`[^`]+`)/).map(part => part.startsWith('`') && part.endsWith('`') && part.length > 2
      ? `<code>${escapeText(part.slice(1, -1))}</code>`
      : escapeText(part)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>')
        .replace(/(^|\s)_(?!\s)(.+?)_(?=\s|$|[.,!?)])/g, '$1<em>$2</em>')).join('');
    const blocks = [];
    let list = null;
    String(text).replace(/\r/g, '').split('\n').forEach(raw => {
      const line = raw.trimEnd();
      const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
      const numbered = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
      if (bullet || numbered) {
        const kind = bullet ? 'ul' : 'ol';
        if (!list || list.kind !== kind) { list = { kind, items: [] }; blocks.push(list); }
        list.items.push(inline(bullet ? bullet[1] : numbered[2]));
        return;
      }
      list = null;
      if (!line.trim()) { blocks.push({ kind: 'gap' }); return; }
      const heading = line.match(/^#{1,6}\s+(.*)$/);
      blocks.push({ kind: 'p', html: heading ? `<strong>${inline(heading[1])}</strong>` : inline(line) });
    });
    let html = '';
    let paragraph = [];
    const flush = () => { if (paragraph.length) { html += `<p>${paragraph.join('<br>')}</p>`; paragraph = []; } };
    blocks.forEach(block => {
      if (block.kind === 'p') { paragraph.push(block.html); return; }
      flush();
      if (block.kind === 'ul' || block.kind === 'ol') html += `<${block.kind}>${block.items.map(item => `<li>${item}</li>`).join('')}</${block.kind}>`;
    });
    flush();
    return html;
  }

  // A little jellyfish icon (same family as Fin, the mascot)
  const icon = `<svg viewBox="0 0 40 44" aria-hidden="true" focusable="false">
      <path d="M6 22 C6 11 12 5 20 5 C28 5 34 11 34 22 C31 24 29 21 26 23 C23 25 21 22 20 24 C18 22 16 25 13 23 C10 21 8 24 6 22 Z" fill="currentColor" opacity=".95"/>
      <path d="M13 25 C11 31 15 34 13 40 M20 26 C19 32 22 35 20 41 M27 25 C29 31 25 34 27 40" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity=".7"/>
      <circle cx="16" cy="16" r="1.6" fill="var(--fin-icon-face, #142B52)"/><circle cx="24" cy="16" r="1.6" fill="var(--fin-icon-face, #142B52)"/>
      <path d="M27.5 8.5 l.8 1.8 1.8.8 -1.8.8 -.8 1.8 -.8-1.8 -1.8-.8 1.8-.8z" fill="var(--gold, #D4B06A)"/>
    </svg>`;

  // ---------- build the UI ----------
  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = 'fin-launcher';
  launcher.setAttribute('aria-label', 'Open FIN, your AI financial assistant');
  launcher.setAttribute('aria-expanded', 'false');
  launcher.setAttribute('aria-controls', 'fin-chat');
  launcher.innerHTML = `${icon}<span class="fin-launcher-label">Ask FIN</span><span class="fin-unread" hidden></span>`;

  const panel = document.createElement('section');
  panel.className = 'fin-chat';
  panel.id = 'fin-chat';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'FIN, AI financial assistant');
  panel.hidden = true;
  panel.innerHTML = `
    <header class="fin-head">
      <span class="fin-avatar">${icon}</span>
      <div class="fin-title">
        <strong>FIN</strong>
        <span class="fin-status"><i></i><span id="fin-status-text">Your financial assistant</span></span>
      </div>
      <button type="button" class="fin-icon-button" data-fin="minimise" title="Minimise" aria-label="Minimise chat">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>
      <button type="button" class="fin-icon-button" data-fin="close" title="Close and clear chat" aria-label="Close chat">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>
    </header>
    <div class="fin-body" id="fin-messages" role="log" aria-live="polite" aria-relevant="additions"></div>
    <div class="fin-suggestions" id="fin-suggestions" aria-label="Suggested questions"></div>
    <form class="fin-compose" id="fin-form">
      <button type="button" class="fin-icon-button fin-ideas" data-fin="ideas" title="Show suggested questions" aria-label="Show suggested questions">✦</button>
      <textarea id="fin-input" rows="1" maxlength="${MAX_CHARS}" placeholder="Ask FIN about your money…" aria-label="Message FIN"></textarea>
      <button type="submit" class="fin-send" id="fin-send" aria-label="Send message">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </form>
    <p class="fin-foot">FIN reads your SpendWise data to answer. It only changes things (like adding a reminder) when you tap to approve. AI can make mistakes. Check important numbers.</p>`;
  document.body.append(launcher, panel);

  const list = panel.querySelector('#fin-messages');
  const suggestionBox = panel.querySelector('#fin-suggestions');
  const form = panel.querySelector('#fin-form');
  const input = panel.querySelector('#fin-input');
  const sendButton = panel.querySelector('#fin-send');
  const statusText = panel.querySelector('#fin-status-text');
  const unread = launcher.querySelector('.fin-unread');

  // ---------- messages ----------
  function scrollToEnd() { list.scrollTop = list.scrollHeight; }

  // A change FIN suggested (only reminders for now). Nothing is saved until you tap the button.
  function actionCard(message, index) {
    const action = message.actions[index];
    if (action.tool !== 'create_reminder') return null;
    const input = action.input || {};
    const card = document.createElement('div');
    card.className = `fin-action ${action.state || 'pending'}`;
    const when = input.due_date ? new Date(`${input.due_date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '?';
    const amount = Number(input.amount) > 0 ? ` · ₹${Number(input.amount).toLocaleString('en-IN')}` : '';
    const repeat = REPEAT_TEXT[input.repeat] ? ` · ↻ ${REPEAT_TEXT[input.repeat]}` : '';
    const footer = {
      pending: `<div class="fin-action-buttons"><button type="button" data-act="add">🔔 Add reminder</button><button type="button" data-act="skip" class="ghost">No thanks</button></div>`,
      done: '<p class="fin-action-state">✓ Added to your reminders</p>',
      skipped: '<p class="fin-action-state">Not added</p>'
    }[action.state || 'pending'];
    card.innerHTML = `<p class="fin-action-label">New reminder</p>
      <strong>${escapeText(input.title || 'Reminder')}</strong>
      <span>${escapeText(when + amount + repeat)}</span>
      <p class="fin-action-error" role="alert"></p>${footer}`;
    card.addEventListener('click', async event => {
      const button = event.target.closest('[data-act]');
      if (!button || (action.state && action.state !== 'pending')) return;
      if (button.dataset.act === 'skip') {
        action.state = 'skipped';
      } else {
        button.disabled = true;
        const res = await fetch('/api/reminders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
          .catch(() => null);
        const data = res ? await res.json().catch(() => ({})) : {};
        if (!res || !res.ok) {
          button.disabled = false;
          card.querySelector('.fin-action-error').textContent = data.error || "Couldn't save it. Try again?";
          return;
        }
        action.state = 'done';
        window.dispatchEvent(new CustomEvent('spendwise:reminders-changed'));
      }
      save();
      card.replaceWith(actionCard(message, index));
    });
    return card;
  }

  function addMessage(message) {
    const row = drawMessage(message);
    (message.actions || []).forEach((_, index) => {
      const card = actionCard(message, index);
      if (card) row.querySelector('.fin-bubble-wrap').insertBefore(card, row.querySelector('.fin-meta'));
    });
    return row;
  }

  function drawMessage({ role, content, time = nowIso(), tools = [], kind = '' }) {
    const row = document.createElement('div');
    row.className = `fin-msg ${role} ${kind}`;
    const who = role === 'user' ? 'You' : 'FIN';
    const checked = tools && tools.length
      ? `<span class="fin-checked" title="FIN read this from your SpendWise data">✓ Checked your ${[...new Set(tools.map(name => TOOL_LABELS[name] || name))].join(', ')}</span>` : '';
    row.innerHTML = `
      ${role === 'assistant' ? `<span class="fin-msg-avatar">${icon}</span>` : ''}
      <div class="fin-bubble-wrap">
        <div class="fin-bubble">${role === 'user' ? `<p>${escapeText(content).replace(/\n/g, '<br>')}</p>` : renderMarkdown(content)}</div>
        <div class="fin-meta"><span>${who} · ${clock(time)}</span>${checked}</div>
      </div>`;
    list.append(row);
    scrollToEnd();
    return row;
  }

  function addError(message, canRetry) {
    const row = addMessage({ role: 'assistant', content: message, kind: 'error' });
    if (canRetry) {
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'fin-retry';
      retry.textContent = '↻ Try again';
      retry.addEventListener('click', () => { row.remove(); send(lastQuestion, { retry: true }); });
      row.querySelector('.fin-bubble').append(retry);
    }
  }

  function showTyping(on) {
    let typing = list.querySelector('.fin-typing');
    if (on && !typing) {
      typing = document.createElement('div');
      typing.className = 'fin-msg assistant fin-typing';
      typing.innerHTML = `<span class="fin-msg-avatar">${icon}</span><div class="fin-bubble-wrap"><div class="fin-bubble"><span class="fin-dots"><i></i><i></i><i></i></span><span class="fin-typing-text">Checking your data…</span></div></div>`;
      list.append(typing);
      scrollToEnd();
    } else if (!on && typing) typing.remove();
  }

  function renderSuggestions(show) {
    suggestionBox.innerHTML = show ? SUGGESTIONS.map(text => `<button type="button" class="fin-chip" data-question="${escapeText(text)}">${escapeText(text)}</button>`).join('') : '';
    suggestionBox.classList.toggle('open', show);
  }

  function welcome() {
    list.innerHTML = '';
    const name = firstName();
    addMessage({
      role: 'assistant',
      content: `Hi${name ? ` ${name}` : ''}! I'm **FIN**, your SpendWise financial assistant 🌙\n\n` +
        `I can look at ${isOrgAccount() ? "your organisation's" : 'your'} real transactions, budgets and ${isOrgAccount() ? 'events' : 'savings goals'} ` +
        'to answer questions, spot where your money goes and help you plan. I only read your data. The one thing I can do is set reminders for bills and payments, and only after you tap to approve.\n\n' +
        'Try one of these, or ask me anything:'
    });
    renderSuggestions(true);
    if (status && !status.available) {
      addMessage({ role: 'assistant', kind: 'notice', content: "**Heads up:** my AI connection isn't set up yet, so I can't answer questions. " +
        'Add a `GROQ_API_KEY` (or `ANTHROPIC_API_KEY`) to the `.env` file and restart SpendWise (see the README).' });
    }
  }

  function save() {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(history.slice(-30))); } catch (e) {}
  }

  function restore() {
    try { history = JSON.parse(sessionStorage.getItem(STORE_KEY) || '[]'); } catch (e) { history = []; }
    if (!Array.isArray(history)) history = [];
    welcome();
    if (history.length) {
      renderSuggestions(false);
      history.forEach(message => addMessage(message));
    }
  }

  // ---------- sending ----------
  async function send(text, { retry = false } = {}) {
    const question = String(text || '').trim();
    if (!question || busy) return;
    if (question.length > MAX_CHARS) { addError(`That's a bit long. Please keep it under ${MAX_CHARS} characters.`); return; }
    busy = true;
    lastQuestion = question;
    renderSuggestions(false);
    if (!retry) {
      const message = { role: 'user', content: question, time: nowIso() };
      addMessage(message);
      history.push(message);
      save();
    }
    input.value = '';
    autoGrow();
    updateSend();
    showTyping(true);
    try {
      const res = await fetch('/api/fin/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: question,
          // earlier turns for context (without the question we're sending now)
          history: history.slice(0, -1).slice(-16).map(({ role, content }) => ({ role, content }))
        })
      });
      if (res.status === 401) { window.location.href = '/login'; return; }
      const data = await res.json().catch(() => ({}));
      showTyping(false);
      if (!res.ok) {
        addError(data.error || 'Something went wrong. Please try again.', res.status !== 400 && data.code !== 'not_configured');
        return;
      }
      const reply = { role: 'assistant', content: data.reply, time: data.time || nowIso(), tools: data.tools_used || [],
                      actions: (data.pending_actions || []).map(action => ({ ...action, state: 'pending' })) };
      addMessage(reply);
      history.push(reply);
      save();
      if (panel.hidden) unread.hidden = false;
    } catch (error) {
      showTyping(false);
      addError('I can\'t reach the SpendWise server. Is "python main.py" still running?', true);
    } finally {
      busy = false;
      updateSend();
      if (!panel.hidden) input.focus();
    }
  }

  // ---------- open / minimise / close ----------
  async function loadStatus() {
    try {
      const res = await fetch('/api/fin/status');
      if (res.status === 401) return;
      status = await res.json();
    } catch (e) { status = null; }
    panel.classList.toggle('offline', Boolean(status && !status.available));
    statusText.textContent = status && !status.available ? 'AI not set up yet' : 'Your financial assistant';
  }

  async function open() {
    if (!status) {
      await loadStatus();
      if (!history.length) welcome();
    }
    panel.hidden = false;
    requestAnimationFrame(() => panel.classList.add('visible'));
    launcher.classList.add('active');
    launcher.setAttribute('aria-expanded', 'true');
    unread.hidden = true;
    scrollToEnd();
    setTimeout(() => input.focus(), 150);
  }

  function minimise() {
    panel.classList.remove('visible');
    launcher.classList.remove('active');
    launcher.setAttribute('aria-expanded', 'false');
    setTimeout(() => { if (!panel.classList.contains('visible')) panel.hidden = true; }, 220);
    launcher.focus();
  }

  function close() {
    // Closing ends the conversation (minimise keeps it)
    history = [];
    save();
    minimise();
    setTimeout(welcome, 240);
  }

  launcher.addEventListener('click', () => (panel.hidden ? open() : minimise()));
  panel.addEventListener('click', event => {
    const action = event.target.closest('[data-fin]');
    if (action) {
      if (action.dataset.fin === 'minimise') minimise();
      if (action.dataset.fin === 'close') close();
      if (action.dataset.fin === 'ideas') renderSuggestions(!suggestionBox.classList.contains('open'));
      return;
    }
    const chip = event.target.closest('[data-question]');
    if (chip) send(chip.dataset.question);
  });
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.stopPropagation(); minimise(); }
  });

  // ---------- input box: Enter sends, Shift+Enter adds a new line ----------
  function autoGrow() {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
  }
  function updateSend() { sendButton.disabled = busy || !input.value.trim(); }
  input.addEventListener('input', () => { autoGrow(); updateSend(); });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      send(input.value);
    }
  });
  form.addEventListener('submit', event => { event.preventDefault(); send(input.value); });

  restore();
  updateSend();
  window.FinChat = { open, minimise, close, ask: question => { open(); send(question); } };
})();
