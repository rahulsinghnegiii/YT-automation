# 🚀 AI Music Uploader - Hetzner Cloud Deployment Guide

## 🌐 Overview

This guide will walk you through deploying the AI Music Uploader on a Hetzner Cloud server using Docker. We'll set up a production-ready environment with HTTPS, auto-restart capabilities, and proper security measures.

## 📋 Prerequisites

### Hetzner Cloud Account
- Active Hetzner Cloud account
- API token (optional, for automated server management)
- Domain name configured (optional, for HTTPS)

### Local Requirements
- SSH client
- Basic command-line knowledge
- Your project files ready for deployment

## 🏗️ Server Setup

### 1. Create a Hetzner Cloud Server

1. **Login to Hetzner Cloud Console**: https://console.hetzner.cloud/
2. **Create a new project** or select an existing one
3. **Create a new server** with the following specifications:

#### Recommended Server Configuration
```
Server Type: CPX21 or better
- 3 vCPUs
- 4 GB RAM  
- 80 GB SSD
- 20 TB traffic

Image: Ubuntu 22.04 LTS
Location: Choose nearest to your users
Networking: IPv4 + IPv6
Additional Features:
- Backups (recommended)
- Monitoring (optional)
```

#### Minimum Server Configuration (for testing)
```
Server Type: CX11
- 1 vCPU
- 2 GB RAM
- 20 GB SSD
- 20 TB traffic
```

4. **SSH Key Setup**: Add your SSH public key during server creation
5. **Create the server** and note the IP address

### 2. Initial Server Configuration

SSH into your server:
```bash
ssh root@YOUR_SERVER_IP
```

#### Update the system
```bash
apt update && apt upgrade -y
```

#### Install required packages
```bash
apt install -y \
  apt-transport-https \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  ufw \
  fail2ban \
  htop \
  nginx \
  certbot \
  python3-certbot-nginx
```

#### Create a non-root user (recommended)
```bash
# Create user
useradd -m -s /bin/bash deploy
usermod -aG sudo deploy

# Set up SSH for new user
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

#### Configure firewall
```bash
# Set up UFW firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https
ufw --force enable
```

#### Configure fail2ban (security)
```bash
systemctl enable fail2ban
systemctl start fail2ban
```

## 🐳 Docker Installation

### Install Docker Engine
```bash
# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Set up stable repository
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

### Install Docker Compose (standalone)
```bash
# Download and install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker compose version
```

### Configure Docker
```bash
# Start and enable Docker
systemctl start docker
systemctl enable docker

# Add deploy user to docker group
usermod -aG docker deploy

# Test Docker (optional)
docker run hello-world
```

## 📦 Application Deployment

### 1. Upload Project Files

From your local machine, upload the project to the server:

#### Option A: Using Git (Recommended)
```bash
# On the server, switch to deploy user
su - deploy

# Clone your repository
git clone <your-repository-url> ai-music-uploader
cd ai-music-uploader
```

#### Option B: Using SCP
```bash
# From your local machine
scp -r /path/to/NEO-3 deploy@YOUR_SERVER_IP:/home/deploy/ai-music-uploader
```

### 2. Environment Configuration

Create production environment file:
```bash
# On the server, in the project directory
cd /home/deploy/ai-music-uploader
cp .env.example .env
```

Edit the `.env` file with production settings:
```bash
nano .env
```

#### Production Environment Variables
```bash
# Server Configuration
NODE_ENV=production
PORT=3000

# Admin Credentials (Change these!)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_very_secure_production_password

# Database
DB_TYPE=sqlite
DB_STORAGE=data/music_uploader.db

# JWT Security (Generate a strong secret!)
JWT_SECRET=your_very_secure_jwt_secret_key_minimum_32_characters_long
JWT_EXPIRES_IN=7d

# Required API Keys
OPENAI_API_KEY=sk-proj-your-production-openai-key
YOUTUBE_CLIENT_ID_1=your-youtube-client-id.apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET_1=your-youtube-client-secret
YOUTUBE_REDIRECT_URI_1=https://yourdomain.com/auth/youtube/callback

# Optional Services
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-email-app-password

# Production Optimizations
LOG_LEVEL=warn
MAX_CONCURRENT_UPLOADS=2
MAX_CONCURRENT_PROCESSING=3
MAX_CONCURRENT_DOWNLOADS=5
```

### 3. Create Production Docker Compose

Create a production `docker-compose.prod.yml`:
```bash
nano docker-compose.prod.yml
```

