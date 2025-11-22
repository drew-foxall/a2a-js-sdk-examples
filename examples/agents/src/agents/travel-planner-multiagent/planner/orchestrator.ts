/**
 * Travel Planner Orchestrator
 *
 * This orchestrator coordinates multiple specialist agents using a2a-ai-provider.
 * It demonstrates how an AI SDK agent can consume A2A agents as "models".
 */

import { a2a } from "a2a-ai-provider";
import { generateText, type LanguageModel } from "ai";

/**
 * Specialist agent configuration
 */
interface SpecialistAgent {
  name: string;
  agentCardUrl: string;
  description: string;
}

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  model: LanguageModel; // Primary LLM for orchestration logic
  weatherAgent: SpecialistAgent;
  airbnbAgent: SpecialistAgent;
  logger?: Console;
}

/**
 * Travel Planner Orchestrator
 *
 * This orchestrator uses the AI SDK's generateText with a2a-ai-provider
 * to delegate tasks to specialist A2A agents.
 *
 * **Key Pattern**: A2A agents are consumed as "models" using a2a()
 */
export class TravelPlannerOrchestrator {
  private config: Required<OrchestratorConfig>;

  constructor(config: OrchestratorConfig) {
    this.config = {
      ...config,
      logger: config.logger || console,
    };
  }

  /**
   * Process a travel planning request
   *
   * This method:
   * 1. Analyzes the user's request using the primary LLM
   * 2. Determines which specialist agent(s) to engage
   * 3. Delegates to the appropriate A2A agent(s)
   * 4. Returns the synthesized response
   *
   * @param userQuery - The user's travel planning request
   * @returns The orchestrated response
   */
  async processRequest(userQuery: string): Promise<string> {
    this.config.logger.log(`🎭 Orchestrator: Processing request: "${userQuery}"`);

    // Step 1: Analyze the request to determine which agents to use
    const analysis = await this.analyzeRequest(userQuery);
    this.config.logger.log(`📊 Analysis: ${JSON.stringify(analysis, null, 2)}`);

    // Step 2: Delegate to appropriate specialist agent(s)
    const responses: string[] = [];

    if (analysis.needsWeather) {
      this.config.logger.log("🌤️  Delegating to Weather Agent...");
      const weatherResponse = await this.delegateToWeatherAgent(userQuery);
      responses.push(`## Weather Forecast\n\n${weatherResponse}`);
    }

    if (analysis.needsAccommodation) {
      this.config.logger.log("🏠 Delegating to Airbnb Agent...");
      const airbnbResponse = await this.delegateToAirbnbAgent(userQuery);
      responses.push(`## Accommodations\n\n${airbnbResponse}`);
    }

    // Step 3: Synthesize results
    if (responses.length === 0) {
      return "I'm not sure how to help with that request. I can help with weather forecasts and accommodation searches.";
    }

    if (responses.length === 1) {
      return responses[0] ?? "";
    }

    // Multiple agents - combine results
    return `# Your Travel Plan\n\n${responses.join("\n\n")}`;
  }

  /**
   * Analyze the user's request to determine which agents to engage
   */
  private async analyzeRequest(
    userQuery: string
  ): Promise<{ needsWeather: boolean; needsAccommodation: boolean }> {
    const analysisPrompt = `Analyze this travel request and determine which services are needed:

User Request: "${userQuery}"

Available Services:
1. Weather Agent - Provides weather forecasts
2. Airbnb Agent - Searches for accommodations

Respond in JSON format:
{
  "needsWeather": boolean,
  "needsAccommodation": boolean
}

Examples:
- "What's the weather in Paris?" → {"needsWeather": true, "needsAccommodation": false}
- "Find a room in Tokyo" → {"needsWeather": false, "needsAccommodation": true}
- "Plan a trip to LA" → {"needsWeather": true, "needsAccommodation": true}`;

    const result = await generateText({
      model: this.config.model,
      prompt: analysisPrompt,
    });

    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonText = result.text.trim();
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/```json?\n?/g, "").replace(/```/g, "");
      }
      const analysis = JSON.parse(jsonText);
      return {
        needsWeather: analysis.needsWeather || false,
        needsAccommodation: analysis.needsAccommodation || false,
      };
    } catch (error) {
      this.config.logger.error("Failed to parse analysis:", error);
      // Fallback: try to detect keywords
      const lowerQuery = userQuery.toLowerCase();
      return {
        needsWeather: /weather|forecast|temperature|rain|sunny|cloudy/.test(lowerQuery),
        needsAccommodation: /airbnb|accommodation|hotel|room|stay|lodging|booking/.test(lowerQuery),
      };
    }
  }

  /**
   * Delegate to the Weather Agent using a2a-ai-provider
   *
   * **KEY PATTERN**: The A2A agent is consumed as a "model" using a2a()
   */
  private async delegateToWeatherAgent(query: string): Promise<string> {
    try {
      const result = await generateText({
        // This is the magic! a2a() creates a "model" from an A2A agent
        model: a2a(this.config.weatherAgent.agentCardUrl),
        prompt: query,
      });

      return result.text;
    } catch (error) {
      this.config.logger.error("Weather Agent error:", error);
      return `Error getting weather forecast: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  }

  /**
   * Delegate to the Airbnb Agent using a2a-ai-provider
   *
   * **KEY PATTERN**: The A2A agent is consumed as a "model" using a2a()
   */
  private async delegateToAirbnbAgent(query: string): Promise<string> {
    try {
      const result = await generateText({
        // This is the magic! a2a() creates a "model" from an A2A agent
        model: a2a(this.config.airbnbAgent.agentCardUrl),
        prompt: query,
      });

      return result.text;
    } catch (error) {
      this.config.logger.error("Airbnb Agent error:", error);
      return `Error searching accommodations: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  }

  /**
   * Get available agents
   */
  getAvailableAgents(): SpecialistAgent[] {
    return [this.config.weatherAgent, this.config.airbnbAgent];
  }
}
