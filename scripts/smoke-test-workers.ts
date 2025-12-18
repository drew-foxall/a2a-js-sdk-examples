#!/usr/bin/env tsx
/**
 * Worker Smoke Test Script
 *
 * LOCAL smoke tests for Cloudflare Workers:
 * 1. Build errors (catches Node.js dependency issues)
 * 2. Runtime startup (catches initialization errors)
 * 3. Basic endpoint responses (health check, agent card)
 *
 * For deployed endpoint testing, use integration tests instead:
 *   pnpm test:integration --url https://...
 *
 * Usage:
 *   pnpm smoke:workers           # Test all workers (build + runtime)
 *   pnpm smoke:workers --quick   # Build-only test (faster)
 *   pnpm smoke:workers --filter dice  # Test specific workers
 *
 * Exit codes:
 *   0 - All tests passed
 *   1 - One or more tests failed
 */

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  runEndpointTests,
  type EndpointTestResults,
} from "../examples/workers/shared/endpoint-tests.js";

// ============================================================================
// Configuration
// ============================================================================

interface WorkerConfig {
  name: string;
  path: string;
  port: number;
  /** Workers that require nodejs_compat flag (durable workers) */
  requiresNodeCompat?: boolean;
  /** Workers that need special handling */
  skipRuntimeTest?: boolean;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WORKERS_DIR = resolve(__dirname, "../examples/workers");
const DEFAULT_TIMEOUT_MS = 30000;
const STARTUP_WAIT_MS = 5000;

// Port assignments to avoid conflicts during parallel testing
const BASE_PORT = 8800;

/**
 * Strip ANSI escape codes from a string
 * These are the color/formatting codes that terminals use (ESC[...m)
 */
function stripAnsiCodes(str: string): string {
  // Match ESC (0x1B) followed by [ and any number of digits/semicolons, ending with m
  // Using character code approach to avoid linter issues with control characters
  const ESC = String.fromCharCode(0x1b);
  let result = str;
  let start = result.indexOf(ESC + '[');
  
  while (start !== -1) {
    // Find the end of the escape sequence (the 'm' character)
    let end = start + 2;
    while (end < result.length && result[end] !== 'm') {
      end++;
    }
    if (end < result.length) {
      result = result.slice(0, start) + result.slice(end + 1);
      // Search again from the same position (string got shorter)
      start = result.indexOf(ESC + '[', start);
    } else {
      break;
    }
  }
  
  return result;
}

// ============================================================================
// Worker Discovery
// ============================================================================

function discoverWorkers(): WorkerConfig[] {
  const workers: WorkerConfig[] = [];
  const entries = readdirSync(WORKERS_DIR, { withFileTypes: true });

  let portOffset = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === "shared" || entry.name === "node_modules") continue;

    const workerPath = join(WORKERS_DIR, entry.name);
    const wranglerPath = join(workerPath, "wrangler.toml");
    const packagePath = join(workerPath, "package.json");

    // Must have wrangler.toml to be a worker
    if (!existsSync(wranglerPath)) continue;

    // Read package.json to get worker name
    let workerName = entry.name;
    if (existsSync(packagePath)) {
      try {
        const pkg = JSON.parse(readFileSync(packagePath, "utf-8"));
        workerName = pkg.name || entry.name;
      } catch {
        // Use directory name as fallback
      }
    }

    // Check if worker uses nodejs_compat (durable workers)
    const wranglerContent = readFileSync(wranglerPath, "utf-8");
    const isDurable = entry.name.includes("durable");
    const requiresNodeCompat =
      wranglerContent.includes("nodejs_compat") || isDurable;
    
    // Durable workers and MCP servers need special handling for local dev
    const isMcpServer = entry.name.includes("mcp");
    const skipRuntimeTest = isDurable || isMcpServer;

    workers.push({
      name: workerName,
      path: workerPath,
      port: BASE_PORT + portOffset++,
      requiresNodeCompat,
      skipRuntimeTest,
    });
  }

  return workers.sort((a, b) => a.name.localeCompare(b.name));
}

// ============================================================================
// Test Execution
// ============================================================================

interface TestResult {
  worker: string;
  buildPassed: boolean;
  runtimePassed: boolean | null;
  healthCheckPassed: boolean | null;
  agentCardPassed: boolean | null;
  error?: string;
  duration: number;
}

