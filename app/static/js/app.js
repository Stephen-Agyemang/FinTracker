    // ── Globals ──────────────────────────────────────────────
    let liquidChartInstance     = null;
    let donutChartInstance      = null;
    let trajectoryChartInstance = null;
    let currentView             = 'dashboard';
    let allExpenses             = [];
    let currentMonthLabel       = 'This Month';
    let currentAiBrainMode      = 'Balanced';
    let currentAiProvider       = 'gemini';
    let currentTransactionType  = 'expense';
    let limitShiftExecuted      = false;

    // ── View Router ──────────────────────────────────────────
    function switchView(viewName, element) {
        currentView = viewName;

        document.querySelectorAll('#sidebar-nav .nav-link').forEach(n => n.classList.remove('nav-link-active'));
        if (element) element.classList.add('nav-link-active');

        ['dashboard','analytics','portfolio','transactions','settings','subscriptions','bank'].forEach(v => {
            const el = document.getElementById(`view-${v}`);
            if (el) { el.classList.add('hidden'); el.classList.remove('block'); }
        });
        const active = document.getElementById(`view-${viewName}`);
        if (active) { active.classList.remove('hidden'); active.classList.add('block'); }

        const titles = {
            dashboard:     ['Dashboard',           'Financial overview — ' + currentMonthLabel],
            analytics:     ['Budget Insights',     'AI overview & analytics'],
            portfolio:     ['Asset Holdings',      'Investment & goal tracking'],
            transactions:  ['Transaction Ledger',  'Complete spending history'],
            settings:      ['Settings Control',    'Configure preferences'],
            subscriptions: ['Subscriptions',       'Detect & cancel recurring charges'],
            bank:          ['Bank Connection',     'Powered by Plaid'],
        };
        const [title, sub] = titles[viewName] || ['FinTracker', ''];
        document.getElementById('view-title').innerText    = title;
        document.getElementById('view-subtitle').innerText = sub;

        if (window.innerWidth < 768) closeMobileSidebar();

        if (viewName === 'analytics')       drawBurnTrajectoryChart();
        else if (viewName === 'dashboard')  fetchDashboard();
        else if (viewName === 'subscriptions') fetchSubscriptions();
        else if (viewName === 'bank')       fetchBankStatus();
        else if (viewName === 'transactions') {
            if (allExpenses.length === 0) fetchDashboard().then(() => renderTransactionsViewTable());
            else renderTransactionsViewTable();
        }
    }

    // ── Drawer Toggles ────────────────────────────────────────
    function toggleChatDrawer(open) {
        document.getElementById('chat-drawer').classList.toggle('translate-x-full', !open);
    }
    function toggleHistoryDrawer(open) {
        document.getElementById('history-drawer').classList.toggle('-translate-x-full', !open);
    }

    // ── Transaction Type Toggle ───────────────────────────────
    function setTransactionType(type) {
        currentTransactionType = type;
        const expBtn = document.getElementById('type-expense-btn');
        const incBtn = document.getElementById('type-income-btn');
        const cat    = document.getElementById('rec-category');
        const sub    = document.getElementById('rec-submit-btn');

        if (type === 'income') {
            expBtn.style.cssText = 'background:#f8fafc;border:1px solid #e2e8f0';
            expBtn.className = 'py-2.5 rounded-xl font-bold transition-all text-slate-500 bg-slate-50 border border-slate-200';
            incBtn.style.cssText = 'background:#059669;border:1px solid #059669';
            incBtn.className = 'py-2.5 rounded-xl font-bold transition-all text-white';
            cat.innerHTML = `<option value="💰Income">💰 Income</option><option value="🤷Miscellaneous">🤷 Miscellaneous</option>`;
            sub.innerText = 'Save Income';
            sub.style.cssText = 'background:#059669';
            sub.className = 'w-full text-white font-black py-3.5 rounded-xl mt-1 hover:opacity-90 transition-all font-outfit uppercase tracking-wider';
        } else {
            expBtn.style.cssText = 'background:#0d9488;border:1px solid #0d9488';
            expBtn.className = 'py-2.5 rounded-xl font-bold transition-all text-white';
            incBtn.style.cssText = '';
            incBtn.className = 'py-2.5 rounded-xl font-bold transition-all text-slate-500 bg-slate-50 border border-slate-200';
            cat.innerHTML = `
                <option value="🍔Food">🍔 Food & Dining</option>
                <option value="🍺Dining & Bars">🍺 Dining & Bars</option>
                <option value="🛍️Shopping">🛍️ Shopping & Retail</option>
                <option value="✈️Travel">✈️ Travel</option>
                <option value="🚗Transportation">🚗 Transportation</option>
                <option value="🏥Health">🏥 Health & Fitness</option>
                <option value="💅Personal Care">💅 Personal Care</option>
                <option value="🐾Pets">🐾 Pets</option>
                <option value="📦 Subscriptions">📦 Subscriptions</option>
                <option value="📱Phone & Internet">📱 Phone & Internet</option>
                <option value="⚡Utilities">⚡ Utilities</option>
                <option value="🏠Home">🏠 Home</option>
                <option value="🏦Insurance">🏦 Insurance</option>
                <option value="💼Business">💼 Business & Work</option>
                <option value="💹Investments">💹 Savings & Investments</option>
                <option value="📚Education">📚 Education</option>
                <option value="🎶Entertainment">🎶 Entertainment</option>
                <option value="🎁Gifts & Giving">🎁 Gifts & Giving</option>
                <option value="🧒Childcare">🧒 Childcare</option>
                <option value="🤷Miscellaneous">🤷 Miscellaneous</option>
            `;
            sub.innerText = 'Save Transaction';
            sub.style.cssText = 'background:#0d9488';
            sub.className = 'w-full text-white font-black py-3.5 rounded-xl mt-1 hover:opacity-90 transition-all font-outfit uppercase tracking-wider';
        }
    }

    // ── Add Transaction Modal ─────────────────────────────────
    function toggleModal(open) {
        const modal = document.getElementById('record-modal');
        const inner = modal.querySelector('div');
        if (open) {
            document.getElementById('rec-date').value = new Date().toISOString().split('T')[0];
            setTransactionType('expense');
            modal.classList.remove('hidden');
            setTimeout(() => { modal.classList.remove('opacity-0'); inner.classList.remove('scale-95'); }, 10);
        } else {
            modal.classList.add('opacity-0'); inner.classList.add('scale-95');
            setTimeout(() => modal.classList.add('hidden'), 300);
        }
    }

    // ── Subscription Modal ────────────────────────────────────
    function toggleSubscriptionModal(open) {
        const modal = document.getElementById('subscription-modal');
        const inner = modal.querySelector('div');
        if (open) {
            renderSubscriptionAuditList();
            modal.classList.remove('hidden');
            setTimeout(() => { modal.classList.remove('opacity-0'); inner.classList.remove('scale-95'); }, 10);
        } else {
            modal.classList.add('opacity-0'); inner.classList.add('scale-95');
            setTimeout(() => modal.classList.add('hidden'), 300);
        }
    }

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

    // ── Charts ────────────────────────────────────────────────
    function drawLiquidCapitalChart(expenses, startingCap) {
        const ctx = document.getElementById('liquidCapitalChart').getContext('2d');
        if (liquidChartInstance) liquidChartInstance.destroy();

        const grad = ctx.createLinearGradient(0,0,0,180);
        grad.addColorStop(0, 'rgba(13,148,136,0.15)');
        grad.addColorStop(1, 'rgba(13,148,136,0)');

        const now  = new Date();
        const year = now.getFullYear(), month = now.getMonth();
        const dim  = new Date(year, month+1, 0).getDate();
        const pad  = n => String(n).padStart(2,'0');
        const abbr = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][month];
        const checkDays = [1,8,15,22,dim];
        const labels    = checkDays.map(d => `${abbr} ${pad(d)}`);

        let cap = startingCap || 10000;
        const db = {};
        for (let d=1; d<=dim; d++) db[`${year}-${pad(month+1)}-${pad(d)}`] = cap;

        [...expenses].sort((a,b) => new Date(a.date)-new Date(b.date)).forEach(e => {
            let acc=0; acc += parseFloat(e.amount);
            const bal = cap - acc;
            const day = parseInt(e.date.split('-')[2]);
            if (!isNaN(day)) for (let d=day; d<=dim; d++) db[`${year}-${pad(month+1)}-${pad(d)}`] = bal;
        });

        const data = checkDays.map(d => db[`${year}-${pad(month+1)}-${pad(d)}`] || cap);

        liquidChartInstance = new Chart(ctx, {
            type: 'line',
            data: { labels, datasets: [{ data, borderColor:'#0d9488', borderWidth:2, fill:true, backgroundColor:grad, tension:0.4, pointBackgroundColor:'#f0f2f8', pointBorderColor:'#0d9488', pointBorderWidth:1.5, pointRadius:3, pointHoverRadius:5 }] },
            options: {
                responsive:true, maintainAspectRatio:false,
                plugins: { legend:{display:false}, tooltip:{ callbacks:{ label: ctx => ` $${ctx.raw.toLocaleString('en-US',{minimumFractionDigits:2})}` } } },
                scales: {
                    x: { grid:{display:false}, ticks:{font:{family:'Manrope',size:9},color:'#94a3b8'} },
                    y: { display:false, grid:{display:false} }
                }
            }
        });
    }

    function drawSpendingDonutChart(categories) {
        const ctx = document.getElementById('spendingDonutChart').getContext('2d');
        if (donutChartInstance) donutChartInstance.destroy();

        if (!categories || categories.length === 0) {
            donutChartInstance = new Chart(ctx, {
                type:'doughnut',
                data: { labels:['No expenses'], datasets:[{data:[1], backgroundColor:['rgba(0,0,0,0.05)'], borderWidth:0}] },
                options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}} }
            });
            return;
        }

        const colors = categories.map(c => getCategoryColor(c.color));
        donutChartInstance = new Chart(ctx, {
            type:'doughnut',
            data: { labels:categories.map(c=>c.label), datasets:[{ data:categories.map(c=>c.amount), backgroundColor:colors.map(c=>c+'dd'), borderColor:'#ffffff', borderWidth:2, hoverOffset:6 }] },
            options: {
                responsive:true, maintainAspectRatio:false, cutout:'72%',
                plugins: { legend:{display:false}, tooltip:{ callbacks:{ label: ctx => ` ${ctx.label}: $${ctx.raw.toLocaleString('en-US',{minimumFractionDigits:2})}` } } }
            }
        });
    }

    function drawBurnTrajectoryChart() {
        const ctx = document.getElementById('burnTrajectoryChart').getContext('2d');
        if (trajectoryChartInstance) trajectoryChartInstance.destroy();

        const grad = ctx.createLinearGradient(0,0,0,200);
        grad.addColorStop(0,'rgba(13,148,136,0.12)');
        grad.addColorStop(1,'rgba(13,148,136,0)');

        let labels, actualSpent, predictedSpent;
        const posExpenses = allExpenses.filter(e => parseFloat(e.amount) > 0);

        if (posExpenses.length > 0) {
            const sorted = [...posExpenses].sort((a,b) => new Date(a.date)-new Date(b.date));
            const first  = new Date(sorted[0].date+'T00:00:00');
            const latest = new Date(sorted[sorted.length-1].date+'T00:00:00');
            const year   = first.getFullYear(), month = first.getMonth();
            const dim    = new Date(year, month+1, 0).getDate();
            const start  = new Date(year, month, 1);
            const days   = [1,8,15,22,Math.min(29,dim)];
            const cps    = days.map(d => new Date(year, month, d));
            labels        = cps.map(d => d.toLocaleDateString('en-US',{month:'short',day:'numeric'}));
            actualSpent   = []; predictedSpent = [];
            let lastVal=0, lastIdx=-1;
            cps.forEach((cp,i) => {
                const cum = sorted.filter(e => new Date(e.date+'T00:00:00')<=cp).reduce((s,e)=>s+parseFloat(e.amount),0);
                if (cp<=latest) { actualSpent.push(parseFloat(cum.toFixed(2))); predictedSpent.push(null); lastVal=cum; lastIdx=i; }
                else            { actualSpent.push(null); predictedSpent.push(null); }
            });
            if (lastIdx>=0 && lastIdx<cps.length-1) {
                predictedSpent[lastIdx] = parseFloat(lastVal.toFixed(2));
                const elapsed = Math.max(1,(cps[lastIdx]-start)/86400000);
                const burn    = lastVal/elapsed;
                for (let i=lastIdx+1; i<cps.length; i++) {
                    predictedSpent[i] = parseFloat((burn*(cps[i]-start)/86400000).toFixed(2));
                }
            }
        }

        if (!labels) {
            const n=new Date(), m=n.getMonth(), y=n.getFullYear(), dm=new Date(y,m+1,0).getDate();
            const a=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m];
            const p=n=>String(n).padStart(2,'0');
            labels=[1,8,15,22,dm].map(d=>`${a} ${p(d)}`);
            actualSpent=[0,0,0,0,null]; predictedSpent=[null,null,null,0,0];
        }

        trajectoryChartInstance = new Chart(ctx, {
            type:'line',
            data: { labels, datasets: [
                { label:'Actual Spent', data:actualSpent, borderColor:'#0d9488', borderWidth:2.5, fill:true, backgroundColor:grad, tension:0.45, pointBackgroundColor:'#f0f2f8', pointBorderColor:'#0d9488', pointBorderWidth:1.5, pointRadius:3.5, pointHoverRadius:6, spanGaps:false },
                { label:'Projected',   data:predictedSpent, borderColor:'rgba(124,58,237,0.6)', borderWidth:2, borderDash:[5,4], fill:false, tension:0.35, pointBackgroundColor:'#f0f2f8', pointBorderColor:'rgba(124,58,237,0.6)', pointRadius:3, spanGaps:false }
            ]},
            options: {
                responsive:true, maintainAspectRatio:false,
                plugins: {
                    legend:{ display:true, position:'top', labels:{ boxWidth:10, color:'#64748b', font:{family:'Manrope',size:10,weight:600} } },
                    tooltip:{ mode:'index', intersect:false }
                },
                scales: {
                    x: { grid:{color:'rgba(0,0,0,0.04)'}, ticks:{font:{family:'Manrope',size:9,weight:600},color:'#94a3b8'} },
                    y: { grid:{color:'rgba(0,0,0,0.04)'}, ticks:{font:{family:'Manrope',size:9},color:'#94a3b8'} }
                }
            }
        });
    }

    // ── Form Handlers ─────────────────────────────────────────
    async function handleRecordSubmit(e) {
        e.preventDefault();
        const name           = document.getElementById('rec-name').value;
        const rawAmount      = parseFloat(document.getElementById('rec-amount').value);
        const category       = document.getElementById('rec-category').value;
        const payment_method = document.getElementById('rec-payment').value;
        const status         = document.getElementById('rec-status').value;
        const date           = document.getElementById('rec-date').value || null;
        const transaction_type = currentTransactionType;
        const amount           = transaction_type === 'income' ? -Math.abs(rawAmount) : Math.abs(rawAmount);

        try {
            const res  = await fetch('/api/expenses', {
                method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({name, amount, category, payment_method, status, date, transaction_type})
            });
            const data = await res.json();
            if (data.status === 'success') {
                showToast(transaction_type === 'income' ? 'Income recorded!' : 'Transaction logged!', 'success');
                toggleModal(false);
                document.getElementById('rec-name').value   = '';
                document.getElementById('rec-amount').value = '';
                await fetchDashboard();
                if (currentView === 'transactions') renderTransactionsViewTable();
            } else {
                showToast('Error: ' + data.detail, 'error');
            }
        } catch(err) {
            showToast('Failed to submit.', 'error');
        }
    }

    // ── Chat ──────────────────────────────────────────────────
    async function handleChatSubmit(e) {
        e.preventDefault();
        const input = document.getElementById('chat-input');
        const msg   = input.value.trim();
        if (!msg) return;
        input.value = '';
        appendChatBubble(msg, 'user');

        const typing = document.getElementById('typing-indicator');
        typing.classList.remove('hidden');
        scrollChatBottom();

        try {
            const res  = await fetch('/api/chat', {
                method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({message: msg, ai_brain_mode: currentAiBrainMode})
            });
            const data = await res.json();
            typing.classList.add('hidden');
            appendChatBubble(data.reply, 'bot');
        } catch(err) {
            typing.classList.add('hidden');
            appendChatBubble("I'm having trouble connecting right now.", 'bot');
        }
        scrollChatBottom();
    }

    function formatChatText(text) {
        return text.replace(/\*\*(.+?)\*\*/g, '<strong class="text-slate-900 font-extrabold">$1</strong>');
    }

    function appendChatBubble(text, sender) {
        const container = document.getElementById('chat-messages');
        const typing    = document.getElementById('typing-indicator');
        const bubble    = document.createElement('div');

        if (sender === 'user') {
            bubble.className = 'flex items-start gap-3 max-w-[85%] self-end flex-row-reverse fade-up';
            bubble.innerHTML = `
                <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style="background:linear-gradient(135deg,#7c3aed,#4f46e5)">
                    <span class="material-symbols-outlined text-white text-xs">person</span>
                </div>
                <div class="rounded-2xl rounded-tr-sm p-3.5 text-[12px] leading-relaxed text-white" style="background:#7c3aed">${text}</div>
            `;
        } else {
            bubble.className = 'flex items-start gap-3 max-w-[85%] fade-up';
            bubble.innerHTML = `
                <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style="background:rgba(124,58,237,0.1)">
                    <span class="material-symbols-outlined text-purple-600 text-sm" style="font-variation-settings:'FILL' 1">psychology</span>
                </div>
                <div class="g1 rounded-2xl rounded-tl-sm p-3.5 text-[12px] text-slate-700 leading-relaxed shadow-sm">${formatChatText(text)}</div>
            `;
        }
        container.insertBefore(bubble, typing);
    }

    function scrollChatBottom() {
        const c = document.getElementById('chat-messages');
        c.scrollTop = c.scrollHeight;
    }

    // ── AI Insight Loaders ────────────────────────────────────
    async function loadAIInsightDashboard() {
        try {
            const res  = await fetch('/api/insights');
            const data = await res.json();
            const el   = document.getElementById('ai-insight-text');
            if (el && data.insight) el.innerText = data.insight;
        } catch(_) {}
    }

    async function loadAIInsights() {
        const el = document.getElementById('analytics-ai-insight');
        if (el) el.innerText = 'Analyzing your spending patterns…';
        try {
            const res  = await fetch('/api/insights');
            const data = await res.json();
            if (el && data.insight) el.innerText = data.insight;
        } catch(_) {
            if (el) el.innerText = 'AI insights temporarily unavailable.';
        }
    }

    // ── Portfolio Calculator ──────────────────────────────────
    function updateGoalCalc(val) {
        document.getElementById('goal-val-display').innerText = `$${parseInt(val).toLocaleString()}`;
        const months = Math.ceil(parseInt(val) / 1050);
        document.getElementById('goal-months-needed').innerText = `${months} Month${months===1?'':'s'}`;
    }

    // ── Settings ──────────────────────────────────────────────
    async function saveSettingsConfig() {
        const cap   = parseFloat(document.getElementById('set-starting-cap').value);
        const limit = parseFloat(document.getElementById('set-spending-limit').value);
        const updates = { ai_brain_mode: currentAiBrainMode, ai_provider: currentAiProvider };
        if (!isNaN(cap))   updates.starting_capital = cap;
        if (!isNaN(limit)) updates.monthly_budget   = limit;
        try {
            await fetch('/api/settings', {
                method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify(updates)
            });
            showToast('Settings saved!', 'success');
            fetchDashboard();
        } catch(err) {
            showToast('Failed to save settings.', 'error');
        }
    }

    function selectProvider(provider, btn) {
        currentAiProvider = provider;
        const geminiBtn = document.getElementById('provider-gemini-btn');
        const claudeBtn = document.getElementById('provider-claude-btn');
        if (geminiBtn && claudeBtn) {
            geminiBtn.className = 'g1 rounded-xl p-3 text-xs font-bold text-slate-500 hover:text-slate-700 transition-all flex items-center justify-center gap-1.5';
            geminiBtn.style.cssText = '';
            claudeBtn.className = 'g1 rounded-xl p-3 text-xs font-bold text-slate-500 hover:text-slate-700 transition-all flex items-center justify-center gap-1.5';
            claudeBtn.style.cssText = '';
            const active = provider === 'gemini' ? geminiBtn : claudeBtn;
            active.className    = 'rounded-xl p-3 text-xs font-bold text-emerald-700 transition-all flex items-center justify-center gap-1.5';
            active.style.cssText = 'background:rgba(5,150,105,0.08);border:1px solid rgba(5,150,105,0.2)';
        }
        showToast(`Provider: ${provider.charAt(0).toUpperCase()+provider.slice(1)}`, 'success');
    }

    function selectBrainMode(mode, btn) {
        currentAiBrainMode = mode.charAt(0).toUpperCase() + mode.slice(1);
        btn.parentNode.querySelectorAll('button').forEach(b => {
            b.className    = 'g1 rounded-xl p-3 text-xs font-bold text-slate-500 hover:text-slate-700 transition-all';
            b.style.cssText = '';
        });
        btn.className    = 'rounded-xl p-3 text-xs font-bold text-purple-700 transition-all';
        btn.style.cssText = 'background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.2)';
        showToast(`AI mode: ${currentAiBrainMode}`, 'success');
    }

    async function loadSettings() {
        try {
            const res      = await fetch('/api/settings');
            const settings = await res.json();
            const capInput = document.getElementById('set-starting-cap');
            const limInput = document.getElementById('set-spending-limit');
            if (capInput && settings.starting_capital != null) capInput.value = settings.starting_capital;
            if (limInput && settings.monthly_budget != null)   limInput.value = settings.monthly_budget;
            if (settings.ai_brain_mode) {
                currentAiBrainMode = settings.ai_brain_mode;
                document.querySelectorAll('[onclick^="selectBrainMode"]').forEach(btn => {
                    const mArg = btn.getAttribute('onclick').match(/'([^']+)'/)?.[1] || '';
                    if (mArg.toLowerCase() === currentAiBrainMode.toLowerCase()) {
                        btn.className    = 'rounded-xl p-3 text-xs font-bold text-purple-700 transition-all';
                        btn.style.cssText = 'background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.2)';
                    } else {
                        btn.className    = 'g1 rounded-xl p-3 text-xs font-bold text-slate-500 hover:text-slate-700 transition-all';
                        btn.style.cssText = '';
                    }
                });
            }
            if (settings.ai_provider) {
                currentAiProvider = settings.ai_provider;
                const geminiBtn = document.getElementById('provider-gemini-btn');
                const claudeBtn = document.getElementById('provider-claude-btn');
                if (geminiBtn && claudeBtn) {
                    const active   = currentAiProvider === 'claude' ? claudeBtn : geminiBtn;
                    const inactive = currentAiProvider === 'claude' ? geminiBtn : claudeBtn;
                    active.className    = 'rounded-xl p-3 text-xs font-bold text-emerald-700 transition-all flex items-center justify-center gap-1.5';
                    active.style.cssText = 'background:rgba(5,150,105,0.08);border:1px solid rgba(5,150,105,0.2)';
                    inactive.className    = 'g1 rounded-xl p-3 text-xs font-bold text-slate-500 hover:text-slate-700 transition-all flex items-center justify-center gap-1.5';
                    inactive.style.cssText = '';
                }
            }
        } catch(err) { console.error('loadSettings error:', err); }
    }

    // ── Misc Handlers ─────────────────────────────────────────
    function handleGlobalSearch() {
        const q = document.getElementById('insights-global-search').value.toLowerCase().trim();
        showToast(`Filtering: "${q}"`, 'info');
    }

    async function handleClearLedger() {
        if (!confirm('Clear ALL transactions from fintracker.db? This cannot be undone.')) return;
        try {
            const res  = await fetch('/api/expenses', {method:'DELETE'});
            const data = await res.json();
            if (data.status === 'success') {
                showToast('All records cleared.', 'success');
                await fetchDashboard();
                if (currentView === 'transactions') renderTransactionsViewTable();
            } else {
                showToast('Error: ' + data.message, 'error');
            }
        } catch(err) {
            showToast('Failed to clear records.', 'error');
        }
    }

    // ── Mobile sidebar ────────────────────────────────────
    function openMobileSidebar() {
        document.getElementById('app-sidebar').classList.add('sidebar-open');
        document.getElementById('sidebar-overlay').classList.add('visible');
    }
    function closeMobileSidebar() {
        document.getElementById('app-sidebar').classList.remove('sidebar-open');
        document.getElementById('sidebar-overlay').classList.remove('visible');
    }

    // ══════════════════════════════════════════════════════
    //  SUBSCRIPTIONS
    // ══════════════════════════════════════════════════════

    let _activeCancelTarget = null; // { name, monthly_cost, cancel_url }

    async function fetchSubscriptions() {
        try {
            const res  = await fetch('/api/subscriptions');
            const data = await res.json();
            renderSubscriptionCards(data);
        } catch(err) {
            showToast('Failed to load subscriptions.', 'error');
        }
    }

    function renderSubscriptionCards(data) {
        document.getElementById('sub-total-monthly').innerText  = `$${fmtN(data.total_monthly)}`;
        document.getElementById('sub-total-annual').innerText   = `$${fmtN(data.total_annual, 0)} / year`;
        document.getElementById('sub-active-count').innerText   = data.active_count;
        document.getElementById('sub-cancelled-count').innerText = data.cancelled_count;

        const grid = document.getElementById('sub-cards-grid');
        grid.innerHTML = '';

        if (!data.subscriptions || data.subscriptions.length === 0) {
            grid.innerHTML = `
                <div class="g1 rounded-xl p-8 col-span-2 text-center space-y-2">
                    <span class="material-symbols-outlined text-4xl text-slate-300 block">subscriptions</span>
                    <p class="text-slate-400 text-xs">No recurring subscriptions detected yet.<br>Add transactions categorised as Subscriptions to see them here.</p>
                </div>`;
            return;
        }

        data.subscriptions.forEach(sub => {
            const color      = getCategoryColor(sub.color);
            const isCancelled = sub.status === 'cancelled';
            const card = document.createElement('div');
            card.className = `g1 rounded-2xl p-5 shadow-sm space-y-4 fade-up transition-all ${isCancelled ? 'opacity-50' : ''}`;

            card.innerHTML = `
                <div class="flex items-start justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background:${color}15">
                            <span class="material-symbols-outlined text-lg" style="color:${color};font-variation-settings:'FILL' 1">${sub.icon}</span>
                        </div>
                        <div>
                            <div class="text-sm font-black text-slate-900">${sub.name}</div>
                            <div class="text-[10px] text-slate-400">${sub.billing_cycle || 'monthly'} · ${sub.occurrences} charge${sub.occurrences !== 1 ? 's' : ''} on record</div>
                        </div>
                    </div>
                    <span class="text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-wider ${isCancelled
                        ? 'bg-slate-100 text-slate-400 border border-slate-200'
                        : 'bg-rose-50 text-rose-500 border border-rose-200'}">
                        ${isCancelled ? 'Cancelled' : 'Active'}
                    </span>
                </div>

                <div class="flex items-end justify-between">
                    <div>
                        <div class="text-xl font-black text-slate-900 font-outfit">$${fmtN(sub.monthly_cost)}<span class="text-xs text-slate-400 font-semibold font-manrope">/mo</span></div>
                        <div class="text-[10px] text-slate-400">$${fmtN(sub.annual_cost, 0)} per year</div>
                    </div>
                    <div class="text-right">
                        <div class="text-[9px] text-slate-400 font-semibold uppercase tracking-wide">Last charged</div>
                        <div class="text-[11px] font-bold text-slate-600">${sub.last_charged}</div>
                    </div>
                </div>

                <div class="flex gap-2 pt-1">
                    ${isCancelled
                        ? `<button onclick="reactivateSubscription('${sub.name}', ${sub.monthly_cost})"
                                class="flex-1 text-[11px] font-bold py-2.5 rounded-xl text-emerald-700 transition-all"
                                style="background:rgba(5,150,105,0.07);border:1px solid rgba(5,150,105,0.18)">
                                Reactivate
                           </button>`
                        : `<button onclick="openCancelFlow('${sub.name.replace(/'/g,"\\'")}', ${sub.monthly_cost}, ${JSON.stringify(sub.cancel_url || null)})"
                                class="flex-1 text-[11px] font-bold py-2.5 rounded-xl text-rose-600 hover:text-rose-700 transition-all"
                                style="background:rgba(225,29,72,0.06);border:1px solid rgba(225,29,72,0.18)">
                                Cancel Subscription
                           </button>`
                    }
                </div>
            `;
            grid.appendChild(card);
        });
    }

    // ── Cancel Flow Modal ─────────────────────────────────

    function openCancelFlow(name, monthlyCost, cancelUrl) {
        _activeCancelTarget = { name, monthly_cost: monthlyCost, cancel_url: cancelUrl };

        document.getElementById('cancel-modal-title').innerText = `Cancel ${name}`;
        document.getElementById('cancel-modal-sub').innerText   = `$${fmtN(monthlyCost)} / month · $${fmtN(monthlyCost * 12, 0)} / year`;

        // Show or hide direct cancel link
        const directWrap = document.getElementById('cancel-direct-wrap');
        const directLink = document.getElementById('cancel-direct-link');
        if (cancelUrl) {
            directLink.href = cancelUrl;
            directWrap.classList.remove('hidden');
        } else {
            directWrap.classList.add('hidden');
        }

        // Reset email area
        document.getElementById('email-draft-area').classList.add('hidden');
        document.getElementById('email-draft-loading').classList.add('hidden');
        document.getElementById('draft-email-btn').classList.remove('hidden');

        // Open modal
        const modal = document.getElementById('cancel-modal');
        const inner = modal.querySelector('div');
        modal.classList.remove('hidden');
        setTimeout(() => { modal.classList.remove('opacity-0'); inner.classList.remove('scale-95'); }, 10);
    }

    function toggleCancelModal(open) {
        const modal = document.getElementById('cancel-modal');
        const inner = modal.querySelector('div');
        if (!open) {
            modal.classList.add('opacity-0'); inner.classList.add('scale-95');
            setTimeout(() => modal.classList.add('hidden'), 300);
        }
    }

    async function draftCancellationEmail() {
        if (!_activeCancelTarget) return;
        document.getElementById('email-draft-loading').classList.remove('hidden');
        document.getElementById('draft-email-btn').classList.add('hidden');
        document.getElementById('email-draft-area').classList.add('hidden');

        try {
            const res  = await fetch('/api/subscriptions/draft-email', {
                method: 'POST', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ name: _activeCancelTarget.name, monthly_amount: _activeCancelTarget.monthly_cost })
            });
            const data = await res.json();
            document.getElementById('email-draft-loading').classList.add('hidden');
            document.getElementById('email-draft-text').innerText = data.email_draft;
            document.getElementById('email-draft-area').classList.remove('hidden');
        } catch(err) {
            document.getElementById('email-draft-loading').classList.add('hidden');
            document.getElementById('draft-email-btn').classList.remove('hidden');
            showToast('Failed to draft email.', 'error');
        }
    }

    function copyEmailDraft() {
        const text = document.getElementById('email-draft-text').innerText;
        navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard!', 'success'));
    }

    function sendEmailDraft() {
        const text = document.getElementById('email-draft-text').innerText;
        const lines  = text.split('\n');
        const subject = lines[0].replace(/^SUBJECT:\s*/i, '').trim();
        const body    = lines.slice(2).join('\n').trim();
        const mailto  = `mailto:support@${(_activeCancelTarget?.name || 'service').toLowerCase().replace(/\s+/g,'')}.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.open(mailto, '_blank');
    }

    async function confirmCancelSubscription() {
        if (!_activeCancelTarget) return;
        const btn = document.getElementById('confirm-cancel-btn');
        btn.disabled = true; btn.innerText = 'Marking…';

        try {
            await fetch('/api/subscriptions/cancel', {
                method: 'POST', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ name: _activeCancelTarget.name, monthly_amount: _activeCancelTarget.monthly_cost })
            });
            showToast(`${_activeCancelTarget.name} marked as cancelled.`, 'success');
            toggleCancelModal(false);
            fetchSubscriptions();
        } catch(err) {
            showToast('Failed to update status.', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined text-sm">check_circle</span> Mark as Cancelled';
        }
    }

    async function reactivateSubscription(name, monthlyCost) {
        try {
            await fetch('/api/subscriptions/reactivate', {
                method: 'POST', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ name, monthly_amount: monthlyCost })
            });
            showToast(`${name} reactivated.`, 'success');
            fetchSubscriptions();
        } catch(err) {
            showToast('Failed to reactivate.', 'error');
        }
    }

    // ══════════════════════════════════════════════════════
    //  BANK CONNECTION (Plaid)
    // ══════════════════════════════════════════════════════

    async function fetchBankStatus() {
        try {
            const res  = await fetch('/api/plaid/status');
            const data = await res.json();
            renderBankStatus(data);
        } catch(err) {
            console.error('Bank status error:', err);
        }
    }

    function renderBankStatus(status) {
        const icon  = document.getElementById('bank-status-icon');
        const title = document.getElementById('bank-status-title');
        const sub   = document.getElementById('bank-status-sub');
        const btnWrap = document.getElementById('bank-action-btn-wrap');
        const setupNotice = document.getElementById('plaid-setup-notice');

        if (!status.configured) {
            setupNotice.classList.remove('hidden');
            icon.style.background  = 'rgba(245,158,11,0.08)';
            icon.innerHTML = '<span class="material-symbols-outlined text-amber-500 text-xl" style="font-variation-settings:\'FILL\' 1">warning</span>';
            title.innerText = 'Plaid Not Configured';
            sub.innerText   = 'Add PLAID_CLIENT_ID and PLAID_SECRET to .env to enable bank connection';
            btnWrap.innerHTML = `<button disabled class="flex items-center gap-2 px-4 py-2.5 text-white text-xs font-bold rounded-xl opacity-40 cursor-not-allowed font-outfit" style="background:#94a3b8">
                <span class="material-symbols-outlined text-sm">add_link</span> Connect Bank
            </button>`;
            return;
        }

        setupNotice.classList.add('hidden');

        if (status.connected) {
            icon.style.background = 'rgba(5,150,105,0.08)';
            icon.innerHTML = '<span class="material-symbols-outlined text-emerald-600 text-xl" style="font-variation-settings:\'FILL\' 1">account_balance</span>';
            title.innerText = 'Bank Connected';
            sub.innerText   = `${status.env === 'sandbox' ? 'Sandbox mode' : 'Live'} · Transactions auto-imported`;
            btnWrap.innerHTML = `
                <div class="flex gap-2">
                    <button onclick="syncPlaid()" class="flex items-center gap-2 px-4 py-2.5 text-white text-xs font-bold rounded-xl hover:opacity-90 transition-all font-outfit" style="background:#0d9488">
                        <span class="material-symbols-outlined text-sm">sync</span> Sync Now
                    </button>
                    <button onclick="disconnectPlaid()" class="flex items-center gap-2 px-4 py-2.5 text-rose-600 text-xs font-bold rounded-xl hover:bg-rose-50 transition-all g1">
                        Disconnect
                    </button>
                </div>`;
        } else {
            icon.style.background = 'rgba(100,116,139,0.08)';
            icon.innerHTML = '<span class="material-symbols-outlined text-slate-400 text-xl" style="font-variation-settings:\'FILL\' 1">account_balance</span>';
            title.innerText = 'No Bank Connected';
            sub.innerText   = 'Connect your bank to auto-import transactions';
            btnWrap.innerHTML = `<button onclick="connectBank()" class="flex items-center gap-2 px-4 py-2.5 text-white text-xs font-bold rounded-xl hover:opacity-90 transition-all font-outfit" style="background:#0d9488">
                <span class="material-symbols-outlined text-sm">add_link</span> Connect Bank
            </button>`;
        }
    }

    async function connectBank() {
        try {
            const res  = await fetch('/api/plaid/create-link-token', { method: 'POST' });
            const data = await res.json();
            if (!data.link_token) { showToast('Could not create Plaid link token.', 'error'); return; }

            const handler = Plaid.create({
                token: data.link_token,
                onSuccess: async (publicToken) => {
                    showToast('Exchanging token…', 'info');
                    const exchRes  = await fetch('/api/plaid/exchange-token', {
                        method: 'POST', headers: {'Content-Type':'application/json'},
                        body: JSON.stringify({ public_token: publicToken })
                    });
                    const exchData = await exchRes.json();
                    if (exchData.status === 'connected') {
                        showToast('Bank connected! Syncing transactions…', 'success');
                        await syncPlaid();
                        fetchBankStatus();
                    }
                },
                onExit: (err) => { if (err) showToast('Connection cancelled.', 'info'); }
            });
            handler.open();
        } catch(err) {
            showToast('Failed to launch Plaid. Check .env credentials.', 'error');
        }
    }

    async function syncPlaid() {
        showToast('Syncing bank transactions…', 'info');
        try {
            const res  = await fetch('/api/plaid/sync', { method: 'POST' });
            const data = await res.json();
            const detail = `Imported ${data.imported} transactions (${data.skipped_pending} pending skipped)`;
            document.getElementById('plaid-sync-detail').innerText  = detail;
            document.getElementById('plaid-sync-result').classList.remove('hidden');
            showToast(`Synced: ${data.imported} transactions imported.`, 'success');
            fetchDashboard();
            fetchSubscriptions();
        } catch(err) {
            showToast('Sync failed. Try again.', 'error');
        }
    }

    async function disconnectPlaid() {
        if (!confirm('Disconnect your bank? Imported transactions will remain.')) return;
        await fetch('/api/plaid/disconnect', { method: 'DELETE' });
        showToast('Bank disconnected.', 'success');
        fetchBankStatus();
        document.getElementById('plaid-sync-result').classList.add('hidden');
    }

    function toggleCsvPanel() {
        const panel = document.getElementById('csv-panel');
        panel.classList.toggle('hidden');
    }

    // ── CSV Bank Statement Import ─────────────────────────────────

    function handleCsvDrop(event) {
        event.preventDefault();
        document.getElementById('csv-drop-zone').style.background = 'rgba(13,148,136,0.03)';
        const file = event.dataTransfer.files[0];
        if (file) handleCsvUpload(file);
    }

    async function handleCsvUpload(file) {
        if (!file || !file.name.endsWith('.csv')) {
            showToast('Please upload a .csv file.', 'error');
            return;
        }
        const resultEl = document.getElementById('csv-import-result');
        const errorEl  = document.getElementById('csv-import-error');
        resultEl.classList.add('hidden');
        errorEl.classList.add('hidden');

        const label = document.getElementById('csv-drop-zone');
        label.innerHTML = `<span class="material-symbols-outlined text-teal-400 text-3xl animate-spin">autorenew</span><div class="text-xs font-bold text-slate-500">Importing ${file.name}…</div>`;

        const form = new FormData();
        form.append('file', file);

        try {
            const res  = await fetch('/api/import/csv', { method: 'POST', body: form });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Import failed');

            document.getElementById('csv-import-detail').innerText =
                `Imported ${data.imported} transactions · ${data.skipped} rows skipped`;
            resultEl.classList.remove('hidden');
            showToast(`CSV imported: ${data.imported} transactions added.`, 'success');
            fetchDashboard();
            fetchSubscriptions();
        } catch(err) {
            document.getElementById('csv-import-error-msg').innerText = err.message;
            errorEl.classList.remove('hidden');
            showToast('CSV import failed.', 'error');
        } finally {
            label.innerHTML = `
                <span class="material-symbols-outlined text-teal-400 text-3xl" style="font-variation-settings:'FILL' 1">cloud_upload</span>
                <div class="text-center">
                    <div class="text-xs font-bold text-slate-600">Drag & drop CSV here</div>
                    <div class="text-[10px] text-slate-400">or click to browse · Works with Chase, BofA, Wells Fargo, Citi, and most banks</div>
                </div>
                <input id="csv-file-input" type="file" accept=".csv" class="hidden" onchange="handleCsvUpload(this.files[0])">`;
        }
    }

    function executeBudgetShift(btn) {
        if (limitShiftExecuted) return;
        limitShiftExecuted = true;
        btn.innerText = '✓ Shifted';
        btn.disabled  = true;
        showToast('Utility budget updated!', 'success');
    }

    // ── Toast ─────────────────────────────────────────────────
    function showToast(message, type='info') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id        = 'toast-container';
            container.className = 'fixed bottom-5 left-5 z-50 flex flex-col gap-2 pointer-events-none';
            document.body.appendChild(container);
        }
        const toast = document.createElement('div');
        toast.className = 'pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border translate-y-3 opacity-0 transition-all duration-300 text-[11px] font-bold backdrop-blur-xl';
        if (type==='success') {
            toast.style.cssText = 'background:rgba(240,253,250,0.97)';
            toast.className += ' border-emerald-200 text-success-green';
        } else if (type==='error') {
            toast.style.cssText = 'background:rgba(255,241,242,0.97)';
            toast.className += ' border-rose-200 text-danger-red';
        } else {
            toast.style.cssText = 'background:rgba(255,255,255,0.97)';
            toast.className += ' border-slate-200 text-slate-700';
        }
        const icon = type==='success' ? 'check_circle' : type==='error' ? 'error' : 'info';
        toast.innerHTML = `<span class="material-symbols-outlined text-base shrink-0">${icon}</span><span class="font-outfit uppercase tracking-wider">${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => toast.classList.remove('translate-y-3','opacity-0'), 10);
        setTimeout(() => { toast.classList.add('translate-y-3','opacity-0'); setTimeout(() => toast.remove(), 300); }, 3500);
    }

    // ── Init ──────────────────────────────────────────────────
    async function loadCurrentUser() {
        try {
            const res  = await fetch('/api/me');
            const user = await res.json();
            const av   = document.getElementById('user-avatar');
            if (user.picture) {
                av.innerHTML = `<img src="${user.picture}" class="w-full h-full object-cover rounded-full" alt="${user.name}" referrerpolicy="no-referrer">`;
            } else {
                av.textContent = (user.name || user.email || 'U')[0].toUpperCase();
            }
        } catch(e) { console.error('Could not load user', e); }
    }

    document.addEventListener('DOMContentLoaded', () => {
        loadCurrentUser();
        fetchDashboard();
        loadSettings();
        scrollChatBottom();
    });
