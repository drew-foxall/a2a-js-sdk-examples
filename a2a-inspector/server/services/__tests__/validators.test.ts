import { describe, expect, it } from "vitest";
import { validateA2AEvent, validateAgentCard } from "../validators";

// Use partial types for testing since we're testing validation of incomplete data
type PartialAgentCard = {
  name?: string;
  url?: string;
  version?: string;
  provider?: { organization?: string; url?: string };
  capabilities?: { streaming?: boolean; pushNotifications?: boolean };
  skills?: Array<{ id?: string; name?: string; description?: string; tags?: string[] }>;
};

type PartialMessage = {
  role?: string;
  parts?: Array<{
    text?: string;
    file?: { mimeType?: string; uri?: string; bytes?: string };
    data?: unknown;
  }>;
  kind?: string;
  messageId?: string;
};

type PartialTask = {
  id?: string;
  status?: { state?: string };
  contextId?: string;
  kind?: string;
};

describe("validateAgentCard", () => {
  it("should return no errors for a valid agent card", () => {
    const card: PartialAgentCard = {
      name: "Test Agent",
      url: "https://example.com/agent",
      version: "1.0.0",
      provider: {
        organization: "Test Org",
        url: "https://example.com",
      },
      capabilities: {
        streaming: true,
        pushNotifications: false,
      },
      skills: [
        {
          id: "skill-1",
          name: "Test Skill",
          description: "A test skill",
          tags: ["test"],
        },
      ],
    };

    // biome-ignore lint/suspicious/noExplicitAny: Testing with partial types
    const errors = validateAgentCard(card as any);
    expect(errors.filter((e) => e.severity === "error")).toHaveLength(0);
  });

  it("should return error for missing name", () => {
    const card: PartialAgentCard = {
      url: "https://example.com/agent",
    };

    // biome-ignore lint/suspicious/noExplicitAny: Testing with partial types
    const errors = validateAgentCard(card as any);
    expect(errors).toContainEqual({
      field: "name",
      message: "Agent name is required",
      severity: "error",
    });
  });

  it("should return error for missing url", () => {
    const card: PartialAgentCard = {
      name: "Test Agent",
    };

    // biome-ignore lint/suspicious/noExplicitAny: Testing with partial types
    const errors = validateAgentCard(card as any);
    expect(errors).toContainEqual({
      field: "url",
      message: "Service endpoint URL is required",
      severity: "error",
    });
  });

  it("should return error for invalid url", () => {
    const card: PartialAgentCard = {
      name: "Test Agent",
      url: "not-a-valid-url",
    };

    // biome-ignore lint/suspicious/noExplicitAny: Testing with partial types
    const errors = validateAgentCard(card as any);
    expect(errors).toContainEqual({
      field: "url",
      message: "Service endpoint URL must be a valid URL",
      severity: "error",
    });
  });

  it("should return warning for missing provider", () => {
    const card: PartialAgentCard = {
      name: "Test Agent",
      url: "https://example.com/agent",
      version: "1.0.0",
    };

    // biome-ignore lint/suspicious/noExplicitAny: Testing with partial types
    const errors = validateAgentCard(card as any);
    expect(errors).toContainEqual({
      field: "provider",
      message: "Provider information is recommended",
      severity: "warning",
    });
  });

  it("should return warning for missing version", () => {
    const card: PartialAgentCard = {
      name: "Test Agent",
      url: "https://example.com/agent",
      provider: { organization: "Test", url: "https://example.com" },
    };

    // biome-ignore lint/suspicious/noExplicitAny: Testing with partial types
    const errors = validateAgentCard(card as any);
    expect(errors).toContainEqual({
      field: "version",
      message: "Version is recommended",
      severity: "warning",
    });
  });

  it("should validate skills have required fields", () => {
    const card: PartialAgentCard = {
      name: "Test Agent",
      url: "https://example.com/agent",
      skills: [
        { id: "", name: "Skill without ID", description: "desc", tags: [] },
        { id: "skill-2", name: "", description: "desc", tags: [] },
      ],
    };

    // biome-ignore lint/suspicious/noExplicitAny: Testing with partial types
    const errors = validateAgentCard(card as any);
    expect(errors).toContainEqual({
      field: "skills[0].id",
      message: "Skill ID is required",
      severity: "error",
    });
    expect(errors).toContainEqual({
      field: "skills[1].name",
      message: "Skill name is required",
      severity: "error",
    });
  });
});

