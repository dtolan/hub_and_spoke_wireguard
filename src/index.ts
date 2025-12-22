/**
 * Hub and Spoke WireGuard Management Library
 *
 * Main entry point for the library exports
 */

// Components
export { default as Dashboard } from './components/Dashboard'

// Types
export type {
  WireGuardPeer,
  WireGuardInterface,
  HubSpokeConfig,
  ConnectionStatus,
  KeyPair,
} from './types'

// Utilities
export * from './utils'
