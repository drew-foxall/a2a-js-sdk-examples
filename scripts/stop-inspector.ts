#!/usr/bin/env tsx

/**
 * Stop Local A2A Inspector
 *
 * Kills any process listening on port 5001 (the inspector backend).
 */

import { spawn } from "node:child_process";

const PORT = 5001;

async function killPort(port: number): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const killer = spawn("lsof", ["-ti", `:${port}`]);
    let pids = "";

    killer.stdout.on("data", (data) => {
      pids += data.toString();
    });

    killer.stderr.on("data", (_data) => {
      // Ignore stderr (usually just means no process found)
    });

    killer.on("close", (_code) => {
      if (!pids.trim()) {
        resolve([]);
        return;
      }

      const pidList = pids.trim().split("\n").filter(Boolean);
      const killedPids: string[] = [];

      for (const pid of pidList) {
        try {
          process.kill(Number.parseInt(pid, 10), "SIGKILL");
          killedPids.push(pid);
        } catch (_err) {
          // Process might already be dead
        }
      }

      resolve(killedPids);
    });

    killer.on("error", (err) => {
      // lsof command not found or other error
      reject(err);
    });
  });
}

async function main() {
  console.log(`🛑 Stopping A2A Inspector (port ${PORT})...`);

  try {
    const killedPids = await killPort(PORT);

    if (killedPids.length === 0) {
      console.log("✅ No inspector process running");
    } else {
      console.log(`✅ Stopped inspector (PIDs: ${killedPids.join(", ")})`);
    }
  } catch (err) {
    console.error("❌ Error stopping inspector:", err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
