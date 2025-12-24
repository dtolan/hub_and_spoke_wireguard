# Windows Spoke Installation Guide

This guide covers installing WireGuard spokes on Windows systems (Windows 10, Windows 11, Windows Server 2016+).

## Prerequisites

- **Windows version**: Windows 10 (1809+), Windows 11, or Windows Server 2016+
- **Administrator access**: PowerShell must be run as Administrator
- **Network connectivity**: Access to hub's public or private endpoint
- **Installation token**: Generated from hub dashboard

See [prerequisites.md](prerequisites.md) for detailed requirements.

---

## Quick Installation

### 1. Generate Installation Token

On the hub dashboard:
1. Navigate to "Installation Tokens"
2. Click "Generate Token"
3. Enter spoke name (e.g., "windows-desktop-01")
4. Select platform: "Windows"
5. Copy the installation command

**Example command**:
```powershell
Invoke-Expression (Invoke-WebRequest -Uri "http://192.168.1.15:5173/api/installation/script/abc123xyz?platform=windows" -UseBasicParsing).Content
```

---

### 2. Run Installation Command

**Open PowerShell as Administrator**:
1. Right-click Start menu
2. Select "Windows PowerShell (Admin)" or "Terminal (Admin)"

Run the copied command:

```powershell
Invoke-Expression (Invoke-WebRequest -Uri "http://HUB_IP:5173/api/installation/script/YOUR_TOKEN?platform=windows" -UseBasicParsing).Content
```

**What this script does**:
1. Detects Windows version
2. Downloads and installs WireGuard
3. Generates local WireGuard keys
4. Registers with hub (sends public key only)
5. Creates WireGuard tunnel configuration
6. Installs and starts tunnel service

---

### 3. Expected Output

```
===== Windows WireGuard Installation =====
Spoke: windows-desktop-01
Allocated IP: 10.0.1.20

Detecting Windows version...
✓ Detected: Windows 11 Pro (Build 22621)

Checking WireGuard installation...
Downloading WireGuard installer...
✓ WireGuard installer downloaded

Installing WireGuard...
✓ WireGuard installed successfully

Detecting best endpoint...
✓ Private endpoint reachable: 192.168.1.10:51820

Generating WireGuard keys locally...
✓ Keys generated (public key will be sent to hub)

Registering spoke with hub...
✓ Successfully registered with hub

Creating WireGuard tunnel configuration...
✓ Configuration created

Installing WireGuard tunnel service...
✓ Tunnel service installed and started

===== WireGuard Status =====
interface: wg0
  public key: <your-public-key>
  private key: (hidden)
  listening port: 51820

peer: <hub-public-key>
  endpoint: 192.168.1.10:51820
  allowed ips: 10.0.1.0/24
  latest handshake: 2 seconds ago
  transfer: 0 B received, 92 B sent
  persistent keepalive: every 25 seconds

✓ Windows spoke configured successfully!

  VPN IP: 10.0.1.20
  Hub: 192.168.1.10:51820

Your Windows system is now connected to the hub.
Check the dashboard to verify the connection status.

Useful commands:
  Show status:  & 'C:\Program Files\WireGuard\wg.exe' show wg0
  GUI:          Start WireGuard GUI from Start Menu
```

---

## Manual Installation

If you prefer manual installation or need to customize:

### 1. Download and Install WireGuard

#### Option A: MSI Installer (Recommended)

1. Download from official site:
   - https://www.wireguard.com/install/

2. Run the installer:
   ```powershell
   # Download
   $url = "https://download.wireguard.com/windows-client/wireguard-installer.exe"
   $output = "$env:TEMP\wireguard-installer.exe"
   Invoke-WebRequest -Uri $url -OutFile $output

   # Install
   Start-Process -FilePath $output -ArgumentList "/quiet" -Wait
   ```

3. Verify installation:
   ```powershell
   & 'C:\Program Files\WireGuard\wg.exe' --version
   ```

---

#### Option B: Chocolatey

```powershell
# Install Chocolatey (if not already installed)
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install WireGuard
choco install wireguard -y
```

---

#### Option C: Winget

