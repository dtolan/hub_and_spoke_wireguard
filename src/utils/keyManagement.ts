import type { KeyPair } from '../types'

/**
 * Generate a WireGuard key pair
 *
 * Note: This is a placeholder. In production, this should call
 * the actual WireGuard key generation commands or use a crypto library.
 */
export async function generateKeyPair(): Promise<KeyPair> {
  // TODO: Implement actual key generation
  // This would typically execute: wg genkey | tee privatekey | wg pubkey > publickey
  throw new Error('Key generation not yet implemented. Requires WireGuard binaries or crypto library.')
}

/**
 * Validate a WireGuard public key format
 */
export function isValidPublicKey(key: string): boolean {
  // WireGuard keys are base64 encoded 32-byte values (44 chars)
  const keyRegex = /^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw480]=$|^[A-Za-z0-9+/]{43}=$/
  return keyRegex.test(key)
}

/**
 * Validate a WireGuard private key format
 */
export function isValidPrivateKey(key: string): boolean {
  return isValidPublicKey(key) // Same format as public key
}
