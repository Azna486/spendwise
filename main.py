from datetime import timedelta, date
import calendar
from flask import Flask, jsonify, request, send_from_directory, session, redirect, abort, Response, g
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
import hashlib
import os
import re
import secrets
import sqlite3
import time
from collections import defaultdict, deque

import fin_ai  # FIN, the AI financial assistant (fin_ai.py + fin_tools.py)

# Settings such as ANTHROPIC_API_KEY can live in a .env file next to this one (it's in .gitignore).
fin_ai.load_env_file(os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'))

# static_folder=None: we decide exactly which files the browser may download (see bottom).
# Otherwise anyone could download main.py or spendwise.db.
app = Flask(__name__, static_folder=None)
APP_DIR = os.path.dirname(os.path.abspath(__file__))


def load_secret_key():
    """The secret key signs the login cookie so nobody can fake being logged in.
    Uses SPENDWISE_SECRET_KEY if you set one; otherwise makes a long random key once and keeps it
    in .secret_key (in .gitignore), so logins survive restarts. Never share that file."""
    if os.environ.get('SPENDWISE_SECRET_KEY'):
        return os.environ['SPENDWISE_SECRET_KEY']
    path = os.path.join(APP_DIR, '.secret_key')
    if not os.path.exists(path):
        with open(path, 'w') as file:
            file.write(secrets.token_hex(32))
        os.chmod(path, 0o600)
    with open(path) as file:
        return file.read().strip()


app.secret_key = load_secret_key()
app.permanent_session_lifetime = timedelta(days=180)   # how long code-joined members stay signed in
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_HTTPONLY'] = True
# On the internet (serve.py sets this) the login cookie is only ever sent over https.
app.config['SESSION_COOKIE_SECURE'] = os.environ.get('SPENDWISE_HTTPS') == '1'
app.config['MAX_CONTENT_LENGTH'] = 2 * 1024 * 1024   # biggest upload allowed: 2 MB (profile photos)
DB = os.path.join(APP_DIR, 'spendwise.db')
PUBLIC_FILES = {'styles.css', 'app.js', 'buddy.js', 'buddy.css', 'fin-chat.js', 'fin-chat.css'}


def db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row   # lets us turn rows into dictionaries
    return conn


TRANSACTIONS_TABLE = '''CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    date TEXT NOT NULL,
    amount REAL NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'savings')),
    user_id INTEGER REFERENCES users(id),
    stock_name TEXT,
    quantity REAL,
    goal_id INTEGER
)'''


def init_db():
    with db() as conn:
        conn.execute('''CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL
        )''')
        conn.execute(TRANSACTIONS_TABLE)
        conn.execute('''CREATE TABLE IF NOT EXISTS goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            name TEXT NOT NULL,
            target REAL NOT NULL,
            emoji TEXT NOT NULL DEFAULT '🎁'
        )''')
        # Your own expense categories (e.g. "Pets", "Gym"), on top of the built-in ones.
        conn.execute('''CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            name TEXT NOT NULL COLLATE NOCASE,
            icon TEXT NOT NULL DEFAULT '🏷️',
            color TEXT NOT NULL DEFAULT '#6FA08A',
            UNIQUE (user_id, name)
        )''')
        # One monthly spending limit per expense category, per user.
        # Reminders: bills and payments Fin nudges you about (shared by an organisation, like everything else)
        conn.execute('''CREATE TABLE IF NOT EXISTS reminders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            title TEXT NOT NULL,
            amount REAL,
            due_date TEXT NOT NULL,
            repeat TEXT NOT NULL DEFAULT 'none',
            anchor_day INTEGER,
            snooze_until TEXT,
            done_at TEXT,
            created_by INTEGER,
            created_at TEXT NOT NULL
        )''')
        conn.execute('''CREATE TABLE IF NOT EXISTS budgets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            category TEXT NOT NULL,
            monthly_limit REAL NOT NULL,
            UNIQUE (user_id, category)
        )''')
        # Older databases were made before users existed: add the user_id column if it's missing.
        columns = [row['name'] for row in conn.execute('PRAGMA table_info(transactions)')]
        if 'user_id' not in columns:
            conn.execute('ALTER TABLE transactions ADD COLUMN user_id INTEGER REFERENCES users(id)')
        # Older databases only allowed 'income' and 'expense'. SQLite can't change that rule in place,
        # so we rebuild the table with the new rule and copy every row across.
        table_sql = conn.execute("SELECT sql FROM sqlite_master WHERE name = 'transactions'").fetchone()['sql']
        if "'savings'" not in table_sql:
            conn.execute('ALTER TABLE transactions RENAME TO transactions_old')
            conn.execute(TRANSACTIONS_TABLE)
            conn.execute('INSERT INTO transactions (id, name, category, date, amount, type, user_id) '
                         'SELECT id, name, category, date, amount, type, user_id FROM transactions_old')
            conn.execute('DROP TABLE transactions_old')
        # Stock details (only filled in for Savings → Stocks).
        columns = [row['name'] for row in conn.execute('PRAGMA table_info(transactions)')]
        for column, kind in (('stock_name', 'TEXT'), ('quantity', 'REAL'), ('goal_id', 'INTEGER')):
            if column not in columns:
                conn.execute(f'ALTER TABLE transactions ADD COLUMN {column} {kind}')
        # Organisations: a committee, club or company whose members share one set of money data.
        conn.execute('''CREATE TABLE IF NOT EXISTS organisations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            invite_code TEXT NOT NULL UNIQUE,
            owner_id INTEGER NOT NULL REFERENCES users(id),
            created_at TEXT
        )''')
        # Events (a fest, a trip, a meeting…) with an allowance; transactions can belong to one.
        conn.execute('''CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            name TEXT NOT NULL,
            date TEXT NOT NULL,
            allowance REAL NOT NULL DEFAULT 0,
            closed INTEGER NOT NULL DEFAULT 0,
            created_by INTEGER REFERENCES users(id)
        )''')
        # Sub-events: an event can be part of a main event (e.g. "Day 1" inside "Tech Fest"). One level only.
        columns = [row['name'] for row in conn.execute('PRAGMA table_info(events)')]
        if 'parent_id' not in columns:
            conn.execute('ALTER TABLE events ADD COLUMN parent_id INTEGER REFERENCES events(id)')
        # Who added a transaction, which event it's for, who paid (a member paying from their own pocket)
        # and when that member was paid back.
        columns = [row['name'] for row in conn.execute('PRAGMA table_info(transactions)')]
        for column, kind in (('event_id', 'INTEGER'), ('added_by', 'INTEGER'), ('paid_by', 'INTEGER'), ('settled_at', 'TEXT')):
            if column not in columns:
                conn.execute(f'ALTER TABLE transactions ADD COLUMN {column} {kind}')
        # Profile details (added later, so older databases get the new columns here).
        columns = [row['name'] for row in conn.execute('PRAGMA table_info(users)')]
        for column, kind in (('display_name', 'TEXT'), ('bio', 'TEXT'), ('email', 'TEXT'),
                             ('avatar', 'BLOB'), ('avatar_type', 'TEXT'), ('created_at', 'TEXT'),
                             # 'individual' or 'organisation'; org members have an org_id and a role (admin / member / removed)
                             ('account_type', "TEXT NOT NULL DEFAULT 'individual'"), ('org_id', 'INTEGER'), ('role', 'TEXT')):
            if column not in columns:
                conn.execute(f'ALTER TABLE users ADD COLUMN {column} {kind}')


def login_required(view):
    """Put @login_required above any route that only logged-in users may use.
    It also works out whose money data you're looking at (see scope_id)."""
    @wraps(view)
    def wrapper(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Please log in'}), 401
        with db() as conn:
            user = conn.execute('SELECT u.id, u.username, u.account_type, u.org_id, u.role, o.owner_id '
                                'FROM users u LEFT JOIN organisations o ON o.id = u.org_id WHERE u.id = ?',
                                (session['user_id'],)).fetchone()
        if user is None or user['role'] == 'removed':   # account gone, or removed from the organisation
            session.clear()
            return jsonify({'error': 'Please log in'}), 401
        g.user = user
        # Individuals keep data under their own id. Everyone in an organisation shares the data
        # stored under the organisation owner's id, so they all see the same transactions.
        g.scope = user['owner_id'] if user['org_id'] else user['id']
        return view(*args, **kwargs)
    return wrapper


def scope_id():
    """The id that this account's money data is stored under (you, or your organisation)."""
    return g.scope


def in_org():
    return bool(g.user['org_id'])


def admin_required(view):
    """Only the organisation's admin may use this route."""
    @wraps(view)
    @login_required
    def wrapper(*args, **kwargs):
        if not in_org() or g.user['role'] != 'admin':
            return jsonify({'error': 'Only the organisation admin can do that.'}), 403
        return view(*args, **kwargs)
    return wrapper


def new_invite_code(conn):
    """A short code that's easy to read out loud (no 0/O or 1/I mix-ups)."""
    alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    while True:
        code = '-'.join(''.join(secrets.choice(alphabet) for _ in range(4)) for _ in range(2))
        if not conn.execute('SELECT 1 FROM organisations WHERE invite_code = ?', (code,)).fetchone():
            return code


# ---------- Pages ----------

@app.get('/')
def home():
    if 'user_id' not in session:
        return redirect('/login')
    return send_from_directory(APP_DIR, 'index.html')


@app.get('/login')
def login_page():
    if 'user_id' in session:
        return redirect('/')
    return send_from_directory(APP_DIR, 'login.html')


# ---------- Sign up / log in / log out ----------

# ---------- Slow down password / code guessing ----------
# At most 10 tries per 5 minutes from one visitor on log in, sign up and join.
AUTH_TRIES = defaultdict(deque)


def client_ip():
    # The visitor's real address is put in a header by whatever sits in front of the app:
    # Cloudflare uses CF-Connecting-IP (the default); PythonAnywhere uses X-Real-IP.
    header = os.environ.get('SPENDWISE_IP_HEADER', 'CF-Connecting-IP')
    return request.headers.get(header) or request.remote_addr or '?'


def too_many_tries():
    now = time.time()
    tries = AUTH_TRIES[client_ip()]
    while tries and now - tries[0] > 300:
        tries.popleft()
    if len(tries) >= 10:
        return True
    tries.append(now)
    return False


@app.before_request
def limit_auth_attempts():
    if request.method == 'POST' and request.path in ('/api/login', '/api/signup', '/api/join') and too_many_tries():
        return jsonify({'error': 'Too many tries. Please wait a few minutes and try again.'}), 429


def read_credentials():
    data = request.get_json(silent=True) or {}
    username = str(data.get('username', '')).strip().lower()
    password = str(data.get('password', ''))
    return username, password


def start_session(user_id, username, remember=False):
    session.clear()
    session['user_id'] = user_id
    session['username'] = username
    # People who joined with just a code have no password, so keep them signed in on this device.
    session.permanent = remember


def password_ok(stored_hash, password):
    """Members who joined with a code have no password yet (empty hash): they can't use the password log-in."""
    return bool(stored_hash) and check_password_hash(stored_hash, password)


@app.post('/api/join')
def join_with_code():
    """Join an organisation with just its invite code and your name: no username or password.
    Coming back later? The same code and name signs you back in."""
    data = request.get_json(silent=True) or {}
    code = str(data.get('invite_code', '')).strip().upper().replace(' ', '')
    name = ' '.join(str(data.get('name', '')).split())[:40]
    if not code:
        return jsonify({'error': 'Enter the invite code your admin shared.'}), 400
    if len(name) < 2:
        return jsonify({'error': 'Enter your name so your team knows who added what.'}), 400
    with db() as conn:
        org = conn.execute('SELECT * FROM organisations WHERE invite_code = ?', (code,)).fetchone()
        if org is None:
            return jsonify({'error': 'That invite code doesn\'t match any organisation. Check it with your admin.'}), 404
        same_name = conn.execute('SELECT * FROM users WHERE org_id = ? AND lower(display_name) = lower(?)',
                                 (org['id'], name)).fetchone()
        if same_name is not None:
            if same_name['role'] == 'removed':
                return jsonify({'error': 'You were removed from this organisation. Ask the admin to invite you again.'}), 403
            if same_name['password_hash']:
                return jsonify({'error': f'Someone in {org["name"]} called {name} already has a password. '
                                         'If that\'s you, log in with your username and password.'}), 409
            start_session(same_name['id'], same_name['username'], remember=True)   # welcome back
            return jsonify({'username': same_name['username'], 'org': org['name'], 'returning': True})
        # a tidy, unique username made from the name (shown as @handle)
        base = re.sub(r'[^a-z0-9]+', '.', name.lower()).strip('.')[:20] or 'member'
        username = base
        while conn.execute('SELECT 1 FROM users WHERE username = ?', (username,)).fetchone():
            username = f'{base}.{secrets.randbelow(9000) + 1000}'
        user_id = conn.execute(
            "INSERT INTO users (username, password_hash, display_name, created_at, account_type, org_id, role) "
            "VALUES (?, '', ?, date('now'), 'organisation', ?, 'member')",
            (username, name, org['id'])).lastrowid
    start_session(user_id, username, remember=True)
    return jsonify({'username': username, 'org': org['name'], 'returning': False}), 201


@app.post('/api/signup')
def signup():
    """Three ways to sign up: an individual account, a new organisation (you become its admin),
    or joining an existing organisation with its invite code."""
    username, password = read_credentials()
    data = request.get_json(silent=True) or {}
    account_type = data.get('account_type', 'individual')
    org_action = data.get('org_action')            # 'create' or 'join' (organisations only)
    if len(username) < 3 or len(password) < 8:
        return jsonify({'error': 'Username needs at least 3 characters and password at least 8.'}), 400
    if not re.fullmatch(r'[a-z0-9._-]+', username):
        return jsonify({'error': 'Usernames can use letters, numbers, dots, dashes and underscores.'}), 400
    org_name = ' '.join(str(data.get('org_name', '')).split())[:60]
    code = str(data.get('invite_code', '')).strip().upper().replace(' ', '')
    if account_type == 'organisation' and org_action == 'create' and len(org_name) < 2:
        return jsonify({'error': 'Enter your organisation\'s name.'}), 400
    if account_type == 'organisation' and org_action not in ('create', 'join'):
        return jsonify({'error': 'Choose to create an organisation or join one.'}), 400
    try:
        with db() as conn:   # everything below happens together, or not at all
            org = None
            if account_type == 'organisation' and org_action == 'join':
                org = conn.execute('SELECT * FROM organisations WHERE invite_code = ?', (code,)).fetchone()
                if org is None:
                    return jsonify({'error': 'That invite code doesn\'t match any organisation. Check it with your admin.'}), 404
            cur = conn.execute(
                "INSERT INTO users (username, password_hash, created_at, account_type) VALUES (?, ?, date('now'), ?)",
                (username, generate_password_hash(password),   # never store the real password
                 'organisation' if account_type == 'organisation' else 'individual'))
            user_id = cur.lastrowid
            if account_type == 'organisation' and org_action == 'create':
                org_id = conn.execute("INSERT INTO organisations (name, invite_code, owner_id, created_at) "
                                      "VALUES (?, ?, ?, date('now'))", (org_name, new_invite_code(conn), user_id)).lastrowid
                conn.execute("UPDATE users SET org_id = ?, role = 'admin' WHERE id = ?", (org_id, user_id))
            elif org is not None:
                conn.execute("UPDATE users SET org_id = ?, role = 'member' WHERE id = ?", (org['id'], user_id))
    except sqlite3.IntegrityError:
        return jsonify({'error': 'That username is already taken.'}), 409
    start_session(user_id, username)
    return jsonify({'username': username}), 201


@app.post('/api/login')
def login():
    username, password = read_credentials()
    with db() as conn:
        user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    if user is None or not password_ok(user['password_hash'], password):
        return jsonify({'error': 'Wrong username or password.'}), 401
    if user['role'] == 'removed':
        return jsonify({'error': 'You were removed from this organisation. Ask the admin to invite you again.'}), 403
    start_session(user['id'], user['username'])
    return jsonify({'username': user['username']})


@app.post('/api/logout')
def logout():
    session.clear()
    return '', 204


@app.get('/api/me')
@login_required
def me():
    with db() as conn:
        user = conn.execute('SELECT * FROM users WHERE id = ?', (session['user_id'],)).fetchone()
    if user is None:          # account no longer exists
        session.clear()
        return jsonify({'error': 'Please log in'}), 401
    return jsonify(profile_json(user))


# ---------- Profile ----------

def profile_json(user):
    avatar = user['avatar']
    org = None
    if user['org_id']:
        with db() as conn:
            row = conn.execute('SELECT id, name, invite_code FROM organisations WHERE id = ?', (user['org_id'],)).fetchone()
        if row:
            org = {'id': row['id'], 'name': row['name'],
                   # only the admin sees (and shares) the invite code
                   'invite_code': row['invite_code'] if user['role'] == 'admin' else None}
    return {
        'id': user['id'],
        'account_type': user['account_type'] or 'individual',
        'role': user['role'],
        'org': org,
        'username': user['username'],
        'display_name': user['display_name'] or '',
        'bio': user['bio'] or '',
        'email': user['email'] or '',
        'created_at': user['created_at'],
        'has_password': bool(user['password_hash']),   # members who joined with a code may not have one
        # changes whenever the photo changes, so the browser fetches the new one instead of a cached copy
        'avatar_version': hashlib.sha1(avatar).hexdigest()[:10] if avatar else None,
    }


@app.put('/api/profile')
@login_required
def update_profile():
    data = request.get_json(silent=True) or {}
    display_name = str(data.get('display_name', '')).strip()[:40]
    bio = str(data.get('bio', '')).strip()[:160]
    email = str(data.get('email', '')).strip()[:120]
    if email and not re.fullmatch(r'[^@\s]+@[^@\s]+\.[^@\s]+', email):
        return jsonify({'error': 'That email address doesn\'t look right.'}), 400
    with db() as conn:
        conn.execute('UPDATE users SET display_name = ?, bio = ?, email = ? WHERE id = ?',
                     (display_name, bio, email, session['user_id']))
        user = conn.execute('SELECT * FROM users WHERE id = ?', (session['user_id'],)).fetchone()
    return jsonify(profile_json(user))


def image_type(data):
    """Check the file's first bytes, so only real images are accepted (not just files named .jpg)."""
    if data.startswith(b'\xff\xd8\xff'):
        return 'image/jpeg'
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'image/png'
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        return 'image/webp'
    return None


@app.post('/api/profile/photo')
@login_required
def upload_photo():
    file = request.files.get('photo')
    data = file.read() if file else b''
    kind = image_type(data)
    if not kind:
        return jsonify({'error': 'Please choose a JPG, PNG or WebP image.'}), 400
    with db() as conn:
        conn.execute('UPDATE users SET avatar = ?, avatar_type = ? WHERE id = ?', (data, kind, session['user_id']))
        user = conn.execute('SELECT * FROM users WHERE id = ?', (session['user_id'],)).fetchone()
    return jsonify(profile_json(user))


@app.delete('/api/profile/photo')
@login_required
def remove_photo():
    with db() as conn:
        conn.execute('UPDATE users SET avatar = NULL, avatar_type = NULL WHERE id = ?', (session['user_id'],))
        user = conn.execute('SELECT * FROM users WHERE id = ?', (session['user_id'],)).fetchone()
    return jsonify(profile_json(user))


@app.get('/api/profile/photo')
@login_required
def get_photo():
    with db() as conn:
        user = conn.execute('SELECT avatar, avatar_type FROM users WHERE id = ?', (session['user_id'],)).fetchone()
    if not user or not user['avatar']:
        abort(404)
    response = Response(user['avatar'], mimetype=user['avatar_type'])
    response.headers['Cache-Control'] = 'private, max-age=31536000'  # safe: the URL changes when the photo does
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response


@app.post('/api/profile/password')
@login_required
def change_password():
    data = request.get_json(silent=True) or {}
    current = str(data.get('current', ''))
    new = str(data.get('new', ''))
    with db() as conn:
        user = conn.execute('SELECT password_hash FROM users WHERE id = ?', (session['user_id'],)).fetchone()
        if user['password_hash'] and not check_password_hash(user['password_hash'], current):
            return jsonify({'error': 'Your current password is wrong.'}), 400
        if len(new) < 8:
            return jsonify({'error': 'Your new password needs at least 8 characters.'}), 400
        conn.execute('UPDATE users SET password_hash = ? WHERE id = ?', (generate_password_hash(new), session['user_id']))
    return jsonify({'ok': True})


def delete_scope_data(conn, owner_id):
    """Delete every row of money data stored under owner_id, in every table that has a user_id column
    (transactions, goals, budgets, categories, events, and any older tables such as assets)."""
    tables = [row['name'] for row in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")]
    columns = {t: [c['name'] for c in conn.execute(f'PRAGMA table_info("{t}")')] for t in tables}
    if 'asset_values' in columns and 'asset_id' in columns['asset_values'] and 'assets' in columns:
        conn.execute('DELETE FROM asset_values WHERE asset_id IN (SELECT id FROM assets WHERE user_id = ?)', (owner_id,))
    for table in tables:
        if table != 'users' and 'user_id' in columns[table]:
            conn.execute(f'DELETE FROM "{table}" WHERE user_id = ?', (owner_id,))


@app.post('/api/account/delete')
@login_required
def delete_account():
    """Delete your account for good. You must type DELETE (and your password, if you have one).
    - Individual: your account and all your money data are deleted.
    - Organisation member: your account is deleted; what you added stays with the organisation.
    - Organisation admin: the whole organisation is deleted: its data and every member's account."""
    data = request.get_json(silent=True) or {}
    if str(data.get('confirm', '')).strip() != 'DELETE':
        return jsonify({'error': 'Type DELETE (in capitals) to confirm.'}), 400
    with db() as conn:
        user = conn.execute('SELECT * FROM users WHERE id = ?', (g.user['id'],)).fetchone()
        if user['password_hash'] and not check_password_hash(user['password_hash'], str(data.get('password', ''))):
            return jsonify({'error': 'Your password is wrong.'}), 400
        if in_org() and g.user['role'] == 'admin':
            org_id = g.user['org_id']
            delete_scope_data(conn, scope_id())
            conn.execute('DELETE FROM users WHERE org_id = ? AND id != ?', (org_id, user['id']))
            conn.execute('DELETE FROM organisations WHERE id = ?', (org_id,))
        elif not in_org():
            delete_scope_data(conn, user['id'])
        # members: only their own account goes; transactions they added show as "a former member"
        conn.execute('DELETE FROM users WHERE id = ?', (user['id'],))
    session.clear()
    return jsonify({'ok': True})


@app.errorhandler(413)
def too_large(error):
    return jsonify({'error': 'That file is too big. Please choose one under 2 MB.'}), 413


# ---------- Organisation (members, invite code) ----------

@app.get('/api/org')
@login_required
def org_info():
    """Your organisation and its members (with what each one has added and paid)."""
    if not in_org():
        return jsonify({'error': 'This is an individual account.'}), 404
    with db() as conn:
        org = conn.execute('SELECT id, name, invite_code, created_at FROM organisations WHERE id = ?',
                           (g.user['org_id'],)).fetchone()
        members = conn.execute(
            "SELECT u.id, u.username, u.display_name, u.role, u.created_at, "
            "  (SELECT COUNT(*) FROM transactions t WHERE t.added_by = u.id AND t.user_id = ?) AS added, "
            "  (SELECT COALESCE(SUM(amount), 0) FROM transactions t WHERE t.paid_by = u.id AND t.user_id = ? "
            "     AND t.settled_at IS NULL) AS owed "
            "FROM users u WHERE u.org_id = ? ORDER BY u.role = 'removed', u.role != 'admin', u.created_at, u.id",
            (scope_id(), scope_id(), g.user['org_id'])).fetchall()
    return jsonify({'id': org['id'], 'name': org['name'], 'created_at': org['created_at'],
                    'invite_code': org['invite_code'] if g.user['role'] == 'admin' else None,
                    'members': [dict(m) for m in members]})


@app.put('/api/org')
@admin_required
def rename_org():
    name = ' '.join(str((request.get_json(silent=True) or {}).get('name', '')).split())[:60]
    if len(name) < 2:
        return jsonify({'error': 'Enter a name.'}), 400
    with db() as conn:
        conn.execute('UPDATE organisations SET name = ? WHERE id = ?', (name, g.user['org_id']))
    return jsonify({'name': name})


@app.post('/api/org/invite-code')
@admin_required
def reset_invite_code():
    """Make a new invite code (the old one stops working)."""
    with db() as conn:
        code = new_invite_code(conn)
        conn.execute('UPDATE organisations SET invite_code = ? WHERE id = ?', (code, g.user['org_id']))
    return jsonify({'invite_code': code})


@app.delete('/api/org/members/<int:member_id>')
@admin_required
def remove_member(member_id):
    """The member can't log in any more. What they added stays, with their name on it."""
    if member_id == g.user['id']:
        return jsonify({'error': 'You can\'t remove yourself.'}), 400
    with db() as conn:
        cur = conn.execute("UPDATE users SET role = 'removed' WHERE id = ? AND org_id = ? AND role = 'member'",
                           (member_id, g.user['org_id']))
    if cur.rowcount == 0:
        return jsonify({'error': 'Member not found.'}), 404
    return '', 204


# ---------- Transactions (each account only sees its own; organisation members share one) ----------

@app.get('/api/transactions')
@login_required
def list_transactions():
    with db() as conn:
        rows = conn.execute(
            f'SELECT {TX_COLUMNS} FROM transactions WHERE user_id = ? ORDER BY date DESC',
            (scope_id(),)).fetchall()
    return jsonify([dict(r) for r in rows])


TX_COLUMNS = ('id, name, category, date, amount, type, stock_name, quantity, goal_id, '
              'event_id, added_by, paid_by, settled_at')
# Where an organisation's money can come from (individuals just have "Income").
INCOME_SOURCES = ['Income', 'Sponsorship', 'Member contribution', 'Ticket sales', 'Donation', 'Grant', 'Other income']


def read_transaction(data):
    """Check a transaction sent by the browser. Returns (fields, None) or (None, error message)."""
    name = str(data.get('name', '')).strip()[:60]
    try:
        amount = round(float(data.get('amount', 0)), 2)
    except (TypeError, ValueError):
        amount = 0
    category = str(data.get('category', 'Other'))
    date = str(data.get('date', ''))
    tx_type = data.get('type')
    if not name or amount <= 0 or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', date) \
            or tx_type not in ('income', 'expense', 'savings'):
        return None, 'Enter a name, a positive amount, and a date.'
    if tx_type == 'income':
        # organisations say where money came from (sponsorship, contributions…); individuals don't need to
        category = category if in_org() and category in INCOME_SOURCES else 'Income'
    if tx_type == 'expense' and category not in expense_categories():
        return None, 'Pick a category from the list.'
    if tx_type == 'savings' and category == 'Stocks' and in_org():
        return None, 'Stocks aren\'t used in organisation accounts. Pick Savings or Emergency fund.'
    stock_name, quantity = None, None
    if tx_type == 'savings' and category == 'Stocks':
        stock_name = str(data.get('stock_name', '')).strip()[:40]
        try:
            quantity = float(data.get('quantity', 0))
        except (TypeError, ValueError):
            quantity = 0
        if not stock_name or quantity <= 0:
            return None, 'Enter the stock name and number of shares'
    # Which event this belongs to (optional) — it must be one of yours
    event_id = data.get('event_id') or None
    with db() as conn:
        if event_id is not None:
            try:
                event_id = int(event_id)
            except (TypeError, ValueError):
                event_id = -1
            if not conn.execute('SELECT 1 FROM events WHERE id = ? AND user_id = ?', (event_id, scope_id())).fetchone():
                return None, 'That event doesn\'t exist.'
        # Who paid (organisations only): empty = paid from the organisation's money,
        # a member's id = they paid from their own pocket and should be paid back.
        paid_by = data.get('paid_by') or None
        if paid_by is not None:
            if not in_org() or tx_type != 'expense':
                paid_by = None
            else:
                try:
                    paid_by = int(paid_by)
                except (TypeError, ValueError):
                    paid_by = -1
                if not conn.execute("SELECT 1 FROM users WHERE id = ? AND org_id = ? AND role != 'removed'",
                                    (paid_by, g.user['org_id'])).fetchone():
                    return None, 'Pick who paid from the list.'
    return {'name': name, 'category': category, 'date': date, 'amount': amount, 'type': tx_type,
            'stock_name': stock_name, 'quantity': quantity, 'event_id': event_id, 'paid_by': paid_by}, None


def transaction_json(conn, tx_id):
    return dict(conn.execute(f'SELECT {TX_COLUMNS} FROM transactions WHERE id = ?', (tx_id,)).fetchone())


@app.post('/api/transactions')
@login_required
def add_transaction():
    fields, error = read_transaction(request.get_json(silent=True) or {})
    if error:
        return jsonify({'error': error}), 400
    with db() as conn:
        cur = conn.execute(
            'INSERT INTO transactions (name, category, date, amount, type, user_id, stock_name, quantity, '
            'event_id, added_by, paid_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            (fields['name'], fields['category'], fields['date'], fields['amount'], fields['type'],
             scope_id(), fields['stock_name'], fields['quantity'], fields['event_id'],
             session['user_id'], fields['paid_by']))
        return jsonify(transaction_json(conn, cur.lastrowid)), 201


@app.put('/api/transactions/<int:tx_id>')
@login_required
def edit_transaction(tx_id):
    """Fix a mistake: change the name, amount, date, type, category, event or who paid."""
    data = request.get_json(silent=True) or {}
    with db() as conn:
        # "AND user_id = ?" stops one account editing another account's transactions
        old = conn.execute('SELECT * FROM transactions WHERE id = ? AND user_id = ?',
                           (tx_id, scope_id())).fetchone()
        if old is None:
            return jsonify({'error': 'Transaction not found.'}), 404
        if old['goal_id'] is not None:
            # Money put towards a wishlist goal stays a Savings → Goals transaction.
            data = {**data, 'type': 'savings', 'category': 'Goals'}
        fields, error = read_transaction(data)
        if error:
            return jsonify({'error': error}), 400
        # if someone else is now marked as having paid, the "paid back" date no longer applies
        settled_at = old['settled_at'] if fields['paid_by'] == old['paid_by'] else None
        conn.execute('UPDATE transactions SET name = ?, category = ?, date = ?, amount = ?, type = ?, '
                     'stock_name = ?, quantity = ?, event_id = ?, paid_by = ?, settled_at = ? '
                     'WHERE id = ? AND user_id = ?',
                     (fields['name'], fields['category'], fields['date'], fields['amount'], fields['type'],
                      fields['stock_name'], fields['quantity'], fields['event_id'], fields['paid_by'], settled_at,
                      tx_id, scope_id()))
        return jsonify(transaction_json(conn, tx_id))


@app.delete('/api/transactions/<int:tx_id>')
@login_required
def delete_transaction(tx_id):
    with db() as conn:
        # "AND user_id = ?" stops one account deleting another account's transactions
        conn.execute('DELETE FROM transactions WHERE id = ? AND user_id = ?', (tx_id, scope_id()))
    return '', 204


@app.post('/api/transactions/<int:tx_id>/settle')
@login_required
def settle_transaction(tx_id):
    """Mark a member as paid back for an expense they covered (or undo that)."""
    settled = bool((request.get_json(silent=True) or {}).get('settled', True))
    with db() as conn:
        cur = conn.execute("UPDATE transactions SET settled_at = CASE WHEN ? THEN date('now', 'localtime') END "
                           'WHERE id = ? AND user_id = ? AND paid_by IS NOT NULL', (settled, tx_id, scope_id()))
        if cur.rowcount == 0:
            return jsonify({'error': 'Nothing to pay back for that transaction.'}), 404
        return jsonify(transaction_json(conn, tx_id))


# ---------- Events ----------
# An event (a fest, a trip, a meeting…) has an allowance. Expenses and money collected
# can be linked to it, so you can see spent vs allowance and what's left.

def read_event(data):
    name = ' '.join(str(data.get('name', '')).split())[:60]
    date = str(data.get('date', ''))
    try:
        allowance = round(float(data.get('allowance', 0) or 0), 2)
    except (TypeError, ValueError):
        allowance = -1
    if len(name) < 2:
        return None, 'Give the event a name.'
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', date):
        return None, 'Pick the event date.'
    if allowance < 0 or allowance > 1e11:
        return None, 'The allowance should be ₹0 or more.'
    parent_id = data.get('parent_id') or None
    if parent_id is not None:
        try:
            parent_id = int(parent_id)
        except (TypeError, ValueError):
            return None, 'Pick the main event from the list.'
        with db() as conn:
            parent = conn.execute('SELECT id, parent_id FROM events WHERE id = ? AND user_id = ?', (parent_id, scope_id())).fetchone()
        if parent is None:
            return None, 'Pick the main event from the list.'
        if parent['parent_id'] is not None:
            return None, 'A sub-event can\'t have its own sub-events. Pick a main event.'
    return {'name': name, 'date': date, 'allowance': allowance, 'parent_id': parent_id}, None


@app.get('/api/events')
@login_required
def list_events():
    with db() as conn:
        rows = conn.execute('SELECT id, name, date, allowance, closed, created_by, parent_id FROM events '
                            'WHERE user_id = ? ORDER BY closed, date DESC, id DESC', (scope_id(),)).fetchall()
    return jsonify([dict(r) for r in rows])


@app.post('/api/events')
@login_required
def add_event():
    if not in_org():
        return jsonify({'error': 'Events are for organisation accounts.'}), 403
    fields, error = read_event(request.get_json(silent=True) or {})
    if error:
        return jsonify({'error': error}), 400
    with db() as conn:
        cur = conn.execute('INSERT INTO events (user_id, name, date, allowance, created_by, parent_id) VALUES (?, ?, ?, ?, ?, ?)',
                           (scope_id(), fields['name'], fields['date'], fields['allowance'], session['user_id'], fields['parent_id']))
        row = conn.execute('SELECT id, name, date, allowance, closed, created_by, parent_id FROM events WHERE id = ?',
                           (cur.lastrowid,)).fetchone()
    return jsonify(dict(row)), 201


@app.put('/api/events/<int:event_id>')
@login_required
def edit_event(event_id):
    data = request.get_json(silent=True) or {}
    with db() as conn:
        old = conn.execute('SELECT * FROM events WHERE id = ? AND user_id = ?', (event_id, scope_id())).fetchone()
        if old is None:
            return jsonify({'error': 'Event not found.'}), 404
        fields, error = read_event({'name': old['name'], 'date': old['date'], 'allowance': old['allowance'],
                                    'parent_id': old['parent_id'], **data})
        if error:
            return jsonify({'error': error}), 400
        if fields['parent_id'] == event_id:
            return jsonify({'error': 'An event can\'t be part of itself.'}), 400
        if fields['parent_id'] is not None and conn.execute('SELECT 1 FROM events WHERE parent_id = ?', (event_id,)).fetchone():
            return jsonify({'error': 'This event has its own sub-events, so it can\'t become a sub-event.'}), 400
        closed = int(bool(data.get('closed', old['closed'])))
        conn.execute('UPDATE events SET name = ?, date = ?, allowance = ?, closed = ?, parent_id = ? WHERE id = ?',
                     (fields['name'], fields['date'], fields['allowance'], closed, fields['parent_id'], event_id))
        if closed != old['closed']:
            # closing (or reopening) a main event closes (or reopens) its sub-events too
            conn.execute('UPDATE events SET closed = ? WHERE parent_id = ? AND user_id = ?', (closed, event_id, scope_id()))
        row = conn.execute('SELECT id, name, date, allowance, closed, created_by, parent_id FROM events WHERE id = ?',
                           (event_id,)).fetchone()
    return jsonify(dict(row))


@app.delete('/api/events/<int:event_id>')
@login_required
def delete_event(event_id):
    """Delete an event. Its transactions stay; they just aren't linked to an event any more.
    Its sub-events (if any) become standalone events."""
    with db() as conn:
        if conn.execute('DELETE FROM events WHERE id = ? AND user_id = ?', (event_id, scope_id())).rowcount == 0:
            return jsonify({'error': 'Event not found.'}), 404
        conn.execute('UPDATE events SET parent_id = NULL WHERE parent_id = ? AND user_id = ?', (event_id, scope_id()))
        conn.execute('UPDATE transactions SET event_id = NULL WHERE event_id = ? AND user_id = ?', (event_id, scope_id()))
    return '', 204


# ---------- Wishlist goals ----------
# A goal is something you want to buy. Money put towards it is saved as a
# Savings → Goals transaction linked by goal_id, so progress = sum of those transactions.

GOAL_EMOJIS = {'🎁', '🎧', '💻', '📱', '✈️', '🎮', '👟', '🎸', '📷', '🚲', '⌚', '📚'}


@app.get('/api/goals')
@login_required
def list_goals():
    with db() as conn:
        rows = conn.execute('SELECT id, name, target, emoji FROM goals WHERE user_id = ? ORDER BY id',
                            (scope_id(),)).fetchall()
    return jsonify([dict(r) for r in rows])


@app.post('/api/goals')
@login_required
def add_goal():
    if in_org():
        return jsonify({'error': 'The wishlist is for individual accounts.'}), 403
    data = request.get_json(silent=True) or {}
    name = str(data.get('name', '')).strip()[:40]
    try:
        target = float(data.get('target', 0))
    except (TypeError, ValueError):
        target = 0
    emoji = data.get('emoji') if data.get('emoji') in GOAL_EMOJIS else '🎁'
    if not name or target <= 0:
        return jsonify({'error': 'Enter what you want to buy and how much it costs.'}), 400
    with db() as conn:
        cur = conn.execute('INSERT INTO goals (user_id, name, target, emoji) VALUES (?, ?, ?, ?)',
                           (scope_id(), name, target, emoji))
    return jsonify({'id': cur.lastrowid, 'name': name, 'target': target, 'emoji': emoji}), 201


@app.post('/api/goals/<int:goal_id>/deposit')
@login_required
def deposit_to_goal(goal_id):
    if in_org():
        return jsonify({'error': 'The wishlist is for individual accounts.'}), 403
    data = request.get_json(silent=True) or {}
    try:
        amount = float(data.get('amount', 0))
    except (TypeError, ValueError):
        amount = 0
    date = str(data.get('date', ''))
    if amount <= 0 or not date:
        return jsonify({'error': 'Enter a positive amount.'}), 400
    with db() as conn:
        goal = conn.execute('SELECT * FROM goals WHERE id = ? AND user_id = ?',
                            (goal_id, scope_id())).fetchone()
        if goal is None:
            abort(404)
        name = f"Saved for {goal['name']}"
        cur = conn.execute(
            'INSERT INTO transactions (name, category, date, amount, type, user_id, goal_id, added_by) '
            "VALUES (?, 'Goals', ?, ?, 'savings', ?, ?, ?)",
            (name, date, amount, scope_id(), goal_id, session['user_id']))
        tx = transaction_json(conn, cur.lastrowid)
    return jsonify(tx), 201


@app.delete('/api/goals/<int:goal_id>')
@login_required
def delete_goal(goal_id):
    with db() as conn:
        # The money stays saved; it just isn't linked to a goal any more.
        conn.execute('UPDATE transactions SET goal_id = NULL WHERE goal_id = ? AND user_id = ?',
                     (goal_id, scope_id()))
        conn.execute('DELETE FROM goals WHERE id = ? AND user_id = ?', (goal_id, scope_id()))
    return '', 204


# ---------- Categories ----------
# Expense categories = the built-in ones + any the user created themselves.

BUILT_IN_EXPENSE = ['Food', 'Shopping', 'Transport', 'Education', 'Bills', 'Health', 'Other']
RESERVED_NAMES = set(BUILT_IN_EXPENSE) | {'Income', 'Savings', 'Stocks', 'Emergency fund', 'Goals', 'Salary', 'Freelance'}
CATEGORY_COLOURS = {'#B8674A', '#8A6BA3', '#4F7E9C', '#3E8C70', '#D6B77A', '#B5617A',
                    '#174C3C', '#6FA08A', '#A8C3A0', '#C2A36A', '#7A8B5C', '#5E6F8C'}


def expense_categories():
    """Every expense category the logged-in user may use."""
    with db() as conn:
        custom = [row['name'] for row in conn.execute('SELECT name FROM categories WHERE user_id = ?',
                                                      (scope_id(),))]
    return set(BUILT_IN_EXPENSE) | set(custom)


@app.get('/api/categories')
@login_required
def list_categories():
    with db() as conn:
        rows = conn.execute('SELECT id, name, icon, color FROM categories WHERE user_id = ? ORDER BY name',
                            (scope_id(),)).fetchall()
    return jsonify([dict(r) for r in rows])


@app.post('/api/categories')
@login_required
def add_category():
    data = request.get_json(silent=True) or {}
    name = ' '.join(str(data.get('name', '')).split())[:24]   # tidy spaces, max 24 characters
    icon = str(data.get('icon', '')).strip()[:4] or '🏷️'
    color = data.get('color') if data.get('color') in CATEGORY_COLOURS else '#6FA08A'
    if len(name) < 2:
        return jsonify({'error': 'Give the category a name (at least 2 letters).'}), 400
    if name.lower() in {n.lower() for n in RESERVED_NAMES}:
        return jsonify({'error': f'"{name}" already exists.'}), 409
    with db() as conn:
        if conn.execute('SELECT 1 FROM categories WHERE user_id = ? AND name = ?',
                        (scope_id(), name)).fetchone():
            return jsonify({'error': f'You already have a "{name}" category.'}), 409
        count = conn.execute('SELECT COUNT(*) FROM categories WHERE user_id = ?', (scope_id(),)).fetchone()[0]
        if count >= 30:
            return jsonify({'error': 'That\'s plenty of categories! Delete one to add another.'}), 400
        cur = conn.execute('INSERT INTO categories (user_id, name, icon, color) VALUES (?, ?, ?, ?)',
                           (scope_id(), name, icon, color))
    return jsonify({'id': cur.lastrowid, 'name': name, 'icon': icon, 'color': color}), 201


@app.delete('/api/categories/<int:category_id>')
@login_required
def delete_category(category_id):
    """Delete a custom category. Its transactions move to "Other" and its budget is removed."""
    with db() as conn:
        row = conn.execute('SELECT name FROM categories WHERE id = ? AND user_id = ?',
                           (category_id, scope_id())).fetchone()
        if row is None:
            return jsonify({'error': 'Category not found.'}), 404
        moved = conn.execute("UPDATE transactions SET category = 'Other' WHERE user_id = ? AND type = 'expense' "
                             'AND category = ?', (scope_id(), row['name'])).rowcount
        conn.execute('DELETE FROM budgets WHERE user_id = ? AND category = ?', (scope_id(), row['name']))
        conn.execute('DELETE FROM categories WHERE id = ?', (category_id,))
    return jsonify({'moved': moved})


# ---------- Budgets ----------
# A budget is a monthly spending limit for one expense category, e.g. Food: ₹8,000.
# How much you've spent is worked out in the browser from your expense transactions.



# ---------- Reminders (bills, payments, anything with a due date) ----------
REMINDER_REPEATS = ('none', 'weekly', 'monthly', 'yearly')


def parse_day(value):
    try:
        return date.fromisoformat(str(value)[:10])
    except (TypeError, ValueError):
        return None


def client_today():
    """The visitor's own date (sent by the browser) if it's within a day of the server's; else the server's.
    Keeps "today" right for people in India when the server runs on UTC."""
    sent = parse_day(request.args.get('today') or (request.get_json(silent=True) or {}).get('today'))
    server = date.today()
    return sent if sent and abs((sent - server).days) <= 1 else server


def add_months(day, months, anchor_day):
    index = day.year * 12 + day.month - 1 + months
    year, month = divmod(index, 12)
    month += 1
    return date(year, month, min(anchor_day or day.day, calendar.monthrange(year, month)[1]))


def next_due(due, repeat, anchor_day):
    if repeat == 'weekly':
        return due + timedelta(days=7)
    if repeat == 'monthly':
        return add_months(due, 1, anchor_day)
    if repeat == 'yearly':
        return add_months(due, 12, anchor_day)
    return due


def reminder_fields(data):
    """Check what was sent for a reminder. Returns (fields, error)."""
    title = ' '.join(str(data.get('title', '')).split())[:80]
    if not title:
        return None, 'What should Fin remind you about?'
    due = parse_day(data.get('due_date'))
    if due is None:
        return None, 'Pick the date it\'s due.'
    if not (2000 <= due.year <= 2100):
        return None, 'That date looks off.'
    amount = data.get('amount')
    if amount in (None, ''):
        amount = None
    else:
        try:
            amount = round(float(amount), 2)
        except (TypeError, ValueError):
            return None, 'The amount should be a number.'
        if not (0 < amount <= 1_000_000_000):
            return None, 'The amount should be more than ₹0.'
    repeat = str(data.get('repeat') or 'none').lower()
    if repeat not in REMINDER_REPEATS:
        return None, 'Repeat should be once, weekly, monthly or yearly.'
    return {'title': title, 'amount': amount, 'due_date': due.isoformat(), 'repeat': repeat,
            'anchor_day': due.day}, None


def reminder_json(row):
    return {key: row[key] for key in ('id', 'title', 'amount', 'due_date', 'repeat', 'snooze_until')}


def get_reminder(conn, reminder_id):
    return conn.execute('SELECT * FROM reminders WHERE id = ? AND user_id = ? AND done_at IS NULL',
                        (reminder_id, scope_id())).fetchone()


@app.get('/api/reminders')
@login_required
def list_reminders():
    with db() as conn:
        rows = conn.execute('SELECT * FROM reminders WHERE user_id = ? AND done_at IS NULL ORDER BY due_date, id',
                            (scope_id(),)).fetchall()
    return jsonify([reminder_json(r) for r in rows])


@app.post('/api/reminders')
@login_required
def add_reminder():
    fields, error = reminder_fields(request.get_json(silent=True) or {})
    if error:
        return jsonify({'error': error}), 400
    with db() as conn:
        if conn.execute('SELECT COUNT(*) FROM reminders WHERE user_id = ? AND done_at IS NULL', (scope_id(),)).fetchone()[0] >= 200:
            return jsonify({'error': 'That\'s a lot of reminders! Tick some off first.'}), 400
        new_id = conn.execute(
            'INSERT INTO reminders (user_id, title, amount, due_date, repeat, anchor_day, created_by, created_at) '
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            (scope_id(), fields['title'], fields['amount'], fields['due_date'], fields['repeat'], fields['anchor_day'],
             g.user['id'], date.today().isoformat())).lastrowid
        row = conn.execute('SELECT * FROM reminders WHERE id = ?', (new_id,)).fetchone()
    return jsonify(reminder_json(row)), 201


@app.put('/api/reminders/<int:reminder_id>')
@login_required
def edit_reminder(reminder_id):
    fields, error = reminder_fields(request.get_json(silent=True) or {})
    if error:
        return jsonify({'error': error}), 400
    with db() as conn:
        if get_reminder(conn, reminder_id) is None:
            return jsonify({'error': 'Reminder not found.'}), 404
        conn.execute('UPDATE reminders SET title = ?, amount = ?, due_date = ?, repeat = ?, anchor_day = ?, snooze_until = NULL '
                     'WHERE id = ?', (fields['title'], fields['amount'], fields['due_date'], fields['repeat'],
                                      fields['anchor_day'], reminder_id))
        row = conn.execute('SELECT * FROM reminders WHERE id = ?', (reminder_id,)).fetchone()
    return jsonify(reminder_json(row))


@app.post('/api/reminders/<int:reminder_id>/done')
@login_required
def finish_reminder(reminder_id):
    """Paid / done. A repeating reminder moves on to its next date; a one-off one is ticked off."""
    with db() as conn:
        row = get_reminder(conn, reminder_id)
        if row is None:
            return jsonify({'error': 'Reminder not found.'}), 404
        if row['repeat'] == 'none':
            conn.execute('UPDATE reminders SET done_at = ? WHERE id = ?', (client_today().isoformat(), reminder_id))
            return jsonify({'done': True})
        due = next_due(date.fromisoformat(row['due_date']), row['repeat'], row['anchor_day'])
        conn.execute('UPDATE reminders SET due_date = ?, snooze_until = NULL WHERE id = ?', (due.isoformat(), reminder_id))
        row = conn.execute('SELECT * FROM reminders WHERE id = ?', (reminder_id,)).fetchone()
    return jsonify({'done': False, 'reminder': reminder_json(row)})


@app.post('/api/reminders/<int:reminder_id>/snooze')
@login_required
def snooze_reminder(reminder_id):
    """Fin stays quiet about it until tomorrow."""
    with db() as conn:
        if get_reminder(conn, reminder_id) is None:
            return jsonify({'error': 'Reminder not found.'}), 404
        until = (client_today() + timedelta(days=1)).isoformat()
        conn.execute('UPDATE reminders SET snooze_until = ? WHERE id = ?', (until, reminder_id))
    return jsonify({'snooze_until': until})


@app.delete('/api/reminders/<int:reminder_id>')
@login_required
def delete_reminder(reminder_id):
    with db() as conn:
        conn.execute('DELETE FROM reminders WHERE id = ? AND user_id = ?', (reminder_id, scope_id()))
    return jsonify({'ok': True})


@app.get('/api/budgets')
@login_required
def list_budgets():
    with db() as conn:
        rows = conn.execute('SELECT id, category, monthly_limit FROM budgets WHERE user_id = ? ORDER BY category',
                            (scope_id(),)).fetchall()
    return jsonify([dict(r) for r in rows])


@app.post('/api/budgets')
@login_required
def save_budget():
    """Create a budget, or change the limit if that category already has one."""
    data = request.get_json(silent=True) or {}
    category = str(data.get('category', ''))
    try:
        monthly_limit = round(float(data.get('monthly_limit', 0)), 2)
    except (TypeError, ValueError):
        monthly_limit = 0
    if category not in expense_categories():
        return jsonify({'error': 'Pick a spending category.'}), 400
    if monthly_limit <= 0 or monthly_limit > 100_000_000:
        return jsonify({'error': 'Enter a monthly limit above ₹0.'}), 400
    with db() as conn:
        conn.execute('INSERT INTO budgets (user_id, category, monthly_limit) VALUES (?, ?, ?) '
                     'ON CONFLICT (user_id, category) DO UPDATE SET monthly_limit = excluded.monthly_limit',
                     (scope_id(), category, monthly_limit))
        row = conn.execute('SELECT id, category, monthly_limit FROM budgets WHERE user_id = ? AND category = ?',
                           (scope_id(), category)).fetchone()
    return jsonify(dict(row)), 201


@app.delete('/api/budgets/<int:budget_id>')
@login_required
def delete_budget(budget_id):
    with db() as conn:
        conn.execute('DELETE FROM budgets WHERE id = ? AND user_id = ?', (budget_id, scope_id()))
    return '', 204


# ---------- Public files (CSS and JS only) ----------

@app.get('/<path:filename>')
def public_file(filename):
    if filename not in PUBLIC_FILES:
        abort(404)
    return send_from_directory(APP_DIR, filename)


# ---------- FIN, the AI assistant ----------
# /api/fin/status and /api/fin/chat (logged-in users only; read-only access to their own data)
app.register_blueprint(fin_ai.create_blueprint(db, login_required, scope_id))


if __name__ == '__main__':
    init_db()
    # For working on the app on your own Mac. To put it online, use serve.py instead (see DEPLOY.md).
    # The debugger stays off unless you ask for it (SPENDWISE_DEBUG=1), so it's never exposed by accident.
    app.run(debug=os.environ.get('SPENDWISE_DEBUG') == '1', host='127.0.0.1', port=5001)
