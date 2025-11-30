# A2A Telemetry Reference

> **Source**: `samples/python/agents/a2a_telemetry/`
> **Our Implementation**: Not started

## Overview

Demonstrates distributed tracing in A2A using OpenTelemetry with Jaeger as the backend. Features an ADK agent with Google Search tool, showcasing how to instrument A2A servers and clients for observability.

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  A2A Client │────►│  A2A Protocol   │────►│  ADK Agent      │
│  (Traced)   │◄────│  (+ Traces)     │◄────│  (+ Search)     │
└─────────────┘     └─────────────────┘     └────────┬────────┘
        │                   │                        │
        └───────────────────┼────────────────────────┘
                            │
                      ┌─────▼─────┐
                      │  Jaeger   │
                      │  (OTLP)   │
                      └─────┬─────┘
                            │
                      ┌─────▼─────┐
                      │  Grafana  │
                      │  (UI)     │
                      └───────────┘
```

## Key Components

### 1. OpenTelemetry Setup

```python
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

# Configure tracer
provider = TracerProvider()
processor = BatchSpanProcessor(OTLPSpanExporter(endpoint="localhost:4317"))
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)

tracer = trace.get_tracer("a2a-telemetry-sample")
```

### 2. Instrumented Agent Executor

```python
class TracedAgentExecutor(AgentExecutor):
    async def execute(self, context: RequestContext, event_queue: EventQueue):
        with tracer.start_as_current_span("agent_execution") as span:
            span.set_attribute("task_id", context.task_id)
            span.set_attribute("user_input", context.get_user_input())
            
            # Agent processing with nested spans
            with tracer.start_as_current_span("google_search"):
                results = await self.agent.search(query)
            
            with tracer.start_as_current_span("llm_processing"):
                response = await self.agent.process(results)
            
            await event_queue.enqueue_event(new_agent_text_message(response))
```

### 3. Docker Compose for Observability Stack

```yaml
services:
  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686"  # UI
      - "4317:4317"    # OTLP gRPC
  
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_AUTH_ANONYMOUS_ENABLED=true
```

## Trace Structure

```
a2a-telemetry-sample
└── agent_execution (task_id: abc123)
    ├── google_search (query: "AI agents")
    │   └── http_request (url: googleapis.com)
    └── llm_processing
        └── gemini_api_call (model: gemini-2.0-flash)
```

## Key Features

1. **Distributed Tracing**: Track requests across services
2. **Custom Spans**: Instrument specific operations
3. **Attributes**: Add context to spans
4. **Visualization**: Jaeger UI and Grafana dashboards

## TypeScript Implementation Approach

### OpenTelemetry for Node.js

```typescript
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';

// Setup
const provider = new NodeTracerProvider();
const exporter = new OTLPTraceExporter({ url: 'http://localhost:4317' });
provider.addSpanProcessor(new BatchSpanProcessor(exporter));
provider.register();

const tracer = trace.getTracer('a2a-agent');

// Instrumented agent
async function executeAgent(task: string) {
  return tracer.startActiveSpan('agent_execution', async (span) => {
    try {
      span.setAttribute('task', task);
      
      const result = await tracer.startActiveSpan('llm_call', async (llmSpan) => {
        const response = await generateText({ model, prompt: task });
        llmSpan.end();
        return response;
      });
      
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  });
}
```

### Cloudflare Workers Tracing

Workers have limited OpenTelemetry support. Alternatives:

```typescript
// Using Cloudflare's built-in tracing
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // Cloudflare automatically traces Workers
    // Use console.log for additional context
    console.log(JSON.stringify({
      type: 'agent_execution',
      task_id: taskId,
      timestamp: Date.now(),
    }));
    
    // Or use Cloudflare Logpush for external observability
  },
};
```

### Third-Party Options

- **Baselime**: Cloudflare-native observability
- **Axiom**: Log aggregation with tracing
- **Honeycomb**: Distributed tracing

## Checklist for Implementation

- [ ] OpenTelemetry setup (Node.js)
- [ ] Custom span instrumentation
- [ ] Jaeger/Grafana integration
- [ ] Worker-compatible tracing
- [ ] Dashboard templates

## Notes

Observability is crucial for:
- **Debugging**: Trace request flow
- **Performance**: Identify bottlenecks
- **Reliability**: Monitor error rates

For Workers:
- Use Cloudflare's built-in observability
- Export logs to external services
- Consider Cloudflare Workers Analytics

