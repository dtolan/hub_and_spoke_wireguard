# Hub Setup Guide

This guide walks through setting up the WireGuard hub server that will act as the central point for all spoke connections.

## Prerequisites

Before installing the hub, ensure you have:

- **Linux server** (Ubuntu 20.04+, Debian 11+, or similar)
- **Root access** (sudo privileges)
- **Public IP or domain name** for external spokes
- **Open firewall ports**:
  - `51820/udp` - WireGuard (default, configurable)
  - `3000/tcp` - Backend API
  - `5173/tcp` - Frontend (development) or `80/443` (production)
- **Minimum system requirements**:
  - 1 CPU core
  - 512 MB RAM
  - 10 GB disk space

See [prerequisites.md](prerequisites.md) for detailed platform requirements.

---

## Installation Steps

### 1. Install System Dependencies

#### Ubuntu/Debian

```bash
# Update package lists
sudo apt-get update

# Install WireGuard
sudo apt-get install -y wireguard wireguard-tools

# Install Node.js (v18 or higher)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installations
wg --version
node --version
npm --version
```

#### RHEL/CentOS/Rocky Linux

```bash
# Install EPEL repository
sudo dnf install -y epel-release

# Install WireGuard
sudo dnf install -y wireguard-tools

# Install Node.js
sudo dnf module install -y nodejs:18

# Verify installations
wg --version
node --version
```

---

### 2. Clone and Build the Application

```bash
# Clone the repository
git clone https://github.com/yourusername/hub_and_spoke_wireguard.git
cd hub_and_spoke_wireguard

# Install dependencies
npm install

# Build the application
npm run build
```

---

### 3. Configure the Hub

Create a configuration file at `config/hub.json`:

```json
{
  "networkCIDR": "10.0.1.0/24",
  "listenPort": 51820,
  "publicEndpoint": "vpn.example.com:51820",
  "privateEndpoint": "192.168.1.10:51820",
  "dns": ["1.1.1.1", "1.0.0.1"]
}
```

**Configuration options**:

- **networkCIDR**: VPN subnet (e.g., `10.0.1.0/24` supports 254 hosts)
- **listenPort**: WireGuard UDP port (default: `51820`)
- **publicEndpoint**: Public IP/domain for external spokes
  - Use your public IP: `203.0.113.5:51820`
  - OR domain name: `vpn.example.com:51820`
- **privateEndpoint** (optional): Private IP for internal spokes
  - Example: `192.168.1.10:51820`
  - Spokes will auto-detect and prefer this if reachable
- **dns**: DNS servers for spokes (optional)

---

### 4. Initialize the Hub

Run the initialization command:

```bash
sudo npm run hub:init
```

**What this does**:
1. Generates WireGuard key pair
2. Creates `/etc/wireguard/wg0.conf`
3. Starts WireGuard interface
4. Enables systemd service
5. Initializes SQLite database
6. Stores hub configuration

**Expected output**:

```
===== Hub Initialization =====

Generating WireGuard keys...
✓ Keys generated

Creating WireGuard configuration...
✓ Configuration created at /etc/wireguard/wg0.conf

Starting WireGuard interface...
✓ WireGuard interface wg0 started

Initializing database...
✓ Database initialized

Hub configuration:
  Network CIDR: 10.0.1.0/24
  Hub IP: 10.0.1.1/24
  Listen Port: 51820
  Public Endpoint: vpn.example.com:51820
  Private Endpoint: 192.168.1.10:51820
  Public Key: <base64-key>

✓ Hub initialization complete!
```

---

### 5. Verify WireGuard Status

Check that WireGuard is running:

```bash
# Show interface status
sudo wg show wg0

# Check systemd service
sudo systemctl status wg-quick@wg0

# View configuration
sudo cat /etc/wireguard/wg0.conf
```

**Expected `wg show wg0` output**:

```
interface: wg0
  public key: <hub-public-key>
  private key: (hidden)
  listening port: 51820
```

---

### 6. Configure Firewall

#### UFW (Ubuntu/Debian)

```bash
# Allow WireGuard
sudo ufw allow 51820/udp

# Allow API access
sudo ufw allow 3000/tcp
sudo ufw allow 5173/tcp

# Enable IP forwarding
sudo ufw route allow in on wg0 out on eth0
sudo ufw reload
```

#### firewalld (RHEL/CentOS)

