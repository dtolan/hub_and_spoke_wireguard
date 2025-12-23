import { db } from '../config/database'
import { randomBytes } from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import type { InstallationToken, HubConfig } from '../../types'
import { IPAddressPool } from './IPAddressPool'

const TOKEN_EXPIRATION_HOURS = parseInt(process.env.TOKEN_EXPIRATION_HOURS || '24', 10)

export class TokenService {
  /**
   * Generate a new installation token
   */
  static generateToken(params: {
    spokeName: string
    hubConfig: HubConfig
    customIP?: string
  }): InstallationToken {
    const { spokeName, hubConfig, customIP } = params

    // Generate cryptographically secure token
    const token = randomBytes(32).toString('base64url')
    const spokeId = uuidv4()

    // Get all existing IPs
    const existingTokens = db
      .prepare('SELECT allowed_ips FROM installation_tokens')
      .all() as Array<{ allowed_ips: string }>
    const existingSpokes = db
      .prepare('SELECT allowed_ips FROM spoke_registrations')
      .all() as Array<{ allowed_ips: string }>

    const usedIPs = IPAddressPool.extractAllowedIPs([
      ...existingTokens.map((t) => ({ allowedIPs: t.allowed_ips })),
      ...existingSpokes.map((s) => ({ allowedIPs: s.allowed_ips })),
      { allowedIPs: [hubConfig.interfaceAddress] }, // Reserve hub IP
    ])

    // Allocate IP
    let allocatedIP: string
    if (customIP) {
      if (!IPAddressPool.isIPInNetwork(customIP, hubConfig.networkCIDR)) {
        throw new Error(`Custom IP ${customIP} is not in network ${hubConfig.networkCIDR}`)
      }
      if (usedIPs.some((ip) => ip.split('/')[0] === customIP.split('/')[0])) {
        throw new Error(`IP ${customIP} is already in use`)
      }
      allocatedIP = customIP.includes('/') ? customIP : `${customIP}/${hubConfig.networkCIDR.split('/')[1]}`
    } else {
      allocatedIP = IPAddressPool.getNextAvailableIP(hubConfig.networkCIDR, usedIPs)
    }

    // Create expiration date
    const createdAt = new Date()
    const expiresAt = new Date(createdAt.getTime() + TOKEN_EXPIRATION_HOURS * 60 * 60 * 1000)

    const tokenRecord: InstallationToken = {
      id: uuidv4(),
      token,
      spokeId,
      spokeName,
      allowedIPs: [allocatedIP],
      createdAt,
      expiresAt,
      used: false,
      hubEndpoint: hubConfig.endpoint,
      hubPublicKey: hubConfig.publicKey,
      networkCIDR: hubConfig.networkCIDR,
      dns: hubConfig.dns,
      persistentKeepalive: 25,
    }

    // Store in database
    const stmt = db.prepare(`
      INSERT INTO installation_tokens (
        id, token, spoke_id, spoke_name, allowed_ips,
        created_at, expires_at, used, hub_endpoint,
        hub_public_key, network_cidr, dns, persistent_keepalive
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      tokenRecord.id,
      tokenRecord.token,
      tokenRecord.spokeId,
      tokenRecord.spokeName,
      JSON.stringify(tokenRecord.allowedIPs),
      tokenRecord.createdAt.toISOString(),
      tokenRecord.expiresAt.toISOString(),
      tokenRecord.used ? 1 : 0,
      tokenRecord.hubEndpoint,
      tokenRecord.hubPublicKey,
      tokenRecord.networkCIDR,
      tokenRecord.dns ? JSON.stringify(tokenRecord.dns) : null,
      tokenRecord.persistentKeepalive
    )

    return tokenRecord
  }

  /**
   * Validate token without marking as used
   */
  static validateToken(token: string): InstallationToken {
    const stmt = db.prepare(`
      SELECT * FROM installation_tokens WHERE token = ?
    `)
    const row = stmt.get(token) as any

    if (!row) {
      throw new Error('TOKEN_NOT_FOUND')
    }

    const tokenData = this.rowToToken(row)

    if (tokenData.used) {
      throw new Error('TOKEN_ALREADY_USED')
    }

    if (new Date(tokenData.expiresAt) < new Date()) {
      throw new Error('TOKEN_EXPIRED')
    }

    return tokenData
  }

  /**
   * Validate token and mark as used (atomic operation)
   */
  static validateAndMarkUsed(token: string): InstallationToken {
    const stmt = db.prepare(`
      SELECT * FROM installation_tokens WHERE token = ?
    `)
    const row = stmt.get(token) as any

    if (!row) {
      throw new Error('TOKEN_NOT_FOUND')
    }

    const tokenData = this.rowToToken(row)

    if (tokenData.used) {
      throw new Error('TOKEN_ALREADY_USED')
    }

    if (new Date(tokenData.expiresAt) < new Date()) {
      throw new Error('TOKEN_EXPIRED')
    }

    // Mark as used (atomic)
    const updateStmt = db.prepare(`
      UPDATE installation_tokens
      SET used = 1, used_at = ?
      WHERE token = ? AND used = 0
    `)

    const result = updateStmt.run(new Date().toISOString(), token)

    if (result.changes === 0) {
      // Race condition: someone else used it
      throw new Error('TOKEN_ALREADY_USED')
    }

    tokenData.used = true
    tokenData.usedAt = new Date()

    return tokenData
  }

  /**
   * Get token by ID
   */
  static getTokenById(id: string): InstallationToken | null {
    const stmt = db.prepare('SELECT * FROM installation_tokens WHERE id = ?')
    const row = stmt.get(id) as any
    return row ? this.rowToToken(row) : null
  }

  /**
   * Get all tokens
   */
  static getAllTokens(): InstallationToken[] {
    const stmt = db.prepare('SELECT * FROM installation_tokens ORDER BY created_at DESC')
    const rows = stmt.all() as any[]
    return rows.map(this.rowToToken)
  }

  /**
   * Revoke an unused token
   */
  static revokeToken(id: string): boolean {
    const stmt = db.prepare('DELETE FROM installation_tokens WHERE id = ? AND used = 0')
    const result = stmt.run(id)
    return result.changes > 0
  }

  /**
   * Clean up expired tokens
   */
  static cleanupExpired(): number {
    const stmt = db.prepare('DELETE FROM installation_tokens WHERE expires_at < ? AND used = 0')
    const result = stmt.run(new Date().toISOString())
    return result.changes
  }

  /**
   * Convert database row to InstallationToken
   */
  private static rowToToken(row: any): InstallationToken {
    return {
      id: row.id,
      token: row.token,
      spokeId: row.spoke_id,
      spokeName: row.spoke_name,
      allowedIPs: JSON.parse(row.allowed_ips),
      createdAt: new Date(row.created_at),
      expiresAt: new Date(row.expires_at),
      used: Boolean(row.used),
      usedAt: row.used_at ? new Date(row.used_at) : undefined,
      hubEndpoint: row.hub_endpoint,
      hubPublicKey: row.hub_public_key,
      networkCIDR: row.network_cidr,
      dns: row.dns ? JSON.parse(row.dns) : undefined,
      persistentKeepalive: row.persistent_keepalive,
    }
  }
}
