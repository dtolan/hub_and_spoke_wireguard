# Installation Guide

Complete installation documentation for hub-and-spoke WireGuard VPN deployment.

---

## Quick Start

### 1. Choose Your Role

**Setting up the central hub?** → Start with [Hub Setup Guide](hub-setup.md)

**Connecting a spoke?** → Choose your platform:
- [Linux](spoke-linux.md)
- [Windows](spoke-windows.md)
- [macOS](spoke-macos.md)
- [Proxmox VE](spoke-proxmox.md)

---

## Installation Overview

### Hub-and-Spoke Architecture

```
                    ┌─────────────┐
                    │     Hub     │
                    │ (Linux VPS) │
                    │  10.0.1.1   │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐       ┌────▼────┐       ┌────▼────┐
   │ Spoke 1 │       │ Spoke 2 │       │ Spoke 3 │
   │  Linux  │       │ Windows │       │ Proxmox │
   │10.0.1.5 │       │10.0.1.10│       │10.0.1.15│
   └─────────┘       └─────────┘       └─────────┘
```

**Hub**: Central server that all spokes connect to
- Runs on Linux
- Has public IP or domain name
- Manages VPN network and routing

**Spokes**: Client devices connecting to hub
- Can be Linux, Windows, macOS, or Proxmox
- Connect via public or private endpoint
- Communicate with each other through hub

---

## Installation Process

### Step 1: Verify Prerequisites

Before starting, ensure your system meets requirements:

→ [**Prerequisites Guide**](prerequisites.md)

**Hub requirements**:
- Linux server (Ubuntu 20.04+, Debian 11+, RHEL 8+)
- Public IP or domain name
- Root access
- Firewall ports open: 51820/udp, 3000/tcp, 5173/tcp

**Spoke requirements**:
- Varies by platform (see prerequisites)
- Network access to hub
- Administrator/root privileges

---

### Step 2: Install Hub

The hub is the central server that manages the VPN network.

→ [**Hub Setup Guide**](hub-setup.md)

**What you'll do**:
1. Install WireGuard and dependencies
2. Configure hub settings (network CIDR, endpoints)
3. Initialize hub and generate keys
4. Start WireGuard service
5. Configure firewall and IP forwarding
6. Start backend API and dashboard

**Time estimate**: 15-30 minutes

**Result**: Fully functional hub ready to accept spoke connections

---

### Step 3: Install Spokes

Connect your devices to the hub by installing WireGuard spokes.

Choose your platform:

#### → [**Linux Spoke Installation**](spoke-linux.md)

**Supports**: Ubuntu, Debian, RHEL, CentOS, Rocky Linux, Fedora, Arch

**Installation method**: One-command automated script

**Time estimate**: 5-10 minutes per spoke

---

#### → [**Windows Spoke Installation**](spoke-windows.md)

**Supports**: Windows 10 (1809+), Windows 11, Windows Server 2016+

**Installation method**: PowerShell automated script

**Time estimate**: 5-10 minutes per spoke

---

#### → [**macOS Spoke Installation**](spoke-macos.md)

**Supports**: macOS 10.14+, including Apple Silicon (M1/M2/M3)

**Installation method**: Automated script via Homebrew

**Time estimate**: 5-10 minutes per spoke

---

#### → [**Proxmox VE Spoke Installation**](spoke-proxmox.md)

**Supports**: Proxmox VE 7.x, 8.x (standalone and clustered)

**Important**:
- **Clustered Proxmox**: Each node needs its own installation token
- Includes repository fix for 401 errors

**Installation method**: One-command automated script

**Time estimate**: 5-10 minutes per node

---

### Step 4: Verify Connections

After installing spokes, verify connectivity:

**1. Check spoke status**:
```bash
# Linux/macOS
wg show wg0

# Windows
& 'C:\Program Files\WireGuard\wg.exe' show wg0
```

**2. Test connectivity**:
```bash
# Ping hub
ping 10.0.1.1

# Ping another spoke
ping 10.0.1.5
```