```bash
# Allow WireGuard
sudo firewall-cmd --permanent --add-port=51820/udp

# Allow API access
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=5173/tcp

# Enable masquerading
sudo firewall-cmd --permanent --add-masquerade

# Reload
sudo firewall-cmd --reload
```

#### iptables (Manual)

```bash
# Allow WireGuard
sudo iptables -A INPUT -p udp --dport 51820 -j ACCEPT

# Allow API
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 5173 -j ACCEPT

# Enable forwarding
sudo iptables -A FORWARD -i wg0 -j ACCEPT
sudo iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE

# Save rules
sudo iptables-save | sudo tee /etc/iptables/rules.v4
```

---

### 7. Enable IP Forwarding

**Temporary** (until reboot):

```bash
sudo sysctl -w net.ipv4.ip_forward=1
```

**Permanent**:

```bash
echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

**Verify**:

```bash
sysctl net.ipv4.ip_forward
# Should output: net.ipv4.ip_forward = 1
```

---

### 8. Start the Backend

```bash
# Development mode
npm run dev:backend

# Production mode (with PM2)
npm install -g pm2
pm2 start dist/backend/index.js --name wireguard-hub
pm2 save
pm2 startup
```

**Verify backend is running**:

```bash
curl http://localhost:3000/api/health
# Expected: {"status":"ok","wireguard":"active"}
```

---

### 9. Start the Frontend

#### Development Mode

```bash
npm run dev:frontend
```

Access at: `http://<server-ip>:5173`

#### Production Mode

```bash
# Build frontend
npm run build:frontend

# Serve with nginx
sudo apt-get install -y nginx

# Create nginx config
sudo tee /etc/nginx/sites-available/wireguard-hub <<'EOF'
server {
    listen 80;
    server_name vpn.example.com;

    root /path/to/hub_and_spoke_wireguard/dist/frontend;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/wireguard-hub /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

### 10. Verify Hub Setup

1. **Check WireGuard interface**:
   ```bash
   ip addr show wg0
   # Should show: 10.0.1.1/24
   ```

2. **Ping hub from itself**:
   ```bash
   ping -c 3 10.0.1.1
   ```

3. **Access dashboard**:
   - Development: `http://<server-ip>:5173`
   - Production: `http://vpn.example.com`

4. **Check API health**:
   ```bash
   curl http://localhost:3000/api/health
   ```

---

## Post-Installation

### Generate First Installation Token

1. Open the dashboard
2. Navigate to "Installation Tokens"
3. Click "Generate Token"
4. Enter spoke name (e.g., "web-server-01")
5. Copy the installation command
6. Run on spoke server

See platform-specific spoke guides:
- [Linux Spoke Installation](spoke-linux.md)
- [Proxmox Spoke Installation](spoke-proxmox.md)
- [Windows Spoke Installation](spoke-windows.md)
- [macOS Spoke Installation](spoke-macos.md)

---

## Troubleshooting

### WireGuard interface won't start

```bash
# Check for errors
sudo journalctl -u wg-quick@wg0 -n 50

# Verify configuration syntax
sudo wg-quick strip wg0

# Check for port conflicts
sudo netstat -tulpn | grep 51820
```

### Can't access dashboard

```bash
# Check backend logs
pm2 logs wireguard-hub

# Verify backend is listening
sudo netstat -tulpn | grep 3000

# Check firewall
sudo ufw status
```

### Database errors

```bash
# Check database file exists
ls -l data/hub.db

# Check permissions
sudo chmod 644 data/hub.db
sudo chown $(whoami) data/hub.db
```

For more troubleshooting, see [troubleshooting.md](troubleshooting.md).

---

## Security Recommendations

1. **Use HTTPS**: Set up SSL/TLS with Let's Encrypt
   ```bash
   sudo apt-get install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d vpn.example.com
   ```

2. **Restrict API access**: Use firewall to limit API access to trusted IPs

3. **Regular updates**: Keep WireGuard and system packages updated
   ```bash
   sudo apt-get update && sudo apt-get upgrade
   ```

4. **Monitor logs**: Set up log monitoring for suspicious activity
   ```bash
   sudo journalctl -u wg-quick@wg0 -f
   ```

5. **Backup configuration**: Regularly backup `/etc/wireguard/` and `data/hub.db`

---

## Next Steps

- [Generate installation tokens](../README.md#installation-tokens)
- [Install spokes](spoke-linux.md)
- [Monitor connections](../README.md#monitoring)
- [Configure firewall rules](../README.md#firewall-configuration)
