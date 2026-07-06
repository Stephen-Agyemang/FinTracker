# FinTracker — Implementation Reference

Keep this file updated as the project evolves. Read it at the start of every session. It exists so any session can pick up full context without re-deriving anything from the code.

---

## Stack

| Layer | Tech | Details |
|---|---|---|
| Backend | FastAPI (Python) | `app/server.py`, port **8082** |
| Database | SQLite + WAL mode | `app/fintracker.db` |
| AI — Gemini | `google-genai` SDK | `models/gemini-2.5-flash-lite` (active default) |
| AI — Claude | `anthropic` SDK | `claude-opus-4-8` |
| Bank data | Plaid API | `plaid-python 39.2.0`, sandbox mode |
| Frontend | Jinja2 template + static assets | `index.html` skeleton includes `templates/partials/*` and `templates/views/*`; CSS/JS in `app/static/{css,js}` |
| Auth | None | Single local user (`__local__`), auto-created; no login. Per-user `user_id` plumbing retained in the data layer for a future re-add |
| Styles | Tailwind CDN + custom CSS | Clean & minimal — white/slate base, teal accent |
| Charts | Chart.js 4.4.0 | Capital velocity, donut, burn trajectory |
| Fonts | DM Sans + Inter | DM Sans = headings/numbers, Inter = body |

---

## How to Run

```bash
source venv/bin/activate   # from project root
cd app
uvicorn server:app --host 0.0.0.0 --port 8082 --reload
```

Open http://localhost:8082

**Virtualenv is `venv/` — NOT `.venv/`**

---

## Environment Variables (`.env` in project root)

```env
GEMINI_API_KEY=...          # Required — Gemini AI
ANTHROPIC_API_KEY=...       # Optional — Claude AI fallback
PLAID_CLIENT_ID=...         # Optional — bank connection
PLAID_SECRET=...            # Optional — bank connection
PLAID_ENV=sandbox           # sandbox | production
```

**No auth** — the app runs as a single local user with no login. There are no auth-related env vars.

`.env` is gitignored. Keys are loaded via `python-dotenv` in both `server.py` and `advisor.py`.

---

## Database Schema

```sql
users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    name TEXT, picture TEXT, created_at TEXT
)

expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 0,  -- FK → users.id
    name TEXT, category TEXT, amount REAL,
    expense_date TEXT, status TEXT,
    payment_method TEXT, transaction_type TEXT
)
-- Income stored as NEGATIVE amounts internally

settings (
    user_id INTEGER NOT NULL DEFAULT 0,  -- FK → users.id
    key TEXT NOT NULL, value TEXT NOT NULL,
    PRIMARY KEY (user_id, key)
)
-- Keys: starting_capital, monthly_budget, currency,
--       ai_brain_mode, ai_provider,
--       plaid_access_token, plaid_item_id

cancelled_subscriptions (
    user_id INTEGER NOT NULL DEFAULT 0,  -- FK → users.id
    merchant_name TEXT NOT NULL, cancelled_at TEXT,
    PRIMARY KEY (user_id, merchant_name)
)
```

---

## All 21 Categories

`🍔Food`, `🍺Dining & Bars`, `🛍️Shopping`, `✈️Travel`, `🚗Transportation`,
`🏥Health`, `💅Personal Care`, `🐾Pets`, `📦 Subscriptions`, `📱Phone & Internet`,
`⚡Utilities`, `🏠Home`, `🏦Insurance`, `💼Business`, `💹Investments`,
`📚Education`, `🎶Entertainment`, `🎁Gifts & Giving`, `🧒Childcare`,
`💰Income`, `🤷Miscellaneous`

