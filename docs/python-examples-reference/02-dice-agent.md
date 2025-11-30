# Dice Agent Reference

> **Source**: `samples/python/agents/dice_agent_rest/`
> **Our Implementation**: `examples/agents/dice-agent/`

## Overview

A tool-using agent that can roll dice and check prime numbers. Demonstrates the core pattern of LLM + Tools in an A2A agent.

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│   Client    │────►│  A2A Protocol   │────►│  LlmAgent   │
│             │◄────│  (JSON-RPC)     │◄────│  (Gemini)   │
└─────────────┘     └─────────────────┘     └──────┬──────┘
                                                   │
                                            ┌──────┴──────┐
                                            │    Tools    │
                                            ├─────────────┤
                                            │ roll_dice   │
                                            │ check_prime │
                                            └─────────────┘
```

## Agent Card

```json
{
  "name": "Dice Agent",
  "description": "An agent that can roll arbitrary dice and answer if numbers are prime",
  "url": "http://localhost:10101/",
  "version": "1.0.0",
  "default_input_modes": ["text"],
  "default_output_modes": ["text"],
  "capabilities": {
    "streaming": true
  },
  "preferred_transport": "http_json",
  "skills": [
    {
      "id": "f56cab88-3fe9-47ec-ba6e-86a13c9f1f74",
      "name": "Roll Dice",
      "description": "Rolls an N sided dice and returns the result. By default uses a 6 sided dice.",
      "tags": ["dice"],
      "examples": ["Can you roll an 11 sided dice?"]
    },
    {
      "id": "33856129-d686-4a54-9c6e-fffffec3561b",
      "name": "Prime Detector",
      "description": "Determines which numbers from a list are prime numbers.",
      "tags": ["prime"],
      "examples": ["Which of these are prime numbers 1, 4, 6, 7"]
    }
  ]
}
```

## System Prompt

```
You roll dice and answer questions about the outcome of the dice rolls.
You can roll dice of different sizes.
You can use multiple tools in parallel by calling functions in parallel (in one request and in one round).
The only things you do are roll dice for the user and discuss the outcomes.
It is ok to discuss previous dice roles, and comment on the dice rolls.

When you are asked to roll a die, you must call the roll_dice tool with the number of sides. 
Be sure to pass in an integer. Do not pass in a string.
You should never roll a die on your own.

When checking prime numbers, call the check_prime tool with a list of integers. 
Be sure to pass in a list of integers. You should never pass in a string.
You should not check prime numbers before calling the tool.

When you are asked to roll a die and check prime numbers, you should always make the following two function calls:
1. You should first call the roll_die tool to get a roll. Wait for the function response before calling the check_prime tool.
2. After you get the function response from roll_die tool, you should call the check_prime tool with the roll_die result.
   2.1 If user asks you to check primes based on previous rolls, make sure you include the previous rolls in the list.
3. When you respond, you must include the roll_die result from step 1.

You should always perform the previous 3 steps when asking for a roll and checking prime numbers.
You should not rely on the previous history on prime results.
```

## Tools

### roll_dice

```python
def roll_dice(N: int = 6) -> int:
    """Rolls an N sided dice. If number of sides aren't given, uses 6.

    Args:
      N: the number of the side of the dice to roll.

    Returns:
      A number between 1 and N, inclusive
    """
    return random.randint(1, N)
```

### check_prime

```python
def check_prime(nums: list[int]) -> str:
    """Check if a given list of numbers are prime.

    Args:
      nums: The list of numbers to check.

    Returns:
      A str indicating which number is prime.
    """
    primes = set()
    for number in nums:
        number = int(number)
        if number <= 1:
            continue
        is_prime = True
        for i in range(2, int(number**0.5) + 1):
            if number % i == 0:
                is_prime = False
            break
        if is_prime:
            primes.add(number)
    return (
        'No prime numbers found.'
        if not primes
        else f'{", ".join(str(num) for num in primes)} are prime numbers.'
    )
```

## Key Components

### 1. Agent Creation (Google ADK)

```python
def create_agent() -> LlmAgent:
    return LlmAgent(
        model='gemini-2.0-flash-001',
        name='dice_roll_agent',
        instruction="""...""",  # System prompt above
        description='Rolls an N-sided dice and answers questions about the outcome.',
        tools=[
            roll_dice,
            check_prime,
        ],
    )
