from flask import Flask, jsonify, request, send_from_directory, session, redirect, abort
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
import os
import sqlite3

# static_folder=None: we decide exactly which files the browser may download (see bottom).
# Otherwise anyone could download main.py or spendwise.db.
app = Flask(__name__, static_folder=None)
# The secret key signs the login cookie so nobody can fake being logged in.
# For real use, set your own long random value in the SPENDWISE_SECRET_KEY environment variable.
app.secret_key = os.environ.get('SPENDWISE_SECRET_KEY', 'dev-only-change-me')
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
DB = 'spendwise.db'
PUBLIC_FILES = {'styles.css', 'app.js'}


def db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row   # lets us turn rows into dictionaries
    return conn


def init_db():
    with db() as conn:
        conn.execute('''CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL
        )''')
        conn.execute('''CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            date TEXT NOT NULL,
            amount REAL NOT NULL,
            type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
            user_id INTEGER REFERENCES users(id)
        )''')
        # Older databases were made before users existed: add the user_id column if it's missing.
        columns = [row['name'] for row in conn.execute('PRAGMA table_info(transactions)')]
        if 'user_id' not in columns:
            conn.execute('ALTER TABLE transactions ADD COLUMN user_id INTEGER REFERENCES users(id)')


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
                'INSERT INTO users (username, password_hash) VALUES (?, ?)',
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
    return jsonify({'username': session['username']})


# ---------- Transactions (each user only sees their own) ----------

@app.get('/api/transactions')
@login_required
def list_transactions():
    with db() as conn:
        rows = conn.execute(
            'SELECT id, name, category, date, amount, type FROM transactions '
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
    if not name or amount <= 0 or not date or tx_type not in ('income', 'expense'):
        return jsonify({'error': 'Invalid transaction'}), 400
    with db() as conn:
        cur = conn.execute(
            'INSERT INTO transactions (name, category, date, amount, type, user_id) VALUES (?, ?, ?, ?, ?, ?)',
            (name, category, date, amount, tx_type, session['user_id']))
    return jsonify({'id': cur.lastrowid, 'name': name, 'category': category,
                    'date': date, 'amount': amount, 'type': tx_type}), 201


@app.delete('/api/transactions/<int:tx_id>')
@login_required
def delete_transaction(tx_id):
    with db() as conn:
        # "AND user_id = ?" stops one user deleting another user's transactions
        conn.execute('DELETE FROM transactions WHERE id = ? AND user_id = ?', (tx_id, session['user_id']))
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
