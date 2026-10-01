#!/bin/bash
# Paste into Timeweb VPS web console (root). Diagnose why SSH from outside fails.
set -u

echo "========== $(date -Is) SSH DIAG =========="
echo "=== HOST / IP ==="
hostname -f 2>/dev/null || hostname
ip -4 addr show scope global 2>/dev/null | awk '/inet /{print $2, $NF}'
ip -6 addr show scope global 2>/dev/null | awk '/inet6 /{print $2, $NF}' | head -5

echo "=== SSH SERVICE ==="
systemctl is-active ssh 2>/dev/null || systemctl is-active sshd 2>/dev/null || echo "ssh unit unknown"
systemctl status ssh --no-pager -l 2>/dev/null | head -12 || systemctl status sshd --no-pager -l 2>/dev/null | head -12

echo "=== PORT 22 LISTENING ==="
ss -tlnp | grep -E ':22\b' || netstat -tlnp 2>/dev/null | grep ':22' || echo "port 22 NOT listening"

echo "=== SSH CONFIG (key lines) ==="
grep -E '^(Port|ListenAddress|PermitRootLogin|PasswordAuthentication|PubkeyAuthentication|AllowUsers|DenyUsers)' \
  /etc/ssh/sshd_config 2>/dev/null || true

echo "=== UFW ==="
if command -v ufw >/dev/null; then
  ufw status verbose 2>/dev/null || ufw status
else
  echo "ufw not installed"
fi

echo "=== IPTABLES (filter INPUT) ==="
iptables -S INPUT 2>/dev/null | head -20 || echo "iptables unavailable"

echo "=== NFTABLES ==="
nft list ruleset 2>/dev/null | head -40 || echo "nftables empty/unavailable"

echo "=== FAIL2BAN ==="
if command -v fail2ban-client >/dev/null; then
  fail2ban-client status 2>/dev/null || true
  fail2ban-client status sshd 2>/dev/null || fail2ban-client status ssh 2>/dev/null || true
else
  echo "fail2ban not installed"
fi

echo "=== RECENT SSH AUTH (last 30) ==="
journalctl -u ssh -u sshd --no-pager -n 30 2>/dev/null \
  || tail -30 /var/log/auth.log 2>/dev/null \
  || tail -30 /var/log/secure 2>/dev/null \
  || echo "no auth logs found"

echo "=== LOCAL SSH SELF-TEST ==="
ssh -o BatchMode=yes -o ConnectTimeout=3 -o StrictHostKeyChecking=no root@127.0.0.1 echo ok 2>&1 || true

echo "=== NGINX / API (local) ==="
curl -sS --max-time 5 http://127.0.0.1:3000/api/health 2>&1 || echo "api not on 3000"
curl -sS --max-time 5 -o /dev/null -w "nginx localhost: %{http_code}\n" http://127.0.0.1/ 2>&1 || true

echo "=== PM2 ==="
pm2 list 2>/dev/null | head -10 || echo "pm2 not running"

echo "========== END DIAG =========="
echo ""
echo "If UFW is active and 22/tcp is missing, run:"
echo "  ufw allow OpenSSH && ufw allow 22/tcp && ufw reload"
echo "Also check Timeweb panel: VPS -> Firewall -> allow TCP 22"
