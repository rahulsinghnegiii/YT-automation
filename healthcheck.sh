#!/bin/bash

# Health check script for AI Music Uploader Docker container
# This script verifies that all services are running correctly

set -e

# Configuration
HOST="localhost"
PORT="3000"
TIMEOUT=10

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    
    case $status in
        "OK")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "WARN")
            echo -e "${YELLOW}⚠️  $message${NC}"
            ;;
        "ERROR")
            echo -e "${RED}❌ $message${NC}"
            ;;
        *)
            echo "$message"
            ;;
    esac
}

# Function to check HTTP endpoint
check_endpoint() {
    local endpoint=$1
    local description=$2
    local expected_status=${3:-200}
    
    local response
    local status_code
    
    if response=$(curl -s -w "%{http_code}" --max-time $TIMEOUT "http://$HOST:$PORT$endpoint" 2>/dev/null); then
        status_code="${response: -3}"
        if [ "$status_code" = "$expected_status" ]; then
            print_status "OK" "$description: HTTP $status_code"
            return 0
        else
            print_status "ERROR" "$description: HTTP $status_code (expected $expected_status)"
            return 1
        fi
    else
        print_status "ERROR" "$description: Connection failed"
        return 1
    fi
}

# Function to check database
check_database() {
    if [ -f "/app/data/music_uploader.db" ]; then
        print_status "OK" "Database file exists"
        return 0
    else
        print_status "ERROR" "Database file not found"
        return 1
    fi
}

# Function to check required directories
check_directories() {
    local dirs=("/app/data" "/app/logs" "/app/uploads" "/app/downloads" "/app/processed" "/app/temp")
    local all_ok=true
    
    for dir in "${dirs[@]}"; do
        if [ -d "$dir" ]; then
            print_status "OK" "Directory exists: $dir"
        else
            print_status "ERROR" "Directory missing: $dir"
            all_ok=false
        fi
    done
    
    return $all_ok
}

# Function to check disk space
check_disk_space() {
    local threshold=90
    local usage
    
    usage=$(df /app | tail -1 | awk '{print $5}' | sed 's/%//')
    
    if [ "$usage" -lt "$threshold" ]; then
        print_status "OK" "Disk usage: ${usage}%"
        return 0
    else
        print_status "WARN" "Disk usage high: ${usage}%"
        return 1
    fi
}

# Function to check memory usage
check_memory() {
    local threshold=90
    local usage
    
    if command -v free >/dev/null 2>&1; then
        usage=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
        
        if [ "$usage" -lt "$threshold" ]; then
            print_status "OK" "Memory usage: ${usage}%"
            return 0
        else
            print_status "WARN" "Memory usage high: ${usage}%"
            return 1
        fi
    else
        print_status "WARN" "Cannot check memory usage (free command not available)"
        return 1
    fi
}

# Function to check process status
check_processes() {
    if pgrep -f "node.*server/index.js" >/dev/null; then
        print_status "OK" "Main Node.js process running"
        return 0
    else
        print_status "ERROR" "Main Node.js process not found"
        return 1
    fi
}

# Main health check
main() {
    echo "🏥 AI Music Uploader Health Check"
    echo "=================================="
    echo "Host: $HOST:$PORT"
    echo "Timeout: ${TIMEOUT}s"
    echo ""
    
    local exit_code=0
    
    # Check basic endpoints
    echo "🌐 HTTP Endpoints:"
    check_endpoint "/" "Main page" || exit_code=1
    check_endpoint "/health" "Health endpoint" || exit_code=1
    check_endpoint "/api/dashboard/stats" "API endpoint" 401 || exit_code=1  # 401 is expected without auth
    
    echo ""
    
    # Check processes
    echo "🔄 Processes:"
    check_processes || exit_code=1
    
    echo ""
    
    # Check filesystem
    echo "📁 Filesystem:"
    check_database || exit_code=1
    check_directories || exit_code=1
    
    echo ""
    
    # Check resources
    echo "📊 Resources:"
    check_disk_space || exit_code=1
    check_memory || exit_code=1
    
    echo ""
    
    # Final status
    if [ $exit_code -eq 0 ]; then
        print_status "OK" "All health checks passed"
        echo ""
        echo "🎵 AI Music Uploader is healthy and ready!"
    else
        print_status "ERROR" "Some health checks failed"
        echo ""
        echo "🚨 Please check the issues above"
    fi
    
    exit $exit_code
}

# Run health check
main "$@"
