import type { Request, Response } from 'express'
import { getDatabase } from '../config/database.js'
import { WireGuardService } from '../services/WireGuardService.js'
import type { HubConfig, HubInitConfig } from '../../types/index.js'

/**
 * Controller for hub management operations
 */
export class HubController {
  /**
   * POST /api/hub/initialize
   *
   * Initialize the hub with WireGuard configuration.
   * This is a one-time operation that sets up the hub interface.
   */
  static async initialize(req: Request, res: Response): Promise<void> {
    try {
      const db = getDatabase()

      // Check if hub is already initialized
      const existing = db.prepare('SELECT * FROM hub_config WHERE id = 1').get()

      if (existing) {
        res.status(400).json({
          error: 'Hub already initialized',
          code: 'HUB_ALREADY_INITIALIZED',
          hint: 'Use PUT /api/hub/config to update configuration',
        })
        return
      }

      // Validate request body
      const { networkCIDR, listenPort, endpoint, dns } = req.body as HubInitConfig

      if (!networkCIDR || !listenPort || !endpoint) {
        res.status(400).json({
          error: 'Missing required fields',
          required: ['networkCIDR', 'listenPort', 'endpoint'],
        })
        return
      }

      // Initialize WireGuard interface
      const hubConfig = await WireGuardService.initializeHub({
        networkCIDR,
        listenPort,
        endpoint,
        dns,
      })

      // Store in database
      const stmt = db.prepare(`
        INSERT INTO hub_config (
          id, interface_address, listen_port, private_key, public_key,
          network_cidr, dns, endpoint, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      stmt.run(
        1, // Singleton row
        hubConfig.interfaceAddress,
        hubConfig.listenPort,
        hubConfig.privateKey,
        hubConfig.publicKey,
        hubConfig.networkCIDR,
        JSON.stringify(hubConfig.dns || []),
        hubConfig.endpoint,
        hubConfig.createdAt.toISOString(),
        hubConfig.updatedAt.toISOString()
      )

      // Return config (without private key)
      const { privateKey, ...safeConfig } = hubConfig

      res.status(201).json({
        message: 'Hub initialized successfully',
        config: safeConfig,
      })
    } catch (error) {
      console.error('Hub initialization error:', error)
      res.status(500).json({
        error: 'Failed to initialize hub',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * GET /api/hub/config
   *
   * Get current hub configuration (without private key)
   */
  static async getConfig(_req: Request, res: Response): Promise<void> {
    try {
      const db = getDatabase()

      const row = db.prepare('SELECT * FROM hub_config WHERE id = 1').get() as
        | Record<string, unknown>
        | undefined

      if (!row) {
        res.status(404).json({
          error: 'Hub not initialized',
          code: 'HUB_NOT_INITIALIZED',
          hint: 'Initialize the hub first with POST /api/hub/initialize',
        })
        return
      }

      // Parse JSON fields and convert to HubConfig
      const config: Omit<HubConfig, 'privateKey'> = {
        id: row.id as number,
        interfaceAddress: row.interface_address as string,
        listenPort: row.listen_port as number,
        publicKey: row.public_key as string,
        networkCIDR: row.network_cidr as string,
        dns: JSON.parse((row.dns as string) || '[]'),
        endpoint: row.endpoint as string,
        createdAt: new Date(row.created_at as string),
        updatedAt: new Date(row.updated_at as string),
      }

      res.json(config)
    } catch (error) {
      console.error('Error fetching hub config:', error)
      res.status(500).json({
        error: 'Failed to fetch hub configuration',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * PUT /api/hub/config
   *
   * Update hub configuration (limited fields)
   * Note: Cannot change keys or network CIDR after initialization
   */
  static async updateConfig(req: Request, res: Response): Promise<void> {
    try {
      const db = getDatabase()

      // Check if hub exists
      const existing = db.prepare('SELECT * FROM hub_config WHERE id = 1').get()

      if (!existing) {
        res.status(404).json({
          error: 'Hub not initialized',
          code: 'HUB_NOT_INITIALIZED',
        })
        return
      }

      // Only allow updating: dns, endpoint
      const { dns, endpoint } = req.body

      const updates: string[] = []
      const values: unknown[] = []

      if (dns !== undefined) {
        updates.push('dns = ?')
        values.push(JSON.stringify(dns))
      }

      if (endpoint !== undefined) {
        updates.push('endpoint = ?')
        values.push(endpoint)
      }

      if (updates.length === 0) {
        res.status(400).json({
          error: 'No valid fields to update',
          allowedFields: ['dns', 'endpoint'],
        })
        return
      }

      // Add updated_at
      updates.push('updated_at = ?')
      values.push(new Date().toISOString())

      // Add WHERE clause value
      values.push(1)

      // Update database
      const stmt = db.prepare(`
        UPDATE hub_config
        SET ${updates.join(', ')}
        WHERE id = ?
      `)

      stmt.run(...values)

      // Fetch updated config
      const updated = db.prepare('SELECT * FROM hub_config WHERE id = 1').get() as
        | Record<string, unknown>
        | undefined

      if (!updated) {
        throw new Error('Failed to fetch updated config')
      }

      const config: Omit<HubConfig, 'privateKey'> = {
        id: updated.id as number,
        interfaceAddress: updated.interface_address as string,
        listenPort: updated.listen_port as number,
        publicKey: updated.public_key as string,
        networkCIDR: updated.network_cidr as string,
        dns: JSON.parse((updated.dns as string) || '[]'),
        endpoint: updated.endpoint as string,
        createdAt: new Date(updated.created_at as string),
        updatedAt: new Date(updated.updated_at as string),
      }

      res.json({
        message: 'Hub configuration updated',
        config,
      })
    } catch (error) {
      console.error('Error updating hub config:', error)
      res.status(500).json({
        error: 'Failed to update hub configuration',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * GET /api/hub/status
   *
   * Get live WireGuard interface status
   */
  static async getStatus(_req: Request, res: Response): Promise<void> {
    try {
      const status = await WireGuardService.getStatus()

      res.json(status)
    } catch (error) {
      console.error('Error fetching hub status:', error)
      res.status(500).json({
        error: 'Failed to fetch hub status',
        details: error instanceof Error ? error.message : 'Unknown error',
        hint: 'Ensure WireGuard is installed and the interface is running',
      })
    }
  }
}
