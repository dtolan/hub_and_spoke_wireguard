# Prerequisites

System requirements and prerequisites for hub-and-spoke WireGuard deployment.

---

## Hub Requirements

The hub server acts as the central point for all spoke connections.

### Operating System

**Supported**:
- Ubuntu 20.04 LTS or higher
- Debian 11 (Bullseye) or higher
- RHEL 8+ / CentOS 8+ / Rocky Linux 8+
- Fedora 35+

**Not supported**:
- Windows (Linux required for hub)
- macOS (Linux required for hub)

### Hardware Requirements

**Minimum** (up to 10 spokes):
- **CPU**: 1 core (2+ GHz)
- **RAM**: 512 MB
- **Disk**: 10 GB
- **Network**: 10 Mbps

**Recommended** (10-50 spokes):
- **CPU**: 2 cores (2.5+ GHz)
- **RAM**: 2 GB
- **Disk**: 20 GB
- **Network**: 100 Mbps

**High-scale** (50+ spokes):
- **CPU**: 4+ cores (3+ GHz)
- **RAM**: 4+ GB
- **Disk**: 50+ GB
- **Network**: 1 Gbps

### Software Requirements

**Required**:
- **WireGuard**: Latest stable version
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **systemd**: For service management
- **SQLite**: v3.35.0 or higher (usually included)

**Optional**:
- **nginx**: For production frontend hosting
- **PM2**: For production backend management
- **certbot**: For HTTPS/SSL

### Network Requirements

**Firewall ports** (must be open):
- **51820/udp**: WireGuard VPN (configurable)
- **3000/tcp**: Backend API
- **5173/tcp**: Frontend (development) OR 80/443 (production)

**Public IP or domain**:
- Required for external spokes
- Can use dynamic DNS if public IP changes

**Private IP** (optional):
- For internal spokes on same network
- Allows automatic endpoint detection

### Internet Connectivity

**Required**:
- Outbound HTTPS (443) for package downloads
- Ability to receive inbound UDP on WireGuard port

### Permissions

**Root access required** for:
- Installing WireGuard
- Creating `/etc/wireguard/wg0.conf`
- Managing systemd services
- Configuring firewall
- Enabling IP forwarding

---

## Spoke Requirements

Requirements vary by platform. See platform-specific sections below.

### General Requirements (All Platforms)

**Network**:
- Access to hub's public OR private endpoint
- Outbound UDP connectivity
- DNS resolution (for domain-based endpoints)

**Installation**:
- Administrator/root privileges
- Installation token from hub dashboard

---

## Linux Spoke Requirements

### Operating System

**Supported**:
- Ubuntu 20.04+ / Debian 11+
- RHEL 8+ / CentOS 8+ / Rocky Linux 8+
- Fedora 35+
- Arch Linux
- Alpine Linux 3.14+

**Legacy** (with extra steps):
- Ubuntu 18.04 (requires PPA)
- Debian 10 (requires backports)
- CentOS 7 (requires kernel upgrade)

### Hardware Requirements

**Minimum**:
- **CPU**: 1 core
- **RAM**: 256 MB
- **Disk**: 5 GB
- **Network**: 1 Mbps

### Software Requirements

**Required**:
- **WireGuard**: Latest kernel module or wireguard-go
- **systemd**: For service management
- **curl**: For installation script

**Optional**:
- **resolvconf**: For DNS management (recommended)
- **netcat** or **nmap**: For endpoint testing

### Kernel Requirements

**Kernel 5.6+**: WireGuard included in mainline kernel

**Kernel < 5.6**: Requires wireguard-tools package

```bash
# Check kernel version
uname -r

# If < 5.6, WireGuard will be installed as DKMS module
```

---

## Windows Spoke Requirements

### Operating System

**Supported**:
- Windows 10 (version 1809 or higher)
- Windows 11
- Windows Server 2016 or higher
- Windows Server 2019
- Windows Server 2022

**Not supported**:
- Windows 7
- Windows 8/8.1
- Windows Server 2012

### Hardware Requirements

**Minimum**:
- **CPU**: 1 GHz or faster
- **RAM**: 512 MB
- **Disk**: 5 GB free space
- **Network**: 1 Mbps

### Software Requirements

**Required**:
- **PowerShell**: v5.1 or higher
- **WireGuard**: Official Windows client
- **.NET Framework**: 4.7.2 or higher (usually pre-installed)

**Optional**:
- **Chocolatey**: For easier WireGuard installation
- **Winget**: Alternative package manager

### Permissions

**Administrator required** for:
- Installing WireGuard
- Managing tunnel services
- Network configuration changes

---

## macOS Spoke Requirements

### Operating System