```powershell
winget install WireGuard.WireGuard
```

---

### 2. Generate WireGuard Keys

```powershell
# Set WireGuard path
$wgPath = "C:\Program Files\WireGuard\wg.exe"

# Generate private key
$privateKey = & $wgPath genkey
$privateKey | Out-File -FilePath "$env:USERPROFILE\wg0-private.key" -Encoding ASCII

# Generate public key
$publicKey = $privateKey | & $wgPath pubkey
$publicKey | Out-File -FilePath "$env:USERPROFILE\wg0-public.key" -Encoding ASCII

Write-Host "Keys generated:"
Write-Host "  Private key: $env:USERPROFILE\wg0-private.key"
Write-Host "  Public key: $env:USERPROFILE\wg0-public.key"
```

---

### 3. Register with Hub

```powershell
$token = "your-installation-token"
$hubApi = "http://192.168.1.15:3000"
$publicKey = Get-Content "$env:USERPROFILE\wg0-public.key" -Raw

$body = @{
    token = $token
    publicKey = $publicKey.Trim()
    os = "windows"
    wireguardVersion = & $wgPath --version
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "$hubApi/api/installation/register" `
    -Method Post `
    -Body $body `
    -ContentType "application/json"

Write-Host "Registered with hub:"
Write-Host "  Spoke name: $($response.name)"
Write-Host "  VPN IP: $($response.allowedIPs[0])"
```

---

### 4. Create WireGuard Configuration

Create configuration file at `C:\Program Files\WireGuard\Data\Configurations\wg0.conf`:

```powershell
$privateKey = Get-Content "$env:USERPROFILE\wg0-private.key" -Raw

$config = @"
[Interface]
Address = <your-allocated-ip>/24
PrivateKey = $($privateKey.Trim())
DNS = 1.1.1.1, 1.0.0.1

[Peer]
# Hub
PublicKey = <hub-public-key>
Endpoint = <hub-endpoint>
AllowedIPs = 10.0.1.0/24
PersistentKeepalive = 25
"@

$configPath = "C:\Program Files\WireGuard\Data\Configurations\wg0.conf"
$config | Out-File -FilePath $configPath -Encoding ASCII

Write-Host "Configuration created at: $configPath"
```

Replace:
- `<your-allocated-ip>`: IP from hub registration response
- `<hub-public-key>`: Hub's public key
- `<hub-endpoint>`: Hub's public or private endpoint

---

### 5. Install and Start Tunnel

```powershell
# Install tunnel service
$wgExe = "C:\Program Files\WireGuard\wireguard.exe"
& $wgExe /installtunnelservice "C:\Program Files\WireGuard\Data\Configurations\wg0.conf"

# Wait for service to start
Start-Sleep -Seconds 2

# Verify service is running
Get-Service -Name "WireGuardTunnel`$wg0" | Select-Object Status, DisplayName
```

---

## Verification

### 1. Check WireGuard Status

```powershell
& 'C:\Program Files\WireGuard\wg.exe' show wg0
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

---

### 2. Check Interface

```powershell
Get-NetAdapter | Where-Object {$_.InterfaceDescription -like "*WireGuard*"}
```

**Expected output**:
```
Name                      InterfaceDescription                    ifIndex Status
----                      --------------------                    ------- ------
wg0                       WireGuard Tunnel                        15      Up
```

---

### 3. Test Connectivity

```powershell
# Ping hub
Test-Connection -ComputerName 10.0.1.1 -Count 3

# Ping another spoke (if any)
Test-Connection -ComputerName 10.0.1.5 -Count 3
```

---

### 4. Check Service Status

