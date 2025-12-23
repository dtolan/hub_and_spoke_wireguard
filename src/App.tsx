import React from 'react'
import { HubProvider, useHub } from './contexts/HubContext'
import { HubInitializer } from './components/HubInitializer'
import Dashboard from './components/Dashboard'

/**
 * Main application content
 * Shows either HubInitializer or Dashboard based on hub initialization status
 */
function AppContent() {
  const { hubInitialized, loading } = useHub()

  // Show loading state while fetching hub status
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading hub configuration...</p>
        </div>
      </div>
    )
  }

  // Show initializer if hub not set up
  if (!hubInitialized) {
    return <HubInitializer />
  }

  // Show dashboard once hub is initialized
  return <Dashboard />
}

/**
 * Root App component
 * Provides hub context to entire application
 */
function App() {
  return (
    <HubProvider>
      <AppContent />
    </HubProvider>
  )
}

export default App
