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

