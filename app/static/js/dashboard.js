    // ── Fetch Dashboard Data ──────────────────────────────────
    async function fetchDashboard() {
        try {
            const res     = await fetch('/api/summary');
            const summary = await res.json();
            allExpenses = summary.all_expenses || [];

            if (summary.current_month) currentMonthLabel = summary.current_month;

            const fmt  = (n, d=2) => n.toLocaleString('en-US', {minimumFractionDigits:d, maximumFractionDigits:d});
            const fmtD = n        => n.toLocaleString('en-US', {minimumFractionDigits:0, maximumFractionDigits:0});

            document.getElementById('liquid-capital-display').innerText = `$${fmt(summary.liquid_capital)}`;
            document.getElementById('stat-total-spent').innerText       = `$${fmt(summary.total_spent)}`;
            document.getElementById('stat-daily-budget').innerText      = `$${fmtD(summary.daily_budget)}`;
            document.getElementById('stat-total-income').innerText      = `$${fmt(summary.total_income)}`;
            document.getElementById('stat-remaining-budget').innerText  = `$${fmtD(summary.remaining_budget)}`;
            document.getElementById('donut-total').innerText            = `$${fmtD(summary.total_spent)}`;

            const startingCap = parseFloat((summary.settings || {}).starting_capital || 10000);

            renderActivityFeed(summary.expenses);
            renderCategoryLegend(summary.categories);
            renderCategoryCards(summary.categories);
            drawLiquidCapitalChart(summary.expenses, startingCap);
            drawSpendingDonutChart(summary.categories);
            updateAnalyticsCards(summary);
            drawBurnTrajectoryChart();
            loadAIInsightDashboard();

        } catch (err) {
            console.error('Dashboard fetch error:', err);
        }
    }

    // ── Analytics Cards Update ────────────────────────────────
    function updateAnalyticsCards(summary) {
        const cats = summary.categories || [];
        const FOOD=1500, UTIL=700, ENT=450;
        const find = l => (cats.find(c => c.label === l) || {amount:0}).amount;

        const foodSpent = find('Food & Dining');
        const utilSpent = find('Utilities');
        const entSpent  = find('Lifestyle');

        const setBar = (id, spent, limit) => {
            const el = document.getElementById(id);
            if (el) el.style.width = `${Math.min(100,(spent/limit)*100).toFixed(0)}%`;
        };

        document.getElementById('card-food-spent').innerText = `$${fmtN(foodSpent,0)} / $1,500`;
        document.getElementById('card-util-spent').innerText = `$${fmtN(utilSpent,0)} / $700`;
        document.getElementById('card-ent-spent').innerText  = `$${fmtN(entSpent,0)} / $450`;
        setBar('card-food-bar', foodSpent, FOOD);
        setBar('card-ent-bar', entSpent, ENT);

        if (!limitShiftExecuted) {
            setBar('card-util-bar', utilSpent, UTIL);
            const utilPct = Math.min(100,(utilSpent/UTIL)*100);
            const badge = document.getElementById('card-util-badge');
            if (badge) {
                if (utilPct >= 90) {
                    badge.innerText = 'High Risk';
                    badge.className = 'text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-200';
                } else if (utilPct >= 70) {
                    badge.innerText = 'Moderate';
                    badge.className = 'text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-200';
                } else {
                    badge.innerText = 'On Track';
                    badge.className = 'text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-200';
                }
            }
        }

        const setAlt = (baseId, spent, limit) => {
            const txt = document.getElementById(baseId+'-a');
            const bar = document.getElementById(baseId+'-bar-a');
            if (txt) txt.innerText = `$${fmtN(spent,0)} / $${limit.toLocaleString()}`;
            if (bar) bar.style.width = `${Math.min(100,(spent/limit)*100).toFixed(0)}%`;
        };
        setAlt('card-food-spent', foodSpent, FOOD);
        setAlt('card-util-spent', utilSpent, UTIL);
        setAlt('card-ent-spent',  entSpent,  ENT);

        const surplus = (summary.remaining_budget != null) ? summary.remaining_budget : 0;
        document.getElementById('prediction-surplus').innerText = surplus >= 0 ? `+$${surplus.toFixed(2)}` : `-$${Math.abs(surplus).toFixed(2)}`;
    }

    function fmtN(n, d=2) {
        return n.toLocaleString('en-US', {minimumFractionDigits:d, maximumFractionDigits:d});
    }

    // ── Category Cards Grid (Dashboard) ──────────────────────
    function getCategoryColor(colorKey) {
        return {
            'food-orange':    '#f97316',
            'education-purple':'#8b5cf6',
            'home-green':     '#10b981',
            'utilities-blue': '#3b82f6',
            'danger-red':     '#f43f5e',
            'sky-blue':       '#0ea5e9',
            'pink':           '#ec4899',
            'amber':          '#f59e0b',
            'outline':        '#94a3b8',
        }[colorKey] || '#0d9488';
    }

    function renderCategoryCards(categories) {
        const grid = document.getElementById('category-cards-grid');
        if (!categories || categories.length === 0) {
            grid.innerHTML = '<div class="g1 rounded-xl p-4 col-span-4 text-center text-slate-400 text-xs py-6">No spending data yet</div>';
            return;
        }
        grid.innerHTML = '';
        const maxAmt = Math.max(...categories.map(c => c.amount), 1);
        categories.forEach(c => {
            const color = getCategoryColor(c.color);
            const pct   = Math.min(100, (c.amount / maxAmt) * 100);
            const card  = document.createElement('div');
            card.className = 'g1 rounded-xl p-4 space-y-2.5 fade-up shadow-sm';
            card.innerHTML = `
                <div class="flex items-center gap-2">
                    <div class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style="background:${color}18">
                        <span class="material-symbols-outlined text-sm" style="color:${color};font-variation-settings:'FILL' 1">${c.icon}</span>
                    </div>
                    <span class="text-[10px] font-bold text-slate-500 truncate">${c.label}</span>
                </div>
                <div class="text-base font-black text-slate-900 font-outfit">$${fmtN(c.amount,0)}</div>
                <div class="pbar"><div class="pbar-fill" style="width:${pct}%;background:${color}"></div></div>
            `;
            grid.appendChild(card);
        });
    }

    // ── Activity Feed ─────────────────────────────────────────
    function renderActivityFeed(expenses) {
        const feed = document.getElementById('activity-feed');
        feed.innerHTML = '';
        if (!expenses || expenses.length === 0) {
            feed.innerHTML = '<p class="text-slate-400 text-xs text-center py-6">No recent transactions.</p>';
            return;
        }
        expenses.forEach(e => {
            const color    = getCategoryColor(e.color);
            const isIncome = e.amount < 0;
            const displayAmt = isIncome ? `+$${Math.abs(e.amount).toFixed(2)}` : `-$${parseFloat(e.amount).toFixed(2)}`;
            const amtColor   = isIncome ? '#059669' : '#1e293b';

            let formattedDate = e.date;
            try {
                const d = new Date(e.date + 'T00:00:00');
                if (!isNaN(d)) formattedDate = d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
            } catch(_) {}

            const card = document.createElement('div');
            card.className = 'flex justify-between items-center p-3 rounded-xl transition-all hover:g2 cursor-default';
            card.style.cssText = 'background:rgba(255,255,255,0.6);border:1px solid rgba(0,0,0,0.06)';
            card.innerHTML = `
                <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style="background:${color}15">
                        <span class="material-symbols-outlined text-base" style="color:${color};font-variation-settings:'FILL' 1">${e.icon}</span>
                    </div>
                    <div>
                        <div class="flex items-center gap-1.5">
                            <span class="font-bold text-[11px] text-slate-800">${e.name}</span>
                            ${e.status==='Pending' ? '<span class="text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-200">Pending</span>' : ''}
                        </div>
                        <span class="text-[9px] text-slate-400 font-semibold">${e.category_display} · ${formattedDate}</span>
                    </div>
                </div>
                <div class="text-right shrink-0">
                    <span class="font-bold text-[11px]" style="color:${amtColor}">${displayAmt}</span>
                    <div class="text-[8px] text-slate-400 font-bold uppercase tracking-wide mt-0.5">${e.payment_method}</div>
                </div>
            `;
            feed.appendChild(card);
        });
    }

    // ── Category Legend (Analytics) ───────────────────────────
    function renderCategoryLegend(categories) {
        const legend = document.getElementById('category-legend');
        legend.innerHTML = '';
        if (!categories || categories.length === 0) {
            legend.innerHTML = '<p class="text-slate-400 text-[10px] text-center">No categories.</p>';
            return;
        }
        categories.forEach(c => {
            const color = getCategoryColor(c.color);
            const row   = document.createElement('div');
            row.className = 'flex items-center justify-between text-[11px] py-1.5 last:border-0';
            row.style.cssText = 'border-bottom:1px solid rgba(0,0,0,0.05)';
            row.innerHTML = `
                <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full shrink-0" style="background:${color}"></span>
                    <span class="text-slate-600 font-medium">${c.label}</span>
                </div>
                <span class="font-bold text-slate-900">$${fmtN(c.amount)}</span>
            `;
            legend.appendChild(row);
        });
    }

    // ── Subscription Audit ────────────────────────────────────
    function renderSubscriptionAuditList() {
        const container = document.getElementById('subscription-audit-list');
        container.innerHTML = '';
        const subs = allExpenses.filter(e =>
            e.category === '📦 Subscriptions' ||
            ['netflix','spotify','hulu','disney','apple','amazon'].some(s => e.name.toLowerCase().includes(s))
        );
        if (subs.length === 0) {
            container.innerHTML = '<div class="text-center py-8"><span class="material-symbols-outlined text-3xl text-slate-300">playlist_add_check</span><p class="text-slate-400 text-xs mt-2">No subscriptions detected.</p></div>';
            return;
        }
        subs.forEach(sub => {
            const item = document.createElement('div');
            item.className = 'flex justify-between items-center p-3.5 rounded-xl transition-all';
            item.style.cssText = 'background:rgba(255,255,255,0.45);border:1px solid rgba(255,255,255,0.65)';
            item.innerHTML = `
                <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-xl flex items-center justify-center" style="background:rgba(124,58,237,0.08)">
                        <span class="material-symbols-outlined text-purple-500 text-sm">subscriptions</span>
                    </div>
                    <div>
                        <span class="font-bold text-[11px] text-slate-800 block">${sub.name}</span>
                        <span class="text-[9px] text-slate-400">${sub.payment_method} · $${sub.amount.toFixed(2)}/mo</span>
                    </div>
                </div>
                <button onclick="handleMockCancelSubscription('${sub.name}', this)" class="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all text-rose-600" style="background:rgba(225,29,72,0.06);border:1px solid rgba(225,29,72,0.18)">
                    Cancel
                </button>
            `;
            container.appendChild(item);
        });
    }

    async function handleMockCancelSubscription(name, btn) {
        if (!confirm(`Remove '${name}' from your records?`)) return;
        btn.disabled = true; btn.innerText = '…';
        try {
            const res  = await fetch(`/api/expenses/delete-by-name/${encodeURIComponent(name)}`, {method:'DELETE'});
            const data = await res.json();
            if (data.status === 'success') {
                showToast(`Removed '${name}'.`, 'success');
                await fetchDashboard();
                renderSubscriptionAuditList();
            } else {
                showToast('Error: ' + data.message, 'error');
                btn.disabled = false; btn.innerText = 'Cancel';
            }
        } catch(err) {
            showToast('Failed to remove.', 'error');
            btn.disabled = false; btn.innerText = 'Cancel';
        }
    }

    // ── Transactions Table ────────────────────────────────────
    function renderTransactionsViewTable() {
        const body = document.getElementById('ledger-rows-body');
        body.innerHTML = '';
        if (!allExpenses || allExpenses.length === 0) {
            body.innerHTML = '<tr><td colspan="6" class="text-center py-10 text-slate-400 text-xs">No transactions in ledger.</td></tr>';
            return;
        }
        allExpenses.forEach(e => {
            const color    = getCategoryColor(e.color);
            const isIncome = e.amount < 0;
            const dispAmt  = isIncome ? `+$${Math.abs(e.amount).toFixed(2)}` : `-$${parseFloat(e.amount).toFixed(2)}`;
            const amtClass = isIncome ? 'font-bold text-success-green' : 'font-bold text-slate-800';
            const tr = document.createElement('tr');
            tr.style.cssText = 'border-bottom:1px solid rgba(0,0,0,0.04)';
            tr.innerHTML = `
                <td class="py-3.5 px-5 font-bold text-slate-800">
                    <div class="flex items-center gap-2.5">
                        <div class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style="background:${color}15">
                            <span class="material-symbols-outlined text-sm" style="color:${color};font-variation-settings:'FILL' 1">${e.icon}</span>
                        </div>
                        <span class="text-[11px]">${e.name}</span>
                    </div>
                </td>
                <td class="py-3.5 px-4 text-slate-500 text-[11px] hidden md:table-cell">${e.category_display}</td>
                <td class="py-3.5 px-4 text-slate-500 text-[11px] hidden lg:table-cell">${e.date}</td>
                <td class="py-3.5 px-4 text-slate-500 text-[11px] uppercase hidden lg:table-cell">${e.payment_method}</td>
                <td class="py-3.5 px-4 hidden md:table-cell">
                    <span class="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${e.status==='Completed' ? 'bg-emerald-50 text-success-green border border-emerald-200' : 'bg-amber-50 text-warning-orange border border-amber-200'}">${e.status}</span>
                </td>
                <td class="py-3.5 px-5 text-right text-[11px] ${amtClass}">${dispAmt}</td>
            `;
            body.appendChild(tr);
        });
    }

