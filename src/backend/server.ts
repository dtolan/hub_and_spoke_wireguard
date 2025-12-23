import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { initDatabase } from './config/database.js'
import {
  generalLimiter,
  tokenGenerationLimiter,
  spokeRegistrationLimiter,
} from './middleware/rateLimiter.js'
import { requireHTTPS, validateJSON, errorHandler } from './middleware/validation.js'

// Import routes
import hubRoutes from './routes/hub.routes.js'
import installationRoutes from './routes/installation.routes.js'
import spokeRoutes from './routes/spoke.routes.js'
import proxmoxRoutes from './routes/proxmox.routes.js'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*'

/**
 * Initialize database
 */
try {
  initDatabase()
  console.log('✓ Database initialized')
} catch (error) {
  console.error('Failed to initialize database:', error)
  process.exit(1)
}

/**
 * Middleware
 */

// CORS
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
  })
)

// Body parsing
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// JSON validation for POST/PUT requests
app.use(validateJSON)

// General rate limiting
app.use('/api', generalLimiter)

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

/**
 * API Routes
 */

// Hub management
app.use('/api/hub', hubRoutes)

// Installation tokens and scripts
app.use(
  '/api/installation/token',
  requireHTTPS,
  tokenGenerationLimiter // Apply rate limiting to token generation
)
app.use('/api/installation', installationRoutes)

// Spoke registration and management
app.use('/api/spoke/register', requireHTTPS, spokeRegistrationLimiter) // Rate limit registration
app.use('/api/spoke', spokeRoutes)

// Proxmox cluster management
app.use('/api/proxmox', proxmoxRoutes)

/**
 * 404 handler
 */
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    code: 'ROUTE_NOT_FOUND',
    path: req.path,
  })
})

/**
 * Error handler (must be last)
 */
app.use(errorHandler)

/**
 * Start server
 */
app.listen(PORT, () => {
  console.log('')
  console.log('═══════════════════════════════════════════════════════')
  console.log('  Hub-and-Spoke WireGuard VPN Management Server')
  console.log('═══════════════════════════════════════════════════════')
  console.log('')
  console.log(`  Server running on port ${PORT}`)
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`  CORS Origin: ${CORS_ORIGIN}`)
  console.log('')
  console.log('  API Endpoints:')
  console.log('    Hub:          /api/hub/*')
  console.log('    Installation: /api/installation/*')
  console.log('    Spokes:       /api/spoke/*')
  console.log('    Proxmox:      /api/proxmox/*')
  console.log('')
  console.log('  Health Check: /health')
  console.log('')
  console.log('═══════════════════════════════════════════════════════')
  console.log('')
})

/**
 * Graceful shutdown
 */
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server')
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('\nSIGINT signal received: closing HTTP server')
  process.exit(0)
})
