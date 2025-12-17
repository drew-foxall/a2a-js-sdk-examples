/**
 * Analytics Agent
 *
 * An agent that generates charts and analyzes data.
 * This module exports ONLY the agent logic - no HTTP framework dependencies.
 */

export { createAnalyticsAgent } from "./agent.js";
export { getAnalyticsAgentPrompt } from "./prompt.js";
export {
  generateBarChart,
  generateChartFromPrompt,
  parseChartData,
  type ChartData,
  type ChartResult,
} from "./tools.js";
