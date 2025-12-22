/**
 * A2A V3 Language Model
 *
 * Core `LanguageModelV3` implementation that bridges AI SDK with A2A protocol.
 *
 * ## Data Flow
 *
 * ```
 * AI SDK                    This Module                    A2A Agent
 * ┌─────────────────┐       ┌──────────────────┐          ┌─────────────┐
 * │ generateText()  │──────▶│ doGenerate()     │──────────▶│ sendMessage │
 * │ streamText()    │──────▶│ doStream()       │    │      │ (JSON-RPC)  │
 * └─────────────────┘       └──────────────────┘    │      └─────────────┘
 *         │                          │              │             │
 *         │                          │              │             │
 * ┌─────────────────┐       ┌──────────────────┐    │      ┌─────────────┐
 * │ LanguageModel   │◀──────│ Extract metadata │◀───│──────│ Task/Message│
 * │ V3 Response     │       │ Map to V3 types  │    │      │ Response    │
 * └─────────────────┘       └──────────────────┘    │      └─────────────┘
 *                                                   │
 *                                            SSE streaming
 * ```
 *
 * ## Key Responsibilities
 *
 * 1. **Prompt Conversion**: Convert AI SDK V3 prompts to A2A Messages
 * 2. **Request Handling**: Send messages via A2A ClientFactory (JSON-RPC)
 * 3. **Response Mapping**: Convert A2A Task/Message to V3 response format
 * 4. **Streaming**: Handle SSE stream events and yield V3 stream parts
 * 5. **Metadata Exposure**: Surface A2A-specific data via providerMetadata
 *
 * ## A2A Protocol Concepts
 *
 * - **Message**: A turn of communication with Parts (text, file, data)
 * - **Task**: A stateful work unit that processes Messages
 * - **TaskState**: Lifecycle state (working, completed, input-required, etc.)
 * - **Artifact**: Tangible output attached to a completed Task
 * - **contextId**: Groups related Tasks into a conversation
 *
 * @see https://a2a-protocol.org/ - A2A Protocol specification
 * @see https://sdk.vercel.ai/docs/ai-sdk-core/providers - AI SDK providers
 *
 * Based on dracoblue/a2a-ai-provider V2 implementation, updated for V3.
 * @see https://github.com/dracoblue/a2a-ai-provider
 *
 * @module
 */

import {
  type LanguageModelV3,
  type LanguageModelV3CallOptions,
  type LanguageModelV3CallWarning,
  type LanguageModelV3Content,
  type LanguageModelV3FilePart,
  type LanguageModelV3FinishReason,
  type LanguageModelV3Prompt,
  type LanguageModelV3StreamPart,
  type LanguageModelV3Usage,
  UnsupportedFunctionalityError,
} from "@ai-sdk/provider";
import { convertAsyncIteratorToReadableStream, generateId } from "@ai-sdk/provider-utils";
import type { FilePart, Message, MessageSendParams, Part, TextPart } from "@drew-foxall/a2a-js-sdk";
import { ClientFactory } from "@drew-foxall/a2a-js-sdk/client";
import type { A2aV3ChatSettings } from "./provider.js";
import type {
  A2AStreamEventData,
  A2aProviderMetadata,
  A2aSerializedArtifact,
  A2aSerializedStatusMessage,
  A2aV3ModelConfig,
} from "./types.js";
import {
  createEmptyMetadata,
  getA2aOptions,
  isRecordStringUnknown,
  isSerializedPartArray,
  isString,
  isUint8Array,
  toJSONObject,
  toJSONObjectOrNull,
  wrapProviderMetadata,
} from "./types.js";
import {
  deserializePart,
  extractA2aMetadata,
  getResponseMetadata,
  isFilePart,
  isFilePartWithBytes,
  isFilePartWithUri,
  isTextPart,
  mapFinishReason,
  mapTaskStateToFinishReason,
  serializePart,
} from "./utils.js";

