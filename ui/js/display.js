window.addEventListener('pywebviewready', () => {
    document.getElementById('meeting-date').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    setInterval(updateTime, 1000);
    setInterval(pollAbsences, 500);
    setupResizeHandler();
    setupDragHandler();
});

function setupResizeHandler() {
    const handle = document.getElementById('resize-handle');
    if (!handle) return;

    let isResizing = false;
    let startWidth = 0;
    let startHeight = 0;
    let startX = 0;
    let startY = 0;

    handle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startWidth = window.innerWidth;
        startHeight = window.innerHeight;
        startX = e.screenX;
        startY = e.screenY;
        e.preventDefault();
        e.stopPropagation();
    });

    window.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const deltaX = e.screenX - startX;
        const deltaY = e.screenY - startY;
        const newWidth = Math.max(200, startWidth + deltaX);
        const newHeight = Math.max(150, startHeight + deltaY);

        if (window.pywebview && window.pywebview.api && window.pywebview.api.resize_display) {
            window.pywebview.api.resize_display(newWidth, newHeight);
        }
    });

    window.addEventListener('mouseup', () => {
        isResizing = false;
    });
}

function setupDragHandler() {
    const dragBar = document.getElementById('drag-bar');
    if (!dragBar) return;

    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    dragBar.addEventListener('mousedown', (e) => {
        isDragging = true;
        lastX = e.screenX;
        lastY = e.screenY;
        document.body.style.cursor = 'move';
        e.preventDefault();
        e.stopPropagation();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.screenX - lastX;
        const dy = e.screenY - lastY;
        lastX = e.screenX;
        lastY = e.screenY;
        if (window.pywebview && window.pywebview.api && window.pywebview.api.move_window) {
            window.pywebview.api.move_window(dx, dy).catch(() => { });
        }
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        document.body.style.cursor = '';
    });
}

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