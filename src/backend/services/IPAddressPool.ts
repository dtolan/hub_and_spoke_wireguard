/**
 * IP Address allocation service for hub-and-spoke network
 */
export class IPAddressPool {
  /**
   * Convert IP address string to integer
   */
  private static ipToInt(ip: string): number {
    const octets = ip.split('.').map((s) => parseInt(s, 10))
    return octets.reduce((acc: number, octet: number) => acc * 256 + octet, 0)
  }

  /**
   * Convert integer to IP address string
   */
  private static intToIp(int: number): string {
    return [
      (int >>> 24) & 255,
      (int >>> 16) & 255,
      (int >>> 8) & 255,
      int & 255,
    ].join('.')
  }

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

    const networkInt = this.ipToInt(networkAddr)

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
      const candidate = this.intToIp(candidateInt)

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
      const [networkAddr, prefixStr] = networkCIDR.split('/')
      const prefix = parseInt(prefixStr, 10)

      const networkInt = this.ipToInt(networkAddr)
      const ipInt = this.ipToInt(ipAddr)

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
      const octets = ipAddr.split('.')
      if (octets.length !== 4) return false
      return octets.every((octet) => {
        const num = parseInt(octet, 10)
        return num >= 0 && num <= 255 && !isNaN(num)
      })
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
