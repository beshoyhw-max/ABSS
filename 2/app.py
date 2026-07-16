import os
import urllib.request
import json
from pathlib import Path

os.environ["QT_API"] = "pyside6"
os.environ["PYWEBVIEW_GUI"] = "qt"
import webview

# ========== CONFIGURATION ==========
# Change this to the IP address of Laptop A
CONTROL_IP = "192.168.1.15" 
# ===================================

class DisplayAPI:
    def __init__(self):
        self._display_window = None
        self.control_url = f"http://{CONTROL_IP}:8000/state.json"

    def set_window(self, display):
        self._display_window = display

    def get_new_returns(self, since_seq: int = 0) -> list[dict]:
        """Fetches the state.json from Laptop A and filters for new returns."""
        try:
            with urllib.request.urlopen(self.control_url, timeout=2) as response:
                data = json.loads(response.read().decode('utf-8'))
            
            recent = data.get("recent_returns", [])
            return [e for e in recent if e.get("seq", 0) > since_seq]
        except Exception as e:
            # Silently handle network errors if Laptop A's server drops temporarily
            return []

    # Keeping window movement logic
    def resize_display(self, width, height):
        if self._display_window:
            self._display_window.resize(int(width), int(height))

    def move_window(self, dx, dy):
        if self._display_window:
            self._display_window.move(int(self._display_window.x + dx), int(self._display_window.y + dy))

def main():
    api = DisplayAPI()
    base_dir = Path(__file__).parent
    
    display_window = webview.create_window(
        title="Display",
        url=str(base_dir / "ui" / "display.html"),
        js_api=api,
        width=320, height=80, min_size=(150, 36),
        frameless=True, easy_drag=False, on_top=True, resizable=True, transparent=True
    )
    
    api.set_window(display_window)
    webview.start(debug=False, gui='qt')

if __name__ == "__main__":
    main()