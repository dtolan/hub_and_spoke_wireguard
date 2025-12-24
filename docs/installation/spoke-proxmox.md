# Proxmox VE Spoke Installation Guide

This guide covers installing WireGuard on Proxmox Virtual Environment (VE) servers, including both standalone nodes and clustered setups.

## Prerequisites

- **Proxmox VE**: Version 7.0 or higher
- **Root access**: SSH access to Proxmox host
- **Network connectivity**: Access to hub's public or private endpoint
- **Installation token**: Generated from hub dashboard (one per node in clustered setups)

See [prerequisites.md](prerequisites.md) for detailed requirements.

---

## Important: Clustered vs Standalone Proxmox

### Standalone Proxmox
- Single Proxmox host
- One installation token required
- Standard installation process

### Clustered Proxmox
- Multiple Proxmox hosts in a cluster
- **Each node needs its own installation token**
- Each node gets a unique VPN IP
- Each node appears separately in dashboard
- Run installation script individually on each node

**Example**: 3-node cluster requires:
1. Generate token for `pve1` → Install on `pve1`
2. Generate token for `pve2` → Install on `pve2`
3. Generate token for `pve3` → Install on `pve3`

---

## Quick Installation

### 1. Fix Repository Configuration (if needed)

Proxmox requires properly configured repositories to install packages. If you encounter "401 Unauthorized" errors, see [Fixing Repository Errors](#fixing-repository-errors-401-unauthorized) below.

---

### 2. Generate Installation Token

On the hub dashboard:
1. Navigate to "Installation Tokens"
2. Click "Generate Token"
3. Enter spoke name:
   - Standalone: `proxmox-01`
   - Clustered: Use node name like `pve1`, `pve2`, etc.
4. Select platform: "Proxmox"
5. Copy the installation command

**Example command**:
```bash
curl -sSL "http://192.168.1.15:5173/api/installation/script/abc123xyz?platform=proxmox" | bash
```

---

### 3. Run Installation Command

SSH to the Proxmox host and run the copied command:

```bash
curl -sSL "http://HUB_IP:5173/api/installation/script/YOUR_TOKEN?platform=proxmox" | bash
```

**What this script does**:
1. Detects Proxmox VE version
2. Detects cluster configuration (if any)
3. Installs WireGuard from Debian repositories
4. Generates local WireGuard keys
5. Registers with hub (includes cluster metadata)
6. Creates `/etc/wireguard/wg0.conf`
7. Starts WireGuard interface
8. Enables systemd service

---

### 4. Expected Output

#### Standalone Proxmox

```
===== Proxmox VE WireGuard Installation =====
Spoke: proxmox-01
Allocated IP: 10.0.1.10

Detecting best endpoint...
✓ Private endpoint reachable: 192.168.1.10:51820

✓ Detected Proxmox VE version: pve-manager/7.4-3/9002ab8a

Checking cluster configuration...
✓ Standalone Proxmox VE node detected
  Node Name: pve

Installing WireGuard...
✓ WireGuard installed

Generating WireGuard keys locally...
✓ Keys generated (public key will be sent to hub)

Registering Proxmox node with hub...
✓ Successfully registered Proxmox node with hub

Creating WireGuard configuration...
✓ Configuration created at /etc/wireguard/wg0.conf

Enabling WireGuard service...
✓ WireGuard enabled and started

===== WireGuard Status =====
interface: wg0
  public key: <your-public-key>
  private key: (hidden)
  listening port: 51820

peer: <hub-public-key>
  endpoint: 192.168.1.10:51820
  allowed ips: 10.0.1.0/24
  latest handshake: 1 second ago
  transfer: 0 B received, 92 B sent
  persistent keepalive: every 25 seconds

✓ Proxmox VE spoke configured successfully!

  Node: pve
  Cluster: Standalone
  VPN IP: 10.0.1.10
  Hub: 192.168.1.10:51820

Your Proxmox node is now connected to the hub.
Check the dashboard to verify the connection status.
```

---

#### Clustered Proxmox

```
===== Proxmox VE WireGuard Installation =====
Spoke: pve1
Allocated IP: 10.0.1.10

Detecting best endpoint...
✓ Private endpoint reachable: 192.168.1.10:51820

✓ Detected Proxmox VE version: pve-manager/7.4-3/9002ab8a

Checking cluster configuration...
✓ Clustered Proxmox VE detected
  Cluster Name: datacenter1
  This Node: pve1
  Cluster Members (3 nodes): pve1,pve2,pve3

  NOTE: Each node in the cluster should run this script individually.
        Each node will get a unique VPN IP and configuration.

Installing WireGuard...
✓ WireGuard installed

Generating WireGuard keys locally...
✓ Keys generated

Registering Proxmox node with hub...
✓ Successfully registered Proxmox node with hub

  IMPORTANT FOR CLUSTERED PROXMOX:
  - This node (pve1) is now registered
  - Each cluster member needs to run this script with a unique token
  - Generate a new token for each remaining node:
    - pve2 (needs installation)
    - pve3 (needs installation)

Creating WireGuard configuration...
✓ Configuration created at /etc/wireguard/wg0.conf

Enabling WireGuard service...
✓ WireGuard enabled and started

===== WireGuard Status =====
interface: wg0
  public key: <your-public-key>
  private key: (hidden)
  listening port: 51820

peer: <hub-public-key>
  endpoint: 192.168.1.10:51820
  allowed ips: 10.0.1.0/24
  latest handshake: 2 seconds ago

✓ Proxmox VE spoke configured successfully!

  Node: pve1
  Cluster: datacenter1 (3 nodes)
  VPN IP: 10.0.1.10
  Hub: 192.168.1.10:51820

───────────────────────────────────────────────────
  NEXT STEPS FOR CLUSTERED PROXMOX:
───────────────────────────────────────────────────

This cluster has 3 nodes. To complete the VPN setup:

1. Generate a new token for each remaining node in the dashboard
2. SSH to each node and run the installation script with its token
3. Each node will get a unique VPN IP and appear separately in the dashboard

Cluster members:
  ✓ pve1 (this node - COMPLETE)
  ○ pve2 (needs installation)
  ○ pve3 (needs installation)

Once all nodes are connected, they can communicate with each other
and the hub over the encrypted VPN tunnel.
```

---

## Fixing Repository Errors (401 Unauthorized)

If you get "401 Unauthorized" errors during installation, you need to configure the community repositories.

### Quick Fix

Run these commands on the Proxmox host **before** running the installation script:

```bash
# 1. Disable enterprise repositories
sed -i 's/^deb/#deb/' /etc/apt/sources.list.d/pve-enterprise.list
sed -i 's/^deb/#deb/' /etc/apt/sources.list.d/ceph.list 2>/dev/null || true

# 2. Add community repositories (if not already present)
echo "deb http://download.proxmox.com/debian/pve bookworm pve-no-subscription" > /etc/apt/sources.list.d/pve-no-subscription.list

# 3. Update package lists
apt-get update

# 4. Now run the WireGuard installation script
curl -sSL "http://192.168.1.15:5173/api/installation/script/YOUR_TOKEN?platform=proxmox" | bash
```

### What This Does

- **Disables enterprise repos**: Comments out subscription-only repositories
- **Enables community repos**: Adds free, no-subscription Proxmox repository
- **Updates package lists**: Refreshes apt so it can find packages

### Manual Steps (Alternative)

1. **Edit enterprise repository file**:
   ```bash
   nano /etc/apt/sources.list.d/pve-enterprise.list
   ```

2. **Comment out the line** by adding `#` at the beginning:
   ```
   #deb https://enterprise.proxmox.com/debian/pve bookworm pve-enterprise
   ```

3. **Do the same for Ceph** (if present):
   ```bash
   nano /etc/apt/sources.list.d/ceph.list
   ```
   Comment out:
   ```
   #deb https://enterprise.proxmox.com/debian/ceph-quincy bookworm enterprise
   ```

4. **Add community repository**:
   ```bash
   echo "deb http://download.proxmox.com/debian/pve bookworm pve-no-subscription" > /etc/apt/sources.list.d/pve-no-subscription.list
   ```

5. **Update and try again**:
   ```bash
   apt-get update
   ```

### Proxmox Version-Specific Repository URLs

**Proxmox 8.x (Bookworm)**:
```bash
deb http://download.proxmox.com/debian/pve bookworm pve-no-subscription
```

**Proxmox 7.x (Bullseye)**:
```bash
deb http://download.proxmox.com/debian/pve bullseye pve-no-subscription
```

**Proxmox 6.x (Buster)**:
```bash
deb http://download.proxmox.com/debian/pve buster pve-no-subscription
```

### Reference

- Proxmox Wiki: https://pve.proxmox.com/wiki/Package_Repositories
- Community Forum: https://forum.proxmox.com/

---

## Manual Installation

If you prefer manual installation:

### 1. Fix Repositories (if needed)

See [Fixing Repository Errors](#fixing-repository-errors-401-unauthorized) above.

---

### 2. Install WireGuard

```bash
# Update package lists
apt-get update

# Install WireGuard
apt-get install -y wireguard wireguard-tools resolvconf
```

**Verify installation**:
```bash
wg --version
pveversion
```

---

### 3. Generate WireGuard Keys

```bash
# Generate private key
wg genkey | tee /etc/wireguard/private.key
chmod 600 /etc/wireguard/private.key

# Generate public key
cat /etc/wireguard/private.key | wg pubkey | tee /etc/wireguard/public.key
```

---

### 4. Register with Hub

```bash
TOKEN="your-installation-token"
HUB_API="http://192.168.1.15:3000"
PUBLIC_KEY=$(cat /etc/wireguard/public.key)
NODE_NAME=$(hostname)
PVE_VERSION=$(pveversion | head -n1 | awk '{print $2}')

# Check if clustered
if pvecm status &>/dev/null; then
  CLUSTER_NAME=$(pvecm status | grep "Name:" | awk '{print $2}')
  IS_CLUSTERED="true"
else
  CLUSTER_NAME=""
  IS_CLUSTERED="false"
fi

# Register
curl -X POST "$HUB_API/api/installation/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"token\": \"$TOKEN\",
    \"publicKey\": \"$PUBLIC_KEY\",
    \"os\": \"proxmox\",
    \"isProxmox\": true,
    \"proxmoxNodeName\": \"$NODE_NAME\",
    \"proxmoxClusterName\": \"$CLUSTER_NAME\",
    \"proxmoxVersion\": \"$PVE_VERSION\"
  }"
```

---

### 5. Create WireGuard Configuration

```bash
cat > /etc/wireguard/wg0.conf <<EOF
[Interface]
Address = <your-allocated-ip>/24
PrivateKey = $(cat /etc/wireguard/private.key)
DNS = 1.1.1.1, 1.0.0.1

# Proxmox-specific notes:
# - This WireGuard interface is separate from Proxmox bridge interfaces (vmbr*)
# - To allow VMs to use the VPN, uncomment the PostUp/PostDown rules below

# Optional: Allow VMs to route through VPN (uncomment to enable)
# PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o wg0 -j MASQUERADE
# PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o wg0 -j MASQUERADE

[Peer]
# Hub
PublicKey = <hub-public-key>
Endpoint = <hub-endpoint>
AllowedIPs = 10.0.1.0/24
PersistentKeepalive = 25
EOF

chmod 600 /etc/wireguard/wg0.conf
```

---

### 6. Start WireGuard

```bash
systemctl enable wg-quick@wg0
systemctl start wg-quick@wg0
systemctl status wg-quick@wg0
```

---

## Verification

### 1. Check WireGuard Status

```bash
wg show wg0
```

**Expected output**:
```
interface: wg0
  public key: <your-public-key>
  private key: (hidden)
  listening port: 51820

peer: <hub-public-key>
  endpoint: 192.168.1.10:51820
  allowed ips: 10.0.1.0/24
  latest handshake: 5 seconds ago
  transfer: 1.23 KiB received, 892 B sent
```

---

### 2. Check Interface

```bash
ip addr show wg0
```

**Expected output**:
```
5: wg0: <POINTOPOINT,NOARP,UP,LOWER_UP> mtu 1420 qdisc noqueue state UNKNOWN group default qlen 1000
    link/none
    inet 10.0.1.10/24 scope global wg0
       valid_lft forever preferred_lft forever
```

---

### 3. Test Connectivity

```bash
# Ping hub
ping -c 3 10.0.1.1

# Ping other cluster nodes (if clustered)
ping -c 3 10.0.1.11  # pve2
ping -c 3 10.0.1.12  # pve3
```

---

### 4. Verify Cluster Detection (if clustered)

```bash
# Show cluster status
pvecm status

# Show cluster nodes
pvecm nodes
```

---

## Proxmox-Specific Configuration

### Allow VMs to Use VPN

To allow VMs/containers to route through the VPN, uncomment the PostUp/PostDown rules in `/etc/wireguard/wg0.conf`:

```bash
nano /etc/wireguard/wg0.conf
```

Uncomment these lines:
```
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o wg0 -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o wg0 -j MASQUERADE
```

Restart WireGuard:
```bash
systemctl restart wg-quick@wg0
```

---

### VM Network Configuration

The WireGuard interface (`wg0`) is separate from Proxmox bridge interfaces (`vmbr0`, `vmbr1`, etc.).

**To access VPN from VMs**:
1. Enable PostUp/PostDown rules (see above)
2. Configure VM to use Proxmox host as gateway
3. OR bridge VPN subnet to VM network (advanced)

---

### Cluster Communication Over VPN

For Proxmox cluster communication over VPN:

1. **Ensure all cluster nodes are connected to VPN**
2. **Update AllowedIPs** to include cluster nodes:
   ```bash
   nano /etc/wireguard/wg0.conf
   ```
   ```
   AllowedIPs = 10.0.1.0/24
   ```

3. **Test cluster communication**:
   ```bash
   # From pve1
   ping 10.0.1.11  # pve2
   ping 10.0.1.12  # pve3
   ```

---

## Clustered Proxmox Setup Workflow

### Complete 3-Node Cluster Example

**Cluster**: `datacenter1` with nodes `pve1`, `pve2`, `pve3`

#### Step 1: Install on pve1

```bash
# On hub dashboard: Generate token for "pve1"
# On pve1:
curl -sSL "http://192.168.1.15:5173/api/installation/script/TOKEN1?platform=proxmox" | bash
```

**Result**: `pve1` gets VPN IP `10.0.1.10`

---

#### Step 2: Install on pve2

```bash
# On hub dashboard: Generate NEW token for "pve2"
# On pve2:
curl -sSL "http://192.168.1.15:5173/api/installation/script/TOKEN2?platform=proxmox" | bash
```

**Result**: `pve2` gets VPN IP `10.0.1.11`

---

#### Step 3: Install on pve3

```bash
# On hub dashboard: Generate NEW token for "pve3"
# On pve3:
curl -sSL "http://192.168.1.15:5173/api/installation/script/TOKEN3?platform=proxmox" | bash
```

**Result**: `pve3` gets VPN IP `10.0.1.12`

---

#### Step 4: Verify Cluster Connectivity

On any node:
```bash
# Ping all cluster nodes via VPN
ping -c 3 10.0.1.10  # pve1
ping -c 3 10.0.1.11  # pve2
ping -c 3 10.0.1.12  # pve3

# Ping hub
ping -c 3 10.0.1.1
```

---

#### Dashboard View

```
Spoke: pve1 (datacenter1)
  Node: pve1 | Cluster: datacenter1 | VPN IP: 10.0.1.10 | Status: Active

Spoke: pve2 (datacenter1)
  Node: pve2 | Cluster: datacenter1 | VPN IP: 10.0.1.11 | Status: Active

Spoke: pve3 (datacenter1)
  Node: pve3 | Cluster: datacenter1 | VPN IP: 10.0.1.12 | Status: Active
```

---

## Troubleshooting

### Repository 401 Errors

See [Fixing Repository Errors](#fixing-repository-errors-401-unauthorized) section above.

---

### WireGuard Package Not Found

**Error**:
```
E: Unable to locate package wireguard
```

**Fix**: Update Proxmox version or add backports:

**Proxmox 6.x**:
```bash
echo "deb http://deb.debian.org/debian buster-backports main" >> /etc/apt/sources.list
apt-get update
apt-get install -y -t buster-backports wireguard
```

---

### Cluster Node Already Registered

**Error**:
```
Error: This server has already registered with this group token
```

**Cause**: Attempted to reuse token on same node

**Fix**:
1. Delete existing spoke from dashboard
2. Generate new token
3. Run installation again

---

### Cluster Not Detected

If cluster exists but script shows "Standalone":

```bash
# Check cluster status
pvecm status

# Verify cluster files
ls -la /etc/pve/
ls -la /etc/corosync/

# Check cluster service
systemctl status pve-cluster
```

**Fix**: Ensure node is properly joined to cluster before running installation.

---

### No Handshake Between Cluster Nodes

**Check**:
1. Verify all nodes have WireGuard running:
   ```bash
   systemctl status wg-quick@wg0
   ```

2. Verify AllowedIPs includes full subnet:
   ```bash
   wg show wg0 | grep "allowed ips"
   ```

3. Test hub connectivity from each node:
   ```bash
   ping 10.0.1.1
   ```

---

## Uninstallation

### 1. Stop WireGuard

```bash
systemctl stop wg-quick@wg0
systemctl disable wg-quick@wg0
```

---

### 2. Remove Configuration

```bash
rm /etc/wireguard/wg0.conf
rm /etc/wireguard/private.key
rm /etc/wireguard/public.key
```

---

### 3. Remove WireGuard (optional)

```bash
apt-get remove --purge wireguard wireguard-tools
```

---

### 4. Remove from Dashboard

Delete the spoke from the hub dashboard.

---

## Useful Commands

```bash
# Show WireGuard status
wg show wg0

# Show Proxmox version
pveversion

# Show cluster status
pvecm status

# Show cluster nodes
pvecm nodes

# View WireGuard logs
journalctl -u wg-quick@wg0 -f

# Restart WireGuard
systemctl restart wg-quick@wg0

# Test VPN connectivity
ping 10.0.1.1  # Hub
mtr 10.0.1.1   # Path analysis

# Show routing table
ip route show dev wg0
```

---

## Next Steps

- Monitor connections in [dashboard](../README.md#dashboard)
- Configure [VM network access](#allow-vms-to-use-vpn)
- Set up [cluster communication over VPN](#cluster-communication-over-vpn)
- See [troubleshooting guide](troubleshooting.md) for more issues

---

## Related Documentation

- [Hub Setup Guide](hub-setup.md)
- [Linux Spoke Installation](spoke-linux.md)
- [Prerequisites](prerequisites.md)
- [Troubleshooting](troubleshooting.md)
