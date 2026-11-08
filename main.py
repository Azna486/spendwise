from flask import Flask, jsonify, request, send_from_directory
import sqlite3

app = Flask(__name__, static_folder='.', static_url_path='')
DB = 'spendwise.db'

def db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row   # lets us turn rows into dictionaries
    return conn

def init_db():
    with db() as conn:
        conn.execute('''CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            date TEXT NOT NULL,
            amount REAL NOT NULL,
            type TEXT NOT NULL CHECK (type IN ('income', 'expense'))
        )''')

@app.get('/')
def home():
    return send_from_directory('.', 'index.html')

# Get all transactions
@app.get('/api/transactions')
def list_transactions():
    with db() as conn:
        rows = conn.execute('SELECT * FROM transactions ORDER BY date DESC').fetchall()
    return jsonify([dict(r) for r in rows])

# Add a transaction
@app.post('/api/transactions')
def add_transaction():
    data = request.get_json()
    name = str(data.get('name', '')).strip()
    amount = float(data.get('amount', 0))
    if not name or amount <= 0 or data.get('type') not in ('income', 'expense'):
        return jsonify({'error': 'Invalid transaction'}), 400
    with db() as conn:
        cur = conn.execute(
            'INSERT INTO transactions (name, category, date, amount, type) VALUES (?, ?, ?, ?, ?)',
            (name, data['category'], data['date'], amount, data['type']))
    return jsonify({**data, 'name': name, 'amount': amount, 'id': cur.lastrowid}), 201

# Delete a transaction
@app.delete('/api/transactions/<int:tx_id>')
def delete_transaction(tx_id):
    with db() as conn:
        conn.execute('DELETE FROM transactions WHERE id = ?', (tx_id,))
    return '', 204

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5001)