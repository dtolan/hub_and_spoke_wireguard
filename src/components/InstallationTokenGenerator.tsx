import { useState } from 'react'
import { useHub } from '../contexts/HubContext'
import { InstallationInstructions } from './InstallationInstructions'
import type { InstallationToken } from '../types'

/**
 * Installation token generator component
 * Allows creating new tokens and displays installation instructions
 */
export function InstallationTokenGenerator() {
  const { generateToken, loading } = useHub()
  const [spokeName, setSpokeName] = useState('')
  const [generatedToken, setGeneratedToken] = useState<InstallationToken | null>(null)
  const [error, setError] = useState<string | null>(null)

  /**
   * Handle token generation
   */
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!spokeName.trim()) {
      setError('Spoke name is required')
      return
    }

    // Validate spoke name (alphanumeric, dashes, underscores)
    if (!/^[a-zA-Z0-9_-]+$/.test(spokeName)) {
      setError('Spoke name can only contain letters, numbers, dashes, and underscores')
      return
    }

    try {
      const token = await generateToken(spokeName.trim())
      setGeneratedToken(token)
      setSpokeName('') // Clear form
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate token')
    }
  }

  /**
   * Close instructions modal
   */
  const handleClose = () => {
    setGeneratedToken(null)
  }

  return (
    <>
      {/* Token Generation Form */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Generate Installation Token</h3>

        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label htmlFor="spokeName" className="block text-sm font-medium text-gray-700 mb-2">
              Spoke Name
            </label>
            <input
              type="text"
              id="spokeName"
              value={spokeName}
              onChange={(e) => {
                setSpokeName(e.target.value)
                setError(null)
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="laptop-001, server-prod, pve-node1"
              disabled={loading}
            />
            <p className="mt-1 text-sm text-gray-500">
              Unique identifier for this spoke (alphanumeric, dashes, underscores)
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || !spokeName.trim()}
              className={`px-6 py-2 rounded-lg font-medium text-white transition-colors ${
                loading || !spokeName.trim()
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading ? 'Generating...' : 'Generate Token'}
            </button>
          </div>
        </form>

        {/* Information */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Token Security</h4>
          <ul className="space-y-1 text-sm text-gray-600">
            <li>• Each token can only be used once</li>
            <li>• Tokens expire after 24 hours</li>
            <li>• An IP address is pre-allocated for each token</li>
            <li>• Installation scripts automatically configure the spoke</li>
          </ul>
        </div>
      </div>

      {/* Installation Instructions Modal */}
      {generatedToken && (
        <InstallationInstructions token={generatedToken} onClose={handleClose} />
      )}
    </>
  )
}
