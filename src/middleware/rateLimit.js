// Protects the shared free-tier quota from a single client (or a bot) using
// it all up. Limits are per IP; the app sets `trust proxy` so the IP is the
// real client's and not the platform's load balancer.
import { rateLimit } from "express-rate-limit";
import { config } from "../config.js";

const limiter = (windowMs, limit, message) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res, next, options) => {
      res.status(options.statusCode).json({ error: message });
    },
  });

export const reviewRateLimits = [
  limiter(60_000, config.rateLimit.perMinute, "Too many reviews in a short time. Wait a minute and try again."),
  limiter(24 * 60 * 60_000, config.rateLimit.perDay, "Daily review limit reached for your network. Try again tomorrow."),
];
