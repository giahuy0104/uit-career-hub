type LogLevel = "info" | "warn" | "error";

type LogWriter = (level: LogLevel, line: string) => void;

const sensitiveKeyPattern = /authorization|cookie|password|secret|token|api[_-]?key|dsn|database[_-]?url|storage[_-]?key|presigned|signature|credential/i;
const maxDepth = 5;
const maxCollectionSize = 50;
const maxStringLength = 2_048;

export function redactString(value: string) {
  return value
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "$1[REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED_JWT]")
    .replace(/\b(postgres(?:ql)?|https?):\/\/([^@\s/]+)@/gi, "$1://[REDACTED]@")
    .replace(
      /([?&](?:x-amz-[^=]+|token|signature|credential|secret|api[_-]?key)=)[^&\s]+/gi,
      "$1[REDACTED]",
    )
    .replace(
      /((?:password|secret|token|api[_-]?key)\s*[=:]\s*)[^\s,;]+/gi,
      "$1[REDACTED]",
    )
    .slice(0, maxStringLength);
}

function sanitizeValue(
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
): unknown {
  if (value === null || value === undefined || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") return redactString(value);
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function" || typeof value === "symbol") return `[${typeof value}]`;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return serializeError(value);
  if (depth >= maxDepth) return "[MAX_DEPTH]";
  if (typeof value !== "object") return redactString(String(value));
  if (seen.has(value)) return "[CIRCULAR]";

  seen.add(value);
  if (Array.isArray(value)) {
    return value
      .slice(0, maxCollectionSize)
      .map((item) => sanitizeValue(item, depth + 1, seen));
  }

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value).slice(0, maxCollectionSize)) {
    output[key] = sensitiveKeyPattern.test(key)
      ? "[REDACTED]"
      : sanitizeValue(item, depth + 1, seen);
  }
  return output;
}

export function sanitizeLogFields(fields: Record<string, unknown>) {
  return sanitizeValue(fields, 0, new WeakSet()) as Record<string, unknown>;
}

export function serializeError(error: unknown) {
  if (!(error instanceof Error)) {
    return { name: "UnknownError", message: redactString(String(error)) };
  }

  return {
    name: error.name || "Error",
    message: redactString(error.message || "Unknown error"),
    ...(error.stack
      ? { stack: redactString(error.stack.split("\n").slice(0, 20).join("\n")) }
      : {}),
  };
}

function defaultWriter(level: LogLevel, line: string) {
  const stream = level === "info" ? process.stdout : process.stderr;
  stream.write(`${line}\n`);
}

export class StructuredLogger {
  constructor(private readonly writer: LogWriter = defaultWriter) {}

  info(event: string, fields: Record<string, unknown> = {}) {
    this.write("info", event, fields);
  }

  warn(event: string, fields: Record<string, unknown> = {}) {
    this.write("warn", event, fields);
  }

  error(event: string, fields: Record<string, unknown> = {}) {
    this.write("error", event, fields);
  }

  private write(level: LogLevel, event: string, fields: Record<string, unknown>) {
    this.writer(level, JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      event: redactString(event),
      ...sanitizeLogFields(fields),
    }));
  }
}

export const appLogger = new StructuredLogger();
