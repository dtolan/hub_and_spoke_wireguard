# Troubleshooting Guide

Common issues and solutions for hub-and-spoke WireGuard deployments.

---

## Table of Contents

- [Hub Issues](#hub-issues)
- [Spoke Issues](#spoke-issues)
- [Connection Problems](#connection-problems)
- [Network Issues](#network-issues)
- [Platform-Specific Issues](#platform-specific-issues)
- [Dashboard Issues](#dashboard-issues)
- [Advanced Diagnostics](#advanced-diagnostics)

---

## Hub Issues

### Hub Won't Initialize

**Symptom**: `npm run hub:init` fails

**Common causes**:

1. **WireGuard not installed**
   ```bash
   # Check installation
   wg --version

   # If missing, install:
   # Ubuntu/Debian
   sudo apt-get install wireguard wireguard-tools

   # RHEL/CentOS
   sudo dnf install wireguard-tools
   ```

2. **Permission denied**
   ```bash
   # Ensure running with sudo
   sudo npm run hub:init

   # Check /etc/wireguard permissions
   ls -la /etc/wireguard/
   sudo chmod 755 /etc/wireguard
   ```

3. **Port already in use**
   ```bash
   # Check if port 51820 is in use
   sudo netstat -tulpn | grep 51820

   # If in use, either:
   # - Stop conflicting service
   # - Use different port in config
   ```

---

### Hub Interface Won't Start

**Symptom**: `wg show wg0` returns error

**Diagnosis**:
```bash
# Check systemd service status
sudo systemctl status wg-quick@wg0

# View logs
sudo journalctl -u wg-quick@wg0 -n 50

# Try manual start
sudo wg-quick up wg0
```

**Common fixes**:

1. **Configuration syntax error**
   ```bash
   # Validate config
   sudo wg-quick strip wg0

   # Check for missing fields
   sudo cat /etc/wireguard/wg0.conf
   ```

2. **IP forwarding disabled**
   ```bash
   # Check forwarding
   sysctl net.ipv4.ip_forward

   # Enable temporarily
   sudo sysctl -w net.ipv4.ip_forward=1

   # Enable permanently
   echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.conf
   sudo sysctl -p
   ```

3. **Firewall blocking**
   ```bash
   # Check UFW
   sudo ufw status
   sudo ufw allow 51820/udp

   # Check iptables
   sudo iptables -L -n -v | grep 51820
   ```

---

### Hub Peers Not Updating

**Symptom**: New spokes register but don't appear in `wg show`

**Diagnosis**:
```bash
# Check if peer in config file
sudo grep -A 3 "PublicKey" /etc/wireguard/wg0.conf

# Check database
sqlite3 data/hub.db "SELECT name, public_key FROM spoke_registrations"
```

**Fix**: Reload WireGuard config
```bash
# Reload without dropping connections
sudo wg syncconf wg0 <(wg-quick strip wg0)

# OR restart (brief interruption)
sudo systemctl restart wg-quick@wg0
```

---

### Backend API Not Responding

**Symptom**: `curl http://localhost:3000/api/health` fails

**Diagnosis**:
```bash
# Check if backend is running
ps aux | grep node

# Check if port is listening
sudo netstat -tulpn | grep 3000

# View backend logs
pm2 logs wireguard-hub
# OR
journalctl -u wireguard-hub -f
```

**Common fixes**:

1. **Backend not started**
   ```bash
   npm run dev:backend
   # OR
   pm2 start dist/backend/index.js --name wireguard-hub
   ```

2. **Port already in use**
   ```bash
   # Find process using port 3000
   sudo lsof -i :3000

   # Kill process or change backend port
   ```

3. **Database permissions**
   ```bash
   # Check database file
   ls -la data/hub.db

   # Fix permissions
   sudo chown $(whoami) data/hub.db
   sudo chmod 644 data/hub.db
   ```

---

## Spoke Issues

### Token Already Used Error

**Symptom**: "This installation token has already been used"

**Cause**: Individual tokens are single-use

**Solutions**:

1. **Generate new token** in dashboard
2. **For clustered Proxmox**: Each node needs its own token
3. **If reinstalling**: Delete old spoke from dashboard first

---

### Token Expired Error

**Symptom**: "Installation token has expired"

**Cause**: Tokens expire after 24 hours by default

**Solution**: Generate new token from dashboard

---

### DNS Resolution Error During Installation

**Symptom**: "Cannot resolve hostname 'vpn.example.com'"

**Common on**: Proxmox, Linux

**Diagnosis**:
```bash
# Test DNS resolution
nslookup vpn.example.com
host vpn.example.com
dig vpn.example.com

# Check DNS servers
cat /etc/resolv.conf
```

**Solutions**:

1. **Use public IP instead of domain**
   - Edit hub config to use IP: `203.0.113.5:51820`
   - Regenerate token

2. **Fix DNS resolution**
   ```bash
   # Add temporary DNS
   echo "nameserver 1.1.1.1" | sudo tee -a /etc/resolv.conf

   # Test again
   nslookup vpn.example.com
   ```

3. **Add hosts entry**
   ```bash
   echo "203.0.113.5 vpn.example.com" | sudo tee -a /etc/hosts
   ```

---

### Proxmox 401 Unauthorized Error

**Symptom**: "401 Unauthorized" when installing packages

**Cause**: Enterprise repository requires subscription

**Solution**: See [PROXMOX_REPO_FIX.md](../../PROXMOX_REPO_FIX.md) or [spoke-proxmox.md](spoke-proxmox.md#fixing-repository-errors-401-unauthorized)

**Quick fix**:
```bash
# Disable enterprise repos
sed -i 's/^deb/#deb/' /etc/apt/sources.list.d/pve-enterprise.list
sed -i 's/^deb/#deb/' /etc/apt/sources.list.d/ceph.list 2>/dev/null || true

# Add community repo
echo "deb http://download.proxmox.com/debian/pve bookworm pve-no-subscription" > /etc/apt/sources.list.d/pve-no-subscription.list

# Update
apt-get update
```

---

### WireGuard Package Not Found

**Symptom**: "E: Unable to locate package wireguard"

**Platform-specific fixes**:

**Ubuntu 18.04**:
```bash
sudo add-apt-repository ppa:wireguard/wireguard
sudo apt-get update
sudo apt-get install wireguard
```

**Debian 10 (Buster)**:
```bash
echo "deb http://deb.debian.org/debian buster-backports main" | sudo tee /etc/apt/sources.list.d/backports.list
sudo apt-get update
sudo apt-get install -y -t buster-backports wireguard
```

**CentOS 7** (requires kernel upgrade):
```bash
sudo rpm --import https://www.elrepo.org/RPM-GPG-KEY-elrepo.org
sudo rpm -Uvh https://www.elrepo.org/elrepo-release-7.el7.elrepo.noarch.rpm
sudo yum --enablerepo=elrepo-kernel install kernel-ml
sudo reboot
sudo yum install -y epel-release
sudo yum install -y wireguard-tools
```

---

## Connection Problems

### No Handshake with Hub

**Symptom**: `latest handshake: (none)` or very old timestamp

**Diagnosis on spoke**:
```bash
# Linux/macOS
wg show wg0
sudo wg show wg0 | grep handshake

# Windows
& 'C:\Program Files\WireGuard\wg.exe' show wg0

# Check WireGuard logs
# Linux
sudo journalctl -u wg-quick@wg0 -f

# Windows
Get-EventLog -LogName Application -Source WireGuard -Newest 10
```

**Common causes and fixes**:

### 1. Firewall Blocking UDP

**Hub side**:
```bash
# UFW
sudo ufw allow 51820/udp
sudo ufw reload

# firewalld
sudo firewall-cmd --permanent --add-port=51820/udp
sudo firewall-cmd --reload

# iptables
sudo iptables -A INPUT -p udp --dport 51820 -j ACCEPT
```

**Spoke side** (if behind firewall):
```bash
# Usually outbound UDP is allowed
# But check firewall rules
sudo ufw status
```

---

### 2. Incorrect Endpoint

**Check spoke config**:
```bash
# Linux/macOS
sudo cat /etc/wireguard/wg0.conf | grep Endpoint

# Windows
notepad "C:\Program Files\WireGuard\Data\Configurations\wg0.conf"
```

**Test endpoint reachability**:
```bash
# Linux/macOS
nc -u -z -w 2 192.168.1.10 51820
echo $?  # 0 = success

# Windows
Test-NetConnection -ComputerName 192.168.1.10 -Port 51820
```

**Fix**: Edit config with correct endpoint, restart WireGuard

---

### 3. NAT/Router Issues

**Symptom**: Works on local network, fails externally

**Solutions**:

1. **Port forwarding on router**:
   - Forward UDP 51820 → Hub's local IP
   - Verify with: https://www.yougetsignal.com/tools/open-ports/

2. **Enable PersistentKeepalive** (NAT traversal):
   ```bash
   # Edit spoke config
   [Peer]
   PersistentKeepalive = 25
   ```

3. **Check router firewall** allows UDP 51820

---

### 4. Public Key Mismatch

**Diagnosis**:
```bash
# On spoke, check configured hub public key
sudo grep PublicKey /etc/wireguard/wg0.conf

# On hub, check actual public key
sudo wg show wg0 | grep "public key"
```

**Fix**: Update spoke config with correct public key

---

### 5. Clock Skew

**Symptom**: Handshake fails immediately

**Check**:
```bash
# Linux/macOS
date

# Windows
Get-Date
```

**Fix**: Sync time
```bash
# Linux
sudo ntpdate pool.ntp.org
# OR
sudo systemctl restart systemd-timesyncd

# Windows
w32tm /resync
```

---

### Handshake Stops After Period of Time

**Symptom**: Initial handshake succeeds, then stops after idle

**Cause**: NAT timeout or keepalive not configured

**Fix**: Enable PersistentKeepalive
```bash
# Edit spoke config
sudo nano /etc/wireguard/wg0.conf

# Add to [Peer] section:
PersistentKeepalive = 25

# Restart
sudo systemctl restart wg-quick@wg0
```

---

### Connection Works Then Breaks After System Sleep

**Platform**: macOS, Windows laptops

**Solution**:

**macOS**:
```bash
# WireGuard auto-reconnects, but you can force:
sudo wg-quick down wg0 && sudo wg-quick up wg0
```

**Windows**:
```powershell
Restart-Service -Name "WireGuardTunnel`$wg0"
```

**Linux** (laptops):
Create systemd sleep hook:
```bash
sudo tee /etc/systemd/system/wg-quick@wg0-resume.service <<'EOF'
[Unit]
Description=Restart WireGuard after suspend
After=suspend.target

[Service]
Type=oneshot
ExecStart=/usr/bin/systemctl restart wg-quick@wg0

[Install]
WantedBy=suspend.target
EOF

sudo systemctl enable wg-quick@wg0-resume.service
```

---

## Network Issues

### Can Ping Hub But Not Other Spokes

**Symptom**: `ping 10.0.1.1` works, but `ping 10.0.1.5` fails

**Cause**: Hub IP forwarding disabled

**Fix on hub**:
```bash
# Check forwarding
sysctl net.ipv4.ip_forward

# Enable
sudo sysctl -w net.ipv4.ip_forward=1

# Make permanent
echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Verify iptables forwarding
sudo iptables -A FORWARD -i wg0 -j ACCEPT
sudo iptables -t nat -A POSTROUTING -o wg0 -j MASQUERADE
```

---

### DNS Not Working

**Symptom**: VPN connected but DNS resolution fails

**Diagnosis**:
```bash
# Linux/macOS
nslookup google.com
dig google.com
cat /etc/resolv.conf

# Windows
nslookup google.com
Get-DnsClientServerAddress
```

**Fixes**:

**Linux**:
```bash
# Install resolvconf if missing
sudo apt-get install resolvconf

# Restart WireGuard
sudo systemctl restart wg-quick@wg0

# Check DNS is set
resolvectl status wg0
```

**Windows**:
```powershell
# Check DNS configuration
Get-DnsClientServerAddress -InterfaceAlias "wg0"

# Flush DNS cache
Clear-DnsClientCache
```

**macOS**:
```bash
# Flush DNS cache
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# Check DNS
scutil --dns | grep -A 3 utun
```

---

### Slow Connection / High Latency

**Diagnosis**:
```bash
# Test latency
ping 10.0.1.1

# Trace route
mtr 10.0.1.1
traceroute 10.0.1.1

# Check transfer stats
wg show wg0
```

**Common causes**:

1. **MTU too large**
   ```bash
   # Edit config
   [Interface]
   MTU = 1380

   # Restart WireGuard
   ```

2. **CPU overload on hub**
   ```bash
   # On hub
   top
   htop

   # Check WireGuard CPU usage
   ```

3. **Network congestion**
   - Test with `iperf3` between hub and spoke
   - Check for packet loss: `ping -c 100 10.0.1.1`

---

### Interface Has Wrong IP

**Symptom**: Expected 10.0.1.5 but got different IP

**Cause**: Config file has wrong IP

**Fix**:
```bash
# Check config
sudo cat /etc/wireguard/wg0.conf | grep Address

# If wrong, edit:
sudo nano /etc/wireguard/wg0.conf

# Change Address line to correct IP
Address = 10.0.1.5/24

# Restart
sudo systemctl restart wg-quick@wg0
```

---

## Platform-Specific Issues

### Linux: resolvconf Missing

**Error**: "resolvconf: command not found"

**Fix**:
```bash
# Ubuntu/Debian
sudo apt-get install resolvconf

# RHEL/CentOS
sudo dnf install systemd-resolved
sudo systemctl enable systemd-resolved
sudo systemctl start systemd-resolved
```

---

### Windows: Service Won't Start

**Error**: "The WireGuard tunnel service failed to start"

**Diagnosis**:
```powershell
# Check service status
Get-Service -Name "WireGuardTunnel`$wg0"

# View Event Viewer
Get-EventLog -LogName Application -Source WireGuard -Newest 10
```

**Common fixes**:

1. **Run as Administrator**

2. **Check configuration path**
   ```powershell
   Test-Path "C:\Program Files\WireGuard\Data\Configurations\wg0.conf"
   ```

3. **Reinstall tunnel**
   ```powershell
   # Uninstall
   & 'C:\Program Files\WireGuard\wireguard.exe' /uninstalltunnelservice wg0

   # Reinstall
   & 'C:\Program Files\WireGuard\wireguard.exe' /installtunnelservice "C:\Program Files\WireGuard\Data\Configurations\wg0.conf"
   ```

---

### macOS: System Extension Blocked

**Symptom**: "System Extension Blocked" notification

**Fix**:
1. System Preferences → Security & Privacy → General
2. Click lock icon (bottom left) to unlock
3. Click "Allow" next to WireGuard system extension
4. Restart WireGuard

---

### Proxmox: Cluster Not Detected

**Symptom**: Script shows "Standalone" but cluster exists

**Diagnosis**:
```bash
# Check cluster status
pvecm status

# Check cluster files
ls -la /etc/pve/
ls -la /etc/corosync/

# Check cluster service
systemctl status pve-cluster
```

**Fix**:
```bash
# Restart cluster service
systemctl restart pve-cluster

# Verify cluster membership
pvecm nodes

# Re-run installation script
```

---

## Dashboard Issues

### Dashboard Won't Load

**Symptom**: Browser shows connection error

**Diagnosis**:
```bash
# Check frontend is running
ps aux | grep vite

# Check port
sudo netstat -tulpn | grep 5173

# Check backend
curl http://localhost:3000/api/health
```

**Fixes**:

1. **Start frontend**
   ```bash
   npm run dev:frontend
   ```

2. **Check firewall**
   ```bash
   sudo ufw allow 5173/tcp
   ```

3. **Check nginx** (production):
   ```bash
   sudo systemctl status nginx
   sudo nginx -t
   ```

---

### Spokes Show as Inactive

**Symptom**: Spoke connected but dashboard shows "Inactive"

**Cause**: Dashboard polls WireGuard status

**Check**:
```bash
# On hub
wg show wg0

# Look for peer with spoke's public key
# Check "latest handshake" timestamp
```

**Refresh**: Dashboard auto-refreshes every 10 seconds

---

### Token Generation Fails

**Symptom**: Can't generate new tokens

**Diagnosis**:
```bash
# Check backend logs
pm2 logs wireguard-hub

# Check database
sqlite3 data/hub.db "SELECT COUNT(*) FROM installation_tokens"
```

**Fix**:
```bash
# Check hub config exists
sqlite3 data/hub.db "SELECT * FROM hub_config"

# If missing, reinitialize hub
sudo npm run hub:init
```

---

## Advanced Diagnostics

### Packet Capture

**Capture WireGuard traffic**:
```bash
# On hub
sudo tcpdump -i any -n udp port 51820 -v

# On spoke
sudo tcpdump -i wg0 -n -v

# Save to file for analysis
sudo tcpdump -i wg0 -w /tmp/wireguard.pcap
```

---

### Debugging WireGuard

**Enable debug logging**:
```bash
# Linux
sudo modprobe wireguard
echo module wireguard +p | sudo tee /sys/kernel/debug/dynamic_debug/control

# View kernel logs
sudo dmesg | grep wireguard
```

---

### Check Routing Table

```bash
# Linux/macOS
ip route show
netstat -rn

# Windows
route print
Get-NetRoute
```

---

### Test Bandwidth

```bash
# Install iperf3
sudo apt-get install iperf3

# On hub
iperf3 -s

# On spoke
iperf3 -c 10.0.1.1
```

---

### Check for IP Conflicts

```bash
# On hub, show all allocated IPs
sudo wg show wg0 | grep "allowed ips"

# Check database
sqlite3 data/hub.db "SELECT name, allowed_ips FROM spoke_registrations"

# Ensure no duplicates
```

---

## Getting Help

If you're still experiencing issues:

1. **Gather diagnostics**:
   ```bash
   # On affected system
   wg show wg0
   ip addr show wg0
   sudo journalctl -u wg-quick@wg0 -n 100
   ```

2. **Check logs**:
   - Hub backend: `pm2 logs wireguard-hub`
   - WireGuard: `sudo journalctl -u wg-quick@wg0`
   - System: `dmesg | grep wireguard`

3. **Provide details**:
   - Platform (Linux distro, Windows version, etc.)
   - WireGuard version: `wg --version`
   - Error messages
   - Configuration (sanitized, no private keys)

4. **Resources**:
   - WireGuard documentation: https://www.wireguard.com/
   - WireGuard mailing list: https://lists.zx2c4.com/mailman/listinfo/wireguard
   - Project issues: [GitHub Issues](https://github.com/yourusername/hub_and_spoke_wireguard/issues)

---

## Quick Reference: Common Commands

### Status Checks
```bash
# Show WireGuard status
wg show wg0

# Show interface
ip addr show wg0  # Linux/macOS
Get-NetAdapter | Where-Object {$_.InterfaceDescription -like "*WireGuard*"}  # Windows

# Test connectivity
ping 10.0.1.1

# Check logs
sudo journalctl -u wg-quick@wg0 -f  # Linux
Get-EventLog -LogName Application -Source WireGuard  # Windows
```

### Restart Commands
```bash
# Linux
sudo systemctl restart wg-quick@wg0

# macOS
sudo wg-quick down wg0 && sudo wg-quick up wg0

# Windows
Restart-Service -Name "WireGuardTunnel`$wg0"
```

### Configuration
```bash
# Edit config
sudo nano /etc/wireguard/wg0.conf  # Linux/macOS
notepad "C:\Program Files\WireGuard\Data\Configurations\wg0.conf"  # Windows

# Reload config (Linux, no connection drop)
sudo wg syncconf wg0 <(wg-quick strip wg0)
```

---

## Related Documentation

- [Hub Setup Guide](hub-setup.md)
- [Linux Spoke Installation](spoke-linux.md)
- [Windows Spoke Installation](spoke-windows.md)
- [macOS Spoke Installation](spoke-macos.md)
- [Proxmox Spoke Installation](spoke-proxmox.md)
- [Prerequisites](prerequisites.md)
