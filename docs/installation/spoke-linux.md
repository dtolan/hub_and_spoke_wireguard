# Linux Spoke Installation Guide

This guide covers installing WireGuard spokes on Linux systems (Ubuntu, Debian, RHEL, CentOS, Rocky Linux, etc.).

## Prerequisites

- **Linux distribution**: Ubuntu 20.04+, Debian 11+, RHEL 8+, CentOS 8+, Rocky Linux 8+
- **Root access**: sudo privileges required
- **Network connectivity**: Access to hub's public or private endpoint
- **Installation token**: Generated from hub dashboard

See [prerequisites.md](prerequisites.md) for detailed requirements.

---

## Quick Installation

### 1. Generate Installation Token

On the hub dashboard:
1. Navigate to "Installation Tokens"
2. Click "Generate Token"
3. Enter spoke name (e.g., "web-server-01")
4. Select platform: "Linux"
5. Copy the installation command

**Example command**:
```bash
curl -sSL "http://192.168.1.15:5173/api/installation/script/abc123xyz?platform=linux" | sudo bash
```

### 2. Run Installation Command

On the Linux spoke server, run the copied command:

```bash
curl -sSL "http://HUB_IP:5173/api/installation/script/YOUR_TOKEN?platform=linux" | sudo bash
```

**What this script does**:
1. Detects Linux distribution
2. Installs WireGuard if not present
3. Generates local WireGuard keys
4. Registers with hub (sends public key only)
5. Creates `/etc/wireguard/wg0.conf`
6. Starts WireGuard interface
7. Enables systemd service

**Expected output**:

```
===== Linux WireGuard Installation =====
Spoke: web-server-01
Allocated IP: 10.0.1.5

Detecting Linux distribution...
✓ Detected: Ubuntu 22.04

Installing WireGuard...
✓ WireGuard installed

Detecting best endpoint...
✓ Private endpoint reachable: 192.168.1.10:51820

Generating WireGuard keys locally...
✓ Keys generated (public key will be sent to hub)

Registering spoke with hub...
✓ Successfully registered with hub

Creating WireGuard configuration...
✓ Configuration created at /etc/wireguard/wg0.conf

Enabling WireGuard service...
✓ WireGuard enabled and started

===== WireGuard Status =====
interface: wg0
  public key: <your-public-key>
  private key: (hidden)
  listening port: 51820

peer: <hub-public-key>
  endpoint: 192.168.1.10:51820
  allowed ips: 10.0.1.0/24
  latest handshake: 1 second ago
  transfer: 0 B received, 92 B sent
  persistent keepalive: every 25 seconds

✓ Linux spoke configured successfully!

  VPN IP: 10.0.1.5
  Hub: 192.168.1.10:51820

Your server is now connected to the hub.
Check the dashboard to verify the connection status.

Useful commands:
  Show status:  sudo wg show wg0
  Stop VPN:     sudo systemctl stop wg-quick@wg0
  Start VPN:    sudo systemctl start wg-quick@wg0
  Restart VPN:  sudo systemctl restart wg-quick@wg0
```

---

## Manual Installation

If you prefer manual installation or need to customize:

### 1. Install WireGuard

#### Ubuntu/Debian

```bash
sudo apt-get update
sudo apt-get install -y wireguard wireguard-tools resolvconf
```

#### RHEL/CentOS/Rocky Linux 8+

```bash
sudo dnf install -y epel-release
sudo dnf install -y wireguard-tools
```

#### Fedora

```bash
sudo dnf install -y wireguard-tools
```

**Verify installation**:
```bash
wg --version
# Expected: wireguard-tools v1.0.20210914
```

---

### 2. Generate WireGuard Keys

```bash
# Generate private key
wg genkey | sudo tee /etc/wireguard/private.key
sudo chmod 600 /etc/wireguard/private.key

# Generate public key from private key
sudo cat /etc/wireguard/private.key | wg pubkey | sudo tee /etc/wireguard/public.key
```

---

### 3. Get Configuration from Hub

Use the installation token API to register:

```bash
# Store your token
TOKEN="your-installation-token-here"
HUB_API="http://192.168.1.15:3000"

# Get your public key
PUBLIC_KEY=$(sudo cat /etc/wireguard/public.key)

# Register with hub
curl -X POST "$HUB_API/api/installation/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"token\": \"$TOKEN\",
    \"publicKey\": \"$PUBLIC_KEY\",
    \"os\": \"linux\"
  }"
```