```powershell
Get-Service -Name "WireGuardTunnel`$wg0"
```

**Expected output**:
```
Status   Name               DisplayName
------   ----               -----------
Running  WireGuardTunnel... WireGuard Tunnel: wg0
```

---

## WireGuard GUI

### Using the GUI

WireGuard includes a graphical interface:

1. **Open WireGuard GUI**:
   - Start Menu → "WireGuard"
   - OR System Tray icon (if running)

2. **Import Configuration**:
   - Click "Add Tunnel" → "Add empty tunnel..."
   - OR "Import tunnel(s) from file" to load existing config

3. **Activate Tunnel**:
   - Click "Activate" button
   - OR right-click system tray icon → "Activate wg0"

4. **View Status**:
   - Interface shows:
     - Status (Active/Inactive)
     - Transfer statistics
     - Peer information
     - Latest handshake time

---

### GUI vs Service

**GUI Mode**:
- User-interactive
- Starts when user logs in
- Easier troubleshooting
- Shows real-time stats

**Service Mode** (Recommended for servers):
- Runs as system service
- Starts at boot
- Runs without user login
- Better for servers/always-on systems

To switch modes:
```powershell
# Stop service
Stop-Service -Name "WireGuardTunnel`$wg0"

# Start via GUI
# Open WireGuard GUI → Activate tunnel
```

---

## Configuration Options

### Route All Traffic Through VPN

To route ALL traffic through VPN (not just VPN subnet):

Edit `C:\Program Files\WireGuard\Data\Configurations\wg0.conf`:

```
[Peer]
PublicKey = <hub-public-key>
Endpoint = <hub-endpoint>
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
```

Restart tunnel:
```powershell
Restart-Service -Name "WireGuardTunnel`$wg0"
```

---

### Custom DNS Servers

Edit configuration:

```
[Interface]
Address = 10.0.1.20/24
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

## Troubleshooting

### Tunnel Won't Start

```powershell
# Check service status
Get-Service -Name "WireGuardTunnel`$wg0" | Format-List *

# Check for errors in Event Viewer
Get-EventLog -LogName Application -Source WireGuard -Newest 10

# Verify configuration syntax
& 'C:\Program Files\WireGuard\wg.exe' show wg0
```

---

### No Handshake with Hub

**Check endpoint reachability**:
```powershell
# Test TCP connectivity (approximation)
Test-NetConnection -ComputerName 192.168.1.10 -Port 51820

# Check DNS resolution
Resolve-DnsName vpn.example.com
```

**Check Windows Firewall**:
```powershell
# Show WireGuard firewall rules
Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*WireGuard*"}

# Allow WireGuard (if not already)
New-NetFirewallRule -DisplayName "WireGuard" -Direction Inbound -Protocol UDP -LocalPort 51820 -Action Allow
```

---

### DNS Not Working

```powershell
# Check DNS configuration
Get-DnsClientServerAddress -InterfaceAlias "wg0"

# Flush DNS cache
Clear-DnsClientCache

# Test DNS resolution
Resolve-DnsName google.com
```

---

### Connection Drops After Idle

Ensure `PersistentKeepalive = 25` is set in configuration:

```powershell
# Edit config
notepad "C:\Program Files\WireGuard\Data\Configurations\wg0.conf"

# Add to [Peer] section:
# PersistentKeepalive = 25

# Restart tunnel
Restart-Service -Name "WireGuardTunnel`$wg0"
```

---

### Permission Errors

**Run PowerShell as Administrator**:
1. Right-click Start menu
2. Select "Windows PowerShell (Admin)" or "Terminal (Admin)"

**Check execution policy**:
```powershell
Get-ExecutionPolicy
# If "Restricted", set to RemoteSigned:
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

### Installation Fails

**Error**: "Execution policy restricted"

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
```

**Error**: "Cannot download installer"

Check internet connectivity and firewall settings. Try manual download from https://www.wireguard.com/install/

---

## Uninstallation

### 1. Stop and Remove Tunnel Service

```powershell
# Stop service
Stop-Service -Name "WireGuardTunnel`$wg0"

# Remove service
& 'C:\Program Files\WireGuard\wireguard.exe' /uninstalltunnelservice wg0
```

---

### 2. Remove Configuration

```powershell
Remove-Item "C:\Program Files\WireGuard\Data\Configurations\wg0.conf"
Remove-Item "$env:USERPROFILE\wg0-private.key"
Remove-Item "$env:USERPROFILE\wg0-public.key"
```

---

### 3. Uninstall WireGuard (optional)

#### Via Control Panel
1. Settings → Apps → Apps & features
2. Find "WireGuard"
3. Click "Uninstall"

#### Via PowerShell
```powershell
# Chocolatey
choco uninstall wireguard -y

