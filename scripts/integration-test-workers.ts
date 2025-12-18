#!/usr/bin/env tsx
/**
 * Worker Integration Test Script
 *
 * Tests DEPLOYED Cloudflare Workers for:
 * 1. Health check endpoint
 * 2. Agent card endpoint
 * 3. CORS headers
 * 4. 404 handling
 * 5. Message handling (optional, makes real AI calls)
 *
 * For local testing, use smoke tests instead:
 *   pnpm smoke:workers
 *
 * Usage:
 *   pnpm test:integration --url https://my-worker.workers.dev
 *   pnpm test:integration --deployed  # Uses DEPLOYED_WORKERS env var
 *   pnpm test:integration --deployed --filter hello
 *
 * Environment:
 *   DEPLOYED_WORKERS='hello-world=https://...,dice=https://...'
 *   RUN_MESSAGE_TESTS=true  # Include message/send tests (makes AI calls)
 *
 * Exit codes:
 *   0 - All tests passed
 *   1 - One or more tests failed
 */

import {
  runEndpointTests,
  formatTestResults,
  type EndpointTestResults,
} from "../examples/workers/shared/endpoint-tests.js";

// ============================================================================
// Configuration
// ============================================================================

interface WorkerEndpoint {
  name: string;
  url: string;
  expectedAgentName?: string;
}

// Known deployed worker URLs (can be overridden by env var)
const KNOWN_WORKERS: Record<string, { expectedAgentName: string }> = {
  "hello-world": { expectedAgentName: "Hello World Agent" },
  "dice": { expectedAgentName: "Dice Agent" },
  "dice-durable": { expectedAgentName: "Dice Agent" },
  "currency": { expectedAgentName: "Currency Agent" },
  "weather": { expectedAgentName: "Weather Agent" },
  "airbnb": { expectedAgentName: "Airbnb Agent" },
  "planner": { expectedAgentName: "Travel Planner" },
  "image-generator": { expectedAgentName: "Image Generator Agent" },
  "github": { expectedAgentName: "GitHub Agent" },
  "analytics": { expectedAgentName: "Analytics Agent" },
};

// ============================================================================
// Test Execution
// ============================================================================

interface IntegrationTestResult {
  worker: string;
  url: string;
  passed: boolean;
  testResults: EndpointTestResults;
  duration: number;
}

async function testDeployedWorker(
  endpoint: WorkerEndpoint
): Promise<IntegrationTestResult> {
  const startTime = Date.now();

  const testResults = await runEndpointTests({
    name: endpoint.name,
    target: { type: "url", baseUrl: endpoint.url },
    expectedAgentName: endpoint.expectedAgentName || endpoint.name,
  });

  return {
    worker: endpoint.name,
    url: endpoint.url,
    passed: testResults.summary.failed === 0,
    testResults,
    duration: Date.now() - startTime,
  };
}

// ============================================================================
// Output Formatting
// ============================================================================

function formatResult(result: IntegrationTestResult): string {
  const icon = result.passed ? "✅" : "❌";
  const status = result.passed ? "PASS" : "FAIL";
  const tests = `${result.testResults.summary.passed}/${result.testResults.summary.total}`;
  const duration = `${(result.duration / 1000).toFixed(1)}s`;

  return `${icon} ${result.worker.padEnd(30)} ${status.padEnd(6)} ${tests.padEnd(8)} ${duration}`;
}

function printSummary(results: IntegrationTestResult[]): void {
  const passed = results.filter((r) => r.passed);
  const failed = results.filter((r) => !r.passed);

  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));
  console.log(`Total:  ${results.length} workers`);
  console.log(`Passed: ${passed.length}`);
  console.log(`Failed: ${failed.length}`);

  if (failed.length > 0) {
    console.log("\n❌ FAILED WORKERS:");
    for (const result of failed) {
      console.log(`\n  ${result.worker} (${result.url}):`);
      for (const test of result.testResults.tests) {
        if (!test.passed) {
          console.log(`    ❌ ${test.name}: ${test.error}`);
        }
      }
    }
  }

  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  console.log(`\nTotal time: ${(totalDuration / 1000).toFixed(1)}s`);
}

// ============================================================================
// CLI Parsing
// ============================================================================

function parseDeployedWorkers(): WorkerEndpoint[] {
  const envVar = process.env.DEPLOYED_WORKERS;
  if (!envVar) return [];

  return envVar.split(",").map((pair) => {
    const [name, url] = pair.split("=");
    const trimmedName = name.trim();
    const knownConfig = KNOWN_WORKERS[trimmedName];
    
    return {
      name: trimmedName,
      url: url.trim(),
      expectedAgentName: knownConfig?.expectedAgentName,
    };
  });
}

