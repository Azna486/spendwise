# Putting SpendWise online with PythonAnywhere (free)

Your live site: **https://YOUR_USERNAME.pythonanywhere.com**. It's always on, even when your Mac is off.
You keep editing on your Mac, push to GitHub, and pull the changes onto PythonAnywhere.

Live data (`spendwise.db` on PythonAnywhere) and your Mac's test data are separate. Updates never touch the live data.

---

## Part 1: Put your code on GitHub (on your Mac)

1. Make a GitHub account at github.com if you don't have one.
2. Click **+ → New repository**, name it `spendwise`, and choose **Public**.
   Public is easiest. Your secrets aren't included: `.env`, `.secret_key` and every `.db` file are in `.gitignore`.
3. Don't tick "Add a README". Click **Create repository**.
4. In Terminal:
   ```bash
   cd ~/Projects/spendwise
   git status                      # .env, .secret_key and spendwise.db must NOT appear in this list
   git add .
   git commit -m "SpendWise ready to deploy"
   git branch -M main
   git remote add origin https://github.com/YOUR_GITHUB_NAME/spendwise.git
   git push -u origin main
   ```
   If GitHub asks for a password, use a **Personal access token**: GitHub → Settings → Developer settings → Personal access tokens. Your normal password won't work.

## Part 2: Make a PythonAnywhere account

1. Go to pythonanywhere.com → **Pricing & signup** → **Create a Beginner account** (free).
2. Your **username becomes your address**. `spendwise` gives `spendwise.pythonanywhere.com` (if it's free).

## Part 3: Copy the code onto PythonAnywhere

1. Open the **Consoles** tab → **Bash**.
2. Run:
   ```bash
   git clone https://github.com/YOUR_GITHUB_NAME/spendwise.git
   cd spendwise
   python3.13 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```
   (Use the newest Python version PythonAnywhere offers. If `python3.13` isn't found, try `python3.12`. Remember which one you used.)

## Part 4: Add your Groq key (the .env file)

Still in the Bash console:
```bash
nano .env
```
Type `GROQ_API_KEY=` followed by your key, all on one line. Press **Ctrl + O**, then **Enter** to save, and **Ctrl + X** to exit.

## Part 5: Create the web app

1. Open the **Web** tab → **Add a new web app** → **Next**.
2. Choose **Manual configuration** (not "Flask"), then the **same Python version** as in Part 3.
3. On the Web page that opens:
   - **Virtualenv:** enter `/home/YOUR_USERNAME/spendwise/venv`
   - **Force HTTPS:** turn it **on**
4. Click the **WSGI configuration file** link (it ends in `_wsgi.py`). Delete everything in it.
   Paste in the contents of `pythonanywhere_wsgi.py` from your project, change `YOUR_USERNAME`, and click **Save**.
5. Back on the Web tab, click the big green **Reload** button.
6. Open **https://YOUR_USERNAME.pythonanywhere.com** and create your account. It's a fresh, empty database.

## Part 6: Updating the live site after you change something

On your Mac:
```bash
cd ~/Projects/spendwise
git add .
git commit -m "what you changed"
git push
```
On PythonAnywhere (Consoles → Bash):
```bash
cd ~/spendwise && git pull
```
Then click **Reload** on the Web tab. Your users' data stays as it is.
If you added a new package to `requirements.txt`, also run `source venv/bin/activate && pip install -r requirements.txt` before reloading.

## Good to know

- **FIN (the AI):** free accounts can only reach websites on PythonAnywhere's allowlist. If FIN says it can't reach the AI service, request `api.groq.com` using PythonAnywhere's allowlist request form (search "PythonAnywhere requesting allowlist additions"). Give the docs link `https://console.groq.com/docs/api-reference`. The rest of the app works meanwhile.
- **Keep it switched on:** free web apps have an expiry date shown on the Web tab. Log in now and then and click **"Run until 3 months from today"**.
- **Errors?** The Web tab has an **Error log** link. Paste what it says to Claude.
- **Back up live data:** download `spendwise/spendwise.db` from the **Files** tab now and then.
- **Bring your Mac data (optional):** upload your Mac's `spendwise.db` into the `spendwise` folder from the Files tab, then click Reload. Do it before others start signing up, because it replaces the live database.
