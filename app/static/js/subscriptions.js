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

