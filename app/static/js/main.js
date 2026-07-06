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
