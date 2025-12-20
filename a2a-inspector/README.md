# A2A Inspector

A web-based inspector for debugging and validating [A2A (Agent-to-Agent) Protocol](https://github.com/google/A2A) implementations.

## Features

- **Agent Discovery** - Connect to any A2A agent via URL
- **Agent Card Validation** - Verify agent cards against the A2A specification
- **Dual Chat Views**:
  - **Direct A2A View** - Raw A2A protocol interaction with SSE streaming
  - **AI SDK View** - Abstracted interaction via Vercel AI SDK
- **Debug Console** - Real-time event logging and message inspection
- **Message Validation** - Check messages for A2A spec compliance

## Quick Start

```bash
# From the repository root
pnpm inspector

# Or from this directory
pnpm dev
```

The inspector will be available at [http://localhost:3002](http://localhost:3002).

## Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start development server on port 3002 |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm lint` | Run Biome linting |
| `pnpm lint:fix` | Fix auto-fixable lint issues |
| `pnpm test` | Run tests |
| `pnpm test:watch` | Run tests in watch mode |

## Architecture

### Tech Stack

- **Framework**: Next.js 15 (App Router)
- **API Routes**: Elysia with Eden Treaty for type-safe API
- **A2A Communication**: `@drew-foxall/a2a-js-sdk`
- **AI SDK Integration**: `@drew-foxall/a2a-ai-provider-v3`
- **UI Components**: AI Elements + shadcn/ui
- **Styling**: Tailwind CSS v4
- **Testing**: Vitest + React Testing Library

### Directory Structure

```
a2a-inspector/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes (Elysia integration)
│   ├── components/        # React components
│   │   ├── direct/       # Direct A2A view components
│   │   ├── sdk/          # AI SDK view components
│   │   └── shared/       # Shared components
│   └── page.tsx          # Main inspector page
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities and helpers
│   ├── eden.ts           # Eden Treaty client
│   └── utils.ts          # General utilities
├── server/               # Elysia server code
│   ├── routes/           # API route modules
│   └── services/         # Business logic
└── types/                # TypeScript type definitions
```

## Development

### Prerequisites

- Node.js >= 22.0.0
- pnpm >= 10.0.0

### Running with an Agent

1. Start the inspector:
   ```bash
   pnpm inspector
   ```

2. Start an A2A agent (e.g., dice agent):
   ```bash
   pnpm worker:dice
   ```

3. Open [http://localhost:3002](http://localhost:3002) and connect to `http://localhost:8787`

## License

Apache-2.0
