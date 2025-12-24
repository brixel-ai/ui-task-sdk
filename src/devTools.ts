import type { BrixelContext, RenderMode } from "./types";

/**
 * Development tools for testing UI Tasks outside of Brixel
 *
 * These utilities help simulate the Brixel host environment during development
 */

/**
 * Default mock context for development
 */
export const mockContext: BrixelContext = {
  runId: "dev-run-001",
  stepId: "dev-step-001",
  user: {
    id: "dev-user-001",
    name: "Dev User",
    email: "dev@example.com",
  },
  organization: {
    id: "dev-org-001",
    name: "Dev Organization",
  },
  theme: "light",
  locale: "en-US",
  capabilities: {
    resize: true,
    fullscreen: true,
    fileUpload: false,
  },
};

/**
 * Simulate the Brixel host sending an INIT message
 *
 * @example
 * ```tsx
 * // In your main.tsx or App.tsx for development
 * if (import.meta.env.DEV) {
 *   simulateBrixelInit({
 *     title: "Test Survey",
 *     questions: [
 *       { id: "q1", text: "How are you?", options: ["Good", "Bad"] }
 *     ]
 *   });
 * }
 * ```
 */
export function simulateBrixelInit<TInputs = unknown>(
  inputs: TInputs,
  options: {
    runId?: string;
    renderMode?: RenderMode;
    context?: Partial<BrixelContext>;
    delay?: number;
  } = {}
): void {
  const { runId = "dev-run-001", renderMode = "interaction", context = {}, delay = 100 } = options;

  const message = {
    type: "BRIXEL_INIT",
    payload: {
      runId,
      inputs,
      context: { ...mockContext, ...context },
      renderMode,
    },
  };

  // Delay to ensure the component has mounted and listeners are ready
  setTimeout(() => {
    window.postMessage(message, "*");
    console.log("[BrixelDevTools] Simulated INIT message sent:", message);
  }, delay);
}

/**
 * Listen for messages from the UI Task (useful for debugging)
 *
 * @example
 * ```tsx
 * useEffect(() => {
 *   const cleanup = listenToUITaskMessages((message) => {
 *     console.log("UI Task sent:", message);
 *   });
 *   return cleanup;
 * }, []);
 * ```
 */
export function listenToUITaskMessages(
  callback: (message: unknown) => void
): () => void {
  const handleMessage = (event: MessageEvent) => {
    const message = event.data;
    if (message && typeof message === "object" && message.type?.startsWith("BRIXEL_")) {
      callback(message);
    }
  };

  window.addEventListener("message", handleMessage);

  return () => {
    window.removeEventListener("message", handleMessage);
  };
}

/**
 * Create a mock Brixel host for development
 *
 * @example
 * ```tsx
 * const host = createMockBrixelHost({
 *   onComplete: (output) => console.log("Completed:", output),
 *   onCancel: (reason) => console.log("Cancelled:", reason),
 * });
 *
 * // Send init
 * host.init({ title: "Test" });
 *
 * // Cleanup
 * host.destroy();
 * ```
 */
export function createMockBrixelHost<TInputs = unknown, TOutput = unknown>(options: {
  onReady?: (version: string) => void;
  onComplete?: (output: TOutput) => void;
  onCancel?: (reason?: string) => void;
  onResize?: (height: number | "auto") => void;
  onLog?: (level: string, message: string, data?: unknown) => void;
  onError?: (error: { code: string; message: string; details?: unknown }) => void;
}) {
  const { onReady, onComplete, onCancel, onResize, onLog, onError } = options;

  let currentRunId: string | null = null;

  const handleMessage = (event: MessageEvent) => {
    const message = event.data;
    if (!message || typeof message !== "object" || !message.type?.startsWith("BRIXEL_")) {
      return;
    }

    switch (message.type) {
      case "BRIXEL_READY":
        onReady?.(message.payload?.version);
        break;
      case "BRIXEL_COMPLETE":
        onComplete?.(message.payload?.output);
        break;
      case "BRIXEL_CANCEL":
        onCancel?.(message.payload?.reason);
        break;
      case "BRIXEL_RESIZE":
        onResize?.(message.payload?.height);
        break;
      case "BRIXEL_LOG":
        onLog?.(message.payload?.level, message.payload?.message, message.payload?.data);
        break;
      case "BRIXEL_ERROR":
        onError?.(message.payload?.error);
        break;
    }
  };

  window.addEventListener("message", handleMessage);

  return {
    init(inputs: TInputs, runId = "mock-run-001", renderMode: RenderMode = "interaction") {
      currentRunId = runId;
      window.postMessage(
        {
          type: "BRIXEL_INIT",
          payload: {
            runId,
            inputs,
            context: mockContext,
            renderMode,
          },
        },
        "*"
      );
    },

    updateInputs(inputs: Partial<TInputs>) {
      if (!currentRunId) {
        console.warn("[MockHost] Cannot update inputs - no active run");
        return;
      }
      window.postMessage(
        {
          type: "BRIXEL_UPDATE_INPUTS",
          payload: { runId: currentRunId, inputs },
        },
        "*"
      );
    },

    destroy() {
      if (currentRunId) {
        window.postMessage(
          {
            type: "BRIXEL_DESTROY",
            payload: { runId: currentRunId },
          },
          "*"
        );
      }
      window.removeEventListener("message", handleMessage);
      currentRunId = null;
    },

    updateTheme(theme: BrixelContext["theme"]) {
      if (!currentRunId) {
        console.warn("[MockHost] Cannot update theme - no active run");
        return;
      }
      window.postMessage(
        {
          type: "BRIXEL_UPDATE_THEME",
          payload: { runId: currentRunId, theme },
        },
        "*"
      );
    },

    updateLocale(locale: string) {
      if (!currentRunId) {
        console.warn("[MockHost] Cannot update locale - no active run");
        return;
      }
      window.postMessage(
        {
          type: "BRIXEL_UPDATE_LOCALE",
          payload: { runId: currentRunId, locale },
        },
        "*"
      );
    },
  };
}
