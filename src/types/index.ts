/**
 * WireGuard peer configuration
 */
export interface WireGuardPeer {
  id: string
  name: string
  publicKey: string
  privateKey?: string
  allowedIPs: string[]
  endpoint?: string
  persistentKeepalive?: number
  presharedKey?: string
  isHub?: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * WireGuard interface configuration
 */
export interface WireGuardInterface {
  address: string
  listenPort: number
  privateKey: string
  publicKey: string
  dns?: string[]
  mtu?: number
}

/**
 * Hub-and-spoke network topology configuration
 */
export interface HubSpokeConfig {
  hub: WireGuardPeer & {
    interface: WireGuardInterface
  }
  spokes: WireGuardPeer[]
  networkCIDR: string
}

/**
 * Connection status for monitoring
 */
export interface ConnectionStatus {
  peerId: string
  connected: boolean
  lastHandshake?: Date
  bytesReceived: number
  bytesSent: number
  latency?: number
}

/**
 * Key pair for WireGuard
 */
export interface KeyPair {
  publicKey: string
  privateKey: string
}

/**
 * Installation token for one-time spoke provisioning
 */
export interface InstallationToken {
  id: string
  token: string
  spokeId: string
  spokeName: string
  allowedIPs: string[]
  createdAt: Date
  expiresAt: Date
  used: boolean
  usedAt?: Date
  hubEndpoint: string
  hubPublicKey: string
  networkCIDR: string
  dns?: string[]
  persistentKeepalive: number
}

/**
 * Spoke registration after installation
 */
export interface SpokeRegistration {
  id: string
  tokenId: string
  name: string
  publicKey: string
  allowedIPs: string[]
  registeredAt: Date
  lastHandshake?: Date
  status: 'pending' | 'active' | 'inactive'
  os: 'linux' | 'macos' | 'windows'
  metadata?: {
    wireguardVersion?: string
    ipAddress?: string
  }
}

/**
 * Hub configuration
 */
export interface HubConfig {
  id: number
  interfaceAddress: string
  listenPort: number
  privateKey: string
  publicKey: string
  networkCIDR: string
  dns?: string[]
  endpoint: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Hub initialization parameters
 */
export interface HubInitConfig {
  networkCIDR: string
  listenPort: number
  endpoint: string
  dns?: string[]
}
