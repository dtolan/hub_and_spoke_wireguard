import React, { useState } from 'react'
import { useHub } from '../contexts/HubContext'
import type { HubInitConfig } from '../types'

/**
 * Hub initialization wizard component
 * Shown on first run to configure the hub
 */
export function HubInitializer() {
  const { initializeHub, loading, error } = useHub()

  const [formData, setFormData] = useState<HubInitConfig>({
    networkCIDR: '10.0.1.0/24',
    listenPort: 51820,
    endpoint: '',
    dns: ['1.1.1.1', '8.8.8.8'],
  })

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  /**
   * Validate form data
   */
  const validate = (): boolean => {
    const errors: Record<string, string> = {}

    // Validate network CIDR
    if (!/^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(formData.networkCIDR)) {
      errors.networkCIDR = 'Invalid CIDR format (e.g., 10.0.1.0/24)'
    }

    // Validate listen port
    if (formData.listenPort < 1 || formData.listenPort > 65535) {
      errors.listenPort = 'Port must be between 1 and 65535'
    }

    // Validate endpoint
    if (!formData.endpoint) {
      errors.endpoint = 'Endpoint is required'
    } else if (!/^[\w\-.]+:\d+$/.test(formData.endpoint)) {
      errors.endpoint = 'Endpoint must be in format: host:port (e.g., vpn.example.com:51820)'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) {
      return
    }

    try {
      await initializeHub(formData)
    } catch (err) {
      // Error is handled by context
      console.error('Failed to initialize hub:', err)
    }
  }

  /**
   * Update form field
   */
  const updateField = (field: keyof HubInitConfig, value: string | number | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear validation error for this field
    setValidationErrors((prev) => {
      const newErrors = { ...prev }
      delete newErrors[field as string]
      return newErrors
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Hub-and-Spoke WireGuard VPN
          </h1>
          <p className="text-gray-600">Initialize your VPN hub to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Network CIDR */}
          <div>
            <label htmlFor="networkCIDR" className="block text-sm font-medium text-gray-700 mb-2">
              Network CIDR
            </label>
            <input
              type="text"
              id="networkCIDR"
              value={formData.networkCIDR}
              onChange={(e) => updateField('networkCIDR', e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                validationErrors.networkCIDR ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="10.0.1.0/24"
            />
            {validationErrors.networkCIDR && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.networkCIDR}</p>
            )}
            <p className="mt-1 text-sm text-gray-500">
              Private network range for VPN (e.g., 10.0.1.0/24 provides 254 IPs)
            </p>
          </div>

          {/* Listen Port */}
          <div>
            <label htmlFor="listenPort" className="block text-sm font-medium text-gray-700 mb-2">
              Listen Port
            </label>
            <input
              type="number"
              id="listenPort"
              value={formData.listenPort}
              onChange={(e) => updateField('listenPort', parseInt(e.target.value, 10))}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                validationErrors.listenPort ? 'border-red-500' : 'border-gray-300'
              }`}
              min={1}
              max={65535}
            />
            {validationErrors.listenPort && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.listenPort}</p>
            )}
            <p className="mt-1 text-sm text-gray-500">
              UDP port for WireGuard (default: 51820). Ensure this port is open in your firewall.
            </p>
          </div>

          {/* Public Endpoint */}
          <div>
            <label htmlFor="endpoint" className="block text-sm font-medium text-gray-700 mb-2">
              Public Endpoint
            </label>
            <input
              type="text"
              id="endpoint"
              value={formData.endpoint}
              onChange={(e) => updateField('endpoint', e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                validationErrors.endpoint ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="vpn.example.com:51820 or 203.0.113.5:51820"
            />
            {validationErrors.endpoint && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.endpoint}</p>
            )}
            <p className="mt-1 text-sm text-gray-500">
              Public IP or domain name that spokes will use to connect (format: host:port)
            </p>
          </div>

          {/* DNS Servers */}
          <div>
            <label htmlFor="dns" className="block text-sm font-medium text-gray-700 mb-2">
              DNS Servers (optional)
            </label>
            <input
              type="text"
              id="dns"
              value={formData.dns?.join(', ') || ''}
              onChange={(e) =>
                updateField(
                  'dns',
                  e.target.value.split(',').map((s) => s.trim())
                )
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="1.1.1.1, 8.8.8.8"
            />
            <p className="mt-1 text-sm text-gray-500">
              Comma-separated DNS servers for spokes (e.g., 1.1.1.1, 8.8.8.8)
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={loading}
              className={`px-6 py-3 rounded-lg font-medium text-white transition-colors ${
                loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
              }`}
            >
              {loading ? 'Initializing...' : 'Initialize Hub'}
            </button>
          </div>
        </form>

        {/* Information Panel */}
        <div className="mt-8 pt-8 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">What happens next?</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start">
              <span className="mr-2">1.</span>
              <span>WireGuard keys will be generated on this server</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">2.</span>
              <span>The hub WireGuard interface (wg0) will be created and started</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">3.</span>
              <span>You'll be able to generate installation tokens for spoke clients</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">4.</span>
              <span>
                Spokes will automatically configure and connect using one-time installation scripts
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