/**
 * A2A V3 Language Model implementation.
 *
 * This class implements the AI SDK `LanguageModelV3` interface to enable
 * communication with A2A protocol agents via `generateText()` and `streamText()`.
 *
 * ## Usage
 *
 * ```typescript
 * import { a2aV3 } from '@drew-foxall/a2a-ai-provider-v3';
 * import { generateText, streamText } from 'ai';
 *
 * // The model wraps an A2A agent endpoint
 * const model = a2aV3('http://localhost:3001');
 *
 * // Non-streaming (calls doGenerate internally)
 * const result = await generateText({ model, prompt: 'Hello' });
 *
 * // Streaming (calls doStream internally)
 * const stream = await streamText({ model, prompt: 'Hello' });
 * ```
 *
 * ## How Requests Work
 *
 * 1. AI SDK calls `doGenerate()` or `doStream()` with a prompt
 * 2. Prompt messages are converted to A2A `Message` format
 * 3. Message sent to agent via `ClientFactory.createFromUrl().sendMessage()`
 * 4. A2A response (Task or Message) is processed:
 *    - Task states mapped to `finishReason`
 *    - Text/file parts converted to AI SDK format
 *    - Full A2A metadata exposed via `providerMetadata.a2a`
 *
 * ## Limitations
 *
 * - **No tool support**: A2A agents don't use AI SDK tool definitions
 * - **No token usage**: A2A protocol doesn't report token counts
 * - **No push notifications**: Streaming uses SSE, not webhooks
 *
 * @see {@link A2aV3ChatSettings} - Model instance settings
 * @see {@link A2aProviderMetadata} - A2A metadata in responses
 */
export class A2aV3LanguageModel implements LanguageModelV3 {
  readonly specificationVersion = "v3" as const;
  readonly provider: string;
  readonly modelId: string;

  private readonly settings: A2aV3ChatSettings;
  private readonly config: A2aV3ModelConfig;

  readonly supportedUrls: Record<string, RegExp[]> = {
    "*/*": [/.+/],
  };

  constructor(agentUrl: string, settings: A2aV3ChatSettings, config: A2aV3ModelConfig) {
    this.provider = config.provider;
    this.modelId = agentUrl;
    this.settings = settings;
    this.config = config;
  }

  // ===========================================================================
  // Main API Methods
  // ===========================================================================

  /**
   * Generate a non-streaming response from the A2A agent
   */
  async doGenerate(options: LanguageModelV3CallOptions) {
    const { args, warnings } = this.prepareCallArgs(options);
    const client = await new ClientFactory().createFromUrl(this.modelId);

    const lastMessage = args.messages[args.messages.length - 1];
    if (!lastMessage) {
      throw new Error("Cannot handle zero messages!");
    }

    const sendParams = this.buildSendParams(lastMessage, options, true);
    const response = await client.sendMessage(sendParams);
    const content = this.convertResponseToContent(response);
    const a2aMetadata = extractA2aMetadata(response);
    const finishReason = mapTaskStateToFinishReason(a2aMetadata.taskState);

    return {
      content,
      finishReason,
      usage: this.createEmptyUsage(),
      providerMetadata: wrapProviderMetadata(a2aMetadata),
      request: { body: args },
      response: { body: response },
      warnings,
    };
  }

  /**
   * Generate a streaming response from the A2A agent
   */
  async doStream(options: LanguageModelV3CallOptions): Promise<{
    stream: ReadableStream<LanguageModelV3StreamPart>;
    request?: { body?: unknown };
    response?: { headers?: Record<string, string> };
  }> {
    const { args, warnings } = this.prepareCallArgs(options);
    const client = await new ClientFactory().createFromUrl(this.modelId);
    const clientCard = await client.getAgentCard();

    const lastMessage = args.messages[args.messages.length - 1];
    if (!lastMessage) {
      throw new Error("Cannot handle zero messages!");
    }

    this.applyProviderOptions(lastMessage, options);
    const streamParams = this.buildStreamParams(lastMessage, options);

    // Get source stream (real streaming or fallback)
    const sourceStream = clientCard.capabilities?.streaming
      ? convertAsyncIteratorToReadableStream(client.sendMessageStream(streamParams))
      : await this.createFallbackStream(client, streamParams);

    const transformStream = this.createStreamTransform(options, warnings);

    return {
      stream: sourceStream.pipeThrough(transformStream),
      request: { body: args },
    };
  }

