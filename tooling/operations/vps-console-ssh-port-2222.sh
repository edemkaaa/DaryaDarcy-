#!/bin/bash
# Исторически добавляет дополнительный SSH-порт на сервере. Изменение доступных портов требует проверки firewall и согласования доступа.
# Timeweb web console (root): SSH on port 2222 in addition to 22 (VPN often blocks 22 only).
set -e
CFG=/etc/ssh/sshd_config
if ! grep -qE '^Port 2222\b' "$CFG"; then
  echo 'Port 2222' >> "$CFG"
  echo "added Port 2222 to sshd_config"
fi
ufw allow 2222/tcp comment 'SSH alt for VPN'
sshd -t
systemctl restart ssh
echo "=== listening ==="
ss -tlnp | grep sshd
echo "Connect from PC: ssh -p 2222 root@200.165.234.36"