describe("validateA2AEvent", () => {
  describe("Message validation", () => {
    it("should validate a valid message", () => {
      const message: PartialMessage = {
        role: "agent",
        parts: [{ text: "Hello, world!" }],
        kind: "message",
        messageId: "msg-123",
      };

      // biome-ignore lint/suspicious/noExplicitAny: Testing with partial types
      const errors = validateA2AEvent(message as any);
      expect(errors.filter((e) => e.severity === "error")).toHaveLength(0);
    });

    it("should return error for invalid role", () => {
      const message: PartialMessage = {
        role: "invalid",
        parts: [{ text: "Hello" }],
        kind: "message",
        messageId: "msg-123",
      };

      // biome-ignore lint/suspicious/noExplicitAny: Testing with partial types
      const errors = validateA2AEvent(message as any);
      expect(errors).toContainEqual({
        field: "role",
        message: "Message role must be 'user' or 'agent'",
        severity: "error",
      });
    });

    it("should return warning for empty parts array", () => {
      const message: PartialMessage = {
        role: "agent",
        parts: [],
        kind: "message",
        messageId: "msg-123",
      };

      // biome-ignore lint/suspicious/noExplicitAny: Testing with partial types
      const errors = validateA2AEvent(message as any);
      expect(errors).toContainEqual({
        field: "parts",
        message: "Message must have at least one part",
        severity: "warning",
      });
    });

    it("should validate text parts", () => {
      const message: PartialMessage = {
        role: "agent",
        parts: [{ text: "Hello" }],
        kind: "message",
        messageId: "msg-123",
      };

      // biome-ignore lint/suspicious/noExplicitAny: Testing with partial types
      const errors = validateA2AEvent(message as any);
      expect(errors.filter((e) => e.severity === "error")).toHaveLength(0);
    });

    it("should validate file parts require mimeType", () => {
      const message: PartialMessage = {
        role: "agent",
        parts: [{ file: { uri: "https://example.com/file.pdf" } }],
        kind: "message",
        messageId: "msg-123",
      };

      // biome-ignore lint/suspicious/noExplicitAny: Testing with partial types
      const errors = validateA2AEvent(message as any);
      expect(errors).toContainEqual({
        field: "parts[0].file.mimeType",
        message: "File part mimeType is required",
        severity: "error",
      });
    });
  });

  describe("Task validation", () => {
    it("should validate a valid task", () => {
      const task: PartialTask = {
        id: "task-123",
        status: {
          state: "working",
        },
        contextId: "ctx-123",
        kind: "task",
      };

      // biome-ignore lint/suspicious/noExplicitAny: Testing with partial types
      const errors = validateA2AEvent(task as any);
      expect(errors.filter((e) => e.severity === "error")).toHaveLength(0);
    });

    it("should return error for invalid task state", () => {
      const task: PartialTask = {
        id: "task-123",
        status: { state: "invalid-state" },
        contextId: "ctx-123",
        kind: "task",
      };

      // biome-ignore lint/suspicious/noExplicitAny: Testing with partial types
      const errors = validateA2AEvent(task as any);
      expect(errors.some((e) => e.field === "status.state" && e.severity === "error")).toBe(true);
    });

    it("should validate all valid task states", () => {
      const validStates = [
        "submitted",
        "working",
        "input-required",
        "completed",
        "canceled",
        "failed",
        "rejected",
        "auth-required",
      ];

      for (const state of validStates) {
        const task: PartialTask = {
          id: "task-123",
          status: { state },
          contextId: "ctx-123",
          kind: "task",
        };

        // biome-ignore lint/suspicious/noExplicitAny: Testing with partial types
        const errors = validateA2AEvent(task as any);
        expect(errors.filter((e) => e.severity === "error")).toHaveLength(0);
      }
    });
  });

  describe("Unknown event type", () => {
    it("should return warning for unknown event type", () => {
      const unknownEvent = { someField: "value" };

      // biome-ignore lint/suspicious/noExplicitAny: Testing with partial types
      const errors = validateA2AEvent(unknownEvent as any);
      expect(errors).toContainEqual({
        field: "event",
        message: "Unknown event type",
        severity: "warning",
      });
    });
  });
});
