from __future__ import annotations

import uuid
import os
import threading
from datetime import datetime
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional
import json

import webview

try:
    import openpyxl
    from openpyxl import Workbook
except ImportError:
    openpyxl = None
    Workbook = None


@dataclass
class Absence:
    id: str
    name: str
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_mins: Optional[float] = None


class AbsenceAPI:
    def __init__(self):
        self.base_dir = Path(__file__).parent
        self.config_path = self.base_dir / "config.json"
        self.exports_dir = self.base_dir / "exports"
        self._active_absences: dict[str, Absence] = {}
        self._lock = threading.Lock()
        self._load_config()
        self._ensure_exports_dir()
        self._ensure_today_excel()

    def _load_config(self) -> None:
        if self.config_path.exists():
            with open(self.config_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.preset_names: list[str] = data.get("preset_names", [])
        else:
            self.preset_names = []

    def _save_config(self) -> None:
        with open(self.config_path, "w", encoding="utf-8") as f:
            json.dump({"preset_names": self.preset_names}, f, indent=2)

    def _today_filename(self) -> str:
        return f"absences_{datetime.now().strftime('%Y-%m-%d')}.xlsx"

    def _excel_path(self) -> Path:
        return self.exports_dir / self._today_filename()

    def _ensure_exports_dir(self) -> None:
        self.exports_dir.mkdir(parents=True, exist_ok=True)

    def _ensure_today_excel(self) -> None:
        if openpyxl is None:
            return
        path = self._excel_path()
        if path.exists() and path.stat().st_size > 0:
            return
        wb = Workbook()
        ws = wb.active
        ws.title = "Absences"
        ws.append(["Name", "Start Time", "End Time", "Duration (min)"])
        wb.save(path)

    def _write_excel_row(self, absence: Absence) -> None:
        if openpyxl is None:
            return
        path = self._excel_path()
        wb = openpyxl.load_workbook(path)
        ws = wb.active
        start_str = absence.start_time.strftime("%Y-%m-%d %H:%M:%S")
        ws.append([absence.name, start_str, None, None])
        wb.save(path)

    def _update_excel_row(self, absence: Absence) -> None:
        if openpyxl is None:
            return
        path = self._excel_path()
        wb = openpyxl.load_workbook(path)
        ws = wb.active
        start_str = absence.start_time.strftime("%Y-%m-%d %H:%M:%S")
        for row in ws.iter_rows(min_row=2):
            cell_val = row[1].value
            if isinstance(cell_val, datetime):
                cell_str = cell_val.strftime("%Y-%m-%d %H:%M:%S")
            else:
                cell_str = str(cell_val) if cell_val is not None else ""
            if row[0].value == absence.name and cell_str == start_str:
                if absence.end_time is not None:
                    row[2].value = absence.end_time.strftime("%Y-%m-%d %H:%M:%S")
                if absence.duration_mins is not None:
                    row[3].value = absence.duration_mins
                break
        wb.save(path)

    def add_absence(self, name: str) -> dict:
        with self._lock:
            absence = Absence(
                id=str(uuid.uuid4()),
                name=name,
                start_time=datetime.now(),
            )
            self._active_absences[absence.id] = absence
            self._write_excel_row(absence)
            return {
                "id": absence.id,
                "name": absence.name,
                "start_time": absence.start_time.strftime("%H:%M:%S"),
            }

    def mark_return(self, id: str) -> dict:
        with self._lock:
            absence = self._active_absences.get(id)
            if absence is None:
                return {}
            absence.end_time = datetime.now()
            if absence.start_time:
                delta = absence.end_time - absence.start_time
                absence.duration_mins = round(delta.total_seconds() / 60, 2)
            try:
                self._update_excel_row(absence)
            except Exception:
                raise
            result = {
                "id": absence.id,
                "name": absence.name,
                "start_time": absence.start_time.isoformat(),
                "end_time": absence.end_time.isoformat(),
                "duration_mins": absence.duration_mins,
            }
            del self._active_absences[id]
            return result

    def get_active_absences(self) -> list[dict]:
        with self._lock:
            now = datetime.now()
            result = []
            for absence in self._active_absences.values():
                elapsed = 0.0
                if absence.start_time:
                    elapsed = max(0.0, round((now - absence.start_time).total_seconds() / 60, 2))
                result.append({
                    "id": absence.id,
                    "name": absence.name,
                    "start_time": absence.start_time.strftime("%H:%M:%S"),
                    "elapsed_mins": elapsed,
                })
            return result

    def get_preset_names(self) -> list[str]:
        return list(self.preset_names)

    def save_preset_names(self, names: list[str]) -> None:
        self.preset_names = list(names)
        self._save_config()


def main():
    api = AbsenceAPI()
    windows = [
        webview.create_window("Control", "ui/control.html", width=500, height=700, resizable=True, js_api=api),
        webview.create_window("Display", "ui/display.html", width=600, height=400, frameless=True, resizable=True, js_api=api),
    ]
    webview.start(debug=True, http_server=True)


if __name__ == "__main__":
    main()