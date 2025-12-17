/**
 * MCP Registry Orchestrator
 *
 * Orchestrates task execution using MCP-based agent discovery.
 * Supports re-planning on task failure with state persistence.
 */

import type { LanguageModel } from "ai";
import { generateText } from "ai";
import type { MCPRegistryServer } from "./mcp-server.js";
import type { ExecutionPlan, OrchestratorConfig, OrchestratorState, PlanTask } from "./types.js";

// ============================================================================
// Planner Prompt
// ============================================================================

const PLANNER_PROMPT = `You are a task planning agent. Your job is to decompose user requests into a series of tasks that can be executed by specialist agents.

Given a user query, create an execution plan with:
1. A list of tasks to accomplish the goal
2. Dependencies between tasks (which tasks must complete before others)
3. Task types that describe what kind of agent is needed

Output your plan as JSON in this format:
{
  "tasks": [
    {
      "id": "task_1",
      "type": "flight_search",
      "description": "Search for flights from NYC to Paris on June 15",
      "dependencies": []
    },
    {
      "id": "task_2", 
      "type": "hotel_search",
      "description": "Search for hotels in Paris from June 15-22",
      "dependencies": ["task_1"]
    }
  ]
}

Task types should be descriptive of the capability needed (e.g., "flight_search", "hotel_search", "weather_forecast", "car_rental", etc.).

Dependencies should list task IDs that must complete before this task can start.`;

const REPLAN_PROMPT = `You are a task re-planning agent. A previous execution plan has failed, and you need to create a new plan that works around the failure.

Previous plan:
{previousPlan}

Failed tasks:
{failedTasks}

Successful results so far:
{successfulResults}

Create a new plan that:
1. Keeps successful results where possible
2. Works around the failures (try alternative approaches)
3. Still achieves the original goal

Output your revised plan as JSON in the same format.`;

// ============================================================================
// Task Execution Result
// ============================================================================

interface TaskExecutionResult {
  taskId: string;
  success: boolean;
  result?: unknown;
  error?: string;
  agentUsed?: string;
}

// ============================================================================
// Orchestrator Class
// ============================================================================

/**
 * MCP Registry Orchestrator
 *
 * Coordinates task execution using MCP-based agent discovery:
 * 1. Plans: Decomposes user query into task DAG
 * 2. Discovers: Finds agents for each task via MCP registry
 * 3. Executes: Runs tasks respecting dependencies
 * 4. Re-plans: Handles failures by creating alternative plans
 */
export class MCPRegistryOrchestrator {
  private mcpServer: MCPRegistryServer;
  private model: LanguageModel;
  private config: Required<OrchestratorConfig>;
  private state: OrchestratorState;

  constructor(mcpServer: MCPRegistryServer, model: LanguageModel, config: OrchestratorConfig) {
    this.mcpServer = mcpServer;
    this.model = model;
    this.config = {
      registryUrl: config.registryUrl,
      maxReplanIterations: config.maxReplanIterations ?? 3,
      redisPrefix: config.redisPrefix ?? "a2a:orchestrator:",
      stateTtl: config.stateTtl ?? 86400, // 24 hours
    };
    this.state = this.createInitialState();
  }

  // ==========================================================================
  // Main Execution Flow
  // ==========================================================================

  /**
   * Execute a user query end-to-end
   */
  async execute(userQuery: string): Promise<{
    success: boolean;
    results: Record<string, unknown>;
    summary: string;
    plan: ExecutionPlan;
  }> {
    // Step 1: Create initial plan
    const plan = await this.createPlan(userQuery);
    this.state.plan = plan;

    // Step 2: Execute with re-planning on failure
    let currentPlan = plan;
    let iteration = 0;

    while (iteration < this.config.maxReplanIterations) {
      iteration++;
      currentPlan.iteration = iteration;
      currentPlan.status = "executing";

      // Execute all tasks in the plan
      const results = await this.executePlan(currentPlan);

      // Check for failures
      const failedTasks = currentPlan.tasks.filter((t) => t.status === "failed");

      if (failedTasks.length === 0) {
        // All tasks succeeded
        currentPlan.status = "completed";
        const summary = await this.summarizeResults(userQuery, results);
        return {
          success: true,
          results,
          summary,
          plan: currentPlan,
        };
      }

      // Some tasks failed - try re-planning
      if (iteration < this.config.maxReplanIterations) {
        console.log(`Re-planning (iteration ${iteration + 1})...`);
        currentPlan = await this.replan(currentPlan, results);
        this.state.plan = currentPlan;
      }
    }

    // Max iterations reached
    currentPlan.status = "failed";
    return {
      success: false,
      results: this.state.taskResults,
      summary: "Failed to complete all tasks after maximum re-planning attempts.",
      plan: currentPlan,
    };
  }