```yaml
version: '3.8'

services:
  app:
    build: .
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
      - ./uploads:/app/uploads
      - ./downloads:/app/downloads
      - ./processed:/app/processed
      - ./credentials:/app/credentials
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

volumes:
  app_data:
  app_logs:
  app_uploads:
  app_downloads:
  app_processed:
  app_credentials:
```

### 4. Build and Start the Application

```bash
# Create required directories
mkdir -p data logs uploads downloads processed credentials

# Set proper permissions
chmod 755 data logs uploads downloads processed credentials

# Build the Docker image
docker compose -f docker-compose.prod.yml build

# Start the application
docker compose -f docker-compose.prod.yml up -d

# Check if it's running
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs
```

## 🌐 Nginx Setup and SSL

### 1. Configure Nginx

Create Nginx configuration:
```bash
sudo nano /etc/nginx/sites-available/ai-music-uploader
```

#### Without SSL (initial setup)
```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=upload:10m rate=1r/s;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    # Main application
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # API endpoints with rate limiting
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Upload endpoints with stricter rate limiting
    location /upload/ {
        limit_req zone=upload burst=5 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Increase upload size limit
        client_max_body_size 100M;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://127.0.0.1:3000/health;
        access_log off;
    }

    # Static files caching (optional)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        proxy_pass http://127.0.0.1:3000;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 2. Enable the Site

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/ai-music-uploader /etc/nginx/sites-enabled/

# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### 3. Set up SSL with Let's Encrypt (if using a domain)

If you have a domain pointed to your server:

```bash
# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Test auto-renewal
sudo certbot renew --dry-run

# Set up auto-renewal cron job
echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo crontab -
```

The SSL configuration will be automatically added to your Nginx config by Certbot.

## 🔄 Auto-Restart and Monitoring

### 1. Create Systemd Service (Alternative to Docker restart policies)

Create a service file:
```bash
sudo nano /etc/systemd/system/ai-music-uploader.service
```

```ini
[Unit]
Description=AI Music Uploader
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/deploy/ai-music-uploader
ExecStart=/usr/local/bin/docker-compose -f docker-compose.prod.yml up -d
ExecStop=/usr/local/bin/docker-compose -f docker-compose.prod.yml down
TimeoutStartSec=0
User=deploy
Group=docker

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable ai-music-uploader
sudo systemctl start ai-music-uploader

# Check status
sudo systemctl status ai-music-uploader
```

### 2. Set up Monitoring and Alerts

Create a simple monitoring script:
```bash
nano /home/deploy/monitor.sh
chmod +x /home/deploy/monitor.sh
```

```bash
#!/bin/bash

# Monitor AI Music Uploader
APP_URL="http://localhost:3000/health"
LOG_FILE="/home/deploy/ai-music-uploader/logs/monitor.log"

# Check if app is responding
response=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL" --connect-timeout 10)

if [ "$response" != "200" ]; then
    echo "$(date): App not responding (HTTP $response), attempting restart..." >> "$LOG_FILE"
    cd /home/deploy/ai-music-uploader
    docker compose -f docker-compose.prod.yml restart
    
    # Optional: Send notification
    # curl -X POST -H 'Content-type: application/json' \
    #     --data '{"text":"AI Music Uploader restarted due to health check failure"}' \
    #     YOUR_SLACK_WEBHOOK_URL
else
    echo "$(date): App healthy (HTTP $response)" >> "$LOG_FILE"
fi
```

Add to crontab:
```bash
crontab -e
# Add this line to check every 5 minutes:
*/5 * * * * /home/deploy/monitor.sh
```

## 📊 Maintenance and Updates

### Deployment Scripts

Create deployment scripts for easy updates:

```bash
nano /home/deploy/deploy.sh
chmod +x /home/deploy/deploy.sh
```

```bash
#!/bin/bash

APP_DIR="/home/deploy/ai-music-uploader"
COMPOSE_FILE="docker-compose.prod.yml"

echo "Starting deployment..."

cd "$APP_DIR"

# Pull latest code (if using git)
git pull origin main

# Backup current data
echo "Backing up data..."
tar -czf "backup-$(date +%Y%m%d-%H%M%S).tar.gz" data logs

# Build new image
echo "Building new image..."
docker compose -f "$COMPOSE_FILE" build --no-cache

# Stop current container
echo "Stopping current application..."
docker compose -f "$COMPOSE_FILE" down

# Start with new image
echo "Starting new application..."
docker compose -f "$COMPOSE_FILE" up -d

# Check health
sleep 30
if curl -f http://localhost:3000/health; then
    echo "Deployment successful!"
