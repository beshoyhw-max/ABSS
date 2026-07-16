from __future__ import annotations
import uuid
import os
import threading
from datetime import datetime
from pathlib import Path
import json

os.environ["QT_API"] = "pyside6"
os.environ["PYWEBVIEW_GUI"] = "qt"
import webview

try:
    import openpyxl
    from openpyxl import Workbook
except ImportError:
    openpyxl = None
    Workbook = None

class AbsenceAPI:
    def __init__(self):
        self.base_dir = Path(__file__).parent
        self.config_path = self.base_dir / "config.json"
        self.exports_dir = self.base_dir / "exports"
        
        # Create shared_data folder for Laptop B
        self.shared_dir = self.base_dir / "shared_data"
        self.shared_dir.mkdir(exist_ok=True)
        
        self._active_absences = {}
        self._recent_returns = []
        self._return_seq = 0
        self._lock = threading.Lock()
        
        self._load_config()
        self._ensure_exports_dir()
        self._ensure_today_excel()
        self._control_window = None
        
        self._write_shared_state() # Initialize the JSON file

    def set_window(self, control):
        self._control_window = control

    def _write_shared_state(self):
        """Dumps the recent returns into state.json for the HTTP server to serve."""
        state = {
            "recent_returns": self._recent_returns
        }
        try:
            with open(self.shared_dir / "state.json", "w", encoding="utf-8") as f:
                json.dump(state, f)
        except Exception as e:
            print(f"Error writing shared state: {e}")

    # ... [Keep _load_config, _save_config, _today_filename, _excel_path, _ensure_exports_dir, _ensure_today_excel, _write_excel_row, _update_excel_row exactly as they are] ...

    def add_absence(self, name: str) -> dict:
        with self._lock:
            absence_id = str(uuid.uuid4())
            start_time = datetime.now()
            self._active_absences[absence_id] = { "id": absence_id, "name": name, "start_time": start_time }
            
            if openpyxl:
                path = self._excel_path()
                wb = openpyxl.load_workbook(path)
                ws = wb.active
                ws.append([name, start_time.strftime("%Y-%m-%d %H:%M:%S"), None, None])
                wb.save(path)
                
            return {"id": absence_id, "name": name, "start_time": start_time.strftime("%H:%M:%S")}

    def mark_return(self, id: str) -> dict:
        with self._lock:
            absence = self._active_absences.get(id)
            if not absence: return {}
            
            end_time = datetime.now()
            delta = end_time - absence["start_time"]
            duration_mins = round(delta.total_seconds() / 60, 2)
            
            # Update Excel (Simplified logic for brevity)
            if openpyxl:
                path = self._excel_path()
                wb = openpyxl.load_workbook(path)
                ws = wb.active
                start_str = absence["start_time"].strftime("%Y-%m-%d %H:%M:%S")
                for row in ws.iter_rows(min_row=2):
                    if row[0].value == absence["name"] and str(row[1].value) == start_str:
                        row[2].value = end_time.strftime("%Y-%m-%d %H:%M:%S")
                        row[3].value = duration_mins
                        break
                wb.save(path)

            del self._active_absences[id]

            self._return_seq += 1
            now_ts = datetime.now().timestamp()
            self._recent_returns.append({
                "seq": self._return_seq,
                "id": absence["id"],
                "name": absence["name"],
                "ts": now_ts,
                "duration_mins": duration_mins,
            })
            self._recent_returns = [e for e in self._recent_returns if e["ts"] > now_ts - 30]
            
            # UPDATE THE JSON FILE FOR LAPTOP B
            self._write_shared_state()
            return absence

    def get_active_absences(self) -> list[dict]:
        with self._lock:
            now = datetime.now()
            result = []
            for a in self._active_absences.values():
                elapsed = max(0.0, round((now - a["start_time"]).total_seconds() / 60, 2))
                result.append({
                    "id": a["id"], "name": a["name"],
                    "start_time": a["start_time"].strftime("%H:%M:%S"), "elapsed_mins": elapsed,
                })
            return result

    # ... [Keep get_preset_names, save_preset_names, import_presets_excel, download_preset_template unchanged] ...

def main():
    api = AbsenceAPI()
    control_window = webview.create_window(
        title="Control",
        url=str(Path(__file__).parent / "ui" / "control.html"),
        js_api=api, width=500, height=700, resizable=True,
    )
    api.set_window(control_window)
    webview.start(debug=False, gui='qt')

if __name__ == "__main__":
    main()