  // ===========================================================================
  // Request Building
  // ===========================================================================

  private prepareCallArgs(options: LanguageModelV3CallOptions) {
    const warnings: LanguageModelV3CallWarning[] = [];
    const messages = this.convertPromptToMessages(options.prompt);

    if (options.tools && Object.keys(options.tools).length > 0) {
      throw new UnsupportedFunctionalityError({
        functionality: "tools",
        message: "A2A provider does not support tools - agents handle tools internally.",
      });
    }

    return {
      args: {
        model: this.modelId,
        messages,
        temperature: options.temperature,
        max_tokens: options.maxOutputTokens,
        stop: options.stopSequences,
      },
      warnings,
    };
  }

  private buildSendParams(
    message: Message,
    options: LanguageModelV3CallOptions,
    blocking: boolean
  ): MessageSendParams {
    const sendParams: MessageSendParams = {
      message: { ...message },
      configuration: blocking ? { blocking: true, acceptedOutputModes: ["text/plain"] } : undefined,
    };

    this.applyProviderOptions(sendParams.message, options);

    const a2aOpts = getA2aOptions(options.providerOptions);
    if (a2aOpts?.requestMetadata && isRecordStringUnknown(a2aOpts.requestMetadata)) {
      sendParams.metadata = a2aOpts.requestMetadata;
    }

    return sendParams;
  }

  private buildStreamParams(
    message: Message,
    options: LanguageModelV3CallOptions
  ): MessageSendParams {
    const streamParams: MessageSendParams = { message };

    const a2aOpts = getA2aOptions(options.providerOptions);
    if (a2aOpts?.requestMetadata && isRecordStringUnknown(a2aOpts.requestMetadata)) {
      streamParams.metadata = a2aOpts.requestMetadata;
    }

    return streamParams;
  }

  private applyProviderOptions(message: Message, options: LanguageModelV3CallOptions): void {
    const a2aOpts = getA2aOptions(options.providerOptions);

    // Context ID (settings first, then provider options)
    if (this.settings.contextId) {
      message.contextId = this.settings.contextId;
    }
    if (a2aOpts?.contextId && isString(a2aOpts.contextId)) {
      message.contextId = a2aOpts.contextId;
    }

    // Task ID (for follow-ups)
    if (this.settings.taskId) {
      message.taskId = this.settings.taskId;
    }
    if (a2aOpts?.taskId && isString(a2aOpts.taskId)) {
      message.taskId = a2aOpts.taskId;
    }

    // Custom parts
    if (a2aOpts?.customParts && isSerializedPartArray(a2aOpts.customParts)) {
      message.parts = [...message.parts, ...a2aOpts.customParts.map((p) => deserializePart(p))];
    }

    // Message metadata
    if (a2aOpts?.metadata && isRecordStringUnknown(a2aOpts.metadata)) {
      message.metadata = a2aOpts.metadata;
    }
  }

  // ===========================================================================
  // Streaming
  // ===========================================================================

  private async createFallbackStream(
    client: Awaited<ReturnType<ClientFactory["createFromUrl"]>>,
    params: MessageSendParams
  ): Promise<ReadableStream<A2AStreamEventData>> {
    const response = await client.sendMessage(params);
    return new ReadableStream<A2AStreamEventData>({
      start(controller) {
        controller.enqueue(response);
        controller.close();
      },
    });
  }

