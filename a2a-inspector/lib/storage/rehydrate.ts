import type { UIMessage } from "ai";

import { getArrayProp, getStringProp, isA2AStreamEvent } from "@/lib/a2a-type-guards";
import type { RawA2AEvent, ValidationError } from "@/types";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSeverity(value: unknown): value is "error" | "warning" {
  return value === "error" || value === "warning";
}

function isValidationError(value: unknown): value is ValidationError {
  const field = getStringProp(value, "field");
  const message = getStringProp(value, "message");
  const severity = getStringProp(value, "severity");
  return Boolean(field && message && severity && isSeverity(severity));
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function isRawKind(value: unknown): value is RawA2AEvent["kind"] {
  return (
    value === "message" ||
    value === "task" ||
    value === "status-update" ||
    value === "artifact-update" ||
    value === "error"
  );
}

/**
 * Extract RawA2AEvent[] from a stored message metadata blob.
 * Returns [] when missing or invalid.
 */
export function extractRawA2AEventsFromMetadata(metadata: unknown): RawA2AEvent[] {
  const events = getArrayProp(metadata, "a2aEvents");
  if (!events) return [];

  const result: RawA2AEvent[] = [];

  for (const e of events) {
    if (!isPlainObject(e)) continue;

    const id = getStringProp(e, "id");
    const kind = getStringProp(e, "kind");
    const timestamp = toDate(e.timestamp);
    const event = e.event;
    const validationErrorsRaw = getArrayProp(e, "validationErrors") ?? [];
    const textContent = getStringProp(e, "textContent");

    if (!id || !timestamp || !kind || !isRawKind(kind) || !isA2AStreamEvent(event)) {
      continue;
    }

    const validationErrors = validationErrorsRaw.filter(isValidationError);

    result.push({
      id,
      timestamp,
      kind,
      event,
      validationErrors,
      ...(textContent ? { textContent } : {}),
    });
  }

  // Sort oldest -> newest
  result.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  return result;
}

/**
 * Extract UIMessage parts from stored metadata (best-effort).
 * Falls back to a single text part if invalid.
 */
export function extractUIPartsFromMetadata(
  metadata: unknown,
  fallbackText: string
): UIMessage["parts"] {
  const parts = getArrayProp(metadata, "uiParts");
  if (!parts) {
    return [{ type: "text", text: fallbackText }];
  }

  const validParts: UIMessage["parts"] = [];
  for (const p of parts) {
    if (!isPlainObject(p)) continue;

    const type = getStringProp(p, "type");
    if (!type) continue;

    if (type === "text") {
      const text = getStringProp(p, "text");
      if (typeof text === "string") {
        validParts.push({ type: "text", text });
      }
    }
  }

  return validParts.length > 0 ? validParts : [{ type: "text", text: fallbackText }];
}
