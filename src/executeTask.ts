import type { ExecuteTaskParams, ExecuteTaskResponse } from "./types";

/**
 * Get the API base URL based on the environment
 * - Development (localhost): http://localhost:8000/backoffice/ui-components
 * - Production: https://api.brixel.ai/backoffice/ui-components
 */
function getApiBaseUrl(): string {
  // Check if running in development (localhost)
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return "http://localhost:8000/backoffice/ui-components";
    }
  }
  return "https://api.brixel.ai/backoffice/ui-components";
}

/**
 * Execute a UI Task via the Brixel API
 *
 * This function allows UI Tasks to programmatically execute other UI Tasks.
 *
 * **API URL auto-detection:**
 * - Development (localhost): http://localhost:8000/backoffice/ui-components
 * - Production: https://api.brixel.ai/backoffice/ui-components
 * - Can be overridden via `apiBaseUrl` parameter
 *
 * **Authentication strategy (in order of priority):**
 * 1. **API Token from context** (RECOMMENDED): Passed via postMessage from parent
 *    - More secure and explicit
 *    - Parent has full control over the token
 * 2. **Cookies fallback**: Uses credentials: 'include' if no token provided
 *    - Works for same-domain scenarios (*.brixel.ai)
 *
 * @example
 * ```tsx
 * import { executeTask } from "@brixel/ui-task-sdk";
 *
 * // Recommended: Use token from context (passed by parent via postMessage)
 * const result = await executeTask({
 *   taskUuid: "task-123-456",
 *   inputs: { name: "John", email: "john@example.com" },
 *   apiToken: context?.apiToken, // Token passed by parent
 * });
 *
 * // Or let the hook bind it automatically
 * const { executeTask } = useBrixelTask();
 * const result = await executeTask({
 *   taskUuid: "task-123-456",
 *   inputs: { name: "John", email: "john@example.com" },
 * });
 *
 * if (result.success) {
 *   console.log("Task executed:", result.data);
 * } else {
 *   console.error("Error:", result.error);
 * }
 * ```
 *
 * @param params - Parameters for executing the task
 * @returns Promise with the execution result
 */
export async function executeTask<TOutput = unknown>(
  params: ExecuteTaskParams
): Promise<ExecuteTaskResponse<TOutput>> {
  const { taskUuid, inputs, conversationId, apiToken, apiBaseUrl } = params;

  // Use custom API URL if provided, otherwise auto-detect
  const baseUrl = apiBaseUrl || getApiBaseUrl();

  // Log the API URL in development
  if (typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
  }

  try {
    // Build headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Add Bearer token if provided (RECOMMENDED)
    if (apiToken) {
      headers["Authorization"] = `Bearer ${apiToken}`;
    }

    // Add conversation ID header if provided
    if (conversationId) {
      headers["x-conversation-id"] = conversationId;
    }

    // Make API request
    const response = await fetch(`${baseUrl}/execute_task`, {
      method: "POST",
      headers,
      // Include cookies as fallback if no explicit token provided
      credentials: apiToken ? "same-origin" : "include",
      body: JSON.stringify({
        task_uuid: taskUuid,
        inputs,
      }),
    });

    // Parse response
    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: {
          code: data.code || `HTTP_${response.status}`,
          message: data.message || `Request failed with status ${response.status}`,
          details: data.details || data,
        },
      };
    }

    return {
      success: true,
      data: data as TOutput,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: error instanceof Error ? error.message : "Unknown error occurred",
        details: error,
      },
    };
  }
}

/**
 * Create an executeTask function bound to a specific context
 *
 * This is useful when you want to reuse the same auth context
 * for multiple task executions.
 *
 * @example
 * ```tsx
 * const { context } = useBrixelTask();
 * const boundExecuteTask = createExecuteTask({
 *   apiToken: context?.apiToken,
 *   conversationId: context?.conversationId
 * });
 *
 * // Now you can call it without passing auth each time
 * const result = await boundExecuteTask({
 *   taskUuid: "task-123",
 *   inputs: { foo: "bar" }
 * });
 * ```
 *
 * @example
 * ```tsx
 * // Or use the executeTask from the hook directly (recommended)
 * const { executeTask } = useBrixelTask();
 *
 * const result = await executeTask({
 *   taskUuid: "task-123",
 *   inputs: { foo: "bar" }
 * });
 * ```
 */
export function createExecuteTask(contextAuth?: {
  apiToken?: string;
  conversationId?: string;
  apiBaseUrl?: string;
}) {
  return <TOutput = unknown>(
    params: Omit<ExecuteTaskParams, "conversationId" | "apiToken" | "apiBaseUrl">
  ): Promise<ExecuteTaskResponse<TOutput>> => {
    return executeTask<TOutput>({
      ...params,
      apiToken: contextAuth?.apiToken,
      conversationId: contextAuth?.conversationId,
      apiBaseUrl: contextAuth?.apiBaseUrl,
    });
  };
}