  private createStreamTransform(
    options: LanguageModelV3CallOptions,
    warnings: LanguageModelV3CallWarning[]
  ): TransformStream<A2AStreamEventData, LanguageModelV3StreamPart> {
    let isFirstChunk = true;
    const activeTextIds = new Set<string>();
    // Track taskIds that have already had content streamed (to avoid duplicating on final event)
    // We use taskId instead of messageId because some A2A agents send different messageIds
    // for each delta but the same taskId for all events in a task.
    const completedTaskIds = new Set<string>();
    let finishReason: LanguageModelV3FinishReason = "unknown";
    let a2aMetadata: A2aProviderMetadata = createEmptyMetadata();

    return new TransformStream<A2AStreamEventData, LanguageModelV3StreamPart>({
      start(controller) {
        controller.enqueue({ type: "stream-start", warnings });
      },

      transform: (event, controller) => {
        if (options.includeRawChunks) {
          controller.enqueue({ type: "raw", rawValue: event });
        }

        if (isFirstChunk) {
          isFirstChunk = false;
          controller.enqueue({ type: "response-metadata", ...getResponseMetadata(event) });
        }

        // Handle different event types
        if (event.kind === "status-update") {
          ({ a2aMetadata, finishReason } = this.handleStatusUpdate(
            event,
            a2aMetadata,
            finishReason,
            controller,
            activeTextIds,
            completedTaskIds
          ));
        } else if (event.kind === "artifact-update") {
          a2aMetadata = this.handleArtifactUpdate(event, a2aMetadata, controller, activeTextIds);
        } else if (event.kind === "task") {
          ({ a2aMetadata, finishReason, isFirstChunk } = this.handleTaskEvent(
            event,
            controller,
            activeTextIds,
            completedTaskIds,
            isFirstChunk
          ));
        } else if (event.kind === "message") {
          ({ a2aMetadata, finishReason } = this.handleMessageEvent(
            event,
            a2aMetadata,
            controller,
            activeTextIds
          ));
        }
      },

      flush: (controller) => {
        // Close remaining text streams
        for (const id of activeTextIds) {
          controller.enqueue({ type: "text-end", id });
        }

        controller.enqueue({
          type: "finish",
          finishReason,
          usage: this.createEmptyUsage(),
          providerMetadata: wrapProviderMetadata(a2aMetadata),
        });
      },
    });
  }

  // ===========================================================================
  // Stream Event Handlers
  // ===========================================================================

