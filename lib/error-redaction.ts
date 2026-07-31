const MAX_CRASH_MESSAGE_CHARS = 512;
const MAX_CRASH_STACK_CHARS = 4096;

function redactSensitiveText(value: string): string {
  return value
    .replace(/\b(?:https?|file|content):\/\/[^\s)\]}]+/giu, "[redacted-url]")
    .replace(/\b[A-Z]:\\[^\r\n]+/giu, "[redacted-path]")
    .replace(/\\\\[^\s\\]+\\[^\r\n]+/gu, "[redacted-path]")
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Z]{2,}\b/giu, "[redacted-email]")
    .replace(/\bBearer\s+[A-Z0-9._~+/=-]+/giu, "Bearer [redacted-token]")
    .replace(/\bya29\.[A-Z0-9._~-]+/giu, "[redacted-token]")
    .replace(
      /\beyJ[A-Z0-9_-]{8,}\.[A-Z0-9_-]{8,}\.[A-Z0-9_-]{8,}\b/giu,
      "[redacted-token]"
    )
    .replace(
      /\b(access_token|id_token|refresh_token|upload_id|session_uri|api_key)=([^&\s]+)/giu,
      "$1=[redacted]"
    )
    .replace(/\b[A-Z0-9+/=_-]{48,}\b/giu, "[redacted-secret]")
    .replace(/"[^"\r\n]{2,256}"/gu, '"[redacted-text]"')
    .replace(/“[^”\r\n]{2,256}”/gu, "“[redacted-text]”");
}

function truncate(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}…[truncated]`;
}

export interface CrashPayload {
  message: string;
  stack: string;
}

export function sanitizeCrashPayload(error: unknown): CrashPayload {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const rawStack = error instanceof Error ? (error.stack ?? "") : "";
  return {
    message: truncate(redactSensitiveText(rawMessage), MAX_CRASH_MESSAGE_CHARS),
    stack: truncate(redactSensitiveText(rawStack), MAX_CRASH_STACK_CHARS),
  };
}
