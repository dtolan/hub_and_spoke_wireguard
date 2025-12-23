import { spawn } from 'child_process'
import fs from 'fs'
import type { HubConfig, HubInitConfig, SpokeRegistration } from '../../types/index.js'

/**
 * WireGuard peer information from `wg show` output
 */
export interface WireGuardPeer {
  publicKey: string
  endpoint?: string
  allowedIPs: string[]
  lastHandshake?: Date
  transferRx: number // bytes received
  transferTx: number // bytes transmitted
}

/**
 * WireGuard interface status
 */
export interface WireGuardStatus {
  interfaceName: string
  publicKey: string
  listenPort: number
  peers: WireGuardPeer[]
}

/**
 * Service for managing WireGuard hub configuration
 *
 * IMPORTANT: This service executes system commands (wg, wg-quick).
 * The backend must run on the hub server OR have SSH access to it.
 */
export class WireGuardService {
  private static readonly INTERFACE_NAME = 'wg0'
  private static readonly CONFIG_PATH = '/etc/wireguard/wg0.conf'

  /**
   * Execute a command and return its output
   */
  private static async executeCommand(
    command: string,
    args: string[]
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args)
      let stdout = ''
      let stderr = ''

      process.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      process.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      process.on('close', (code) => {
        if (code !== 0) {
          reject(
            new Error(
              `Command "${command} ${args.join(' ')}" failed with code ${code}:\n${stderr}`
            )
          )
        } else {
          resolve(stdout)
        }
      })

