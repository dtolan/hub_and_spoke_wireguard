import { useState } from 'react'
import { useHub } from '../contexts/HubContext'
import { InstallationInstructions } from './InstallationInstructions'
import type { InstallationToken } from '../types'

/**
 * Display list of installation tokens with their status and actions
 */
export function TokensList() {
  const { pendingTokens, revokeToken, loading } = useHub()
  const [selectedToken, setSelectedToken] = useState<InstallationToken | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)

  /**
   * Handle token revocation
   */
  const handleRevoke = async (tokenId: string) => {
    if (!confirm('Are you sure you want to revoke this token? It will no longer be usable.')) {
      return
    }

    setRevoking(tokenId)
    try {
      await revokeToken(tokenId)
    } catch (error) {
      console.error('Failed to revoke token:', error)
      alert('Failed to revoke token: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setRevoking(null)
    }
  }

  /**
   * Format date for display
   */
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString()
  }

  /**
   * Check if token is expired
   */
  const isExpired = (token: InstallationToken) => {
    return new Date(token.expiresAt) < new Date()
  }

  if (loading && pendingTokens.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <p className="text-gray-500">Loading tokens...</p>
      </div>
    )
  }

  if (pendingTokens.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <p className="text-gray-500">No pending tokens. Generate a token above to get started.</p>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Pending Installation Tokens</h3>
          <p className="mt-1 text-sm text-gray-500">
            Tokens that have been generated but not yet used
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Spoke Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  IP Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expires
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pendingTokens.map((token) => {
                const expired = isExpired(token)
                return (
                  <tr key={token.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{token.spokeName}</div>
                      <div className="text-xs text-gray-500 font-mono">{token.spokeId}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 font-mono">
                        {token.allowedIPs.join(', ')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{formatDate(token.createdAt)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm ${expired ? 'text-red-600' : 'text-gray-500'}`}>
                        {formatDate(token.expiresAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {expired ? (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                          Expired
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                      <button
                        onClick={() => setSelectedToken(token)}
                        className="text-blue-600 hover:text-blue-900 font-medium"
                        disabled={expired}
                      >
                        View Instructions
                      </button>
                      <button
                        onClick={() => handleRevoke(token.id)}
                        disabled={revoking === token.id || expired}
                        className={`font-medium ${
                          revoking === token.id || expired
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'text-red-600 hover:text-red-900'
                        }`}
                      >
                        {revoking === token.id ? 'Revoking...' : 'Revoke'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Installation Instructions Modal */}
      {selectedToken && (
        <InstallationInstructions token={selectedToken} onClose={() => setSelectedToken(null)} />
      )}
    </>
  )
}
