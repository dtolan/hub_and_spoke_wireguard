# macOS Spoke Installation Guide

This guide covers installing WireGuard spokes on macOS systems (macOS 10.14+).

## Prerequisites

- **macOS version**: macOS 10.14 (Mojave) or higher
- **Administrator access**: sudo privileges required
- **Network connectivity**: Access to hub's public or private endpoint
- **Installation token**: Generated from hub dashboard
- **Homebrew** (recommended): For easier installation

See [prerequisites.md](prerequisites.md) for detailed requirements.

---

## Quick Installation

### 1. Generate Installation Token

On the hub dashboard:
1. Navigate to "Installation Tokens"
2. Click "Generate Token"
3. Enter spoke name (e.g., "macbook-pro-01")
4. Select platform: "macOS"
5. Copy the installation command

**Example command**:
```bash
curl -sSL "http://192.168.1.15:5173/api/installation/script/abc123xyz?platform=macos" | bash
```

---

### 2. Run Installation Command

Open Terminal and run the copied command:

```bash
curl -sSL "http://HUB_IP:5173/api/installation/script/YOUR_TOKEN?platform=macos" | bash
```

**What this script does**:
1. Detects macOS version
2. Installs WireGuard via Homebrew (if not present)
3. Generates local WireGuard keys
4. Registers with hub (sends public key only)
5. Creates WireGuard configuration
6. Installs and starts tunnel

---

### 3. Expected Output

```
===== macOS WireGuard Installation =====
Spoke: macbook-pro-01
Allocated IP: 10.0.1.30

Detecting macOS version...
✓ Detected: macOS 13.5 (Ventura)

Checking Homebrew installation...
✓ Homebrew installed

Installing WireGuard...
✓ WireGuard installed

Detecting best endpoint...
✓ Private endpoint reachable: 192.168.1.10:51820

Generating WireGuard keys locally...
✓ Keys generated (public key will be sent to hub)

Registering spoke with hub...
✓ Successfully registered with hub

Creating WireGuard configuration...
✓ Configuration created at /usr/local/etc/wireguard/wg0.conf

Starting WireGuard tunnel...
✓ WireGuard tunnel started

===== WireGuard Status =====
interface: utun3
  public key: <your-public-key>
  private key: (hidden)
  listening port: 51820

peer: <hub-public-key>
  endpoint: 192.168.1.10:51820
  allowed ips: 10.0.1.0/24
  latest handshake: 2 seconds ago
  transfer: 0 B received, 92 B sent
  persistent keepalive: every 25 seconds

✓ macOS spoke configured successfully!

  VPN IP: 10.0.1.30
  Hub: 192.168.1.10:51820

Your Mac is now connected to the hub.
Check the dashboard to verify the connection status.

Useful commands:
  Show status:  wg show utun3
  Stop VPN:     wg-quick down wg0
  Start VPN:    wg-quick up wg0
  Use GUI:      Open WireGuard app from Applications
```

---

## Manual Installation

If you prefer manual installation or need to customize:

### 1. Install Homebrew (if not installed)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

---

### 2. Install WireGuard

#### Option A: Command Line Tools (Recommended for servers)

```bash
# Install wireguard-tools
brew install wireguard-tools

# Verify installation
wg --version
```

---

#### Option B: GUI Application (Recommended for desktops)

```bash
# Install WireGuard GUI app
brew install --cask wireguard-tools

# Or download from App Store
# https://apps.apple.com/us/app/wireguard/id1451685025
```

---

### 3. Generate WireGuard Keys

```bash
# Create WireGuard directory
sudo mkdir -p /usr/local/etc/wireguard
sudo chmod 700 /usr/local/etc/wireguard

# Generate private key
wg genkey | sudo tee /usr/local/etc/wireguard/private.key
sudo chmod 600 /usr/local/etc/wireguard/private.key

# Generate public key
sudo cat /usr/local/etc/wireguard/private.key | wg pubkey | sudo tee /usr/local/etc/wireguard/public.key
```

