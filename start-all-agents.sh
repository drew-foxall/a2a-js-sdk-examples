#!/bin/bash

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Start Content Editor Agent (port 41243)
cd samples/js
pnpm agents:content-editor > /tmp/content-editor.log 2>&1 &
CONTENT_PID=$!
echo "Started Content Editor Agent (PID: $CONTENT_PID) on port 41243"
cd ../..

# Start Coder Agent (port 41242)
cd samples/js
pnpm agents:coder > /tmp/coder.log 2>&1 &
CODER_PID=$!
echo "Started Coder Agent (PID: $CODER_PID) on port 41242"
cd ../..

# Start Movie Agent (port 41241)
cd samples/js
pnpm agents:movie-agent > /tmp/movie.log 2>&1 &
MOVIE_PID=$!
echo "Started Movie Agent (PID: $MOVIE_PID) on port 41241"
cd ../..

echo ""
echo "All agents started! Waiting 5 seconds for initialization..."
sleep 5

echo ""
echo "=== Testing Agent Endpoints ==="
echo ""

echo "1. Content Editor Agent (41243):"
curl -s http://localhost:41243/.well-known/agent-card.json | jq -r '.name' 2>/dev/null || echo "❌ Not responding"

echo ""
echo "2. Coder Agent (41242):"
curl -s http://localhost:41242/.well-known/agent-card.json | jq -r '.name' 2>/dev/null || echo "❌ Not responding"

echo ""
echo "3. Movie Agent (41241):"
curl -s http://localhost:41241/.well-known/agent-card.json | jq -r '.name' 2>/dev/null || echo "❌ Not responding"

echo ""
echo "Process IDs saved to /tmp/agent-pids.txt"
echo "$CONTENT_PID $CODER_PID $MOVIE_PID" > /tmp/agent-pids.txt

