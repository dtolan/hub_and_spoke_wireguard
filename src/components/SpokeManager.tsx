import { useState } from 'react'
import { useHub } from '../contexts/HubContext'
import type { SpokeRegistration } from '../types'

/**
 * Spoke management component
 * Displays all registered spokes with status and management actions
 */
export function SpokeManager() {
  const { spokes, removeSpoke } = useHub()
  const [selectedSpoke, setSelectedSpoke] = useState<string | null>(null)
  const [filterOS, setFilterOS] = useState<string>('all')

  /**
   * Get status indicator for a spoke
   */
  const getStatusIndicator = (spoke: SpokeRegistration) => {
    if (!spoke.lastHandshake) {
      return { color: 'bg-yellow-400', text: 'Pending', textColor: 'text-yellow-800' }
    }

    const minutesAgo = (Date.now() - new Date(spoke.lastHandshake).getTime()) / 1000 / 60

    if (minutesAgo < 3) {
      return { color: 'bg-green-400', text: 'Active', textColor: 'text-green-800' }
    } else if (minutesAgo < 10) {
      return { color: 'bg-yellow-400', text: 'Idle', textColor: 'text-yellow-800' }
    } else {
      return { color: 'bg-red-400', text: 'Inactive', textColor: 'text-red-800' }
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

  /**
   * Handle spoke removal
   */
  const handleRemoveSpoke = async (spokeId: string) => {
    if (!confirm('Are you sure you want to remove this spoke? This action cannot be undone.')) {
      return
    }

    try {
      await removeSpoke(spokeId)
      setSelectedSpoke(null)
    } catch (err) {
      alert('Failed to remove spoke')
    }
  }

  /**
   * Filter spokes by OS
   */
  const filteredSpokes = filterOS === 'all'
    ? spokes
    : spokes.filter(s => s.os === filterOS)

  /**
   * Group spokes by type
   */
  const spokesByType = {
    proxmox: filteredSpokes.filter(s => s.isProxmox),
    linux: filteredSpokes.filter(s => s.os === 'linux'),
    macos: filteredSpokes.filter(s => s.os === 'macos'),
    windows: filteredSpokes.filter(s => s.os === 'windows'),
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Spoke Management</h2>
          <p className="text-gray-600 mt-1">
            {spokes.length} spoke{spokes.length !== 1 ? 's' : ''} connected
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'all', label: 'All Spokes', count: spokes.length },
            { key: 'proxmox', label: 'Proxmox', count: spokesByType.proxmox.length },
            { key: 'linux', label: 'Linux', count: spokesByType.linux.length },
            { key: 'macos', label: 'macOS', count: spokesByType.macos.length },
            { key: 'windows', label: 'Windows', count: spokesByType.windows.length },
          ].map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setFilterOS(key)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                filterOS === key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </nav>
      </div>

      {/* Spokes Table */}
      {filteredSpokes.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
          <p className="text-gray-600">
            {spokes.length === 0
              ? 'No spokes registered yet. Click "Add Spoke" to get started.'
              : `No ${filterOS} spokes found.`}
          </p>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  IP Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  OS
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Handshake
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSpokes.map((spoke) => {
                const status = getStatusIndicator(spoke)
                return (
                  <tr
                    key={spoke.id}
                    className={`hover:bg-gray-50 transition-colors ${
                      selectedSpoke === spoke.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className={`h-2.5 w-2.5 rounded-full ${status.color} mr-2`}></span>
                        <span className={`text-sm font-medium ${status.textColor}`}>
                          {status.text}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{spoke.name}</div>
                      {spoke.isProxmox && spoke.metadata?.proxmoxClusterName && (
                        <div className="text-xs text-gray-500">
                          Cluster: {spoke.metadata.proxmoxClusterName}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900 font-mono">
                        {spoke.allowedIPs[0]}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 capitalize">
                        {spoke.isProxmox ? `Proxmox ${spoke.proxmoxNodeName || ''}` : spoke.os}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatLastHandshake(spoke.lastHandshake)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() =>
                          selectedSpoke === spoke.id
                            ? setSelectedSpoke(null)
                            : setSelectedSpoke(spoke.id)
                        }
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        Details
                      </button>
                      <button
                        onClick={() => handleRemoveSpoke(spoke.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Selected Spoke Details Panel */}
      {selectedSpoke && (
        <div className="bg-white shadow rounded-lg p-6">
          {(() => {
            const spoke = spokes.find((s) => s.id === selectedSpoke)
            if (!spoke) return null

            return (
              <div>
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Spoke Details</h3>
                  <button
                    onClick={() => setSelectedSpoke(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>

                <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Name</dt>
                    <dd className="mt-1 text-sm text-gray-900">{spoke.name}</dd>
                  </div>

                  <div>
                    <dt className="text-sm font-medium text-gray-500">Public Key</dt>
                    <dd className="mt-1 text-sm text-gray-900 font-mono break-all">
                      {spoke.publicKey}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-sm font-medium text-gray-500">Allowed IPs</dt>
                    <dd className="mt-1 text-sm text-gray-900 font-mono">
                      {spoke.allowedIPs.join(', ')}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-sm font-medium text-gray-500">Registered At</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {new Date(spoke.registeredAt).toLocaleString()}
                    </dd>
                  </div>

                  {spoke.isProxmox && (
                    <>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Proxmox Node</dt>
                        <dd className="mt-1 text-sm text-gray-900">{spoke.proxmoxNodeName}</dd>
                      </div>

                      <div>
                        <dt className="text-sm font-medium text-gray-500">Proxmox Version</dt>
                        <dd className="mt-1 text-sm text-gray-900">{spoke.proxmoxVersion}</dd>
                      </div>

                      {spoke.metadata?.proxmoxClusterName && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Cluster</dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            {spoke.metadata.proxmoxClusterName}
                          </dd>
                        </div>
                      )}
                    </>
                  )}
                </dl>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
