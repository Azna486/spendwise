# ---- SpendWise on PythonAnywhere ----
# Copy ALL of this into PythonAnywhere's WSGI file (Web tab → "WSGI configuration file"),
# replacing everything that's there. Change YOUR_USERNAME to your PythonAnywhere username.
import os
import sys

PROJECT = '/home/YOUR_USERNAME/spendwise'
if PROJECT not in sys.path:
    sys.path.insert(0, PROJECT)
os.chdir(PROJECT)

os.environ.setdefault('SPENDWISE_HTTPS', '1')            # pythonanywhere.com is https: secure login cookie
os.environ.setdefault('SPENDWISE_IP_HEADER', 'X-Real-IP')  # where PythonAnywhere puts the visitor's address

import main                     # also reads .env (your GROQ_API_KEY) from the project folder
main.init_db()                  # creates the database tables the first time
application = main.app
