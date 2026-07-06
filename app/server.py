import os
import io
import csv as _csv
from datetime import date, timedelta
from fastapi import FastAPI, HTTPException, UploadFile, File, Request
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional
import uvicorn

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
except ImportError:
    pass

import expense_store
import advisor

# ── Config ────────────────────────────────────────────────────────────────────

# ── Plaid setup (optional) ────────────────────────────────────────────────────

_PLAID_CLIENT_ID = os.environ.get("PLAID_CLIENT_ID", "")
_PLAID_SECRET    = os.environ.get("PLAID_SECRET", "")
_PLAID_ENV       = os.environ.get("PLAID_ENV", "sandbox").lower()
_HAS_PLAID       = bool(_PLAID_CLIENT_ID and _PLAID_SECRET)
_plaid_client    = None

if _HAS_PLAID:
    try:
        from plaid.api import plaid_api
        from plaid.model.link_token_create_request import LinkTokenCreateRequest
        from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
        from plaid.model.transactions_get_request import TransactionsGetRequest
        from plaid.model.transactions_get_request_options import TransactionsGetRequestOptions
        from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
        from plaid.model.products import Products
        from plaid.model.country_code import CountryCode
        from plaid import ApiClient, Configuration, Environment

        _env_map = {"sandbox": Environment.Sandbox, "production": Environment.Production}
        _cfg = Configuration(
            host=_env_map.get(_PLAID_ENV, Environment.Sandbox),
            api_key={"clientId": _PLAID_CLIENT_ID, "secret": _PLAID_SECRET},
        )
        _plaid_client = plaid_api.PlaidApi(ApiClient(_cfg))
    except Exception as _e:
        print(f"[Plaid] Init failed: {_e}")
        _HAS_PLAID = False


app = FastAPI(title="FinTracker API", version="4.0.0")
app.mount("/static", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "static")), name="static")


# ── Current user (single local user, no auth) ─────────────────────────────────

def _current_user(request: Request) -> dict:
    """Return the single local user, creating it on first use."""
    return expense_store.create_or_get_default_user()


# ── App shell ─────────────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
def get_index(request: Request):
    user = expense_store.create_or_get_default_user()
    expense_store.seed_user_data_if_needed(user["id"])
    path = os.path.join(os.path.dirname(__file__), "templates", "index.html")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="index.html not found")
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


# ── Pydantic models ───────────────────────────────────────────────────────────

class ExpenseCreate(BaseModel):
    name: str
    category: str
    amount: float
    date: Optional[str] = None
    status: Optional[str] = "Completed"
    payment_method: Optional[str] = "VISA • 4242"
    transaction_type: Optional[str] = None

class ChatRequest(BaseModel):
    message: str
    ai_brain_mode: Optional[str] = "Balanced"

class SettingsUpdate(BaseModel):
    starting_capital: Optional[float] = None
    monthly_budget: Optional[float] = None
    currency: Optional[str] = None
    ai_brain_mode: Optional[str] = None
    ai_provider: Optional[str] = None

class CancelRequest(BaseModel):
    name: str
    monthly_amount: float

class PlaidExchangeRequest(BaseModel):
    public_token: str


# ── API: me ───────────────────────────────────────────────────────────────────

@app.get("/api/me")
def get_me(request: Request):
    user = expense_store.create_or_get_default_user()
    return {"id": user["id"], "name": user["name"], "email": user["email"], "picture": user["picture"]}


# ── API: core ─────────────────────────────────────────────────────────────────

@app.get("/api/summary")
def get_summary(request: Request):
    u = _current_user(request)
    return expense_store.get_summary_metrics(u["id"])

@app.get("/api/insights")
def get_insights(request: Request):
    _current_user(request)
    return advisor.get_smart_insights()

@app.get("/api/settings")
def get_settings(request: Request):
    u = _current_user(request)
    return expense_store.get_settings(u["id"])

@app.post("/api/settings")
def update_settings(payload: SettingsUpdate, request: Request):
    u = _current_user(request)
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No valid settings provided.")
    return expense_store.save_settings(u["id"], updates)

@app.post("/api/expenses")
def add_expense(expense: ExpenseCreate, request: Request):
    u = _current_user(request)
    try:
        return {"status": "success", "data": expense_store.save_expense(
            user_id=u["id"], name=expense.name, category=expense.category,
            amount=expense.amount, expense_date=expense.date, status=expense.status,
            payment_method=expense.payment_method, transaction_type=expense.transaction_type,
        )}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/expenses")
