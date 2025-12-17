/**
 * Analytics Agent
 *
 * An agent that generates charts and analyzes data.
 * This module exports ONLY the agent logic - no HTTP framework dependencies.
 */

export { createAnalyticsAgent } from "./agent.js";
export { getAnalyticsAgentPrompt } from "./prompt.js";
export {
  type ChartData,
  type ChartResult,
  generateBarChart,
  generateChartFromPrompt,
  parseChartData,
} from "./tools.js";
