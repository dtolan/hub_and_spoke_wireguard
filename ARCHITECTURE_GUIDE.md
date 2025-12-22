# WireGuard Hub-and-Spoke VPN Management System
## Architecture & Implementation Guide

**Version**: 1.0
**Date**: 2025-12-22
**Status**: Design Review - Pending Approval

---

## Executive Summary

This document describes a full-stack TypeScript/React system for automated WireGuard VPN deployment in a hub-and-spoke topology, with specialized support for **Proxmox VE multi-cluster environments**. The system provides one-time-use installation tokens, automatic spoke provisioning via shell scripts, and a centralized management dashboard.

**Key Features**:
- One-time-use cryptographic tokens (256-bit, 24-hour expiration)
- Multi-platform installation scripts (Linux, macOS, Windows, Proxmox VE)
- Automatic Proxmox cluster detection and organization
- Zero-trust key generation (private keys never leave spokes)
- Hub auto-configuration upon spoke registration
- RESTful API with rate limiting and validation

**Technology Stack**:
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **Database**: SQLite (production: PostgreSQL recommended)
- **VPN**: WireGuard kernel module

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Security Model](#2-security-model)
3. [Data Model & Database Schema](#3-data-model--database-schema)
4. [API Specification](#4-api-specification)
5. [Installation Script Design](#5-installation-script-design)
6. [Proxmox Integration](#6-proxmox-integration)
7. [Network Design](#7-network-design)
8. [Deployment Architecture](#8-deployment-architecture)
9. [Error Handling & Recovery](#9-error-handling--recovery)
10. [Performance & Scalability](#10-performance--scalability)
11. [Security Considerations](#11-security-considerations)
12. [Testing Strategy](#12-testing-strategy)
13. [Operational Procedures](#13-operational-procedures)
14. [Risk Assessment](#14-risk-assessment)
15. [Implementation Roadmap](#15-implementation-roadmap)

---

## 1. System Architecture

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Internet / WAN                           │
└────────────────────────┬────────────────────────────────────┘
                         │
            ┌────────────▼────────────┐
            │   Hub Server (Central)  │
            │  - WireGuard Interface  │
            │  - Express API Backend  │
            │  - React Dashboard      │
            │  - SQLite Database      │
            └────────────┬────────────┘
                         │
            ┌────────────┴────────────┐
            │   VPN Network (Mesh)    │
            │   10.0.1.0/24           │
            └────┬────────────────┬───┘
                 │                │
       ┌─────────▼──────┐   ┌────▼──────────────┐
       │  Regular Spokes │   │ Proxmox Clusters  │
       │  - Linux        │   │  DC1: 3 nodes     │
       │  - macOS        │   │  DC2: 2 nodes     │
       │  - Windows      │   │  Edge: 2 nodes    │
       └─────────────────┘   └───────────────────┘
```

### 1.2 Component Architecture

#### Frontend (React SPA)
```
src/
├── components/
│   ├── HubInitializer.tsx        # First-run setup wizard
│   ├── Dashboard.tsx              # Main dashboard container
│   ├── SpokeManager.tsx           # Spoke list & management
│   ├── ProxmoxClusterView.tsx     # Hierarchical cluster view
│   ├── InstallationTokenGenerator.tsx  # Token creation UI
│   └── InstallationInstructions.tsx    # Platform-specific commands
├── contexts/
│   └── HubContext.tsx             # Global state management
├── types/
│   └── index.ts                   # TypeScript interfaces
└── utils/
    ├── configGenerator.ts         # WireGuard config templates
    └── keyManagement.ts           # Key validation utilities
```

#### Backend (Express API)
```
src/backend/
├── server.ts                      # Express app entry point
├── config/
│   ├── database.ts                # SQLite connection & schema
│   └── migrate.ts                 # Database migration runner
├── services/
│   ├── TokenService.ts            # Token generation & validation
│   ├── WireGuardService.ts        # Hub config management
│   ├── ScriptGenerator.ts         # Template rendering
│   └── IPAddressPool.ts           # CIDR-based IP allocation
├── controllers/
│   ├── HubController.ts           # Hub initialization endpoints
│   ├── InstallationController.ts  # Token & script serving
│   ├── SpokeController.ts         # Spoke registration & management
│   └── ProxmoxController.ts       # Cluster management
├── routes/
│   ├── hub.routes.ts
│   ├── installation.routes.ts
│   ├── spoke.routes.ts
│   └── proxmox.routes.ts
├── middleware/
│   ├── rateLimiter.ts             # Rate limiting (10 tokens/hour)
│   └── validation.ts              # Zod schema validation
└── scripts/
    ├── install-spoke-linux.sh.template
    ├── install-spoke-macos.sh.template
    ├── install-spoke-windows.ps1.template
    └── install-spoke-proxmox.sh.template
```

### 1.3 Data Flow

#### Spoke Provisioning Flow
```
1. Admin → Dashboard: "Add Spoke: laptop-001"
   ↓
2. Backend: Generate token (256-bit random)
   ↓
3. Backend: Allocate IP (10.0.1.5/24 from CIDR pool)
   ↓
4. Database: Store token (unused, expires 24h)
   ↓
5. Dashboard → Admin: Show installation command
   ↓
6. Admin → Spoke: Execute installation script
   ↓
7. Spoke: Install WireGuard, generate keys locally
   ↓
8. Spoke → Backend: POST /api/spoke/register {token, publicKey}
   ↓
9. Backend: Validate token (unused, not expired)
   ↓
10. Backend: Mark token as used (atomic operation)
    ↓
11. Backend: Execute `wg set wg0 peer <publicKey> allowed-ips 10.0.1.5/32`
    ↓
12. Backend: Execute `wg-quick save wg0`
    ↓
13. Spoke: Create /etc/wireguard/wg0.conf, start interface
    ↓
14. Dashboard: Show spoke as "Active" (green checkmark)
```

---

## 2. Security Model

### 2.1 Threat Model

**Assets to Protect**:
- Hub private key (compromise = full network compromise)
- Installation tokens (limited blast radius: single spoke)
- Spoke private keys (never transmitted)
- Hub database (contains network topology)

**Threat Actors**:
- External attackers (internet-facing hub)
- Malicious insiders (stolen tokens)
- Man-in-the-middle (token interception)
- Replay attacks (reused tokens)

### 2.2 Security Controls

#### Token Security
```typescript
// Token generation (backend/services/TokenService.ts)
const token = crypto.randomBytes(32).toString('base64url')  // 256-bit
const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)  // 24 hours

// Atomic mark-as-used (prevents race conditions)
db.prepare(`
  UPDATE installation_tokens
  SET used = 1, used_at = ?
  WHERE token = ? AND used = 0
`).run(now, token)

if (result.changes === 0) throw new Error('TOKEN_ALREADY_USED')
```

#### Key Management
- **Hub keys**: Generated once during initialization, stored encrypted at rest
- **Spoke keys**: Generated on spoke device, private key NEVER sent to hub
- **Pre-shared keys** (optional): Additional layer per-peer encryption

#### Transport Security
- **HTTPS required**: All API communication over TLS 1.3
- **CORS policy**: Restrict origins to hub domain only
- **Rate limiting**: 10 token generations per hour per IP

#### WireGuard Security
- **AllowedIPs enforcement**: Each spoke limited to assigned IP
- **PersistentKeepalive**: 25 seconds (NAT traversal + liveness detection)
- **No forwarding by default**: Spokes cannot route between each other

### 2.3 Attack Scenarios & Mitigations

| Attack | Mitigation |
|--------|------------|
| Token theft (MITM) | HTTPS + short expiration (24h) |
| Token replay | One-time use + atomic DB update |
| Token brute force | 256-bit entropy (2^256 combinations) |
| Hub key compromise | No automated recovery - requires full rebuild |
| Spoke impersonation | Public key uniqueness constraint in DB |
| Script tampering | Serve via HTTPS, optional checksum validation |
| DoS (token exhaustion) | Rate limiting + IP allowlisting |

---

## 3. Data Model & Database Schema

### 3.1 Entity Relationship Diagram

```
┌─────────────────────┐
│   hub_config (1)    │
│  - id               │
│  - private_key      │
│  - public_key       │
│  - network_cidr     │
│  - endpoint         │
└─────────────────────┘

┌─────────────────────────┐         ┌──────────────────────┐
│ installation_tokens     │         │ proxmox_clusters     │
│  - id (PK)              │         │  - id (PK)           │
│  - token (UNIQUE)       │         │  - cluster_name      │
│  - spoke_id             │         │  - datacenter        │
│  - spoke_name           │         └──────────────────────┘
│  - allowed_ips (JSON)   │                  ▲
│  - used (BOOLEAN)       │                  │
│  - expires_at           │                  │ FK
└─────────────────────────┘                  │
         │                                   │
         │ FK                                │
         ▼                                   │
┌────────────────────────────────────────────┴───┐
│ spoke_registrations                            │
│  - id (PK)                                     │
│  - token_id (FK)                               │
│  - public_key (UNIQUE)                         │
│  - allowed_ips (JSON)                          │
│  - os (linux|macos|windows|proxmox)            │
│  - is_proxmox (BOOLEAN)                        │
│  - proxmox_cluster_id (FK, nullable)           │
│  - proxmox_node_name                           │
│  - status (pending|active|inactive)            │
│  - last_handshake (DATETIME)                   │
└────────────────────────────────────────────────┘
```

### 3.2 Schema Details

#### installation_tokens
```sql
CREATE TABLE installation_tokens (
  id TEXT PRIMARY KEY,                    -- UUID v4
  token TEXT UNIQUE NOT NULL,             -- 32-byte base64url
  spoke_id TEXT UNIQUE NOT NULL,          -- Pre-assigned UUID
  spoke_name TEXT NOT NULL,               -- User-friendly name
  allowed_ips TEXT NOT NULL,              -- JSON: ["10.0.1.5/24"]
  created_at TEXT NOT NULL,               -- ISO 8601
  expires_at TEXT NOT NULL,               -- ISO 8601
  used INTEGER DEFAULT 0,                 -- SQLite BOOLEAN (0/1)
  used_at TEXT,                           -- ISO 8601
  hub_endpoint TEXT NOT NULL,             -- "1.2.3.4:51820"
  hub_public_key TEXT NOT NULL,           -- Base64
  network_cidr TEXT NOT NULL,             -- "10.0.1.0/24"
  dns TEXT,                               -- JSON: ["1.1.1.1"]
  persistent_keepalive INTEGER DEFAULT 25
);

CREATE INDEX idx_tokens_token ON installation_tokens(token);
CREATE INDEX idx_tokens_used ON installation_tokens(used);
```

#### spoke_registrations
```sql
CREATE TABLE spoke_registrations (
  id TEXT PRIMARY KEY,                    -- Same as spoke_id from token
  token_id TEXT NOT NULL,
  name TEXT NOT NULL,
  public_key TEXT UNIQUE NOT NULL,        -- Base64, 44 chars
  allowed_ips TEXT NOT NULL,              -- JSON array
  registered_at TEXT NOT NULL,
  last_handshake TEXT,                    -- Updated from `wg show`
  status TEXT NOT NULL,                   -- enum
  os TEXT NOT NULL,                       -- enum

  -- Proxmox-specific fields
  is_proxmox INTEGER DEFAULT 0,
  proxmox_cluster_id TEXT,                -- FK to proxmox_clusters
  proxmox_node_name TEXT,                 -- "pve1", "pve2", etc.
  proxmox_version TEXT,                   -- "8.1.3"

  metadata TEXT,                          -- JSON for extensibility

  FOREIGN KEY (token_id) REFERENCES installation_tokens(id),
  FOREIGN KEY (proxmox_cluster_id) REFERENCES proxmox_clusters(id)
);

CREATE INDEX idx_spokes_public_key ON spoke_registrations(public_key);
CREATE INDEX idx_spokes_status ON spoke_registrations(status);
CREATE INDEX idx_spokes_cluster ON spoke_registrations(proxmox_cluster_id);
```

#### proxmox_clusters
```sql
CREATE TABLE proxmox_clusters (
  id TEXT PRIMARY KEY,
  cluster_name TEXT UNIQUE NOT NULL,      -- From `pvecm status`
  datacenter TEXT,                        -- User-provided metadata
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

#### hub_config (singleton)
```sql
CREATE TABLE hub_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),  -- Enforce single row
  interface_address TEXT NOT NULL,        -- "10.0.1.1/24"
  listen_port INTEGER NOT NULL,           -- 51820
  private_key TEXT NOT NULL,              -- Base64
  public_key TEXT NOT NULL,               -- Base64
  network_cidr TEXT NOT NULL,             -- "10.0.1.0/24"
  dns TEXT,                               -- JSON array
  endpoint TEXT NOT NULL,                 -- Public IP:port
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 3.3 Data Integrity Constraints

- **Token uniqueness**: UNIQUE constraint on `token` column
- **Public key uniqueness**: Prevents spoke impersonation
- **Foreign key enforcement**: `PRAGMA foreign_keys = ON`
- **Atomic updates**: Use transactions for multi-step operations
- **JSON validation**: Validate JSON strings before INSERT

---

## 4. API Specification

### 4.1 Hub Management Endpoints

#### POST /api/hub/initialize
**Purpose**: First-run hub setup

**Request**:
```json
{
  "networkCIDR": "10.0.1.0/24",
  "listenPort": 51820,
  "endpoint": "203.0.113.5:51820",
  "dns": ["1.1.1.1", "8.8.8.8"]
}
```

**Response** (201 Created):
```json
{
  "id": 1,
  "publicKey": "hub-public-key-base64",
  "interfaceAddress": "10.0.1.1/24",
  "listenPort": 51820,
  "endpoint": "203.0.113.5:51820",
  "networkCIDR": "10.0.1.0/24"
}
```

**Side Effects**:
1. Generates hub keypair (`wg genkey | wg pubkey`)
2. Creates `/etc/wireguard/wg0.conf`
3. Executes `systemctl enable wg-quick@wg0`
4. Executes `systemctl start wg-quick@wg0`

---

#### GET /api/hub/config
**Purpose**: Retrieve current hub configuration

**Response** (200 OK):
```json
{
  "id": 1,
  "interfaceAddress": "10.0.1.1/24",
  "listenPort": 51820,
  "publicKey": "hub-public-key-base64",
  "endpoint": "203.0.113.5:51820",
  "networkCIDR": "10.0.1.0/24",
  "dns": ["1.1.1.1"]
}
```

**Note**: Private key NOT returned for security

---

#### GET /api/hub/status
**Purpose**: Get WireGuard interface status

**Response** (200 OK):
```json
{
  "interface": "wg0",
  "listenPort": 51820,
  "peers": [
    {
      "publicKey": "spoke1-public-key",
      "endpoint": "203.0.113.10:41234",
      "allowedIPs": ["10.0.1.5/32"],
      "lastHandshake": "2025-12-22T15:30:00Z",
      "bytesReceived": 123456,
      "bytesSent": 234567
    }
  ]
}
```

**Implementation**: Parses `wg show wg0 dump`

---

### 4.2 Installation Token Endpoints

#### POST /api/installation/token
**Purpose**: Generate new installation token

**Request**:
```json
{
  "spokeName": "laptop-001",
  "customIP": "10.0.1.100/24"  // Optional
}
```

**Response** (201 Created):
```json
{
  "id": "uuid-123",
  "token": "random-256bit-base64url",
  "spokeId": "uuid-456",
  "spokeName": "laptop-001",
  "allowedIPs": ["10.0.1.5/24"],
  "createdAt": "2025-12-22T10:00:00Z",
  "expiresAt": "2025-12-23T10:00:00Z",
  "used": false
}
```

**Rate Limit**: 10 requests per hour per IP

---

#### GET /api/installation/script/:token?platform=linux
**Purpose**: Serve installation script

**Query Parameters**:
- `platform`: `linux` | `macos` | `windows` | `proxmox`

**Response** (200 OK):
```bash
Content-Type: text/plain

#!/bin/bash
set -e

TOKEN="abc123xyz..."
HUB_ENDPOINT="203.0.113.5:51820"
HUB_PUBLIC_KEY="hub-key..."
SPOKE_IP="10.0.1.5/24"
# ... (full script content)
```

**Side Effect**: Marks token as `used = 1` (atomic)

**Error Response** (401 Unauthorized):
```json
{
  "error": "Token has already been used",
  "code": "TOKEN_ALREADY_USED",
  "usedAt": "2025-12-22T14:30:00Z"
}
```

---

### 4.3 Spoke Registration Endpoints

#### POST /api/spoke/register
**Purpose**: Spoke reports public key after installation

**Request**:
```json
{
  "token": "abc123xyz...",
  "publicKey": "spoke-public-key-base64",
  "os": "linux",
  "metadata": {
    "wireguardVersion": "1.0.20210424"
  }
}
```

**Proxmox Request** (extended):
```json
{
  "token": "abc123xyz...",
  "publicKey": "spoke-public-key-base64",
  "os": "proxmox",
  "isProxmox": true,
  "proxmoxNodeName": "pve1",
  "proxmoxClusterName": "datacenter1-prod",
  "proxmoxVersion": "8.1.3",
  "metadata": {
    "isClustered": true,
    "clusterNodes": "pve1,pve2,pve3"
  }
}
```

**Response** (201 Created):
```json
{
  "spokeId": "uuid-456",
  "name": "laptop-001",
  "allowedIPs": ["10.0.1.5/24"],
  "status": "pending"
}
```

**Side Effects**:
1. Validates token (unused, not expired)
2. Validates public key format (44-char base64)
3. Checks public key uniqueness
4. Creates spoke registration record
5. **Proxmox**: Auto-creates cluster record if needed
6. Executes `wg set wg0 peer <publicKey> allowed-ips 10.0.1.5/32`
7. Executes `wg-quick save wg0`

---

#### GET /api/spoke/list
**Purpose**: List all registered spokes

**Response** (200 OK):
```json
[
  {
    "id": "uuid-456",
    "name": "laptop-001",
    "publicKey": "spoke-public-key",
    "allowedIPs": ["10.0.1.5/24"],
    "status": "active",
    "os": "linux",
    "registeredAt": "2025-12-22T10:15:00Z",
    "lastHandshake": "2025-12-22T15:30:00Z"
  },
  {
    "id": "uuid-789",
    "name": "pve1.dc1",
    "publicKey": "pve1-public-key",
    "allowedIPs": ["10.0.1.10/24"],
    "status": "active",
    "os": "proxmox",
    "isProxmox": true,
    "proxmoxClusterId": "cluster-uuid",
    "proxmoxNodeName": "pve1",
    "registeredAt": "2025-12-22T11:00:00Z"
  }
]
```

---

### 4.4 Proxmox-Specific Endpoints

#### GET /api/proxmox/clusters
**Purpose**: List all Proxmox clusters

**Response** (200 OK):
```json
[
  {
    "id": "cluster-uuid-1",
    "clusterName": "datacenter1-prod",
    "datacenter": "DC1",
    "nodeCount": 3,
    "createdAt": "2025-12-22T10:00:00Z"
  },
  {
    "id": "cluster-uuid-2",
    "clusterName": "datacenter2-backup",
    "datacenter": "DC2",
    "nodeCount": 2,
    "createdAt": "2025-12-22T11:00:00Z"
  }
]
```

---

#### GET /api/proxmox/clusters/:id
**Purpose**: Get cluster details with all nodes

**Response** (200 OK):
```json
{
  "id": "cluster-uuid-1",
  "clusterName": "datacenter1-prod",
  "datacenter": "DC1",
  "nodes": [
    {
      "id": "spoke-uuid-1",
      "name": "pve1.dc1",
      "proxmoxNodeName": "pve1",
      "allowedIPs": ["10.0.1.10/24"],
      "status": "active",
      "lastHandshake": "2025-12-22T15:30:00Z"
    },
    {
      "id": "spoke-uuid-2",
      "name": "pve2.dc1",
      "proxmoxNodeName": "pve2",
      "allowedIPs": ["10.0.1.11/24"],
      "status": "active",
      "lastHandshake": "2025-12-22T15:29:00Z"
    }
  ]
}
```

---

## 5. Installation Script Design

### 5.1 Linux Script (Bash)

**File**: `src/backend/scripts/install-spoke-linux.sh.template`

**Key Functions**:
1. **Detect distribution**: Ubuntu/Debian (apt), RHEL/CentOS (yum), Fedora (dnf)
2. **Install WireGuard**: `apt-get install wireguard wireguard-tools`
3. **Generate keys**: `wg genkey | tee /tmp/privatekey | wg pubkey`
4. **Register**: `curl -X POST $CALLBACK_URL -d {...}`
5. **Create config**: `/etc/wireguard/wg0.conf` with `chmod 600`
6. **Enable service**: `systemctl enable wg-quick@wg0`
7. **Start interface**: `systemctl start wg-quick@wg0`

**Error Handling**:
- `set -e`: Exit on any error
- Check HTTP response codes from registration
- Rollback: Remove config file if registration fails
- Clear error messages with recovery hints

---

### 5.2 Proxmox Script (Bash + Proxmox API)

**File**: `src/backend/scripts/install-spoke-proxmox.sh.template`

**Additional Functions**:
```bash
detect_proxmox() {
  if ! command -v pveversion &> /dev/null; then
    echo "Error: Not a Proxmox VE system"
    exit 1
  fi
  PVE_VERSION=$(pveversion | head -n1 | awk '{print $2}')
}

detect_cluster() {
  CLUSTER_STATUS=$(pvecm status 2>/dev/null || echo "not_clustered")

  if echo "$CLUSTER_STATUS" | grep -q "Cluster information"; then
    IS_CLUSTERED=true
    CLUSTER_NAME=$(echo "$CLUSTER_STATUS" | grep "Name:" | awk '{print $2}')
    NODE_NAME=$(hostname)
    CLUSTER_NODES=$(pvecm nodes | grep -v "^Node" | awk '{print $3}' | tr '\n' ',')
  else
    IS_CLUSTERED=false
    CLUSTER_NAME=""
    NODE_NAME=$(hostname)
  fi
}
```

**Registration Payload** (extended):
```bash
curl -X POST "$CALLBACK_URL" -H "Content-Type: application/json" -d "{
  \"token\": \"$TOKEN\",
  \"publicKey\": \"$PUBLIC_KEY\",
  \"os\": \"proxmox\",
  \"isProxmox\": true,
  \"proxmoxNodeName\": \"$NODE_NAME\",
  \"proxmoxClusterName\": \"$CLUSTER_NAME\",
  \"proxmoxVersion\": \"$PVE_VERSION\",
  \"metadata\": {
    \"isClustered\": $IS_CLUSTERED,
    \"clusterNodes\": \"$CLUSTER_NODES\"
  }
}"
```

---

### 5.3 Windows Script (PowerShell)

**File**: `src/backend/scripts/install-spoke-windows.ps1.template`

**Key Differences**:
- Requires admin: `#Requires -RunAsAdministrator`
- Install via Chocolatey: `choco install wireguard -y`
- Config location: `$env:ProgramFiles\WireGuard\wg0.conf`
- Service management: `wireguard /installtunnelservice wg0.conf`

---

## 6. Proxmox Integration

### 6.1 Cluster Auto-Detection

**Problem**: Determine if Proxmox host is standalone or part of a cluster

**Solution**: Query Proxmox Cluster Manager

```bash
# Check cluster membership
pvecm status

# Output (clustered):
# Cluster information
# --------------------
# Name:             datacenter1-prod
# Config Version:   5
# ...

# Output (standalone):
# (error message or no cluster info)
```

**Implementation**:
- Parse `pvecm status` output
- Extract cluster name via `grep "Name:" | awk '{print $2}'`
- Get node list: `pvecm nodes | awk '{print $3}'`

---

### 6.2 Cluster Organization

**Database Design**:
- Each Proxmox node = individual spoke registration
- Cluster record links all nodes together
- Standalone nodes have `proxmox_cluster_id = NULL`

**Frontend Hierarchy**:
```
🏢 Cluster: datacenter1-prod (3 nodes)
  ├─ pve1 (10.0.1.10) - Active
  ├─ pve2 (10.0.1.11) - Active
  └─ pve3 (10.0.1.12) - Active

💻 Standalone Proxmox
  └─ pve-standalone (10.0.1.50) - Active
```

---

### 6.3 Use Cases

| Use Case | Implementation |
|----------|----------------|
| **Management Access** | SSH over VPN to all nodes |
| **Cluster Communication** | Corosync heartbeat over VPN (optional) |
| **VM Migration** | Live migration traffic over VPN |
| **Shared Storage** | Ceph/NFS traffic over VPN |
| **Monitoring** | Prometheus/Grafana scraping over VPN |

**Network Considerations**:
- **MTU**: May need to reduce for nested tunneling (1420 bytes)
- **Bandwidth**: Ceph/migration requires high bandwidth
- **Latency**: Corosync sensitive to latency (< 10ms recommended)

---

## 7. Network Design

### 7.1 IP Addressing Scheme

**Default CIDR**: `10.0.1.0/24` (254 usable IPs)

| Range | Purpose |
|-------|---------|
| `10.0.1.1` | Hub interface |
| `10.0.1.2-10.0.1.254` | Spoke allocations |

**IP Allocation Algorithm**:
```typescript
// Pseudo-code
function getNextIP(cidr: string, usedIPs: string[]): string {
  const network = parseNetwork(cidr)  // 10.0.1.0
  const prefix = getPrefixLength(cidr)  // 24
  const totalHosts = 2 ** (32 - prefix) - 2  // 254 (subtract network & broadcast)

  for (let i = 1; i <= totalHosts; i++) {
    const candidateIP = network + i
    if (!usedIPs.includes(candidateIP)) {
      return `${candidateIP}/${prefix}`  // e.g., "10.0.1.5/24"
    }
  }

  throw new Error('No available IPs in CIDR range')
}
```

---

### 7.2 Routing & Forwarding

**Hub Configuration**:
```ini
[Interface]
Address = 10.0.1.1/24
ListenPort = 51820
PrivateKey = <hub-private-key>

# Enable IP forwarding
PostUp = sysctl -w net.ipv4.ip_forward=1
PostDown = sysctl -w net.ipv4.ip_forward=0

[Peer]
# Spoke 1: laptop-001
PublicKey = spoke1-public-key
AllowedIPs = 10.0.1.5/32

[Peer]
# Spoke 2: pve1.dc1
PublicKey = pve1-public-key
AllowedIPs = 10.0.1.10/32
```

**Spoke Configuration**:
```ini
[Interface]
Address = 10.0.1.5/24
PrivateKey = <spoke-private-key>
DNS = 1.1.1.1

[Peer]
# Hub
PublicKey = <hub-public-key>
Endpoint = 203.0.113.5:51820
AllowedIPs = 10.0.1.0/24
PersistentKeepalive = 25
```

**Key Points**:
- **Hub**: `AllowedIPs = spoke-ip/32` (only allow traffic from assigned IP)
- **Spoke**: `AllowedIPs = 10.0.1.0/24` (route all VPN traffic through hub)
- **Spoke-to-Spoke**: Requires hub IP forwarding

---

### 7.3 NAT Traversal

**Challenge**: Most spokes are behind NAT

**Solution**: `PersistentKeepalive = 25`
- Spoke sends keepalive every 25 seconds
- Hub learns spoke's public IP:port from first packet
- Maintains NAT mapping

**Alternative**: Use dynamic DNS for spoke endpoints

---

## 8. Deployment Architecture

### 8.1 Production Deployment

```
┌──────────────────────────────────┐
│       Load Balancer (Optional)   │
│       - SSL Termination          │
│       - DDoS Protection          │
└────────────┬─────────────────────┘
             │
┌────────────▼─────────────────────┐
│    Reverse Proxy (nginx/Caddy)   │
│    - Serve React SPA (/)         │
│    - Proxy API (/api/*)          │
│    - Rate Limiting               │
└────────────┬─────────────────────┘
             │
   ┌─────────┴─────────┐
   │                   │
┌──▼───────────┐  ┌────▼──────────┐
│  React SPA   │  │  Express API  │
│  (static)    │  │  (Node.js)    │
│  dist/       │  │  Port 3000    │
└──────────────┘  └────┬──────────┘
                       │
                 ┌─────▼─────┐
                 │  SQLite   │
                 └───────────┘

┌─────────────────────────────────┐
│  WireGuard Kernel Module (wg0)  │
│  - Managed by Express API       │
│  - ListenPort: 51820 (UDP)      │
└─────────────────────────────────┘
```

### 8.2 Nginx Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name hub.example.com;

    ssl_certificate /etc/letsencrypt/live/hub.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hub.example.com/privkey.pem;

    # Frontend (React SPA)
    location / {
        root /var/www/hub-and-spoke-wireguard/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 8.3 Firewall Rules

```bash
# UFW (Ubuntu)
ufw allow 443/tcp    # HTTPS (dashboard + API)
ufw allow 51820/udp  # WireGuard
ufw enable

# iptables
iptables -A INPUT -p tcp --dport 443 -j ACCEPT
iptables -A INPUT -p udp --dport 51820 -j ACCEPT
iptables -A INPUT -i wg0 -j ACCEPT
iptables -A FORWARD -i wg0 -j ACCEPT
```

### 8.4 System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 2 GB | 4 GB |
| Disk | 20 GB | 50 GB (logs) |
| Network | 100 Mbps | 1 Gbps |
| OS | Ubuntu 22.04 | Ubuntu 24.04 LTS |

**WireGuard Performance**: Can saturate 1 Gbps on modern CPU

---

## 9. Error Handling & Recovery

### 9.1 Error Classification

| Error Type | HTTP Code | Recovery |
|------------|-----------|----------|
| Token not found | 404 | Generate new token |
| Token already used | 401 | Generate new token |
| Token expired | 401 | Generate new token |
| Invalid public key | 400 | Check key format |
| Duplicate public key | 409 | Contact admin |
| Database error | 500 | Retry, check logs |
| WireGuard command failed | 500 | Manual intervention |

### 9.2 Script Error Handling

**Spoke Installation Script**:
```bash
set -e  # Exit on error

# Trap errors and cleanup
trap 'echo "Error at line $LINENO"; rm -f /etc/wireguard/wg0.conf' ERR

# Example error check
if ! curl -X POST "$CALLBACK_URL" ... ; then
  echo "ERROR: Failed to register with hub"
  echo "RECOVERY: Generate a new token and try again"
  exit 1
fi
```

### 9.3 Hub Recovery Procedures

**Scenario: Hub Database Corruption**
1. Stop Express API: `systemctl stop wireguard-hub-api`
2. Backup database: `cp database.sqlite database.sqlite.bak`
3. Attempt repair: `sqlite3 database.sqlite "PRAGMA integrity_check"`
4. If corrupt: Restore from backup
5. Restart API: `systemctl start wireguard-hub-api`

**Scenario: Hub Private Key Lost**
- **Impact**: CATASTROPHIC - entire network must be rebuilt
- **Prevention**: Encrypt and backup private key immediately after hub initialization
- **Recovery**: No automated recovery - manual rebuild required

---

## 10. Performance & Scalability

### 10.1 Performance Metrics

| Metric | Target |
|--------|--------|
| Token generation latency | < 100ms |
| Spoke registration latency | < 500ms (includes WireGuard reload) |
| Dashboard load time | < 2 seconds |
| Hub WireGuard throughput | 900+ Mbps (1 Gbps link) |
| Max concurrent spokes | 200+ (IPv4 /24 limit: 254) |

### 10.2 Bottlenecks

1. **IP Exhaustion**: Limited by CIDR (e.g., /24 = 254 hosts)
   - **Solution**: Use larger CIDR (e.g., /16 = 65,534 hosts)

2. **Database Locking** (SQLite):
   - **Write contention**: Only one writer at a time
   - **Solution**: Migrate to PostgreSQL for high-concurrency

3. **WireGuard Reload Latency**:
   - **Current**: `wg set` + `wg-quick save` (~200ms)
   - **Optimization**: Batch updates (reload every 10 seconds)

### 10.3 Scaling Strategies

**Horizontal Scaling** (Multiple Hubs):
- Partition spokes across multiple hubs by region/datacenter
- Each hub manages separate CIDR (e.g., Hub1: 10.0.1.0/24, Hub2: 10.0.2.0/24)
- Cross-hub routing via BGP or static routes

**Database Scaling**:
- SQLite → PostgreSQL (when > 100 spokes or high write rate)
- Read replicas for spoke status queries
- Redis cache for frequently accessed data

---

## 11. Security Considerations

### 11.1 OWASP Top 10 Mitigation

| Vulnerability | Mitigation |
|---------------|------------|
| **Injection** | Prepared statements (SQLite), no shell string concatenation |
| **Broken Auth** | HTTPS + CORS + rate limiting, consider JWT for admin auth |
| **Sensitive Data Exposure** | Hub private key encrypted at rest, never return in API |
| **XXE** | No XML parsing |
| **Broken Access Control** | Token-based access (one token = one spoke) |
| **Security Misconfiguration** | Disable directory listing, remove debug endpoints in prod |
| **XSS** | React escapes by default, Content-Security-Policy header |
| **Insecure Deserialization** | JSON only, validate with Zod schemas |
| **Using Components with Known Vulnerabilities** | `npm audit`, Dependabot alerts |
| **Insufficient Logging & Monitoring** | Log all token generation/usage, spoke registrations |

### 11.2 Compliance Considerations

**PCI DSS** (if applicable):
- Encrypt hub private key at rest (AES-256)
- Implement network segmentation (WireGuard provides this)
- Log all administrative access

**GDPR** (if storing user data):
- Spoke names may be PII (depends on naming convention)
- Implement data retention policy (auto-delete old spokes)
- Provide spoke deletion API

### 11.3 Penetration Testing Checklist

- [ ] Token brute force resistance (256-bit entropy)
- [ ] Token replay attack (atomic mark-as-used)
- [ ] SQL injection (prepared statements)
- [ ] Command injection (parameterized `spawn()`)
- [ ] MITM (HTTPS enforcement)
- [ ] DoS via token exhaustion (rate limiting)
- [ ] Unauthorized spoke deletion (implement auth)
- [ ] Hub private key exposure (audit API responses)

---

## 12. Testing Strategy

### 12.1 Unit Tests

**Backend Services** (`jest` + `@types/jest`):
```typescript
describe('TokenService', () => {
  it('generates unique 256-bit tokens', () => {
    const token1 = TokenService.generateToken({...})
    const token2 = TokenService.generateToken({...})
    expect(token1.token).not.toEqual(token2.token)
    expect(token1.token).toHaveLength(43)  // 32 bytes base64url
  })

  it('prevents token reuse', () => {
    const token = TokenService.generateToken({...})
    TokenService.validateAndMarkUsed(token.token)
    expect(() => TokenService.validateAndMarkUsed(token.token))
      .toThrow('TOKEN_ALREADY_USED')
  })
})
```

**Frontend Components** (`@testing-library/react`):
```typescript
describe('InstallationInstructions', () => {
  it('renders all platform tabs', () => {
    render(<InstallationInstructions token="abc123" />)
    expect(screen.getByText('Linux')).toBeInTheDocument()
    expect(screen.getByText('Proxmox VE')).toBeInTheDocument()
  })
})
```

### 12.2 Integration Tests

**API Endpoint Tests**:
```typescript
describe('POST /api/spoke/register', () => {
  it('registers spoke with valid token', async () => {
    const token = await createTestToken()
    const response = await request(app)
      .post('/api/spoke/register')
      .send({ token: token.token, publicKey: 'test-key...' })
    expect(response.status).toBe(201)
  })

  it('rejects already-used token', async () => {
    const token = await createTestToken()
    await request(app).post('/api/spoke/register').send({...})  // First use
    const response = await request(app).post('/api/spoke/register').send({...})  // Second use
    expect(response.status).toBe(401)
    expect(response.body.code).toBe('TOKEN_ALREADY_USED')
  })
})
```

### 12.3 End-to-End Tests

**VM Test Matrix**:

| OS | Version | Test Scenario |
|----|---------|---------------|
| Ubuntu | 22.04 LTS | Fresh install → token → registration |
| Ubuntu | 24.04 LTS | WireGuard pre-installed |
| Debian | 12 | apt-based install |
| RHEL | 9 | yum-based install |
| Proxmox VE | 8.1 | Standalone node |
| Proxmox VE | 8.1 | 3-node cluster |
| macOS | 14 (Sonoma) | Homebrew install |
| Windows | 11 Pro | Chocolatey install |

**Automated Testing**:
- Vagrant/Packer for VM provisioning
- Ansible for test orchestration
- GitLab CI/CD pipeline

---

## 13. Operational Procedures

### 13.1 Backup & Restore

**Daily Backups**:
```bash
#!/bin/bash
# /etc/cron.daily/backup-wireguard-hub

DATE=$(date +%Y%m%d)
BACKUP_DIR=/var/backups/wireguard-hub

# Backup database
cp /var/lib/wireguard-hub/database.sqlite $BACKUP_DIR/database-$DATE.sqlite

# Backup hub private key (encrypted)
tar -czf $BACKUP_DIR/hub-keys-$DATE.tar.gz /etc/wireguard/wg0.conf
gpg --encrypt --recipient admin@example.com $BACKUP_DIR/hub-keys-$DATE.tar.gz

# Retention: keep 30 days
find $BACKUP_DIR -name "*.sqlite" -mtime +30 -delete
```

**Restore Procedure**:
1. Stop API: `systemctl stop wireguard-hub-api`
2. Stop WireGuard: `systemctl stop wg-quick@wg0`
3. Restore database: `cp backup.sqlite /var/lib/wireguard-hub/database.sqlite`
4. Restore keys: `tar -xzf hub-keys-backup.tar.gz -C /`
5. Start WireGuard: `systemctl start wg-quick@wg0`
6. Start API: `systemctl start wireguard-hub-api`

### 13.2 Monitoring

**Metrics to Track**:
- Active spokes (`status = 'active'`)
- Pending tokens (`used = 0` AND `expires_at > NOW()`)
- Token usage rate (tokens generated per hour)
- WireGuard bandwidth (bytes sent/received per spoke)
- Hub CPU/memory usage
- API response times

**Prometheus Exporter** (future enhancement):
```
wireguard_hub_active_spokes{os="linux"} 15
wireguard_hub_active_spokes{os="proxmox"} 7
wireguard_hub_tokens_generated_total 342
wireguard_hub_tokens_used_total 298
```

### 13.3 Logging

**Log Levels**:
- **ERROR**: Failed WireGuard commands, database errors
- **WARN**: Token expiration, unused tokens, spoke inactivity
- **INFO**: Token generation, spoke registration, hub config changes
- **DEBUG**: All API requests (dev only)

**Example Log Entry**:
```json
{
  "timestamp": "2025-12-22T15:30:00Z",
  "level": "INFO",
  "event": "spoke_registered",
  "spokeId": "uuid-456",
  "spokeName": "laptop-001",
  "os": "linux",
  "ip": "10.0.1.5",
  "publicKey": "first-16-chars..."
}
```

---

## 14. Risk Assessment

### 14.1 Critical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Hub private key compromise | Low | CRITICAL | Encrypt at rest, limit access, backup securely |
| Database corruption | Medium | HIGH | Daily backups, integrity checks |
| Token theft (MITM) | Medium | LOW | HTTPS, short expiration |
| IP exhaustion | Low | MEDIUM | Start with /24, expand to /16 if needed |
| WireGuard DoS (port 51820) | Medium | MEDIUM | Firewall rate limiting, Cloudflare Spectrum |
| Proxmox cluster misconfiguration | Medium | LOW | Validate `pvecm` output before registration |

### 14.2 Business Continuity

**RTO (Recovery Time Objective)**: 2 hours
- Restore from backup: 30 minutes
- Re-provision hub: 1 hour
- Spoke reconnection: 30 minutes (automatic)

**RPO (Recovery Point Objective)**: 24 hours
- Daily database backups
- Accept up to 24 hours of lost spoke registrations

---

## 15. Implementation Roadmap

### 15.1 Phase 1: MVP Backend (Week 1)
- [x] Database schema & migrations
- [x] TokenService (generation & validation)
- [x] IPAddressPool service
- [ ] WireGuardService (hub initialization)
- [ ] Express server setup
- [ ] API endpoints (hub, installation, spoke)

### 15.2 Phase 2: Installation Scripts (Week 2)
- [ ] Linux script template
- [ ] Proxmox script template (with cluster detection)
- [ ] macOS script template
- [ ] Windows PowerShell script
- [ ] ScriptGenerator service (template rendering)

### 15.3 Phase 3: Frontend (Week 3)
- [ ] HubContext (state management)
- [ ] HubInitializer (setup wizard)
- [ ] SpokeManager (spoke list)
- [ ] InstallationTokenGenerator
- [ ] InstallationInstructions (platform tabs)
- [ ] ProxmoxClusterView (hierarchical tree)

### 15.4 Phase 4: Testing & Hardening (Week 4)
- [ ] Unit tests (80% coverage)
- [ ] Integration tests (API endpoints)
- [ ] VM tests (Linux, Proxmox, macOS, Windows)
- [ ] Security audit (OWASP Top 10)
- [ ] Load testing (200 concurrent spokes)

### 15.5 Phase 5: Production Deployment (Week 5)
- [ ] Nginx configuration
- [ ] SSL certificate (Let's Encrypt)
- [ ] Firewall rules
- [ ] Backup automation
- [ ] Monitoring setup (Prometheus + Grafana)
- [ ] Documentation (runbooks, troubleshooting)

---

## Appendices

### A. Glossary

- **Hub**: Central VPN server that all spokes connect to
- **Spoke**: Client device (laptop, server, Proxmox node) connected to hub
- **Token**: One-time-use installation credential (256-bit random)
- **CIDR**: Classless Inter-Domain Routing (e.g., 10.0.1.0/24)
- **AllowedIPs**: WireGuard routing table entry (which IPs a peer can use)
- **PersistentKeepalive**: WireGuard setting for NAT traversal (25 seconds)

### B. References

- WireGuard Protocol: https://www.wireguard.com/papers/wireguard.pdf
- Proxmox Cluster Manager: https://pve.proxmox.com/wiki/Cluster_Manager
- Express.js Security Best Practices: https://expressjs.com/en/advanced/best-practice-security.html
- OWASP Top 10: https://owasp.org/www-project-top-ten/

### C. Contact

- **Author**: Development Team
- **Reviewers**: Chief Architect, Security Team, DevOps Team
- **Approval**: Pending

---

**END OF DOCUMENT**
