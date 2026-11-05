# Setting up TripMate on your laptop

This gets the API and the website running locally, then checks everything works. It takes about 10 minutes.

## Quick start: one command

After installing the [prerequisites](#1-install-the-prerequisites) and [getting the code](#2-get-the-code), from the `tripmate` folder run:

```bash
./run.sh
```

It installs everything the first time (and skips that on later runs), creates `backend/.env`, sets up the database, asks whether to plan with the **real AI models** or **mock data**, starts the API and the website, and prints the address, a demo log-in and prompts to try. **Ctrl+C stops everything it started and unloads the AI models from memory.**

| Command | What it does |
|---|---|
| `./run.sh` | Set up if needed, ask real or mock, then start |
| `./run.sh --real` | Start with the local AI models (checks Ollama and the models; asks before downloading anything) |
| `./run.sh --mock` | Start with mock data: rules and TripMate's guide, no AI needed |
| `./run.sh setup` | Install everything without starting |
| `./run.sh test` | Run the backend tests and check the website builds |
| `./run.sh stop` | Stop anything a previous run left behind, and unload the models |

For a presentation, follow [DEMO.md](DEMO.md).

It handles the common problems for you:
- **Missing or too-old Python or Node:** stops with a download link.
- **Changed dependencies:** reinstalls only what changed.
- **`npm ci` fails:** falls back to `npm install`.
- **Busy ports:** uses the next free one and points the website at the right API.
- **API fails to start:** shows the error, and still opens the website, which says the planner is unavailable until the API is back.
- **The API or website stops while running:** starts it again, up to 3 times each.
- **Install or database setup fails:** carries on with what's already installed, and says what won't work.
- **No `curl`:** uses Python instead.
- **Ollama or a model is missing in real mode:** asks before installing or downloading, and runs in mock mode if you'd rather not.

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
| PostgreSQL | **18** (16+ works) | `psql --version` |

Download links: [git-scm.com](https://git-scm.com/downloads) · [python.org](https://www.python.org/downloads/) · [nodejs.org](https://nodejs.org/) (choose the LTS version) · [postgresql.org](https://www.postgresql.org/download/).

> **macOS:** `brew install postgresql@18` then `brew services start postgresql@18`. Without PostgreSQL the planner still works, but accounts and saved trips won't.

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
createdb tripmate && createdb tripmate_test
alembic upgrade head
python -m app.cli seed-catalog
uvicorn app.main:app --reload
```

**Windows (PowerShell)**

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
Copy-Item .env.example .env
createdb tripmate; createdb tripmate_test
alembic upgrade head
python -m app.cli seed-catalog
uvicorn app.main:app --reload
```

Leave this terminal running. You should see `Uvicorn running on http://127.0.0.1:8000`.

> **Next time:** you only need `cd backend`, the `activate` line, and `uvicorn app.main:app --reload`. After pulling new code, run `alembic upgrade head` too, in case the database changed. (`./run.sh` does all of this for you.)

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
| `DATABASE_URL`, `TEST_DATABASE_URL` | The PostgreSQL databases for the app and for tests | `tripmate`, `tripmate_test` on this computer |
| `CORS_ORIGINS` | The website addresses allowed to call the API with cookies (`./run.sh` sets this for you) | `http://localhost:5173` |
| `OTP_SECRET` | Signs the 6-digit email codes. Make your own with `python -c "import secrets; print(secrets.token_hex(32))"` | a placeholder |
| `MAIL_MODE`, `SMTP_HOST`, `SMTP_PORT` | Where sign-up and reset codes go: `console` prints them in the API log; `smtp` sends them, for example to [Mailpit](https://mailpit.axllent.org) on port 1025 | `console` |
| `DEV_SHOW_CODES` | Development only: shows each emailed code on the website, so you can sign up without an inbox. Never turn this on for real users | `true` |
| `AI_ENABLED` | Use the local models in the planners (`false` plans with rules only) | `true` |
| `OLLAMA_BASE_URL` | Where Ollama runs | `http://localhost:11434` |
| `OLLAMA_LLM_MODEL`, `OLLAMA_DECISION_MODEL`, `OLLAMA_EMBED_MODEL` | The three local models (see below) | `gemma4:e2b-mlx`, `tev1:0.8b`, `qwen3-embedding:0.6b` |

The website talks to `http://localhost:8000` by default. To point it at another API, create `frontend/.env.local` containing:

```bash
VITE_API_URL=https://your-api.example.com
```

In development the website deliberately slows down planning and price checks by a few seconds, so the loading animations can be seen. Production builds don't include this. To turn it off locally, add `VITE_DEMO_DELAYS=false` to `frontend/.env.local`.

Never commit `.env` or `.env.local`. Both are already ignored by git.

## Accounts and admins

Sign-up, log-in and password reset use 6-digit codes sent by email. With the defaults, the code shows on the website and in the API log, so no inbox is needed. To make an admin account (or make an existing account an admin), run this from `backend/`:

```bash
python -m app.cli create-admin
```

Admins see **AI activity** in the account menu: every planning run and model call, with success rates and timings.

## Local AI models (Ollama)

TripMate uses three local models through [Ollama](https://ollama.com):

| Model | Job |
|---|---|
| `gemma4:e2b-mlx` | The general model: reads requests, arranges itineraries and edits plans |
| `tev1:0.8b` | A decision model: quick yes, no and label checks |
| `qwen3-embedding:0.6b` | Search by meaning |

Install Ollama, then pull them with `ollama pull gemma4:e2b-mlx`, `ollama pull tev1:0.8b` and `ollama pull qwen3-embedding:0.6b`. Open http://localhost:8000/health to check that the API sees all three.

The planners use the models when Ollama is running, and use rules when it isn't, so planning always works. The result says which it used. A plan with the models takes about 10–25 seconds, and the website shows each step as it happens. To plan with rules only, set `AI_ENABLED=false` in `backend/.env`.

The tests use rules and a fake model, so they don't need Ollama. To also check the real models, run `RUN_OLLAMA_TESTS=1 pytest` from `backend/`.

## Troubleshooting

| Problem | Fix |
|---|---|
| `Activate.ps1 cannot be loaded because running scripts is disabled` (Windows) | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, then activate again. |
| `Address already in use` / port 8000 or 5173 busy | Stop the other process, or run `uvicorn app.main:app --reload --port 8001`. If you change the API port, set `VITE_API_URL` to match. |
| Website loads but planning says the planner is unavailable | The API isn't running, or is on a different port. Check terminal 1 and `curl http://localhost:8000/health`. |
| Blank page, or `Failed to resolve import "@/…"` in the website terminal | Stop `npm run dev` (Ctrl+C) and start it again. The dev server sometimes misses config changes. |
| `ModuleNotFoundError` when running `pytest` | Activate the virtual environment and run `pytest` from inside `backend/`. |
| `python3: command not found` (Windows) | Use `python` instead of `python3`. |
