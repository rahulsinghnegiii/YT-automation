# AI Music Uploader - Docker Production Setup

This project includes a complete Docker setup for easy deployment of the AI Music Uploader system.

## 🚀 Quick Start

1. **Clone and prepare:**
   ```bash
   git clone <repository-url>
   cd ai-music-uploader
   ```

2. **Configure environment:**
   ```bash
   cp .env.docker.example .env.docker
   # Edit .env.docker with your API keys
   ```

3. **Deploy with one command:**
   ```bash
   ./deploy.sh start
   ```

4. **Access the application:**
   - Admin Panel: http://localhost:3000
   - Default Login: admin / admin123456

## 📋 Requirements

- Docker 20.10+
- Docker Compose 2.0+
- 4GB+ RAM (recommended)
- 10GB+ disk space

## 🔧 Configuration

### Required API Keys

Edit `.env.docker` with your credentials:

```bash
# OpenAI (Required for semantic enrichment)
OPENAI_API_KEY=sk-proj-your-key-here

# YouTube API (Required for uploads)
YOUTUBE_API_KEY=your-youtube-api-key
YOUTUBE_CLIENT_ID=your-client-id.apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET=your-client-secret
```

### Optional Services

The Docker setup includes:
- **Redis**: For caching and session management
- **Nginx**: Reverse proxy with rate limiting
- **Volume persistence**: For data, logs, and media files

## 🛠️ Management Commands

```bash
# Start services
./deploy.sh start

# View logs
./deploy.sh logs

# Check status
./deploy.sh status

# Stop services
./deploy.sh stop

# Update application
./deploy.sh update

# Clean up everything
./deploy.sh cleanup
```

## 📊 Monitoring

### Health Checks
- Application: http://localhost:3000/health
- Container health: `docker-compose ps`

### Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f ai-music-uploader

# Follow logs with deploy script
./deploy.sh logs
```

### Resource Usage
```bash
# Container stats
docker stats

# Volume usage
docker system df

# Network status
docker network ls | grep ai-music
```

## 🗂️ Data Persistence

Data is stored in Docker volumes:
- `ai_music_data`: Database and application data
- `ai_music_logs`: Application logs
- `ai_music_uploads`: Uploaded files
- `ai_music_downloads`: Downloaded content
- `ai_music_processed`: Processed audio files

### Backup Data
```bash
# Backup all volumes
docker run --rm -v ai_music_data:/data -v $(pwd):/backup alpine tar czf /backup/ai_music_backup.tar.gz /data

# Restore from backup
docker run --rm -v ai_music_data:/data -v $(pwd):/backup alpine tar xzf /backup/ai_music_backup.tar.gz
```

## 🔒 Security

### Production Deployment

1. **Change default passwords:**
   ```bash
   # Update in .env.docker
   ADMIN_PASSWORD=your-secure-password
   ```

2. **Enable HTTPS:**
   - Configure SSL certificates in `nginx.conf`
   - Update `docker-compose.yml` with SSL volume mounts

3. **Network security:**
   - Use Docker secrets for sensitive data
   - Configure firewall rules
   - Enable Docker daemon security

### API Rate Limiting

Nginx includes built-in rate limiting:
- API endpoints: 10 requests/second
- Upload endpoints: 1 request/second
- Burst allowances configured

## 🐛 Troubleshooting

### Common Issues

1. **Port conflicts:**
   ```bash
   # Change ports in docker-compose.yml
   ports:
     - "8080:3000"  # Use different host port
   ```

2. **Memory issues:**
   ```bash
   # Check container memory usage
   docker stats
   
   # Increase memory limits in docker-compose.yml
   deploy:
     resources:
       limits:
         memory: 2G
   ```

3. **Permission errors:**
   ```bash
   # Fix volume permissions
   sudo chown -R 1000:1000 ./data ./logs ./uploads
   ```

4. **Database issues:**
   ```bash
   # Reset database
   docker-compose down -v
   docker volume rm ai_music_data
   ./deploy.sh start
   ```

### Debug Mode

```bash
# Run with debug output
DEBUG=* docker-compose up

# Access container shell
docker-compose exec ai-music-uploader sh

# Check container logs
docker logs ai-music-uploader
```

## 🔄 Updates

### Automatic Updates
```bash
# Update and restart
./deploy.sh update
```

### Manual Updates
```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 🌐 Production Deployment

### Cloud Deployment

1. **AWS/GCP/Azure:**
   - Use container services (ECS, Cloud Run, Container Instances)
   - Configure persistent storage
   - Set up load balancers

2. **VPS/Dedicated Server:**
   - Install Docker and Docker Compose
   - Configure domain and SSL
   - Set up monitoring and backups

### Environment Variables

Production environment considerations:
```bash
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/dbname  # Use PostgreSQL for production
REDIS_URL=redis://redis:6379
LOG_LEVEL=warn
CONCURRENT_PROCESSES=4
```

## 📈 Scaling

### Horizontal Scaling
```yaml
# In docker-compose.yml
ai-music-uploader:
  deploy:
    replicas: 3
    resources:
      limits:
        memory: 1G
        cpus: '0.5'
```

### Load Balancing
- Use multiple container replicas
- Configure Nginx upstream servers
- Implement session affinity if needed

## 📞 Support

- Check logs: `./deploy.sh logs`
- Monitor health: http://localhost:3000/health
- Container status: `./deploy.sh status`
- Community: [Issues page](https://github.com/your-repo/issues)