      process.on('error', (err) => {
        reject(new Error(`Failed to execute command "${command}": ${err.message}`))
      })
    })
  }

  /**
   * Generate WireGuard key pair
   * @returns {privateKey, publicKey}
   */
  static async generateKeyPair(): Promise<{
    privateKey: string
    publicKey: string
  }> {
    // Generate private key
    const privateKey = (await this.executeCommand('wg', ['genkey'])).trim()

    // Generate public key from private key
    const publicKeyProcess = spawn('wg', ['pubkey'])
    publicKeyProcess.stdin.write(privateKey)
    publicKeyProcess.stdin.end()

    let publicKey = ''
    for await (const chunk of publicKeyProcess.stdout) {
      publicKey += chunk
    }

    return {
      privateKey,
      publicKey: publicKey.trim(),
    }
  }

  /**
   * Initialize the hub WireGuard interface
   *
   * This creates the wg0 interface, generates keys, and starts the service.
   *
   * @param config Hub initialization configuration
   * @returns Hub configuration with generated keys
   */
  static async initializeHub(config: HubInitConfig): Promise<HubConfig> {
    // Generate keys
    const { privateKey, publicKey } = await this.generateKeyPair()

    // Extract interface address from CIDR (hub is always .1)
    const interfaceAddress = config.networkCIDR.replace(/\.0\//, '.1/')

    // Create WireGuard configuration file
    const configContent = `[Interface]
Address = ${interfaceAddress}
ListenPort = ${config.listenPort}
PrivateKey = ${privateKey}
`

    // Write configuration (with secure permissions)
    fs.writeFileSync(this.CONFIG_PATH, configContent, { mode: 0o600 })

    // Enable and start WireGuard service
    await this.executeCommand('systemctl', ['enable', `wg-quick@${this.INTERFACE_NAME}`])
    await this.executeCommand('systemctl', ['start', `wg-quick@${this.INTERFACE_NAME}`])

    // Return hub configuration
    return {
      id: 1,
      interfaceAddress,
      listenPort: config.listenPort,
      privateKey,
      publicKey,
      networkCIDR: config.networkCIDR,
      dns: config.dns,
      endpoint: config.endpoint,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }

  /**
   * Add a spoke peer to the hub configuration
   *
   * This adds a [Peer] section to the WireGuard config and reloads the interface.
   *
   * @param spoke Spoke registration data
   */
  static async addSpokePeer(spoke: SpokeRegistration): Promise<void> {
    // Read current config
    const currentConfig = fs.readFileSync(this.CONFIG_PATH, 'utf-8')

    // Check if peer already exists
    if (currentConfig.includes(spoke.publicKey)) {
      console.warn(
        `Peer with public key ${spoke.publicKey} already exists in config. Skipping add.`
      )
      return
    }

    // Append peer section
    const peerSection = `
# Spoke: ${spoke.name} (${spoke.id})
[Peer]
PublicKey = ${spoke.publicKey}
AllowedIPs = ${spoke.allowedIPs.join(', ')}
`

    fs.appendFileSync(this.CONFIG_PATH, peerSection)

    // Reload WireGuard configuration (without restarting interface)
    await this.reloadConfig()
  }

  /**
   * Remove a spoke peer from the hub configuration
   *
   * @param spoke Spoke registration data
   */
  static async removeSpokePeer(spoke: SpokeRegistration): Promise<void> {
    // Read current config
    let config = fs.readFileSync(this.CONFIG_PATH, 'utf-8')

    // Find and remove the peer section
    // Pattern: # Spoke: ... [Peer] PublicKey = ... AllowedIPs = ...
    const peerPattern = new RegExp(
      `# Spoke: ${spoke.name}.*?\\[Peer\\][\\s\\S]*?PublicKey = ${spoke.publicKey}[\\s\\S]*?AllowedIPs = [^\\n]+\\n`,
      'g'
    )

    const newConfig = config.replace(peerPattern, '')

    if (newConfig === config) {
      console.warn(`Peer ${spoke.publicKey} not found in config. Nothing to remove.`)
      return
    }

    // Write updated config
    fs.writeFileSync(this.CONFIG_PATH, newConfig, { mode: 0o600 })

    // Reload configuration
    await this.reloadConfig()
  }

  /**
   * Reload WireGuard configuration without restarting the interface
   *
   * Uses `wg syncconf` to apply changes without dropping connections.
   */
  static async reloadConfig(): Promise<void> {
    try {
      // Use wg-quick strip to generate runtime config, then syncconf to apply
      const strippedConfig = await this.executeCommand('wg-quick', [
        'strip',
        this.INTERFACE_NAME,
      ])

      // Write stripped config to temporary file
      const tempConfigPath = '/tmp/wg0-sync.conf'
      fs.writeFileSync(tempConfigPath, strippedConfig)

      // Apply config with syncconf
      await this.executeCommand('wg', [
        'syncconf',
        this.INTERFACE_NAME,
        tempConfigPath,
      ])

      // Clean up temp file
      fs.unlinkSync(tempConfigPath)
    } catch (error) {
      console.error('Failed to reload WireGuard config:', error)
      throw new Error(`Config reload failed: ${error}`)
    }
  }

  /**
   * Get WireGuard interface status
   *
   * Parses `wg show wg0` output to extract peer information.
   *
   * @returns Current interface status with peer details
   */
  static async getStatus(): Promise<WireGuardStatus> {
    const output = await this.executeCommand('wg', ['show', this.INTERFACE_NAME])

    // Parse output
    const lines = output.split('\n')
    const peers: WireGuardPeer[] = []

    let currentPeer: Partial<WireGuardPeer> | null = null
    let publicKey = ''
    let listenPort = 0

    for (const line of lines) {
      const trimmed = line.trim()

      // Interface public key
      if (trimmed.startsWith('public key:')) {
        publicKey = trimmed.split(':')[1].trim()
      }

      // Listen port
      if (trimmed.startsWith('listening port:')) {
        listenPort = parseInt(trimmed.split(':')[1].trim(), 10)
      }

      // Peer start
      if (trimmed.startsWith('peer:')) {
        // Save previous peer if exists
        if (currentPeer && currentPeer.publicKey) {
          peers.push(currentPeer as WireGuardPeer)
        }

        // Start new peer
        currentPeer = {
          publicKey: trimmed.split(':')[1].trim(),
          allowedIPs: [],
          transferRx: 0,
          transferTx: 0,
        }
      }

      // Peer properties
      if (currentPeer) {
        if (trimmed.startsWith('endpoint:')) {
          currentPeer.endpoint = trimmed.split(':').slice(1).join(':').trim()
        }

        if (trimmed.startsWith('allowed ips:')) {
          const ips = trimmed
            .split(':')[1]
            .split(',')
            .map((ip) => ip.trim())
          currentPeer.allowedIPs = ips
        }

        if (trimmed.startsWith('latest handshake:')) {
          // Parse relative time (e.g., "1 minute, 30 seconds ago")
          // For now, just store current time minus a rough estimate
          // TODO: Implement proper relative time parsing
          currentPeer.lastHandshake = new Date()
        }

        if (trimmed.startsWith('transfer:')) {
          // Format: "transfer: 1.23 MiB received, 456.78 KiB sent"
          const parts = trimmed.split(':')[1].split(',')
          const received = parts[0].trim()
          const sent = parts[1].trim()

          // Parse sizes (simplified - just extract numbers for now)
          currentPeer.transferRx = parseFloat(received.split(' ')[0]) || 0
          currentPeer.transferTx = parseFloat(sent.split(' ')[0]) || 0
        }
      }
    }

    // Add last peer
    if (currentPeer && currentPeer.publicKey) {
      peers.push(currentPeer as WireGuardPeer)
    }

    return {
      interfaceName: this.INTERFACE_NAME,
      publicKey,
      listenPort,
      peers,
    }
  }

  /**
   * Check if WireGuard is installed and the interface exists
   */
  static async checkInstallation(): Promise<{
    installed: boolean
    interfaceExists: boolean
  }> {
    try {
      // Check if wg command exists
      await this.executeCommand('which', ['wg'])

      // Check if interface exists
      try {
        await this.executeCommand('wg', ['show', this.INTERFACE_NAME])
        return { installed: true, interfaceExists: true }
      } catch {
        return { installed: true, interfaceExists: false }
      }
    } catch {
      return { installed: false, interfaceExists: false }
    }
  }

  /**
   * Stop the WireGuard interface
   */
  static async stopInterface(): Promise<void> {
    await this.executeCommand('systemctl', ['stop', `wg-quick@${this.INTERFACE_NAME}`])
  }

  /**
   * Start the WireGuard interface
   */
  static async startInterface(): Promise<void> {
    await this.executeCommand('systemctl', ['start', `wg-quick@${this.INTERFACE_NAME}`])
  }

  /**
   * Restart the WireGuard interface
   */
  static async restartInterface(): Promise<void> {
    await this.executeCommand('systemctl', [
      'restart',
      `wg-quick@${this.INTERFACE_NAME}`,
    ])
  }
}
