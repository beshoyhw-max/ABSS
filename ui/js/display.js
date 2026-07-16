window.addEventListener('pywebviewready', () => {
    document.getElementById('meeting-date').textContent = 'Meeting — ' + new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    setInterval(updateTime, 1000);
    setInterval(pollAbsences, 500);
});

function updateTime() {
    document.getElementById('current-time').textContent = new Date().toLocaleTimeString();
}

async function pollAbsences() {
    const absences = await pywebview.api.get_active_absences();
    renderAbsences(absences);
}

let lastRender = '';

function renderAbsences(absences) {
    const list = document.getElementById('absences-list');
    if (absences.length === 0) {
        const html = '<p class="all-present">✓ Everyone is present</p>';
        if (lastRender !== html) { list.innerHTML = html; lastRender = html; }
        return;
    }
    const now = new Date();
    const html = absences.map(a => {
        const parts = (a.start_time || '').split(':');
        if (parts.length < 3) return '';
        const [h, m, s] = parts.map(Number);
        if ([h, m, s].some(isNaN)) return '';
        const start = new Date(); start.setHours(h, m, s);
        const diffMins = Math.max(0, Math.floor((now - start) / 60000));
        return `<div class="absence-item">
            <span class="bullet">●</span>
            <span class="name">${a.name}</span>
            <span class="duration">— Away (${diffMins} min)</span>
        </div>`;
    }).filter(Boolean).join('');
    if (html !== lastRender) { list.innerHTML = html; lastRender = html; }
}