---

### 4. Register with Hub

```bash
TOKEN="your-installation-token"
HUB_API="http://192.168.1.15:3000"
PUBLIC_KEY=$(sudo cat /usr/local/etc/wireguard/public.key)

# Register
curl -X POST "$HUB_API/api/installation/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"token\": \"$TOKEN\",
    \"publicKey\": \"$PUBLIC_KEY\",
    \"os\": \"macos\",
    \"wireguardVersion\": \"$(wg --version | head -n1)\"
  }"
```

The hub will respond with your allocated IP and configuration details.

---

### 5. Create WireGuard Configuration

```bash
PRIVATE_KEY=$(sudo cat /usr/local/etc/wireguard/private.key)

sudo tee /usr/local/etc/wireguard/wg0.conf <<EOF
[Interface]
Address = <your-allocated-ip>/24
PrivateKey = $PRIVATE_KEY
DNS = 1.1.1.1, 1.0.0.1

[Peer]
# Hub
PublicKey = <hub-public-key>
Endpoint = <hub-endpoint>
AllowedIPs = 10.0.1.0/24
PersistentKeepalive = 25
EOF

sudo chmod 600 /usr/local/etc/wireguard/wg0.conf
```

Replace:
- `<your-allocated-ip>`: IP from hub registration response
- `<hub-public-key>`: Hub's public key
- `<hub-endpoint>`: Hub's public or private endpoint

---

### 6. Start WireGuard

#### Option A: Command Line

```bash
# Start tunnel
sudo wg-quick up wg0

# Check status
wg show
```

---

#### Option B: GUI Application

1. **Open WireGuard app** from Applications
2. **Import tunnel**:
   - Click "Import tunnel(s) from file"
   - Navigate to `/usr/local/etc/wireguard/wg0.conf`
   - Click "Open"
3. **Activate tunnel**:
   - Toggle the switch next to "wg0"
   - OR click "Activate"

---

## Verification

### 1. Check WireGuard Status

```bash
wg show
```

**Expected output**:
```
interface: utun3
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

**Note**: macOS uses `utun` interfaces (utun0, utun1, utun3, etc.) instead of `wg0`.

---

### 2. Check Interface

```bash
ifconfig | grep -A 5 utun
```

**Expected output**:
```
utun3: flags=8051<UP,POINTOPOINT,RUNNING,MULTICAST> mtu 1420
    inet 10.0.1.30 --> 10.0.1.30 netmask 0xffffff00
```

---

### 3. Test Connectivity

```bash
# Ping hub
ping -c 3 10.0.1.1

# Ping another spoke (if any)
ping -c 3 10.0.1.5

# Trace route to hub
traceroute 10.0.1.1
```

---

### 4. Check DNS Resolution

```bash
# Check DNS servers
scutil --dns | grep -A 3 utun

