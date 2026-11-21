import "dotenv/config";
import app from "./app.js";
import { assertConfig, config } from "./config.js";
import { logger } from "./utils/logger.js";

assertConfig(logger);

const server = app.listen(config.port, () => {
  logger.info(`Server listening on port ${config.port}`, { env: config.env });
});

// Load balancers (Render, AWS ALB, etc.) keep idle connections open for about
// 60s; Node's default 5s keep-alive causes sporadic 502s behind them.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

let shuttingDown = false;
const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received, draining connections`);
  server.close(() => process.exit(0));
  server.closeIdleConnections?.();
  // Reviews can stream for a while; don't hang a deploy forever.
  setTimeout(() => process.exit(0), 10_000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  logger.error("unhandled rejection", { error: String(reason?.stack ?? reason) });
});
