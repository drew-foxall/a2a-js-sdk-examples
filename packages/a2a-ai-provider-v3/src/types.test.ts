/**
 * Types Tests - Key type guards and JSON conversion
 */

import { describe, expect, it } from "vitest";
import {
  createEmptyMetadata,
  getA2aOptions,
  isA2aProviderOptions,
  isJSONValue,
  isSerializedPart,
  toJSONObject,
  wrapProviderMetadata,
} from "./types.js";

describe("isJSONValue", () => {
  it("accepts JSON primitives and structures", () => {
    expect(isJSONValue(null)).toBe(true);
    expect(isJSONValue("string")).toBe(true);
    expect(isJSONValue(42)).toBe(true);
    expect(isJSONValue(true)).toBe(true);
    expect(isJSONValue([1, 2, { key: "value" }])).toBe(true);
    expect(isJSONValue({ nested: { deep: 42 } })).toBe(true);
  });

  it("rejects non-JSON values", () => {
    expect(isJSONValue(undefined)).toBe(false);
    expect(isJSONValue(() => {})).toBe(false);
    expect(isJSONValue(Symbol("test"))).toBe(false);
  });
});

describe("toJSONObject", () => {
  it("converts valid objects and filters non-JSON values", () => {
    const input = {
      valid: "string",
      num: 42,
      func: () => {},
    } as Record<string, unknown>;

    const result = toJSONObject(input);

    expect(result).toEqual({ valid: "string", num: 42 });
  });

  it("returns undefined for undefined input", () => {
    expect(toJSONObject(undefined)).toBeUndefined();
  });
});

describe("isSerializedPart", () => {
  it("validates part kinds", () => {
    expect(isSerializedPart({ kind: "text", text: "Hello" })).toBe(true);
    expect(isSerializedPart({ kind: "file", file: { uri: "https://x.com" } })).toBe(true);
    expect(isSerializedPart({ kind: "data", data: {} })).toBe(true);
    expect(isSerializedPart({ kind: "invalid" })).toBe(false);
    expect(isSerializedPart(null)).toBe(false);
  });
});

describe("isA2aProviderOptions", () => {
  it("validates provider options structure", () => {
    expect(isA2aProviderOptions({})).toBe(true);
    expect(isA2aProviderOptions({ contextId: "ctx", taskId: "task" })).toBe(true);
    expect(isA2aProviderOptions({ customParts: [{ kind: "text", text: "Hi" }] })).toBe(true);
    expect(isA2aProviderOptions({ contextId: 123 })).toBe(false); // wrong type
    expect(isA2aProviderOptions(null)).toBe(false);
  });
});

describe("getA2aOptions", () => {
  it("extracts valid a2a options from providerOptions", () => {
    const result = getA2aOptions({ a2a: { contextId: "ctx-123" } });
    expect(result?.contextId).toBe("ctx-123");
  });

  it("returns undefined for invalid/missing options", () => {
    expect(getA2aOptions(undefined)).toBeUndefined();
    expect(getA2aOptions({ a2a: { contextId: 123 } })).toBeUndefined();
  });
});

describe("createEmptyMetadata / wrapProviderMetadata", () => {
  it("creates and wraps metadata correctly", () => {
    const metadata = createEmptyMetadata();
    expect(metadata.taskId).toBeNull();
    expect(metadata.artifacts).toEqual([]);

    const wrapped = wrapProviderMetadata(metadata);
    expect(wrapped.a2a).toBe(metadata);
  });
});
