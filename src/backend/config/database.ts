import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import type BetterSqlite3 from 'better-sqlite3'

const DATABASE_PATH = process.env.DATABASE_PATH || './data/wireguard-hub.sqlite'

// Ensure data directory exists
const dir = path.dirname(DATABASE_PATH)
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true })
}

export const db: BetterSqlite3.Database = new Database(DATABASE_PATH)

// Enable foreign keys
db.pragma('foreign_keys = ON')

/**
 * Get database instance
 */
export function getDatabase(): BetterSqlite3.Database {
  return db
}

/**
 * Initialize database schema
 */
export function initializeDatabase() {
  // Installation tokens table
  db.exec(`
    CREATE TABLE IF NOT EXISTS installation_tokens (
      id TEXT PRIMARY KEY,
      token TEXT UNIQUE NOT NULL,
      spoke_id TEXT UNIQUE NOT NULL,
      spoke_name TEXT NOT NULL,
      allowed_ips TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      used_at TEXT,
      hub_endpoint TEXT NOT NULL,
      hub_public_key TEXT NOT NULL,
      network_cidr TEXT NOT NULL,
      dns TEXT,
      persistent_keepalive INTEGER DEFAULT 25
    )
  `)

  // Proxmox clusters table
  db.exec(`
    CREATE TABLE IF NOT EXISTS proxmox_clusters (
      id TEXT PRIMARY KEY,
      cluster_name TEXT UNIQUE NOT NULL,
      datacenter TEXT,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  // Spoke registrations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS spoke_registrations (
      id TEXT PRIMARY KEY,
      token_id TEXT NOT NULL,
      name TEXT NOT NULL,
      public_key TEXT UNIQUE NOT NULL,
      allowed_ips TEXT NOT NULL,
      registered_at TEXT NOT NULL,
      last_handshake TEXT,
      status TEXT NOT NULL,
      os TEXT NOT NULL,
      is_proxmox INTEGER DEFAULT 0,
      proxmox_cluster_id TEXT,
      proxmox_node_name TEXT,
      proxmox_version TEXT,
      metadata TEXT,
      FOREIGN KEY (token_id) REFERENCES installation_tokens(id),
      FOREIGN KEY (proxmox_cluster_id) REFERENCES proxmox_clusters(id)
    )
  `)

  // Hub configuration table (single row)
  db.exec(`
    CREATE TABLE IF NOT EXISTS hub_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      interface_address TEXT NOT NULL,
      listen_port INTEGER NOT NULL,
      private_key TEXT NOT NULL,
      public_key TEXT NOT NULL,
      network_cidr TEXT NOT NULL,
      dns TEXT,
      endpoint TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  // Create indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tokens_token ON installation_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_tokens_spoke_id ON installation_tokens(spoke_id);
    CREATE INDEX IF NOT EXISTS idx_tokens_used ON installation_tokens(used);
    CREATE INDEX IF NOT EXISTS idx_spokes_public_key ON spoke_registrations(public_key);
    CREATE INDEX IF NOT EXISTS idx_spokes_status ON spoke_registrations(status);
  `)

  console.log('✅ Database initialized successfully')
}

/**
 * Close database connection
 */
export function closeDatabase() {
  db.close()
}

// Alias for backward compatibility
export const initDatabase = initializeDatabase