def clear_expenses(request: Request):
    u = _current_user(request)
    return expense_store.clear_all_expenses(u["id"])

@app.delete("/api/expenses/delete-by-name/{expense_name}")
def delete_expense_by_name(expense_name: str, request: Request):
    u = _current_user(request)
    return expense_store.delete_expense_by_name(u["id"], expense_name)

@app.post("/api/chat")
def post_chat(payload: ChatRequest, request: Request):
    _current_user(request)
    return {"reply": advisor.get_chat_response(payload.message, ai_brain_mode=payload.ai_brain_mode)}

@app.post("/api/chat/stream")
async def post_chat_stream(payload: ChatRequest, request: Request):
    _current_user(request)
    return StreamingResponse(
        advisor.stream_chat_response(payload.message, ai_brain_mode=payload.ai_brain_mode),
        media_type="text/event-stream",
    )

@app.get("/api/export")
def export_ledger(request: Request):
    u = _current_user(request)
    output = io.StringIO()
    writer = _csv.writer(output)
    writer.writerow(["Name", "Category", "Amount", "Date", "Status", "Payment Method", "Type"])
    for e in expense_store.read_expenses(u["id"]):
        writer.writerow([e["name"], e["category"], e["amount"], e["date"],
                         e["status"], e["payment_method"], e["transaction_type"]])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]), media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=FinTracker_Ledger_Export.csv"}
    )


# ── API: subscriptions ────────────────────────────────────────────────────────

@app.get("/api/subscriptions")
def get_subscriptions(request: Request):
    u = _current_user(request)
    return expense_store.get_subscription_analysis(u["id"])

@app.post("/api/subscriptions/cancel")
def cancel_subscription(payload: CancelRequest, request: Request):
    u = _current_user(request)
    expense_store.mark_subscription_cancelled(u["id"], payload.name)
    email_draft = advisor.draft_cancellation_email(payload.name, payload.monthly_amount)
    return {"status": "cancelled", "name": payload.name, "email_draft": email_draft}

@app.post("/api/subscriptions/reactivate")
def reactivate_subscription(payload: CancelRequest, request: Request):
    u = _current_user(request)
    expense_store.unmark_subscription_cancelled(u["id"], payload.name)
    return {"status": "active", "name": payload.name}

@app.post("/api/subscriptions/draft-email")
def draft_cancel_email(payload: CancelRequest, request: Request):
    _current_user(request)
    return {"email_draft": advisor.draft_cancellation_email(payload.name, payload.monthly_amount)}


# ── API: Plaid ────────────────────────────────────────────────────────────────

@app.get("/api/plaid/status")
def plaid_status(request: Request):
    u = _current_user(request)
    settings = expense_store.get_settings(u["id"])
    connected = bool(settings.get("plaid_access_token"))
    return {"configured": _HAS_PLAID, "connected": connected, "env": _PLAID_ENV}

