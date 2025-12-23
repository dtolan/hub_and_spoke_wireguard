import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import type { InstallationToken } from '../../types/index.js'

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Script templates directory
 * In development: src/backend/services/../scripts = src/backend/scripts
 * In production: dist/backend/backend/services/../scripts = dist/backend/backend/scripts
 */
const TEMPLATES_DIR = path.join(__dirname, '..', 'scripts')

/**
 * Supported platform types
 */
export type Platform = 'linux' | 'macos' | 'windows' | 'proxmox'

/**
 * Template variables that will be replaced in scripts
 */
interface TemplateVariables {
  TOKEN: string
  HUB_PUBLIC_ENDPOINT: string
  HUB_PRIVATE_ENDPOINT: string
  HUB_PUBLIC_KEY: string
  SPOKE_IP: string
  NETWORK_CIDR: string
  DNS_SERVERS: string
  CALLBACK_URL: string
  SPOKE_NAME: string
}

/**
 * Service for generating installation scripts from templates
 */
export class ScriptGenerator {
  /**
   * Template cache to avoid re-reading files
   */
  private static templateCache: Map<Platform, string> = new Map()

  /**
   * Load template from file system
   */
  private static loadTemplate(platform: Platform): string {
    // Check cache first
    if (this.templateCache.has(platform)) {
      return this.templateCache.get(platform)!
    }

    // Determine template file extension
    const extension = platform === 'windows' ? 'ps1' : 'sh'
    const templatePath = path.join(
      TEMPLATES_DIR,
      `install-spoke-${platform}.${extension}.template`
    )

    // Check if template exists
    if (!fs.existsSync(templatePath)) {
      throw new Error(
        `Template not found for platform "${platform}" at ${templatePath}`
      )
    }

    // Read template
    const template = fs.readFileSync(templatePath, 'utf-8')

    // Cache for future use
    this.templateCache.set(platform, template)

    return template
  }

  /**
   * Replace template placeholders with actual values
   */
  private static replaceVariables(
    template: string,
    variables: TemplateVariables
  ): string {
    let result = template

    // Replace each variable (using {{VARIABLE}} syntax)
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`
      // Use global replace to handle multiple occurrences
      result = result.split(placeholder).join(value)
    }

    return result
  }

  /**
   * Generate installation script for a specific platform
   *
   * @param platform Target platform (linux, macos, windows, proxmox)
   * @param tokenData Installation token data with embedded configuration
   * @param callbackUrl Full URL for spoke registration endpoint
   * @returns Rendered installation script ready for execution
   *
   * @example
   * const script = ScriptGenerator.generateScript('linux', tokenData, 'https://hub.example.com/api/spoke/register')
   * // Returns bash script with all placeholders replaced
   */
  static generateScript(
    platform: Platform,
    tokenData: InstallationToken,
    callbackUrl: string
  ): string {
    // Validate platform
    const validPlatforms: Platform[] = ['linux', 'macos', 'windows', 'proxmox']
    if (!validPlatforms.includes(platform)) {
      throw new Error(
        `Invalid platform "${platform}". Must be one of: ${validPlatforms.join(', ')}`
      )
    }

    // Load template
    const template = this.loadTemplate(platform)

    // Prepare variables for replacement - include both endpoints so script can auto-detect
    const variables: TemplateVariables = {
      TOKEN: tokenData.token,
      HUB_PUBLIC_ENDPOINT: tokenData.hubPublicEndpoint,
      HUB_PRIVATE_ENDPOINT: tokenData.hubPrivateEndpoint || '',
      HUB_PUBLIC_KEY: tokenData.hubPublicKey,
      SPOKE_IP: tokenData.allowedIPs[0], // First IP is the spoke's address
      NETWORK_CIDR: tokenData.networkCIDR,
      DNS_SERVERS: tokenData.dns?.join(', ') || '',
      CALLBACK_URL: callbackUrl,
      SPOKE_NAME: tokenData.spokeName,
    }

    // Replace placeholders and return
    const script = this.replaceVariables(template, variables)

    return script
  }

  /**
   * Get the content-type header for a platform's script
   */
  static getContentType(platform: Platform): string {
    switch (platform) {
      case 'windows':
        return 'text/plain; charset=utf-8' // PowerShell script
      case 'linux':
      case 'macos':
      case 'proxmox':
        return 'application/x-sh' // Shell script
      default:
        return 'text/plain'
    }
  }

  /**
   * Get the file extension for a platform's script
   */
  static getFileExtension(platform: Platform): string {
    switch (platform) {
      case 'windows':
        return 'ps1'
      case 'linux':
      case 'macos':
      case 'proxmox':
        return 'sh'
      default:
        return 'txt'
    }
  }

  /**
   * Validate that all required templates exist
   */
  static validateTemplates(): { valid: boolean; missing: Platform[] } {
    const platforms: Platform[] = ['linux', 'macos', 'windows', 'proxmox']
    const missing: Platform[] = []

    for (const platform of platforms) {
      const extension = platform === 'windows' ? 'ps1' : 'sh'
      const templatePath = path.join(
        TEMPLATES_DIR,
        `install-spoke-${platform}.${extension}.template`
      )

      if (!fs.existsSync(templatePath)) {
        missing.push(platform)
      }
    }

    return {
      valid: missing.length === 0,
      missing,
    }
  }

  /**
   * Clear template cache (useful for development/testing)
   */
  static clearCache(): void {
    this.templateCache.clear()
  }
}
