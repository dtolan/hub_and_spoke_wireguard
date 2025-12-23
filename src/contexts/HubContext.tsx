import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type {
  HubConfig,
  HubInitConfig,
  SpokeRegistration,
  InstallationToken,
  ProxmoxCluster,
} from '../types'

/**
 * Hub context value interface
 */
interface HubContextValue {
  // Hub state
  hubConfig: Omit<HubConfig, 'privateKey'> | null
  hubInitialized: boolean
  loading: boolean
  error: string | null

  // Spoke state
  spokes: SpokeRegistration[]
  pendingTokens: InstallationToken[]

  // Proxmox state
  proxmoxClusters: ProxmoxCluster[]

  // Hub actions
  initializeHub: (config: HubInitConfig) => Promise<void>
  updateHubConfig: (updates: { dns?: string[]; endpoint?: string }) => Promise<void>
  refreshHubStatus: () => Promise<void>

  // Token actions
  generateToken: (spokeName: string) => Promise<InstallationToken>
  revokeToken: (tokenId: string) => Promise<void>
  refreshTokens: () => Promise<void>

  // Spoke actions
  refreshSpokes: () => Promise<void>
  removeSpoke: (spokeId: string) => Promise<void>

  // Proxmox actions
  refreshProxmoxClusters: () => Promise<void>
  updateProxmoxCluster: (
    clusterId: string,
    updates: { datacenter?: string; description?: string }
  ) => Promise<void>
}

const HubContext = createContext<HubContextValue | undefined>(undefined)

/**
 * API base URL from environment or default
 * Empty string means use relative URLs (for Vite proxy in development)
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

/**
 * Hub context provider component
 */
export function HubProvider({ children }: { children: React.ReactNode }) {
  const [hubConfig, setHubConfig] = useState<Omit<HubConfig, 'privateKey'> | null>(null)
  const [hubInitialized, setHubInitialized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [spokes, setSpokes] = useState<SpokeRegistration[]>([])
  const [pendingTokens, setPendingTokens] = useState<InstallationToken[]>([])
  const [proxmoxClusters, setProxmoxClusters] = useState<ProxmoxCluster[]>([])

  /**
   * Fetch hub configuration
   */
  const fetchHubConfig = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/hub/config`)

      if (response.status === 404) {
        // Hub not initialized
        setHubInitialized(false)
        setHubConfig(null)
        return
      }

      if (!response.ok) {
        throw new Error('Failed to fetch hub configuration')
      }

      const data = await response.json()
      setHubConfig(data)
      setHubInitialized(true)
    } catch (err) {
      console.error('Error fetching hub config:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }, [])

  /**
   * Initialize hub
   */
  const initializeHub = useCallback(async (config: HubInitConfig) => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`${API_BASE_URL}/api/hub/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to initialize hub')
      }

      const data = await response.json()
      setHubConfig(data.config)
      setHubInitialized(true)
    } catch (err) {
      console.error('Error initializing hub:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Update hub configuration
   */
  const updateHubConfig = useCallback(
    async (updates: { dns?: string[]; endpoint?: string }) => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`${API_BASE_URL}/api/hub/config`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to update hub configuration')
        }

        const data = await response.json()
        setHubConfig(data.config)
      } catch (err) {
        console.error('Error updating hub config:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
        throw err
      } finally {
        setLoading(false)
      }
    },
    []
  )

  /**
   * Refresh hub status (live WireGuard data)
   */
  const refreshHubStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/hub/status`)

      if (!response.ok) {
        throw new Error('Failed to fetch hub status')
      }

      // Status data can be used to update spoke handshake times
      await refreshSpokes()
    } catch (err) {
      console.error('Error fetching hub status:', err)
    }
  }, [])

  /**
   * Generate installation token
   */
  const generateToken = useCallback(async (spokeName: string): Promise<InstallationToken> => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`${API_BASE_URL}/api/installation/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spokeName }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate token')
      }

      const data = await response.json()
      const token = data.token

      // Refresh tokens list
      await refreshTokens()

      return token
    } catch (err) {
      console.error('Error generating token:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Revoke installation token
   */
  const revokeToken = useCallback(async (tokenId: string) => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`${API_BASE_URL}/api/installation/token/${tokenId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to revoke token')
      }

      // Refresh tokens list
      await refreshTokens()
    } catch (err) {
      console.error('Error revoking token:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Refresh installation tokens list
   */
  const refreshTokens = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/installation/tokens`)

      if (!response.ok) {
        throw new Error('Failed to fetch tokens')
      }

      const data = await response.json()
      setPendingTokens(data.tokens.filter((t: InstallationToken) => !t.used))
    } catch (err) {
      console.error('Error fetching tokens:', err)
    }
  }, [])

  /**
   * Refresh spokes list
   */
  const refreshSpokes = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/spoke/list`)

      if (!response.ok) {
        throw new Error('Failed to fetch spokes')
      }

      const data = await response.json()
      setSpokes(data.spokes)
    } catch (err) {
      console.error('Error fetching spokes:', err)
    }
  }, [])

  /**
   * Remove spoke
   */
  const removeSpoke = useCallback(async (spokeId: string) => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`${API_BASE_URL}/api/spoke/${spokeId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to remove spoke')
      }

      // Refresh spokes list
      await refreshSpokes()
    } catch (err) {
      console.error('Error removing spoke:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Refresh Proxmox clusters
   */
  const refreshProxmoxClusters = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/proxmox/clusters`)

      if (!response.ok) {
        throw new Error('Failed to fetch Proxmox clusters')
      }

      const data = await response.json()
      setProxmoxClusters(data.clusters)
    } catch (err) {
      console.error('Error fetching Proxmox clusters:', err)
    }
  }, [])

  /**
   * Update Proxmox cluster metadata
   */
  const updateProxmoxCluster = useCallback(
    async (clusterId: string, updates: { datacenter?: string; description?: string }) => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`${API_BASE_URL}/api/proxmox/clusters/${clusterId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to update cluster')
        }

        // Refresh clusters
        await refreshProxmoxClusters()
      } catch (err) {
        console.error('Error updating Proxmox cluster:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
        throw err
      } finally {
        setLoading(false)
      }
    },
    []
  )

  /**
   * Initial data fetch
   */
  useEffect(() => {
    const initialize = async () => {
      setLoading(true)
      await fetchHubConfig()
      setLoading(false)
    }

    initialize()
  }, [fetchHubConfig])

  /**
   * Fetch spokes and tokens if hub is initialized
   */
  useEffect(() => {
    if (hubInitialized) {
      refreshSpokes()
      refreshTokens()
      refreshProxmoxClusters()

      // Poll for updates every 30 seconds
      const interval = setInterval(() => {
        refreshSpokes()
        refreshTokens()
        refreshProxmoxClusters()
      }, 30000)

      return () => clearInterval(interval)
    }
  }, [hubInitialized, refreshSpokes, refreshTokens, refreshProxmoxClusters])

  const value: HubContextValue = {
    hubConfig,
    hubInitialized,
    loading,
    error,
    spokes,
    pendingTokens,
    proxmoxClusters,
    initializeHub,
    updateHubConfig,
    refreshHubStatus,
    generateToken,
    revokeToken,
    refreshTokens,
    refreshSpokes,
    removeSpoke,
    refreshProxmoxClusters,
    updateProxmoxCluster,
  }

  return <HubContext.Provider value={value}>{children}</HubContext.Provider>
}

/**
 * Hook to use hub context
 */
export function useHub() {
  const context = useContext(HubContext)
  if (context === undefined) {
    throw new Error('useHub must be used within a HubProvider')
  }
  return context
}
