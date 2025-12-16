/**
 * Provider Tests - Factory creation and model instantiation
 */

import { describe, expect, it } from "vitest";
import { A2aV3LanguageModel } from "./model.js";
import { a2aV3, createA2aV3 } from "./provider.js";

describe("createA2aV3", () => {
  it("creates a V3 provider with languageModel method", () => {
    const provider = createA2aV3();

    expect(provider.specificationVersion).toBe("v3");
    expect(typeof provider).toBe("function");
    expect(typeof provider.languageModel).toBe("function");
  });

  it("creates models via direct call and languageModel method", () => {
    const provider = createA2aV3();

    const model1 = provider("http://localhost:3001");
    const model2 = provider.languageModel("http://localhost:3001");

    expect(model1).toBeInstanceOf(A2aV3LanguageModel);
    expect(model2).toBeInstanceOf(A2aV3LanguageModel);
    expect(model1.modelId).toBe(model2.modelId);
  });

  it("passes settings to model", () => {
    const provider = createA2aV3();
    const model = provider("http://localhost:3001", {
      contextId: "ctx-123",
      taskId: "task-456",
    });

    expect(model).toBeInstanceOf(A2aV3LanguageModel);
  });

  it("accepts custom ID generator", () => {
    const provider = createA2aV3({ generateId: () => "custom-id" });
    const model = provider("http://localhost:3001");

    expect(model).toBeInstanceOf(A2aV3LanguageModel);
  });
});

describe("a2aV3 (default provider)", () => {
  it("creates models with correct properties", () => {
    const model = a2aV3("http://localhost:3001");

    expect(model.specificationVersion).toBe("v3");
    expect(model.provider).toBe("a2a-v3");
    expect(model.modelId).toBe("http://localhost:3001");
    expect(typeof model.doGenerate).toBe("function");
    expect(typeof model.doStream).toBe("function");
  });
});
