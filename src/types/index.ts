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
  hubPublicEndpoint: string  // Public endpoint for external spokes
  hubPrivateEndpoint?: string  // Private endpoint for internal spokes (optional)
  hubPublicKey: string
  networkCIDR: string
  dns?: string[]
  persistentKeepalive: number
  usePrivateEndpoint?: boolean  // Flag to indicate which endpoint this token should use

  // Group token fields
  isGroupToken?: boolean
  groupName?: string
  maxRegistrations?: number | null
  registrationCount?: number
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
  os: 'linux' | 'macos' | 'windows' | 'proxmox'

  // Server identity fields (for group tokens)
  hostname?: string
  localIP?: string
  machineUUID?: string

  // Proxmox-specific fields
  isProxmox?: boolean
  proxmoxClusterId?: string
  proxmoxNodeName?: string
  proxmoxVersion?: string

  metadata?: {
    wireguardVersion?: string
    ipAddress?: string
    groupToken?: string  // Group name if registered via group token
    // Proxmox metadata
    proxmoxClusterName?: string
    proxmoxClusterNodes?: string
    isClustered?: boolean
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
  publicEndpoint: string  // Public IP/domain for external spokes
  privateEndpoint?: string  // Private IP for internal spokes (optional)
  createdAt: Date
  updatedAt: Date
}

/**
 * Hub initialization parameters
 */
export interface HubInitConfig {
  networkCIDR: string
  listenPort: number
  publicEndpoint: string  // Public IP/domain for external spokes
  privateEndpoint?: string  // Private IP for internal spokes (optional)
  dns?: string[]
}

/**
 * Proxmox cluster grouping
 */
export interface ProxmoxCluster {
  id: string
  clusterName: string
  datacenter?: string
  description?: string
  nodes: SpokeRegistration[]
  createdAt: Date
  updatedAt: Date
}
