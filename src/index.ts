/**
 * @brixel/ui-task-sdk
 *
 * SDK for building Brixel UI Tasks - interactive React components
 * that integrate seamlessly with Brixel workflows.
 *
 * @example
 * ```tsx
 * import { useBrixelTask } from "@brixel/ui-task-sdk";
 *
 * function MyUITask() {
 *   const { inputs, complete, context } = useBrixelTask<MyInputs, MyOutput>();
 *
 *   if (!inputs) return <div>Loading...</div>;
 *
 *   return (
 *     <div>
 *       <h1>{inputs.title}</h1>
 *       <button onClick={() => complete({ result: "done" })}>
 *         Submit
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */

// Main hook
export { useBrixelTask } from "./useBrixelTask";

// Execute Task API
export { executeTask, createExecuteTask } from "./executeTask";

// Types
export type {
  // Core types
  RenderMode,
  BrixelContext,
  UITaskManifest,
  TaskStatus,
  // Hook types
  UseBrixelTaskResult,
  UseBrixelTaskOptions,
  // Protocol messages - Host to Iframe
  HostToIframeMessage,
  InitMessage,
  UpdateInputsMessage,
  DestroyMessage,
  // Protocol messages - Iframe to Host
  IframeToHostMessage,
  ReadyMessage,
  ResizeMessage,
  CompleteMessage,
  CancelMessage,
  ErrorMessage,
  LogMessage,
  // Execute Task API types
  ExecuteTaskParams,
  ExecuteTaskResponse,
} from "./types";

// Development tools
export {
  simulateBrixelInit,
  listenToUITaskMessages,
  createMockBrixelHost,
  mockContext,
} from "./devTools";
