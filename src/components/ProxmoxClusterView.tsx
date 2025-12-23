import { useState, useEffect } from 'react'
import { useHub } from '../contexts/HubContext'
import type { SpokeRegistration } from '../types'

/**
 * Proxmox cluster hierarchical view component
 * Groups Proxmox nodes by cluster with status indicators
 */
export function ProxmoxClusterView() {
  const { spokes, proxmoxClusters } = useHub()
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set())

  // Get Proxmox spokes
  const proxmoxSpokes = spokes.filter((s) => s.isProxmox)
  const standaloneProxmox = proxmoxSpokes.filter((s) => !s.proxmoxClusterId)
  const clusteredProxmox = proxmoxSpokes.filter((s) => s.proxmoxClusterId)

  /**
   * Toggle cluster expansion
   */
  const toggleCluster = (clusterId: string) => {
    setExpandedClusters((prev) => {
      const next = new Set(prev)
      if (next.has(clusterId)) {
        next.delete(clusterId)
      } else {
        next.add(clusterId)
      }
      return next
    })
  }

  /**
   * Get cluster health status
   */
  const getClusterHealth = (clusterSpokes: SpokeRegistration[]) => {
    if (clusterSpokes.length === 0) return { status: 'empty', color: 'gray', text: 'No Nodes' }

    const activeCount = clusterSpokes.filter((s) => {
      if (!s.lastHandshake) return false
      const minutesAgo = (Date.now() - new Date(s.lastHandshake).getTime()) / 1000 / 60
      return minutesAgo < 3
    }).length

    if (activeCount === clusterSpokes.length) {
      return { status: 'healthy', color: 'green', text: 'All Active' }
    } else if (activeCount > 0) {
      return {
        status: 'degraded',
        color: 'yellow',
        text: `${activeCount}/${clusterSpokes.length} Active`,
      }
    } else {
      return { status: 'down', color: 'red', text: 'All Inactive' }
    }
  }

  /**
   * Get node status indicator
   */
  const getNodeStatus = (spoke: SpokeRegistration) => {
    if (!spoke.lastHandshake) {
      return { color: 'bg-yellow-400', text: 'Pending' }
    }

    const minutesAgo = (Date.now() - new Date(spoke.lastHandshake).getTime()) / 1000 / 60

    if (minutesAgo < 3) {
      return { color: 'bg-green-400', text: 'Active' }
    } else if (minutesAgo < 10) {
      return { color: 'bg-yellow-400', text: 'Idle' }
    } else {
      return { color: 'bg-red-400', text: 'Inactive' }
    }
  }

  /**
   * Format last handshake time
   */
  const formatLastHandshake = (lastHandshake?: Date) => {
    if (!lastHandshake) return 'Never'

    const now = Date.now()
    const then = new Date(lastHandshake).getTime()
    const diffSeconds = Math.floor((now - then) / 1000)

    if (diffSeconds < 60) return `${diffSeconds}s ago`
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`
    return `${Math.floor(diffSeconds / 86400)}d ago`
  }

  // Auto-expand clusters on mount
  useEffect(() => {
    if (proxmoxClusters.length > 0) {
      setExpandedClusters(new Set(proxmoxClusters.map((c) => c.id)))
    }
  }, [proxmoxClusters])

  if (proxmoxSpokes.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-600">No Proxmox spokes registered yet.</p>
        <p className="text-sm text-gray-500 mt-2">
          Proxmox nodes will be automatically grouped by cluster when registered.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Clustered Proxmox Nodes */}
      {proxmoxClusters.map((cluster) => {
        const clusterSpokes = clusteredProxmox.filter(
          (s) => s.proxmoxClusterId === cluster.id
        )
        const health = getClusterHealth(clusterSpokes)
        const isExpanded = expandedClusters.has(cluster.id)

        return (
          <div key={cluster.id} className="bg-white shadow rounded-lg overflow-hidden">
            {/* Cluster Header */}
            <button
              onClick={() => toggleCluster(cluster.id)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center space-x-4">
                <span className="text-2xl">{isExpanded ? '▼' : '▶'}</span>
                <div className="text-left">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Cluster: {cluster.clusterName}
                  </h3>
                  {cluster.datacenter && (
                    <p className="text-sm text-gray-500">Datacenter: {cluster.datacenter}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium bg-${health.color}-100 text-${health.color}-800`}
                >
                  {health.text}
                </span>
                <span className="text-sm text-gray-500">{clusterSpokes.length} nodes</span>
              </div>
            </button>

            {/* Cluster Nodes */}
            {isExpanded && (
              <div className="border-t border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Node
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        IP Address
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Version
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Last Handshake
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {clusterSpokes.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                          No nodes registered in this cluster
                        </td>
                      </tr>
                    ) : (
                      clusterSpokes.map((spoke) => {
                        const status = getNodeStatus(spoke)
                        return (
                          <tr key={spoke.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <span className={`h-2.5 w-2.5 rounded-full ${status.color} mr-2`}></span>
                                <span className="text-sm text-gray-700">{status.text}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {spoke.proxmoxNodeName || spoke.name}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm text-gray-900 font-mono">
                                {spoke.allowedIPs[0]}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {spoke.proxmoxVersion || 'Unknown'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatLastHandshake(spoke.lastHandshake)}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}

      {/* Standalone Proxmox Hosts */}
      {standaloneProxmox.length > 0 && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Standalone Proxmox Hosts</h3>
            <p className="text-sm text-gray-500 mt-1">
              {standaloneProxmox.length} host{standaloneProxmox.length !== 1 ? 's' : ''}
            </p>
          </div>

          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  IP Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Version
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Last Handshake
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {standaloneProxmox.map((spoke) => {
                const status = getNodeStatus(spoke)
                return (
                  <tr key={spoke.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className={`h-2.5 w-2.5 rounded-full ${status.color} mr-2`}></span>
                        <span className="text-sm text-gray-700">{status.text}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {spoke.proxmoxNodeName || spoke.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900 font-mono">
                        {spoke.allowedIPs[0]}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {spoke.proxmoxVersion || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatLastHandshake(spoke.lastHandshake)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
