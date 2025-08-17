# Hetzner Cloud Deployment Guide
## YouTube Automation Platform - Production Deployment

This guide provides complete step-by-step instructions for deploying the YouTube Automation Platform on Hetzner Cloud via SSH.

## Prerequisites

- Hetzner Cloud account
- Local machine with SSH client
- Domain name (optional, for custom domain setup)

## Part 1: Hetzner Cloud Server Setup

### Step 1: Create Hetzner Cloud Server

1. **Login to Hetzner Cloud Console**
   - Go to https://console.hetzner.cloud/
   - Login to your account

2. **Create a new server:**
   - Click "Add Server"
   - **Location**: Choose closest to your target audience (e.g., Nuremberg, Helsinki)
   - **Image**: Ubuntu 22.04 LTS
   - **Type**: CX31 (2 vCPU, 8 GB RAM) or higher for production
   - **Volume**: None (we'll use server storage)
   - **Network**: Default
   - **SSH Keys**: Add your SSH public key
   - **Name**: `youtube-automation-prod`
   - **Labels**: Add labels like `env=production`, `app=youtube-automation`

3. **Note the server IP address** after creation

### Step 2: Initial Server Configuration

```bash
# SSH into your server
ssh root@YOUR_SERVER_IP

# Update system packages
apt update && apt upgrade -y

# Install essential packages
apt install -y curl wget git unzip htop nano ufw fail2ban

# Configure firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp  # Application port
ufw --force enable

# Configure fail2ban for SSH protection
systemctl enable fail2ban
systemctl start fail2ban
```

### Step 3: Install Docker and Docker Compose

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Start and enable Docker
systemctl start docker
systemctl enable docker

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Verify installations
docker --version
docker-compose --version
```

### Step 4: Create Application User

```bash
# Create app user for security
useradd -m -s /bin/bash appuser
usermod -aG docker appuser

# Create app directory
mkdir -p /opt/youtube-automation
chown appuser:appuser /opt/youtube-automation
```

## Part 2: Application Deployment

### Step 5: Clone and Setup Application

```bash
# Switch to app user
su - appuser

# Navigate to app directory
cd /opt/youtube-automation

# Clone the repository
git clone https://github.com/rahulsinghnegiii/YT-automation.git .

# Verify files
ls -la
```

### Step 6: Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit environment file
nano .env
```

**Configure these critical environment variables:**

```bash
# Server Configuration
NODE_ENV=production
PORT=3000

# Admin Credentials (CHANGE THESE!)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=YOUR_SECURE_PASSWORD_HERE

# Database
DB_TYPE=sqlite
DB_STORAGE=data/music_uploader.db

# Security
JWT_SECRET=your_very_secure_jwt_secret_key_here_min_32_chars_required
SESSION_SECRET=your_session_secret_here
BCRYPT_ROUNDS=12

# CORS for production (replace with your domain)
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# YouTube API (configure your YouTube API credentials)
YOUTUBE_CLIENT_ID_1=your_youtube_client_id
YOUTUBE_CLIENT_SECRET_1=your_youtube_client_secret
YOUTUBE_REDIRECT_URI_1=https://yourdomain.com/auth/youtube/callback

# OpenAI API (optional)
OPENAI_API_KEY=your_openai_api_key_here

# Email Configuration (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_email_password_or_app_password

# Feature Toggles (adjust as needed)
MULTI_CHANNEL_ENABLED=true
SEO_OPTIMIZATION_ENABLED=true
PROMOTION_BOTS_ENABLED=false  # Disable until configured
SHORTS_GENERATION_ENABLED=true
ENGAGEMENT_BOT_ENABLED=false  # Disable until configured

# Logging
LOG_LEVEL=info
LOG_FILE_ENABLED=true
```

### Step 7: Build and Run with Docker

```bash
# Build the Docker image
docker build -t youtube-automation:latest .

# Create data directories with proper permissions
mkdir -p data logs uploads downloads processed temp credentials backups shorts thumbnails
chmod 755 data logs uploads downloads processed temp credentials backups shorts thumbnails

# Run the container
docker run -d \
  --name youtube-automation \
  --restart unless-stopped \
  -p 3000:3000 \
  -v /opt/youtube-automation/data:/app/data \
  -v /opt/youtube-automation/logs:/app/logs \
  -v /opt/youtube-automation/uploads:/app/uploads \
  -v /opt/youtube-automation/downloads:/app/downloads \
  -v /opt/youtube-automation/processed:/app/processed \
  -v /opt/youtube-automation/credentials:/app/credentials \
  --env-file .env \
  youtube-automation:latest

# Check if container is running
docker ps

# Check application logs
docker logs youtube-automation -f
```

## Part 3: Production Optimizations

### Step 8: Setup Nginx Reverse Proxy (Optional but Recommended)

```bash
# Switch back to root
exit

# Install Nginx
apt install -y nginx

# Create Nginx configuration
cat > /etc/nginx/sites-available/youtube-automation << 'EOF'
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    
    # Client max body size for file uploads
    client_max_body_size 100M;
    
    # Proxy to Node.js application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Static file serving with caching
    location /uploads/ {
        proxy_pass http://localhost:3000;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    
    location /downloads/ {
        proxy_pass http://localhost:3000;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Enable the site
ln -s /etc/nginx/sites-available/youtube-automation /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
nginx -t

# Start and enable Nginx
systemctl start nginx
systemctl enable nginx
```

### Step 9: SSL Certificate with Let's Encrypt (For Custom Domain)

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate (replace YOUR_DOMAIN with your actual domain)
certbot --nginx -d YOUR_DOMAIN

# Verify auto-renewal
certbot renew --dry-run
```

### Step 10: Setup System Monitoring and Logging

```bash
# Install system monitoring tools
apt install -y htop iotop nethogs

# Setup log rotation for application
cat > /etc/logrotate.d/youtube-automation << 'EOF'
/opt/youtube-automation/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    notifempty
    create 644 appuser appuser
    postrotate
        docker kill -s USR1 youtube-automation 2>/dev/null || true
    endscript
}
EOF

