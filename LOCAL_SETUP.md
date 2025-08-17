# 🎵 AI Music Uploader - Local Development Setup

## 📋 Prerequisites

Before setting up the project locally, ensure you have the following installed:

### Required Software
- **Node.js**: Version 16 or higher
  - Download from: https://nodejs.org/
  - Verify installation: `node --version`
- **npm**: Usually comes with Node.js
  - Verify installation: `npm --version`
- **FFmpeg**: For audio processing
  - **Windows**: Download from https://ffmpeg.org/download.html and add to PATH
  - **macOS**: `brew install ffmpeg`
  - **Linux**: `sudo apt update && sudo apt install ffmpeg`
- **Git**: For version control
  - Download from: https://git-scm.com/

### System Requirements
- **RAM**: Minimum 4GB, recommended 8GB
- **Storage**: At least 5GB free space
- **OS**: Windows 10+, macOS 10.15+, or Linux (Ubuntu 18.04+)

## 🚀 Installation Steps

### 1. Clone the Repository
```bash
git clone <repository-url>
cd NEO-3
```

### 2. Install Dependencies

Install root level dependencies:
```bash
npm install
```

Install client dependencies:
```bash
cd client
npm install
cd ..
```

### 3. Environment Configuration

Create your local environment file:
```bash
cp .env.example .env
```

Edit the `.env` file with your configuration:

#### Required Environment Variables
```bash
# Server Configuration
NODE_ENV=development
PORT=3000

# Admin Credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password

# Database (SQLite for development)
DB_TYPE=sqlite
DB_STORAGE=data/music_uploader.db

# JWT Security (CRITICAL: Use a unique 32+ character string)
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
JWT_EXPIRES_IN=7d
```

#### API Keys (Required for Full Functionality)
```bash
# OpenAI for AI content enhancement
OPENAI_API_KEY=sk-proj-your-openai-key-here
OPENAI_MODEL=gpt-3.5-turbo

# YouTube API for video uploads
YOUTUBE_CLIENT_ID_1=your-youtube-client-id.apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET_1=your-youtube-client-secret
YOUTUBE_REDIRECT_URI_1=http://localhost:3000/auth/youtube/callback
```

#### Optional API Keys
```bash
# Telegram Bot for notifications
TELEGRAM_BOT_TOKEN=your-telegram-bot-token

# Email notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-email-app-password
```

### 4. Create Required Directories
```bash
mkdir -p data logs uploads downloads processed temp credentials
```

### 5. Verify FFmpeg Installation
```bash
ffmpeg -version
```
If this command fails, ensure FFmpeg is properly installed and added to your system PATH.

## 🔧 Development Setup

### Option 1: Run Backend and Frontend Separately

**Terminal 1 - Backend Server:**
```bash
npm run server
# Server will run on http://localhost:3000
```

**Terminal 2 - Frontend Development Server:**
```bash
cd client
npm start
# Frontend will run on http://localhost:3001
```

### Option 2: Run Both Concurrently
```bash
npm run dev
# Runs both backend (port 3000) and frontend (port 3001)
```

### Option 3: Production Mode
```bash
# Build the frontend first
npm run build

# Start production server
npm start
# Serves built frontend from backend at http://localhost:3000
```

## 🌐 Accessing the Application

Once the servers are running:

- **Frontend (Development)**: http://localhost:3001
- **Backend API**: http://localhost:3000
- **Production**: http://localhost:3000 (serves both frontend and API)

### Default Login Credentials
- **Username**: admin
- **Password**: Use the value you set in `ADMIN_PASSWORD` in your `.env` file

## 📊 Database Setup

The application uses SQLite for development (no additional setup required). The database file will be created automatically at `data/music_uploader.db`.

### Database Operations
```bash
# The database is automatically initialized when you first run the server
npm start

# To reset the database (delete the file and restart)
rm data/music_uploader.db
npm start
```

## 🧪 Testing the Setup

### 1. Health Check
Visit http://localhost:3000/health to verify the server is running.

### 2. API Test
```bash
curl http://localhost:3000/
```
Should return a JSON response with service information.

### 3. Frontend Test
Visit http://localhost:3001 (or http://localhost:3000 in production mode) and verify the admin panel loads.

### 4. Database Test
- Login to the admin panel
- Check if the dashboard displays system metrics
- Try creating a sample asset

## 🛠️ Development Tools

### Available npm Scripts
```bash
# Development
npm run dev          # Run both frontend and backend with hot reload
npm run server       # Run backend only with nodemon
npm run client       # Run frontend only

# Build
npm run build        # Build React frontend for production

# Production
npm start            # Run production server

# Docker
npm run docker:build # Build Docker image
npm run docker:start # Start Docker container
npm run docker:logs  # View Docker logs
```

