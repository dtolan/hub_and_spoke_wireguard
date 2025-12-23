import { useState } from 'react'
import { useHub } from '../contexts/HubContext'
import { SpokeManager } from './SpokeManager'
import { InstallationTokenGenerator } from './InstallationTokenGenerator'
import { ProxmoxClusterView } from './ProxmoxClusterView'

type DashboardTab = 'overview' | 'spokes' | 'proxmox' | 'tokens'

/**
 * Main dashboard component for WireGuard hub-and-spoke management
 */
const Dashboard: React.FC = () => {
  const { hubConfig, spokes, pendingTokens, error } = useHub()
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview')

  // Calculate statistics
  const stats = {
    totalSpokes: spokes.length,
    activeSpokes: spokes.filter((s) => {
      if (!s.lastHandshake) return false
      const minutesAgo = (Date.now() - new Date(s.lastHandshake).getTime()) / 1000 / 60
      return minutesAgo < 3
    }).length,
    proxmoxNodes: spokes.filter((s) => s.isProxmox).length,
    pendingTokens: pendingTokens.length,
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Hub-and-Spoke WireGuard VPN
              </h1>
              <p className="text-gray-600 mt-1">
                {hubConfig?.endpoint || 'Loading...'}
              </p>
            </div>

            {/* Hub Status Badge */}
            <div className="flex items-center space-x-2">
              <span className="h-3 w-3 rounded-full bg-green-400 animate-pulse"></span>
              <span className="text-sm font-medium text-gray-700">Hub Active</span>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="-mb-px flex space-x-8">
            {[
              { key: 'overview' as DashboardTab, label: 'Overview' },
              { key: 'spokes' as DashboardTab, label: 'Spokes', count: stats.totalSpokes },
              { key: 'proxmox' as DashboardTab, label: 'Proxmox', count: stats.proxmoxNodes },
              { key: 'tokens' as DashboardTab, label: 'Tokens', count: stats.pendingTokens },
            ].map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {label}
                {count !== undefined && (
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-gray-100 text-xs">
                    {count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Spokes</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalSpokes}</p>
                  </div>
                  <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">🌐</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Now</p>
                    <p className="text-3xl font-bold text-green-600 mt-2">{stats.activeSpokes}</p>
                  </div>
                  <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">✓</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Proxmox Nodes</p>
                    <p className="text-3xl font-bold text-purple-600 mt-2">{stats.proxmoxNodes}</p>
                  </div>
                  <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">🖥️</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Pending Tokens</p>
                    <p className="text-3xl font-bold text-yellow-600 mt-2">
                      {stats.pendingTokens}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">🎫</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Hub Configuration */}
            {hubConfig && (
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Hub Configuration</h2>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Network CIDR</dt>
                    <dd className="mt-1 text-sm text-gray-900 font-mono">
                      {hubConfig.networkCIDR}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-sm font-medium text-gray-500">Listen Port</dt>
                    <dd className="mt-1 text-sm text-gray-900 font-mono">
                      {hubConfig.listenPort}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-sm font-medium text-gray-500">Public Endpoint</dt>
                    <dd className="mt-1 text-sm text-gray-900 font-mono">{hubConfig.endpoint}</dd>
                  </div>

                  <div>
                    <dt className="text-sm font-medium text-gray-500">DNS Servers</dt>
                    <dd className="mt-1 text-sm text-gray-900 font-mono">
                      {hubConfig.dns?.join(', ') || 'None'}
                    </dd>
                  </div>

                  <div className="md:col-span-2">
                    <dt className="text-sm font-medium text-gray-500">Hub Public Key</dt>
                    <dd className="mt-1 text-sm text-gray-900 font-mono break-all">
                      {hubConfig.publicKey}
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => setActiveTab('tokens')}
                  className="px-4 py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium transition-colors text-left"
                >
                  <div className="text-lg mb-1">+ Add Spoke</div>
                  <div className="text-sm text-blue-600">Generate installation token</div>
                </button>

                <button
                  onClick={() => setActiveTab('spokes')}
                  className="px-4 py-3 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg font-medium transition-colors text-left"
                >
                  <div className="text-lg mb-1">View All Spokes</div>
                  <div className="text-sm text-gray-600">Manage connected devices</div>
                </button>

                <button
                  onClick={() => setActiveTab('proxmox')}
                  className="px-4 py-3 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg font-medium transition-colors text-left"
                  disabled={stats.proxmoxNodes === 0}
                >
                  <div className="text-lg mb-1">Proxmox Clusters</div>
                  <div className="text-sm text-purple-600">
                    {stats.proxmoxNodes > 0
                      ? `View ${stats.proxmoxNodes} node${stats.proxmoxNodes !== 1 ? 's' : ''}`
                      : 'No Proxmox nodes'}
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Spokes Tab */}
        {activeTab === 'spokes' && <SpokeManager />}

        {/* Proxmox Tab */}
        {activeTab === 'proxmox' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Proxmox Cluster View</h2>
              <p className="text-gray-600 mt-1">
                Hierarchical view of Proxmox nodes grouped by cluster
              </p>
            </div>
            <ProxmoxClusterView />
          </div>
        )}

        {/* Tokens Tab */}
        {activeTab === 'tokens' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Installation Tokens</h2>
              <p className="text-gray-600 mt-1">
                Generate one-time-use tokens for spoke installation
              </p>
            </div>
            <InstallationTokenGenerator />
          </div>
        )}
      </main>
    </div>
  )
}

export default Dashboard