```

### 2. Agent Runner with Session Management

```python
class DiceAgent:
    def __init__(self) -> None:
        self._agent = create_agent()
        self._user_id = 'remote_agent'
        self._runner = Runner(
            app_name=self._agent.name,
            agent=self._agent,
            artifact_service=InMemoryArtifactService(),
            session_service=InMemorySessionService(),
            memory_service=InMemoryMemoryService(),
        )

    async def stream(self, query, session_id) -> AsyncIterable[tuple[bool, str]]:
        session = await self._runner.session_service.get_session(
            app_name=self._agent.name,
            user_id=self._user_id,
            session_id=session_id,
        )
        
        content = types.Content(
            role='user', parts=[types.Part.from_text(text=query)]
        )
        
        if session is None:
            session = await self._runner.session_service.create_session(...)
            
        async for event in self._runner.run_async(
            user_id=self._user_id, session_id=session.id, new_message=content
        ):
            if event.is_final_response():
                yield (True, '\n'.join([p.text for p in event.content.parts if p.text]))
            else:
                yield (False, 'working...')
```

### 3. Agent Executor with Task Updates

```python
class DiceAgentExecutor(AgentExecutor):
    async def execute(self, context: RequestContext, event_queue: EventQueue) -> None:
        query = context.get_user_input()
        task = context.current_task

        if not task:
            task = new_task(context.message)
            await event_queue.enqueue_event(task)
            
        updater = TaskUpdater(event_queue, task.id, task.context_id)
        
        async for finished, text in self.agent.stream(query, task.context_id):
            if not finished:
                # Emit working status
                await updater.update_status(
                    TaskState.working,
                    new_agent_text_message(text, task.context_id, task.id),
                )
                continue
                
            # Emit artifact and complete
            await updater.add_artifact(
                [Part(root=TextPart(text=text))],
                name='response',
            )
            await updater.complete()
            break
```

## A2A Protocol Flow

### Request
```json
{
  "jsonrpc": "2.0",
  "method": "message/send",
  "id": "1",
  "params": {
    "message": {
      "role": "user",
      "messageId": "msg-1",
      "parts": [{"type": "text", "text": "Roll a 20-sided dice"}]
    }
  }
}
```

### Streaming Response Events

1. **Task Created**
```json
{
  "id": "task-123",
  "status": { "state": "submitted" }
}
```

2. **Working Status** (while LLM processes)
```json
{
  "status": {
    "state": "working",
    "message": {
      "parts": [{"type": "text", "text": "working..."}]
    }
  }
}
```

3. **Artifact Added**
```json
{
  "artifact": {
    "name": "response",
    "parts": [{"type": "text", "text": "I rolled a 20-sided dice and got 17!"}]
  }
}
```

4. **Completed**
```json
{
  "status": { "state": "completed" }
}
```

## Our TypeScript Implementation

### Agent (`examples/agents/dice-agent/agent.ts`)

```typescript
import { ToolLoopAgent, tool } from "ai";
import { z } from "zod";

export function createDiceAgent(model: LanguageModel) {
  return new ToolLoopAgent({
    model,
    instructions: getDiceAgentPrompt(),
    tools: {
      roll_dice: tool({
        description: "Roll an N-sided dice",
        parameters: z.object({
          sides: z.number().min(2).default(6).describe("Number of sides"),
        }),
        execute: async ({ sides }) => {
          const result = Math.floor(Math.random() * sides) + 1;
          return { result, sides };
        },
      }),
      check_prime: tool({
        description: "Check if numbers are prime",
        parameters: z.object({
          numbers: z.array(z.number()).describe("Numbers to check"),
        }),
        execute: async ({ numbers }) => {
          const primes = numbers.filter(isPrime);
          return primes.length > 0
            ? `${primes.join(", ")} are prime`
            : "No primes found";
        },
      }),
    },
  });
}
```

### Key Differences

| Aspect | Python (Google ADK) | Our TypeScript (AI SDK) |
|--------|---------------------|-------------------------|
| Framework | `google.adk.agents.LlmAgent` | `ai.ToolLoopAgent` |
| Model | Gemini via ADK | Any via AI SDK |
| Tools | Python functions with docstrings | `tool()` helper with Zod schemas |
| Session | `InMemorySessionService` | Handled by A2A task store |
| Streaming | ADK Runner events | AI SDK streaming |

## Testing

```bash
# Test dice rolling
curl -X POST http://localhost:3001/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "id": "test",
    "params": {
      "message": {
        "role": "user",
        "messageId": "msg-1",
        "parts": [{"kind": "text", "text": "Roll a d20 and check if it is prime"}]
      }
    }
  }'
```

## Checklist for Implementation

- [x] Agent Card with multiple skills
- [x] System prompt for tool usage
- [x] `roll_dice` tool
- [x] `check_prime` tool
- [x] Streaming responses
- [x] Task status updates
- [x] Worker deployment (`workers/dice-agent/`)
- [ ] Parallel tool calling (roll multiple dice at once)

