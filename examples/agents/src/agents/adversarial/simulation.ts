/**
 * Adversarial Simulation Runner
 *
 * This script runs an adversarial simulation between the attacker and defender.
 * Start the defender server first, then run this script.
 *
 * Usage:
 *   1. Start defender: pnpm run dev:defender
 *   2. Run simulation: pnpm run adversarial:simulate
 */

import { getModel, getModelInfo } from "../../shared/utils";
import { runAdversarialSimulation } from "./attacker";

const DEFENDER_URL = process.env.DEFENDER_URL || "http://localhost:4013";
const MAX_TURNS = parseInt(process.env.MAX_TURNS || "10", 10);

/**
 * Send a message to the defender via A2A protocol
 */
async function sendMessageToDefender(message: string): Promise<string> {
  const response = await fetch(`${DEFENDER_URL}/message/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "message/send",
      params: {
        message: {
          role: "user",
          parts: [{ type: "text", text: message }],
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Defender responded with ${response.status}`);
  }

  const data = (await response.json()) as {
    result?: {
      artifacts?: Array<{
        parts?: Array<{ type: string; text?: string }>;
      }>;
    };
  };

  // Extract text from response
  if (data.result?.artifacts) {
    for (const artifact of data.result.artifacts) {
      for (const part of artifact.parts || []) {
        if (part.type === "text" && part.text) {
          return part.text;
        }
      }
    }
  }

  return "No response from defender";
}

async function main() {
  const modelInfo = getModelInfo();
  console.log(`
🎮 Adversarial Simulation Starting...
⚔️  Attacker Model: ${modelInfo.provider}/${modelInfo.model}
🛡️  Defender URL: ${DEFENDER_URL}
🔄 Max Turns: ${MAX_TURNS}
`);

  // Run simulation
  const model = getModel();
  const result = await runAdversarialSimulation(model, sendMessageToDefender, MAX_TURNS);

  // Print results
  console.log("\n" + "=".repeat(60));
  console.log("SIMULATION RESULTS");
  console.log("=".repeat(60));
  console.log(`\nOutcome: ${result.success ? "ATTACKER WON" : "DEFENDER WON"}`);
  console.log(`Turns: ${result.turns}/${result.maxTurns}`);
  console.log(`Summary: ${result.summary}`);

  console.log("\n" + "-".repeat(60));
  console.log("CONVERSATION LOG");
  console.log("-".repeat(60));

  for (const log of result.logs) {
    console.log(`\n[Turn ${log.turn}] ${log.timestamp}`);
    console.log(`Attacker: ${log.attackerAction}`);
    if (log.defenderResponse) {
      console.log(`Defender: ${log.defenderResponse}`);
    }
  }

  console.log("\n" + "=".repeat(60));
}

main().catch(console.error);