**Supported**:
- macOS 10.14 (Mojave) or higher
- macOS 10.15 (Catalina)
- macOS 11 (Big Sur)
- macOS 12 (Monterey)
- macOS 13 (Ventura)
- macOS 14 (Sonoma)

**Architecture**:
- Intel (x86_64)
- Apple Silicon (arm64 / M1/M2/M3)

### Hardware Requirements

**Minimum**:
- Any Mac capable of running supported macOS version
- **RAM**: 512 MB available
- **Disk**: 5 GB free space
- **Network**: 1 Mbps

### Software Requirements

**Required**:
- **Homebrew**: For command-line installation
  - OR WireGuard GUI app from App Store

**Optional**:
- **Xcode Command Line Tools**: For Homebrew
- **WireGuard GUI**: For easier management

### Permissions

**Administrator required** for:
- Installing Homebrew packages
- Managing WireGuard tunnels
- Network extension approval (first time only)

### System Extension Approval

**First-time setup**:
1. macOS will prompt for System Extension approval
2. System Preferences → Security & Privacy → General
3. Click "Allow" for WireGuard system extension

---

## Proxmox VE Spoke Requirements

### Operating System

**Supported**:
- Proxmox VE 7.x (Debian Bullseye-based)
- Proxmox VE 8.x (Debian Bookworm-based)

**Legacy** (with extra steps):
- Proxmox VE 6.x (Debian Buster-based, requires backports)

### Deployment Modes

**Standalone Proxmox**:
- Single host
- One installation token
- One VPN IP

**Clustered Proxmox**:
- Multiple hosts in cluster
- **One token per node** (important!)
- Each node gets unique VPN IP
- Each node appears separately in dashboard

### Hardware Requirements

