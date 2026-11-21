// Minimal structured logger: JSON lines in production (what log drains on
// Render/Railway/Fly expect), readable lines in development. No dependency.
import { config } from "../config.js";

const write = (level, message, meta) => {
  if (config.isProd) {
    const line = JSON.stringify({
      level,
      time: new Date().toISOString(),
      message,
      ...meta,
    });
    (level === "error" ? console.error : console.log)(line);
    return;
  }
  const extra = meta && Object.keys(meta).length ? meta : "";
  const fn =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : console.log;
  fn(`[${level}] ${message}`, extra);
};

export const logger = {
  info: (message, meta) => write("info", message, meta),
  warn: (message, meta) => write("warn", message, meta),
  error: (message, meta) => write("error", message, meta),
};