  private handleStatusUpdate(
    event: A2AStreamEventData & { kind: "status-update" },
    metadata: A2aProviderMetadata,
    currentFinishReason: LanguageModelV3FinishReason,
    controller: TransformStreamDefaultController<LanguageModelV3StreamPart>,
    activeTextIds: Set<string>,
    completedTaskIds: Set<string>
  ) {
    const taskState = event.status?.state ?? null;
    const taskId = event.taskId;

    // =========================================================================
    // A2A STATUS-UPDATE TEXT STREAMING
    // =========================================================================
    //
    // This section handles streaming text content from A2A status-update events.
    // Understanding A2A protocol semantics is critical for correct behavior.
    //
    // ## A2A Protocol Semantics
    //
    // A2A agents send status-update events with different states:
    //
    // 1. "working" state:
    //    - Message contains DELTA text (incremental chunks)
    //    - May include status indicators like "Processing your request..."
    //    - These are streamed to show real-time progress
    //
    // 2. "completed" state:
    //    - Message contains the FULL AUTHORITATIVE text (not a delta)
    //    - This REPLACES all accumulated working deltas
    //    - This is the final response that should be displayed
    //
    // ## The Problem
    //
    // AI SDK's useChat hook accumulates all text-delta events. There's no native
    // "replace" mechanism. If we emit both working deltas AND completed content
    // to the same text stream, they get concatenated:
    //
    //   Working deltas: "Processing..." + "Hello" + " world"
    //   Completed:      "Hello world"
    //   Result:         "Processing...Hello worldHello world" (WRONG!)
    //
    // ## Our Solution
    //
    // We emit the completed content as a SEPARATE text stream (different ID).
    // This creates two text parts in the AI SDK message. The client then uses
    // the LAST text part as the authoritative content.
    //
    //   Text Part 1 (working stream): "Processing...Hello world"
    //   Text Part 2 (completed stream): "Hello world"
    //   Client uses: Text Part 2 (CORRECT!)
    //
    // ## Implementation Notes
    //
    // - We track by taskId (not messageId) because A2A agents may send different
    //   messageIds for each delta but the same taskId for all events in a task.
    // - activeTextIds tracks open text streams (for text-start/text-end pairing)
    // - completedTaskIds tracks tasks that have finished (to avoid re-emitting)
    //
    // ## Debugging Tips
    //
    // If you see duplicated content in the UI:
    // 1. Check if completed content is being emitted to the same stream as deltas
    // 2. Verify the client is using the last text part (see AISDKView.tsx onFinish)
    // 3. Add logging here to see taskState, taskId, and hasStreamedContentForTask
    //
    // =========================================================================
    if (event.status?.message?.parts) {
      const isLastChunk = event.final ?? false;

      // Use taskId as the text stream ID - it's consistent across all events
      // for a single task, unlike messageId which may change per delta
      const textStreamId = taskId;
      const isCompletedState = taskState === "completed";
      const hasStreamedContentForTask =
        activeTextIds.has(textStreamId) || completedTaskIds.has(taskId);

      if (isCompletedState) {
        // COMPLETED STATE: Emit authoritative content
        //
        // If we've already streamed working deltas, emit completed content
        // as a NEW text stream to create a separate text part.
        // The client will use the last text part as authoritative.
        if (hasStreamedContentForTask) {
          // Close the working stream first
          if (activeTextIds.has(textStreamId)) {
            controller.enqueue({ type: "text-end", id: textStreamId });
            activeTextIds.delete(textStreamId);
          }
          // Emit completed content with a DIFFERENT ID to create a new text part
          // The "-completed" suffix ensures it's a distinct stream
          const completedStreamId = `${textStreamId}-completed`;
          this.enqueueParts(
            controller,
            event.status.message.parts,
            completedStreamId,
            true, // isLastChunk - completed is always final
            activeTextIds
          );
        } else {
          // Non-streaming agent: no prior deltas, emit content directly
          this.enqueueParts(
            controller,
            event.status.message.parts,
            textStreamId,
            true, // isLastChunk
            activeTextIds
          );
        }
        completedTaskIds.add(taskId);
      } else {
        // WORKING STATE: Emit as streaming delta
        //
        // These deltas are accumulated by AI SDK. The completed state
        // will emit authoritative content that the client uses to replace
        // these accumulated deltas.
        this.enqueueParts(
          controller,
          event.status.message.parts,
          textStreamId,
          isLastChunk,
          activeTextIds
        );
        if (isLastChunk) {
          completedTaskIds.add(taskId);
        }
      }
    }

    let statusMessage: A2aSerializedStatusMessage | null = null;
    let finalText: string | null = metadata.finalText;

    if (event.status?.message) {
      const msg = event.status.message;
      statusMessage = {
        messageId: msg.messageId,
        role: msg.role,
        parts: msg.parts.map((p) => serializePart(p)),
        metadata: toJSONObject(msg.metadata),
      };

      // Capture finalText when we receive the "completed" state
      // This allows clients to replace accumulated streaming content with the authoritative final text
      if (taskState === "completed") {
        finalText = msg.parts
          .filter((p): p is { kind: "text"; text: string } => p.kind === "text")
          .map((p) => p.text)
          .join("");
      }
    }

    const a2aMetadata: A2aProviderMetadata = {
      ...metadata,
      taskId: event.taskId,
      contextId: event.contextId ?? null,
      taskState,
      inputRequired: taskState === "input-required",
      statusMessage: statusMessage ?? metadata.statusMessage,
      finalText,
    };

    const finishReason = event.final ? mapFinishReason(event) : currentFinishReason;

    return { a2aMetadata, finishReason };
  }

  private handleArtifactUpdate(
    event: A2AStreamEventData & { kind: "artifact-update" },
    metadata: A2aProviderMetadata,
    controller: TransformStreamDefaultController<LanguageModelV3StreamPart>,
    activeTextIds: Set<string>
  ): A2aProviderMetadata {
    const isLastChunk = "lastChunk" in event ? Boolean(event.lastChunk) : false;
    this.enqueueParts(
      controller,
      event.artifact.parts,
      event.artifact.artifactId,
      isLastChunk,
      activeTextIds
    );

    const serializedArtifact: A2aSerializedArtifact = {
      artifactId: event.artifact.artifactId,
      name: event.artifact.name,
      description: event.artifact.description,
      parts: event.artifact.parts.map((p) => serializePart(p)),
      metadata: toJSONObject(event.artifact.metadata),
    };

    const existingIdx = metadata.artifacts.findIndex(
      (a) => a.artifactId === event.artifact.artifactId
    );
    const artifacts =
      existingIdx >= 0
        ? metadata.artifacts.map((a, i) => (i === existingIdx ? serializedArtifact : a))
        : [...metadata.artifacts, serializedArtifact];

    return {
      ...metadata,
      taskId: event.taskId,
      contextId: event.contextId ?? null,
      artifacts,
    };
  }

