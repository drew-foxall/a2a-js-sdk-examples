import type {
  AgentCard,
  Message,
  Part,
  Task,
  TaskArtifactUpdateEvent,
  TaskStatusUpdateEvent,
} from "@drew-foxall/a2a-js-sdk";
import {
  hasMessageStructure,
  hasTaskArtifactUpdateStructure,
  hasTaskStatusUpdateStructure,
  hasTaskStructure,
  isMessage,
  isTask,
  isTaskArtifactUpdateEvent,
  isTaskStatusUpdateEvent,
} from "@/lib/a2a-type-guards";

/**
 * Validation error with field path and message.
 */
export interface ValidationError {
  field: string;
  message: string;
  severity: "error" | "warning";
}

/**
 * Validates an AgentCard against the A2A specification.
 * Returns an array of validation errors/warnings.
 */
export function validateAgentCard(card: AgentCard): ValidationError[] {
  const errors: ValidationError[] = [];

  // Required fields
  if (!card.name) {
    errors.push({
      field: "name",
      message: "Agent name is required",
      severity: "error",
    });
  }

  if (!card.url) {
    errors.push({
      field: "url",
      message: "Service endpoint URL is required",
      severity: "error",
    });
  } else {
    try {
      new URL(card.url);
    } catch {
      errors.push({
        field: "url",
        message: "Service endpoint URL must be a valid URL",
        severity: "error",
      });
    }
  }

  // Capabilities validation
  if (card.capabilities) {
    if (
      card.capabilities.streaming !== undefined &&
      typeof card.capabilities.streaming !== "boolean"
    ) {
      errors.push({
        field: "capabilities.streaming",
        message: "Streaming capability must be a boolean",
        severity: "error",
      });
    }

    if (
      card.capabilities.pushNotifications !== undefined &&
      typeof card.capabilities.pushNotifications !== "boolean"
    ) {
      errors.push({
        field: "capabilities.pushNotifications",
        message: "Push notifications capability must be a boolean",
        severity: "error",
      });
    }
  }

  // Skills validation
  if (card.skills && Array.isArray(card.skills)) {
    for (let i = 0; i < card.skills.length; i++) {
      const skill = card.skills[i];
      if (skill && !skill.id) {
        errors.push({
          field: `skills[${i}].id`,
          message: "Skill ID is required",
          severity: "error",
        });
      }
      if (skill && !skill.name) {
        errors.push({
          field: `skills[${i}].name`,
          message: "Skill name is required",
          severity: "error",
        });
      }
    }
  }

  // Provider validation (recommended)
  if (!card.provider) {
    errors.push({
      field: "provider",
      message: "Provider information is recommended",
      severity: "warning",
    });
  }

  // Version validation (recommended)
  if (!card.version) {
    errors.push({
      field: "version",
      message: "Version is recommended",
      severity: "warning",
    });
  }

  return errors;
}

/**
 * A2A event types that can be validated.
 */
export type A2AEvent = Message | Task | TaskStatusUpdateEvent | TaskArtifactUpdateEvent;

/**
 * Validates an A2A message/event against the specification.
 * Returns an array of validation errors/warnings.
 */
export function validateA2AEvent(event: A2AEvent): ValidationError[] {
  // Use type guards to properly narrow the event type
  if (isMessage(event)) {
    return validateMessage(event);
  }

  if (isTask(event)) {
    return validateTask(event);
  }

  if (isTaskStatusUpdateEvent(event)) {
    return validateTaskStatusUpdate(event);
  }

  if (isTaskArtifactUpdateEvent(event)) {
    return validateTaskArtifactUpdate(event);
  }

  // Fallback: check structure for events that may not have `kind` discriminator
  if (hasMessageStructure(event)) {
    return validateMessage(event as Message);
  }

  if (hasTaskStructure(event)) {
    return validateTask(event as Task);
  }

  if (hasTaskStatusUpdateStructure(event)) {
    return validateTaskStatusUpdate(event as TaskStatusUpdateEvent);
  }

  if (hasTaskArtifactUpdateStructure(event)) {
    return validateTaskArtifactUpdate(event as TaskArtifactUpdateEvent);
  }

  return [
    {
      field: "event",
      message: "Unknown event type",
      severity: "warning",
    },
  ];
}

/**
 * Validates a Message against the A2A specification.
 */
