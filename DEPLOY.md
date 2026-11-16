# Putting SpendWise online with Cloudflare Tunnel

SpendWise keeps running on your Mac, and Cloudflare Tunnel gives it a public **https** address.
You don't need to open router ports or rent a server. Your data (`spendwise.db`) stays on your Mac.

**The catch:** the site is only online while your Mac is awake, connected, and running both windows below.

---

## 0. Once: move the project out of iCloud Desktop

Your project is in `~/Desktop`, which iCloud syncs. iCloud sometimes "offloads" files or locks them mid-write. That broke the venv earlier, and it can damage a live database. Move the project:

```bash
mkdir -p ~/Projects
mv ~/Desktop/spendwise ~/Projects/spendwise
cd ~/Projects/spendwise
python3 -m venv venv && source venv/bin/activate
pip install flask truststore certifi waitress
```

(Your `.env` with the Groq key and `spendwise.db` move along with the folder.)

## 1. Once: install cloudflared

```bash
brew install cloudflared
```

(No Homebrew? Get the Mac download from Cloudflare's "Downloads" page for cloudflared.)

## 2. Start SpendWise (Terminal window 1)

```bash
cd ~/Projects/spendwise
source venv/bin/activate
python3 serve.py
```

`serve.py` runs the app with a proper server (waitress) instead of Flask's development server. It turns off the debugger, makes the login cookie https-only, and listens only on this Mac.

> With `serve.py` running, logging in at `http://127.0.0.1:5001` won't stick, because the cookie is https-only. Use the tunnel address instead.
> To work on the app locally, keep using `python3 main.py` as before.

## 3a. Quick try: a temporary link (no account needed)

In **Terminal window 2**:

```bash
cloudflared tunnel --url http://127.0.0.1:5001
```

It prints an address like `https://something-random.trycloudflare.com`. Open it on your phone or send it to a friend.
The address changes every time you restart this command, so it's for testing only.

## 3b. For real: your own address (e.g. spendwise.yourname.com)

You need a domain added to your Cloudflare account (you can buy one through Cloudflare Registrar).

1. In the Cloudflare dashboard, open **Zero Trust → Networks → Tunnels** and choose **Create a tunnel** (type: Cloudflared). Name it `spendwise`.
2. Pick **macOS**, and copy the install command it shows (`sudo cloudflared service install <long token>`). Run it in Terminal.
   This runs the tunnel as a background service that starts by itself, so you don't need window 2.
3. Add a **Public hostname**: subdomain `spendwise`, your domain, service type **HTTP**, URL **127.0.0.1:5001**. Save.
4. Open `https://spendwise.yourdomain.com`.

Invite links that admins copy in the app use whatever address you opened the site at, so they work automatically.

**Optional, only you and your team can open the site:** in Zero Trust → Access, add an application for that hostname with a policy like "emails ending in @yourclub.org". Cloudflare then asks for an email code before the site even loads.

## 4. Keep the Mac awake

- System Settings → Battery (or Energy) → turn on **Prevent automatic sleeping when the display is off** (while on power).
- Or, while it's running: `caffeinate -dimsu` in a Terminal window.

## 5. Back up your data

Everything lives in `spendwise.db`. Make a safe copy now and then (this works while the app is running):

```bash
sqlite3 spendwise.db ".backup 'backup-$(date +%F).db'"
```

---

### What's protected

- `.env` (your AI key), `.secret_key` (signs logins), `spendwise.db` and the Python files can't be downloaded. Only the page files listed in `PUBLIC_FILES` are served.
- Log in, sign up and join-with-code allow 10 tries per 5 minutes per visitor. Wrong-password guessers get "Too many tries".
- `.secret_key` is created by itself the first time and is in `.gitignore`. Don't share it. If it ever leaks, delete it and restart: everyone gets logged out, and a new key is made.
- Cloudflare provides HTTPS, so passwords never travel in plain text.

### Remember: anyone with an invite code can join

Joining with a code needs no password, so treat invite codes like a password for your organisation. Admins can make a new code at any time from the Organisation page; the old one stops working.
