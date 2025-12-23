import type { HubSpokeConfig } from '../types'

/**
 * Generate WireGuard configuration file content for the hub
 */
export function generateHubConfig(config: HubSpokeConfig): string {
  const { hub, spokes } = config

  let configContent = `[Interface]
Address = ${hub.interface.address}
ListenPort = ${hub.interface.listenPort}
PrivateKey = ${hub.interface.privateKey}
`

  if (hub.interface.mtu) {
    configContent += `MTU = ${hub.interface.mtu}\n`
  }

  if (hub.interface.dns && hub.interface.dns.length > 0) {
    configContent += `DNS = ${hub.interface.dns.join(', ')}\n`
  }

  // Add each spoke as a peer
  spokes.forEach((spoke) => {
    configContent += `
[Peer]
# ${spoke.name}
PublicKey = ${spoke.publicKey}
AllowedIPs = ${spoke.allowedIPs.join(', ')}
`
    if (spoke.presharedKey) {
      configContent += `PresharedKey = ${spoke.presharedKey}\n`
    }
  })

  return configContent
}

/**
 * Generate WireGuard configuration file content for a spoke
 */
export function generateSpokeConfig(
  config: HubSpokeConfig,
  spokeId: string
): string {
  const spoke = config.spokes.find((s) => s.id === spokeId)
  if (!spoke) {
    throw new Error(`Spoke with ID ${spokeId} not found`)
  }

  if (!spoke.privateKey) {
    throw new Error(`Spoke ${spoke.name} does not have a private key`)
  }

  let configContent = `[Interface]
Address = ${spoke.allowedIPs[0]}
PrivateKey = ${spoke.privateKey}
`

  if (config.hub.interface.dns && config.hub.interface.dns.length > 0) {
    configContent += `DNS = ${config.hub.interface.dns.join(', ')}\n`
  }

  configContent += `
[Peer]
# Hub: ${config.hub.name}
PublicKey = ${config.hub.publicKey}
Endpoint = ${config.hub.endpoint || 'SET_HUB_ENDPOINT'}
AllowedIPs = ${config.networkCIDR}
`

  if (spoke.presharedKey) {
    configContent += `PresharedKey = ${spoke.presharedKey}\n`
  }

  if (spoke.persistentKeepalive) {
    configContent += `PersistentKeepalive = ${spoke.persistentKeepalive}\n`
  }

  return configContent
}

/**
 * Generate configuration for all peers in the topology
 */
export function generateAllConfigs(config: HubSpokeConfig): {
  hub: string
  spokes: Record<string, string>
} {
  const hubConfig = generateHubConfig(config)
  const spokeConfigs: Record<string, string> = {}

  config.spokes.forEach((spoke) => {
    spokeConfigs[spoke.id] = generateSpokeConfig(config, spoke.id)
  })

  return {
    hub: hubConfig,
    spokes: spokeConfigs,
  }
}
