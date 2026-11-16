"""Run SpendWise for real use (e.g. behind a Cloudflare Tunnel).

    pip install waitress
    python3 serve.py

It serves the app on http://127.0.0.1:5001 with a production server (not Flask's
development server), only reachable from this Mac. cloudflared then makes it public over https.
See DEPLOY.md for the full steps.
"""
import os
import sys

# Before main.py loads: tell it we're on https, so the login cookie is https-only.
# (Set SPENDWISE_HTTPS=0 if you want to test serve.py at http://127.0.0.1:5001 in your browser.)
os.environ.setdefault('SPENDWISE_HTTPS', '1')
os.environ.pop('SPENDWISE_DEBUG', None)          # never run the debugger on the internet

try:
    from waitress import serve
except ImportError:
    sys.exit('waitress is not installed. Run:  pip install waitress   (inside your venv), then try again.')

import main

HOST, PORT = '127.0.0.1', int(os.environ.get('PORT', '5001'))

if __name__ == '__main__':
    main.init_db()
    print(f'SpendWise is running on http://{HOST}:{PORT}  (press Ctrl+C to stop)')
    print('Now start the tunnel in another Terminal window. See DEPLOY.md.')
    serve(main.app, host=HOST, port=PORT, threads=8)
