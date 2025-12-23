import { Router } from 'express'
import { InstallationController } from '../controllers/InstallationController.js'

const router = Router()

/**
 * Installation token management and script serving routes
 */

// POST /api/installation/token - Generate new installation token
router.post('/token', InstallationController.generateToken)

// GET /api/installation/tokens - List all installation tokens
router.get('/tokens', InstallationController.listTokens)

// DELETE /api/installation/token/:id - Revoke unused token
router.delete('/token/:id', InstallationController.revokeToken)

// GET /api/installation/script/:token - Serve installation script
// Query param: ?platform=linux|macos|windows|proxmox
router.get('/script/:token', InstallationController.serveScript)

export default router