Color keys: `food-orange` `education-purple` `home-green` `utilities-blue` `danger-red` `sky-blue` `pink` `amber` `outline`

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/summary` | Dashboard metrics |
| GET | `/api/insights` | AI-generated insight |
| GET | `/api/settings` | User settings |
| POST | `/api/settings` | Update settings |
| POST | `/api/expenses` | Add transaction |
| DELETE | `/api/expenses` | Clear all |
| DELETE | `/api/expenses/delete-by-name/{name}` | Delete by name |
| GET | `/api/export` | CSV export |
| POST | `/api/chat` | Chat with AI |
| POST | `/api/chat/stream` | Streaming chat |
| GET | `/api/subscriptions` | Subscription analysis |
| POST | `/api/subscriptions/cancel` | Mark cancelled + AI email |
| POST | `/api/subscriptions/reactivate` | Reactivate |
| POST | `/api/subscriptions/draft-email` | Draft cancel email only |
| GET | `/api/plaid/status` | Bank connection status |
| POST | `/api/plaid/create-link-token` | Start Plaid OAuth |
| POST | `/api/plaid/exchange-token` | Complete Plaid connection |
| POST | `/api/plaid/sync` | Import 30 days of transactions |
| DELETE | `/api/plaid/disconnect` | Disconnect bank |
| POST | `/api/import/csv` | Import bank statement CSV |

---

## Critical HTML Element IDs

### Dashboard
`#liquid-capital-display` `#stat-total-spent` `#stat-daily-budget` `#stat-total-income`
`#stat-remaining-budget` `#insight-text` `#insight-savings` `#insight-velocity`
`#ledger-rows-body` (transactions table — NOT `#transactions-body`)
`#category-cards-grid` `#donut-total` `#goal-val-display` `#goal-months-needed`

### Subscriptions view (`#view-subscriptions`)
`#sub-total-monthly` `#sub-total-annual` `#sub-active-count` `#sub-cancelled-count`
`#sub-cards-grid`

### Cancel modal (`#cancel-modal`)
`#cancel-modal-title` `#cancel-modal-sub` `#cancel-direct-wrap` `#cancel-direct-link`
`#draft-email-btn` `#email-draft-loading` `#email-draft-area` `#email-draft-text`
`#confirm-cancel-btn`

### Bank view (`#view-bank`)
`#bank-status-bar` `#bank-status-icon` `#bank-status-title` `#bank-status-sub`
`#bank-action-btn-wrap` `#plaid-setup-notice` `#plaid-sync-result` `#plaid-sync-detail`
`#csv-panel` `#csv-drop-zone` `#csv-file-input` `#csv-import-result` `#csv-import-detail`

---

## Glassmorphism Design System

**Background:** `linear-gradient(140deg, #c7d9f8 → #e5deff → #c7f0e3)`

**Blobs (position: fixed, z-index: 0):**
- Teal 700px · `rgba(20,184,166,0.55)` · top-left
- Purple 600px · `rgba(139,92,246,0.50)` · top-right
- Blue 500px · `rgba(59,130,246,0.40)` · bottom-center
- Pink 420px · `rgba(236,72,153,0.35)` · bottom-right

**CSS classes:**
- `.g1` — `rgba(255,255,255,0.52)` · white border · blur 22px · colored inset shadow
- `.g2` — `rgba(255,255,255,0.68)` · white border · blur 22px
- `.g3` — `rgba(255,255,255,0.85)` · white border · blur 22px
- `.glass-sidebar` — `rgba(255,255,255,0.58)` · blur 28px
- `.glass-header` — `rgba(255,255,255,0.55)` · blur 28px
- `.glass-drawer` — `rgba(255,255,255,0.72)` · blur 28px
- `.glass-modal` — `rgba(255,255,255,0.82)` · blur 32px · purple-tinted shadow

**Accent:** `#0d9488` (teal-600)

---

## Subscription Detection Logic

`expense_store.get_subscription_analysis()` flags a transaction group as a subscription if:
1. Category is `📦 Subscriptions`, OR
2. Name matches any keyword in `_SUB_KEYWORDS` (60+ services), OR
3. 2+ charges with consistent interval: weekly (5–9d), monthly (25–35d), quarterly (85–95d), annual (355–375d), OR same amount charged more than once

