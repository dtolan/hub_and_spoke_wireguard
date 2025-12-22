import { Address4 } from 'ipaddr.js'

/**
 * IP Address allocation service for hub-and-spoke network
 */
export class IPAddressPool {
  /**
   * Get next available IP address from CIDR range
   * @param networkCIDR Network CIDR (e.g., "10.0.1.0/24")
   * @param usedIPs Array of already allocated IPs
   * @param reserveFirst Number of IPs to reserve at start (default 1 for gateway)
   * @returns Next available IP with CIDR suffix
   */
  static getNextAvailableIP(
    networkCIDR: string,
    usedIPs: string[],
    reserveFirst: number = 1
  ): string {
    const [networkAddr, prefixStr] = networkCIDR.split('/')
    const prefix = parseInt(prefixStr, 10)

    if (prefix < 8 || prefix > 30) {
      throw new Error('Invalid CIDR prefix: must be between /8 and /30')
    }

    const network = Address4.fromAddress4(networkAddr)
    const networkInt = network.toArray().reduce((acc, octet) => acc * 256 + octet, 0)

    // Calculate network range
    const hostBits = 32 - prefix
    const totalHosts = Math.pow(2, hostBits)
    const usableHosts = totalHosts - 2 // Subtract network and broadcast

    // Normalize used IPs (remove CIDR suffix if present)
    const normalizedUsedIPs = new Set(
      usedIPs.map((ip) => ip.split('/')[0])
    )

    // Start from reserveFirst (skip network address and reserved IPs)
    for (let i = reserveFirst; i < usableHosts; i++) {
      const candidateInt = networkInt + i
      const candidate = Address4.fromInteger(candidateInt).address

      if (!normalizedUsedIPs.has(candidate)) {
        return `${candidate}/${prefix}`
      }
    }

    throw new Error(`No available IP addresses in ${networkCIDR}`)
  }

  /**
   * Check if an IP address is valid and within the network CIDR
   */
  static isIPInNetwork(ip: string, networkCIDR: string): boolean {
    try {
      const [ipAddr] = ip.split('/')
      const addr = Address4.fromAddress4(ipAddr)
      const [networkAddr, prefixStr] = networkCIDR.split('/')
      const network = Address4.fromAddress4(networkAddr)
      const prefix = parseInt(prefixStr, 10)

      const networkInt = network.toArray().reduce((acc, octet) => acc * 256 + octet, 0)
      const ipInt = addr.toArray().reduce((acc, octet) => acc * 256 + octet, 0)

      const hostBits = 32 - prefix
      const mask = (~0 << hostBits) >>> 0

      return (networkInt & mask) === (ipInt & mask)
    } catch {
      return false
    }
  }

  /**
   * Validate IP address format
   */
  static isValidIP(ip: string): boolean {
    try {
      const [ipAddr] = ip.split('/')
      Address4.fromAddress4(ipAddr)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get all allocated IPs from database records
   */
  static extractAllowedIPs(records: Array<{ allowedIPs: string[] | string }>): string[] {
    const ips: string[] = []
    for (const record of records) {
      const allowedIPs = typeof record.allowedIPs === 'string'
        ? JSON.parse(record.allowedIPs)
        : record.allowedIPs
      ips.push(...allowedIPs)
    }
    return ips
  }
}
