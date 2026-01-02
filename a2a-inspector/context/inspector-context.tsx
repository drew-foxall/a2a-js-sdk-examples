"use client";

import type { AgentCard } from "@drew-foxall/a2a-js-sdk";
import {
  createContext,
  type Dispatch,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useReducer,
} from "react";
import type {
  AuthConfig,
  ChatMessage,
  ConnectionState,
  ConnectionStatus,
  DebugLogEntry,
  TaskState,
  ViewMode,
} from "@/types/inspector";

/**
 * Default auth configuration.
 */
const defaultAuthConfig: AuthConfig = {
  type: "none",
};

/**
 * Inspector state shape.
 */
interface InspectorState {
  /** Connection state */
  connection: ConnectionState;
  /** Authentication configuration */
  authConfig: AuthConfig;
  /** Current view mode */
  viewMode: ViewMode;
  /** Chat messages */
  messages: ChatMessage[];
  /** Active tasks */
  tasks: Map<string, TaskState>;
  /** Current task ID */
  currentTaskId: string | null;
  /** Current context ID */
  currentContextId: string | null;
  /** Debug log entries */
  debugLog: DebugLogEntry[];
  /** Whether debug console is visible */
  debugConsoleVisible: boolean;
}

/**
 * Payload for connecting from a stored agent.
 */
interface ConnectFromStoredPayload {
  url: string;
  card: AgentCard;
  validationErrors?: ConnectionState["validationErrors"];
}

/**
 * Inspector actions.
 */
type InspectorAction =
  | { type: "SET_AGENT_URL"; payload: string }
  | { type: "SET_CONNECTION_STATUS"; payload: ConnectionStatus }
  | {
      type: "SET_AGENT_CARD";
      payload: {
        card: AgentCard;
        validationErrors: ConnectionState["validationErrors"];
      };
    }
  | { type: "SET_CONNECTION_ERROR"; payload: string }
  | { type: "DISCONNECT" }
  | { type: "CONNECT_FROM_STORED"; payload: ConnectFromStoredPayload }
  | { type: "SET_AUTH_CONFIG"; payload: AuthConfig }
  | { type: "SET_VIEW_MODE"; payload: ViewMode }
  | { type: "ADD_MESSAGE"; payload: ChatMessage }
  | { type: "CLEAR_MESSAGES" }
  | { type: "UPDATE_TASK"; payload: TaskState }
  | { type: "SET_CURRENT_TASK"; payload: string | null }
  | { type: "SET_CURRENT_CONTEXT"; payload: string | null }
  | { type: "ADD_DEBUG_LOG"; payload: DebugLogEntry }
  | { type: "CLEAR_DEBUG_LOG" }
  | { type: "TOGGLE_DEBUG_CONSOLE" }
  | { type: "SET_DEBUG_CONSOLE_VISIBLE"; payload: boolean };

/**
 * Initial state.
 */
const initialState: InspectorState = {
  connection: {
    agentUrl: "",
    status: "disconnected",
    agentCard: null,
    validationErrors: [],
    error: null,
  },
  authConfig: defaultAuthConfig,
  viewMode: "direct",
  messages: [],
  tasks: new Map(),
  currentTaskId: null,
  currentContextId: null,
  debugLog: [],
  debugConsoleVisible: false,
};

/**
 * Reducer for inspector state.
 */
