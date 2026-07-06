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

