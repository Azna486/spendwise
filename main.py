from flask import Flask, jsonify, request, send_from_directory, session, redirect, abort, Response
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
import hashlib
import os
import re
import sqlite3

# static_folder=None: we decide exactly which files the browser may download (see bottom).
# Otherwise anyone could download main.py or spendwise.db.
app = Flask(__name__, static_folder=None)
# The secret key signs the login cookie so nobody can fake being logged in.
# For real use, set your own long random value in the SPENDWISE_SECRET_KEY environment variable.
app.secret_key = os.environ.get('SPENDWISE_SECRET_KEY', 'dev-only-change-me')
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['MAX_CONTENT_LENGTH'] = 2 * 1024 * 1024   # biggest upload allowed: 2 MB (profile photos)
DB = 'spendwise.db'
PUBLIC_FILES = {'styles.css', 'app.js'}


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
        # Profile details (added later, so older databases get the new columns here).
        columns = [row['name'] for row in conn.execute('PRAGMA table_info(users)')]
        for column, kind in (('display_name', 'TEXT'), ('bio', 'TEXT'), ('email', 'TEXT'),
                             ('avatar', 'BLOB'), ('avatar_type', 'TEXT'), ('created_at', 'TEXT')):
            if column not in columns:
                conn.execute(f'ALTER TABLE users ADD COLUMN {column} {kind}')


def login_required(view):
    """Put @login_required above any route that only logged-in users may use."""
    @wraps(view)
    def wrapper(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Please log in'}), 401
        return view(*args, **kwargs)
    return wrapper


# ---------- Pages ----------

@app.get('/')
def home():
    if 'user_id' not in session:
        return redirect('/login')
    return send_from_directory('.', 'index.html')


@app.get('/login')
def login_page():
    if 'user_id' in session:
        return redirect('/')
    return send_from_directory('.', 'login.html')


# ---------- Sign up / log in / log out ----------

def read_credentials():
    data = request.get_json(silent=True) or {}
    username = str(data.get('username', '')).strip().lower()
    password = str(data.get('password', ''))
    return username, password


def start_session(user_id, username):
    session.clear()
    session['user_id'] = user_id
    session['username'] = username


@app.post('/api/signup')
def signup():
    username, password = read_credentials()
    if len(username) < 3 or len(password) < 8:
        return jsonify({'error': 'Username needs at least 3 characters and password at least 8.'}), 400
    try:
        with db() as conn:
            cur = conn.execute(
                "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, date('now'))",
                (username, generate_password_hash(password)))   # never store the real password
    except sqlite3.IntegrityError:
        return jsonify({'error': 'That username is already taken.'}), 409
    start_session(cur.lastrowid, username)
    return jsonify({'username': username}), 201


@app.post('/api/login')
def login():
    username, password = read_credentials()
    with db() as conn:
        user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    if user is None or not check_password_hash(user['password_hash'], password):
        return jsonify({'error': 'Wrong username or password.'}), 401
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
    return {
        'username': user['username'],
        'display_name': user['display_name'] or '',
        'bio': user['bio'] or '',
        'email': user['email'] or '',
        'created_at': user['created_at'],
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
        if not check_password_hash(user['password_hash'], current):
            return jsonify({'error': 'Your current password is wrong.'}), 400
        if len(new) < 8:
            return jsonify({'error': 'Your new password needs at least 8 characters.'}), 400
        conn.execute('UPDATE users SET password_hash = ? WHERE id = ?', (generate_password_hash(new), session['user_id']))
    return jsonify({'ok': True})


@app.errorhandler(413)
def too_large(error):
    return jsonify({'error': 'That file is too big. Please choose one under 2 MB.'}), 413


# ---------- Transactions (each user only sees their own) ----------

@app.get('/api/transactions')
@login_required
def list_transactions():
    with db() as conn:
        rows = conn.execute(
            'SELECT id, name, category, date, amount, type, stock_name, quantity, goal_id FROM transactions '
            'WHERE user_id = ? ORDER BY date DESC',
            (session['user_id'],)).fetchall()
    return jsonify([dict(r) for r in rows])


@app.post('/api/transactions')
@login_required
def add_transaction():
    data = request.get_json(silent=True) or {}
    name = str(data.get('name', '')).strip()
    try:
        amount = float(data.get('amount', 0))
    except (TypeError, ValueError):
        amount = 0
    category = str(data.get('category', 'Other'))
    date = str(data.get('date', ''))
    tx_type = data.get('type')
    if not name or amount <= 0 or not date or tx_type not in ('income', 'expense', 'savings'):
        return jsonify({'error': 'Invalid transaction'}), 400
    if tx_type == 'income':
        category = 'Income'   # income has no category
    stock_name, quantity = None, None
    if tx_type == 'savings' and category == 'Stocks':
        stock_name = str(data.get('stock_name', '')).strip()[:40]
        try:
            quantity = float(data.get('quantity', 0))
        except (TypeError, ValueError):
            quantity = 0
        if not stock_name or quantity <= 0:
            return jsonify({'error': 'Enter the stock name and number of shares'}), 400
    with db() as conn:
        cur = conn.execute(
            'INSERT INTO transactions (name, category, date, amount, type, user_id, stock_name, quantity) '
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            (name, category, date, amount, tx_type, session['user_id'], stock_name, quantity))
    return jsonify({'id': cur.lastrowid, 'name': name, 'category': category, 'date': date,
                    'amount': amount, 'type': tx_type, 'stock_name': stock_name, 'quantity': quantity}), 201


@app.delete('/api/transactions/<int:tx_id>')
@login_required
def delete_transaction(tx_id):
    with db() as conn:
        # "AND user_id = ?" stops one user deleting another user's transactions
        conn.execute('DELETE FROM transactions WHERE id = ? AND user_id = ?', (tx_id, session['user_id']))
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
                            (session['user_id'],)).fetchall()
    return jsonify([dict(r) for r in rows])


@app.post('/api/goals')
@login_required
def add_goal():
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
                           (session['user_id'], name, target, emoji))
    return jsonify({'id': cur.lastrowid, 'name': name, 'target': target, 'emoji': emoji}), 201


@app.post('/api/goals/<int:goal_id>/deposit')
@login_required
def deposit_to_goal(goal_id):
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
                            (goal_id, session['user_id'])).fetchone()
        if goal is None:
            abort(404)
        name = f"Saved for {goal['name']}"
        cur = conn.execute(
            'INSERT INTO transactions (name, category, date, amount, type, user_id, goal_id) '
            "VALUES (?, 'Goals', ?, ?, 'savings', ?, ?)",
            (name, date, amount, session['user_id'], goal_id))
    return jsonify({'id': cur.lastrowid, 'name': name, 'category': 'Goals', 'date': date, 'amount': amount,
                    'type': 'savings', 'stock_name': None, 'quantity': None, 'goal_id': goal_id}), 201


@app.delete('/api/goals/<int:goal_id>')
@login_required
def delete_goal(goal_id):
    with db() as conn:
        # The money stays saved; it just isn't linked to a goal any more.
        conn.execute('UPDATE transactions SET goal_id = NULL WHERE goal_id = ? AND user_id = ?',
                     (goal_id, session['user_id']))
        conn.execute('DELETE FROM goals WHERE id = ? AND user_id = ?', (goal_id, session['user_id']))
    return '', 204


# ---------- Public files (CSS and JS only) ----------

@app.get('/<path:filename>')
def public_file(filename):
    if filename not in PUBLIC_FILES:
        abort(404)
    return send_from_directory('.', filename)


if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5001)
