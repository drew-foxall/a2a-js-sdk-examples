#!/usr/bin/env tsx

/**
 * View A2A Inspector Logs
 *
 * Displays the last 20 lines of both backend and frontend logs.
 */

import { existsSync, readFileSync } from "node:fs";

const BACKEND_LOG = "/tmp/a2a-inspector-backend.log";
const FRONTEND_LOG = "/tmp/a2a-inspector-frontend.log";

function tailFile(filepath: string, lines = 20): string[] {
  if (!existsSync(filepath)) {
    return [];
  }

  const content = readFileSync(filepath, "utf-8");
  const allLines = content.split("\n");
  return allLines.slice(-lines);
}

function main() {
  console.log("📋 A2A Inspector Logs\n");

  // Backend logs
  console.log("=== Backend (last 20 lines) ===");
  const backendLines = tailFile(BACKEND_LOG);
  if (backendLines.length === 0) {
    console.log("(no logs found)");
  } else {
    console.log(backendLines.join("\n"));
  }

  console.log("\n");

  // Frontend logs
  console.log("=== Frontend (last 20 lines) ===");
  const frontendLines = tailFile(FRONTEND_LOG);
  if (frontendLines.length === 0) {
    console.log("(no logs found)");
  } else {
    console.log(frontendLines.join("\n"));
  }

  console.log("\n");
  console.log("Full logs:");
  console.log(`  Backend:  tail -f ${BACKEND_LOG}`);
  console.log(`  Frontend: tail -f ${FRONTEND_LOG}`);
}

main();

