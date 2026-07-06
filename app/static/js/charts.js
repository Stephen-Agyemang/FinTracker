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

