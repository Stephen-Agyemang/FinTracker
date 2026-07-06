# FinTracker

A personal finance web app with an AI financial advisor, real bank connection via Plaid, automatic subscription detection, and a glassmorphism UI.

Built with FastAPI + SQLite on the backend and a single-page HTML frontend — no framework, no build step, just run and go.

---

## Features

**Dashboard**
- Liquid capital, monthly spend, daily budget rate, and total income — live at a glance
- Spending velocity chart showing capital movement across the month
- AI-generated financial insight powered by Gemini or Claude
- Spending breakdown by category with progress bars

**AI Financial Advisor**
- Chat with a real AI (Gemini 2.5 Flash or Claude Opus) about your finances
- Advisor has full context of your transaction history and metrics
- Three brain modes: Creative, Balanced, Strict
- Streaming responses for a natural feel

**Bank Connection**
- Connect real bank accounts via Plaid (12,000+ supported institutions)
- Auto-imports last 30 days of transactions on sync
- Transactions are categorized automatically on import

**Subscription Management**
- Detects recurring charges automatically from your transaction history
- Shows monthly and annual cost per subscription
- One-click direct cancel links for 40+ major services (Netflix, Spotify, Adobe, etc.)
- AI drafts a professional cancellation email for any service
- Mark subscriptions as cancelled to track savings

**Transactions**
- Full ledger with search, filter by category, and delete
- CSV export of all transactions
- Manual entry with 21 categories

**21 Spending Categories**
Food & Dining, Dining & Bars, Shopping & Retail, Travel, Transportation, Health & Fitness, Personal Care, Pets, Subscriptions, Phone & Internet, Utilities, Home, Insurance, Business & Work, Savings & Investments, Education, Entertainment, Gifts & Giving, Childcare, Income, Miscellaneous

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python · FastAPI · Uvicorn |
| Database | SQLite (WAL mode) |
| AI | Google Gemini 2.5 Flash Lite · Anthropic Claude Opus |
| Bank Data | Plaid API |
| Frontend | Vanilla HTML/JS · Tailwind CSS · Chart.js |
| Fonts | DM Sans · Inter |

---

## Quick Start

**1. Clone and set up the environment**
```bash
git clone https://github.com/YOUR_USERNAME/FinTracker.git
cd FinTracker
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**2. Add your API keys**

Create a `.env` file in the project root:
```env
# Required for AI features
GEMINI_API_KEY=your_gemini_api_key

# Optional — Claude as alternative AI provider
ANTHROPIC_API_KEY=your_anthropic_api_key

# Optional — Plaid for real bank connection
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret
PLAID_ENV=sandbox
```

**Getting credentials:**

- **Gemini** — free key at [aistudio.google.com](https://aistudio.google.com)
- **Plaid** — free sandbox credentials at [dashboard.plaid.com](https://dashboard.plaid.com)

**3. Run**
```bash
cd app
uvicorn server:app --host 0.0.0.0 --port 8082 --reload
```

Open [http://localhost:8082](http://localhost:8082) — the app loads straight to your dashboard.

---

## Project Structure

```
FinTracker/
├── app/
│   ├── server.py          # FastAPI routes and Plaid integration
│   ├── advisor.py         # AI advisor (Gemini + Claude)
│   ├── expense_store.py   # SQLite data layer + subscription detection
│   ├── templates/
│   │   └── index.html     # Full frontend (single page)
│   └── fintracker.db      # SQLite database (auto-created, gitignored)
├── .env                   # API keys (gitignored)
├── requirements.txt
└── IMPLEMENTATION.md      # Full technical reference
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/summary` | Dashboard metrics |
| GET | `/api/insights` | AI-generated insight |
| POST | `/api/expenses` | Add transaction |
| DELETE | `/api/expenses/delete-by-name/{name}` | Delete transaction |
| GET | `/api/export` | Download ledger as CSV |
| GET | `/api/subscriptions` | Subscription analysis |
| POST | `/api/subscriptions/cancel` | Mark cancelled + get AI email draft |
| POST | `/api/subscriptions/reactivate` | Reactivate subscription |
| POST | `/api/subscriptions/draft-email` | Draft cancellation email |
| GET | `/api/plaid/status` | Bank connection status |
| POST | `/api/plaid/create-link-token` | Start Plaid OAuth flow |
| POST | `/api/plaid/exchange-token` | Complete Plaid connection |
| POST | `/api/plaid/sync` | Import transactions from bank |
| DELETE | `/api/plaid/disconnect` | Disconnect bank account |
| POST | `/api/import/csv` | Import bank statement CSV |
| GET | `/api/settings` | Get user settings |
| POST | `/api/settings` | Update settings |
| POST | `/api/chat` | Chat with AI advisor |
| POST | `/api/chat/stream` | Streaming chat response |

---

## Plaid Sandbox Testing

With `PLAID_ENV=sandbox`, use Plaid's test credentials in the OAuth flow:
- **Username:** `user_good`
- **Password:** `pass_good`

To connect real accounts, apply for production access at [dashboard.plaid.com](https://dashboard.plaid.com). Plaid requires a live deployed URL and a privacy policy page before approving production access.

---

## Deployment Roadmap

The intended progression from local to production:

**Step 1 — Deploy to Render.com**
Push to GitHub, connect the repo as a Web Service. Build command: `pip install -r requirements.txt`. Start command: `cd app && uvicorn server:app --host 0.0.0.0 --port $PORT`. Set all env vars in the Render dashboard (same keys as `.env`). Free tier gives a `.onrender.com` URL immediately.

> Note: Render's free tier uses ephemeral storage — SQLite data resets on redeploy. Migrate to Postgres before storing anything you care about.

**Step 2 — Migrate SQLite → Render Postgres**
Render offers free managed PostgreSQL. The queries barely change — it's the same SQL, just a different connection string. This is what makes the data permanent.

**Step 3 — Custom domain**
Buy a `.com` on Namecheap (~$10/yr). Add it in Render → Settings → Custom Domain. Render issues a CNAME; add it in Namecheap DNS. HTTPS is automatic via Let's Encrypt. A real domain is required for Plaid production approval.

**Step 4 — Plaid production access**
Apply at [dashboard.plaid.com](https://dashboard.plaid.com) once you have a live domain and a privacy policy page. Plaid reviews applications manually — approval takes a few days.

**Step 5 — Docker + Google Cloud Run (optional)**
Only worth pursuing if you want to learn container-based infrastructure or need more control than Render provides. Do steps 1–4 first — Cloud Run makes much more sense once you've deployed something the simple way.

---

## License

MIT — see [LICENSE](LICENSE)