  /**
   * Handle A2A "task" events.
   *
   * Task events are sent at the end of a task and contain the complete task state.
   * If we've already streamed content via status-update events, we skip emitting
   * the task content to avoid duplication.
   *
   * IMPORTANT: Task events use `event.id` for the task ID, while status-update
   * events use `event.taskId`. Both refer to the same task.
   */
  private handleTaskEvent(
    event: A2AStreamEventData & { kind: "task" },
    controller: TransformStreamDefaultController<LanguageModelV3StreamPart>,
    activeTextIds: Set<string>,
    completedTaskIds: Set<string>,
    isFirstChunk: boolean
  ) {
    const a2aMetadata = extractA2aMetadata(event);
    const finishReason = mapTaskStateToFinishReason(event.status?.state);

    // IMPORTANT: For "task" events, the task ID is in event.id
    // (not event.taskId like status-update events)
    const taskId = event.id;

    if (isFirstChunk) {
      controller.enqueue({ type: "response-metadata", ...getResponseMetadata(event) });
    }

    // Skip emitting task content if we've already streamed via status-update events.
    // The status-update handler already emitted the authoritative completed content.
    if (event.status?.message) {
      const hasStreamedContent = activeTextIds.has(taskId) || completedTaskIds.has(taskId);

      if (hasStreamedContent) {
        // Already streamed content for this task - just close the stream if open
        if (activeTextIds.has(taskId)) {
          controller.enqueue({ type: "text-end", id: taskId });
          activeTextIds.delete(taskId);
        }
        // Skip emitting - would duplicate the streamed content
      } else {
        // No prior streaming - this is a non-streaming response, emit the content
        this.enqueueParts(controller, event.status.message.parts, taskId, true, activeTextIds);
      }
    }

    if (event.artifacts) {
      for (const artifact of event.artifacts) {
        this.enqueueParts(controller, artifact.parts, artifact.artifactId, true, activeTextIds);
      }
    }

    return { a2aMetadata, finishReason, isFirstChunk: false };
  }

  private handleMessageEvent(
    event: A2AStreamEventData & { kind: "message" },
    metadata: A2aProviderMetadata,
    controller: TransformStreamDefaultController<LanguageModelV3StreamPart>,
    activeTextIds: Set<string>
  ) {
    this.enqueueParts(controller, event.parts, event.messageId, true, activeTextIds);

    const statusMessage: A2aSerializedStatusMessage = {
      messageId: event.messageId,
      role: event.role,
      parts: event.parts.map((p) => serializePart(p)),
      metadata: toJSONObject(event.metadata),
    };

    const a2aMetadata: A2aProviderMetadata = {
      ...metadata,
      contextId: event.contextId ?? null,
      statusMessage,
      metadata: toJSONObjectOrNull(event.metadata),
    };

    return { a2aMetadata, finishReason: "stop" as const };
  }

  // ===========================================================================
  // Stream Part Enqueueing
  // ===========================================================================

  private enqueueParts(
    controller: TransformStreamDefaultController<LanguageModelV3StreamPart>,
    parts: Part[],
    id: string,
    isLastChunk: boolean,
    activeTextIds: Set<string>
  ): void {
    // File parts
    for (const part of parts.filter(isFilePart)) {
      if (isFilePartWithBytes(part)) {
        controller.enqueue({
          type: "file",
          data: part.file.bytes,
          mediaType: part.file.mimeType ?? "application/octet-stream",
        });
      } else if (isFilePartWithUri(part)) {
        controller.enqueue({
          type: "file",
          data: part.file.uri,
          mediaType: part.file.mimeType ?? "application/octet-stream",
        });
      }
    }

    // Text parts
    const textParts = parts.filter(isTextPart);
    if (textParts.length > 0) {
      if (!activeTextIds.has(id)) {
        controller.enqueue({ type: "text-start", id });
        activeTextIds.add(id);
      }

      const textContent = textParts.map((p) => p.text).join(" ");
      controller.enqueue({ type: "text-delta", id, delta: textContent });

      if (isLastChunk) {
        controller.enqueue({ type: "text-end", id });
        activeTextIds.delete(id);
      }
    }
  }