  // ==========================================================================
  // Planning
  // ==========================================================================

  /**
   * Create an execution plan from a user query
   */
  async createPlan(userQuery: string): Promise<ExecutionPlan> {
    const { text } = await generateText({
      model: this.model,
      system: PLANNER_PROMPT,
      prompt: userQuery,
    });

    // Parse the plan from the response
    const planData = this.extractJsonFromText(text);

    const tasks: PlanTask[] = (planData.tasks || []).map(
      (t: { id: string; type: string; description?: string; dependencies?: string[] }) => ({
        id: t.id,
        type: t.type,
        description: t.description,
        dependencies: t.dependencies || [],
        status: "pending" as const,
      })
    );

    return {
      id: `plan_${Date.now()}`,
      userQuery,
      tasks,
      createdAt: new Date().toISOString(),
      status: "planning",
      iteration: 0,
      maxIterations: this.config.maxReplanIterations,
    };
  }

  /**
   * Re-plan after failures
   */
  async replan(
    previousPlan: ExecutionPlan,
    results: Record<string, unknown>
  ): Promise<ExecutionPlan> {
    const failedTasks = previousPlan.tasks.filter((t) => t.status === "failed");
    const successfulTasks = previousPlan.tasks.filter((t) => t.status === "completed");

    const prompt = REPLAN_PROMPT.replace("{previousPlan}", JSON.stringify(previousPlan, null, 2))
      .replace("{failedTasks}", JSON.stringify(failedTasks, null, 2))
      .replace(
        "{successfulResults}",
        JSON.stringify(
          Object.fromEntries(successfulTasks.map((t) => [t.id, results[t.id]])),
          null,
          2
        )
      );

    const { text } = await generateText({
      model: this.model,
      system: PLANNER_PROMPT,
      prompt,
    });

    const planData = this.extractJsonFromText(text);

    const tasks: PlanTask[] = (planData.tasks || []).map(
      (t: { id: string; type: string; description?: string; dependencies?: string[] }) => ({
        id: t.id,
        type: t.type,
        description: t.description,
        dependencies: t.dependencies || [],
        status: "pending" as const,
      })
    );

    // Preserve completed tasks from previous plan
    for (const completedTask of successfulTasks) {
      const existingTask = tasks.find((t) => t.id === completedTask.id);
      if (existingTask) {
        existingTask.status = "completed";
        existingTask.result = results[completedTask.id];
      }
    }

    return {
      ...previousPlan,
      tasks,
      status: "replanning",
    };
  }

  // ==========================================================================
  // Execution
  // ==========================================================================

  /**
   * Execute all tasks in a plan respecting dependencies
   */
  async executePlan(plan: ExecutionPlan): Promise<Record<string, unknown>> {
    const results: Record<string, unknown> = { ...this.state.taskResults };
    const pendingTasks = new Set(plan.tasks.filter((t) => t.status === "pending").map((t) => t.id));

    while (pendingTasks.size > 0) {
      // Find tasks that are ready to execute (all dependencies completed)
      const readyTasks = plan.tasks.filter(
        (t) =>
          pendingTasks.has(t.id) &&
          t.dependencies.every((depId) => {
            const depTask = plan.tasks.find((dt) => dt.id === depId);
            return depTask?.status === "completed";
          })
      );

      if (readyTasks.length === 0) {
        // No tasks ready - check for circular dependencies or all failed dependencies
        const blockedTasks = Array.from(pendingTasks);
        for (const taskId of blockedTasks) {
          const task = plan.tasks.find((t) => t.id === taskId);
          if (task) {
            task.status = "failed";
            task.error = "Blocked by failed dependencies";
            pendingTasks.delete(taskId);
          }
        }
        break;
      }

      // Execute ready tasks in parallel
      const execResults = await Promise.all(readyTasks.map((task) => this.executeTask(task)));

      // Process results
      for (const execResult of execResults) {
        const task = plan.tasks.find((t) => t.id === execResult.taskId);
        if (task) {
          if (execResult.success) {
            task.status = "completed";
            task.result = execResult.result;
            task.assignedAgent = execResult.agentUsed;
            results[task.id] = execResult.result;
          } else {
            task.status = "failed";
            task.error = execResult.error;
          }
          pendingTasks.delete(task.id);
        }
      }
    }

    this.state.taskResults = results;
    return results;
  }