# Test DNS resolution
nslookup google.com
dig google.com
```

---

## WireGuard GUI Application

### Using the GUI

The WireGuard GUI provides an easy-to-use interface:

1. **Launch WireGuard**:
   - Applications → WireGuard
   - OR menu bar icon (if running)

2. **Import Configuration**:
   - Click "+" → "Add empty tunnel"
   - OR "Import tunnel(s) from file"

3. **Activate Tunnel**:
   - Toggle switch next to tunnel name
   - OR click "Activate"

4. **View Status**:
   - Shows:
     - Status (Active/Inactive)
     - Transfer statistics
     - Peer information
     - Latest handshake
     - Real-time graphs

5. **Edit Configuration**:
   - Click "Edit"
   - Modify settings
   - Click "Save"

---

### GUI vs Command Line

**GUI Advantages**:
- Visual interface
- Easy tunnel management
- Real-time statistics
- Quick on/off toggle

**Command Line Advantages**:
- Scriptable
- Remote management
- Automation
- System service integration

---

## Configuration Options

### Route All Traffic Through VPN

To route ALL traffic through VPN (not just VPN subnet):

Edit `/usr/local/etc/wireguard/wg0.conf`:

```
[Peer]
PublicKey = <hub-public-key>
Endpoint = <hub-endpoint>
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
```

Restart:
```bash
sudo wg-quick down wg0
sudo wg-quick up wg0
```

---

### Custom DNS Servers

Edit configuration:

```
[Interface]
Address = 10.0.1.30/24
PrivateKey = <your-private-key>
DNS = 8.8.8.8, 8.8.4.4
```

---

### Split Tunnel (Specific Routes)

Route only specific subnets:

```
[Peer]
PublicKey = <hub-public-key>
Endpoint = <hub-endpoint>
AllowedIPs = 10.0.1.0/24, 192.168.10.0/24, 172.16.0.0/16
PersistentKeepalive = 25
```

---

## Auto-Start on Login

### Option A: Launch Agent (Recommended)

Create a launch agent to start WireGuard on login:

```bash
# Create launch agent
sudo tee /Library/LaunchDaemons/com.wireguard.wg0.plist <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.wireguard.wg0</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/wg-quick</string>
        <string>up</string>
        <string>wg0</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardErrorPath</key>
    <string>/var/log/wireguard.err</string>
    <key>StandardOutPath</key>
    <string>/var/log/wireguard.out</string>
</dict>
</plist>
EOF

# Load launch agent
sudo launchctl load /Library/LaunchDaemons/com.wireguard.wg0.plist
```

---

### Option B: GUI "Connect on Demand"

In WireGuard GUI app:
1. Right-click tunnel name
2. Select "Activate on Demand"
3. Configure rules (optional)

---

## Troubleshooting

### Tunnel Won't Start

```bash
# Check for errors
sudo wg-quick up wg0

# Verify configuration syntax
wg-quick strip wg0

# Check logs
log show --predicate 'process == "WireGuard"' --last 5m
```

---

### No Handshake with Hub

**Check endpoint reachability**:
```bash
# Test connectivity
nc -u -z -w 2 192.168.1.10 51820
echo $?  # 0 = success

# Ping host
ping -c 3 192.168.1.10
```

**Check macOS firewall**:
```bash
# Check firewall status
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# Add WireGuard to allowed apps
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/local/bin/wg-quick
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblock /usr/local/bin/wg-quick
```

---

### DNS Not Working

```bash
# Check DNS configuration
scutil --dns

