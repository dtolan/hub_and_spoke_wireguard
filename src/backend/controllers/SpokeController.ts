import type { Request, Response } from 'express'
import { getDatabase } from '../config/database.js'
import { WireGuardService } from '../services/WireGuardService.js'
import { TokenService } from '../services/TokenService.js'
import type { SpokeRegistration } from '../../types/index.js'
import { v4 as uuidv4 } from 'uuid'

/**
 * Controller for spoke registration and management
 */
export class SpokeController {
  /**
   * POST /api/spoke/register
   *
   * Register a spoke with the hub (called by installation scripts)
   */
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const {
        token,
        publicKey,
        os,
        isProxmox,
        proxmoxNodeName,
        proxmoxClusterName,
        proxmoxVersion,
        metadata,
      } = req.body

      // Validate required fields
      if (!token || !publicKey || !os) {
        res.status(400).json({
          error: 'Missing required fields',
          required: ['token', 'publicKey', 'os'],
        })
        return
      }

      // Validate public key format (44 characters base64)
      if (!/^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=?$/.test(publicKey)) {
        res.status(400).json({
          error: 'Invalid public key format',
          code: 'INVALID_PUBLIC_KEY',
          hint: 'Public key must be 44-character base64 string',
        })
        return
      }

      const db = getDatabase()

      // Validate token (this also checks if already used)
      let tokenData
      try {
        tokenData = TokenService.validateToken(token)
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'TOKEN_NOT_FOUND') {
            res.status(404).json({
              error: 'Installation token not found',
              code: 'TOKEN_NOT_FOUND',
            })
            return
          }

          if (error.message === 'TOKEN_EXPIRED') {
            res.status(410).json({
              error: 'Installation token has expired',
              code: 'TOKEN_EXPIRED',
            })
            return
          }