  /**
   * Execute a single task by finding an agent and calling it
   */
  async executeTask(task: PlanTask): Promise<TaskExecutionResult> {
    try {
      task.status = "running";

      // Step 1: Find an agent for this task via MCP
      const agentResults = this.mcpServer.getRegistry().findAgent({
        query: `${task.type}: ${task.description}`,
        limit: 1,
      });

      const firstResult = agentResults[0];
      if (!firstResult) {
        return {
          taskId: task.id,
          success: false,
          error: `No agent found for task type: ${task.type}`,
        };
      }

      const agent = firstResult.agentCard;

      // Step 2: Call the agent via A2A
      const result = await this.callAgent(agent.url, task.description || task.type);

      return {
        taskId: task.id,
        success: true,
        result,
        agentUsed: agent.name,
      };
    } catch (error) {
      return {
        taskId: task.id,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Call an agent via A2A protocol
   */
  private async callAgent(agentUrl: string, task: string): Promise<unknown> {
    // Simple A2A call - in production, use the full A2A client
    const response = await fetch(agentUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `task_${Date.now()}`,
        method: "message/send",
        params: {
          message: {
            role: "user",
            parts: [{ kind: "text", text: task }],
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Agent call failed: ${response.status} ${response.statusText}`);
    }

    const result = (await response.json()) as {
      result?: {
        result?: {
          status?: { message?: { parts?: Array<{ text?: string }> } };
          artifacts?: unknown[];
        };
      };
      error?: { message: string };
    };

    if (result.error) {
      throw new Error(result.error.message);
    }

    // Extract text from response
    const taskResult = result.result?.result;
    const message = taskResult?.status?.message;
    const textPart = message?.parts?.find(
      (p: { kind?: string; text?: string }) => p.kind === "text" || p.text
    );

    return {
      text: textPart?.text || "Task completed",
      artifacts: taskResult?.artifacts || [],
    };
  }

  // ==========================================================================
  // Summarization
  // ==========================================================================

  /**
   * Summarize execution results for the user
   */
  async summarizeResults(userQuery: string, results: Record<string, unknown>): Promise<string> {
    const { text } = await generateText({
      model: this.model,
      system:
        "You are a helpful assistant that summarizes task execution results. Provide a clear, concise summary of what was accomplished.",
      prompt: `Original request: ${userQuery}\n\nResults:\n${JSON.stringify(results, null, 2)}`,
    });

    return text;
  }

  // ==========================================================================
  // State Management
  // ==========================================================================

  /**
   * Get current orchestrator state
   */
  getState(): OrchestratorState {
    return this.state;
  }

  /**
   * Restore state from persistence
   */
  restoreState(state: OrchestratorState): void {
    this.state = state;
  }

  /**
   * Create initial state
   */
  private createInitialState(): OrchestratorState {
    return {
      taskResults: {},
      agentContexts: {},
      sessionId: `session_${Date.now()}`,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Export state for persistence
   */
  exportState(): string {
    this.state.lastUpdated = new Date().toISOString();
    return JSON.stringify(this.state);
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  /**
   * Extract JSON from LLM response text
   */
  private extractJsonFromText(text: string): {
    tasks?: Array<{ id: string; type: string; description?: string; dependencies?: string[] }>;
  } {
    // Try to find JSON in the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        // Fall through to default
      }
    }

    // Try parsing the whole text
    try {
      return JSON.parse(text);
    } catch {
      return { tasks: [] };
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an MCP Registry Orchestrator
 */
export function createMCPRegistryOrchestrator(
  mcpServer: MCPRegistryServer,
  model: LanguageModel,
  config: OrchestratorConfig
): MCPRegistryOrchestrator {
  return new MCPRegistryOrchestrator(mcpServer, model, config);
}