The hub will respond with your allocated IP and configuration details.

---

### 4. Create WireGuard Configuration

Create `/etc/wireguard/wg0.conf`:

```bash
sudo tee /etc/wireguard/wg0.conf <<EOF
[Interface]
Address = <your-allocated-ip>/24
PrivateKey = $(sudo cat /etc/wireguard/private.key)
DNS = 1.1.1.1, 1.0.0.1

[Peer]
# Hub
PublicKey = <hub-public-key>
Endpoint = <hub-endpoint>
AllowedIPs = 10.0.1.0/24
PersistentKeepalive = 25
EOF

sudo chmod 600 /etc/wireguard/wg0.conf
```

Replace:
- `<your-allocated-ip>`: IP from hub registration response
- `<hub-public-key>`: Hub's public key
- `<hub-endpoint>`: Hub's public or private endpoint

---

### 5. Start WireGuard

```bash
# Enable systemd service
sudo systemctl enable wg-quick@wg0

# Start WireGuard
sudo systemctl start wg-quick@wg0

# Check status
sudo systemctl status wg-quick@wg0
```

---

## Verification

### 1. Check WireGuard Status

```bash
sudo wg show wg0
```

**Expected output**:
```
interface: wg0
  public key: <your-public-key>
  private key: (hidden)
  listening port: 51820

peer: <hub-public-key>
  endpoint: 192.168.1.10:51820
  allowed ips: 10.0.1.0/24
  latest handshake: 5 seconds ago
  transfer: 1.23 KiB received, 892 B sent
  persistent keepalive: every 25 seconds
```

**Key indicators**:
- **latest handshake**: Should be recent (< 2 minutes)
- **transfer**: Should show data transfer
- **endpoint**: Should show hub's IP:port

---

### 2. Check Interface Status

```bash
ip addr show wg0
```

**Expected output**:
```
4: wg0: <POINTOPOINT,NOARP,UP,LOWER_UP> mtu 1420 qdisc noqueue state UNKNOWN group default qlen 1000
    link/none
    inet 10.0.1.5/24 scope global wg0
       valid_lft forever preferred_lft forever
```

---

### 3. Test Connectivity

```bash
# Ping hub
ping -c 3 10.0.1.1

# Ping another spoke (if any)
ping -c 3 10.0.1.6
```

---

### 4. Check DNS Resolution

```bash
# If DNS configured, test resolution
nslookup google.com
dig google.com
```

---

## Configuration Options

### Enable All Traffic Through VPN

To route ALL traffic through the VPN (not just VPN subnet):

```bash
sudo nano /etc/wireguard/wg0.conf
```

Change `AllowedIPs` to:
```
AllowedIPs = 0.0.0.0/0
```

Then restart:
```bash
sudo systemctl restart wg-quick@wg0
```

---

### Custom DNS Servers

Edit `/etc/wireguard/wg0.conf`:

```
[Interface]
Address = 10.0.1.5/24
PrivateKey = <your-private-key>
DNS = 8.8.8.8, 8.8.4.4

# ... rest of config
```

---

### Automatic Reconnection

WireGuard automatically reconnects, but you can force periodic checks:

```bash
# Add to crontab
(crontab -l 2>/dev/null; echo "*/5 * * * * systemctl is-active --quiet wg-quick@wg0 || systemctl restart wg-quick@wg0") | crontab -
```

---

## Troubleshooting

### WireGuard interface won't start

```bash
# Check for errors
sudo journalctl -u wg-quick@wg0 -n 50

# Verify configuration
sudo wg-quick strip wg0

# Check for syntax errors
sudo wg-quick up wg0
```

---

### No handshake with hub

**Check endpoint reachability**:
```bash
# Test UDP connectivity (if nc available)
nc -u -z -w 2 192.168.1.10 51820
echo $?  # 0 = success

# Ping host
ping -c 3 192.168.1.10
```

**Check firewall**:
```bash
# UFW
sudo ufw status

# iptables
sudo iptables -L -n -v
```

**Common fixes**:
1. Verify hub endpoint is correct in `/etc/wireguard/wg0.conf`
2. Check hub firewall allows UDP 51820
3. Verify public key matches between spoke and hub
4. Check system firewall allows WireGuard

---

### DNS not working

```bash
# Check DNS configuration
resolvectl status wg0

# Verify DNS in config
grep DNS /etc/wireguard/wg0.conf

# Install resolvconf if missing
sudo apt-get install -y resolvconf
sudo systemctl restart wg-quick@wg0
```

