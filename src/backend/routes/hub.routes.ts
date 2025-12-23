import { Router } from 'express'
import { HubController } from '../controllers/HubController.js'

const router = Router()

/**
 * Hub management routes
 */

// POST /api/hub/initialize - Initialize hub with WireGuard configuration
router.post('/initialize', HubController.initialize)

// GET /api/hub/config - Get current hub configuration
router.get('/config', HubController.getConfig)

// PUT /api/hub/config - Update hub configuration
router.put('/config', HubController.updateConfig)

// GET /api/hub/status - Get live WireGuard interface status
router.get('/status', HubController.getStatus)

export default router
