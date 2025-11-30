# LlamaIndex File Chat Agent Reference

> **Source**: `samples/python/agents/llama_index_file_chat/`
> **Our Implementation**: Not started

## Overview

A document chat agent built with LlamaIndex Workflows. Supports file upload, parsing via LlamaParse, and conversational Q&A with inline citations.

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Client    │────►│  A2A Protocol   │────►│ LlamaIndex      │
│  (+ file)   │◄────│  (JSON-RPC)     │◄────│ Workflow        │
└─────────────┘     └─────────────────┘     └────────┬────────┘
                                                     │
                                         ┌───────────┼───────────┐
                                         │           │           │
                                    ┌────▼────┐ ┌────▼────┐ ┌────▼────┐
                                    │LlamaParse│ │  Gemini │ │ Context │
                                    │  (Parse) │ │  (LLM)  │ │ (Memory)│
                                    └──────────┘ └─────────┘ └─────────┘
```

## Key Components

### 1. File Upload Handling

```python
# A2A message with file attachment
{
  "message": {
    "parts": [
      {"type": "text", "text": "What does this file talk about?"},
      {"type": "file", "file": {
        "bytes": "<base64-encoded-pdf>",
        "name": "attention.pdf"
      }}
    ]
  }
}
```

### 2. LlamaIndex Workflow

```python
class ParseAndChatWorkflow(Workflow):
    @step
    async def parse_document(self, ev: InputEvent) -> ParsedEvent:
        # Use LlamaParse for accurate document parsing
        parser = LlamaParse()
        documents = await parser.aload_data(ev.file_bytes)
        return ParsedEvent(documents=documents)
    
    @step
    async def chat_with_context(self, ev: ParsedEvent) -> ChatResponseEvent:
        # Insert document context into prompt
        context = "\n".join([doc.text for doc in ev.documents])
        response = await llm.achat(
            messages=[
                SystemMessage(f"Document context:\n{context}"),
                HumanMessage(ev.query),
            ]
        )
        return ChatResponseEvent(response=response, citations=self.extract_citations())
```

### 3. Citation Handling

```python
# Response with inline citations
{
  "artifacts": [{
    "parts": [{"text": "The Transformer uses attention mechanisms [1]..."}],
    "metadata": {
      "1": ["The dominant sequence transduction models..."]
    }
  }]
}
```

## A2A Protocol Flow

### Request with File
```json
{
  "method": "message/send",
  "params": {
    "message": {
      "parts": [
        {"type": "text", "text": "What does this file talk about?"},
        {"type": "file", "file": {
          "bytes": "JVBERi0xLjQK...",
          "name": "attention.pdf"
        }}
      ]
    }
  }
}
```

### Streaming Status Updates
```
data: {"status": {"state": "working", "message": "Parsing document..."}}
data: {"status": {"state": "working", "message": "Document parsed successfully."}}
data: {"status": {"state": "working", "message": "Chatting with context..."}}
data: {"artifact": {"parts": [{"text": "This file discusses..."}], "metadata": {...}}}
data: {"status": {"state": "completed"}}
```

## Key Features

1. **File Upload**: Accept binary files via A2A
2. **Document Parsing**: LlamaParse for accurate extraction
3. **Contextual Chat**: Include document in LLM context
4. **Inline Citations**: Reference source text with [n] markers
5. **Multi-turn**: Continue conversation about the same document

## TypeScript Implementation Considerations

### Challenges

1. **File Parsing**: Need equivalent to LlamaParse
2. **Binary Handling**: Workers have size limits
3. **Context Window**: Large documents may exceed limits

### Potential Approach

```typescript
// Using pdf-parse or similar
import pdfParse from 'pdf-parse';

const parseDocument = tool({
  description: "Parse an uploaded document",
  parameters: z.object({
    fileBytes: z.string(), // base64
    fileName: z.string(),
  }),
  execute: async ({ fileBytes, fileName }) => {
    const buffer = Buffer.from(fileBytes, 'base64');
    
    if (fileName.endsWith('.pdf')) {
      const data = await pdfParse(buffer);
      return data.text;
    }
    // Handle other formats...
  },
});

// Chat with document context
const chatWithDocument = async (query: string, documentText: string) => {
  const result = await streamText({
    model,
    system: `Document context:\n${documentText}\n\nProvide citations using [n] format.`,
    prompt: query,
  });
  return result;
};
```

### Citation Extraction

```typescript
// Extract citations from response
function extractCitations(response: string, documentText: string) {
  const citationRegex = /\[(\d+)\]/g;
  const citations: Record<string, string[]> = {};
  
  let match;
  while ((match = citationRegex.exec(response)) !== null) {
    const num = match[1];
    // Find relevant passage in document
    citations[num] = [findRelevantPassage(documentText, num)];
  }
  
  return citations;
}
```

## Checklist for Implementation

- [ ] File upload handling (base64 decode)
- [ ] PDF parsing (pdf-parse or similar)
- [ ] Document context injection
- [ ] Citation extraction
- [ ] Multi-turn with document memory
- [ ] Streaming status updates
- [ ] Worker deployment (size limits concern)

## Limitations

- **File Size**: Workers have request/response size limits
- **Parsing Libraries**: Limited options in Workers environment
- **Context Window**: Large documents need chunking/RAG

## Alternative Approaches

For Workers deployment, consider:
1. **External parsing service**: Upload to S3, parse externally
2. **Chunking + RAG**: Use vector store for large documents
3. **Streaming uploads**: Process in chunks

## Notes

This example showcases advanced file handling in A2A. For a Workers implementation, you may need to:
- Use Cloudflare R2 for file storage
- Implement chunked processing
- Consider Cloudflare AI for embeddings/RAG

