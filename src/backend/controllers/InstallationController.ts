import type { Request, Response } from 'express'
import { getDatabase } from '../config/database.js'
import { TokenService } from '../services/TokenService.js'
import { ScriptGenerator, type Platform } from '../services/ScriptGenerator.js'
import type { InstallationToken } from '../../types/index.js'

/**
 * Controller for installation token management and script serving
 */
export class InstallationController {
  /**
   * POST /api/installation/token
   *
   * Generate a new installation token for a spoke
   */
  static async generateToken(req: Request, res: Response): Promise<void> {
    try {
      const { spokeName, customIP } = req.body

      if (!spokeName) {
        res.status(400).json({
          error: 'Missing required field: spokeName',
        })
        return
      }

      const db = getDatabase()

      // Get hub config
      const hubConfig = db.prepare('SELECT * FROM hub_config WHERE id = 1').get() as
        | Record<string, unknown>
        | undefined

      if (!hubConfig) {
        res.status(400).json({
          error: 'Hub not initialized',
          code: 'HUB_NOT_INITIALIZED',
          hint: 'Initialize the hub first with POST /api/hub/initialize',
        })
        return
      }

      // Convert database row to HubConfig type
      const config = {
        id: hubConfig.id as number,
        interfaceAddress: hubConfig.interface_address as string,
        listenPort: hubConfig.listen_port as number,
        privateKey: hubConfig.private_key as string,
        publicKey: hubConfig.public_key as string,
        networkCIDR: hubConfig.network_cidr as string,
        dns: JSON.parse((hubConfig.dns as string) || '[]'),
        endpoint: hubConfig.endpoint as string,
        createdAt: new Date(hubConfig.created_at as string),
        updatedAt: new Date(hubConfig.updated_at as string),
      }

      // Generate token
      const token = TokenService.generateToken({
        spokeName,
        hubConfig: config,
        customIP,
      })

      res.status(201).json({
        message: 'Installation token generated',
        token: {
          id: token.id,
          token: token.token,
          spokeId: token.spokeId,
          spokeName: token.spokeName,
          allowedIPs: token.allowedIPs,
          expiresAt: token.expiresAt,
          createdAt: token.createdAt,
        },
      })
    } catch (error) {
      console.error('Token generation error:', error)

      if (error instanceof Error && error.message.includes('No available IP')) {
        res.status(409).json({
          error: 'IP address pool exhausted',
          code: 'IP_POOL_EXHAUSTED',
          hint: 'All IPs in the network CIDR are allocated. Remove unused spokes or expand the network.',
        })
        return
      }

      res.status(500).json({
        error: 'Failed to generate installation token',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * GET /api/installation/tokens
   *
   * List all installation tokens (used and unused)
   */
  static async listTokens(_req: Request, res: Response): Promise<void> {
    try {
      const db = getDatabase()

      const rows = db
        .prepare(
          `
        SELECT
          id, token, spoke_id, spoke_name, allowed_ips, created_at,
          expires_at, used, used_at
        FROM installation_tokens
        ORDER BY created_at DESC
      `
        )
        .all() as Record<string, unknown>[]

      const tokens = rows.map((row) => ({
        id: row.id as string,
        token: row.token as string,
        spokeId: row.spoke_id as string,
        spokeName: row.spoke_name as string,
        allowedIPs: JSON.parse(row.allowed_ips as string),
        createdAt: new Date(row.created_at as string),
        expiresAt: new Date(row.expires_at as string),
        used: row.used === 1,
        usedAt: row.used_at ? new Date(row.used_at as string) : undefined,
      }))

      res.json({ tokens })
    } catch (error) {
      console.error('Error listing tokens:', error)
      res.status(500).json({
        error: 'Failed to list installation tokens',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * DELETE /api/installation/token/:id
   *
   * Revoke an unused installation token
   */
  static async revokeToken(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params

      const db = getDatabase()

      // Check if token exists and is unused
      const token = db
        .prepare('SELECT * FROM installation_tokens WHERE id = ?')
        .get(id) as Record<string, unknown> | undefined

      if (!token) {
        res.status(404).json({
          error: 'Token not found',
          code: 'TOKEN_NOT_FOUND',
        })
        return
      }

      if (token.used === 1) {
        res.status(400).json({
          error: 'Cannot revoke used token',
          code: 'TOKEN_ALREADY_USED',
          usedAt: new Date(token.used_at as string),
        })
        return
      }

      // Delete token
      db.prepare('DELETE FROM installation_tokens WHERE id = ?').run(id)

      res.json({
        message: 'Installation token revoked',
        tokenId: id,
      })
    } catch (error) {
      console.error('Error revoking token:', error)
      res.status(500).json({
        error: 'Failed to revoke token',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * GET /api/installation/script/:token
   *
   * Serve installation script for a specific token and platform
   * Query param: ?platform=linux|macos|windows|proxmox
   */
  static async serveScript(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params
      const platform = (req.query.platform as Platform) || 'linux'

      // Validate platform
      const validPlatforms: Platform[] = ['linux', 'macos', 'windows', 'proxmox']
      if (!validPlatforms.includes(platform)) {
        res.status(400).json({
          error: 'Invalid platform',
          code: 'INVALID_PLATFORM',
          validPlatforms,
        })
        return
      }

      // Validate and mark token as used (atomic operation)
      let tokenData: InstallationToken
      try {
        tokenData = TokenService.validateAndMarkUsed(token)
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'TOKEN_NOT_FOUND') {
            res.status(404).json({
              error: 'Installation token not found',
              code: 'TOKEN_NOT_FOUND',
              hint: 'Please check the token and try again, or generate a new one.',
            })
            return
          }

          if (error.message === 'TOKEN_EXPIRED') {
            res.status(410).json({
              error: 'Installation token has expired',
              code: 'TOKEN_EXPIRED',
              hint: 'Tokens are valid for 24 hours. Please generate a new token.',
            })
            return
          }

          if (error.message === 'TOKEN_ALREADY_USED') {
            res.status(409).json({
              error: 'Installation token has already been used',
              code: 'TOKEN_ALREADY_USED',
              hint: 'Each token can only be used once. Please generate a new token.',
            })
            return
          }
        }

        throw error
      }

      // Build callback URL (for spoke registration)
      const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'
      const host = req.get('host')
      const callbackUrl = `${protocol}://${host}/api/spoke/register`

      // Generate script from template
      const script = ScriptGenerator.generateScript(platform, tokenData, callbackUrl)

      // Set appropriate content type
      const contentType = ScriptGenerator.getContentType(platform)
      const extension = ScriptGenerator.getFileExtension(platform)

      res.setHeader('Content-Type', contentType)
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="install-spoke-${tokenData.spokeName}.${extension}"`
      )

      res.send(script)
    } catch (error) {
      console.error('Error serving installation script:', error)
      res.status(500).json({
        error: 'Failed to serve installation script',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }
}
