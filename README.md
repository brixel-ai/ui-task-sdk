# @brixel/ui-task-sdk

SDK for building Brixel UI Tasks - interactive React components that integrate with Brixel workflows.

## Installation

```bash
npm install @brixel/ui-task-sdk
# or
yarn add @brixel/ui-task-sdk
# or
pnpm add @brixel/ui-task-sdk
```

## Quick Start

```tsx
import { useBrixelTask } from "@brixel/ui-task-sdk";

// Define your input/output types
interface Inputs {
  title: string;
  options: string[];
}

interface Output {
  selectedOption: string;
}

function MyUITask() {
  const { inputs, complete, cancel, context, status } = useBrixelTask<Inputs, Output>();

  // Loading state while waiting for INIT from host
  if (!inputs) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>{inputs.title}</h1>
      {inputs.options.map((option) => (
        <button key={option} onClick={() => complete({ selectedOption: option })}>
          {option}
        </button>
      ))}
      <button onClick={() => cancel("User cancelled")}>Cancel</button>
    </div>
  );
}
```

## API Reference

### `useBrixelTask<TInputs, TOutput>(options?)`

Main hook for building UI Tasks.

#### Returns

| Property | Type | Description |
|----------|------|-------------|
| `inputs` | `TInputs \| null` | Input data from the host |
| `context` | `BrixelContext \| null` | Execution context (user, theme, locale, etc.) |
| `status` | `TaskStatus` | Current status: `"initializing"`, `"ready"`, `"completed"`, `"cancelled"`, `"error"` |
| `renderMode` | `RenderMode \| null` | `"display"` or `"interaction"` |
| `runId` | `string \| null` | Unique run identifier |
| `complete` | `(output: TOutput) => void` | Complete the task with output |
| `cancel` | `(reason?: string) => void` | Cancel the task |
| `setHeight` | `(height: number \| "auto") => void` | Request iframe resize |
| `log` | `(level, message, data?) => void` | Send log to host |
| `isEmbedded` | `boolean` | Whether running inside Brixel iframe |

#### Options

```ts
interface UseBrixelTaskOptions {
  targetOrigin?: string;      // PostMessage target origin (default: "*")
  onInputsUpdate?: (inputs) => void;  // Callback when inputs change
  onDestroy?: () => void;     // Callback before cleanup
  debug?: boolean;            // Enable debug logging
}
```

## Development Mode

Test your UI Task locally without Brixel:

```tsx
import { simulateBrixelInit } from "@brixel/ui-task-sdk";

// In your main.tsx or App.tsx
if (import.meta.env.DEV) {
  simulateBrixelInit({
    title: "Test Survey",
    options: ["Option A", "Option B", "Option C"],
  });
}
```

### Mock Host for Testing

```tsx
import { createMockBrixelHost } from "@brixel/ui-task-sdk";

const host = createMockBrixelHost({
  onComplete: (output) => console.log("Completed:", output),
  onCancel: (reason) => console.log("Cancelled:", reason),
  onResize: (height) => console.log("Resize:", height),
});

// Send init
host.init({ title: "Test" });

// Later: cleanup
host.destroy();
```

## Render Modes

### Display Mode

For UI Tasks that only show information without requiring user interaction:

```tsx
function DisplayTask() {
  const { inputs, context } = useBrixelTask<{ message: string }, void>();

  if (!inputs) return null;

  return <div className="notification">{inputs.message}</div>;
}
```

### Interaction Mode

For UI Tasks that require user input and block the workflow:

```tsx
function InteractionTask() {
  const { inputs, complete, cancel } = useBrixelTask<FormInputs, FormOutput>();

  const handleSubmit = (data: FormOutput) => {
    complete(data); // This unblocks the workflow
  };

  // ...
}
```

## Context Object

The `context` object provides information about the execution environment:

```ts
interface BrixelContext {
  runId: string;
  stepId?: string;
  user?: { id: string; name?: string; email?: string; avatarUrl?: string };
  organization?: { id: string; name?: string };
  theme: "light" | "dark" | "system";
  locale: string;
  capabilities: {
    resize: boolean;
    fullscreen: boolean;
    fileUpload: boolean;
  };
}
```

## Executing Other UI Tasks

The SDK allows UI Tasks to execute other UI Tasks programmatically using the `executeTask` function.

### Basic Usage

```tsx
import { useBrixelTask } from "@brixel/ui-task-sdk";

function MyUITask() {
  const { executeTask } = useBrixelTask();

  const handleExecuteTask = async () => {
    const result = await executeTask({
      taskUuid: "78c2482f-b47d-461c-9fd0-509476687be9",
      inputs: { name: "value" },
    });

    if (result.success) {
      console.log("Task executed:", result.data);
    } else {
      console.error("Error:", result.error);
    }
  };

  return <button onClick={handleExecuteTask}>Execute Task</button>;
}
```

### Authentication

The `executeTask` function supports two authentication methods (in priority order):

1. **API Token via postMessage** (RECOMMENDED): The parent interface passes the token via the INIT message
2. **Cookies fallback**: Uses `credentials: 'include'` if no token provided

#### Passing Token from Parent

```typescript
// In parent application (console.brixel.ai)
const authToken = getCookieValue('auth_token');

iframe.contentWindow.postMessage({
  type: 'BRIXEL_INIT',
  payload: {
    runId: 'run-123',
    inputs: { /* ... */ },
    context: {
      apiToken: authToken,
      // ... other context fields
    }
  }
}, 'https://cdn.brixel.ai');
```

The UI Task automatically receives this token and uses it for `executeTask` calls:

```tsx
const { executeTask, context } = useBrixelTask();

// Token from context is automatically used
await executeTask({
  taskUuid: "task-uuid",
  inputs: {}
});

```

### API URL Auto-Detection

The SDK automatically detects your environment and uses the appropriate API:

- **Development** (localhost): `http://localhost:8000/backoffice/ui-components`
- **Production**: `https://api.brixel.ai/backoffice/ui-components`

When running on localhost, you'll see:
```
[Brixel SDK] Using API URL: http://localhost:8000/backoffice/ui-components
```

See [DEVELOPMENT.md](./DEVELOPMENT.md) for details on local development setup.

## PostMessage Protocol

The SDK handles the following message types automatically:

### Host → Iframe

- `BRIXEL_INIT`: Initialize with inputs and context
- `BRIXEL_UPDATE_INPUTS`: Update inputs during execution
- `BRIXEL_DESTROY`: Cleanup signal

### Iframe → Host

- `BRIXEL_READY`: Iframe is ready to receive INIT
- `BRIXEL_COMPLETE`: Task completed with output
- `BRIXEL_CANCEL`: Task cancelled
- `BRIXEL_RESIZE`: Request height change
- `BRIXEL_ERROR`: Error occurred
- `BRIXEL_LOG`: Debug log message

## Building for Production

```bash
npm run build
```

This produces:
- `dist/index.js` - CommonJS build
- `dist/index.mjs` - ES Module build
- `dist/index.d.ts` - TypeScript declarations

### Packaging locally without `npm link`

To avoid duplicating React in consuming apps, test the SDK as an npm tarball (same shape as a publish):

```bash
# in the SDK repo
npm run pack:local

# in a consumer app (adjust version if needed)
npm install ../brixel-ui-task-sdk/dist-tarballs/brixel-ui-task-sdk-1.0.0.tgz
```

This keeps `node_modules` out of the package and prevents hook errors caused by multiple React copies. Prefer this over `npm link`.

## License

MIT