function printUsage(): void {
  console.log(`
Worker Integration Tests - Test deployed Cloudflare Workers

Usage:
  pnpm test:integration --url <url>           Test a single deployed URL
  pnpm test:integration --deployed            Test all workers in DEPLOYED_WORKERS
  pnpm test:integration --deployed --filter <name>  Filter workers by name

Options:
  --url <url>       Test a specific deployed URL
  --deployed        Test workers from DEPLOYED_WORKERS env var
  --filter <name>   Filter workers by name (partial match)
  --name <name>     Specify worker name for --url mode
  --help            Show this help message

Environment Variables:
  DEPLOYED_WORKERS  Comma-separated list of name=url pairs
                    Example: 'hello-world=https://...,dice=https://...'
  
  RUN_MESSAGE_TESTS Set to 'true' to include message/send tests
                    (makes real AI API calls, requires API keys)

Examples:
  # Test a specific URL
  pnpm test:integration --url https://hello-world.workers.dev

  # Test with custom name
  pnpm test:integration --url https://hello-world.workers.dev --name "Hello World Agent"

  # Test all deployed workers
  DEPLOYED_WORKERS='hello=https://a.workers.dev,dice=https://b.workers.dev' \\
    pnpm test:integration --deployed

  # Filter deployed workers
  pnpm test:integration --deployed --filter dice
`);
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Help
  if (args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  // Parse arguments
  const deployedMode = args.includes("--deployed");
  const urlArg = args.findIndex((a) => a === "--url");
  const singleUrl = urlArg !== -1 ? args[urlArg + 1] : null;
  const nameArg = args.findIndex((a) => a === "--name");
  const customName = nameArg !== -1 ? args[nameArg + 1] : null;
  const filterArg = args.findIndex((a) => a === "--filter");
  const filter = filterArg !== -1 ? args[filterArg + 1] : null;

  console.log("🧪 Worker Integration Tests (Deployed)");
  console.log("=".repeat(80));

  // Single URL mode
  if (singleUrl) {
    console.log(`Target: ${singleUrl}`);
    if (process.env.RUN_MESSAGE_TESTS === "true") {
      console.log("⚠️  Message tests enabled (will make real AI API calls)");
    }
    console.log("-".repeat(80));

    const result = await testDeployedWorker({
      name: customName || "Custom URL",
      url: singleUrl,
      expectedAgentName: customName ?? undefined,
    });

    console.log(`\n${formatResult(result)}`);
    
    // Print detailed test results
    console.log(formatTestResults(result.testResults));

    process.exit(result.passed ? 0 : 1);
    return;
  }

  // Deployed mode
  if (deployedMode) {
    let endpoints = parseDeployedWorkers();

    if (endpoints.length === 0) {
      console.log("\n❌ No deployed worker URLs configured");
      console.log("\nSet DEPLOYED_WORKERS environment variable:");
      console.log("  DEPLOYED_WORKERS='hello-world=https://...,dice=https://...'");
      console.log("\nOr use --url to test a specific endpoint:");
      console.log("  pnpm test:integration --url https://my-worker.workers.dev");
      process.exit(1);
    }

    // Apply filter
    if (filter) {
      endpoints = endpoints.filter((e) =>
        e.name.toLowerCase().includes(filter.toLowerCase())
      );
      console.log(`Filter: "${filter}" (${endpoints.length} workers matched)`);
    }

    if (process.env.RUN_MESSAGE_TESTS === "true") {
      console.log("⚠️  Message tests enabled (will make real AI API calls)");
    }

    console.log(`\nTesting ${endpoints.length} deployed workers...\n`);
    console.log("-".repeat(80));

    const results: IntegrationTestResult[] = [];

    for (const endpoint of endpoints) {
      console.log(`\n🧪 Testing: ${endpoint.name}`);
      console.log(`   URL: ${endpoint.url}`);
      
      const result = await testDeployedWorker(endpoint);
      results.push(result);
      
      console.log(`   ${formatResult(result)}`);
    }

    printSummary(results);

    const hasFailures = results.some((r) => !r.passed);
    process.exit(hasFailures ? 1 : 0);
    return;
  }

  // No mode specified
  console.log("\n❌ No test target specified");
  console.log("\nUse --url to test a specific endpoint:");
  console.log("  pnpm test:integration --url https://my-worker.workers.dev");
  console.log("\nOr use --deployed with DEPLOYED_WORKERS env var:");
  console.log("  DEPLOYED_WORKERS='hello=https://...' pnpm test:integration --deployed");
  console.log("\nRun with --help for more options.");
  process.exit(1);
}

main().catch((err) => {
  console.error("Integration test failed:", err);
  process.exit(1);
});

