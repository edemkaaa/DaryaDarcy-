#!/bin/sh
echo CONNECTED
uname -a
echo '--- os ---'
cat /etc/os-release | head -6
echo '--- disk ---'
df -h /
echo '--- mem ---'
free -h
echo '--- bins ---'
command -v node; node -v 2>/dev/null
command -v npm; npm -v 2>/dev/null
command -v nginx; nginx -v 2>/dev/null
command -v pm2; pm2 -v 2>/dev/null
command -v docker; docker -v 2>/dev/null
command -v git; git --version 2>/dev/null
echo '--- ports ---'
ss -tlnp 2>/dev/null || netstat -tlnp
echo '--- dirs ---'
ls -la /var/www /root /opt /home 2>/dev/null
echo '--- firewall ---'
ufw status 2>/dev/null
echo DONE