async function testWorkerBuild(worker: WorkerConfig): Promise<{
  passed: boolean;
  error?: string;
}> {
  return new Promise((resolve) => {
    // Use wrangler's build command to test bundling
    const proc = spawn(
      "npx",
      ["wrangler", "deploy", "--dry-run", "--outdir", ".wrangler/tmp-build"],
      {
        cwd: worker.path,
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          // Provide dummy env vars to satisfy wrangler
          OPENAI_API_KEY: "sk-test-dummy",
          ANTHROPIC_API_KEY: "sk-ant-test-dummy",
          GOOGLE_API_KEY: "test-dummy",
        },
      }
    );

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    const timeout = setTimeout(() => {
      proc.kill("SIGTERM");
      resolve({
        passed: false,
        error: `Build timed out after ${DEFAULT_TIMEOUT_MS}ms`,
      });
    }, DEFAULT_TIMEOUT_MS);

    proc.on("close", (code) => {
      clearTimeout(timeout);

      if (code === 0) {
        resolve({ passed: true });
      } else {
        // Extract meaningful error from output
        const output = stderr || stdout;
        
        // Try to find the most specific error message
        // Look for "Could not resolve" errors first (common bundling issue)
        const resolveError = output.match(/Could not resolve "([^"]+)"/);
        if (resolveError) {
          resolve({ 
            passed: false, 
            error: `Could not resolve "${resolveError[1]}" - likely a Node.js dependency leak. Add nodejs_compat or remove the dependency.`
          });
          return;
        }
        
        // Look for general ERROR blocks
        const errorMatch = output.match(/\[ERROR\].*?(?=\n\n|\[WARNING|$)/s);
        // Strip ANSI escape codes from error message (ESC[...m sequences)
        const error = errorMatch
          ? stripAnsiCodes(errorMatch[0]).trim()
          : `Build failed with exit code ${code}`;

        resolve({ passed: false, error });
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      resolve({ passed: false, error: err.message });
    });
  });
}