Same as [Linux Spoke Requirements](#linux-spoke-requirements)

### Software Requirements

**Required**:
- **WireGuard**: From Proxmox/Debian repositories
- **Proxmox VE tools**: pveversion, pvecm (pre-installed)
- **curl**: For installation script

**Repository access**:
- Community repositories (free, no subscription)
- OR Enterprise repositories (with subscription)

**Known issue**: Enterprise repositories return 401 errors without subscription
- **Solution**: See [PROXMOX_REPO_FIX.md](../../PROXMOX_REPO_FIX.md) or [spoke-proxmox.md](spoke-proxmox.md#fixing-repository-errors-401-unauthorized)

### Cluster Requirements

**For clustered deployments**:
- Cluster must be functional (`pvecm status` works)
- Each node must have network connectivity to hub
- Each node needs SSH access for installation

**Important**: Run installation script on each node individually, not from cluster-wide management.

### VM/Container Considerations

**If VMs/containers need VPN access**:
- Uncomment PostUp/PostDown rules in config
- Enable IP forwarding on Proxmox host
- Configure VM routing to use Proxmox as gateway

---

## Network Considerations

### Firewall Configuration

**Hub firewall** (must allow):
- Inbound UDP on WireGuard port (default 51820)
- Inbound TCP on API port (default 3000) from trusted IPs
- Inbound TCP on frontend port (default 5173 or 80/443)

**Spoke firewall** (usually allows):
- Outbound UDP to hub's WireGuard port
- Inbound on WireGuard interface (for hub→spoke traffic)

**Cloud providers** (AWS, GCP, Azure, etc.):
- Configure security groups to allow UDP 51820
- Ensure no NAT issues (may need elastic/static IP)

### NAT Traversal

**Behind NAT**:
- WireGuard works through NAT
- Use `PersistentKeepalive = 25` in spoke config
- Hub must have public IP or port forwarding

**Double NAT**:
- More challenging but usually works
- Ensure keepalive is enabled
- May need to adjust keepalive interval (15-30 seconds)

### DNS Requirements

**Hub hostname resolution**:
- If using domain name (e.g., `vpn.example.com`), must be resolvable
- Can use public DNS (1.1.1.1, 8.8.8.8)
- OR use public IP directly

**Spoke DNS**:
- Can use hub-provided DNS
- OR custom DNS servers in config

---

## IPv6 Considerations

**Current implementation**: IPv4 only

**IPv6 support** (future):
- Requires dual-stack configuration
- AllowedIPs must include both ::/0 and 0.0.0.0/0
- DNS must support AAAA records

---

## Security Requirements

### Key Management

**Private keys**:
- Generated locally on each device
- Never transmitted over network
- Stored with 0600 permissions (read/write by owner only)

**Public keys**:
- Transmitted during registration
- Stored in hub configuration
- Used for peer authentication

### Certificate Requirements

**For production deployments**:
- HTTPS/TLS recommended for dashboard
- Use Let's Encrypt or commercial certificate
- Configure nginx as reverse proxy

**For development/testing**:
- HTTP acceptable on trusted networks
- NOT recommended for production

### Access Control

**Hub dashboard**:
- Consider authentication (not included by default)
- Restrict access to trusted IPs
- Use firewall rules or nginx auth

**Installation tokens**:
- Single-use (individual tokens)
- 24-hour expiration
- Regenerate if compromised

---

## Performance Considerations

### CPU Requirements

**WireGuard CPU usage** (approximate):

| Throughput | CPU Usage |
|------------|-----------|
| 10 Mbps    | < 1% (1 core) |
| 100 Mbps   | 2-5% (1 core) |
| 1 Gbps     | 10-20% (1 core) |
| 10 Gbps    | Full core (AES-NI required) |

**Recommendation**:
- For < 1 Gbps: 1-2 cores sufficient
- For > 1 Gbps: Dedicated core, AES-NI support

### Memory Requirements

**Per spoke connection**:
- ~10 KB per peer (minimal)
- Hub with 100 spokes: ~1 MB for WireGuard
- Dashboard/backend: ~100 MB (Node.js)

**Recommendation**:
- 512 MB: Up to 10 spokes
- 1 GB: Up to 50 spokes
- 2 GB+: 50+ spokes

### Bandwidth Requirements

**Hub bandwidth** = Sum of all spoke traffic

**Example**: 10 spokes @ 10 Mbps each = 100 Mbps hub bandwidth

### MTU Considerations

**Default MTU**: 1420 (WireGuard default)

**Lower MTU if**:
- Running over PPPoE (use 1412)
- Experiencing fragmentation
- Over VPN-over-VPN (nested tunnels)

**Test MTU**:
```bash
# Linux/macOS
ping -M do -s 1392 10.0.1.1

# Windows
ping -f -l 1392 10.0.1.1
```

---

## Browser Requirements (Dashboard)

### Supported Browsers

**Recommended**:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**May work**:
- Older versions with polyfills
- Mobile browsers (iOS Safari, Chrome Mobile)

### JavaScript

**Required**: JavaScript must be enabled

### Screen Resolution

**Minimum**: 1024x768
**Recommended**: 1920x1080 or higher

---

## Development Requirements

**For building from source**:

### Hub Development

**Required**:
- Node.js v18+
- npm v9+
- TypeScript 5.0+
- Git

**Optional**:
- ESLint
- Prettier
- VS Code or similar IDE

### Spoke Script Customization

**Bash scripting** (Linux, macOS, Proxmox):
- shellcheck for linting
- Basic shell scripting knowledge

**PowerShell** (Windows):
- PowerShell 5.1+ or PowerShell Core 7+
- PSScriptAnalyzer for linting

---

## Testing Requirements

**For testing before production**:

### Minimum Test Environment

1. **Hub**: Linux VM (2 GB RAM, 2 cores)
2. **Spoke 1**: Linux VM or physical machine
3. **Spoke 2**: Different platform (Windows/macOS/Proxmox)

**Network**:
- All on same network for private endpoint testing
- OR one spoke external for public endpoint testing

### Recommended Test Scenarios

1. ✅ Local network (private endpoint)
2. ✅ External network (public endpoint)
3. ✅ Behind NAT
4. ✅ Multiple platforms
5. ✅ Sleep/wake cycles (laptops)
6. ✅ Network switching (Wi-Fi ↔ Ethernet)

---

## Checklist

### Before Hub Installation

- [ ] Linux server with root access
- [ ] Public IP or domain name
- [ ] Firewall allows UDP 51820, TCP 3000, TCP 5173/80/443
- [ ] Node.js v18+ installed
- [ ] WireGuard installed or can install packages

### Before Spoke Installation

- [ ] Installation token generated from hub
- [ ] Administrator/root access on spoke
- [ ] Network connectivity to hub endpoint
- [ ] DNS resolution working (if using domain)
- [ ] Firewall allows outbound UDP

### Production Readiness

- [ ] HTTPS/SSL configured
- [ ] Backend running with PM2 or systemd
- [ ] Frontend served by nginx
- [ ] Firewall configured correctly
- [ ] IP forwarding enabled on hub
- [ ] Backups configured for `/etc/wireguard/` and database
- [ ] Monitoring configured
- [ ] Documentation reviewed

---

## Next Steps

After verifying prerequisites:

1. [Hub Setup Guide](hub-setup.md) - Install and configure hub
2. Platform-specific spoke guides:
   - [Linux Spoke Installation](spoke-linux.md)
   - [Windows Spoke Installation](spoke-windows.md)
   - [macOS Spoke Installation](spoke-macos.md)
   - [Proxmox Spoke Installation](spoke-proxmox.md)
3. [Troubleshooting](troubleshooting.md) - Common issues

---

## Related Documentation

- [Installation Overview](README.md)
- [Hub Setup Guide](hub-setup.md)
- [Troubleshooting](troubleshooting.md)
