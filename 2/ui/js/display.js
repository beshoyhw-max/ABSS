let lastSeq = 0;
let isDragging = false;
let startX, startY;

// Wait for the Python backend to connect to the Javascript frontend
window.addEventListener('pywebviewready', () => {
    // 1. Polling for returning people every 3 seconds (3000ms)
    setInterval(pollReturns, 3000); 
    
    // 2. Enable manual drag across multiple monitors (since window is frameless)
    setupDragHandler();
});

async function pollReturns() {
    try {
        // Fetch new returns from Laptop B's Python API, passing the last seen sequence
        const newReturns = await window.pywebview.api.get_new_returns(lastSeq);
        
        if (newReturns && newReturns.length > 0) {
            // Update lastSeq to the highest sequence number we just received
            const maxSeq = Math.max(...newReturns.map(r => r.seq));
            if (maxSeq > lastSeq) {
                lastSeq = maxSeq;
            }

            // Process them with a 2-second (2000ms) delay between each to prevent visual overlap
            newReturns.forEach((person, index) => {
                setTimeout(() => {
                    triggerDisplayAnimation(person.name, person.duration_mins);
                }, index * 2000); 
            });
        }
    } catch (error) {
        console.error("Error polling for returns:", error);
    }
}

function triggerDisplayAnimation(name, duration) {
    // Check if you have a specific container, otherwise attach to the body
    const container = document.getElementById('display-container') || document.body;
    
    // Create the floating text element
    const textElement = document.createElement('div');
    textElement.className = 'floating-text';
    
    // Format the message however you like
    textElement.innerText = `${name} is back!`; 
    
    container.appendChild(textElement);

    // Remove the element after the CSS animation finishes (e.g., 5 seconds)
    // Ensure this timeout duration matches the duration of your CSS animation!
    setTimeout(() => {
        if (container.contains(textElement)) {
            container.removeChild(textElement);
        }
    }, 5000); 
}

// ==========================================
// DRAGGING LOGIC FOR FRAMELESS WINDOW
// ==========================================
function setupDragHandler() {
    // Create a drag handle so you can grab the invisible window
    const dragHandle = document.createElement('div');
    dragHandle.id = 'drag-handle';
    dragHandle.innerHTML = '&#10022; Drag'; // ✥ icon
    
    // Basic styling to ensure it sits in the top left and is visible on hover
    Object.assign(dragHandle.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        padding: '5px 10px',
        background: 'rgba(0, 0, 0, 0.5)',
        color: 'white',
        cursor: 'move',
        opacity: '0.1',
        transition: 'opacity 0.2s',
        userSelect: 'none',
        zIndex: '9999'
    });

    // Make it more visible only when you hover over it
    dragHandle.addEventListener('mouseenter', () => dragHandle.style.opacity = '1');
    dragHandle.addEventListener('mouseleave', () => dragHandle.style.opacity = '0.1');

    document.body.appendChild(dragHandle);

    dragHandle.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.screenX;
        startY = e.screenY;
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const dx = e.screenX - startX;
        const dy = e.screenY - startY;
        
        if (dx !== 0 || dy !== 0) {
            window.pywebview.api.move_window(dx, dy);
            startX = e.screenX;
            startY = e.screenY;
        }
    });
}