# Hub-and-Spoke WireGuard VPN - Deployment Guide

Complete guide for deploying the Hub-and-Spoke WireGuard VPN management system on Ubuntu.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Hub Server Setup](#hub-server-setup)
3. [Installation Steps](#installation-steps)
4. [Configuration](#configuration)
5. [Starting the Services](#starting-the-services)
6. [First-Time Hub Initialization](#first-time-hub-initialization)
7. [Adding Spokes](#adding-spokes)
8. [Troubleshooting](#troubleshooting)
9. [Production Deployment](#production-deployment)

---

## Prerequisites

### System Requirements

- **Operating System**: Ubuntu 22.04 LTS (recommended) or Ubuntu 20.04 LTS
- **RAM**: Minimum 2GB, 4GB recommended
- **Disk Space**: 10GB minimum
- **Network**: Public IPv4 address with open UDP port (default: 51820)

### Software Requirements

- Node.js 18+ and npm
- WireGuard kernel module (installed automatically)
- Git

### Network Requirements

- **Public IP address** or **domain name** pointing to the hub server
- **UDP port 51820** (or custom port) open in firewall for WireGuard
- **TCP port 3000** (backend API) - can be proxied behind Nginx/Caddy
- **TCP port 5173** (frontend dev server) OR serve built static files

---

## Hub Server Setup

### 1. Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Install Node.js 18+

```bash
# Install Node.js 20.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should be v20.x.x
npm --version   # Should be 10.x.x
```

### 3. Install WireGuard

```bash
sudo apt install -y wireguard wireguard-tools
```

### 4. Install Git

```bash
sudo apt install -y git
```

### 5. Configure Firewall

```bash
# Allow SSH (if using UFW)
sudo ufw allow OpenSSH

# Allow WireGuard UDP port
sudo ufw allow 51820/udp

# Allow backend API (if accessing directly - optional)
sudo ufw allow 3000/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### 6. Enable IP Forwarding (for VPN routing)

```bash
# Enable now
sudo sysctl -w net.ipv4.ip_forward=1

# Make permanent
echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

---

## Installation Steps

### 1. Clone Repository

```bash
# Create application directory
sudo mkdir -p /opt/wireguard-hub
sudo chown $USER:$USER /opt/wireguard-hub
cd /opt/wireguard-hub

# Clone repository
git clone https://github.com/dtolan/hub_and_spoke_wireguard.git .
```

### 2. Install Dependencies

```bash
# Install Node.js dependencies
npm install
```

### 3. Build Frontend

```bash
# Build production frontend
npm run build
```

### 4. Build Backend

```bash
# Compile TypeScript backend
npm run build:backend
```

---

## Configuration

### 1. Create Environment File

```bash
cat > .env <<EOF
# Environment
NODE_ENV=production

# Server
PORT=3000

# Database
DATABASE_PATH=/var/lib/wireguard-hub/database.sqlite

# API URL (change to your domain or IP)
VITE_API_BASE_URL=http://localhost:3000

# CORS (change to your frontend URL)
CORS_ORIGIN=*

# Security
TOKEN_EXPIRATION_HOURS=24
RATE_LIMIT_MAX_TOKENS_PER_HOUR=10
EOF
```

**Important**: Update `VITE_API_BASE_URL` with your server's public URL (e.g., `https://vpn.example.com`).

### 2. Create Database Directory

```bash
sudo mkdir -p /var/lib/wireguard-hub
sudo chown $USER:$USER /var/lib/wireguard-hub
```

### 3. Initialize Database

```bash
npm run db:migrate
```

---

## Starting the Services

### Development Mode (Testing)

```bash
# Start backend only
npm run dev:backend

# OR start both frontend and backend
npm run dev:all
```

Access the dashboard at: `http://your-server-ip:5173`

### Production Mode

#### Option 1: Using PM2 (Recommended)

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start backend with PM2
pm2 start dist/backend/server.js --name wireguard-hub

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the instructions from the command output

# Check status
pm2 status
pm2 logs wireguard-hub
```

#### Option 2: Using systemd

Create systemd service file:

```bash
sudo nano /etc/systemd/system/wireguard-hub.service
```

```ini
[Unit]
Description=WireGuard Hub-and-Spoke Management API
After=network.target

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/opt/wireguard-hub
Environment=NODE_ENV=production
ExecStart=/usr/bin/node /opt/wireguard-hub/dist/backend/server.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Replace `YOUR_USERNAME` with your actual username, then:

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable and start service
sudo systemctl enable wireguard-hub
sudo systemctl start wireguard-hub

# Check status
sudo systemctl status wireguard-hub

# View logs
sudo journalctl -u wireguard-hub -f
```

---

## First-Time Hub Initialization

### 1. Access the Dashboard

Open your browser and navigate to:
- Development: `http://your-server-ip:5173`
- Production (with Nginx): `https://your-domain.com`

### 2. Complete Hub Initialization Wizard

You'll see the initialization wizard. Fill in:

- **Network CIDR**: `10.0.1.0/24` (or your preferred private network)
- **Listen Port**: `51820` (default WireGuard port)
- **Public Endpoint**: `your-public-ip:51820` or `vpn.example.com:51820`
- **DNS Servers**: `1.1.1.1, 8.8.8.8` (optional)

Click **"Initialize Hub"**.

### 3. Verify Hub is Running

```bash
# Check WireGuard interface
sudo wg show wg0

# Should show:
# interface: wg0
#   public key: <your-hub-public-key>
#   private key: (hidden)
#   listening port: 51820
```

---

## Adding Spokes

### 1. Generate Installation Token

1. Go to the **"Tokens"** tab in the dashboard
2. Enter a spoke name (e.g., `laptop-001`, `server-prod`, `pve-node1`)
3. Click **"Generate Token"**
4. Copy the installation command for your platform

### 2. Run Installation on Spoke

#### Linux/macOS

```bash
curl -sSL "https://your-hub-ip:3000/api/installation/script/TOKEN?platform=linux" | sudo bash
```

#### Windows (PowerShell as Administrator)

```powershell
Invoke-WebRequest -Uri "https://your-hub-ip:3000/api/installation/script/TOKEN?platform=windows" -UseBasicParsing | Invoke-Expression
```

#### Proxmox VE

```bash
curl -sSL "https://your-hub-ip:3000/api/installation/script/TOKEN?platform=proxmox" | bash
```

**For Proxmox Clusters**: Generate a unique token for EACH node in the cluster.

### 3. Verify Connection

The spoke should appear in the dashboard within seconds with status "Active".

```bash
# On hub, check connected peers
sudo wg show wg0
```

---

## Troubleshooting

### Hub Not Starting

```bash
# Check if port 3000 is in use
sudo lsof -i :3000

# Check backend logs
pm2 logs wireguard-hub
# OR
sudo journalctl -u wireguard-hub -n 50
```

### WireGuard Interface Not Created

```bash
# Check if WireGuard is installed
wg --version

# Manually check configuration
sudo cat /etc/wireguard/wg0.conf

# Try manually starting
sudo wg-quick up wg0

# Check for errors
sudo systemctl status wg-quick@wg0
```

### Spoke Can't Connect

1. **Verify firewall rules**:
   ```bash
   sudo ufw status
   # Ensure UDP 51820 is allowed
   ```

2. **Check if hub is listening**:
   ```bash
   sudo ss -ulpn | grep 51820
   ```

3. **Verify endpoint is correct**:
   - Make sure the endpoint in hub config matches your public IP/domain
   - Test connectivity: `nc -zvu your-hub-ip 51820`

4. **Check spoke logs** (on spoke machine):
   ```bash
   # Linux
   sudo journalctl -u wg-quick@wg0 -f

   # Check WireGuard status
   sudo wg show wg0
   ```

### Database Issues

```bash
# Check database file exists
ls -lh /var/lib/wireguard-hub/database.sqlite

# Check permissions
sudo chown $USER:$USER /var/lib/wireguard-hub/database.sqlite

# Re-run migrations
npm run db:migrate
```

### API Returning Errors

```bash
# Test API health
curl http://localhost:3000/health

# Should return: {"status":"ok","timestamp":"...","uptime":...}
```

---

## Production Deployment

### Using Nginx as Reverse Proxy

#### 1. Install Nginx

```bash
sudo apt install -y nginx
```

#### 2. Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/wireguard-hub
```

```nginx
server {
    listen 80;
    server_name vpn.example.com;  # Change to your domain

    # Frontend - serve built static files
    root /opt/wireguard-hub/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### 3. Enable Site and Restart Nginx

```bash
sudo ln -s /etc/nginx/sites-available/wireguard-hub /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 4. Setup HTTPS with Let's Encrypt

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d vpn.example.com

# Auto-renewal is configured automatically
```

### Update Environment for Production

Update `.env`:

```bash
VITE_API_BASE_URL=https://vpn.example.com
CORS_ORIGIN=https://vpn.example.com
NODE_ENV=production
```

Rebuild frontend:

```bash
npm run build
```

Restart backend:

```bash
pm2 restart wireguard-hub
```

---

## Security Best Practices

1. **Use HTTPS**: Always use TLS/SSL in production (Let's Encrypt)
2. **Firewall**: Only open necessary ports (51820/udp, 80/tcp, 443/tcp)
3. **Backup Hub Keys**: Backup `/etc/wireguard/wg0.conf` securely
4. **Regular Updates**: Keep system and dependencies updated
5. **Monitor Logs**: Set up log monitoring and alerts
6. **Database Backups**: Regularly backup SQLite database

```bash
# Backup script example
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
sudo cp /etc/wireguard/wg0.conf /root/backups/wg0.conf.$DATE
cp /var/lib/wireguard-hub/database.sqlite /root/backups/database.sqlite.$DATE
```

---

## Next Steps

1. Initialize the hub via web dashboard
2. Generate tokens and install spokes
3. Monitor spoke connections
4. Set up automated backups
5. Configure monitoring (Prometheus/Grafana - optional)

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/dtolan/hub_and_spoke_wireguard/issues
- Check logs: `pm2 logs wireguard-hub` or `sudo journalctl -u wireguard-hub`

---

**Deployment Version**: 1.0
**Last Updated**: December 2024
**Tested On**: Ubuntu 22.04 LTS
