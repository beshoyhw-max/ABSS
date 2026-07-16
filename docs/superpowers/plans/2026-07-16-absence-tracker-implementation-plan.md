# Absence Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dual-window PyWebView desktop app that lets a meeting controller track who's absent and for how long, with live display and auto-excel sync.

**Architecture:** PyWebView dual-window app. Control window exposes AbsenceAPI to JS for adding/marking returns. Display window polls active absences every 500ms. Excel written on every state change via openpyxl.

**Tech Stack:** PyWebView, Python 3, openpyxl, vanilla JS/HTML/CSS

---

## File Structure

```
absence-tracker/
├── app.py                  # PyWebView entry + AbsenceAPI
├── config.json             # preset names (auto-created)
├── requirements.txt        # pywebview, openpyxl
├── exports/                # auto-created, Excel output
└── ui/
    ├── index.html          # redirect to control
    ├── control.html
    ├── display.html
    ├── css/
    │   ├── control.css
    │   └── display.css
    └── js/
        ├── control.js
        └── display.js
```

---

## Task 1: Scaffold Project

**Files:**
- Create: `D:\ai camera\Absent System\absence-tracker\requirements.txt`
- Create: `D:\ai camera\Absent System\absence-tracker\config.json`
- Create: `D:\ai camera\Absent System\absence-tracker\exports\` (empty folder)
- Create: `D:\ai camera\Absent System\absence-tracker\ui\css\`
- Create: `D:\ai camera\Absent System\absence-tracker\ui\js\`

- [ ] **Step 1: Create requirements.txt**

```
pywebview
openpyxl
```

- [ ] **Step 2: Create config.json with default preset names**

```json
{
  "preset_names": ["Alice", "Bob", "Charlie", "Diana", "Evan"]
}
```

- [ ] **Step 3: Create empty exports folder**
- [ ] **Step 4: Create empty ui/css/ and ui/js/ directories**

---

## Task 2: AbsenceAPI Python Backend

**Files:**
- Create: `D:\ai camera\Absent System\absence-tracker\app.py`

- [ ] **Step 1: Write app.py with AbsenceAPI class**

```python
import uuid
from datetime import datetime
from dataclasses import dataclass, asdict
from pathlib import Path
import json
import openpyxl
from openpyxl import Workbook
from openpyxl.worksheet.write_only import WriteOnlyWorksheet
import webview


@dataclass
class Absence:
    id: str
    name: str
    start_time: datetime
    end_time: datetime | None
    duration_mins: float | None


