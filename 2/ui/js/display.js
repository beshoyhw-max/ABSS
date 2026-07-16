let lastSeq = 0;

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
    
    // Add slight random vertical offset if multiple people return at once
    const randomOffset = (Math.random() - 0.5) * 20;
    bulletin.style.marginTop = `${randomOffset}px`;

    container.appendChild(bulletin);

    // Clean up the DOM element precisely at 5 seconds to match the CSS animation
    setTimeout(() => {
        if (bulletin.parentNode) {
            bulletin.parentNode.removeChild(bulletin);
        }
    }, 10000);
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