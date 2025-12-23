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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Hub-and-Spoke WireGuard VPN
              </h1>
              <p className="text-gray-600 mt-1 flex items-center">
                <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                {hubConfig?.publicEndpoint || 'Loading...'}
              </p>
            </div>

            {/* Hub Status Badge */}
            <div className="flex items-center space-x-3 px-4 py-2 bg-green-50 rounded-full border border-green-200">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              <span className="text-sm font-semibold text-green-700">Hub Active</span>
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
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 transform transition-all hover:scale-105">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-100">Total Spokes</p>
                    <p className="text-4xl font-bold text-white mt-2">{stats.totalSpokes}</p>
                  </div>
                  <div className="h-14 w-14 bg-white bg-opacity-20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg p-6 transform transition-all hover:scale-105">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-100">Active Now</p>
                    <p className="text-4xl font-bold text-white mt-2">{stats.activeSpokes}</p>
                  </div>
                  <div className="h-14 w-14 bg-white bg-opacity-20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg p-6 transform transition-all hover:scale-105">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-100">Proxmox Nodes</p>
                    <p className="text-4xl font-bold text-white mt-2">{stats.proxmoxNodes}</p>
                  </div>
                  <div className="h-14 w-14 bg-white bg-opacity-20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg p-6 transform transition-all hover:scale-105">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-amber-100">Pending Tokens</p>
                    <p className="text-4xl font-bold text-white mt-2">{stats.pendingTokens}</p>
                  </div>
                  <div className="h-14 w-14 bg-white bg-opacity-20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Hub Configuration */}
            {hubConfig && (
              <div className="bg-white shadow-xl rounded-xl p-6 border border-gray-100">
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                  <svg className="w-6 h-6 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Hub Configuration
                </h2>
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
                    <dd className="mt-1 text-sm text-gray-900 font-mono">{hubConfig.publicEndpoint}</dd>
                  </div>

                  {hubConfig.privateEndpoint && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Private Endpoint</dt>
                      <dd className="mt-1 text-sm text-gray-900 font-mono">{hubConfig.privateEndpoint}</dd>
                    </div>
                  )}

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
            <div className="bg-white shadow-xl rounded-xl p-6 border border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                <svg className="w-6 h-6 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Quick Actions
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => setActiveTab('tokens')}
                  className="group px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-medium transition-all transform hover:scale-105 shadow-lg text-left"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-lg font-semibold">+ Add Spoke</span>
                    <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </div>
                  <div className="text-sm text-blue-100">Generate installation token</div>
                </button>

                <button
                  onClick={() => setActiveTab('spokes')}
                  className="group px-6 py-4 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white rounded-xl font-medium transition-all transform hover:scale-105 shadow-lg text-left"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-lg font-semibold">View All Spokes</span>
                    <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </div>
                  <div className="text-sm text-gray-100">Manage connected devices</div>
                </button>

                <button
                  onClick={() => setActiveTab('proxmox')}
                  className="group px-6 py-4 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white rounded-xl font-medium transition-all transform hover:scale-105 shadow-lg text-left disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  disabled={stats.proxmoxNodes === 0}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-lg font-semibold">Proxmox Clusters</span>
                    <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </div>
                  <div className="text-sm text-purple-100">
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
