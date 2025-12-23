-- Migration script to update existing database schema

-- Check if we need to migrate hub_config table
-- If 'endpoint' column exists, we need to migrate
ALTER TABLE hub_config RENAME COLUMN endpoint TO public_endpoint;
ALTER TABLE hub_config ADD COLUMN private_endpoint TEXT;

-- Check if we need to migrate installation_tokens table
ALTER TABLE installation_tokens RENAME COLUMN hub_endpoint TO hub_public_endpoint;
ALTER TABLE installation_tokens ADD COLUMN hub_private_endpoint TEXT;
ALTER TABLE installation_tokens ADD COLUMN use_private_endpoint INTEGER DEFAULT 0;
