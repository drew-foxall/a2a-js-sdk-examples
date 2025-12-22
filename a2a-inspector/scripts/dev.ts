#!/usr/bin/env bun
/**
 * Development server startup script for A2A Inspector
 *
 * This script prints informational messages about expected warnings
 * before starting the Next.js development server.
 */

const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

console.log(`
${CYAN}╭─────────────────────────────────────────────────────────────────────────────╮
│  A2A Inspector - Development Server                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ${DIM}NOTE: You may see Bun warnings about async_hooks not being implemented.${RESET}${CYAN}    │
│  ${DIM}These come from @opentelemetry (optional Next.js dependency) and are${RESET}${CYAN}       │
│  ${DIM}harmless - the inspector works correctly without async_hooks support.${RESET}${CYAN}      │
│                                                                             │
╰─────────────────────────────────────────────────────────────────────────────╯${RESET}
`);

// Start Next.js dev server
const proc = Bun.spawn(["bun", "--bun", "next", "dev", "--port", "3002"], {
  cwd: `${import.meta.dir}/..`,
  stdio: ["inherit", "inherit", "inherit"],
});

// Forward exit code
process.on("SIGINT", () => proc.kill());
process.on("SIGTERM", () => proc.kill());

const exitCode = await proc.exited;
process.exit(exitCode);
