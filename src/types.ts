/**
 * Brixel UI Task Protocol Types
 *
 * This file defines the postMessage protocol between the Brixel host (chat)
 * and the UI Task iframe.
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Render mode determines if the UI Task requires user interaction
 * - "display": Just shows content, no output expected
 * - "interaction": Requires user action, workflow waits for completion
 */
export type RenderMode = "display" | "interaction";

/**
 * Context provided by Brixel host to the UI Task
 */
export interface BrixelContext {
  /** Unique run identifier for this execution */
  runId: string;
  /** Step ID within the workflow (if part of a workflow) */
  stepId?: string;
  /** User information */
  user?: {
    id: string;
    name?: string;
    email?: string;
    avatarUrl?: string;
  };
  /** Organization information */
  organization?: {
    id: string;
    name?: string;
  };
  /** UI preferences */
  theme: "light" | "dark" | "system";
  locale: string;
  /** Capabilities supported by the host */
  capabilities: {
    resize: boolean;
    fullscreen: boolean;
    fileUpload: boolean;
  };
  /** Conversation ID for API calls (optional) */
  conversationId?: string;
  /** API token passed by parent for authenticated requests (recommended over cookies) */
  apiToken?: string;
  /** Optional custom API base URL (for development/testing) */
  apiBaseUrl?: string;
}

/**
 * UI Task manifest schema
 */
export interface UITaskManifest {
  id: string;
  version: string;
  type: "ui_component";
  name: string;
  description?: string;
  renderMode: RenderMode;
  entry: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  ui?: {
    height?: "auto" | number;
    minHeight?: number;
    maxHeight?: number;
    preferredWidth?: "message" | "full" | number;
  };
  permissions?: {
    network?: string[];
    files?: boolean;
    clipboard?: boolean;
  };
}

// ============================================================================
// PostMessage Protocol - Host to Iframe
// ============================================================================

/**
 * INIT: Sent by host when iframe is ready to receive data
 */
export interface InitMessage<TInputs = unknown> {
  type: "BRIXEL_INIT";
  payload: {
    runId: string;
    inputs: TInputs;
    context: BrixelContext;
    renderMode: RenderMode;
  };
}

/**
 * UPDATE_INPUTS: Sent when inputs change during execution
 */
export interface UpdateInputsMessage<TInputs = unknown> {
  type: "BRIXEL_UPDATE_INPUTS";
  payload: {
    runId: string;
    inputs: Partial<TInputs>;
  };
}

/**
 * DESTROY: Sent when the UI Task should clean up
 */
export interface DestroyMessage {
  type: "BRIXEL_DESTROY";
  payload: {
    runId: string;
  };
}

export type HostToIframeMessage<TInputs = unknown> =
  | InitMessage<TInputs>
  | UpdateInputsMessage<TInputs>
  | DestroyMessage;

// ============================================================================
// PostMessage Protocol - Iframe to Host
// ============================================================================

/**
 * READY: Iframe signals it's ready to receive INIT
 */
export interface ReadyMessage {
  type: "BRIXEL_READY";
  payload: {
    version: string;
  };
}

/**
 * RESIZE: Request height change
 */
export interface ResizeMessage {
  type: "BRIXEL_RESIZE";
  payload: {
    runId: string;
    height: number | "auto";
  };
}

/**
 * COMPLETE: Task finished with output (for interaction mode)
 */
export interface CompleteMessage<TOutput = unknown> {
  type: "BRIXEL_COMPLETE";
  payload: {
    runId: string;
    output: TOutput;
  };
}

/**
 * CANCEL: User cancelled the task
 */
export interface CancelMessage {
  type: "BRIXEL_CANCEL";
  payload: {
    runId: string;
    reason?: string;
  };
}

/**
 * ERROR: An error occurred in the UI Task
 */
export interface ErrorMessage {
  type: "BRIXEL_ERROR";
  payload: {
    runId: string;
    error: {
      code: string;
      message: string;
      details?: unknown;
    };
  };
}

/**
 * LOG: Debug log from iframe (captured by host in dev mode)
 */
export interface LogMessage {
  type: "BRIXEL_LOG";
  payload: {
    runId: string;
    level: "debug" | "info" | "warn" | "error";
    message: string;
    data?: unknown;
  };
}

export type IframeToHostMessage<TOutput = unknown> =
  | ReadyMessage
  | ResizeMessage
  | CompleteMessage<TOutput>
  | CancelMessage
  | ErrorMessage
  | LogMessage;

// ============================================================================
// Hook Types
// ============================================================================

export type TaskStatus = "initializing" | "ready" | "completed" | "cancelled" | "error";

export interface UseBrixelTaskResult<TInputs, TOutput> {
  /** Current inputs from the host */
  inputs: TInputs | null;
  /** Brixel context (user, theme, locale, etc.) */
  context: BrixelContext | null;
  /** Current task status */
  status: TaskStatus;
  /** Render mode of this task */
  renderMode: RenderMode | null;
  /** Run ID for this execution */
  runId: string | null;
  /** Complete the task with output (required for interaction mode) */
  complete: (output: TOutput) => void;
  /** Cancel the task */
  cancel: (reason?: string) => void;
  /** Request height resize */
  setHeight: (height: number | "auto") => void;
  /** Send a log message to the host */
  log: (level: "debug" | "info" | "warn" | "error", message: string, data?: unknown) => void;
  /** Whether running inside Brixel iframe */
  isEmbedded: boolean;
  /** Execute another UI Task (bound to current context) */
  executeTask: <TTaskOutput = unknown>(
    params: Omit<ExecuteTaskParams, "conversationId" | "apiToken" | "apiBaseUrl">
  ) => Promise<ExecuteTaskResponse<TTaskOutput>>;
}

export interface UseBrixelTaskOptions {
  /** Target origin for postMessage (default: "*", should be restricted in production) */
  targetOrigin?: string;
  /** Callback when inputs are updated */
  onInputsUpdate?: (inputs: unknown) => void;
  /** Callback before destroy */
  onDestroy?: () => void;
  /** Enable debug logging */
  debug?: boolean;
}

// ============================================================================
// Execute Task API Types
// ============================================================================

/**
 * Parameters for executing a UI Task via the API
 */
export interface ExecuteTaskParams {
  /** UUID of the task to execute */
  taskUuid: string;
  /** Input values for the task */
  inputs: Record<string, unknown>;
  /** Optional conversation ID for x-conversation-id header */
  conversationId?: string;
  /** Optional API token (if not provided, uses credentials: 'include' as fallback) */
  apiToken?: string;
  /** Optional custom API base URL (auto-detects dev/prod if not provided) */
  apiBaseUrl?: string;
}

/**
 * Response from the execute task API
 */
export interface ExecuteTaskResponse<TOutput = unknown> {
  success: boolean;
  data?: TOutput;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}
