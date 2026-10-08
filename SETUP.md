# Setting up TripMate on your laptop

This gets the API and the website running locally, then checks everything works. It takes about 10 minutes.

## Quick start: one command

After installing the [prerequisites](#1-install-the-prerequisites) and [getting the code](#2-get-the-code), from the `tripmate` folder run:

```bash
./run.sh
```

It installs everything the first time (and skips that on later runs), creates `backend/.env`, starts the API and the website, and prints the address to open. **Ctrl+C stops both.**

| Command | What it does |
|---|---|
| `./run.sh` | Set up if needed, then start the API and the website |
| `./run.sh setup` | Install everything without starting |
| `./run.sh test` | Run the backend tests and check the website builds |

It handles the common problems for you:
- **Missing or too-old Python or Node:** stops with a download link.
- **Changed dependencies:** reinstalls only what changed.
- **`npm ci` fails:** falls back to `npm install`.
- **Busy ports:** uses the next free one and points the website at the right API.
- **API fails to start:** shows the error.

API logs go to `.run/api.log`.

> **Windows:** run it from **Git Bash** or **WSL**. In plain PowerShell, follow the manual steps below.

## Manual setup

TripMate has two parts that run side by side:

| Part | Folder | Runs at |
|---|---|---|
| API and planners (Python) | `backend/` | http://localhost:8000 |
| Website (React) | `frontend/` | http://localhost:5173 |

Each part needs its own terminal window.

---

## 1. Install the prerequisites

| Tool | Version | Check with |
|---|---|---|
| Git | any recent | `git --version` |
| Python | **3.12** (3.11+ works) | `python3 --version` (Windows: `python --version`) |
| Node.js | **20 or newer** (includes npm) | `node --version` |

Download links: [git-scm.com](https://git-scm.com/downloads) · [python.org](https://www.python.org/downloads/) · [nodejs.org](https://nodejs.org/) (choose the LTS version).

> **Windows:** when installing Python, tick **"Add python.exe to PATH"**.

## 2. Get the code

```bash
git clone https://github.com/utkarrshgit/tripmate.git
cd tripmate
```

To work on a particular branch:

```bash
git fetch origin
git switch <branch-name>
```

## 3. Start the API (terminal 1)

**macOS / Linux**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn app.main:app --reload
```

**Windows (PowerShell)**

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload
```

Leave this terminal running. You should see `Uvicorn running on http://127.0.0.1:8000`.

> **Next time:** you only need `cd backend`, the `activate` line, and `uvicorn app.main:app --reload`.

## 4. Start the website (terminal 2)

Open a **second** terminal in the `tripmate` folder:

```bash
cd frontend
npm ci
npm run dev
```

Then open **http://localhost:5173** in your browser.

> `npm ci` installs the exact package versions in `package-lock.json`. Next time, `npm run dev` on its own is enough.

## 5. Check it works

**The API is up.** In a third terminal:

```bash
curl http://localhost:8000/health
```

Expected: `{"status":"ok","service":"TripMate"}`. Windows PowerShell also has `curl`. Or open http://localhost:8000/docs for interactive API docs.

**Plan a trip in the browser:**

1. Open http://localhost:5173.
2. In the search bar at the top, type `4 days in Goa 12-15 Dec under ₹25000 for 2 people` and press Enter.
3. You should see the planning animation, then a trip plan for Goa marked **Estimate**.
4. Click **Get exact prices**, type a city (e.g. `Delhi`) and click **Get exact prices** again. You'll see **sample** prices, which are made up for development.

**Run the automated tests** (with the API's virtual environment active, from `backend/`):

```bash
pytest
```

Expected: all tests pass.

**Check the website builds** (from `frontend/`):

```bash
npm run build
```

Expected: `✓ built in …` with no errors.

## Configuration

The API reads `backend/.env` (created from `.env.example` in step 3):

| Setting | What it does | Default in `.env.example` |
|---|---|---|
| `PRICING_PROVIDER` | Where exact prices come from: `sample` (made-up prices for development) or `none` (exact pricing switched off) | `sample` |
| `DEBUG` | Development mode | `true` |
| `OLLAMA_BASE_URL`, `OLLAMA_MODEL` | Optional local language model (see below) | `http://localhost:11434`, `llama3.2` |

The website talks to `http://localhost:8000` by default. To point it at another API, create `frontend/.env.local` containing:

```bash
VITE_API_URL=https://your-api.example.com
```

In development the website deliberately slows down planning and price checks by a few seconds, so the loading animations can be seen. Production builds don't include this. To turn it off locally, add `VITE_DEMO_DELAYS=false` to `frontend/.env.local`.

Never commit `.env` or `.env.local`. Both are already ignored by git.

## Optional: local language model (Ollama)

The planners don't use a language model yet, but the client is wired in for later. To try it:

1. Install Ollama from [ollama.com](https://ollama.com).
2. Run `ollama pull llama3.2`.

## Troubleshooting

| Problem | Fix |
|---|---|
| `Activate.ps1 cannot be loaded because running scripts is disabled` (Windows) | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, then activate again. |
| `Address already in use` / port 8000 or 5173 busy | Stop the other process, or run `uvicorn app.main:app --reload --port 8001`. If you change the API port, set `VITE_API_URL` to match. |
| Website loads but planning says the planner is unavailable | The API isn't running, or is on a different port. Check terminal 1 and `curl http://localhost:8000/health`. |
| Blank page, or `Failed to resolve import "@/…"` in the website terminal | Stop `npm run dev` (Ctrl+C) and start it again. The dev server sometimes misses config changes. |
| `ModuleNotFoundError` when running `pytest` | Activate the virtual environment and run `pytest` from inside `backend/`. |
| `python3: command not found` (Windows) | Use `python` instead of `python3`. |
