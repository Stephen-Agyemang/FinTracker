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

