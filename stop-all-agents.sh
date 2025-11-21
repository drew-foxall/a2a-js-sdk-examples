#!/bin/bash
# ⚠️ DEPRECATED: This script will be removed in Phase 3
# Use Turborepo + Vitest instead: pnpm test

echo "Stopping all agents..."

# Kill by port
for port in 41241 41242 41243; do
  PID=$(lsof -ti:$port)
  if [ ! -z "$PID" ]; then
    kill $PID 2>/dev/null
    echo "Stopped agent on port $port (PID: $PID)"
  fi
done

echo "All agents stopped."

