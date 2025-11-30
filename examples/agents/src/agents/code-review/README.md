# Code Review Agent

An AI agent that reviews JavaScript/TypeScript code for issues, security vulnerabilities, and best practices.

## Overview

This agent demonstrates:

- **Code Analysis Tools**: Static analysis for common issues
- **Security Scanning**: Detection of potential vulnerabilities
- **Best Practice Validation**: Checking coding standards
- **Structured Feedback**: Severity-based issue reporting

## Features

### Code Analysis

The agent analyzes code for:

- **Security Issues**: `eval()`, `innerHTML`, hardcoded secrets
- **Best Practices**: `var` usage, loose equality, `any` types
- **Code Quality**: Console statements, empty catch blocks, TODOs

### Severity Levels

- **Critical**: Security vulnerabilities, must fix immediately
- **Warning**: Code quality issues, should fix
- **Info**: Suggestions and notes

## Usage

### Local Server

```bash
# From the agents directory
pnpm run dev:code-review
```

### Example Request

```bash
curl -X POST http://localhost:4011/message/send \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "message/send",
    "params": {
      "message": {
        "role": "user",
        "parts": [{
          "type": "text",
          "text": "Review this code:\n\nfunction login(password) {\n  var secret = \"hardcoded123\";\n  if (password == secret) {\n    eval(\"console.log(password)\");\n  }\n}"
        }]
      }
    }
  }'
```

### Expected Response

The agent will identify:

1. **Critical**: Hardcoded secret
2. **Critical**: Use of `eval()`
3. **Warning**: Use of `var`
4. **Warning**: Loose equality (`==`)
5. **Warning**: Console statement

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     Client      │────►│  A2A Protocol   │────►│  Code Review    │
│                 │◄────│  (JSON-RPC)     │◄────│     Agent       │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                  ┌──────▼──────┐
                                                  │  Analysis   │
                                                  │    Tool     │
                                                  └─────────────┘
```

## Configuration

### Environment Variables

- `AI_PROVIDER`: LLM provider (default: `openai`)
- `AI_MODEL`: Model to use (default: `gpt-4o-mini`)
- `OPENAI_API_KEY`: API key for OpenAI

## Comparison to Python Example

The Python AG2 example uses Mypy for Python type checking. Our implementation:

- **Language**: JavaScript/TypeScript instead of Python
- **Analysis**: Built-in pattern matching instead of external tool
- **Extensibility**: Can integrate external linting services

## Extending

To add more analysis rules:

```typescript
// In agent.ts, add to analyzeCodePatterns()
if (/pattern/.test(code)) {
  issues.push({
    severity: "warning",
    message: "Description of the issue",
    line: findLineNumber(code, "pattern"),
    rule: "rule-name",
  });
}
```

## Worker Deployment

See `examples/workers/code-review/` for Cloudflare Worker deployment.

