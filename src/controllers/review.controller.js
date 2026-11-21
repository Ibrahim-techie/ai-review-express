import { config, providersConfigured } from "../config.js";
import { runReview } from "../services/review.service.js";
import { FOCUS_AREAS } from "../services/review.prompt.js";
import { logger } from "../utils/logger.js";
import { openSse } from "../utils/sse.js";

export const getMeta = (req, res) => {
  const configured = providersConfigured();
  res.json({
    providers: {
      groq: { configured: configured.groq, models: config.groq.models },
      gemini: {
        configured: configured.gemini,
        models: config.gemini.models,
        deepModels: config.gemini.deepModels,
      },
    },
    maxCodeChars: config.maxCodeChars,
    focusAreas: Object.keys(FOCUS_AREAS),
  });
};

/**
 * POST /api/review
 * Streams progress as Server-Sent Events when the client sends
 * `Accept: text/event-stream`, otherwise responds once with JSON
 * (handy for curl, scripts and CI).
 */
export const createReview = async (req, res) => {
  const input = req.review;
  const controller = new AbortController();
  // `req` emits "close" as soon as the body is read; the response's "close"
  // is the one that means the client actually went away.
  res.on("close", () => {
    if (!res.writableFinished) controller.abort();
  });

  const logResult = (result) =>
    logger.info("review completed", {
      mode: input.mode,
      lines: input.code.split("\n").length,
      cached: result.cached,
      durationMs: result.durationMs,
      providers: result.providers.map((p) => `${p.provider}:${p.state}${p.model ? `:${p.model}` : ""}`),
    });

  if (!req.get("accept")?.includes("text/event-stream")) {
    const result = await runReview(input, { signal: controller.signal });
    logResult(result);
    return res.json(result);
  }

  const sse = openSse(res);
  try {
    const result = await runReview(input, {
      signal: controller.signal,
      onEvent: (event) => sse.send(event.type, event),
    });
    logResult(result);
    sse.send("final", result);
  } catch (err) {
    if (controller.signal.aborted) return;
    const status = err.status ?? 500;
    if (status >= 500 && !err.details) logger.error("review failed", { error: err.message });
    sse.send("error", {
      status,
      message: status === 500 && config.isProd ? "Something went wrong on the server." : err.message,
      ...(err.details && { details: err.details }),
    });
  } finally {
    sse.close();
  }
};
