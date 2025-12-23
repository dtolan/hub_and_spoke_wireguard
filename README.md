# Hub-and-Spoke WireGuard VPN Management System

A comprehensive web-based management system for deploying and managing WireGuard VPN in a hub-and-spoke topology with automated spoke provisioning.

## ⭐ Features

### Core Capabilities

- **Automated Hub Initialization**: Web-based wizard for first-time setup
- **One-Time Installation Tokens**: 256-bit secure tokens with 24-hour expiration
- **Multi-Platform Support**: Linux, macOS, Windows, and Proxmox VE
- **Zero-Touch Spoke Configuration**: Automated installation scripts
- **Real-Time Monitoring**: Live connection status and handshake tracking
- **Proxmox Cluster Integration**: Automatic cluster detection and hierarchical grouping

### Security

- 🔒 **Zero-Trust Key Generation**: Private keys generated locally, never transmitted
- 🔐 **TLS Transport Encryption**: HTTPS-only in production
- ⚡ **Atomic Token Validation**: Prevents race conditions
- 🛡️ **Rate Limiting**: Protects against brute force attacks (10 tokens/hour)
- 🔑 **Public Key Uniqueness**: Prevents spoke impersonation

### Platform-Specific Features

#### Linux
- Auto-detection: Ubuntu, Debian, CentOS, RHEL, Fedora, Arch, OpenSUSE
- Automatic package manager selection
- systemd service configuration

#### macOS
- Homebrew integration
- launchd service configuration

#### Windows
- PowerShell-based installation
- Chocolatey package management
- WireGuard service integration

#### Proxmox VE
- Automatic cluster detection via `pvecm status`
- Individual spoke per node
- Multi-datacenter support
- Hierarchical dashboard visualization

---

## 🚀 Quick Start

### Prerequisites

- Ubuntu 22.04 LTS (hub server)
- Node.js 18+
- WireGuard kernel module
- Public IP address or domain name

### Installation

```bash
# Clone repository
git clone https://github.com/dtolan/hub_and_spoke_wireguard.git
cd hub_and_spoke_wireguard

# Install dependencies
npm install

# Build frontend and backend
npm run build
npm run build:backend

# Initialize database
npm run db:migrate

# Start backend server
npm run dev:backend
```

### First-Time Setup

1. **Access Dashboard**: `http://your-server-ip:3000`
2. **Initialize Hub**: Complete the initialization wizard
3. **Generate Token**: Create an installation token
4. **Install Spoke**: Run the command on your spoke device

---

## 📚 Documentation

- **[Deployment Guide](DEPLOYMENT.md)** - Complete Ubuntu installation guide
- **[Architecture Guide](docs/ARCHITECTURE_GUIDE_PRESENTATION.md)** - 76-page technical specification
- **[Executive Summary](docs/EXECUTIVE_SUMMARY.md)** - Business overview
- **[Diagrams](docs/diagrams/)** - System architecture diagrams

---

## 🛠️ Development

### Prerequisites

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev
```

### Available Scripts

- `npm run dev` - Start Vite dev server for local development
- `npm run build` - Build the standalone application
- `npm run build:lib` - Build as a library for npm distribution
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## Library Usage

This package can be consumed as an npm dependency:

```bash
npm install @dtolan/hub-and-spoke-wireguard
```

### Import Components

```typescript
import { Dashboard } from '@dtolan/hub-and-spoke-wireguard'
import '@dtolan/hub-and-spoke-wireguard/style.css'

function App() {
  return <Dashboard />
}
```

### Import Types and Utils

```typescript
import {
  type WireGuardPeer,
  type HubSpokeConfig,
  generateHubConfig,
  generateSpokeConfig,
} from '@dtolan/hub-and-spoke-wireguard'
```

## Project Structure

```
src/
├── components/     # React components
│   └── Dashboard.tsx
├── hooks/          # Custom React hooks
├── types/          # TypeScript type definitions
│   └── index.ts
├── utils/          # Utility functions
│   ├── configGenerator.ts
│   └── keyManagement.ts
├── index.ts        # Library entry point
├── main.tsx        # Dev app entry point
└── style.css       # Component styles
```

## Integration Notes

This project is designed as a **proof-of-concept** that can be:

1. **Developed standalone**: Full dev environment with hot reload
2. **Consumed as npm package**: Import into parent projects
3. **Refactored/merged**: Codebase designed for easy integration into main project

When integrating into a parent project, you can:
- Install as dependency: `npm install @dtolan/hub-and-spoke-wireguard`
- Or copy source files directly from `src/` for custom refactoring

## License

ISC
