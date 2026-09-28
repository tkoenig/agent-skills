import type { AssistantMessageEvent, AssistantMessage } from "@earendil-works/pi-ai";

// One request owns its working message only until content, cancellation or termination.
// Preserve the delegated stream's events and result for Pi's lazyStream forwarder.
export function requestWorkingStatus(
  write: (message?: string) => void,
  signal: AbortSignal | undefined,
  isCurrent: () => boolean,
) {
  let closed = false;
  const report = (message?: string) => {
    if (!closed && !signal?.aborted && isCurrent()) write(message);
  };
  const finish = () => {
    if (closed) return;
    const shouldClear = !signal?.aborted && isCurrent();
    closed = true;
    signal?.removeEventListener("abort", onAbort);
    if (shouldClear) write();
  };
  const onAbort = () => {
    // Clear the current request, but never repaint it after cancellation.
    if (!closed && isCurrent()) write();
    closed = true;
    signal?.removeEventListener("abort", onAbort);
  };
  signal?.addEventListener("abort", onAbort, { once: true });
  if (signal?.aborted) onAbort();
  function follow(source: AsyncIterable<AssistantMessageEvent> & { result(): Promise<AssistantMessage> }) {
    return {
      async *[Symbol.asyncIterator]() {
        try {
          for await (const event of source) {
            if (event.type === "text_delta" || event.type === "thinking_delta" || event.type === "toolcall_start" || event.type === "toolcall_delta") finish();
            yield event;
          }
        } finally { finish(); }
      },
      result: () => source.result(),
    };
  }
  return { report, finish, follow };
}