          if (error.message === 'TOKEN_ALREADY_USED') {
            res.status(409).json({
              error: 'Installation token has already been used',
              code: 'TOKEN_ALREADY_USED',
            })
            return
          }
        }

        throw error
      }

      // Check for duplicate public key (prevent impersonation)
      const existingSpoke = db
        .prepare('SELECT * FROM spoke_registrations WHERE public_key = ?')
        .get(publicKey)

      if (existingSpoke) {
        res.status(409).json({
          error: 'Public key already registered',
          code: 'DUPLICATE_PUBLIC_KEY',
          hint: 'This public key is already in use by another spoke',
        })
        return
      }

      // Handle Proxmox-specific logic
      let proxmoxClusterId: string | null = null

      if (isProxmox && proxmoxClusterName) {
        // Check if cluster exists
        let cluster = db
          .prepare('SELECT * FROM proxmox_clusters WHERE cluster_name = ?')
          .get(proxmoxClusterName) as Record<string, unknown> | undefined

        if (!cluster) {
          // Create new cluster
          proxmoxClusterId = uuidv4()
          db.prepare(
            `
            INSERT INTO proxmox_clusters (id, cluster_name, created_at, updated_at)
            VALUES (?, ?, ?, ?)
          `
          ).run(
            proxmoxClusterId,
            proxmoxClusterName,
            new Date().toISOString(),
            new Date().toISOString()
          )
        } else {
          proxmoxClusterId = cluster.id as string
        }
      }

      // Create spoke registration
      const registrationId = uuidv4()
      const now = new Date().toISOString()

      db.prepare(
        `
        INSERT INTO spoke_registrations (
          id, token_id, name, public_key, allowed_ips, registered_at,
          status, os, is_proxmox, proxmox_cluster_id, proxmox_node_name,
          proxmox_version, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        registrationId,
        tokenData.id,
        tokenData.spokeName,
        publicKey,
        JSON.stringify(tokenData.allowedIPs),
        now,
        'active',
        os,
        isProxmox ? 1 : 0,
        proxmoxClusterId,
        proxmoxNodeName || null,
        proxmoxVersion || null,
        JSON.stringify(metadata || {})
      )

      // Mark token as used (atomic)
      db.prepare(
        `
        UPDATE installation_tokens
        SET used = 1, used_at = ?
        WHERE token = ? AND used = 0
      `
      ).run(now, token)

      // Add spoke peer to WireGuard hub
      const spokeRegistration: SpokeRegistration = {
        id: registrationId,
        tokenId: tokenData.id,
        name: tokenData.spokeName,
        publicKey,
        allowedIPs: tokenData.allowedIPs,
        registeredAt: new Date(now),
        status: 'active',
        os: os as 'linux' | 'macos' | 'windows' | 'proxmox',
        isProxmox: isProxmox || false,
        proxmoxClusterId: proxmoxClusterId || undefined,
        proxmoxNodeName: proxmoxNodeName || undefined,
        proxmoxVersion: proxmoxVersion || undefined,
        metadata: metadata || {},
      }

      await WireGuardService.addSpokePeer(spokeRegistration)

      res.status(201).json({
        message: 'Spoke registered successfully',
        spoke: {
          id: registrationId,
          name: tokenData.spokeName,
          allowedIPs: tokenData.allowedIPs,
          registeredAt: now,
          status: 'active',
        },
      })
    } catch (error) {
      console.error('Spoke registration error:', error)
      res.status(500).json({
        error: 'Failed to register spoke',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * GET /api/spoke/list
   *
   * List all registered spokes
   */
  static async list(_req: Request, res: Response): Promise<void> {
    try {
      const db = getDatabase()

      const rows = db
        .prepare(
          `
        SELECT
          s.*,
          pc.cluster_name as proxmox_cluster_name
        FROM spoke_registrations s
        LEFT JOIN proxmox_clusters pc ON s.proxmox_cluster_id = pc.id
        ORDER BY s.registered_at DESC
      `
        )
        .all() as Record<string, unknown>[]

      const spokes = rows.map((row) => ({
        id: row.id as string,
        tokenId: row.token_id as string,
        name: row.name as string,
        publicKey: row.public_key as string,
        allowedIPs: JSON.parse(row.allowed_ips as string),
        registeredAt: new Date(row.registered_at as string),
        lastHandshake: row.last_handshake
          ? new Date(row.last_handshake as string)
          : undefined,
        status: row.status as 'pending' | 'active' | 'inactive',
        os: row.os as 'linux' | 'macos' | 'windows' | 'proxmox',
        isProxmox: row.is_proxmox === 1,
        proxmoxClusterId: (row.proxmox_cluster_id as string) || undefined,
        proxmoxNodeName: (row.proxmox_node_name as string) || undefined,
        proxmoxVersion: (row.proxmox_version as string) || undefined,
        metadata: JSON.parse((row.metadata as string) || '{}'),
        proxmoxClusterName: (row.proxmox_cluster_name as string) || undefined,
      }))

      // Enhance with live WireGuard status
      try {
        const wgStatus = await WireGuardService.getStatus()

        for (const spoke of spokes) {
          const peer = wgStatus.peers.find((p) => p.publicKey === spoke.publicKey)

          if (peer) {
            spoke.lastHandshake = peer.lastHandshake
            // Update status based on handshake
            if (peer.lastHandshake) {
              const minutesSinceHandshake =
                (Date.now() - peer.lastHandshake.getTime()) / 1000 / 60

              if (minutesSinceHandshake < 3) {
                spoke.status = 'active'
              } else if (minutesSinceHandshake < 10) {
                spoke.status = 'pending'
              } else {
                spoke.status = 'inactive'
              }
            }
          }
        }
      } catch (error) {
        console.warn('Failed to get live WireGuard status for spoke list:', error)
        // Continue with database values if WireGuard query fails
      }

      res.json({ spokes })
    } catch (error) {
      console.error('Error listing spokes:', error)
      res.status(500).json({
        error: 'Failed to list spokes',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * GET /api/spoke/:id/status
   *
   * Get detailed status for a specific spoke
   */
  static async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const db = getDatabase()

      const row = db
        .prepare(
          `
        SELECT
          s.*,
          pc.cluster_name as proxmox_cluster_name,
          pc.datacenter as proxmox_datacenter
        FROM spoke_registrations s
        LEFT JOIN proxmox_clusters pc ON s.proxmox_cluster_id = pc.id
        WHERE s.id = ?
      `
        )
        .get(id) as Record<string, unknown> | undefined

      if (!row) {
        res.status(404).json({
          error: 'Spoke not found',
          code: 'SPOKE_NOT_FOUND',
        })
        return
      }

      const spoke = {
        id: row.id as string,
        tokenId: row.token_id as string,
        name: row.name as string,
        publicKey: row.public_key as string,
        allowedIPs: JSON.parse(row.allowed_ips as string),
        registeredAt: new Date(row.registered_at as string),
        lastHandshake: row.last_handshake
          ? new Date(row.last_handshake as string)
          : undefined,
        status: row.status as 'pending' | 'active' | 'inactive',
        os: row.os as 'linux' | 'macos' | 'windows' | 'proxmox',
        isProxmox: row.is_proxmox === 1,
        proxmoxClusterId: (row.proxmox_cluster_id as string) || undefined,
        proxmoxNodeName: (row.proxmox_node_name as string) || undefined,
        proxmoxVersion: (row.proxmox_version as string) || undefined,
        metadata: JSON.parse((row.metadata as string) || '{}'),
        proxmoxClusterName: (row.proxmox_cluster_name as string) || undefined,
        proxmoxDatacenter: (row.proxmox_datacenter as string) || undefined,
      }

      // Get live WireGuard status
      try {
        const wgStatus = await WireGuardService.getStatus()
        const peer = wgStatus.peers.find((p) => p.publicKey === spoke.publicKey)

        if (peer) {
          spoke.lastHandshake = peer.lastHandshake
          // Update status based on handshake
          if (peer.lastHandshake) {
            const minutesSinceHandshake =
              (Date.now() - peer.lastHandshake.getTime()) / 1000 / 60

            if (minutesSinceHandshake < 3) {
              spoke.status = 'active'
            } else if (minutesSinceHandshake < 10) {
              spoke.status = 'pending'
            } else {
              spoke.status = 'inactive'
            }
          }
        }
      } catch (error) {
        console.warn('Failed to get live WireGuard status:', error)
      }

      res.json(spoke)
    } catch (error) {
      console.error('Error fetching spoke status:', error)
      res.status(500).json({
        error: 'Failed to fetch spoke status',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * DELETE /api/spoke/:id
   *
   * Remove a spoke registration
   */
  static async remove(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const db = getDatabase()

      // Get spoke info before deleting
      const spoke = db
        .prepare('SELECT * FROM spoke_registrations WHERE id = ?')
        .get(id) as Record<string, unknown> | undefined

      if (!spoke) {
        res.status(404).json({
          error: 'Spoke not found',
          code: 'SPOKE_NOT_FOUND',
        })
        return
      }

      // Convert to SpokeRegistration type
      const spokeData: SpokeRegistration = {
        id: spoke.id as string,
        tokenId: spoke.token_id as string,
        name: spoke.name as string,
        publicKey: spoke.public_key as string,
        allowedIPs: JSON.parse(spoke.allowed_ips as string),
        registeredAt: new Date(spoke.registered_at as string),
        status: spoke.status as 'pending' | 'active' | 'inactive',
        os: spoke.os as 'linux' | 'macos' | 'windows' | 'proxmox',
      }

      // Remove from WireGuard
      await WireGuardService.removeSpokePeer(spokeData)

      // Delete from database
      db.prepare('DELETE FROM spoke_registrations WHERE id = ?').run(id)

      res.json({
        message: 'Spoke removed successfully',
        spokeId: id,
      })
    } catch (error) {
      console.error('Error removing spoke:', error)
      res.status(500).json({
        error: 'Failed to remove spoke',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }
}
