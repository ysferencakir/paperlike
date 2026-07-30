export const SEARCH_RESULT_LIMIT = 50;
export const SEARCH_YIELD_INTERVAL = 4;

export function createSearchAbortError(): DOMException {
  return new DOMException("Search was cancelled", "AbortError");
}

export function throwIfSearchAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw createSearchAbortError();
}

export function isSearchAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/** Lets input, animation and cancellation events run between search batches. */
export function yieldSearchControl(signal?: AbortSignal): Promise<void> {
  throwIfSearchAborted(signal);

  return new Promise((resolve, reject) => {
    const finish = () => {
      signal?.removeEventListener("abort", abort);
      resolve();
    };
    const abort = () => {
      clearTimeout(timer);
      reject(createSearchAbortError());
    };
    const timer = setTimeout(finish, 0);
    signal?.addEventListener("abort", abort, { once: true });
  });
}
