# Hub-and-Spoke WireGuard VPN - Documentation

Welcome to the comprehensive documentation for the Hub-and-Spoke WireGuard VPN management system.

## Quick Links

### For Chief Architect Review

📄 **[Architecture Guide (Markdown)](ARCHITECTURE_GUIDE_PRESENTATION.md)** - Complete 76-page technical specification

📊 **[All Diagrams](diagrams/)** - 6 Mermaid diagrams covering system architecture, security, deployment, etc.

🎯 **[Generate PDF](PDF_GENERATION_SUMMARY.md)** - Instructions to create presentation-ready PDF

### For Developers

📋 **[Implementation Status](../IMPLEMENTATION_STATUS.md)** - Current progress tracker

🔧 **[Implementation Plan](../docs/diagrams/)** - Step-by-step implementation guide (see plan mode file)

⚙️ **[Backend Services](ARCHITECTURE_GUIDE_PRESENTATION.md#10-backend-services)** - Service layer documentation

🌐 **[API Specification](ARCHITECTURE_GUIDE_PRESENTATION.md#7-api-specification)** - Complete REST API documentation

### For Operations

🚀 **[Deployment Guide](ARCHITECTURE_GUIDE_PRESENTATION.md#11-deployment-guide)** - Production deployment instructions

📊 **[Monitoring & Operations](ARCHITECTURE_GUIDE_PRESENTATION.md#13-operations-and-monitoring)** - Prometheus, Grafana, alerting

🔒 **[Security Model](ARCHITECTURE_GUIDE_PRESENTATION.md#5-security-model)** - Threat model and mitigations

## Documentation Structure

```
docs/
├── README.md (this file)
│
├── ARCHITECTURE_GUIDE_PRESENTATION.md
│   └── Complete technical specification (76 pages)
│       ├── System Architecture
│       ├── Database Design
│       ├── Security Model
│       ├── Proxmox Integration
│       ├── API Specification
│       ├── Deployment Guide
│       └── Implementation Roadmap
│
├── diagrams/
│   ├── system-architecture.mmd
│   ├── deployment-architecture.mmd
│   ├── spoke-provisioning-sequence.mmd
│   ├── database-erd.mmd
│   ├── security-model.mmd
│   └── proxmox-cluster-architecture.mmd
│
├── PDF_GENERATION_SUMMARY.md
│   └── Summary of PDF generation completion
│
└── README_PDF_GENERATION.md
    └── Detailed PDF generation instructions (5 methods)
```

## Key Features Documented

### 1. Hub-and-Spoke VPN Architecture
- Centralized hub server (10.0.1.1)
- Multiple spoke clients (10.0.1.2 - 10.0.1.254)
- WireGuard kernel-level VPN
- Web-based management dashboard

### 2. One-Time-Use Installation Tokens
- 256-bit cryptographically secure tokens
- 24-hour expiration
- Atomic validation (prevents race conditions)
- HTTPS-only distribution

### 3. Multi-Platform Support
- **Linux**: Ubuntu, Debian, CentOS, Fedora (automated installation)
- **macOS**: Homebrew-based installation
- **Windows**: PowerShell with Chocolatey
- **Proxmox VE**: Auto-cluster detection, multi-datacenter support

### 4. Proxmox Multi-Cluster Integration
- Auto-detect cluster membership via `pvecm status`
- Individual spoke per Proxmox node
- Hierarchical dashboard visualization
- Multi-datacenter support

### 5. Security Features
- Zero-trust key generation (private keys never transmitted)
- TLS 1.3 transport encryption
- Rate limiting (10 tokens/hour/IP)
- Public key uniqueness enforcement
- Encrypted backups

## Diagrams Overview

### 1. System Architecture
Shows the complete component stack:
- React Dashboard (Presentation Layer)
- Express API (Application Layer)
- Service Layer (TokenService, WireGuardService, etc.)
- SQLite Database (Data Layer)
- WireGuard Interface (System Layer)

**View**: [diagrams/system-architecture.mmd](diagrams/system-architecture.mmd)

### 2. Deployment Architecture
Production deployment with:
- DMZ/Firewall configuration
- Nginx reverse proxy with TLS
- Hub server components
- Monitoring stack (Prometheus, Grafana)
- Backup systems

**View**: [diagrams/deployment-architecture.mmd](diagrams/deployment-architecture.mmd)

### 3. Spoke Provisioning Sequence
28-step sequence diagram showing:
1. Token generation in dashboard
2. Script download and execution on spoke
3. Local key generation
4. Spoke registration with hub
5. WireGuard configuration
6. VPN tunnel establishment

**View**: [diagrams/spoke-provisioning-sequence.mmd](diagrams/spoke-provisioning-sequence.mmd)

### 4. Database ERD
Entity relationship diagram with:
- `hub_config` (singleton)
- `installation_tokens` (one-time-use)
- `spoke_registrations` (active spokes)
- `proxmox_clusters` (Proxmox grouping)

**View**: [diagrams/database-erd.mmd](diagrams/database-erd.mmd)

### 5. Security Model
Threat model diagram showing:
- Threat actors (external, insider, MITM)
- Attack vectors (token theft, brute force, replay, etc.)
- Security controls (HTTPS, token expiration, atomic validation, etc.)
- Protected assets (hub key, tokens, spoke keys, topology)

**View**: [diagrams/security-model.mmd](diagrams/security-model.mmd)

### 6. Proxmox Cluster Architecture
Multi-datacenter Proxmox topology:
- Datacenter 1: 3-node production cluster
- Datacenter 2: 2-node backup cluster
- Edge site: 2-node cluster
- Standalone nodes
- All nodes connect to hub individually

**View**: [diagrams/proxmox-cluster-architecture.mmd](diagrams/proxmox-cluster-architecture.mmd)

## Generate PDF for Review

### Quick Start

```bash
# Install dependencies
npm install

# Generate PDF
npm run generate:pdf

# Output: docs/ARCHITECTURE_GUIDE.pdf
```

### Alternative Methods

See [README_PDF_GENERATION.md](README_PDF_GENERATION.md) for:
- Typora (GUI-based, recommended)
- Pandoc (command-line, professional LaTeX)
- VSCode extension
- Online tools
- Custom Node.js script

## API Endpoints Reference

### Hub Management
- `POST /api/hub/initialize` - First-run setup
- `GET /api/hub/config` - Get configuration
- `PUT /api/hub/config` - Update settings
- `GET /api/hub/status` - WireGuard status

### Installation Tokens
- `POST /api/installation/token` - Generate token
- `GET /api/installation/tokens` - List all tokens
- `DELETE /api/installation/token/:id` - Revoke token

### Script Serving
- `GET /api/installation/script/:token?platform=linux|macos|windows|proxmox`

### Spoke Management
- `POST /api/spoke/register` - Spoke registration
- `GET /api/spoke/list` - List all spokes
- `GET /api/spoke/:id/status` - Spoke details
- `DELETE /api/spoke/:id` - Remove spoke

### Proxmox Clusters
- `GET /api/proxmox/clusters` - List clusters
- `GET /api/proxmox/clusters/:id` - Cluster details
- `PUT /api/proxmox/clusters/:id` - Update cluster
- `DELETE /api/proxmox/clusters/:id` - Delete cluster

Full specification: [ARCHITECTURE_GUIDE_PRESENTATION.md#7-api-specification](ARCHITECTURE_GUIDE_PRESENTATION.md#7-api-specification)

## Database Schema Reference

### Tables

**hub_config** (Singleton)
- Stores hub WireGuard configuration
- Private key encrypted at rest
- Network CIDR, endpoint, DNS settings

**installation_tokens**
- One-time-use tokens with 24h expiration
- Pre-allocated IP addresses
- Token, spoke_id, hub config embedded

**spoke_registrations**
- Active spoke records
- Public keys (unique constraint)
- Status tracking (pending/active/inactive)
- Proxmox metadata (cluster_id, node_name, etc.)

**proxmox_clusters**
- Proxmox cluster grouping
- Datacenter metadata
- Links to spoke_registrations

Full ERD: [diagrams/database-erd.mmd](diagrams/database-erd.mmd)

## Implementation Roadmap

### Week 1: Backend Core
- ✅ Database schema
- ✅ TokenService
- ✅ IPAddressPool
- ⏳ WireGuardService
- ⏳ ScriptGenerator

### Week 2: Installation Scripts
- ⏳ Linux script
- ⏳ Proxmox script (with cluster detection)
- ⏳ macOS script
- ⏳ Windows PowerShell script

### Week 3: Frontend Components
- ⏳ HubContext (state management)
- ⏳ HubInitializer
- ⏳ SpokeManager
- ⏳ ProxmoxClusterView

### Week 4: Integration & Testing
- ⏳ End-to-end testing
- ⏳ Security testing
- ⏳ Performance testing

### Week 5: Deployment
- ⏳ Production deployment
- ⏳ Monitoring setup
- ⏳ Documentation finalization

Full roadmap: [ARCHITECTURE_GUIDE_PRESENTATION.md#15-implementation-roadmap](ARCHITECTURE_GUIDE_PRESENTATION.md#15-implementation-roadmap)

## Technology Stack

**Frontend**
- React 18 + TypeScript
- Vite (build tool)
- TailwindCSS (styling)

**Backend**
- Node.js + Express
- TypeScript
- better-sqlite3 (database)

**VPN**
- WireGuard (kernel module)
- wg-quick (configuration)

**Deployment**
- Ubuntu 22.04 LTS
- Nginx (reverse proxy)
- Let's Encrypt (TLS)
- systemd (service management)

**Monitoring**
- Prometheus (metrics)
- Grafana (dashboards)
- winston (logging)

## Security Highlights

### Token Security
- **Entropy**: 256-bit (2^256 combinations)
- **Expiration**: 24 hours
- **Usage**: One-time-use only (atomic validation)
- **Transport**: HTTPS required

### Key Management
- **Hub Private Key**: AES-256 encrypted at rest, GPG backups
- **Spoke Private Keys**: Generated locally, NEVER transmitted
- **Public Keys**: Uniqueness enforced by database constraint

### Attack Mitigations
- **Token Theft**: HTTPS, 24h expiration
- **Brute Force**: 256-bit entropy, rate limiting (10/hour/IP)
- **Token Replay**: Atomic mark-as-used
- **Hub Key Compromise**: Encrypted storage, restricted permissions
- **Spoke Impersonation**: Public key uniqueness check

Full security model: [diagrams/security-model.mmd](diagrams/security-model.mmd)

## Proxmox Integration

### Key Features
- **Auto-Detection**: `pvecm status` parses cluster membership
- **Individual Spokes**: Each node = unique IP + keys
- **Cluster Grouping**: Dashboard groups nodes by cluster name
- **Multi-Datacenter**: Support multiple clusters across locations

### Use Cases
- Centralized management over VPN
- VM migration between nodes
- Cluster communication (optional)
- Storage access (Ceph/NFS)

Full architecture: [diagrams/proxmox-cluster-architecture.mmd](diagrams/proxmox-cluster-architecture.mmd)

## Next Steps

1. **Review Architecture**: Read [ARCHITECTURE_GUIDE_PRESENTATION.md](ARCHITECTURE_GUIDE_PRESENTATION.md)
2. **Generate PDF**: Run `npm run generate:pdf`
3. **Chief Architect Review**: Share PDF for approval
4. **Begin Implementation**: Follow roadmap in architecture guide
5. **Testing**: Execute test plan for all platforms

## Support

- **Issues**: File at repository issue tracker
- **Questions**: Contact development team
- **Updates**: Check IMPLEMENTATION_STATUS.md for progress

---

**Documentation Version**: 1.0
**Last Updated**: December 22, 2025
**Status**: Complete - Ready for Chief Architect Review ✓