# Flush DNS cache
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# Test DNS resolution
nslookup google.com
```

---

### Permission Errors

```bash
# Fix WireGuard directory permissions
sudo chmod 700 /usr/local/etc/wireguard
sudo chmod 600 /usr/local/etc/wireguard/*.conf
sudo chmod 600 /usr/local/etc/wireguard/*.key
```

---

### Interface Name Issues

macOS uses `utun` interfaces instead of `wg0`. To find your interface:

```bash
# Show all WireGuard interfaces
wg show

# Show all utun interfaces
ifconfig | grep utun
```

---

### Homebrew Not Found

If `wg` command not found after Homebrew install:

```bash
# Add Homebrew to PATH (Apple Silicon)
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"

# Add Homebrew to PATH (Intel)
echo 'eval "$(/usr/local/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/usr/local/bin/brew shellenv)"

# Verify
which wg
```

---

## Uninstallation

### 1. Stop WireGuard

```bash
# Stop tunnel
sudo wg-quick down wg0

# Remove launch agent (if configured)
sudo launchctl unload /Library/LaunchDaemons/com.wireguard.wg0.plist
sudo rm /Library/LaunchDaemons/com.wireguard.wg0.plist
```

---

### 2. Remove Configuration

```bash
sudo rm /usr/local/etc/wireguard/wg0.conf
sudo rm /usr/local/etc/wireguard/private.key
sudo rm /usr/local/etc/wireguard/public.key
```

---

### 3. Uninstall WireGuard (optional)

```bash
# Remove command line tools
brew uninstall wireguard-tools

# Remove GUI app
brew uninstall --cask wireguard-tools
# OR delete from Applications folder
```

---

### 4. Remove from Dashboard

Delete the spoke from the hub dashboard.

---

## macOS-Specific Notes

### Apple Silicon (M1/M2/M3)

WireGuard works natively on Apple Silicon Macs. No Rosetta required.

```bash
# Verify native installation
file $(which wg)
# Should show: Mach-O 64-bit executable arm64
```

---

### Network Extension Permissions

First time running WireGuard, macOS will prompt for permissions:

1. **System Extension** approval:
   - System Preferences → Security & Privacy → General
   - Click "Allow" next to WireGuard system extension

2. **Network Extension** approval:
   - macOS will prompt: "WireGuard wants to add VPN configurations"
   - Click "Allow"

---

### Keychain Access

WireGuard may request Keychain access:
- Click "Always Allow" to avoid repeated prompts
- Private keys are stored in `/usr/local/etc/wireguard/`, not Keychain

---

### Sleep/Wake Behavior

WireGuard automatically reconnects after sleep. To verify:

```bash
# Monitor handshakes after wake
watch -n 1 'wg show | grep handshake'
```

---

## Advanced Configuration

### Custom MTU

```
[Interface]
Address = 10.0.1.30/24
PrivateKey = <key>
MTU = 1380
```

---

### Pre/Post Scripts

```
[Interface]
Address = 10.0.1.30/24
PrivateKey = <key>
PreUp = echo "Starting VPN..."
PostUp = echo "VPN started" && /path/to/script.sh
PreDown = echo "Stopping VPN..."
PostDown = echo "VPN stopped"
```

---

### Multiple Tunnels

Manage multiple WireGuard tunnels:

```bash
# Create configurations
sudo nano /usr/local/etc/wireguard/wg0.conf
sudo nano /usr/local/etc/wireguard/wg1.conf

# Start both
sudo wg-quick up wg0
sudo wg-quick up wg1

# Show all
wg show
```

---

## Useful Commands

```bash
# Show WireGuard status
wg show

# Show specific tunnel
wg show utun3

# Start tunnel
sudo wg-quick up wg0

# Stop tunnel
sudo wg-quick down wg0

# Restart tunnel
sudo wg-quick down wg0 && sudo wg-quick up wg0

# Show network interfaces
ifconfig | grep -A 5 utun

# Show routing table
netstat -nr | grep utun

# Monitor connection
watch -n 1 'wg show'

# Test connectivity
ping 10.0.1.1  # Hub
mtr 10.0.1.1   # Path analysis

# Check DNS
scutil --dns | grep -A 3 utun

# View system logs
log show --predicate 'process == "WireGuard"' --info --last 1h
```

---

## GUI vs CLI Comparison

| Feature | GUI App | Command Line |
|---------|---------|--------------|
| Setup | Drag & drop config | Edit text files |
| Start/Stop | One-click toggle | `wg-quick up/down` |
| Status | Visual dashboard | `wg show` |
| Auto-start | Built-in option | Launch agent |
| Statistics | Real-time graphs | Text output |
| Remote management | No | Yes (via SSH) |
| Scripting | No | Yes |
| Best for | Desktop Macs | Servers, automation |

---

## Next Steps

- Monitor connection in [dashboard](../README.md#dashboard)
- Configure [application routing](../README.md#application-routing)
- Set up [auto-start on login](#auto-start-on-login)
- See [troubleshooting guide](troubleshooting.md) for more issues

---

## Related Documentation

- [Hub Setup Guide](hub-setup.md)
- [Linux Spoke Installation](spoke-linux.md)
- [Windows Spoke Installation](spoke-windows.md)
- [Proxmox Spoke Installation](spoke-proxmox.md)
- [Prerequisites](prerequisites.md)
- [Troubleshooting](troubleshooting.md)
