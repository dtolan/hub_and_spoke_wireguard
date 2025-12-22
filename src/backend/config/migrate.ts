#!/usr/bin/env tsx
import { initializeDatabase, closeDatabase } from './database'

try {
  console.log('Running database migrations...')
  initializeDatabase()
  closeDatabase()
  console.log('✅ Migrations complete')
  process.exit(0)
} catch (error) {
  console.error('❌ Migration failed:', error)
  process.exit(1)
}
