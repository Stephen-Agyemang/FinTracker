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

