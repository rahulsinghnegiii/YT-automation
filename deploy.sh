#!/bin/bash

# AI Music Uploader - Docker Deployment Script
# This script helps you deploy the AI Music Uploader using Docker

set -e

echo "🎵 AI Music Uploader - Docker Deployment 🎵"
echo "=============================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Function to create .env.docker if it doesn't exist
create_env_file() {
    if [ ! -f .env.docker ]; then
        echo "📝 Creating .env.docker file..."
        cp .env.docker.example .env.docker
        echo "⚠️  Please edit .env.docker with your API keys before continuing."
        echo "   Required: OPENAI_API_KEY, YOUTUBE_API_KEY, YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET"
        read -p "Press Enter when you've configured .env.docker..."
    fi
}

# Function to build the Docker image
build_image() {
    echo "🔨 Building Docker image..."
    docker build -t ai-music-uploader:latest .
    echo "✅ Docker image built successfully!"
}

# Function to start development services
start_dev_services() {
    echo "�️  Starting AI Music Uploader in development mode..."
    docker-compose -f docker-compose.dev.yml --env-file .env.docker up -d
    echo "✅ Development services started successfully!"
    echo ""
    echo "📊 Admin Panel: http://localhost:3000"
    echo "�️  Database Viewer: http://localhost:8080"
    echo "📡 Redis: localhost:6379"
    echo "🐛 Debug Port: 9229"
    echo "🔐 Default Login: admin / admin123456"
    echo ""
    echo "📋 To view logs: docker-compose -f docker-compose.dev.yml logs -f"
    echo "🛑 To stop: ./deploy.sh stop-dev"
}

# Function to stop development services
stop_dev_services() {
    echo "🛑 Stopping development services..."
    docker-compose -f docker-compose.dev.yml down
    echo "✅ Development services stopped successfully!"
}

# Function to stop services
stop_services() {
    echo "🛑 Stopping AI Music Uploader services..."
    docker-compose down
    echo "✅ Services stopped successfully!"
}

# Function to view logs
view_logs() {
    echo "📋 Viewing AI Music Uploader logs..."
    docker-compose logs -f ai-music-uploader
}

# Function to clean up
cleanup() {
    echo "🧹 Cleaning up Docker resources..."
    docker-compose down -v
    docker rmi ai-music-uploader:latest 2>/dev/null || true
    echo "✅ Cleanup completed!"
}

# Function to update
update() {
    echo "🔄 Updating AI Music Uploader..."
    git pull origin main 2>/dev/null || echo "⚠️  Git not available, skipping git pull"
    docker-compose down
    build_image
    start_services
    echo "✅ Update completed!"
}

# Function to show status
show_status() {
    echo "📊 AI Music Uploader Status:"
    echo "================================"
    docker-compose ps
    echo ""
    echo "💾 Docker volumes:"
    docker volume ls | grep ai_music || echo "No volumes found"
    echo ""
    echo "🌐 Network status:"
    docker network ls | grep ai-music || echo "No custom networks found"
}

# Main menu
case "${1:-}" in
    "build")
        build_image
        ;;
    "dev")
        create_env_file
        build_image
        start_dev_services
        ;;
    "stop-dev")
        stop_dev_services
        ;;
    "start")
        create_env_file
        build_image
        start_services
        ;;
    "stop")
        stop_services
        ;;
    "restart")
        stop_services
        start_services
        ;;
    "logs")
        view_logs
        ;;
    "status")
        show_status
        ;;
    "update")
        update
        ;;
    "cleanup")
        cleanup
        ;;
    "help"|"--help"|"-h")
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  build     - Build the Docker image"
        echo "  start     - Start all services (builds image if needed)"
        echo "  dev       - Start in development mode with hot-reloading"
        echo "  stop      - Stop all services"
        echo "  stop-dev  - Stop development services"
        echo "  restart   - Restart all services"
        echo "  logs      - View application logs"
        echo "  status    - Show service and resource status"
        echo "  update    - Update and restart services"
        echo "  cleanup   - Stop services and remove Docker resources"
        echo "  help      - Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0 start    # First time setup"
        echo "  $0 logs     # Monitor application"
        echo "  $0 stop     # Stop when done"
        ;;
    *)
        echo "🤖 AI Music Uploader Quick Start:"
        echo "1. $0 start    # Set up and start services"
        echo "2. $0 logs     # Monitor the application"
        echo "3. $0 stop     # Stop when finished"
        echo ""
        echo "For more options: $0 help"
        ;;
esac