# Winget
winget uninstall WireGuard.WireGuard
```

---

### 4. Remove from Dashboard

Delete the spoke from the hub dashboard.

---

## Windows Server Specific

### Running as Service (Always-On)

For Windows Server deployments, service mode is recommended:

```powershell
# Install tunnel service
& 'C:\Program Files\WireGuard\wireguard.exe' /installtunnelservice "C:\Program Files\WireGuard\Data\Configurations\wg0.conf"

# Set to start automatically
Set-Service -Name "WireGuardTunnel`$wg0" -StartupType Automatic

# Start service
Start-Service -Name "WireGuardTunnel`$wg0"
```

---

### Firewall Configuration

```powershell
# Allow WireGuard UDP port
New-NetFirewallRule -DisplayName "WireGuard" `
    -Direction Inbound `
    -Protocol UDP `
    -LocalPort 51820 `
    -Action Allow

# Allow VPN subnet access
New-NetFirewallRule -DisplayName "WireGuard VPN Subnet" `
    -Direction Inbound `
    -RemoteAddress 10.0.1.0/24 `
    -Action Allow
```

---

### Monitoring with PowerShell

```powershell
# Monitor WireGuard status
while ($true) {
    Clear-Host
    Write-Host "===== WireGuard Status $(Get-Date) =====" -ForegroundColor Green
    & 'C:\Program Files\WireGuard\wg.exe' show wg0
    Start-Sleep -Seconds 5
}
```

---

## Useful PowerShell Commands

```powershell
# Show WireGuard status
& 'C:\Program Files\WireGuard\wg.exe' show wg0

# Show all WireGuard tunnels
& 'C:\Program Files\WireGuard\wg.exe' show

# Check service status
Get-Service -Name "WireGuardTunnel`$wg0"

# Restart tunnel service
Restart-Service -Name "WireGuardTunnel`$wg0"

# Show network adapter
Get-NetAdapter | Where-Object {$_.InterfaceDescription -like "*WireGuard*"}

# Test connectivity
Test-Connection -ComputerName 10.0.1.1 -Count 3

# Show routing table for VPN
Get-NetRoute | Where-Object {$_.NextHop -eq "10.0.1.1"}

# Check DNS configuration
Get-DnsClientServerAddress -InterfaceAlias "wg0"

# View Event Logs
Get-EventLog -LogName Application -Source WireGuard -Newest 20
```

---

## Advanced Configuration

### Custom MTU

```
[Interface]
Address = 10.0.1.20/24
PrivateKey = <key>
MTU = 1380
```

---

### Pre/Post Scripts

```
[Interface]
Address = 10.0.1.20/24
PrivateKey = <key>
PreUp = powershell -Command "Write-Host 'Starting VPN...'"
PostUp = powershell -Command "Write-Host 'VPN started'"
PreDown = powershell -Command "Write-Host 'Stopping VPN...'"
PostDown = powershell -Command "Write-Host 'VPN stopped'"
```

---

### Multiple Tunnels

Install multiple tunnel configurations:

```powershell
# Install tunnel 1
& 'C:\Program Files\WireGuard\wireguard.exe' /installtunnelservice "C:\...\wg0.conf"

# Install tunnel 2
& 'C:\Program Files\WireGuard\wireguard.exe' /installtunnelservice "C:\...\wg1.conf"

# Manage separately
Start-Service -Name "WireGuardTunnel`$wg0"
Start-Service -Name "WireGuardTunnel`$wg1"
```

---

## Next Steps

- Monitor connection in [dashboard](../README.md#dashboard)
- Configure [application routing](../README.md#application-routing)
- Set up [firewall rules](../README.md#firewall-configuration)
- See [troubleshooting guide](troubleshooting.md) for more issues

---

## Related Documentation

- [Hub Setup Guide](hub-setup.md)
- [Linux Spoke Installation](spoke-linux.md)
- [Proxmox Spoke Installation](spoke-proxmox.md)
- [Prerequisites](prerequisites.md)
- [Troubleshooting](troubleshooting.md)
