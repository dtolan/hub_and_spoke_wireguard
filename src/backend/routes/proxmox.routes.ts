import { Router } from 'express'
import { ProxmoxController } from '../controllers/ProxmoxController.js'

const router = Router()

/**
 * Proxmox cluster management routes
 */

// GET /api/proxmox/clusters - List all Proxmox clusters
router.get('/clusters', ProxmoxController.listClusters)

// GET /api/proxmox/clusters/:id - Get cluster details with nodes
router.get('/clusters/:id', ProxmoxController.getCluster)

// PUT /api/proxmox/clusters/:id - Update cluster metadata
router.put('/clusters/:id', ProxmoxController.updateCluster)

// DELETE /api/proxmox/clusters/:id - Delete empty cluster
router.delete('/clusters/:id', ProxmoxController.deleteCluster)

export default router