Billing cycle is auto-detected from average gap between charges. Monthly cost is normalized from actual charge amount × cycle multiplier.

---

## Known Gotchas

- **IDE false errors** — IDE uses system Python `/Library/Frameworks/Python.framework/Versions/3.13/`. All `anthropic`, `google.generativeai`, `plaid` import errors in the IDE are false alarms. Packages are installed in `venv/`.
- **Legacy CSV migration** — `app/expenses.csv` and `expenses.csv` were deleted. If they come back, the `_migrate_csv_if_needed()` function will import them on startup and block the seed data from running (seed only runs if count == 0).
- **Plaid sandbox** — test with username `user_good` / password `pass_good`. Production access requires Plaid application + approval.
- **Income = negative amounts** — income transactions are stored with negative `amount` values internally. The UI flips the sign for display.
- **DB location** — `app/fintracker.db`. There was a second `fintracker.db` at project root (now deleted). Only `app/` one is correct.

---

## Completed Features

- [x] Dashboard with 4 stat cards, velocity chart, AI insight, category cards, donut chart
- [x] Analytics view (charts)
- [x] Portfolio view (savings goal calculator)
- [x] Transactions ledger with search and filter
- [x] Subscriptions view — detection, cancel flow, AI email drafting, cancel/reactivate
- [x] Bank Connect — Plaid OAuth flow, sync, disconnect, CSV import fallback
- [x] Settings — starting capital, budget, currency, AI provider, brain mode
- [x] AI chat drawer — Gemini + Claude, 3 brain modes, streaming
- [x] 21 expense categories with color coding
- [x] CSV export
- [x] Glassmorphism UI — gradient blobs + glass panels
- [x] DM Sans + Inter typography
- [x] Plaid integration (sandbox)

---

## Roadmap / Next Steps

### Must-do before real users
- [ ] **User authentication** — removed for now (single local user). Data layer keeps `user_id` plumbing so auth can be re-added without a schema change.
- [ ] **Deploy to a server** — Render.com or Railway.app (free tier). Needs `Procfile` or `railway.json`.
- [ ] **Custom domain** — buy on Namecheap (~$10/yr), point DNS to deployment host.
- [ ] **HTTPS** — handled automatically by Render/Railway via Let's Encrypt.
- [ ] **Privacy policy + ToS** — required for Plaid production access and good practice regardless.

### Nice to have
- [ ] Plaid production access (apply at dashboard.plaid.com)
- [ ] Teller API as Plaid alternative (easier approval, free tier)
- [ ] Push notifications for large charges
- [ ] Recurring transaction scheduler
- [ ] Mobile-responsive layout
- [ ] Dark mode toggle

---

## Deployment Plan (when ready)

### Render.com (recommended for simplicity)
1. Push repo to GitHub
2. New Web Service on Render → connect repo
3. Build command: `pip install -r requirements.txt`
4. Start command: `cd app && uvicorn server:app --host 0.0.0.0 --port $PORT`
5. Add env vars (GEMINI_API_KEY etc.) in Render dashboard
6. Free tier gives you a `.onrender.com` subdomain instantly

### Custom domain
1. Buy domain on Namecheap.com (~$10/yr for `.com`)
2. In Render dashboard → your service → Settings → Custom Domain → add your domain
3. Render gives you a CNAME record value
4. In Namecheap → Advanced DNS → add that CNAME record
5. Wait 10–30 min for DNS to propagate → done, HTTPS included automatically

### SQLite note for deployment
SQLite works fine on Render but the disk resets on redeploy (ephemeral storage). For persistent data either:
- Use Render's persistent disk ($7/mo), OR
- Migrate to PostgreSQL (free on Render, needs `asyncpg` + minor query changes)