async function testWorkerRuntime(worker: WorkerConfig): Promise<{
  healthCheckPassed: boolean;
  agentCardPassed: boolean;
  endpointResults?: EndpointTestResults;
  error?: string;
  proc?: ChildProcess;
}> {
  return new Promise((resolve) => {
    // Get API keys from environment or use dummy values for smoke tests
    // These are passed via --var flags so wrangler makes them available to the worker
    const openaiKey = process.env.OPENAI_API_KEY || "sk-test-dummy-key-for-smoke-tests";
    const anthropicKey = process.env.ANTHROPIC_API_KEY || "sk-ant-test-dummy";
    const googleKey = process.env.GOOGLE_API_KEY || "test-dummy";
    
    // Start the worker with API keys passed via --var flags
    const proc = spawn("npx", [
      "wrangler", "dev", 
      "--port", String(worker.port),
      "--var", `OPENAI_API_KEY:${openaiKey}`,
      "--var", `ANTHROPIC_API_KEY:${anthropicKey}`,
      "--var", `GOOGLE_API_KEY:${googleKey}`,
    ], {
      cwd: worker.path,
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    // Wait for startup, then test endpoints
    const startupTimeout = setTimeout(async () => {
      // Check if process is still running
      if (proc.killed || proc.exitCode !== null) {
        const output = stderr || stdout;
        const errorMatch = output.match(/\[ERROR\].*?(?=\n\n|\[|$)/s);
        resolve({
          healthCheckPassed: false,
          agentCardPassed: false,
          error: errorMatch ? errorMatch[0].trim() : "Worker failed to start",
          proc,
        });
        return;
      }

      // Use shared endpoint tests
      // Note: We don't pass expectedAgentName for smoke tests - we just verify
      // the endpoints respond correctly, not that they match a specific name
      try {
        const endpointResults = await runEndpointTests({
          name: worker.name,
          target: {
            type: "url",
            baseUrl: `http://localhost:${worker.port}`,
          },
          // Don't validate specific agent name in smoke tests
        });

        const healthTest = endpointResults.tests.find(t => t.name === "Health Check");
        const cardTest = endpointResults.tests.find(t => t.name === "Agent Card");
        
        // Extract error details from failed tests
        const failedTests = endpointResults.tests.filter(t => !t.passed);
        const errorDetails = failedTests.length > 0
          ? failedTests.map(t => `${t.name}: ${t.error || "unknown error"}`).join("\n")
          : undefined;

        resolve({
          healthCheckPassed: healthTest?.passed ?? false,
          agentCardPassed: cardTest?.passed ?? false,
          endpointResults,
          error: errorDetails,
          proc,
        });
      } catch (e) {
        resolve({
          healthCheckPassed: false,
          agentCardPassed: false,
          error: e instanceof Error ? e.message : String(e),
          proc,
        });
      }
    }, STARTUP_WAIT_MS);

    // Handle early exit
    proc.on("close", (code) => {
      if (code !== 0) {
        clearTimeout(startupTimeout);
        const output = stderr || stdout;
        const errorMatch = output.match(/\[ERROR\].*?(?=\n\n|\[|$)/s);
        resolve({
          healthCheckPassed: false,
          agentCardPassed: false,
          error: errorMatch
            ? errorMatch[0].trim()
            : `Worker exited with code ${code}`,
          proc,
        });
      }
    });

    proc.on("error", (err) => {
      clearTimeout(startupTimeout);
      resolve({
        healthCheckPassed: false,
        agentCardPassed: false,
        error: err.message,
        proc,
      });
    });
  });
}


async function testWorker(
  worker: WorkerConfig,
  options: { quickMode: boolean }
): Promise<TestResult> {
  const startTime = Date.now();
  const result: TestResult = {
    worker: worker.name,
    buildPassed: false,
    runtimePassed: null,
    healthCheckPassed: null,
    agentCardPassed: null,
    duration: 0,
  };

  // Test 1: Build
  console.log(`  📦 Building ${worker.name}...`);
  const buildResult = await testWorkerBuild(worker);
  result.buildPassed = buildResult.passed;

  if (!buildResult.passed) {
    result.error = buildResult.error;
    result.duration = Date.now() - startTime;
    return result;
  }

  // Test 2: Runtime (if not quick mode)
  if (!options.quickMode && !worker.skipRuntimeTest) {
    console.log(`  🚀 Starting ${worker.name} on port ${worker.port}...`);
    const runtimeResult = await testWorkerRuntime(worker);

    result.healthCheckPassed = runtimeResult.healthCheckPassed;
    result.agentCardPassed = runtimeResult.agentCardPassed;
    result.runtimePassed =
      runtimeResult.healthCheckPassed && runtimeResult.agentCardPassed;

    // Capture error details from endpoint tests
    if (runtimeResult.error) {
      result.error = runtimeResult.error;
    } else if (!result.runtimePassed && runtimeResult.endpointResults) {
      // Extract errors from failed endpoint tests
      const failedTests = runtimeResult.endpointResults.tests.filter(t => !t.passed);
      if (failedTests.length > 0) {
        result.error = failedTests
          .map(t => `${t.name}: ${t.error || "failed"}`)
          .join("\n");
      }
    }

    // Clean up the process
    if (runtimeResult.proc && !runtimeResult.proc.killed) {
      runtimeResult.proc.kill("SIGTERM");
    }
  }

  result.duration = Date.now() - startTime;
  return result;
}

// ============================================================================
// Output Formatting
// ============================================================================

function formatResult(result: TestResult): string {
  const buildIcon = result.buildPassed ? "✅" : "❌";
  const runtimeIcon =
    result.runtimePassed === null
      ? "⏭️"
      : result.runtimePassed
        ? "✅"
        : "❌";

  let status = `${buildIcon} Build`;
  if (result.runtimePassed !== null) {
    status += ` | ${runtimeIcon} Runtime`;
    if (result.healthCheckPassed !== null) {
      status += ` (health: ${result.healthCheckPassed ? "✓" : "✗"}, card: ${result.agentCardPassed ? "✓" : "✗"})`;
    }
  }

  const duration = `${(result.duration / 1000).toFixed(1)}s`;

  return `${result.worker.padEnd(35)} ${status.padEnd(50)} ${duration}`;
}

function printSummary(results: TestResult[]): void {
  const passed = results.filter(
    (r) => r.buildPassed && (r.runtimePassed === null || r.runtimePassed)
  );
  const failed = results.filter(
    (r) => !r.buildPassed || (r.runtimePassed !== null && !r.runtimePassed)
  );

  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));
  console.log(`Total:  ${results.length} workers`);
  console.log(`Passed: ${passed.length}`);
  console.log(`Failed: ${failed.length}`);

  if (failed.length > 0) {
    console.log("\n❌ FAILED WORKERS:");
    for (const result of failed) {
      console.log(`\n  ${result.worker}:`);
      if (result.error) {
        // Indent error message
        const indentedError = result.error
          .split("\n")
          .map((line) => `    ${line}`)
          .join("\n");
        console.log(indentedError);
      }
    }
  }

  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  console.log(`\nTotal time: ${(totalDuration / 1000).toFixed(1)}s`);
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const quickMode = args.includes("--quick");
  const filterArg = args.findIndex((a) => a === "--filter");
  const filter = filterArg !== -1 ? args[filterArg + 1] : null;

  console.log("🔍 Worker Smoke Tests (Local)");
  console.log("=".repeat(80));

  if (quickMode) {
    console.log("Mode: Quick (build-only)");
  } else {
    console.log("Mode: Full (build + runtime)");
  }

  // Discover workers
  let workers = discoverWorkers();

  if (filter) {
    workers = workers.filter(
      (w) =>
        w.name.toLowerCase().includes(filter.toLowerCase()) ||
        w.path.toLowerCase().includes(filter.toLowerCase())
    );
    console.log(`Filter: "${filter}" (${workers.length} workers matched)`);
  }

  console.log(`\nTesting ${workers.length} workers...\n`);
  console.log("-".repeat(80));

  // Run tests sequentially to avoid port conflicts
  const results: TestResult[] = [];

  for (const worker of workers) {
    console.log(`\n🧪 Testing: ${worker.name}`);
    const result = await testWorker(worker, { quickMode });
    results.push(result);
    console.log(`  ${formatResult(result)}`);
  }

  // Print summary
  printSummary(results);

  // Exit with appropriate code
  const hasFailures = results.some(
    (r) => !r.buildPassed || (r.runtimePassed !== null && !r.runtimePassed)
  );
  process.exit(hasFailures ? 1 : 0);
}

main().catch((err) => {
  console.error("Smoke test failed:", err);
  process.exit(1);
});


