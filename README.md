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

> Full technical reference (architecture, API endpoints, DB schema) lives in [IMPLEMENTATION.md](IMPLEMENTATION.md).

---

## Plaid Sandbox Testing

With `PLAID_ENV=sandbox`, use Plaid's test credentials in the OAuth flow:
- **Username:** `user_good`
- **Password:** `pass_good`

To connect real accounts, apply for production access at [dashboard.plaid.com](https://dashboard.plaid.com). Plaid requires a live deployed URL and a privacy policy page before approving production access.

---

## License

MIT — see [LICENSE](LICENSE)
