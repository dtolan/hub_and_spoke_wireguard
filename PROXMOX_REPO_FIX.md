# Proxmox Repository Fix

If you get "401 Unauthorized" errors when running the WireGuard installation on Proxmox, you need to configure the community repositories.

## Quick Fix (Run on Proxmox host):

```bash
# 1. Disable enterprise repositories
sed -i 's/^deb/#deb/' /etc/apt/sources.list.d/pve-enterprise.list
sed -i 's/^deb/#deb/' /etc/apt/sources.list.d/ceph.list

# 2. Add community repositories (if not already present)
echo "deb http://download.proxmox.com/debian/pve trixie pve-no-subscription" > /etc/apt/sources.list.d/pve-no-subscription.list

# 3. Update package lists
apt-get update

# 4. Now re-run the WireGuard installation script
curl -sSL "http://192.168.1.15:5173/api/installation/script/YOUR_TOKEN?platform=proxmox" | bash
```

## What This Does

- **Disables enterprise repos**: Comments out the subscription-only repositories
- **Enables community repos**: Adds the free, no-subscription Proxmox repository
- **Updates package lists**: Refreshes apt so it can find packages

## Alternative: Manual Steps

1. Edit enterprise repository file:
   ```bash
   nano /etc/apt/sources.list.d/pve-enterprise.list
   ```

2. Comment out the line by adding `#` at the beginning:
   ```
   #deb https://enterprise.proxmox.com/debian/pve trixie pve-enterprise
   ```

3. Do the same for Ceph (if present):
   ```bash
   nano /etc/apt/sources.list.d/ceph.list
   ```

4. Add community repository:
   ```bash
   echo "deb http://download.proxmox.com/debian/pve trixie pve-no-subscription" > /etc/apt/sources.list.d/pve-no-subscription.list
   ```

5. Update and try again:
   ```bash
   apt-get update
   ```

## Reference

- Proxmox Wiki: https://pve.proxmox.com/wiki/Package_Repositories
- Community Forum: https://forum.proxmox.com/