# Create systemd service for container management
cat > /etc/systemd/system/youtube-automation.service << 'EOF'
[Unit]
Description=YouTube Automation Platform
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
User=appuser
Group=appuser
WorkingDirectory=/opt/youtube-automation
ExecStart=/usr/bin/docker start youtube-automation
ExecStop=/usr/bin/docker stop youtube-automation
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

# Enable the service
systemctl enable youtube-automation.service
```

## Part 4: Maintenance and Monitoring

### Step 11: Create Maintenance Scripts

```bash
# Create backup script
cat > /opt/youtube-automation/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/youtube-automation/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup database
cp /opt/youtube-automation/data/music_uploader.db "$BACKUP_DIR/db_backup_$DATE.db"

# Backup configuration
cp /opt/youtube-automation/.env "$BACKUP_DIR/env_backup_$DATE.env"

# Compress and cleanup old backups (keep last 30 days)
find "$BACKUP_DIR" -name "*.db" -mtime +30 -delete
find "$BACKUP_DIR" -name "*.env" -mtime +30 -delete

echo "Backup completed: $DATE"
EOF

chmod +x /opt/youtube-automation/backup.sh

# Create update script
cat > /opt/youtube-automation/update.sh << 'EOF'
#!/bin/bash
cd /opt/youtube-automation

echo "Pulling latest changes..."
git pull origin main

echo "Building new image..."
docker build -t youtube-automation:latest .

echo "Stopping current container..."
docker stop youtube-automation

echo "Removing old container..."
docker rm youtube-automation

echo "Starting new container..."
docker run -d \
  --name youtube-automation \
  --restart unless-stopped \
  -p 3000:3000 \
  -v /opt/youtube-automation/data:/app/data \
  -v /opt/youtube-automation/logs:/app/logs \
  -v /opt/youtube-automation/uploads:/app/uploads \
  -v /opt/youtube-automation/downloads:/app/downloads \
  -v /opt/youtube-automation/processed:/app/processed \
  -v /opt/youtube-automation/credentials:/app/credentials \
  --env-file .env \
  youtube-automation:latest

echo "Update completed!"
echo "Logs:"
docker logs youtube-automation --tail 50
EOF

chmod +x /opt/youtube-automation/update.sh

# Setup automated backups
crontab -u appuser -e
# Add this line to run daily backups at 2 AM:
# 0 2 * * * /opt/youtube-automation/backup.sh >> /opt/youtube-automation/logs/backup.log 2>&1
```

### Step 12: Health Monitoring

```bash
# Create health check script
cat > /opt/youtube-automation/health-check.sh << 'EOF'
#!/bin/bash
HEALTH_URL="http://localhost:3000/health"
LOG_FILE="/opt/youtube-automation/logs/health-check.log"

