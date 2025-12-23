import { Router } from 'express'
import { SpokeController } from '../controllers/SpokeController.js'

const router = Router()

/**
 * Spoke registration and management routes
 */

// POST /api/spoke/register - Register spoke (called by installation scripts)
router.post('/register', SpokeController.register)

// GET /api/spoke/list - List all registered spokes
router.get('/list', SpokeController.list)

// GET /api/spoke/:id/status - Get detailed spoke status
router.get('/:id/status', SpokeController.getStatus)

// DELETE /api/spoke/:id - Remove spoke registration
router.delete('/:id', SpokeController.remove)

export default router
