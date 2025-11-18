# Content Editor Agent (AI SDK + Hono)

A high-fidelity port of the original [Genkit-based Content Editor Agent](https://github.com/a2aproject/a2a-samples/tree/main/samples/js/src/agents/content-editor) using **Vercel AI SDK** and **Hono**.

## Features

✅ **Full Feature Parity with Original**
- ✍️ Professional content editing and proof-reading
- 📝 Grammar and spelling corrections
- 🎨 Style improvements
- 🗣️ Maintains user's voice and intent
- 💬 Constructive feedback on changes

## What's Different from Original?

| Feature | Original (Genkit) | AI SDK Port | Notes |
|---------|------------------|-------------|-------|
| Framework | Genkit | Vercel AI SDK | Provider-agnostic |
| Web Server | Express | Hono | Faster, edge-ready |
| Prompt Format | `.prompt` files | TypeScript constants | Type-safe |
| Model Config | Gemini (Google AI) | Any provider | Configurable |
| Port | `10003` | `41243` | Different default |

## Prerequisites

**LLM API Key**: One of:
- OpenAI API Key (default)
- Anthropic API Key (Claude excellent for writing!)
- Google AI API Key

## Installation

```bash
# From the project root
pnpm install
```

## Running the Agent

### Quick Start

```bash
# Set your API key
export OPENAI_API_KEY=your_openai_key_here  # or ANTHROPIC_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY

# Run the agent
pnpm agents:ai-sdk-content-editor-agent
```

The agent will start on `http://localhost:41243`.

### Using Different AI Providers

```bash
# Use Anthropic Claude (recommended for content editing!)
export AI_PROVIDER=anthropic
export ANTHROPIC_API_KEY=your_key

# Use Google Gemini
export AI_PROVIDER=google
export GOOGLE_GENERATIVE_AI_API_KEY=your_key

# Use OpenAI (default)
export AI_PROVIDER=openai
export OPENAI_API_KEY=your_key

pnpm agents:ai-sdk-content-editor-agent
```

> **💡 Tip**: Anthropic's Claude is excellent for content editing and writing!

## Testing with A2A CLI

In a separate terminal:

```bash
pnpm a2a:cli

# Try these editing tasks:
> Please review and improve this blog post: [paste content]
> Check this email for grammar and clarity: [paste email]
> Polish this product description: [paste description]
> Edit this article for better readability: [paste article]
```

## Architecture

```
content-editor-agent/
├── index.ts        # Main agent executor
├── prompt.ts       # System prompt for content editing
└── README.md       # This file
```

### Key Implementation Details

**Content Editing Prompt**
```typescript
export const CONTENT_EDITOR_PROMPT = `You are an expert content editor and proofreader. Your role is to:

1. Review the user's content for clarity, grammar, spelling, and style
2. Suggest improvements to make the content more engaging and professional
3. Fix any errors you find
4. Maintain the user's original voice and intent

When editing:
- Be constructive and helpful
- Explain significant changes
- Keep formatting consistent
- Preserve the core message

Provide the edited version of the content along with a brief summary of changes made.`;
```

## What the Agent Does

The Content Editor Agent will:

1. **Fix Grammar & Spelling** 
   - Corrects typos and grammatical errors
   - Ensures proper punctuation

2. **Improve Clarity**
   - Simplifies complex sentences
   - Removes redundancy
   - Enhances readability

3. **Enhance Style**
   - Improves word choice
   - Strengthens weak phrases
   - Makes content more engaging

4. **Maintain Voice**
   - Preserves your tone
   - Keeps your personality
   - Respects your intent

5. **Explain Changes**
   - Summarizes edits made
   - Highlights significant improvements
   - Provides constructive feedback

## Example Usage

### Email Editing

**Input:**
```
hi john,

i wanted to reach out too you about the project we discussed last week. I think their are some things we should change going forward. can we setup a meeting sometime next weak to talk about it?

thanks,
sarah
```

**Output:**
```
Hi John,

I wanted to reach out to you about the project we discussed last week. I think there are some things we should adjust going forward. Could we schedule a meeting sometime next week to discuss?

Thank you,
Sarah

---
Changes made:
- Fixed capitalization at the start
- Corrected "too" → "to", "their" → "there", "weak" → "week"
- Improved professionalism ("setup" → "schedule", "talk about" → "discuss")
- Enhanced closing formality
```

### Blog Post Editing

**Input:**
```
How to Write Good Code

Writing good code is really important. You should make sure your code is clean and easy to understand. Also, you need to comment your code so other people can read it.
```

**Output:**
```
How to Write Quality Code

Writing quality code is essential for maintainable software. Here are key principles:

1. **Clarity**: Ensure your code is clean and self-explanatory
2. **Documentation**: Add comments to clarify complex logic
3. **Consistency**: Follow established style guides and patterns

These practices make your code more readable and easier for teammates to work with.

---
Changes made:
- Improved title ("Good" → "Quality")
- Restructured as a list for better readability
- Added more specific terminology
- Expanded on the benefits
- Made the tone more professional
```

## API Endpoints

Once running, the agent exposes:

- **Agent Card**: `GET http://localhost:41243/.well-known/agent-card.json`
- **JSON-RPC**: `POST http://localhost:41243/`

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AI_PROVIDER` | ❌ No | `openai` | AI provider (`openai`, `anthropic`, `google`) |
| `OPENAI_API_KEY` | ⚠️ If using OpenAI | - | OpenAI API key |
| `ANTHROPIC_API_KEY` | ⚠️ If using Anthropic | - | Anthropic API key |
| `GOOGLE_GENERATIVE_AI_API_KEY` | ⚠️ If using Google | - | Google AI API key |
| `PORT` | ❌ No | `41243` | Server port |

## Use Cases

### 📧 Email Polish
- Professional correspondence
- Customer support responses
- Internal communications

### 📝 Blog & Article Editing
- Draft refinement
- SEO-friendly improvements
- Readability enhancement

### 🛍️ Product Descriptions
- E-commerce copy
- Feature highlights
- Marketing materials

### 📄 Documentation
- Technical writing
- User guides
- README files

### 💼 Business Writing
- Reports
- Proposals
- Presentations

## Comparison with Original

### Original (Genkit) Implementation
```typescript
import { genkit } from "genkit";
import { googleAI } from "@genkit-ai/googleai";

const ai = genkit({
  plugins: [googleAI()],
  model: googleAI.model("gemini-2.0-flash"),
});

const contentEditorPrompt = ai.prompt("content_editor");
const response = await contentEditorPrompt({}, { messages });
```

### AI SDK Port
```typescript
import { generateText } from "ai";

const response = await generateText({
  model: getAIModel(), // Any provider
  system: CONTENT_EDITOR_PROMPT,
  messages,
});
```

Both achieve the same result - high-quality content editing!

## Tips for Best Results

1. **Provide Context:**
   - ✅ "Edit this blog post for a technical audience"
   - ❌ "Edit this"

2. **Specify Tone:**
   - ✅ "Make this email more professional"
   - ✅ "Keep this casual but fix grammar"

3. **Mention Constraints:**
   - ✅ "Edit for clarity, keep under 200 words"
   - ✅ "Improve without changing the main points"

4. **Ask for Specific Changes:**
   - ✅ "Focus on grammar and punctuation"
   - ✅ "Enhance the introduction paragraph"

## Integration with Multi-Agent Systems

This agent works great as part of a content creation pipeline:

```
Content Generator → Content Editor → Final Review
```

For multi-agent systems, check out the [content_creation sample](https://github.com/a2aproject/a2a-samples/tree/main/samples/python/hosts/content_creation) in the original repository.

## Troubleshooting

**Agent changes too much:**
- Be more specific: "Only fix grammar, keep my wording"
- Provide clearer constraints in your prompt

**Agent doesn't change enough:**
- Ask explicitly: "Significantly improve and rewrite for clarity"
- Provide examples of the style you want

**Tone doesn't match:**
- Specify the tone: "Keep casual tone" or "Make more professional"
- Provide a reference example

## Resources

- [Original Genkit Implementation](https://github.com/a2aproject/a2a-samples/tree/main/samples/js/src/agents/content-editor)
- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)
- [A2A Protocol Specification](https://github.com/google-a2a/A2A)

## License

Same as parent project (Apache-2.0)