else
    echo "Health check failed! Check logs:"
    docker compose -f "$COMPOSE_FILE" logs --tail=50
fi

echo "Deployment completed at $(date)"
```

### Log Management

Set up log rotation:
```bash
sudo nano /etc/logrotate.d/ai-music-uploader
```

```
/home/deploy/ai-music-uploader/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0644 deploy deploy
    postrotate
        /bin/kill -USR1 $(cat /var/run/rsyslogd.pid 2> /dev/null) 2> /dev/null || true
    endscript
}
```

### Database Backup

Create automated database backups:
```bash
nano /home/deploy/backup.sh
chmod +x /home/deploy/backup.sh
```

```bash
#!/bin/bash

BACKUP_DIR="/home/deploy/backups"
APP_DIR="/home/deploy/ai-music-uploader"
DATE=$(date +%Y%m%d-%H%M%S)

mkdir -p "$BACKUP_DIR"

# Backup database and important files
tar -czf "$BACKUP_DIR/ai-music-uploader-$DATE.tar.gz" \
    -C "$APP_DIR" \
    data \
    logs \
    .env

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "ai-music-uploader-*.tar.gz" -mtime +7 -delete

echo "Backup completed: ai-music-uploader-$DATE.tar.gz"
```

Add to crontab for daily backups:
```bash
crontab -e
# Add this line for daily backup at 2 AM:
0 2 * * * /home/deploy/backup.sh
```

## 🔐 Security Hardening

### Additional Security Measures

1. **Change SSH port** (optional but recommended):
```bash
sudo nano /etc/ssh/sshd_config
# Change Port 22 to Port 2222
sudo systemctl restart sshd

# Update firewall
sudo ufw delete allow ssh
sudo ufw allow 2222
```

2. **Disable root SSH login**:
```bash
sudo nano /etc/ssh/sshd_config
# Set PermitRootLogin no
sudo systemctl restart sshd
```

3. **Set up automatic security updates**:
```bash
sudo apt install unattended-upgrades
sudo dpkg-reconfigure unattended-upgrades
```

4. **Monitor failed login attempts**:
```bash
# Check fail2ban status
sudo fail2ban-client status sshd

# View blocked IPs
sudo fail2ban-client get sshd bantime
```

## 🧪 Testing Your Deployment

### 1. Health Checks
```bash
# Test health endpoint
curl -f http://YOUR_DOMAIN/health

# Check Docker containers
docker ps

# View logs
docker compose -f docker-compose.prod.yml logs -f
```

### 2. Load Testing (Optional)
```bash
# Install Apache Bench for basic load testing
sudo apt install apache2-utils

# Test with 100 requests, 10 concurrent
ab -n 100 -c 10 http://YOUR_DOMAIN/health
```

### 3. SSL Certificate Check
```bash
# Check SSL certificate (if using HTTPS)
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com
```

## 📞 Troubleshooting

### Common Issues

1. **Container won't start**:
```bash
# Check logs
docker compose -f docker-compose.prod.yml logs

# Check system resources
free -h
df -h
```

2. **502 Bad Gateway from Nginx**:
```bash
# Check if app is running
curl http://localhost:3000/health

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

3. **Database permission errors**:
```bash
# Fix permissions
sudo chown -R deploy:deploy /home/deploy/ai-music-uploader/data
```

4. **SSL certificate issues**:
```bash
# Renew certificate manually
sudo certbot renew --force-renewal -d yourdomain.com
```

### Useful Commands

```bash
# View all Docker containers
docker ps -a

# Restart the application
docker compose -f docker-compose.prod.yml restart

# View real-time logs
docker compose -f docker-compose.prod.yml logs -f

# Check disk usage
du -sh /home/deploy/ai-music-uploader/*

# Monitor system resources
htop
```

## 🎉 Congratulations!

Your AI Music Uploader is now deployed on Hetzner Cloud with:

- ✅ Production-ready Docker setup
- ✅ Nginx reverse proxy with SSL
- ✅ Auto-restart capabilities
- ✅ Security hardening
- ✅ Monitoring and alerting
- ✅ Automated backups
- ✅ Log rotation

### Next Steps

1. **Test all features** thoroughly in the production environment
2. **Set up monitoring dashboards** for better visibility
3. **Configure backup restoration** procedures
4. **Document any custom configurations** for your team
5. **Set up CI/CD pipelines** for automated deployments

---

**Your AI Music Uploader is now live and ready to scale! 🚀**

For local development setup, see [LOCAL_SETUP.md](LOCAL_SETUP.md)
