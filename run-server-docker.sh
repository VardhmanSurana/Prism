#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

COMMAND="${1:-up}"

case "$COMMAND" in
    up|start)
        echo "🚀 Starting Prism Companion Server via Docker Compose..."
        docker compose up -d --build
        echo "✅ Prism Companion Server is running at http://localhost:8269"
        echo "   Healthcheck: http://localhost:8269/health"
        ;;
    down|stop)
        echo "🛑 Stopping Prism Companion Server..."
        docker compose down
        echo "✅ Server stopped."
        ;;
    build)
        echo "🔨 Building Prism Companion Server Docker image..."
        docker compose build
        ;;
    logs)
        echo "📋 Fetching server logs..."
        docker compose logs -f
        ;;
    status|health)
        echo "🔍 Checking container status..."
        docker compose ps
        echo ""
        echo "Checking health endpoint..."
        curl -s http://localhost:8269/health || echo "Server is not responding to healthcheck."
        ;;
    *)
        echo "Usage: $0 {up|down|build|logs|status}"
        exit 1
        ;;
esac
