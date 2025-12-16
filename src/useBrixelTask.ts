import { useCallback, useEffect, useRef, useState } from "react";
import type {
  BrixelContext,
  HostToIframeMessage,
  RenderMode,
  TaskStatus,
  UseBrixelTaskOptions,
  UseBrixelTaskResult,
} from "./types";
import { createExecuteTask } from "./executeTask";

const SDK_VERSION = "1.0.0";

/**
 * Check if running inside an iframe
 */
function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Main hook for building Brixel UI Tasks
 *
 * @example
 * ```tsx
 * import { useBrixelTask } from "@brixel/ui-task-sdk";
 *
 * interface Inputs {
 *   title: string;
 *   options: string[];
 * }
 *
 * interface Output {
 *   selectedOption: string;
 * }
 *
 * function MyUITask() {
 *   const { inputs, complete, cancel, context } = useBrixelTask<Inputs, Output>();
 *
 *   if (!inputs) return <div>Loading...</div>;
 *
 *   return (
 *     <div>
 *       <h1>{inputs.title}</h1>
 *       {inputs.options.map(opt => (
 *         <button key={opt} onClick={() => complete({ selectedOption: opt })}>
 *           {opt}
 *         </button>
 *       ))}
 *       <button onClick={() => cancel()}>Cancel</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useBrixelTask<TInputs = unknown, TOutput = unknown>(
  options: UseBrixelTaskOptions = {}
): UseBrixelTaskResult<TInputs, TOutput> {
  const { targetOrigin = "*", onInputsUpdate, onDestroy, debug = false } = options;

  const [inputs, setInputs] = useState<TInputs | null>(null);
  const [context, setContext] = useState<BrixelContext | null>(null);
  const [status, setStatus] = useState<TaskStatus>("initializing");
  const [renderMode, setRenderMode] = useState<RenderMode | null>(null);
  const [runId, setRunId] = useState<string | null>(null);

  const isEmbedded = useRef(isInIframe());
  const parentWindow = useRef<Window | null>(null);
  const hasCompleted = useRef(false);

  // Debug logger
  const debugLog = useCallback(
    (message: string, data?: unknown) => {
      if (debug) {
        console.log(`[BrixelSDK] ${message}`, data ?? "");
      }
    },
    [debug]
  );

  // Send message to parent window
  const postToParent = useCallback(
    (message: unknown) => {
      if (parentWindow.current) {
        debugLog("Sending message to parent:", message);
        parentWindow.current.postMessage(message, targetOrigin);
      } else {
        debugLog("Cannot send message - no parent window");
      }
    },
    [targetOrigin, debugLog]
  );

  // Complete the task with output
  const complete = useCallback(
    (output: TOutput) => {
      if (hasCompleted.current) {
        debugLog("Already completed, ignoring duplicate complete call");
        return;
      }

      if (!runId) {
        console.error("[BrixelSDK] Cannot complete - no runId");
        return;
      }

      hasCompleted.current = true;
      setStatus("completed");

      postToParent({
        type: "BRIXEL_COMPLETE",
        payload: { runId, output },
      });

      debugLog("Task completed with output:", output);
    },
    [runId, postToParent, debugLog]
  );

  // Cancel the task
  const cancel = useCallback(
    (reason?: string) => {
      if (hasCompleted.current) {
        debugLog("Already completed, ignoring cancel call");
        return;
      }

      if (!runId) {
        console.error("[BrixelSDK] Cannot cancel - no runId");
        return;
      }

      hasCompleted.current = true;
      setStatus("cancelled");

      postToParent({
        type: "BRIXEL_CANCEL",
        payload: { runId, reason },
      });

      debugLog("Task cancelled:", reason);
    },
    [runId, postToParent, debugLog]
  );

  // Request height change
  const setHeight = useCallback(
    (height: number | "auto") => {
      if (!runId) return;

      postToParent({
        type: "BRIXEL_RESIZE",
        payload: { runId, height },
      });

      debugLog("Resize requested:", height);
    },
    [runId, postToParent, debugLog]
  );

  // Send log to host
  const log = useCallback(
    (level: "debug" | "info" | "warn" | "error", message: string, data?: unknown) => {
      if (!runId) return;

      postToParent({
        type: "BRIXEL_LOG",
        payload: { runId, level, message, data },
      });
    },
    [runId, postToParent]
  );

  // Handle incoming messages from parent (or simulated in dev mode)
  useEffect(() => {
    // Set parent window reference (use window itself in standalone mode for dev tools)
    parentWindow.current = isEmbedded.current ? window.parent : window;

    if (!isEmbedded.current) {
      debugLog("Not in iframe, SDK will work in standalone mode (dev tools compatible)");
    }

    const handleMessage = (event: MessageEvent) => {
      const message = event.data as HostToIframeMessage<TInputs>;

      // Validate message structure
      if (!message || typeof message !== "object" || !message.type) {
        return;
      }

      // Only process Brixel messages
      if (!message.type.startsWith("BRIXEL_")) {
        return;
      }

      debugLog("Received message:", message);

      switch (message.type) {
        case "BRIXEL_INIT": {
          const { runId: newRunId, inputs: newInputs, context: newContext, renderMode: mode } =
            message.payload;

          setRunId(newRunId);
          setInputs(newInputs);
          setContext(newContext);
          setRenderMode(mode);
          setStatus("ready");
          hasCompleted.current = false;

          debugLog("Initialized with:", { runId: newRunId, inputs: newInputs, context: newContext });
          break;
        }

        case "BRIXEL_UPDATE_INPUTS": {
          const { inputs: updatedInputs } = message.payload;
          setInputs((prev) => (prev ? { ...prev, ...updatedInputs } : (updatedInputs as TInputs)));
          onInputsUpdate?.(updatedInputs);
          debugLog("Inputs updated:", updatedInputs);
          break;
        }

        case "BRIXEL_DESTROY": {
          onDestroy?.();
          debugLog("Destroy received");
          break;
        }
      }
    };

    window.addEventListener("message", handleMessage);

    // Signal ready to receive INIT
    postToParent({
      type: "BRIXEL_READY",
      payload: { version: SDK_VERSION },
    });

    debugLog("SDK initialized, READY sent");

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [debugLog, postToParent, onInputsUpdate, onDestroy]);

  // Auto-resize based on content (optional enhancement)
  useEffect(() => {
    if (!runId || !isEmbedded.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.contentRect.height;
        setHeight(height);
      }
    });

    // Observe document body for size changes
    resizeObserver.observe(document.body);

    return () => {
      resizeObserver.disconnect();
    };
  }, [runId, setHeight]);

  // Create executeTask bound to current context
  const executeTask = useCallback(
    createExecuteTask({
      apiToken: context?.apiToken,
      conversationId: context?.conversationId,
      apiBaseUrl: context?.apiBaseUrl,
    }),
    [context?.apiToken, context?.conversationId, context?.apiBaseUrl]
  );

  return {
    inputs,
    context,
    status,
    renderMode,
    runId,
    complete,
    cancel,
    setHeight,
    log,
    isEmbedded: isEmbedded.current,
    executeTask,
  };
}
