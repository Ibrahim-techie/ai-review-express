import { config } from "../config.js";
import { logger } from "../utils/logger.js";

export const notFound = (req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl.split("?")[0]}` });
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return res.end();

  // body-parser errors carry a status and a stable type.
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body is too large." });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body must be valid JSON." });
  }

  const status = Number(err.status) >= 400 && Number(err.status) < 600 ? Number(err.status) : 500;
  if (status >= 500) logger.error("unhandled error", { error: err.message, stack: err.stack });

  res.status(status).json({
    error: status === 500 && config.isProd ? "Something went wrong on the server." : err.message,
    ...(err.details && { details: err.details }),
  });
};
