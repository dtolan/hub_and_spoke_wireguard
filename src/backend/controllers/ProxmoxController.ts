import type { Request, Response } from 'express'
import { getDatabase } from '../config/database.js'
import type { ProxmoxCluster } from '../../types/index.js'

/**
 * Controller for Proxmox cluster management
 */
export class ProxmoxController {
  /**
   * GET /api/proxmox/clusters
   *
   * List all Proxmox clusters with node counts
   */
  static async listClusters(req: Request, res: Response): Promise<void> {
    try {
      const db = getDatabase()

      const rows = db
        .prepare(
          `
        SELECT
          c.*,
          COUNT(s.id) as node_count
        FROM proxmox_clusters c
        LEFT JOIN spoke_registrations s ON s.proxmox_cluster_id = c.id
        GROUP BY c.id
        ORDER BY c.cluster_name
      `
        )
        .all() as Record<string, unknown>[]

      const clusters = rows.map((row) => ({
        id: row.id as string,
        clusterName: row.cluster_name as string,
        datacenter: (row.datacenter as string) || undefined,
        description: (row.description as string) || undefined,
        nodeCount: row.node_count as number,
        createdAt: new Date(row.created_at as string),
        updatedAt: new Date(row.updated_at as string),
      }))

      res.json({ clusters })
    } catch (error) {
      console.error('Error listing Proxmox clusters:', error)
      res.status(500).json({
        error: 'Failed to list Proxmox clusters',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * GET /api/proxmox/clusters/:id
   *
   * Get cluster details with all nodes
   */
  static async getCluster(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const db = getDatabase()

      // Get cluster info
      const cluster = db
        .prepare('SELECT * FROM proxmox_clusters WHERE id = ?')
        .get(id) as Record<string, unknown> | undefined

      if (!cluster) {
        res.status(404).json({
          error: 'Proxmox cluster not found',
          code: 'CLUSTER_NOT_FOUND',
        })
        return
      }

      // Get all nodes in this cluster
      const nodes = db
        .prepare(
          `
        SELECT * FROM spoke_registrations
        WHERE proxmox_cluster_id = ?
        ORDER BY proxmox_node_name
      `
        )
        .all(id) as Record<string, unknown>[]

      const clusterData: ProxmoxCluster = {
        id: cluster.id as string,
        clusterName: cluster.cluster_name as string,
        datacenter: (cluster.datacenter as string) || undefined,
        description: (cluster.description as string) || undefined,
        createdAt: new Date(cluster.created_at as string),
        updatedAt: new Date(cluster.updated_at as string),
        nodes: nodes.map((node) => ({
          id: node.id as string,
          tokenId: node.token_id as string,
          name: node.name as string,
          publicKey: node.public_key as string,
          allowedIPs: JSON.parse(node.allowed_ips as string),
          registeredAt: new Date(node.registered_at as string),
          lastHandshake: node.last_handshake
            ? new Date(node.last_handshake as string)
            : undefined,
          status: node.status as 'pending' | 'active' | 'inactive',
          os: 'proxmox',
          isProxmox: true,
          proxmoxClusterId: node.proxmox_cluster_id as string,
          proxmoxNodeName: (node.proxmox_node_name as string) || undefined,
          proxmoxVersion: (node.proxmox_version as string) || undefined,
          metadata: JSON.parse((node.metadata as string) || '{}'),
        })),
      }

      res.json(clusterData)
    } catch (error) {
      console.error('Error fetching Proxmox cluster:', error)
      res.status(500).json({
        error: 'Failed to fetch Proxmox cluster',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * PUT /api/proxmox/clusters/:id
   *
   * Update cluster metadata (datacenter, description)
   */
  static async updateCluster(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const { datacenter, description } = req.body

      const db = getDatabase()

      // Check if cluster exists
      const existing = db
        .prepare('SELECT * FROM proxmox_clusters WHERE id = ?')
        .get(id)

      if (!existing) {
        res.status(404).json({
          error: 'Proxmox cluster not found',
          code: 'CLUSTER_NOT_FOUND',
        })
        return
      }

      // Build update query
      const updates: string[] = []
      const values: unknown[] = []

      if (datacenter !== undefined) {
        updates.push('datacenter = ?')
        values.push(datacenter)
      }

      if (description !== undefined) {
        updates.push('description = ?')
        values.push(description)
      }

      if (updates.length === 0) {
        res.status(400).json({
          error: 'No valid fields to update',
          allowedFields: ['datacenter', 'description'],
        })
        return
      }

      // Add updated_at
      updates.push('updated_at = ?')
      values.push(new Date().toISOString())

      // Add WHERE clause value
      values.push(id)

      // Update database
      db.prepare(
        `
        UPDATE proxmox_clusters
        SET ${updates.join(', ')}
        WHERE id = ?
      `
      ).run(...values)

      // Fetch updated cluster
      const updated = db
        .prepare('SELECT * FROM proxmox_clusters WHERE id = ?')
        .get(id) as Record<string, unknown>

      res.json({
        message: 'Proxmox cluster updated',
        cluster: {
          id: updated.id as string,
          clusterName: updated.cluster_name as string,
          datacenter: (updated.datacenter as string) || undefined,
          description: (updated.description as string) || undefined,
          createdAt: new Date(updated.created_at as string),
          updatedAt: new Date(updated.updated_at as string),
        },
      })
    } catch (error) {
      console.error('Error updating Proxmox cluster:', error)
      res.status(500).json({
        error: 'Failed to update Proxmox cluster',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * DELETE /api/proxmox/clusters/:id
   *
   * Delete a Proxmox cluster (only if it has no nodes)
   */
  static async deleteCluster(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const db = getDatabase()

      // Check if cluster exists
      const cluster = db
        .prepare('SELECT * FROM proxmox_clusters WHERE id = ?')
        .get(id)

      if (!cluster) {
        res.status(404).json({
          error: 'Proxmox cluster not found',
          code: 'CLUSTER_NOT_FOUND',
        })
        return
      }

      // Check if cluster has any nodes
      const nodeCount = db
        .prepare(
          'SELECT COUNT(*) as count FROM spoke_registrations WHERE proxmox_cluster_id = ?'
        )
        .get(id) as { count: number }

      if (nodeCount.count > 0) {
        res.status(409).json({
          error: 'Cannot delete cluster with active nodes',
          code: 'CLUSTER_HAS_NODES',
          nodeCount: nodeCount.count,
          hint: 'Remove all nodes from the cluster before deleting it',
        })
        return
      }

      // Delete cluster
      db.prepare('DELETE FROM proxmox_clusters WHERE id = ?').run(id)

      res.json({
        message: 'Proxmox cluster deleted',
        clusterId: id,
      })
    } catch (error) {
      console.error('Error deleting Proxmox cluster:', error)
      res.status(500).json({
        error: 'Failed to delete Proxmox cluster',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }
}
