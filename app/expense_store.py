import sqlite3
import os
import csv
import calendar
from datetime import date
from contextlib import contextmanager

KNOWN_CANCELLATION_URLS = {
    "netflix":        "https://www.netflix.com/cancelplan",
    "spotify":        "https://www.spotify.com/account/subscription/",
    "hulu":           "https://www.hulu.com/account/cancel",
    "disney":         "https://www.disneyplus.com/account/subscription",
    "disney+":        "https://www.disneyplus.com/account/subscription",
    "amazon prime":   "https://www.amazon.com/mc/pipelines/cancellation",
    "amazon":         "https://www.amazon.com/mc/pipelines/cancellation",
    "youtube":        "https://www.youtube.com/paid_memberships",
    "youtube premium":"https://www.youtube.com/paid_memberships",
    "apple":          "https://support.apple.com/billing",
    "icloud":         "https://support.apple.com/billing",
    "xbox":           "https://account.microsoft.com/services/",
    "microsoft":      "https://account.microsoft.com/services/",
    "playstation":    "https://www.playstation.com/en-us/account/subscription/",
    "linkedin":       "https://www.linkedin.com/premium/manage",
    "dropbox":        "https://www.dropbox.com/account/plan",
    "adobe":          "https://account.adobe.com/plans",
    "canva":          "https://www.canva.com/settings/billing",
    "notion":         "https://www.notion.so/my-account",
    "chatgpt":        "https://chat.openai.com/account/billing",
    "openai":         "https://platform.openai.com/account/billing",
    "github":         "https://github.com/settings/billing",
    "grammarly":      "https://account.grammarly.com/subscription",
    "duolingo":       "https://www.duolingo.com/settings/super",
    "headspace":      "https://www.headspace.com/account",
    "calm":           "https://app.calm.com/account",
    "audible":        "https://www.audible.com/account/membership",
    "nordvpn":        "https://my.nordaccount.com/subscription/",
    "expressvpn":     "https://www.expressvpn.com/subscriptions",
    "peloton":        "https://members.onepeloton.com/profile/billing",
    "nytimes":        "https://www.nytimes.com/subscription/profile",
    "new york times": "https://www.nytimes.com/subscription/profile",
    "twitch":         "https://www.twitch.tv/subscriptions",
    "slack":          "https://slack.com/intl/en-us/help/articles/206845570",
    "zoom":           "https://zoom.us/billing",
    "figma":          "https://www.figma.com/billing",
}

DB_FILE = "fintracker.db"
LEGACY_CSV = "expenses.csv"

CATEGORY_UI_MAP = {
    "🍔Food":            {"label": "Food & Dining",          "color": "food-orange",      "icon": "restaurant"},
    "📚Education":       {"label": "Growth & Skills",        "color": "education-purple", "icon": "school"},
    "🏠Home":            {"label": "Home Infrastructure",    "color": "home-green",       "icon": "home"},
    "⚡Utilities":       {"label": "Utilities",              "color": "utilities-blue",   "icon": "bolt"},
    "🎶Entertainment":   {"label": "Lifestyle",              "color": "home-green",       "icon": "theater_comedy"},
    "🏥Health":          {"label": "Health & Fitness",       "color": "danger-red",       "icon": "medical_services"},
    "🚗Transportation":  {"label": "Transportation",         "color": "utilities-blue",   "icon": "directions_car"},
    "📦 Subscriptions":  {"label": "Subscriptions",         "color": "education-purple", "icon": "subscriptions"},
    "🛍️Shopping":       {"label": "Shopping & Retail",      "color": "food-orange",      "icon": "shopping_bag"},
    "✈️Travel":          {"label": "Travel",                 "color": "sky-blue",         "icon": "flight"},
    "💅Personal Care":   {"label": "Personal Care",          "color": "pink",             "icon": "spa"},
    "🐾Pets":            {"label": "Pets",                   "color": "home-green",       "icon": "pets"},
    "🎁Gifts & Giving":  {"label": "Gifts & Giving",         "color": "pink",             "icon": "card_giftcard"},
    "💼Business":        {"label": "Business & Work",        "color": "utilities-blue",   "icon": "work"},
    "💹Investments":     {"label": "Savings & Investments",  "color": "home-green",       "icon": "trending_up"},
    "📱Phone & Internet":{"label": "Phone & Internet",       "color": "sky-blue",         "icon": "smartphone"},
    "🍺Dining & Bars":   {"label": "Dining & Bars",          "color": "amber",            "icon": "local_bar"},
    "🧒Childcare":       {"label": "Childcare",              "color": "amber",            "icon": "child_care"},
    "🏦Insurance":       {"label": "Insurance",              "color": "utilities-blue",   "icon": "security"},
    "💰Income":          {"label": "Income",                 "color": "home-green",       "icon": "payments"},
    "🤷Miscellaneous":   {"label": "Miscellaneous",          "color": "outline",          "icon": "help_outline"},
}

