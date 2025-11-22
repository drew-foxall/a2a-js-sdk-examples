# A2A Inspector Setup

## 🚀 Quick Start (Recommended for Local Development)

```bash
# Terminal 1: Start local inspector
pnpm inspector

# Terminal 2: Start your agent
pnpm agent:hello-world

# Browser: Open http://127.0.0.1:5001
# Connect to: http://localhost:41244
```

---

## Option 1: Local Inspector (Recommended)

Run the A2A Inspector locally - **best for local development!**

### Why Local?
✅ **Works offline** - No internet required  
✅ **Full control** - Can modify/debug inspector  
✅ **Faster** - No network latency  
✅ **Privacy** - All data stays local

Run the A2A Inspector locally on your machine.

### Prerequisites

1. **Python 3.10+** with [uv](https://github.com/astral-sh/uv)
2. **Node.js** and npm
3. **a2a-inspector repository** cloned

### Setup (One-Time)

```bash
# Navigate to where you keep repos
cd /Users/Drew_Garratt/Development

# Clone if you haven't already
# git clone https://github.com/a2aproject/a2a-inspector.git

cd a2a-inspector

# Install Python dependencies
uv sync

# Install Node.js dependencies
cd frontend
npm install
cd ..

# Make run script executable
chmod +x scripts/run.sh
```

### Running

#### Quick Start (One Command)

```bash
pnpm inspector
```

This starts the backend and builds the frontend, opening at: **http://127.0.0.1:5001**

**Other Commands:**
```bash
pnpm inspector:stop    # Stop the inspector
pnpm inspector:logs    # View logs
pnpm inspector:help    # Show help
```

#### Manual Mode (For Inspector Development)

If you need to modify the inspector UI with live reload:

**Terminal 1 - Frontend (with watch):**
```bash
cd /Users/Drew_Garratt/Development/a2a-inspector/frontend
npm run build -- --watch
```

**Terminal 2 - Backend:**
```bash
cd /Users/Drew_Garratt/Development/a2a-inspector/backend
uv run app.py
```

Opens at: **http://127.0.0.1:5001**

### Usage

```bash
# Terminal 1: Start local inspector
pnpm inspector

# Terminal 2: Start your agent
pnpm agent:hello-world

# Stop inspector when done
pnpm inspector:stop
```

Then open browser to: **http://127.0.0.1:5001**

---

## Option 2: Hosted Inspector (Backup Option)

Use the official hosted version at **https://inspector.a2a.plus**

### Usage
```bash
# 1. Start your agent
pnpm agent:hello-world

# 2. Open browser to https://inspector.a2a.plus
# 3. Connect to: http://localhost:41244
```

⚠️ **Note**: The hosted inspector may not always support the latest local protocol versions. Use local inspector for development.

---

## Complete Testing Workflow

### Recommended (Local Inspector)

```bash
# 1. Start inspector (Terminal 1)
pnpm inspector

# 2. Start agent (Terminal 2)
pnpm agent:hello-world

# 3. Open browser
open http://127.0.0.1:5001

# 4. Connect to agent
http://localhost:41244

# 5. When done, stop inspector
pnpm inspector:stop
```

---

## Comparison

| Feature | Local Inspector | Hosted Inspector |
|---------|-----------------|------------------|
| **URL** | http://127.0.0.1:5001 | https://inspector.a2a.plus |
| **Setup Required** | ✅ Yes (one-time) | ❌ No |
| **Internet Required** | ❌ No | ✅ Yes |
| **Protocol Version** | ✅ Always matches your agents | ⚠️ May lag behind |
| **Modify Inspector** | ✅ Yes | ❌ No |
| **Speed** | ✅ Local (fastest) | ⚠️ Network dependent |
| **Privacy** | ✅ All data local | ⚠️ Data sent to external server |
| **Commands** | `pnpm inspector` | Open URL in browser |
| **Best For** | **Local development** | Quick demos, public agents |

---

## Recommended Setup

### For Local Development (Recommended)
Use **Local Inspector** (`pnpm inspector`)
- ✅ Guaranteed protocol compatibility
- ✅ Works offline
- ✅ Faster
- ✅ Private
- ✅ One-time setup

### For Quick Demos/Public Testing
Use **Hosted Inspector** (https://inspector.a2a.plus)
- ✅ No setup needed
- ✅ Share with others easily
- ⚠️ Requires internet
- ⚠️ May not support latest protocol changes

---

## Troubleshooting

### Local Inspector Won't Start

**Problem:** `uv sync` fails
```bash
# Install uv first
curl -LsSf https://astral.sh/uv/install.sh | sh
```

**Problem:** Frontend build fails
```bash
cd /Users/Drew_Garratt/Development/a2a-inspector/frontend
rm -rf node_modules package-lock.json
npm install
```

**Problem:** Port 5001 already in use
```bash
# Find and kill process using port 5001
lsof -ti:5001 | xargs kill -9
```

### Agent Connection Issues

**Both hosted and local inspectors:**

1. ✅ Verify agent is running: `curl http://localhost:41244/.well-known/agent-card.json`
2. ✅ Check correct port number
3. ✅ Use `http://` not `https://` for localhost
4. ✅ Ensure no CORS issues (agents should allow inspector origin)

---

## Quick Reference

### Start Local Inspector Testing (Recommended)
```bash
# Terminal 1: Start inspector
pnpm inspector

# Terminal 2: Start agent
pnpm agent:hello-world

# Browser: http://127.0.0.1:5001
# Connect: http://localhost:41244

# Stop inspector
pnpm inspector:stop
```

### Inspector Commands
```bash
pnpm inspector          # Start local inspector
pnpm inspector:stop     # Stop inspector
pnpm inspector:logs     # View inspector logs
pnpm inspector:help     # Show help
```

---

## Next Steps

1. **Try hosted inspector first** (easiest)
2. **Set up local inspector** if you need offline/customization
3. **Read**: [TEST_WORKFLOW.md](TEST_WORKFLOW.md) for complete testing guide

**Happy Testing! 🚀**

