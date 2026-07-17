let lastSeq = 0;

// --- Bulletin stagger queue ---
// When multiple people return in the same poll, their bulletins would all
// spawn at left:100% at the same instant and overlap. We stagger them by
// giving each one an animationDelay so they trail each other across the
// screen with a visible gap.
const BULLETIN_DURATION_MS = 10000;   // must match the CSS animation duration
const STAGGER_MS = 5000;              // gap between consecutive bulletin starts
const CLEANUP_BUFFER_MS = 200;        // safety margin before removing the node
let nextAvailableSlot = 0;            // epoch-ms when the next bulletin may start

window.addEventListener('pywebviewready', () => {
    // 1. Polling for returning people every 3 seconds (3000ms)
    setInterval(pollReturns, 3000);

    // 2. Enable manual drag and resize across multiple monitors
    setupDragHandler();
    setupResizeHandler();
});

async function pollReturns() {
    if (!window.pywebview || !window.pywebview.api) return;

    try {
        const newReturns = await window.pywebview.api.get_new_returns(lastSeq);

        if (newReturns && newReturns.length > 0) {
            newReturns.forEach(ret => {
                // Safely grab duration_mins from the Python backend, fallback to "xx" if missing
                const minutes = ret.duration_mins || "xx";
                spawnBulletin(ret.name, minutes);

                // Update the sequence number so we don't repeat notifications
                if (ret.seq > lastSeq) lastSeq = ret.seq;
            });
        }
    } catch (e) {
        console.error("Polling error:", e);
    }
}

function spawnBulletin(name, minutes) {
    const container = document.getElementById('bulletin-container');
    const bulletin = document.createElement('div');

    bulletin.className = 'bulletin';
    bulletin.textContent = `${name}离席了(${minutes}分钟)`;

    // Stagger: if a previous bulletin is still in its entry phase, hold this
    // one invisibly at the right edge (via animation-delay + fill-mode:both)
    // until STAGGER_MS after the previous one started.
    const now = Date.now();
    let delay = 0;
    if (now < nextAvailableSlot) {
        delay = nextAvailableSlot - now;
        bulletin.style.animationDelay = `${delay}ms`;
    }
    // Reserve the next slot. `now + delay` is when THIS bulletin actually
    // starts moving; the next one must trail it by STAGGER_MS.
    nextAvailableSlot = now + delay + STAGGER_MS;

    container.appendChild(bulletin);

    // Clean up the DOM element after the animation finishes. The total
    // lifetime is the delay (waiting at the right edge) + the animation
    // duration + a small buffer so we never yank a node mid-flight.
    setTimeout(() => {
        if (bulletin.parentNode) {
            bulletin.parentNode.removeChild(bulletin);
        }
    }, delay + BULLETIN_DURATION_MS + CLEANUP_BUFFER_MS);
}

function setupDragHandler() {
    const dragBar = document.getElementById('drag-handle');
    if (!dragBar) return;

    let isDragging = false;

    dragBar.addEventListener('mousedown', (e) => {
        isDragging = true;
        document.body.style.cursor = 'move';
        e.preventDefault();
        e.stopPropagation();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        // movementX/Y tracks raw mouse movement, preventing multi-monitor coordinate jumps
        const dx = e.movementX;
        const dy = e.movementY;

        if (dx === 0 && dy === 0) return;

        if (window.pywebview && window.pywebview.api && window.pywebview.api.move_window) {
            window.pywebview.api.move_window(dx, dy).catch(() => { });
        }
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        document.body.style.cursor = '';
    });
}

function setupResizeHandler() {
    const resizeHandle = document.getElementById('resize-handle');
    if (!resizeHandle) return;

    let isResizing = false;
    let currentWidth = 0, currentHeight = 0;

    resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        currentWidth = window.innerWidth;
        currentHeight = window.innerHeight;
        document.body.style.cursor = 'se-resize';
        e.preventDefault();
        e.stopPropagation();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        // Use movementX/Y for safe cross-monitor resizing
        currentWidth += e.movementX;
        currentHeight += e.movementY;

        if (window.pywebview && window.pywebview.api && window.pywebview.api.resize_display) {
            window.pywebview.api.resize_display(currentWidth, currentHeight).catch(() => { });
        }
    });

    document.addEventListener('mouseup', () => {
        isResizing = false;
        document.body.style.cursor = '';
    });
}