# Check application health
if curl -f -s "$HEALTH_URL" > /dev/null; then
    echo "$(date): Application is healthy" >> "$LOG_FILE"
else
    echo "$(date): Application health check failed - restarting container" >> "$LOG_FILE"
    docker restart youtube-automation
    
    # Send alert (configure email/webhook as needed)
    # Example: curl -X POST -H 'Content-type: application/json' --data '{"text":"YouTube Automation Platform restarted due to health check failure"}' YOUR_WEBHOOK_URL
fi
EOF

chmod +x /opt/youtube-automation/health-check.sh

# Add to crontab to run every 5 minutes
# */5 * * * * /opt/youtube-automation/health-check.sh
```

## Part 5: Security Hardening

### Step 13: Additional Security Measures

```bash
# Configure automatic security updates
echo 'Unattended-Upgrade::Automatic-Reboot "false";' >> /etc/apt/apt.conf.d/50unattended-upgrades
systemctl enable unattended-upgrades

# Disable unused services
systemctl disable apache2 2>/dev/null || true
systemctl disable sendmail 2>/dev/null || true

# Configure SSH security
sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh

# Set up intrusion detection
apt install -y rkhunter chkrootkit
rkhunter --update
```

## Part 6: Testing and Verification

### Step 14: Verify Deployment

```bash
# Check if application is running
curl http://YOUR_SERVER_IP:3000/health

# Check Docker container status
docker ps
docker logs youtube-automation

# Check system resources
htop
df -h

# Check open ports
netstat -tlnp

# Check firewall status
ufw status

# Test WebSocket connection (if enabled)
curl -I http://YOUR_SERVER_IP:3000/socket.io/?EIO=4&transport=polling
```

### Step 15: Application Access

1. **Web Interface**: http://YOUR_SERVER_IP:3000 (or https://YOUR_DOMAIN if SSL configured)
2. **Health Check**: http://YOUR_SERVER_IP:3000/health
3. **API Endpoints**: http://YOUR_SERVER_IP:3000/api/*

### Default Login Credentials
- **Username**: admin (or as configured in .env)
- **Password**: Check your .env file for ADMIN_PASSWORD

## Troubleshooting

### Common Issues and Solutions

**Container won't start:**
```bash
# Check container logs
docker logs youtube-automation

# Check if port is already in use
netstat -tlnp | grep 3000

# Restart container
docker restart youtube-automation
```

**Database issues:**
```bash
# Check database file permissions
ls -la /opt/youtube-automation/data/

# Reset database (WARNING: This will delete all data)
docker exec -it youtube-automation rm -f /app/data/music_uploader.db
docker restart youtube-automation
```

**High memory usage:**
```bash
# Monitor container resources
docker stats youtube-automation

# Adjust memory limits in docker run command:
# --memory="4g" --memory-swap="4g"
```

**SSL certificate issues:**
```bash
# Renew certificate manually
certbot renew

# Check certificate status
certbot certificates
```

## Maintenance Commands

```bash
# View application logs
docker logs youtube-automation -f

# Access container shell
docker exec -it youtube-automation /bin/bash

# Update application
/opt/youtube-automation/update.sh

# Backup data
/opt/youtube-automation/backup.sh

# Restart application
docker restart youtube-automation

# Monitor system resources
htop
iotop
nethogs

# Check disk usage
df -h
du -sh /opt/youtube-automation/*
```

## Performance Optimization

For high-traffic deployments, consider:

1. **Upgrade server**: Use CX41 (4 vCPU, 16 GB RAM) or higher
2. **Add Redis caching**: Install Redis for session storage and caching
3. **Database optimization**: Consider PostgreSQL for better performance
4. **CDN**: Use Cloudflare or similar for static content delivery
5. **Load balancing**: Set up multiple instances behind a load balancer

## Support and Updates

- **Repository**: https://github.com/rahulsinghnegiii/YT-automation
- **Update frequency**: Check for updates weekly
- **Security patches**: Apply immediately when available

---

This deployment guide provides a production-ready setup for the YouTube Automation Platform on Hetzner Cloud. Follow each step carefully and customize the configuration according to your specific requirements.