### Environment Variables Reference

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NODE_ENV` | Environment mode | Yes | development |
| `PORT` | Server port | No | 3000 |
| `ADMIN_USERNAME` | Admin login username | Yes | admin |
| `ADMIN_PASSWORD` | Admin login password | Yes | - |
| `JWT_SECRET` | JWT encryption key | Yes | - |
| `OPENAI_API_KEY` | OpenAI API key | No | - |
| `YOUTUBE_CLIENT_ID_1` | YouTube OAuth client ID | No | - |
| `YOUTUBE_CLIENT_SECRET_1` | YouTube OAuth secret | No | - |

## 🐛 Troubleshooting

### Common Issues

#### 1. FFmpeg not found
**Error**: `FFmpeg not found in PATH`
**Solution**: 
- Verify FFmpeg installation: `ffmpeg -version`
- Add FFmpeg to system PATH
- Restart terminal/command prompt

#### 2. Port already in use
**Error**: `Error: listen EADDRINUSE :::3000`
**Solution**:
```bash
# Find process using port 3000
netstat -ano | findstr :3000
# Kill the process (Windows)
taskkill /PID <process-id> /F
```

#### 3. Database permission errors
**Error**: Database file cannot be created
**Solution**:
```bash
# Create data directory with proper permissions
mkdir -p data
chmod 755 data
```

#### 4. Node modules issues
**Error**: Module not found errors
**Solution**:
```bash
# Clean install
rm -rf node_modules client/node_modules
npm install
cd client && npm install
```

#### 5. Client build fails
**Error**: React build errors
**Solution**:
```bash
cd client
rm -rf node_modules build
npm install
npm run build
```

#### 6. Login Authentication Issues
**Error**: "Login failed" despite successful backend authentication
**Symptoms**: 
- Backend logs show "User admin logged in successfully"
- Browser shows "Login failed" message
- JWT signature errors in server logs

**Root Cause**: JWT_SECRET misconfiguration or token mismatch

**Solution**:
```bash
# 1. Ensure JWT_SECRET is properly set in .env (32+ characters)
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6

# 2. Clear browser localStorage to remove invalid tokens
# In browser console:
localStorage.clear()

# 3. Restart both backend and frontend servers
npm run dev
```

**Prevention**:
- Always use a unique, 32+ character JWT_SECRET
- Restart services after changing JWT_SECRET
- Clear browser storage when switching between environments

### Environment-Specific Issues

#### Windows
- Use PowerShell or Command Prompt as Administrator if needed
- Ensure Windows Subsystem for Linux (WSL) is not conflicting if using both

#### macOS
- May need to install Xcode command line tools: `xcode-select --install`
- Use Homebrew for package management

#### Linux
- Ensure all required packages are installed
- Check file permissions on project directories

## 📈 Performance Tips

### Development Performance
- Use `npm run dev` for hot reloading during development
- Keep the number of browser tabs minimal when developing
- Close unnecessary applications to free up RAM

### Storage Management
- Regularly clean up test files in `uploads/`, `downloads/`, and `processed/` directories
- Monitor database size in `data/` directory
- Use `.dockerignore` when building Docker images

## 🧪 Development with Mock Data

For development and testing without external API dependencies, the application includes comprehensive mock data.

### Using Mock Data

Mock data is automatically enabled when:
- `NODE_ENV=development` in your `.env` file
- Mock data files are present in the `mock/` directory

### What's Included

**Mock Assets Data**:
- Sample audio files with metadata
- Processing job histories  
- Upload records and status
- Pagination support

**Mock Scheduler Data**:
- Job status and configurations
- Cron job schedules
- Manual trigger responses

**Mock Analytics Data**:
- Upload statistics and trends
- Processing performance metrics
- Storage usage data
- System health indicators
- Asset type distributions

### Benefits of Mock Data

- **No API Keys Required**: Test all functionality without external services
- **Consistent Data**: Same data every time for reliable testing
- **Faster Development**: No network calls or quota limitations
- **Offline Development**: Work without internet connectivity

### Switching to Real APIs

To use real APIs instead of mock data:

1. **Set Environment to Production**:
```bash
NODE_ENV=production
```

2. **Add Required API Keys**:
```bash
# YouTube API
YOUTUBE_CLIENT_ID_1=your-real-youtube-client-id
YOUTUBE_CLIENT_SECRET_1=your-real-youtube-secret

# OpenAI API
OPENAI_API_KEY=sk-your-real-openai-key

# Other APIs as needed...
```

3. **Restart the Server**:
```bash
npm restart
```

### Environment Variable Validation

The application validates required API keys on startup in production mode:

- Missing API keys will show clear error messages
- Server will not start if critical keys are missing
- Development mode gracefully falls back to mock data

### Testing Both Modes

**Development Mode** (with mocks):
```bash
NODE_ENV=development npm run dev
```

**Production Mode** (with real APIs):
```bash
NODE_ENV=production npm start
```

## 🔐 Security Notes

### Development Security
- Never commit your `.env` file to version control
- Use strong passwords for admin accounts
- Rotate API keys regularly
- Use HTTPS in production environments

### API Key Management
- Store sensitive keys in environment variables only
- Use different API keys for development and production
- Monitor API key usage and quotas

## 📚 Next Steps

Once your local setup is complete:

1. **Explore the Admin Panel**: Login and familiarize yourself with the interface
2. **Test Core Features**: Try asset management, processing, and uploads
3. **Review the Code**: Examine the `server/` and `client/` directories
4. **Read the API Documentation**: Understanding the available endpoints
5. **Set up Production**: Follow the deployment guide for production setup

## 💡 Tips for New Developers

- Start with the default configuration to ensure everything works
- Add API keys one at a time and test each integration
- Use the browser developer tools to debug frontend issues
- Check server logs for backend troubleshooting
- Join the community discussions for help and updates

---

**Happy coding! 🎉**

For deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md)
