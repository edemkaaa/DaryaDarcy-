# Исторически меняет локальную маршрутизацию hidemy.name для VPS. Это настройка сети компьютера, а не исправление приложения.
"""Add daryadarcy VPS to hidemy.name OpenVPN routing (bypass VPN)."""
from __future__ import annotations

import json
import pathlib
import shutil
import xml.etree.ElementTree as ET
from datetime import datetime

VPS_IP = "200.165.234.36"
VPS_DOMAIN = "daryadarcy.com"

CONFIG = pathlib.Path(
    r"C:/Users/Иван/AppData/Local/hidemy.name_VPN_3.0/"
    r"hidemy.name_VPN_3.0_Path_lwiqwgy0mhdkyy2q4gg50la4vbmip3vk/3.3.246.0/user.config"
)

# Observed hidemy.name format (OpenVPN tab -> without VPN):
# Host + IsVpnEnabled=false. Domain resolves at connect time.
ROUTES = [
    {"Host": VPS_IP, "IsVpnEnabled": False},
    {"Host": VPS_DOMAIN, "IsVpnEnabled": False},
]


# Меняет только конкретный Windows-конфиг VPN после создания соседней резервной копии; маршруты телефона этим не исправляются.
def main() -> None:
    if not CONFIG.exists():
        raise SystemExit(f"Config not found: {CONFIG}")

    backup = CONFIG.with_suffix(f".bak-{datetime.now().strftime('%Y%m%d-%H%M%S')}")
    shutil.copy2(CONFIG, backup)
    print(f"Backup: {backup}")

    tree = ET.parse(CONFIG)
    routes_el = tree.find(".//setting[@name='RoutesJson']/value")
    if routes_el is None:
        raise SystemExit("RoutesJson setting not found")

    print("Old RoutesJson:", routes_el.text)
    routes_el.text = json.dumps(ROUTES, ensure_ascii=False)
    tree.write(CONFIG, encoding="utf-8", xml_declaration=True)
    print("New RoutesJson:", routes_el.text)
    print("Reconnect hidemy.name VPN (disconnect -> connect).")


if __name__ == "__main__":
    main()
