# Audio Processing & Asset Management Platform

A modern, full-stack JavaScript application for automated audio asset harvesting, processing, semantic enrichment, and YouTube uploading.

## 🏗️ Architecture

- **Backend**: Node.js with Express, Sequelize ORM, WebSocket support
- **Frontend**: React with Material-UI, real-time updates
- **Database**: PostgreSQL/SQLite with comprehensive data models
- **Processing**: FFmpeg-based audio processing, YouTube API integration
- **Authentication**: JWT-based auth with role management
- **Monitoring**: Real-time system metrics and audit logging

## ✨ Features

### 🎵 Asset Harvesting
- YouTube audio extraction with `ytdl-core`
- Direct URL downloading with progress tracking
- Text-to-audio processing pipeline
- Batch harvesting with error handling
- Automatic file organization and metadata extraction

### 🔧 Signal Morphology
- Audio morphing (pitch, speed, volume adjustment)
- Effects processing (echo, reverb, fade)
- Background track mixing with crossfade
- Format conversion (MP3, WAV, FLAC, OGG)
- Audio analysis and metadata generation

### 📝 Semantic Enrichment
- Text content enhancement and expansion
- Emotional tone analysis and adjustment
- Sensory detail addition
- Automated summary generation
- Complexity analysis and readability scoring

### 📺 YouTube Integration
- OAuth2 authentication flow
- Video uploading with metadata
- Thumbnail management
- Batch upload capabilities
- Quota monitoring and rate limiting

### 🎛️ Admin Panel
- Real-time dashboard with metrics
- Asset management and processing queues
- Upload monitoring and scheduling
- System health monitoring
- Audit logging and analytics

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm
- FFmpeg installed on system
- PostgreSQL (optional, SQLite by default)

### Installation

1. **Install dependencies:**
```bash
cd server && npm install
cd ../client && npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Initialize the database:**
```bash
cd server
npm run db:migrate
npm run db:seed
```

4. **Start the development servers:**
```bash
# Backend (Terminal 1)
cd server
npm run dev

# Frontend (Terminal 2)  
cd client
npm start
```

5. **Access the application:**
- Frontend: http://localhost:3001
- Backend API: http://localhost:3000
- Admin Panel: http://localhost:3001/admin

## 📡 API Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `GET /auth/me` - Get current user

### Asset Management
- `GET /api/assets` - List assets with pagination
- `GET /api/assets/:id` - Get asset details
- `POST /api/harvest/youtube` - Harvest from YouTube
- `POST /api/harvest/url` - Harvest from URL

### Processing
- `POST /api/process/morph/:assetId` - Apply audio morphing
- `POST /api/process/analyze/:assetId` - Analyze audio file
- `POST /api/process/enrich/:assetId` - Semantic enrichment

### Upload
- `POST /api/upload/youtube/:assetId` - Upload to YouTube
- `GET /api/upload/youtube/auth-url` - Get OAuth URL
- `POST /api/upload/youtube/save-token` - Save OAuth token

### System
- `GET /api/status` - System health and metrics
- `GET /api/scheduler/status` - Scheduler status
- `POST /api/scheduler/trigger/:action` - Manual triggers

## 🏗️ Project Structure
```
├── server/                 # Node.js backend
│   ├── models/            # Sequelize data models
│   ├── routes/            # Express route handlers
│   ├── services/          # Business logic services
│   ├── middleware/        # Express middleware
│   └── utils/             # Utility functions
├── client/                # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── contexts/      # React contexts
│   │   └── services/      # API service layer
├── credentials/           # API credentials (not in repo)
├── downloads/            # Harvested assets
├── processed/            # Processed files
└── uploads/              # Files ready for upload
```

## 🔧 Services

### AssetHarvester
- YouTube audio extraction
- URL-based file downloading
- Text-to-audio conversion
- Batch processing capabilities
- Automatic cleanup and maintenance

### SignalMorphology
- Audio morphing and effects
- Format conversion
- Background track mixing
- Audio analysis and metadata
- Batch processing

### SemanticEnrichment
- Text content enhancement
- Emotional tone adjustment
- Complexity analysis
- Summary generation
- Batch enrichment

### YouTubeUploader
- OAuth2 authentication
- Video uploads with metadata
- Thumbnail management
- Quota monitoring
- Batch uploads

## 🚀 Deployment

The system is fully containerized and ready for production deployment with Docker, Kubernetes, or traditional server setups.

---

**Built with ❤️ using modern JavaScript technologies**
