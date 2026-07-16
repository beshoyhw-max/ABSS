let presetNames = [];
let activeAbsences = [];

window.addEventListener('pywebviewready', () => {
    loadInit();
});

async function loadInit() {
    const names = await pywebview.api.get_preset_names();
    presetNames = names;
    renderPresets();
    document.getElementById('meeting-date').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('name-input').focus();
    setInterval(pollAbsences, 500);
}

async function pollAbsences() {
    const absences = await pywebview.api.get_active_absences();
    activeAbsences = absences;
    renderAbsences();
    document.getElementById('absent-badge').textContent = absences.length + ' absent';
}

function renderAbsences() {
    const list = document.getElementById('absences-list');
    if (activeAbsences.length === 0) {
        list.innerHTML = '<p class="empty-msg">No one is absent</p>';
        return;
    }
    list.innerHTML = activeAbsences.map(a => `
        <div class="absence-row">
            <div class="absence-info">
                <div class="name">${a.name}</div>
                <div class="start">Away since ${a.start_time}</div>
                <div class="elapsed" data-start="${a.start_time}">Away (${Math.floor(a.elapsed_mins)} min)</div>
            </div>
            <button class="mark-back-btn" onclick="markBack('${a.id}')">Mark Back</button>
        </div>
    `).join('');
}

async function markBack(id) {
    await pywebview.api.mark_return(id);
}

document.getElementById('name-input').addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase();
    const list = document.getElementById('autocomplete-list');
    if (!val) { list.style.display = 'none'; return; }
    const matches = presetNames.filter(n => n.toLowerCase().includes(val));
    if (matches.length) {
        list.innerHTML = matches.map(m => `<li onclick="selectPreset('${m}')">${m}</li>`).join('');
        list.style.display = 'block';
    } else {
        list.style.display = 'none';
    }
});

document.getElementById('name-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addAbsence();
});

document.getElementById('mark-away-btn').addEventListener('click', addAbsence);

function addAbsence() {
    const name = document.getElementById('name-input').value.trim();
    if (!name) return;
    pywebview.api.add_absence(name);
    document.getElementById('name-input').value = '';
    document.getElementById('autocomplete-list').style.display = 'none';
    document.getElementById('name-input').focus();
}

function selectPreset(name) {
    document.getElementById('name-input').value = name;
    document.getElementById('autocomplete-list').style.display = 'none';
    addAbsence();
}

function renderPresets() {
    const list = document.getElementById('preset-list');
    list.innerHTML = presetNames.map(n => `<li>${n} <span class="remove" onclick="removePreset('${n}')">×</span></li>`).join('');
}

document.getElementById('add-preset-btn').addEventListener('click', () => {
    const val = document.getElementById('preset-input').value.trim();
    if (!val || presetNames.includes(val)) return;
    presetNames.push(val);
    pywebview.api.save_preset_names(presetNames);
    document.getElementById('preset-input').value = '';
    renderPresets();
});

function removePreset(name) {
    presetNames = presetNames.filter(n => n !== name);
    pywebview.api.save_preset_names(presetNames);
    renderPresets();
}