---

### Connection drops after some time

**Enable PersistentKeepalive**:
```bash
sudo nano /etc/wireguard/wg0.conf
```

Add to `[Peer]` section:
```
PersistentKeepalive = 25
```

Restart:
```bash
sudo systemctl restart wg-quick@wg0
```

---

### Can't reach other spokes

**Verify hub forwarding is enabled**:
On hub:
```bash
sysctl net.ipv4.ip_forward
# Should be: net.ipv4.ip_forward = 1
```

**Check AllowedIPs includes full subnet**:
```bash
sudo wg show wg0 | grep "allowed ips"
# Should include: 10.0.1.0/24
```

---

## Uninstallation

### 1. Stop and disable WireGuard

```bash
sudo systemctl stop wg-quick@wg0
sudo systemctl disable wg-quick@wg0
```

---

### 2. Remove configuration

```bash
sudo rm /etc/wireguard/wg0.conf
sudo rm /etc/wireguard/private.key
sudo rm /etc/wireguard/public.key
```

---

### 3. Remove WireGuard (optional)

#### Ubuntu/Debian
```bash
sudo apt-get remove --purge wireguard wireguard-tools
```

#### RHEL/CentOS
```bash
sudo dnf remove wireguard-tools
```

---

### 4. Remove spoke from hub

Delete the spoke from the hub dashboard to remove it from the hub's configuration.

---

## Distribution-Specific Notes

### Ubuntu 18.04 (older)

WireGuard may not be in default repositories:

```bash
sudo add-apt-repository ppa:wireguard/wireguard
sudo apt-get update
sudo apt-get install -y wireguard
```

---

### Debian 10 (Buster)

Enable backports:

```bash
echo "deb http://deb.debian.org/debian buster-backports main" | sudo tee /etc/apt/sources.list.d/backports.list
sudo apt-get update
sudo apt-get install -y -t buster-backports wireguard
```

---

### CentOS 7

Requires kernel upgrade:

```bash
# Install ELRepo
sudo rpm --import https://www.elrepo.org/RPM-GPG-KEY-elrepo.org
sudo rpm -Uvh https://www.elrepo.org/elrepo-release-7.el7.elrepo.noarch.rpm

# Install kernel-ml (mainline)
sudo yum --enablerepo=elrepo-kernel install kernel-ml

# Reboot to new kernel
sudo reboot

# Install WireGuard
sudo yum install -y epel-release
sudo yum install -y wireguard-tools
```

---

## Advanced Configuration

### Split Tunnel (route specific subnets)

```bash
sudo nano /etc/wireguard/wg0.conf
```

```
[Peer]
PublicKey = <hub-public-key>
Endpoint = <hub-endpoint>
AllowedIPs = 10.0.1.0/24, 192.168.10.0/24, 172.16.0.0/16
PersistentKeepalive = 25
```

---

### Custom MTU

```bash
[Interface]
Address = 10.0.1.5/24
PrivateKey = <key>
MTU = 1380
```

---

### PostUp/PostDown Scripts

```bash
[Interface]
Address = 10.0.1.5/24
PrivateKey = <key>
PostUp = /etc/wireguard/up.sh
PostDown = /etc/wireguard/down.sh
```

---

## Useful Commands

```bash
# Show interface status
sudo wg show wg0

# Show all WireGuard interfaces
sudo wg show

# Reload configuration without restart
sudo wg syncconf wg0 <(wg-quick strip wg0)

# Monitor handshakes
watch -n 1 'sudo wg show wg0'

# View logs
sudo journalctl -u wg-quick@wg0 -f

# Test connectivity
ping 10.0.1.1  # Hub
mtr 10.0.1.1   # Detailed path analysis

# Check routing
ip route show dev wg0
```

---

## Next Steps

- Monitor connection in [dashboard](../README.md#dashboard)
- Set up [firewall rules](../README.md#firewall-configuration)
- Configure [application routing](../README.md#application-routing)
- See [troubleshooting guide](troubleshooting.md) for common issues

---

## Related Documentation

- [Hub Setup Guide](hub-setup.md)
- [Prerequisites](prerequisites.md)
- [Troubleshooting](troubleshooting.md)
- [Proxmox Spoke Installation](spoke-proxmox.md)
- [Windows Spoke Installation](spoke-windows.md)
