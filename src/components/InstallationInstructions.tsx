import React, { useState } from 'react'
import type { InstallationToken } from '../types'

interface InstallationInstructionsProps {
  token: InstallationToken
  onClose: () => void
}

type Platform = 'linux' | 'macos' | 'windows' | 'proxmox'

/**
 * Installation instructions modal component
 * Displays platform-specific installation commands
 */
export function InstallationInstructions({ token, onClose }: InstallationInstructionsProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('linux')
  const [copied, setCopied] = useState(false)

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin

  /**
   * Get installation command for platform
   */
  const getInstallCommand = (platform: Platform): string => {
    const scriptUrl = `${API_BASE_URL}/api/installation/script/${token.token}?platform=${platform}`

    switch (platform) {
      case 'linux':
        return `curl -sSL "${scriptUrl}" | sudo bash`

      case 'macos':
        return `curl -sSL "${scriptUrl}" | sudo bash`

      case 'windows':
        return `Invoke-WebRequest -Uri "${scriptUrl}" -UseBasicParsing | Invoke-Expression`

      case 'proxmox':
        return `curl -sSL "${scriptUrl}" | bash`

      default:
        return ''
    }
  }

  /**
   * Copy command to clipboard
   */
  const handleCopy = async () => {
    const command = getInstallCommand(selectedPlatform)
    await navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  /**
   * Platform-specific notes
   */
  const getPlatformNotes = (platform: Platform): React.ReactNode => {
    switch (platform) {
      case 'linux':
        return (
          <ul className="space-y-1 text-sm text-gray-600">
            <li>• Supported: Ubuntu, Debian, CentOS, RHEL, Fedora, Arch, OpenSUSE</li>
            <li>• WireGuard will be automatically installed via package manager</li>
            <li>• Requires sudo/root privileges</li>
            <li>• systemd service will be enabled and started</li>
          </ul>
        )

      case 'macos':
        return (
          <ul className="space-y-1 text-sm text-gray-600">
            <li>• Requires Homebrew (will be checked automatically)</li>
            <li>• WireGuard tools will be installed via brew</li>
            <li>• Requires sudo/admin privileges</li>
            <li>• launchd service will be configured for auto-start</li>
          </ul>
        )

      case 'windows':
        return (
          <ul className="space-y-1 text-sm text-gray-600">
            <li>• Must run PowerShell as Administrator</li>
            <li>• Chocolatey will be installed if not present</li>
            <li>• WireGuard GUI will be installed</li>
            <li>• Tunnel service will be configured and started</li>
          </ul>
        )

      case 'proxmox':
        return (
          <ul className="space-y-1 text-sm text-gray-600">
            <li>• Automatically detects cluster membership</li>
            <li>• Each node in a cluster needs its own unique token</li>
            <li>• Nodes will be grouped by cluster in the dashboard</li>
            <li>• Requires root privileges on Proxmox host</li>
          </ul>
        )

      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Installation Instructions</h2>
            <p className="text-sm text-gray-600 mt-1">Spoke: {token.spokeName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <span className="text-2xl">×</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Token Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">Token Information</h3>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-blue-700">Allocated IP:</dt>
                <dd className="font-mono text-blue-900">{token.allowedIPs[0]}</dd>
              </div>
              <div>
                <dt className="text-blue-700">Expires:</dt>
                <dd className="text-blue-900">{new Date(token.expiresAt).toLocaleString()}</dd>
              </div>
            </dl>
          </div>

          {/* Platform Tabs */}
          <div>
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                {[
                  { key: 'linux' as Platform, label: 'Linux' },
                  { key: 'macos' as Platform, label: 'macOS' },
                  { key: 'windows' as Platform, label: 'Windows' },
                  { key: 'proxmox' as Platform, label: 'Proxmox VE' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setSelectedPlatform(key)}
                    className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                      selectedPlatform === key
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Installation Command */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold text-gray-700">Installation Command</h3>
              <button
                onClick={handleCopy}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
              >
                {copied ? '✓ Copied!' : 'Copy'}
              </button>
            </div>

            <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
              <code className="text-green-400 text-sm font-mono whitespace-pre">
                {getInstallCommand(selectedPlatform)}
              </code>
            </div>
          </div>

          {/* Platform-Specific Notes */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Platform Notes</h3>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              {getPlatformNotes(selectedPlatform)}
            </div>
          </div>

          {/* Proxmox Multi-Node Instructions */}
          {selectedPlatform === 'proxmox' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-yellow-900 mb-2">
                Proxmox Cluster Setup
              </h3>
              <p className="text-sm text-yellow-800 mb-2">
                For clustered Proxmox deployments:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-sm text-yellow-800">
                <li>Generate a unique token for EACH node in the cluster</li>
                <li>SSH to each Proxmox node individually</li>
                <li>Run the installation command on each node with its unique token</li>
                <li>
                  The script will auto-detect cluster membership and group nodes in the dashboard
                </li>
              </ol>
            </div>
          )}

          {/* Installation Steps */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">What Happens Next?</h3>
            <ol className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start">
                <span className="mr-2 font-semibold">1.</span>
                <span>
                  Run the command above on your{' '}
                  {selectedPlatform === 'windows' ? 'PowerShell (as Administrator)' : 'terminal'}
                </span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 font-semibold">2.</span>
                <span>
                  The script will install WireGuard (if not already installed) and generate keys
                  locally
                </span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 font-semibold">3.</span>
                <span>Your spoke will register with the hub using the token</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 font-semibold">4.</span>
                <span>
                  WireGuard will be configured and started automatically - your VPN connection will
                  be active!
                </span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 font-semibold">5.</span>
                <span>The spoke will appear in the dashboard within seconds</span>
              </li>
            </ol>
          </div>

          {/* Security Warning */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-red-900 mb-2">Security Notice</h3>
            <ul className="space-y-1 text-sm text-red-800">
              <li>• This token can only be used ONCE</li>
              <li>• The token expires in 24 hours</li>
              <li>• Keep the installation command secure - treat it like a password</li>
              <li>
                • Private keys are generated on the spoke and NEVER transmitted to the hub
              </li>
            </ul>
          </div>

          {/* Close Button */}
          <div className="flex justify-end pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
