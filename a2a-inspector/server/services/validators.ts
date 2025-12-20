import type {
  AgentCard,
  Message,
  Task,
  TaskArtifactUpdateEvent,
  TaskStatusUpdateEvent,
} from "@drew-foxall/a2a-js-sdk";

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
  const errors: ValidationError[] = [];

  // Check if it's a Message
  if ("role" in event && "parts" in event) {
    return validateMessage(event as Message);
  }

  // Check if it's a Task
  if ("id" in event && "status" in event && !("taskId" in event)) {
    return validateTask(event as Task);
  }

  // Check if it's a TaskStatusUpdateEvent
  if ("taskId" in event && "status" in event && !("artifact" in event)) {
    return validateTaskStatusUpdate(event as TaskStatusUpdateEvent);
  }

  // Check if it's a TaskArtifactUpdateEvent
  if ("taskId" in event && "artifact" in event) {
    return validateTaskArtifactUpdate(event as TaskArtifactUpdateEvent);
  }

  errors.push({
    field: "event",
    message: "Unknown event type",
    severity: "warning",
  });

  return errors;
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
 * Validates a message Part.
 */
function validatePart(part: unknown, index: number): ValidationError[] {
  const errors: ValidationError[] = [];
  const p = part as Record<string, unknown>;

  // TextPart
  if ("text" in p) {
    if (typeof p.text !== "string") {
      errors.push({
        field: `parts[${index}].text`,
        message: "Text part text must be a string",
        severity: "error",
      });
    }
    return errors;
  }

  // FilePart
  if ("file" in p) {
    const file = p.file as Record<string, unknown>;
    if (!file.mimeType) {
      errors.push({
        field: `parts[${index}].file.mimeType`,
        message: "File part mimeType is required",
        severity: "error",
      });
    }
    if (!file.bytes && !file.uri) {
      errors.push({
        field: `parts[${index}].file`,
        message: "File part must have either bytes or uri",
        severity: "error",
      });
    }
    return errors;
  }

  // DataPart
  if ("data" in p) {
    if (typeof p.data !== "object" || p.data === null) {
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