class AbsenceAPI:
    def __init__(self):
        self.absences: dict[str, Absence] = {}
        self.config_path = Path(__file__).parent / "config.json"
        self.exports_dir = Path(__file__).parent / "exports"
        self.exports_dir.mkdir(exist_ok=True)
        self._load_config()
        self._ensure_today_excel()

    def _load_config(self):
        with open(self.config_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.preset_names: list[str] = data.get("preset_names", [])

    def _save_config(self):
        with open(self.config_path, "w", encoding="utf-8") as f:
            json.dump({"preset_names": self.preset_names}, f, indent=2, ensure_ascii=False)

    def _today_filename(self) -> str:
        return f"absences_{datetime.now().strftime('%Y-%m-%d')}.xlsx"

    def _excel_path(self) -> Path:
        return self.exports_dir / self._today_filename()

    def _ensure_today_excel(self):
        path = self._excel_path()
        if not path.exists():
            wb = Workbook()
            ws = wb.active
            ws.title = "Absences"
            ws.append(["Name", "Start Time", "End Time", "Duration (min)"])
            wb.save(path)

    def _write_excel_row(self, absence: Absence):
        path = self._excel_path()
        wb = openpyxl.load_workbook(path)
        ws = wb.active
        ws.append([
            absence.name,
            absence.start_time.strftime("%H:%M:%S"),
            absence.end_time.strftime("%H:%M:%S") if absence.end_time else "",
            round(absence.duration_mins, 1) if absence.duration_mins else ""
        ])
        wb.save(path)

    def _update_excel_row(self, absence: Absence):
        """Find row by name+start_time and update end_time + duration."""
        path = self._excel_path()
        wb = openpyxl.load_workbook(path)
        ws = wb.active
        start_str = absence.start_time.strftime("%H:%M:%S")
        for row in ws.iter_rows(min_row=2, values_only=True):
            if row[0] == absence.name and row[1] == start_str:
                row_idx = ws.max_row  # simple append approach below
        # Simpler: just append updated row since matching is complex in append mode
        # Use standard approach: reload all, update, save
        wb = openpyxl.load_workbook(path)
        ws = wb.active
        # Find and update matching row
        for i, row in enumerate(ws.iter_rows(min_row=2), start=2):
            if row[0].value == absence.name and row[1].value == start_str:
                row[2].value = absence.end_time.strftime("%H:%M:%S") if absence.end_time else ""
                row[3].value = round(absence.duration_mins, 1) if absence.duration_mins else ""
                break
        wb.save(path)

    def add_absence(self, name: str) -> dict:
        absence = Absence(
            id=str(uuid.uuid4()),
            name=name.strip(),
            start_time=datetime.now(),
            end_time=None,
            duration_mins=None
        )
        self.absences[absence.id] = absence
        self._write_excel_row(absence)
        return self._absence_to_dict(absence)

    def mark_return(self, id: str) -> dict | None:
        absence = self.absences.get(id)
        if not absence:
            return None
        absence.end_time = datetime.now()
        absence.duration_mins = (absence.end_time - absence.start_time).total_seconds() / 60.0
        self._update_excel_row(absence)
        result = self._absence_to_dict(absence)
        del self.absences[id]
        return result

    def get_active_absences(self) -> list[dict]:
        return [
            {
                "id": a.id,
                "name": a.name,
                "start_time": a.start_time.strftime("%H:%M:%S"),
                "elapsed_mins": (datetime.now() - a.start_time).total_seconds() / 60.0
            }
            for a in self.absences.values()
        ]

    def get_preset_names(self) -> list[str]:
        return self.preset_names

    def save_preset_names(self, names: list[str]):
        self.preset_names = names
        self._save_config()

    def _absence_to_dict(self, absence: Absence) -> dict:
        return {
            "id": absence.id,
            "name": absence.name,
            "start_time": absence.start_time.strftime("%H:%M:%S"),
            "end_time": absence.end_time.strftime("%H:%M:%S") if absence.end_time else None,
            "duration_mins": round(absence.duration_mins, 1) if absence.duration_mins else None
        }


def main():
    api = AbsenceAPI()
    webview.start(api, debug=True, http_server=True)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Verify syntax**

Run: `python -c "import ast; ast.parse(open('D:/ai camera/Absent System/absence-tracker/app.py').read())"`
Expected: No output (valid Python)

---

## Task 3: PyWebView App Entry Point (Dual Window)

**Files:**
- Modify: `D:\ai camera\Absent System\absence-tracker\app.py`

- [ ] **Step 1: Update app.py to create dual windows**

```python
import webview


class AbsenceAPI:
    # ... (previous implementation)
    pass


def main():
    api = AbsenceAPI()
    webview.start(
        windows=[
            webview.create_window("Control", "ui/control.html", width=500, height=700, resizable=True),
            webview.create_window("Display", "ui/display.html", width=600, height=400, frameless=True, resizable=True),
        ],
        api=api,
        debug=True,
        http_server=True
    )


if __name__ == "__main__":
    main()
```

---

## Task 4: UI HTML Files

**Files:**
- Create: `D:\ai camera\Absent System\absence-tracker\ui\index.html`
- Create: `D:\ai camera\Absent System\absence-tracker\ui\control.html`
- Create: `D:\ai camera\Absent System\absence-tracker\ui\display.html`

- [ ] **Step 1: Create ui/index.html**

```html
<!DOCTYPE html>
<html>
<head>
    <meta http-equiv="refresh" content="0;url=control.html">
</head>
<body>
    <p>Redirecting to <a href="control.html">Control</a>...</p>
</body>
</html>
```

- [ ] **Step 2: Create ui/control.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Absence Tracker — Control</title>
    <link rel="stylesheet" href="css/control.css">
</head>
<body>
    <div class="header">
        <h1>Absence Tracker</h1>
        <span id="meeting-date"></span>
        <span id="absent-badge" class="badge">0 absent</span>
    </div>

    <div class="add-section">
        <input type="text" id="name-input" placeholder="Enter name..." autocomplete="off">
        <ul id="autocomplete-list" class="autocomplete"></ul>
        <button id="mark-away-btn">Mark Away</button>
    </div>

    <div class="absences-list" id="absences-list">
        <p class="empty-msg">No one is absent</p>
    </div>

    <div class="presets-section">
        <h3>Preset Names</h3>
        <div class="preset-add">
            <input type="text" id="preset-input" placeholder="Add preset name...">
            <button id="add-preset-btn">Add</button>
        </div>
        <ul id="preset-list" class="preset-list"></ul>
    </div>

    <script src="js/control.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create ui/display.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Absence Tracker — Display</title>
    <link rel="stylesheet" href="css/display.css">
</head>
<body>
    <div class="header">
        <h1 id="meeting-date">Meeting — </h1>
        <span id="current-time"></span>
    </div>
    <div class="absences-list" id="absences-list">
        <p class="all-present">✓ Everyone is present</p>
    </div>
    <script src="js/display.js"></script>
</body>
</html>
```

---

## Task 5: CSS Files

**Files:**
- Create: `D:\ai camera\Absent System\absence-tracker\ui\css\control.css`
- Create: `D:\ai camera\Absent System\absence-tracker\ui\css\display.css`

- [ ] **Step 1: Create ui/css/control.css**

```css
:root {
    --bg: #1a1a2e;
    --surface: #16213e;
    --accent: #0f3460;
    --highlight: #e94560;
    --text: #eaeaea;
    --muted: #888;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); padding: 16px; }

.header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.header h1 { font-size: 1.2rem; }
.badge { background: var(--highlight); padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: bold; }

.add-section { position: relative; display: flex; gap: 8px; margin-bottom: 20px; }
#name-input { flex: 1; padding: 10px; font-size: 1rem; border: 2px solid var(--accent); border-radius: 8px; background: var(--surface); color: var(--text); }
#mark-away-btn { padding: 10px 20px; font-size: 1rem; background: var(--highlight); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; }
#mark-away-btn:hover { opacity: 0.9; }

.autocomplete { position: absolute; top: 44px; left: 0; right: 90px; background: var(--surface); border: 1px solid var(--accent); border-radius: 0 0 8px 8px; list-style: none; z-index: 100; display: none; }
.autocomplete li { padding: 8px 12px; cursor: pointer; }
.autocomplete li:hover { background: var(--accent); }

.absences-list { background: var(--surface); border-radius: 12px; padding: 12px; min-height: 120px; margin-bottom: 20px; }
.empty-msg { color: var(--muted); text-align: center; padding: 20px; }

.absence-row { display: flex; align-items: center; justify-content: space-between; padding: 10px; border-bottom: 1px solid var(--accent); }
.absence-row:last-child { border-bottom: none; }
.absence-info .name { font-weight: bold; font-size: 1rem; }
.absence-info .start { color: var(--muted); font-size: 0.85rem; }
.absence-info .elapsed { color: var(--highlight); font-size: 0.95rem; }
.mark-back-btn { padding: 6px 14px; background: #2ecc71; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; }
.mark-back-btn:hover { opacity: 0.85; }

.presets-section { background: var(--surface); border-radius: 12px; padding: 12px; }
.presets-section h3 { font-size: 0.95rem; color: var(--muted); margin-bottom: 10px; }
.preset-add { display: flex; gap: 8px; margin-bottom: 10px; }
#preset-input { flex: 1; padding: 6px; font-size: 0.9rem; border: 1px solid var(--accent); border-radius: 6px; background: var(--bg); color: var(--text); }
#add-preset-btn { padding: 6px 12px; background: var(--accent); color: white; border: none; border-radius: 6px; cursor: pointer; }
.preset-list { list-style: none; display: flex; flex-wrap: wrap; gap: 6px; }
.preset-list li { background: var(--accent); padding: 4px 10px; border-radius: 20px; font-size: 0.85rem; display: flex; align-items: center; gap: 6px; }
.preset-list li .remove { cursor: pointer; color: var(--highlight); font-weight: bold; }
```

- [ ] **Step 2: Create ui/css/display.css**

```css
:root {
    --bg: #0a0a12;
    --text: #f5f5f5;
    --highlight: #e94560;
    --accent: #2ecc71;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); height: 100vh; display: flex; flex-direction: column; }

.header { display: flex; justify-content: space-between; align-items: center; padding: 20px 40px; border-bottom: 1px solid #222; }
.header h1 { font-size: 1.8rem; font-weight: 300; }
#current-time { font-size: 1.8rem; font-weight: 300; color: #888; }

.absences-list { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 40px; gap: 16px; }
.all-present { font-size: 2rem; color: var(--accent); text-align: center; }

.absence-item { display: flex; align-items: center; gap: 16px; padding: 16px 24px; background: #111; border-radius: 12px; animation: fadeIn 0.3s ease; }
.absence-item.returning { animation: fadeOut 0.5s ease forwards; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; } }
@keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }

.bullet { color: var(--highlight); font-size: 1.5rem; }
.absence-item .name { font-size: 2rem; font-weight: 600; }
.absence-item .duration { color: #888; font-size: 1.5rem; }
```

---

## Task 6: JavaScript Files

**Files:**
- Create: `D:\ai camera\Absent System\absence-tracker\ui\js\control.js`
- Create: `D:\ai camera\Absent System\absence-tracker\ui\js\display.js`

- [ ] **Step 1: Create ui/js/control.js**

```javascript
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
    setInterval(updateElapsed, 1000);
}

async function pollAbsences() {
    const absences = await pywebview.api.get_active_absences();
    activeAbsences = absences;
    renderAbsences();
    document.getElementById('absent-badge').textContent = absences.length + ' absent';
}

function updateElapsed() {
    const now = new Date();
    document.querySelectorAll('.elapsed').forEach(el => {
        const startStr = el.dataset.start;
        const [h, m, s] = startStr.split(':').map(Number);
        const start = new Date();
        start.setHours(h, m, s);
        const diffMins = (now - start) / 60000;
        el.textContent = `Away (${Math.floor(diffMins)} min)`;
    });
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
                <div class="elapsed" data-start="${a.start_time}">Away (0 min)</div>
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
```

- [ ] **Step 2: Create ui/js/display.js**

```javascript
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

function renderAbsences(absences) {
    const list = document.getElementById('absences-list');
    if (absences.length === 0) {
        list.innerHTML = '<p class="all-present">✓ Everyone is present</p>';
        return;
    }
    const now = new Date();
    list.innerHTML = absences.map(a => {
        const [h, m, s] = a.start_time.split(':').map(Number);
        const start = new Date(); start.setHours(h, m, s);
        const diffMins = Math.floor((now - start) / 60000);
        return `<div class="absence-item">
            <span class="bullet">●</span>
            <span class="name">${a.name}</span>
            <span class="duration">— Away (${diffMins} min)</span>
        </div>`;
    }).join('');
}
```

---

## Task 7: Test / Verify

- [ ] **Step 1: Install dependencies**

Run: `cd D:\ai camera\Absent System\absence-tracker && pip install -r requirements.txt`
Expected: pywebview and openpyxl installed

- [ ] **Step 2: Run the app**

Run: `python D:\ai camera\Absent System\absence-tracker\app.py`
Expected: Two windows open — Control and Display

- [ ] **Step 3: Test add absence**

In control window, type a name and click "Mark Away"
Expected: Row appears in list, Excel file created in exports/

- [ ] **Step 4: Test mark back**

Click "Mark Back" on a row
Expected: Row removed from list, Excel updated with end_time and duration

- [ ] **Step 5: Test display window**

Expected: Shows absent person, updates live, fades out when returned

---

## Self-Review Checklist

- [ ] All AbsenceAPI methods implemented: add_absence, mark_return, get_active_absences, get_preset_names, save_preset_names
- [ ] Dual window: control.html + display.html via PyWebView
- [ ] Excel auto-created on first absence, updated on every change
- [ ] Autocomplete in control window from preset names
- [ ] Display polls every 500ms, shows live elapsed time
- [ ] config.json stores preset names with auto-save
- [ ] No hardcoded placeholders or TODOs in code