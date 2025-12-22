# WireGuard Hub-and-Spoke Dashboard

React/TypeScript dashboard for managing WireGuard hub-and-spoke VPN configurations.

## Features

- **Config Generation**: Generate WireGuard configurations for hub and spoke peers
- **Peer Management**: Add, edit, and remove spoke peers
- **Status Monitoring**: View connection status and metrics
- **Key Management**: Generate and manage WireGuard keypairs

## Development

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- React 18+

### Setup

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