@app.post("/api/plaid/create-link-token")
def create_link_token(request: Request):
    u = _current_user(request)
    if not _HAS_PLAID:
        raise HTTPException(status_code=503, detail="Plaid credentials not configured.")
    try:
        req = LinkTokenCreateRequest(
            products=[Products("transactions")],
            client_name="FinTracker",
            country_codes=[CountryCode("US")],
            language="en",
            user=LinkTokenCreateRequestUser(client_user_id=f"user-{u['id']}"),
        )
        response = _plaid_client.link_token_create(req)
        return {"link_token": response["link_token"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/plaid/exchange-token")
def exchange_public_token(payload: PlaidExchangeRequest, request: Request):
    u = _current_user(request)
    if not _HAS_PLAID:
        raise HTTPException(status_code=503, detail="Plaid not configured.")
    try:
        from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
        response = _plaid_client.item_public_token_exchange(
            ItemPublicTokenExchangeRequest(public_token=payload.public_token)
        )
        expense_store.save_settings(u["id"], {
            "plaid_access_token": response["access_token"],
            "plaid_item_id":      response["item_id"],
        })
        return {"status": "connected", "item_id": response["item_id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/plaid/sync")
def sync_plaid_transactions(request: Request):
    u = _current_user(request)
    if not _HAS_PLAID:
        raise HTTPException(status_code=503, detail="Plaid not configured.")
    settings = expense_store.get_settings(u["id"])
    access_token = settings.get("plaid_access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="No bank account connected yet.")
    try:
        from plaid.model.transactions_get_request import TransactionsGetRequest
        from plaid.model.transactions_get_request_options import TransactionsGetRequestOptions
        end   = date.today()
        start = end - timedelta(days=30)
        response = _plaid_client.transactions_get(TransactionsGetRequest(
            access_token=str(access_token), start_date=start, end_date=end,
            options=TransactionsGetRequestOptions(count=100, offset=0),
        ))
        txns = response["transactions"]
        imported = skipped = 0
        for txn in txns:
            if txn.get("pending"):
                skipped += 1
                continue
            amount   = txn["amount"]
            name     = txn["name"]
            txn_date = str(txn["date"])
            cat_list = txn.get("category") or []
            cat_str  = " ".join(cat_list).lower()

            if "payroll" in cat_str or "deposit" in cat_str or "income" in cat_str:
                category = "💰Income"
            elif "food" in cat_str or "restaurant" in cat_str or "coffee" in cat_str or "grocery" in cat_str:
                category = "🍔Food"
            elif "bar" in cat_str or "nightclub" in cat_str or "alcohol" in cat_str:
                category = "🍺Dining & Bars"
            elif "subscription" in cat_str or "streaming" in cat_str:
                category = "📦 Subscriptions"
            elif "entertainment" in cat_str or "sport" in cat_str:
                category = "🎶Entertainment"
            elif "utilities" in cat_str or "electric" in cat_str or "gas_utility" in cat_str:
                category = "⚡Utilities"
            elif "phone" in cat_str or "internet" in cat_str or "telecommunication" in cat_str:
                category = "📱Phone & Internet"
            elif "health" in cat_str or "medical" in cat_str or "pharmacy" in cat_str:
                category = "🏥Health"
            elif "gym" in cat_str or "fitness" in cat_str:
                category = "🏥Health"
            elif "personal_care" in cat_str or "salon" in cat_str or "spa" in cat_str:
                category = "💅Personal Care"
            elif "pet" in cat_str or "veterinary" in cat_str:
                category = "🐾Pets"
            elif "shop" in cat_str or "retail" in cat_str or "clothing" in cat_str:
                category = "🛍️Shopping"
            elif "travel" in cat_str or "airline" in cat_str or "hotel" in cat_str:
                category = "✈️Travel"
            elif "transport" in cat_str or "taxi" in cat_str or "parking" in cat_str:
                category = "🚗Transportation"
            elif "insurance" in cat_str:
                category = "🏦Insurance"
            elif "home" in cat_str or "furniture" in cat_str or "hardware" in cat_str:
                category = "🏠Home"
            elif "education" in cat_str or "tuition" in cat_str:
                category = "📚Education"
            elif "child" in cat_str or "daycare" in cat_str:
                category = "🧒Childcare"
            elif "gift" in cat_str or "donation" in cat_str:
                category = "🎁Gifts & Giving"
            elif "business" in cat_str or "office" in cat_str:
                category = "💼Business"
            else:
                category = "🤷Miscellaneous"

            if amount < 0:
                category = "💰Income"
                txn_type = "income"
            else:
                txn_type = "expense"

            expense_store.save_expense(
                user_id=u["id"], name=name, category=category,
                amount=amount, expense_date=txn_date,
                status="Completed", payment_method="Bank Import",
                transaction_type=txn_type,
            )
            imported += 1

        return {"status": "synced", "imported": imported, "skipped_pending": skipped}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/plaid/disconnect")
def disconnect_plaid(request: Request):
    u = _current_user(request)
    expense_store.save_settings(u["id"], {"plaid_access_token": "", "plaid_item_id": ""})
    return {"status": "disconnected"}


# ── API: CSV import ───────────────────────────────────────────────────────────

@app.post("/api/import/csv")
async def import_csv(request: Request, file: UploadFile = File(...)):
    u = _current_user(request)
    content = await file.read()
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader  = _csv.DictReader(io.StringIO(text))
    headers = [h.strip().lower() for h in (reader.fieldnames or [])]

    def _col(candidates):
        for c in candidates:
            for h in headers:
                if c in h:
                    return h
        return None

    date_col   = _col(["date", "transaction date", "posted date", "trans. date"])
    desc_col   = _col(["description", "merchant", "payee", "name", "transaction", "memo"])
    amount_col = _col(["amount", "debit", "withdrawal", "charge"])
    credit_col = _col(["credit", "deposit"])

    if not (date_col and desc_col):
        raise HTTPException(status_code=400, detail="Could not detect Date/Description columns.")

    imported = skipped = 0
    for row in reader:
        raw = {k.strip().lower(): v.strip() for k, v in row.items()}
        try:
            txn_date = raw.get(date_col, "").strip()
            name     = raw.get(desc_col, "").strip()
            if not name:
                skipped += 1
                continue

            amount = 0.0
            if amount_col and raw.get(amount_col, ""):
                amount = float(raw[amount_col].replace(",","").replace("$","").replace("(","-").replace(")",""))
            elif credit_col and raw.get(credit_col, ""):
                amount = -abs(float(raw[credit_col].replace(",","").replace("$","")))
            else:
                skipped += 1
                continue

            name_lower = name.lower()
            if any(w in name_lower for w in ["payroll", "direct dep", "salary", "income", "refund"]):
                category = "💰Income"
            elif any(w in name_lower for w in ["restaurant", "mcdonald", "starbucks", "chipotle", "doordash", "grubhub", "ubereats", "food"]):
                category = "🍔Food"
            elif any(w in name_lower for w in ["bar ", "brewery", "nightclub", "cocktail", "tavern"]):
                category = "🍺Dining & Bars"
            elif any(w in name_lower for w in ["netflix", "spotify", "hulu", "disney", "amazon prime", "youtube premium", "apple.com/bill", "icloud", "audible", "dropbox", "adobe", "chatgpt", "openai"]):
                category = "📦 Subscriptions"
            elif any(w in name_lower for w in ["amazon", "walmart", "target", "costco", "best buy", "ebay", "etsy"]):
                category = "🛍️Shopping"
            elif any(w in name_lower for w in ["airline", "delta", "united", "southwest", "airbnb", "hotel", "marriott", "expedia"]):
                category = "✈️Travel"
            elif any(w in name_lower for w in ["uber", "lyft", "taxi", "parking", "shell", "exxon", "chevron", "gas station"]):
                category = "🚗Transportation"
            elif any(w in name_lower for w in ["cvs", "walgreens", "pharmacy", "hospital", "clinic", "doctor", "dentist"]):
                category = "🏥Health"
            elif any(w in name_lower for w in ["gym", "planet fitness", "equinox", "peloton", "fitness", "yoga"]):
                category = "🏥Health"
            elif any(w in name_lower for w in ["salon", "barber", "spa ", "beauty", "nail ", "sephora", "ulta"]):
                category = "💅Personal Care"
            elif any(w in name_lower for w in ["at&t", "verizon", "t-mobile", "comcast", "xfinity", "spectrum"]):
                category = "📱Phone & Internet"
            elif any(w in name_lower for w in ["electric", "gas ", "water ", "utility", "utilities"]):
                category = "⚡Utilities"
            elif any(w in name_lower for w in ["insurance", "geico", "progressive", "state farm", "aetna"]):
                category = "🏦Insurance"
            elif any(w in name_lower for w in ["mortgage", "rent ", "home depot", "lowes", "ikea", "wayfair"]):
                category = "🏠Home"
            elif any(w in name_lower for w in ["invest", "robinhood", "fidelity", "vanguard", "schwab", "coinbase"]):
                category = "💹Investments"
            elif any(w in name_lower for w in ["tuition", "udemy", "coursera", "chegg", "college"]):
                category = "📚Education"
            elif any(w in name_lower for w in ["charity", "donation", "gift card"]):
                category = "🎁Gifts & Giving"
            elif amount < 0:
                category = "💰Income"
            else:
                category = "🤷Miscellaneous"

            expense_store.save_expense(
                user_id=u["id"], name=name, category=category,
                amount=amount, expense_date=txn_date or date.today().isoformat(),
                status="Completed", payment_method="CSV Import",
                transaction_type="income" if amount < 0 else "expense",
            )
            imported += 1
        except Exception:
            skipped += 1

    return {"status": "imported", "imported": imported, "skipped": skipped}


if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8082, reload=True)
