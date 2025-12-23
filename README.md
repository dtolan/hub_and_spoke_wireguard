# Hub-and-Spoke WireGuard VPN Management System

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![WireGuard](https://img.shields.io/badge/WireGuard-Latest-orange.svg)](https://www.wireguard.com/)

A **production-ready** web-based management system for deploying and managing WireGuard VPN in a hub-and-spoke topology with automated spoke provisioning, multi-platform support, and real-time monitoring.

> **Purpose**: This is a **proof-of-concept** and **reference implementation** designed to be extended, integrated, or used as a foundation for production VPN management systems. The codebase demonstrates best practices for secure token-based provisioning, automatic endpoint detection, and multi-platform deployment automation.

---

## 📋 Table of Contents

- [Features](#-features)
- [Architecture Overview](#-architecture-overview)
- [Quick Start](#-quick-start)
- [Use Cases](#-use-cases)
- [Installation](#-installation)
- [API Reference](#-api-reference)
- [Platform Support](#-platform-support)
- [Security Model](#-security-model)
- [Integration Guide](#-integration-guide)
- [Development](#-development)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)

---

## ⭐ Features

### Core Capabilities

- ✅ **Automated Hub Initialization**: Web-based wizard for first-time WireGuard hub setup
- ✅ **One-Time Installation Tokens**: Cryptographically secure tokens (256-bit) with 24-hour expiration
- ✅ **Multi-Platform Support**: Automated installation scripts for Linux, macOS, Windows, and **Proxmox VE**
- ✅ **Zero-Touch Spoke Configuration**: Single curl command installs WireGuard, generates keys, and registers with hub
- ✅ **Real-Time Monitoring**: Live connection status, handshake tracking, and transfer statistics
- ✅ **Automatic Endpoint Detection**: Scripts intelligently select private vs public endpoints based on network reachability
- ✅ **Proxmox Cluster Integration**: Automatic cluster detection with hierarchical dashboard visualization

### Security

| Feature | Implementation |
|---------|---------------|
| **Zero-Trust Key Generation** | Private keys generated **locally** on spokes, never transmitted over network |
| **Cryptographic Tokens** | 256-bit secure random tokens (base64url encoded) |
| **Atomic Token Validation** | Database transactions prevent race conditions and token reuse |
| **TLS Transport** | HTTPS-only in production (enforced via middleware) |
| **Rate Limiting** | 10 token generations per hour per IP address |
| **Public Key Uniqueness** | Prevents spoke impersonation via duplicate key detection |
| **Automatic Config Reload** | Hub WireGuard config updates without dropping existing connections |

### Platform-Specific Features

#### 🐧 Linux
- **Auto-Detection**: Ubuntu, Debian, CentOS, RHEL, Rocky Linux, AlmaLinux, Fedora, Arch, Manjaro, OpenSUSE, SLES
- **Package Managers**: apt, yum, dnf, pacman, zypper
- **Service Management**: systemd (`wg-quick@wg0`)
- **DNS Integration**: resolvconf support

#### 🍎 macOS
- **Homebrew Integration**: Automatic WireGuard tools installation
- **Service Management**: launchd plist configuration
- **M1/M2 Support**: Native ARM64 compatibility

#### 🪟 Windows
- **PowerShell-Based**: Cross-compatible with PowerShell 5.1+ and PowerShell Core
- **Chocolatey Integration**: Automatic WireGuard installation
- **Service Management**: Windows Service integration
- **Requires Admin**: UAC elevation for system configuration

#### 🖥️ Proxmox VE
- **Cluster Auto-Detection**: Queries `pvecm status` and `pvesh` APIs
- **Individual Spokes per Node**: Each cluster member gets unique IP and configuration
- **Multi-Datacenter Support**: Organize clusters by datacenter location
- **Hierarchical Dashboard**: Tree view grouped by cluster membership
- **VM Migration Support**: Optional configuration for VMs to route through VPN

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Hub Server (Windows/Linux)                    │
│  ┌────────────────┐          ┌──────────────────────────────┐   │
│  │   Frontend     │          │  Backend API                 │   │
│  │   (Vite/React) │◄────────►│  (Express + TypeScript)      │   │
│  │   Port 5173    │  Proxy   │  Port 3000 (localhost only)  │   │
│  └────────────────┘          └──────────┬───────────────────┘   │
│                                         │                        │
│                              ┌──────────▼──────────┐             │
│                              │  SQLite Database    │             │
│                              │  - hub_config       │             │
│                              │  - installation_    │             │
│                              │    tokens           │             │
│                              │  - spoke_           │             │
│                              │    registrations    │             │
│                              │  - proxmox_clusters │             │
│                              └─────────────────────┘             │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  WireGuard Interface (wg0)                             │     │
│  │  - Address: 10.0.1.1/24                                │     │
│  │  - Listen Port: 51820/udp                              │     │
│  │  - Peers: Auto-configured via API                      │     │
│  └────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ WireGuard VPN Tunnel (UDP)
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
    ┌────▼─────┐         ┌────▼─────┐        ┌────▼─────┐
    │  Spoke 1 │         │  Spoke 2 │        │ Proxmox  │
    │  (Linux) │         │ (Windows)│        │ Cluster  │
    │10.0.1.5  │         │10.0.1.7  │        │  Nodes   │
    └──────────┘         └──────────┘        │10.0.1.10 │
                                             │10.0.1.11 │
                                             │10.0.1.12 │
                                             └──────────┘
```

### Network Flow

1. **User Access**: Admin accesses dashboard at `http://HUB_IP:5173`
2. **Token Generation**: Creates token via `/api/installation/token`
3. **Script Download**: Spoke downloads script via `/api/installation/script/:token?platform=linux`
4. **Automatic Endpoint Detection**:
   - Script tests **private endpoint** (e.g., `192.168.1.15:51820`) via UDP
   - Falls back to **public endpoint** (e.g., `YOUR_PUBLIC_IP:51820`) if unreachable
5. **Local Key Generation**: Spoke generates WireGuard keys locally (never transmitted)
6. **Registration**: Spoke POSTs public key to `/api/spoke/register`
7. **Hub Config Update**: Backend adds peer to `/etc/wireguard/wg0.conf` and reloads
8. **Tunnel Established**: WireGuard handshake completes, tunnel active

---

## 🚀 Quick Start

### 1. Hub Installation (5 minutes)

```bash
# Clone repository
git clone https://github.com/yourusername/hub_and_spoke_wireguard.git
cd hub_and_spoke_wireguard

# Install dependencies
npm install

# Build application
npm run build
npm run build:backend

# Initialize database
npm run db:migrate

# Start services (development mode)
npm run dev &          # Frontend on port 5173
npm run dev:backend &  # Backend on port 3000
```

### 2. Hub Configuration (2 minutes)

1. Open browser: `http://YOUR_HUB_IP:5173`
2. Complete initialization wizard:
   - **Network CIDR**: `10.0.1.0/24`
   - **Listen Port**: `51820`
   - **Public Endpoint**: `YOUR_PUBLIC_IP:51820` (or domain name)
   - **Private Endpoint** (optional): `192.168.1.15:51820` (for internal spokes)
   - **DNS Servers** (optional): `1.1.1.1, 8.8.8.8`

### 3. Spoke Installation (1 minute per spoke)

#### Linux/macOS
```bash
# Generate token in dashboard, then run on spoke:
curl -sSL "http://HUB_IP:5173/api/installation/script/YOUR_TOKEN?platform=linux" | sudo bash
```

#### Windows (PowerShell as Administrator)
```powershell
Invoke-WebRequest -Uri "http://HUB_IP:5173/api/installation/script/YOUR_TOKEN?platform=windows" -UseBasicParsing | Invoke-Expression
```

#### Proxmox VE
```bash
# Run on EACH node in the cluster (each gets unique token)
curl -sSL "http://HUB_IP:5173/api/installation/script/YOUR_TOKEN?platform=proxmox" | bash
```

---

## 🎯 Use Cases

### 1. **Remote Office Connectivity**
Connect branch offices to central datacenter with automatic spoke provisioning. Employees run one command to join the VPN.

### 2. **Proxmox Multi-Cluster Management**
Deploy WireGuard across multiple Proxmox clusters in different datacenters. Enable VM migration and cluster communication over encrypted tunnel.

### 3. **Hybrid Cloud Networking**
Connect on-premises servers to cloud instances (AWS, Azure, GCP) with zero-touch configuration.

### 4. **Developer Access**
Provide secure VPN access to internal resources. Developers run installation command on laptops/workstations.

### 5. **IoT Device Provisioning**
Automate VPN configuration for headless IoT devices (Raspberry Pi, embedded Linux).

### 6. **Extend Existing Tools**
This codebase serves as a **reference implementation** for adding WireGuard management to existing infrastructure management platforms (e.g., Portainer, Proxmox, Rancher, Cockpit).

---

## 📦 Installation

### Production Deployment

#### System Requirements

| Component | Requirement |
|-----------|-------------|
| OS | Ubuntu 22.04 LTS (recommended), Debian 12+, RHEL 9+ |
| CPU | 2 cores (4+ recommended for 100+ spokes) |
| RAM | 2GB minimum (4GB+ recommended) |
| Disk | 10GB (database grows ~1MB per 100 spokes) |
| Network | Public IP or port-forwarded UDP 51820 |
| Software | Node.js 18+, WireGuard, SQLite 3 |

#### Step-by-Step Deployment

```bash
# 1. Install system dependencies
sudo apt update
sudo apt install -y wireguard wireguard-tools nodejs npm git

# 2. Clone repository
git clone https://github.com/yourusername/hub_and_spoke_wireguard.git
cd hub_and_spoke_wireguard

# 3. Install Node.js dependencies
npm install

# 4. Build production assets
npm run build
npm run build:backend

# 5. Initialize database
npm run db:migrate

# 6. Configure systemd service (backend)
sudo tee /etc/systemd/system/wireguard-hub-backend.service > /dev/null <<EOF
[Unit]
Description=WireGuard Hub Backend API
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$(pwd)
ExecStart=/usr/bin/node $(pwd)/dist/backend/backend/server.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# 7. Configure systemd service (frontend - Vite preview)
sudo tee /etc/systemd/system/wireguard-hub-frontend.service > /dev/null <<EOF
[Unit]
Description=WireGuard Hub Frontend
After=network.target wireguard-hub-backend.service

[Service]
Type=simple
User=root
WorkingDirectory=$(pwd)
ExecStart=/usr/bin/npm run preview -- --host 0.0.0.0 --port 5173
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# 8. Start and enable services
sudo systemctl daemon-reload
sudo systemctl enable --now wireguard-hub-backend
sudo systemctl enable --now wireguard-hub-frontend

# 9. Configure firewall
sudo ufw allow 51820/udp  # WireGuard
sudo ufw allow 5173/tcp   # Dashboard (or use reverse proxy)

# 10. Verify services
sudo systemctl status wireguard-hub-backend
sudo systemctl status wireguard-hub-frontend
```

#### Production Reverse Proxy (nginx)

For production, serve via nginx with HTTPS:

```nginx
# /etc/nginx/sites-available/wireguard-hub
server {
    listen 443 ssl http2;
    server_name vpn.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/vpn.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vpn.yourdomain.com/privkey.pem;

    # Frontend static files
    location / {
        root /path/to/hub_and_spoke_wireguard/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name vpn.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

---

## 🔌 API Reference

### Authentication

Currently **no authentication** (POC only). For production, implement:
- JWT tokens
- API keys
- OAuth 2.0 / OIDC

### Endpoints

#### Hub Management

```http
POST /api/hub/initialize
Content-Type: application/json

{
  "networkCIDR": "10.0.1.0/24",
  "listenPort": 51820,
  "publicEndpoint": "203.0.113.5:51820",
  "privateEndpoint": "192.168.1.15:51820",  // optional
  "dns": ["1.1.1.1", "8.8.8.8"]              // optional
}

Response 201:
{
  "message": "Hub initialized successfully",
  "config": {
    "id": 1,
    "interfaceAddress": "10.0.1.1/24",
    "publicKey": "base64-encoded-public-key",
    ...
  }
}
```

```http
GET /api/hub/config

Response 200:
{
  "id": 1,
  "interfaceAddress": "10.0.1.1/24",
  "listenPort": 51820,
  "publicKey": "...",
  "networkCIDR": "10.0.1.0/24",
  "publicEndpoint": "203.0.113.5:51820",
  "privateEndpoint": "192.168.1.15:51820",
  "createdAt": "2025-12-23T10:00:00Z",
  "updatedAt": "2025-12-23T10:00:00Z"
}
```

```http
GET /api/hub/status

Response 200:
{
  "interfaceName": "wg0",
  "publicKey": "...",
  "listenPort": 51820,
  "peers": [
    {
      "publicKey": "...",
      "endpoint": "192.168.1.100:41234",
      "allowedIPs": ["10.0.1.5/32"],
      "lastHandshake": "2025-12-23T12:34:56Z",
      "transferRx": 1048576,
      "transferTx": 524288
    }
  ]
}
```

#### Installation Tokens

```http
POST /api/installation/token
Content-Type: application/json

{
  "spokeName": "laptop-001",
  "customIP": "10.0.1.100"  // optional, auto-allocated if omitted
}

Response 201:
{
  "message": "Installation token generated",
  "token": {
    "id": "uuid",
    "token": "base64url-encoded-256bit-token",
    "spokeId": "uuid",
    "spokeName": "laptop-001",
    "allowedIPs": ["10.0.1.5/32"],
    "expiresAt": "2025-12-24T10:00:00Z",
    "createdAt": "2025-12-23T10:00:00Z"
  }
}
```

```http
GET /api/installation/tokens

Response 200:
{
  "tokens": [
    {
      "id": "uuid",
      "token": "...",
      "spokeName": "laptop-001",
      "allowedIPs": ["10.0.1.5/32"],
      "used": false,
      "expiresAt": "2025-12-24T10:00:00Z"
    }
  ]
}
```

```http
DELETE /api/installation/token/:id

Response 200:
{
  "message": "Installation token revoked",
  "tokenId": "uuid"
}
```

#### Script Serving

```http
GET /api/installation/script/:token?platform=linux

Response 200:
Content-Type: application/x-sh
Content-Disposition: attachment; filename="install-spoke-laptop-001.sh"

#!/bin/bash
# ... rendered installation script with embedded token and config ...
```

Query parameters:
- `platform`: `linux` | `macos` | `windows` | `proxmox`

#### Spoke Management

```http
POST /api/spoke/register
Content-Type: application/json

{
  "token": "installation-token",
  "publicKey": "base64-encoded-public-key",
  "os": "linux",
  "isProxmox": false,  // true for Proxmox spokes
  "proxmoxNodeName": "pve1",  // if isProxmox=true
  "proxmoxClusterName": "datacenter1",  // if clustered
  "proxmoxVersion": "8.1.3",
  "metadata": {
    "wireguardVersion": "1.0.20210914",
    "distribution": "ubuntu",
    "version": "22.04"
  }
}

Response 201:
{
  "message": "Spoke registered successfully",
  "spoke": {
    "id": "uuid",
    "name": "laptop-001",
    "publicKey": "...",
    "allowedIPs": ["10.0.1.5/32"],
    "status": "active"
  }
}
```

```http
GET /api/spoke/list

Response 200:
{
  "spokes": [
    {
      "id": "uuid",
      "name": "laptop-001",
      "publicKey": "...",
      "allowedIPs": ["10.0.1.5/32"],
      "registeredAt": "2025-12-23T10:00:00Z",
      "lastHandshake": "2025-12-23T12:34:56Z",
      "status": "active",
      "os": "linux"
    }
  ]
}
```

```http
DELETE /api/spoke/:id

Response 200:
{
  "message": "Spoke removed successfully",
  "spokeId": "uuid"
}
```

---

## 🖥️ Platform Support

### Linux Installation Script

The Linux script (`install-spoke-linux.sh.template`) performs:

1. **Distribution Detection**: Auto-detects Ubuntu, Debian, CentOS, RHEL, Fedora, Arch, OpenSUSE
2. **Package Installation**: Uses appropriate package manager (apt/yum/dnf/pacman/zypper)
3. **Endpoint Detection**: Tests private endpoint via UDP (`nc -u -z`), falls back to public
4. **Key Generation**: `wg genkey` + `wg pubkey` (local only)
5. **Registration**: POSTs public key to hub
6. **Configuration**: Creates `/etc/wireguard/wg0.conf`
7. **Service Activation**: `systemctl enable wg-quick@wg0 && systemctl start wg-quick@wg0`
8. **Verification**: Displays `wg show wg0` output

### Proxmox VE Script

Additional Proxmox-specific steps:

1. **Environment Detection**: Verifies `pveversion` exists
2. **Cluster Detection**: Queries `pvecm status` and `pvecm nodes`
3. **Metadata Collection**: Gathers cluster name, node name, member list
4. **Registration**: Sends cluster info to hub (creates/joins cluster in database)
5. **Dashboard Grouping**: Hub displays nodes hierarchically by cluster

### Windows PowerShell Script

Windows-specific handling:

1. **Admin Check**: Requires UAC elevation
2. **Chocolatey**: Installs package manager if missing
3. **WireGuard**: `choco install wireguard -y`
4. **Key Generation**: PowerShell-based WireGuard commands
5. **Service**: Imports tunnel config and starts Windows service

---

## 🔒 Security Model

### Threat Model

| Threat | Mitigation |
|--------|-----------|
| Token interception | Use HTTPS in production; tokens expire in 24h |
| Token reuse | Atomic database validation; tokens single-use only |
| Private key compromise | Keys generated locally, never transmitted |
| Spoke impersonation | Public key uniqueness enforced |
| Man-in-the-middle | WireGuard cryptography (ChaCha20-Poly1305, Curve25519) |
| Brute force | Rate limiting (10 tokens/hour per IP) |

### Best Practices

1. **HTTPS Only**: Deploy behind nginx/Caddy with Let's Encrypt in production
2. **Firewall**: Restrict dashboard access (port 5173/443) to admin IPs
3. **WireGuard Port**: Keep UDP 51820 public for spoke connections
4. **Database Backups**: SQLite file contains sensitive keys - encrypt backups
5. **Token Expiration**: Default 24 hours; reduce for high-security environments
6. **IP Allocation**: Reserve `10.0.1.1` for hub; auto-allocate from `.2` onward
7. **Key Rotation**: Regenerate hub keys requires full network rebuild (rare)

---

## 🔧 Integration Guide

### Use as npm Package

```bash
npm install @dtolan/hub-and-spoke-wireguard
```

```typescript
import { Dashboard, HubProvider } from '@dtolan/hub-and-spoke-wireguard'
import '@dtolan/hub-and-spoke-wireguard/style.css'

function App() {
  return (
    <HubProvider apiBaseUrl="http://your-backend:3000">
      <Dashboard />
    </HubProvider>
  )
}
```

### Extend for Custom Tool

Example: Integrate into Proxmox UI plugin

```typescript
// proxmox-plugin/src/VPNManagement.tsx
import { HubProvider, SpokeManager } from '@dtolan/hub-and-spoke-wireguard'

export function ProxmoxVPNTab() {
  return (
    <HubProvider apiBaseUrl="/api/wireguard">
      <SpokeManager
        showProxmoxOnly={true}  // Filter to Proxmox spokes only
        onSpokeClick={handleNodeSelection}
      />
    </HubProvider>
  )
}
```

### Backend Integration

Expose backend API routes in your existing Express app:

```typescript
import express from 'express'
import { installationRoutes, spokeRoutes, hubRoutes } from '@dtolan/hub-and-spoke-wireguard/backend'

const app = express()

app.use('/api/wireguard/installation', installationRoutes)
app.use('/api/wireguard/spoke', spokeRoutes)
app.use('/api/wireguard/hub', hubRoutes)
```

---

## 💻 Development

### Local Development Setup

```bash
# Install dependencies
npm install

# Start development servers (parallel)
npm run dev          # Frontend (Vite) - http://localhost:5173
npm run dev:backend  # Backend (Express) - http://localhost:3000

# Type checking
npm run type-check

# Linting
npm run lint

# Build for production
npm run build
npm run build:backend
```

### Project Structure

```
hub_and_spoke_wireguard/
├── src/
│   ├── backend/
│   │   ├── server.ts                    # Express entry point
│   │   ├── config/
│   │   │   ├── database.ts              # SQLite setup + schema
│   │   │   └── migrate.ts               # Database migrations
│   │   ├── controllers/
│   │   │   ├── HubController.ts         # Hub initialization, config
│   │   │   ├── InstallationController.ts # Token generation, script serving
│   │   │   └── SpokeController.ts       # Spoke registration, listing
│   │   ├── services/
│   │   │   ├── TokenService.ts          # Token generation/validation
│   │   │   ├── WireGuardService.ts      # WireGuard CLI wrapper
│   │   │   ├── ScriptGenerator.ts       # Template rendering
│   │   │   └── IPAddressPool.ts         # IP allocation
│   │   ├── routes/
│   │   │   ├── hub.routes.ts
│   │   │   ├── installation.routes.ts
│   │   │   └── spoke.routes.ts
│   │   └── scripts/
│   │       ├── install-spoke-linux.sh.template
│   │       ├── install-spoke-macos.sh.template
│   │       ├── install-spoke-windows.ps1.template
│   │       └── install-spoke-proxmox.sh.template
│   ├── components/
│   │   ├── Dashboard.tsx                # Main dashboard component
│   │   ├── HubInitializer.tsx           # First-time setup wizard
│   │   ├── SpokeManager.tsx             # Spoke list/management
│   │   ├── InstallationTokenGenerator.tsx
│   │   ├── InstallationInstructions.tsx
│   │   ├── TokensList.tsx
│   │   └── ProxmoxClusterView.tsx       # Hierarchical cluster view
│   ├── contexts/
│   │   └── HubContext.tsx               # React context for state
│   ├── types/
│   │   └── index.ts                     # TypeScript definitions
│   ├── main.tsx                         # React entry point
│   └── index.ts                         # Library entry point
├── dist/                                # Build output
├── database.sqlite                      # SQLite database (gitignored)
├── package.json
├── tsconfig.json
├── tsconfig.backend.json
├── vite.config.ts
└── README.md
```

### Database Schema

```sql
-- Hub configuration (single row)
CREATE TABLE hub_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  interface_address TEXT NOT NULL,
  listen_port INTEGER NOT NULL,
  private_key TEXT NOT NULL,
  public_key TEXT NOT NULL,
  network_cidr TEXT NOT NULL,
  dns TEXT,  -- JSON array
  public_endpoint TEXT NOT NULL,
  private_endpoint TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Installation tokens (one-time use)
CREATE TABLE installation_tokens (
  id TEXT PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  spoke_id TEXT UNIQUE NOT NULL,
  spoke_name TEXT NOT NULL,
  allowed_ips TEXT NOT NULL,  -- JSON array
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER DEFAULT 0,
  used_at TEXT,
  FOREIGN KEY (spoke_id) REFERENCES spoke_registrations(id)
);

-- Spoke registrations
CREATE TABLE spoke_registrations (
  id TEXT PRIMARY KEY,
  token_id TEXT NOT NULL,
  name TEXT NOT NULL,
  public_key TEXT UNIQUE NOT NULL,
  allowed_ips TEXT NOT NULL,  -- JSON array
  registered_at TEXT NOT NULL,
  last_handshake TEXT,
  status TEXT NOT NULL,  -- pending/active/inactive
  os TEXT NOT NULL,  -- linux/macos/windows/proxmox
  is_proxmox INTEGER DEFAULT 0,
  proxmox_cluster_id TEXT,
  proxmox_node_name TEXT,
  proxmox_version TEXT,
  metadata TEXT,  -- JSON
  FOREIGN KEY (token_id) REFERENCES installation_tokens(id),
  FOREIGN KEY (proxmox_cluster_id) REFERENCES proxmox_clusters(id)
);

-- Proxmox clusters
CREATE TABLE proxmox_clusters (
  id TEXT PRIMARY KEY,
  cluster_name TEXT UNIQUE NOT NULL,
  datacenter TEXT,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

---

## 🐛 Troubleshooting

### Common Issues

#### 1. **DNS Resolution Failure** (testing.prfmv.com not resolving)

**Symptom**: Script fails with "Cannot resolve hostname"

**Solution**: Use IP address instead of domain name for public endpoint
```bash
# In dashboard, update hub config:
# Public Endpoint: 203.0.113.5:51820 (not testing.prfmv.com:51820)
```

#### 2. **Private Endpoint Detection Fails**

**Symptom**: "Private endpoint not reachable" when it should be

**Cause**: `nc` (netcat) not installed on spoke

**Solution**: Install netcat
```bash
# Ubuntu/Debian
sudo apt install netcat-openbsd

# CentOS/RHEL
sudo yum install nc
```

#### 3. **Proxmox Enterprise Repository Error**

**Symptom**: `401 Unauthorized` from enterprise.proxmox.com

**Solution**: Disable enterprise repos, enable community repos
```bash
rm -f /etc/apt/sources.list.d/pve-enterprise.list
mv /etc/apt/sources.list.d/pve-enterprise.sources /etc/apt/sources.list.d/pve-enterprise.sources.disabled 2>/dev/null || true
apt-get update
apt-get install -y wireguard wireguard-tools
```

#### 4. **Hub Not Reloading Config**

**Symptom**: New spokes registered but not in `wg show`

**Cause**: Backend lacks permissions to run `wg syncconf`

**Solution**: Run backend as root or configure sudo
```bash
# Option 1: Run backend as root (development only)
sudo npm run dev:backend

# Option 2: Configure passwordless sudo for wg commands
echo 'nodeuser ALL=(ALL) NOPASSWD: /usr/bin/wg, /usr/bin/wg-quick' | sudo tee /etc/sudoers.d/wireguard
```

#### 5. **Token Already Used**

**Symptom**: Registration fails with `TOKEN_ALREADY_USED`

**Cause**: Token was consumed during failed installation attempt

**Solution**: Generate new token (tokens are single-use)

---

## 📚 Additional Documentation

- **[PROXMOX_REPO_FIX.md](PROXMOX_REPO_FIX.md)** - Proxmox repository configuration guide
- **[Architecture Diagrams](docs/diagrams/)** - Visual system diagrams
- **[API Specification](docs/API.md)** - Full OpenAPI specification (TODO)

---

## 🤝 Contributing

This is a **proof-of-concept** designed for extension and integration. Contributions welcome:

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### Development Guidelines

- **TypeScript**: All new code must be TypeScript with strict type checking
- **Testing**: Add tests for new API endpoints (TODO: set up Jest)
- **Security**: Never store private keys in database or logs
- **Comments**: Document non-obvious logic
- **Error Handling**: Provide clear error messages with recovery hints

---

## 📄 License

ISC License - see [LICENSE](LICENSE) file for details

---

## 🙏 Acknowledgments

- **WireGuard**: Jason A. Donenfeld and the WireGuard team
- **React**: Meta and the React team
- **Vite**: Evan You and the Vite team
- **Express**: TJ Holowaychuk and contributors

---

## 📞 Support

For questions, issues, or feature requests:

- **GitHub Issues**: https://github.com/yourusername/hub_and_spoke_wireguard/issues
- **Discussions**: https://github.com/yourusername/hub_and_spoke_wireguard/discussions

---

**Built with ❤️ as a reference implementation for production VPN management systems.**
