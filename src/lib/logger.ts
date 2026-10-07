/**
 * Structured Logger & Error Handler Utility
 * Cung cấp định dạng log chuẩn mực cho hệ thống Next.js server & API routes
 */

export type LogLevel = "info" | "warn" | "error" | "debug";

interface LogPayload {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  data?: unknown;
  error?: {
    name?: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private format(
    level: LogLevel,
    context: string,
    message: string,
    data?: unknown,
    err?: unknown
  ): LogPayload {
    const payload: LogPayload = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
    };

    if (data !== undefined) {
      payload.data = data;
    }

    if (err) {
      if (err instanceof Error) {
        payload.error = {
          name: err.name,
          message: err.message,
          stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
        };
      } else {
        payload.error = {
          message: String(err),
        };
      }
    }

    return payload;
  }

  info(context: string, message: string, data?: unknown): void {
    const payload = this.format("info", context, message, data);
    console.log(JSON.stringify(payload));
  }

  warn(context: string, message: string, data?: unknown): void {
    const payload = this.format("warn", context, message, data);
    console.warn(JSON.stringify(payload));
  }

  error(context: string, message: string, error?: unknown, data?: unknown): void {
    const payload = this.format("error", context, message, data, error);
    console.error(JSON.stringify(payload));
  }

  debug(context: string, message: string, data?: unknown): void {
    if (process.env.NODE_ENV !== "production") {
      const payload = this.format("debug", context, message, data);
      console.debug(JSON.stringify(payload));
    }
  }
}

export const logger = new Logger();
