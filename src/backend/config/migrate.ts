#!/usr/bin/env tsx
/**
 * Database migration script
 *
 * Handles schema migrations for the WireGuard hub database.
 * Run this after pulling updates that change the database schema.
 */

import { db } from './database.js'

console.log('='.repeat(60))
console.log('  WireGuard Hub Database Migration')
console.log('='.repeat(60))
console.log()

try {
  // Check if hub_config table exists
  const tableExists = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='hub_config'
  `).get()

  if (!tableExists) {
    console.log('✓ No existing hub_config table - will be created on first run')
    process.exit(0)
  }

  // Get current columns
  const columns = db.prepare('PRAGMA table_info(hub_config)').all() as Array<{
    cid: number
    name: string
    type: string
    notnull: number
    dflt_value: string | null
    pk: number
  }>

  const columnNames = columns.map(c => c.name)
  console.log(`Current hub_config columns: ${columnNames.join(', ')}`)
  console.log()

  // Check if migration is needed
  const needsMigration = !columnNames.includes('public_endpoint') &&
                         columnNames.includes('endpoint')

  if (!needsMigration) {
    if (columnNames.includes('public_endpoint')) {
      console.log('✓ Database schema is already up to date')
    } else {
      console.log('✓ Database schema is current (no migration needed)')
    }
    process.exit(0)
  }

  console.log('⚠️  Migration needed: endpoint → public_endpoint + private_endpoint')
  console.log()

  // Begin transaction
  db.exec('BEGIN TRANSACTION')

  try {
    // Get existing data
    const existingData = db.prepare('SELECT * FROM hub_config WHERE id = 1').get()

    if (existingData) {
      console.log('📦 Backing up existing hub configuration...')

      // Create new table with updated schema
      db.exec(`
        CREATE TABLE hub_config_new (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          interface_address TEXT NOT NULL,
          listen_port INTEGER NOT NULL,
          private_key TEXT NOT NULL,
          public_key TEXT NOT NULL,
          network_cidr TEXT NOT NULL,
          dns TEXT,
          public_endpoint TEXT NOT NULL,
          private_endpoint TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `)

      console.log('✓ Created new table schema')

      // Migrate data
      const oldData = existingData as {
        id: number
        interface_address: string
        listen_port: number
        private_key: string
        public_key: string
        network_cidr: string
        dns: string | null
        endpoint: string
        created_at: string
        updated_at: string
      }

      db.prepare(`
        INSERT INTO hub_config_new (
          id, interface_address, listen_port, private_key, public_key,
          network_cidr, dns, public_endpoint, private_endpoint, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        oldData.id,
        oldData.interface_address,
        oldData.listen_port,
        oldData.private_key,
        oldData.public_key,
        oldData.network_cidr,
        oldData.dns,
        oldData.endpoint, // Old 'endpoint' becomes 'public_endpoint'
        null, // private_endpoint is NULL (can be set later)
        oldData.created_at,
        new Date().toISOString() // Update updated_at
      )

      console.log('✓ Migrated existing data')
      console.log(`  - Public Endpoint: ${oldData.endpoint}`)
      console.log(`  - Private Endpoint: (none - can be configured later)`)

      // Drop old table and rename new one
      db.exec('DROP TABLE hub_config')
      db.exec('ALTER TABLE hub_config_new RENAME TO hub_config')

      console.log('✓ Replaced old table with new schema')
    } else {
      console.log('ℹ️  No existing hub configuration - recreating empty table')

      db.exec('DROP TABLE hub_config')
      db.exec(`
        CREATE TABLE hub_config (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          interface_address TEXT NOT NULL,
          listen_port INTEGER NOT NULL,
          private_key TEXT NOT NULL,
          public_key TEXT NOT NULL,
          network_cidr TEXT NOT NULL,
          dns TEXT,
          public_endpoint TEXT NOT NULL,
          private_endpoint TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `)

      console.log('✓ Created new table schema')
    }

    // Commit transaction
    db.exec('COMMIT')

    console.log()
    console.log('✅ Migration completed successfully!')
    console.log()
    console.log('Next steps:')
    console.log('  1. Restart the backend server')
    console.log('  2. Refresh the dashboard in your browser')
    console.log('  3. The hub should now be ready for spoke installations')
    console.log()

  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

} catch (error) {
  console.error()
  console.error('❌ Migration failed:', error)
  console.error()
  process.exit(1)
}