function validateMessage(message: Message): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!message.role) {
    errors.push({
      field: "role",
      message: "Message role is required",
      severity: "error",
    });
  } else if (!["user", "agent"].includes(message.role)) {
    errors.push({
      field: "role",
      message: "Message role must be 'user' or 'agent'",
      severity: "error",
    });
  }

  if (!message.parts || !Array.isArray(message.parts)) {
    errors.push({
      field: "parts",
      message: "Message parts array is required",
      severity: "error",
    });
  } else if (message.parts.length === 0) {
    errors.push({
      field: "parts",
      message: "Message must have at least one part",
      severity: "warning",
    });
  } else {
    for (let i = 0; i < message.parts.length; i++) {
      const part = message.parts[i];
      if (part) {
        const partErrors = validatePart(part, i);
        errors.push(...partErrors);
      }
    }
  }

  return errors;
}

/**
 * Type guard to check if value has a specific property.
 */
function hasProperty<K extends string>(obj: object, key: K): obj is object & Record<K, unknown> {
  return key in obj;
}

/**
 * Validates a message Part.
 */
function validatePart(part: Part | unknown, index: number): ValidationError[] {
  const errors: ValidationError[] = [];

  if (part === null || typeof part !== "object") {
    errors.push({
      field: `parts[${index}]`,
      message: "Part must be an object",
      severity: "error",
    });
    return errors;
  }

  // TextPart - has "text" property
  if (hasProperty(part, "text")) {
    if (typeof part.text !== "string") {
      errors.push({
        field: `parts[${index}].text`,
        message: "Text part text must be a string",
        severity: "error",
      });
    }
    return errors;
  }

  // FilePart - has "file" property
  if (hasProperty(part, "file")) {
    const file = part.file;
    if (file === null || typeof file !== "object") {
      errors.push({
        field: `parts[${index}].file`,
        message: "File part file must be an object",
        severity: "error",
      });
      return errors;
    }

    if (!hasProperty(file, "mimeType") || !file.mimeType) {
      errors.push({
        field: `parts[${index}].file.mimeType`,
        message: "File part mimeType is required",
        severity: "error",
      });
    }
    if (!hasProperty(file, "bytes") && !hasProperty(file, "uri")) {
      errors.push({
        field: `parts[${index}].file`,
        message: "File part must have either bytes or uri",
        severity: "error",
      });
    }
    return errors;
  }

  // DataPart - has "data" property
  if (hasProperty(part, "data")) {
    if (typeof part.data !== "object" || part.data === null) {
      errors.push({
        field: `parts[${index}].data`,
        message: "Data part data must be an object",
        severity: "error",
      });
    }
    return errors;
  }

  errors.push({
    field: `parts[${index}]`,
    message: "Unknown part type - must have text, file, or data",
    severity: "warning",
  });

  return errors;
}

/**
 * Validates a Task against the A2A specification.
 */
function validateTask(task: Task): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!task.id) {
    errors.push({
      field: "id",
      message: "Task ID is required",
      severity: "error",
    });
  }

  if (!task.status) {
    errors.push({
      field: "status",
      message: "Task status is required",
      severity: "error",
    });
  } else {
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
    if (!validStates.includes(task.status.state)) {
      errors.push({
        field: "status.state",
        message: `Task state must be one of: ${validStates.join(", ")}`,
        severity: "error",
      });
    }
  }

  return errors;
}

/**
 * Validates a TaskStatusUpdateEvent.
 */
function validateTaskStatusUpdate(event: TaskStatusUpdateEvent): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!event.taskId) {
    errors.push({
      field: "taskId",
      message: "Task ID is required in status update",
      severity: "error",
    });
  }

  if (!event.status) {
    errors.push({
      field: "status",
      message: "Status is required in status update",
      severity: "error",
    });
  }

  return errors;
}

/**
 * Validates a TaskArtifactUpdateEvent.
 */
function validateTaskArtifactUpdate(event: TaskArtifactUpdateEvent): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!event.taskId) {
    errors.push({
      field: "taskId",
      message: "Task ID is required in artifact update",
      severity: "error",
    });
  }

  if (!event.artifact) {
    errors.push({
      field: "artifact",
      message: "Artifact is required in artifact update",
      severity: "error",
    });
  }

  return errors;
}