function inspectorReducer(state: InspectorState, action: InspectorAction): InspectorState {
  switch (action.type) {
    case "SET_AGENT_URL":
      return {
        ...state,
        connection: {
          ...state.connection,
          agentUrl: action.payload,
        },
      };

    case "SET_CONNECTION_STATUS":
      return {
        ...state,
        connection: {
          ...state.connection,
          status: action.payload,
          error: action.payload === "error" ? state.connection.error : null,
        },
      };

    case "SET_AGENT_CARD":
      return {
        ...state,
        connection: {
          ...state.connection,
          status: "connected",
          agentCard: action.payload.card,
          validationErrors: action.payload.validationErrors,
          error: null,
        },
      };

    case "SET_CONNECTION_ERROR":
      return {
        ...state,
        connection: {
          ...state.connection,
          status: "error",
          error: action.payload,
        },
      };

    case "DISCONNECT":
      return {
        ...state,
        connection: {
          ...state.connection,
          status: "disconnected",
          agentCard: null,
          validationErrors: [],
          error: null,
        },
        messages: [],
        tasks: new Map(),
        currentTaskId: null,
        currentContextId: null,
      };

    case "CONNECT_FROM_STORED":
      return {
        ...state,
        connection: {
          agentUrl: action.payload.url,
          status: "connected",
          agentCard: action.payload.card,
          validationErrors: action.payload.validationErrors ?? [],
          error: null,
        },
        // Clear any existing chat state when connecting to a new/different agent
        messages: [],
        tasks: new Map(),
        currentTaskId: null,
        currentContextId: null,
      };

    case "SET_AUTH_CONFIG":
      return {
        ...state,
        authConfig: action.payload,
      };

    case "SET_VIEW_MODE":
      return {
        ...state,
        viewMode: action.payload,
      };

    case "ADD_MESSAGE":
      return {
        ...state,
        messages: [...state.messages, action.payload],
      };

    case "CLEAR_MESSAGES":
      return {
        ...state,
        messages: [],
      };

    case "UPDATE_TASK": {
      const newTasks = new Map(state.tasks);
      newTasks.set(action.payload.id, action.payload);
      return {
        ...state,
        tasks: newTasks,
      };
    }

    case "SET_CURRENT_TASK":
      return {
        ...state,
        currentTaskId: action.payload,
      };

    case "SET_CURRENT_CONTEXT":
      return {
        ...state,
        currentContextId: action.payload,
      };

    case "ADD_DEBUG_LOG":
      return {
        ...state,
        debugLog: [...state.debugLog, action.payload],
      };

    case "CLEAR_DEBUG_LOG":
      return {
        ...state,
        debugLog: [],
      };

    case "TOGGLE_DEBUG_CONSOLE":
      return {
        ...state,
        debugConsoleVisible: !state.debugConsoleVisible,
      };

    case "SET_DEBUG_CONSOLE_VISIBLE":
      return {
        ...state,
        debugConsoleVisible: action.payload,
      };

    default:
      return state;
  }
}

/**
 * Context value type.
 */
interface InspectorContextValue {
  state: InspectorState;
  dispatch: Dispatch<InspectorAction>;
  /** Helper to add a debug log entry */
  log: (
    type: DebugLogEntry["type"],
    message: string,
    data?: unknown,
    direction?: DebugLogEntry["direction"]
  ) => void;
}

const InspectorContext = createContext<InspectorContextValue | null>(null);

/**
 * Inspector context provider.
 */
export function InspectorProvider({
  children,
}: {
  readonly children: ReactNode;
}): React.JSX.Element {
  const [state, dispatch] = useReducer(inspectorReducer, initialState);

  const log = useCallback(
    (
      type: DebugLogEntry["type"],
      message: string,
      data?: unknown,
      direction?: DebugLogEntry["direction"]
    ) => {
      const entry: DebugLogEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        type,
        message,
      };
      if (direction !== undefined) {
        entry.direction = direction;
      }
      if (data !== undefined) {
        entry.data = data;
      }
      dispatch({
        type: "ADD_DEBUG_LOG",
        payload: entry,
      });
    },
    []
  );

  const value = useMemo(
    () => ({
      state,
      dispatch,
      log,
    }),
    [state, log]
  );

  return <InspectorContext.Provider value={value}>{children}</InspectorContext.Provider>;
}

/**
 * Hook to access inspector context.
 */
export function useInspector(): InspectorContextValue {
  const context = useContext(InspectorContext);
  if (!context) {
    throw new Error("useInspector must be used within an InspectorProvider");
  }
  return context;
}

/**
 * Hook to access connection state.
 */
export function useConnection(): ConnectionState {
  const { state } = useInspector();
  return state.connection;
}

/**
 * Hook to access messages.
 */
export function useMessages(): ChatMessage[] {
  const { state } = useInspector();
  return state.messages;
}

/**
 * Hook to access debug log.
 */
export function useDebugLog(): DebugLogEntry[] {
  const { state } = useInspector();
  return state.debugLog;
}

/**
 * Hook to access auth configuration.
 */
export function useAuthConfig(): AuthConfig {
  const { state } = useInspector();
  return state.authConfig;
}