**3. Check dashboard**:
- Open hub dashboard (http://hub-ip:5173)
- Verify spoke appears as "Active"
- Check "Last Handshake" is recent (< 2 minutes)

---

## Installation Scenarios

### Scenario 1: Simple Home Network

**Goal**: Connect home devices through VPN

**Setup**:
1. Hub on cloud VPS (AWS, DigitalOcean, etc.)
2. Spoke 1: Home desktop (Linux/Windows)
3. Spoke 2: Laptop (macOS)

**Benefits**:
- Access home network from anywhere
- Secure remote access
- Simple 2-spoke setup

**Guides**: [Hub](hub-setup.md) → [Linux](spoke-linux.md) → [macOS](spoke-macos.md)

---

### Scenario 2: Proxmox Cluster

**Goal**: Connect all nodes in Proxmox cluster to VPN

**Setup**:
1. Hub on separate server or cloud VPS
2. Spoke 1: Proxmox node 1 (pve1)
3. Spoke 2: Proxmox node 2 (pve2)
4. Spoke 3: Proxmox node 3 (pve3)

**Important**:
- Each Proxmox node needs **its own installation token**
- Run installation on each node individually
- Each node gets unique VPN IP

**Benefits**:
- Secure cluster communication over VPN
- Remote management via VPN
- VM/container access through VPN

**Guides**: [Hub](hub-setup.md) → [Proxmox (3x)](spoke-proxmox.md)

---

### Scenario 3: Multi-Platform Office

**Goal**: Connect office servers and workstations

**Setup**:
1. Hub on-premises or cloud
2. Multiple spokes:
   - Linux servers (web, database, etc.)
   - Windows workstations
   - macOS laptops
   - Proxmox hypervisor

**Benefits**:
- Unified network across platforms
- Secure inter-server communication
- Remote work access

**Guides**: [Hub](hub-setup.md) → Platform-specific guides

---

### Scenario 4: Site-to-Site VPN

**Goal**: Connect multiple office locations

**Setup**:
1. Central hub at main office or cloud
2. Spoke at each remote office
3. Each spoke is gateway for its LAN

**Configuration**: Requires additional routing setup on spoke

**Benefits**:
- All offices on same VPN network
- Secure inter-office communication

**Advanced**: See [Main README](../../README.md) for routing configuration

---

## Token Generation

All spoke installations require an installation token.

### Individual Tokens (Current Implementation)

**For standard deployments**:

1. **Open hub dashboard** (http://hub-ip:5173)
2. **Navigate to "Installation Tokens"**
3. **Click "Generate Token"**
4. **Enter spoke details**:
   - Spoke name (e.g., "web-server-01")
   - Platform (Linux, Windows, macOS, Proxmox)
5. **Copy installation command**
6. **Run on spoke server**

**Token properties**:
- **Single-use**: Each token can only be used once
- **Pre-allocated IP**: Token reserves specific VPN IP
- **24-hour expiration**: Token expires after 24 hours
- **Platform-specific**: Generates correct installation script

---

### Group Tokens (Future Feature)

**For bulk deployments** (planned):
- One token for multiple servers
- Auto-identification via hostname
- Dynamic IP allocation
- Perfect for server farms, Kubernetes clusters

See [Group Token Feature Plan](../../.claude/plans/rippling-brewing-badger.md) for details.

---

## Common Installation Patterns

### Pattern 1: Hub First, Spokes Later

**Best for**: Gradual rollout

1. Install and test hub
2. Generate tokens as needed
3. Install spokes one at a time
4. Verify each spoke before adding next

---

### Pattern 2: Hub + Test Spoke

**Best for**: Testing before production

1. Install hub
2. Install one test spoke
3. Verify connectivity
4. Roll out to remaining spokes

---

### Pattern 3: All at Once

**Best for**: Small deployments (< 5 spokes)

1. Install hub
2. Generate all tokens
3. Install all spokes in parallel
4. Verify all connections

---

## Post-Installation

### Security Hardening

**After installation, consider**:

1. **Enable HTTPS** for dashboard:
   ```bash
   sudo apt-get install certbot python3-certbot-nginx
   sudo certbot --nginx -d vpn.example.com
   ```

2. **Restrict API access**:
   - Use firewall to limit dashboard access
   - Consider adding authentication

3. **Regular updates**:
   ```bash
   sudo apt-get update && sudo apt-get upgrade
   ```

4. **Backup configuration**:
   ```bash
   sudo tar -czf wireguard-backup.tar.gz /etc/wireguard/ data/hub.db
   ```

---

### Monitoring

**Dashboard provides**:
- Real-time spoke status
- Last handshake timestamps
- Transfer statistics
- Connection health

**Command-line monitoring**:
```bash
# Hub: Watch all spokes
watch -n 1 'sudo wg show wg0'

# Spoke: Monitor connection
watch -n 1 'wg show wg0 | grep -A 5 "peer:"'
```

---

### Maintenance

**Regular tasks**:

1. **Check spoke status** weekly
2. **Update WireGuard** when new versions released
3. **Review logs** for errors
4. **Backup configuration** monthly
5. **Test connectivity** after hub reboots

---

## Troubleshooting

Experiencing issues? See our comprehensive troubleshooting guide:

→ [**Troubleshooting Guide**](troubleshooting.md)

**Common issues covered**:
- Hub won't initialize
- Spoke won't connect
- No handshake with hub
- DNS not working
- Proxmox 401 errors
- Connection drops
- Platform-specific problems

**Quick diagnostics**:
```bash
# Check WireGuard status
wg show wg0

# Check logs
sudo journalctl -u wg-quick@wg0 -n 50

# Test connectivity
ping 10.0.1.1
```

---

## Platform-Specific Notes

### Linux
- Widest compatibility
- Best hub platform
- Native WireGuard support (kernel 5.6+)
- Multiple distros supported

### Windows
- GUI and service mode available
- PowerShell automation
- Windows Server supported
- Requires Windows 10 (1809+)

### macOS
- Both CLI and GUI options
- Works on Apple Silicon (M1/M2/M3)
- Homebrew for easy installation
- System Extension approval required

### Proxmox VE
- Cluster support built-in
- Each node needs own token
- Repository fix may be needed
- VM/container VPN access possible

---

## Architecture Decisions

### Why Hub-and-Spoke?

**Advantages**:
- ✅ Simple management (one central point)
- ✅ Easy troubleshooting
- ✅ Scalable (add spokes without reconfiguring others)
- ✅ Hub controls routing and policies

**Alternatives**:
- Mesh network (every node connects to every other node)
- Point-to-point (individual tunnels between pairs)

### Why WireGuard?

**Advantages**:
- ✅ Modern cryptography (ChaCha20, Poly1305)
- ✅ High performance
- ✅ Small codebase (security auditable)
- ✅ Cross-platform support
- ✅ Built into Linux kernel (5.6+)

**Comparison**:
- vs OpenVPN: Faster, simpler, more secure
- vs IPsec: Easier configuration, better performance
- vs Tailscale: More control, self-hosted

---

## FAQ

### How many spokes can one hub support?

**Theoretical**: Thousands (limited by network CIDR)
**Practical**: 100-500 depending on traffic and hub hardware

### Can spokes communicate with each other?

**Yes**, if hub has IP forwarding enabled (default in our setup)

### Do I need a public IP for hub?

**Yes**, for external spokes. OR use dynamic DNS if IP changes.

### Can spokes be behind NAT?

**Yes**, WireGuard works through NAT. Use `PersistentKeepalive = 25`.

### Can I use IPv6?

**Not currently**, but support planned for future release.

### How do I add more spokes later?

Generate new token → Run installation script. No hub reconfiguration needed.

### What if hub reboots?

WireGuard starts automatically via systemd. Spokes reconnect automatically.

### Can I run hub on Raspberry Pi?

**Yes**, any Linux system works. May need performance tuning for many spokes.

---

## Getting Help

### Documentation

- [Hub Setup](hub-setup.md)
- [Spoke Guides](spoke-linux.md) ([Windows](spoke-windows.md), [macOS](spoke-macos.md), [Proxmox](spoke-proxmox.md))
- [Prerequisites](prerequisites.md)
- [Troubleshooting](troubleshooting.md)
- [Main README](../../README.md)

### Community Resources

- WireGuard documentation: https://www.wireguard.com/
- WireGuard quickstart: https://www.wireguard.com/quickstart/
- Community forum: https://www.reddit.com/r/WireGuard/

### Reporting Issues

**Before reporting**:
1. Check [troubleshooting guide](troubleshooting.md)
2. Search existing issues
3. Gather diagnostics (logs, config, versions)

**GitHub Issues**: [Project repository](https://github.com/yourusername/hub_and_spoke_wireguard/issues)

---

## Next Steps

### 1. For New Installations

Start here → [Prerequisites](prerequisites.md)

Then → [Hub Setup](hub-setup.md)

Then → Choose spoke guide for your platform

---

### 2. For Existing Installations

**Upgrade WireGuard**:
```bash
# Ubuntu/Debian
sudo apt-get update && sudo apt-get upgrade wireguard

# RHEL/CentOS
sudo dnf update wireguard-tools
```

**Add more spokes**: Generate new tokens and follow spoke guides

**Troubleshooting**: See [troubleshooting guide](troubleshooting.md)

---

## Summary

**Installation workflow**:
1. ✅ Verify [prerequisites](prerequisites.md)
2. ✅ Install [hub](hub-setup.md) (15-30 min)
3. ✅ Generate installation tokens
4. ✅ Install spokes (5-10 min each):
   - [Linux](spoke-linux.md)
   - [Windows](spoke-windows.md)
   - [macOS](spoke-macos.md)
   - [Proxmox](spoke-proxmox.md)
5. ✅ Verify connectivity
6. ✅ Monitor via dashboard

**Time estimate**:
- Hub: 15-30 minutes
- Each spoke: 5-10 minutes
- Testing: 5-10 minutes

**Total for 5-spoke deployment**: ~1 hour

---

## Documentation Index

| Guide | Purpose | Audience |
|-------|---------|----------|
| [README.md](README.md) | Installation overview (this file) | Everyone |
| [Prerequisites](prerequisites.md) | System requirements | Everyone |
| [Hub Setup](hub-setup.md) | Install central hub | Administrators |
| [Linux Spoke](spoke-linux.md) | Install Linux spokes | Linux users |
| [Windows Spoke](spoke-windows.md) | Install Windows spokes | Windows users |
| [macOS Spoke](spoke-macos.md) | Install macOS spokes | Mac users |
| [Proxmox Spoke](spoke-proxmox.md) | Install Proxmox spokes | Proxmox admins |
| [Troubleshooting](troubleshooting.md) | Common issues & fixes | Everyone |

---

**Ready to begin?** Start with [Prerequisites](prerequisites.md) →
