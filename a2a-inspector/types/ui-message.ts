import type { UIDataTypes, UIMessage, UITools } from "ai";

import type { A2AEventData } from "@/schemas/a2a-events";

/**
 * Custom UIMessage typing helpers for A2A Inspector.
 *
 * Why:
 * - AI SDK UIMessage parts include custom `data-*` parts (see UIMessage reference).
 * - We stream A2A events as a custom data part `data-a2a-event`.
 * - We want this to be **composable** with other teams' UIMessage types (metadata, data parts, tools).
 * - Typing this removes casts in `useChat` callbacks and enables safer correlation.
 *
 * References:
 * - https://ai-sdk.dev/docs/reference/ai-sdk-core/ui-message
 * - https://ai-sdk.dev/docs/ai-sdk-ui/chatbot
 * - https://ai-sdk.dev/elements/examples/chatbot
 */
export type A2AUIDataTypes = {
  "a2a-event": A2AEventData;
} & UIDataTypes;

/**
 * Compose A2A data parts into an existing UIDataTypes map.
 *
 * Example:
 * - Your app has `{ myData: {...} }`
 * - Compose A2A: `WithA2ADataParts<{ myData: ... }>`
 * - You now get both `data-myData` and `data-a2a-event` parts in `UIMessage.parts`.
 */
export type WithA2ADataParts<DATA extends UIDataTypes> = DATA & {
  "a2a-event": A2AEventData;
};

/**
 * Composable UIMessage type that includes A2A data parts.
 *
 * Consumers can bring their own:
 * - `METADATA` type
 * - `DATA_PARTS` map
 * - `TOOLS` map
 */
export type A2AUIMessage<
  METADATA = unknown,
  DATA_PARTS extends UIDataTypes = UIDataTypes,
  TOOLS extends UITools = UITools,
> = UIMessage<METADATA, WithA2ADataParts<DATA_PARTS>, TOOLS>;

/**
 * Backwards-compatible alias for the inspector app's default.
 */
export type DefaultA2AUIMessage = A2AUIMessage;