  // ===========================================================================
  // Message Conversion (AI SDK ↔ A2A)
  // ===========================================================================

  private convertPromptToMessages(prompt: LanguageModelV3Prompt): Message[] {
    return prompt
      .filter((msg) => msg.role === "assistant" || msg.role === "user")
      .map((msg) => ({
        role: msg.role === "assistant" ? "agent" : "user",
        kind: "message" as const,
        messageId: (this.config.generateId ?? generateId)(),
        parts: msg.content.map((part) => {
          if (part.type === "text") {
            return { kind: "text" as const, text: part.text } satisfies TextPart;
          }
          if (part.type === "file") {
            // Safe cast: part.type === "file" guarantees this is LanguageModelV3FilePart.
            // TypeScript can't narrow discriminated unions across function boundaries,
            // so we cast explicitly after the type check.
            return this.convertFilePartToA2A(part as LanguageModelV3FilePart);
          }
          throw new Error(`Unsupported part type: ${part.type}`);
        }),
      }));
  }

  private convertResponseToContent(
    response:
      | Message
      | { kind: "task"; status?: { message?: Message }; artifacts?: { parts: Part[] }[] }
  ): LanguageModelV3Content[] {
    let content: LanguageModelV3Content[] = [];

    if (response.kind === "message") {
      for (const part of response.parts) {
        content = content.concat(this.convertPartToContent(part));
      }
    }

    if (response.kind === "task") {
      if (response.status?.message) {
        for (const part of response.status.message.parts) {
          content = content.concat(this.convertPartToContent(part));
        }
      }
      if (response.artifacts) {
        for (const artifact of response.artifacts) {
          for (const part of artifact.parts) {
            content = content.concat(this.convertPartToContent(part));
          }
        }
      }
    }

    return content;
  }

  private convertPartToContent(part: Part): LanguageModelV3Content[] {
    if (isTextPart(part)) {
      return [{ type: "text", text: part.text }];
    }

    if (isFilePart(part)) {
      if (isFilePartWithBytes(part)) {
        const binaryString = atob(part.file.bytes);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return [
          {
            type: "file",
            mediaType: part.file.mimeType ?? "application/octet-stream",
            data: bytes,
          },
        ];
      }
      if (isFilePartWithUri(part)) {
        return [
          {
            type: "file",
            mediaType: part.file.mimeType ?? "application/octet-stream",
            data: part.file.uri,
          },
        ];
      }
    }

    return [];
  }

  private convertFilePartToA2A(part: LanguageModelV3FilePart): FilePart {
    if (part.type !== "file") {
      throw new UnsupportedFunctionalityError({
        functionality: `Unsupported file part type: ${part.type}`,
      });
    }

    // URL instance
    if (part.data instanceof URL) {
      return {
        kind: "file",
        file: { mimeType: part.mediaType, name: part.filename, uri: part.data.toString() },
      };
    }

    // String (URL or base64)
    if (isString(part.data)) {
      const isUrl = part.data.startsWith("http://") || part.data.startsWith("https://");
      return {
        kind: "file",
        file: {
          mimeType: part.mediaType,
          name: part.filename,
          ...(isUrl ? { uri: part.data } : { bytes: part.data }),
        },
      };
    }

    // Uint8Array → base64
    if (isUint8Array(part.data)) {
      const binary = Array.from(part.data, (byte) => String.fromCharCode(byte)).join("");
      return {
        kind: "file",
        file: { mimeType: part.mediaType, name: part.filename, bytes: btoa(binary) },
      };
    }

    throw new UnsupportedFunctionalityError({
      functionality: `Unsupported file data type: ${typeof part.data}`,
    });
  }

  // ===========================================================================
  // Utilities
  // ===========================================================================

  private createEmptyUsage(): LanguageModelV3Usage {
    return { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined };
  }
}