DEFAULT_SETTINGS = {
    "starting_capital": 10000.00,
    "monthly_budget":   5000.00,
    "currency":         "USD",
    "ai_brain_mode":    "Balanced",
    "ai_provider":      "gemini",
}


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        # Users table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                google_id  TEXT UNIQUE NOT NULL,
                email      TEXT UNIQUE NOT NULL,
                name       TEXT,
                picture    TEXT,
                created_at TEXT NOT NULL DEFAULT (date('now'))
            )
        """)

        # Expenses table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS expenses (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id          INTEGER NOT NULL DEFAULT 0,
                name             TEXT NOT NULL,
                category         TEXT NOT NULL,
                amount           REAL NOT NULL,
                expense_date     TEXT NOT NULL,
                status           TEXT NOT NULL DEFAULT 'Completed',
                payment_method   TEXT NOT NULL DEFAULT 'CASH',
                transaction_type TEXT NOT NULL DEFAULT 'expense',
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        # Add user_id to existing expenses table if missing (migration)
        try:
            conn.execute("ALTER TABLE expenses ADD COLUMN user_id INTEGER NOT NULL DEFAULT 0")
        except Exception:
            pass

        # Settings table (per-user)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                user_id INTEGER NOT NULL DEFAULT 0,
                key     TEXT    NOT NULL,
                value   TEXT    NOT NULL,
                PRIMARY KEY (user_id, key)
            )
        """)
        # Migrate old global settings table (had only key + value, no user_id)
        try:
            conn.execute("SELECT user_id FROM settings LIMIT 1")
        except Exception:
            try:
                old_rows = conn.execute("SELECT key, value FROM settings").fetchall()
                conn.execute("DROP TABLE IF EXISTS settings")
                conn.execute("""
                    CREATE TABLE settings (
                        user_id INTEGER NOT NULL DEFAULT 0,
                        key     TEXT    NOT NULL,
                        value   TEXT    NOT NULL,
                        PRIMARY KEY (user_id, key)
                    )
                """)
                for row in old_rows:
                    conn.execute(
                        "INSERT OR IGNORE INTO settings (user_id, key, value) VALUES (0, ?, ?)",
                        (row[0], row[1])
                    )
            except Exception:
                pass

        # Cancelled subscriptions table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS cancelled_subscriptions (
                user_id       INTEGER NOT NULL DEFAULT 0,
                merchant_name TEXT    NOT NULL,
                cancelled_at  TEXT    NOT NULL,
                PRIMARY KEY (user_id, merchant_name)
            )
        """)
        # Migrate old single-PK table if needed
        try:
            conn.execute("SELECT user_id FROM cancelled_subscriptions LIMIT 1")
        except Exception:
            try:
                old_rows = conn.execute(
                    "SELECT merchant_name, cancelled_at FROM cancelled_subscriptions"
                ).fetchall()
                conn.execute("DROP TABLE IF EXISTS cancelled_subscriptions")
                conn.execute("""
                    CREATE TABLE cancelled_subscriptions (
                        user_id       INTEGER NOT NULL DEFAULT 0,
                        merchant_name TEXT    NOT NULL,
                        cancelled_at  TEXT    NOT NULL,
                        PRIMARY KEY (user_id, merchant_name)
                    )
                """)
                for row in old_rows:
                    conn.execute(
                        "INSERT OR IGNORE INTO cancelled_subscriptions (user_id, merchant_name, cancelled_at) VALUES (0, ?, ?)",
                        (row[0], row[1])
                    )
            except Exception:
                pass

    _migrate_csv_if_needed()


def _migrate_csv_if_needed():
    if not os.path.exists(LEGACY_CSV):
        return
    with get_db() as conn:
        count = conn.execute("SELECT COUNT(*) FROM expenses").fetchone()[0]
        if count > 0:
            return
        with open(LEGACY_CSV, mode="r", encoding="utf-8") as f:
            reader = csv.reader(f)
            today = date.today()
            for i, row in enumerate(reader):
                if not row or len(row) < 3:
                    continue
                try:
                    name = row[0].strip()
                    category = clean_category(row[1].strip())
                    amount = float(row[2].strip())
                    expense_date = f"{today.year}-{today.month:02d}-{(i % 28) + 1:02d}"
                    status = "Completed"
                    payment_method = "CASH"
                    if len(row) >= 6:
                        expense_date = row[3].strip() or expense_date
                        status = row[4].strip() or status
                        payment_method = row[5].strip() or payment_method
                    transaction_type = "income" if amount < 0 else "expense"
                    conn.execute(
                        "INSERT INTO expenses (user_id, name, category, amount, expense_date, status, payment_method, transaction_type) VALUES (0, ?, ?, ?, ?, ?, ?, ?)",
                        (name, category, amount, expense_date, status, payment_method, transaction_type)
                    )
                except Exception:
                    continue


def clean_category(category_str: str) -> str:
    category_str = category_str.strip()
    if category_str in CATEGORY_UI_MAP:
        return category_str
    for key in CATEGORY_UI_MAP:
        if key in category_str or category_str in key:
            return key
    return "🤷Miscellaneous"


def _row_to_expense(row, idx=None):
    category = clean_category(row["category"])
    return {
        "id":               row["id"] if "id" in row.keys() else idx,
        "name":             row["name"],
        "category":         category,
        "category_display": CATEGORY_UI_MAP[category]["label"],
        "color":            CATEGORY_UI_MAP[category]["color"],
        "icon":             CATEGORY_UI_MAP[category]["icon"],
        "amount":           row["amount"],
        "date":             row["expense_date"],
        "status":           row["status"],
        "payment_method":   row["payment_method"],
        "transaction_type": row["transaction_type"],
    }


# ── User management ───────────────────────────────────────────────────────────

def create_or_get_user(google_id: str, email: str, name: str, picture: str) -> dict:
    with get_db() as conn:
        conn.execute("""
            INSERT INTO users (google_id, email, name, picture)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(google_id) DO UPDATE SET
                email   = excluded.email,
                name    = excluded.name,
                picture = excluded.picture
        """, (google_id, email, name or "", picture or ""))
        row = conn.execute(
            "SELECT * FROM users WHERE google_id = ?", (google_id,)
        ).fetchone()
    return dict(row)


def create_or_get_default_user() -> dict:
    with get_db() as conn:
        conn.execute("""
            INSERT OR IGNORE INTO users (google_id, email, name, picture)
            VALUES ('__local__', 'local@fintracker', 'You', '')
        """)
        row = conn.execute(
            "SELECT * FROM users WHERE google_id = '__local__'"
        ).fetchone()
    return dict(row)


def get_user_by_id(user_id: int) -> dict | None:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return dict(row) if row else None


# ── Data functions (all per-user) ─────────────────────────────────────────────

def read_expenses(user_id: int) -> list:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM expenses WHERE user_id = ? ORDER BY expense_date DESC, id DESC",
            (user_id,)
        ).fetchall()
    return [_row_to_expense(r) for r in rows]


def save_expense(user_id: int, name: str, category: str, amount: float,
                 expense_date: str = None, status: str = "Completed",
                 payment_method: str = "VISA • 4242", transaction_type: str = None) -> dict:
    if not expense_date:
        expense_date = date.today().isoformat()
    category = clean_category(category)
    if transaction_type is None:
        transaction_type = "income" if amount < 0 else "expense"

    with get_db() as conn:
        cursor = conn.execute(
            "INSERT INTO expenses (user_id, name, category, amount, expense_date, status, payment_method, transaction_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (user_id, name, category, amount, expense_date, status, payment_method, transaction_type)
        )
        new_id = cursor.lastrowid

    return {
        "id":               new_id,
        "name":             name,
        "category":         category,
        "category_display": CATEGORY_UI_MAP[category]["label"],
        "color":            CATEGORY_UI_MAP[category]["color"],
        "icon":             CATEGORY_UI_MAP[category]["icon"],
        "amount":           amount,
        "date":             expense_date,
        "status":           status,
        "payment_method":   payment_method,
        "transaction_type": transaction_type,
    }


def get_settings(user_id: int) -> dict:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT key, value FROM settings WHERE user_id = ?", (user_id,)
        ).fetchall()
    settings = {}
    for row in rows:
        key, val = row["key"], row["value"]
        try:
            settings[key] = float(val) if "." in val or key in ("starting_capital", "monthly_budget") else val
        except ValueError:
            settings[key] = val
    # Fill defaults for any missing keys
    for k, v in DEFAULT_SETTINGS.items():
        if k not in settings:
            settings[k] = v
    return settings


def save_settings(user_id: int, updates: dict) -> dict:
    with get_db() as conn:
        for key, val in updates.items():
            conn.execute(
                "INSERT INTO settings (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value",
                (user_id, key, str(val))
            )
    return get_settings(user_id)


def seed_settings(user_id: int):
    with get_db() as conn:
        for key, val in DEFAULT_SETTINGS.items():
            conn.execute(
                "INSERT OR IGNORE INTO settings (user_id, key, value) VALUES (?, ?, ?)",
                (user_id, key, str(val))
            )


def get_summary_metrics(user_id: int) -> dict:
    expenses = read_expenses(user_id)
    settings = get_settings(user_id)

    total_spent  = sum(e["amount"] for e in expenses if e["amount"] > 0)
    total_income = sum(abs(e["amount"]) for e in expenses if e["amount"] < 0)

    starting_capital = float(settings.get("starting_capital", DEFAULT_SETTINGS["starting_capital"]))
    monthly_budget   = float(settings.get("monthly_budget",   DEFAULT_SETTINGS["monthly_budget"]))

    liquid_capital = max(0.0, starting_capital - total_spent + total_income)

    category_totals = {}
    for key, val in CATEGORY_UI_MAP.items():
        category_totals[val["label"]] = {"amount": 0.0, "color": val["color"], "icon": val["icon"], "raw_category": key}

    for e in expenses:
        label = e["category_display"]
        if label in category_totals and e["amount"] > 0:
            category_totals[label]["amount"] += e["amount"]

    active_categories = [
        {"label": label, "amount": info["amount"], "color": info["color"], "icon": info["icon"], "raw_category": info["raw_category"]}
        for label, info in category_totals.items()
        if info["amount"] > 0
    ]
    active_categories.sort(key=lambda x: x["amount"], reverse=True)

    today = date.today()
    days_in_month  = calendar.monthrange(today.year, today.month)[1]
    remaining_days = max(1, days_in_month - today.day)
    remaining_budget = monthly_budget - total_spent
    daily_budget = remaining_budget / remaining_days if remaining_budget > 0 else 0.0

    return {
        "total_spent":      total_spent,
        "total_income":     total_income,
        "liquid_capital":   liquid_capital,
        "remaining_budget": max(0, remaining_budget),
        "daily_budget":     daily_budget,
        "categories":       active_categories,
        "expenses":         expenses[:15],
        "all_expenses":     expenses,
        "current_month":    today.strftime("%B %Y"),
        "settings":         settings,
    }


def delete_expense_by_name(user_id: int, name: str) -> dict:
    with get_db() as conn:
        result = conn.execute(
            "DELETE FROM expenses WHERE user_id = ? AND LOWER(name) = LOWER(?)",
            (user_id, name.strip())
        )
    return {"status": "success", "count": result.rowcount}


def clear_all_expenses(user_id: int) -> dict:
    with get_db() as conn:
        conn.execute("DELETE FROM expenses WHERE user_id = ?", (user_id,))
    return {"status": "success"}


def get_cancelled_subscriptions(user_id: int) -> list[str]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT merchant_name FROM cancelled_subscriptions WHERE user_id = ?", (user_id,)
        ).fetchall()
    return [r["merchant_name"] for r in rows]


def mark_subscription_cancelled(user_id: int, name: str) -> dict:
    with get_db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO cancelled_subscriptions (user_id, merchant_name, cancelled_at) VALUES (?, ?, ?)",
            (user_id, name.strip(), date.today().isoformat())
        )
    return {"status": "success", "name": name}


def unmark_subscription_cancelled(user_id: int, name: str) -> dict:
    with get_db() as conn:
        conn.execute(
            "DELETE FROM cancelled_subscriptions WHERE user_id = ? AND LOWER(merchant_name) = LOWER(?)",
            (user_id, name.strip())
        )
    return {"status": "success", "name": name}


# ── Subscription detection ────────────────────────────────────────────────────

_SUB_KEYWORDS = {
    "netflix", "spotify", "hulu", "disney", "amazon prime", "youtube premium",
    "apple", "icloud", "xbox", "playstation", "linkedin", "dropbox", "adobe",
    "canva", "notion", "chatgpt", "openai", "github", "grammarly", "duolingo",
    "headspace", "calm", "audible", "nordvpn", "expressvpn", "peloton",
    "nytimes", "twitch", "slack", "zoom", "figma", "membership", "subscription",
    "premium", "plus", "pro plan",
}


def _charge_interval_days(dates: list[str]) -> float | None:
    if len(dates) < 2:
        return None
    parsed = sorted(date.fromisoformat(d) for d in dates)
    gaps   = [(parsed[i+1] - parsed[i]).days for i in range(len(parsed)-1)]
    return sum(gaps) / len(gaps)


def _is_recurring(name_key: str, txns: list, category: str) -> bool:
    if category == "📦 Subscriptions":
        return True
    if any(kw in name_key for kw in _SUB_KEYWORDS):
        return True
    if len(txns) >= 2:
        avg_gap = _charge_interval_days([t["date"] for t in txns])
        if avg_gap is not None:
            for lo, hi in [(5,9),(25,35),(85,95),(355,375)]:
                if lo <= avg_gap <= hi:
                    return True
        amounts = [t["amount"] for t in txns]
        if len(set(round(a,2) for a in amounts)) == 1:
            return True
    return False


def _billing_cycle(avg_gap_days: float | None) -> str:
    if avg_gap_days is None: return "monthly"
    if avg_gap_days <= 9:    return "weekly"
    if avg_gap_days <= 35:   return "monthly"
    if avg_gap_days <= 95:   return "quarterly"
    return "annual"


def _monthly_equivalent(amount: float, cycle: str) -> float:
    return {"weekly": amount*4.33, "monthly": amount, "quarterly": amount/3, "annual": amount/12}.get(cycle, amount)


def get_subscription_analysis(user_id: int) -> dict:
    expenses  = read_expenses(user_id)
    cancelled = {c.lower() for c in get_cancelled_subscriptions(user_id)}

    by_name: dict[str, list] = {}
    for e in expenses:
        if e["amount"] <= 0:
            continue
        key = e["name"].lower().strip()
        by_name.setdefault(key, []).append(e)

    subscriptions = []
    for name_key, txns in by_name.items():
        rep = txns[0]
        if not _is_recurring(name_key, txns, rep["category"]):
            continue

        dates      = [t["date"] for t in txns]
        avg_gap    = _charge_interval_days(dates)
        cycle      = _billing_cycle(avg_gap)
        avg_charge = sum(t["amount"] for t in txns) / len(txns)
        monthly    = _monthly_equivalent(avg_charge, cycle)
        last_date  = max(dates)

        cancel_url = None
        for kw, url in KNOWN_CANCELLATION_URLS.items():
            if kw in name_key or name_key in kw:
                cancel_url = url
                break

        status = "cancelled" if name_key in cancelled else "active"

        subscriptions.append({
            "name":          rep["name"],
            "monthly_cost":  round(monthly, 2),
            "annual_cost":   round(monthly * 12, 2),
            "charge_amount": round(avg_charge, 2),
            "billing_cycle": cycle,
            "last_charged":  last_date,
            "occurrences":   len(txns),
            "category":      rep["category_display"],
            "color":         rep["color"],
            "icon":          rep["icon"],
            "cancel_url":    cancel_url,
            "status":        status,
        })

    subscriptions.sort(key=lambda x: x["monthly_cost"], reverse=True)
    active        = [s for s in subscriptions if s["status"] == "active"]
    total_monthly = sum(s["monthly_cost"] for s in active)

    return {
        "subscriptions":   subscriptions,
        "total_monthly":   round(total_monthly, 2),
        "total_annual":    round(total_monthly * 12, 2),
        "active_count":    len(active),
        "cancelled_count": len(subscriptions) - len(active),
    }


# ── Seed demo data per new user ───────────────────────────────────────────────

def seed_user_data_if_needed(user_id: int):
    with get_db() as conn:
        count = conn.execute(
            "SELECT COUNT(*) FROM expenses WHERE user_id = ?", (user_id,)
        ).fetchone()[0]
    if count > 0:
        return

    seed_settings(user_id)

    today = date.today()
    y, m  = today.year, today.month

    seeds = [
        ("Global Tech Corp",  "💰Income",          -4200.00, f"{y}-{m:02d}-01",                    "Completed", "DIRECT DEP",  "income"),
        ("Netflix",           "📦 Subscriptions",    15.99,  f"{y}-{m:02d}-{min(today.day,5):02d}", "Completed", "VISA • 4242", "expense"),
        ("Spotify",           "📦 Subscriptions",    10.99,  f"{y}-{m:02d}-{min(today.day,5):02d}", "Completed", "VISA • 4242", "expense"),
        ("Artisan Kitchen",   "🍔Food",               42.00,  f"{y}-{m:02d}-{min(today.day,28):02d}","Pending",   "VISA • 4242", "expense"),
        ("Whole Foods",       "🍔Food",               97.50,  f"{y}-{m:02d}-{min(today.day,20):02d}","Completed", "VISA • 4242", "expense"),
        ("City Power Grid",   "⚡Utilities",          156.40, f"{y}-{m:02d}-{max(1,today.day-1):02d}","Completed","ACH AUTO",    "expense"),
        ("Gym Membership",    "🏥Health",              49.00,  f"{y}-{m:02d}-{min(today.day,8):02d}", "Completed", "VISA • 4242", "expense"),
        ("Adobe Creative",    "📦 Subscriptions",    54.99,  f"{y}-{m:02d}-{min(today.day,10):02d}","Completed", "VISA • 4242", "expense"),
    ]
    for name, cat, amount, d, status, method, txtype in seeds:
        save_expense(
            user_id=user_id, name=name, category=cat, amount=amount,
            expense_date=d, status=status, payment_method=method, transaction_type=txtype,
        )


# Initialize on import
init_db()
