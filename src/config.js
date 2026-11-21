// Central, validated configuration. Everything that varies between local and
// deployed environments is read here once, so the rest of the code never
// touches process.env directly.

const int = (value, fallback) => {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const list = (value, fallback) =>
  (value ?? fallback)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const env = process.env.NODE_ENV || "development";

export const config = {
  env,
  isProd: env === "production",
  port: int(process.env.PORT, 3000),

  // Comma-separated list. Only needed when the frontend is hosted on a
  // different origin than the API (e.g. Vercel + Render). When the API serves
  // the built frontend itself, same-origin requests need no CORS at all.
  corsOrigins: list(process.env.CORS_ORIGIN, "http://localhost:5173"),

  // Number of reverse proxies in front of the app (Render, Railway, Fly and
  // Heroku all use one). Required for correct client IPs in rate limiting.
  trustProxy: int(process.env.TRUST_PROXY, 1),

  maxCodeChars: int(process.env.MAX_CODE_CHARS, 60_000),

  rateLimit: {
    perMinute: int(process.env.RATE_LIMIT_PER_MINUTE, 6),
    perDay: int(process.env.RATE_LIMIT_PER_DAY, 150),
  },

  cache: {
    maxEntries: int(process.env.CACHE_MAX_ENTRIES, 200),
    ttlMs: int(process.env.CACHE_TTL_MINUTES, 60) * 60_000,
  },

  groq: {
    apiKey: process.env.GROQ_API_KEY || "",
    // Each Groq model has its own free-tier quota (1K requests/day, 8K
    // tokens/min at the time of writing), so rotating through several models
    // multiplies the capacity available before falling back to Gemini.
    models: list(
      process.env.GROQ_MODELS,
      "openai/gpt-oss-120b,qwen/qwen3.8-27b,openai/gpt-oss-20b",
    ),
    tokensPerMinute: int(process.env.GROQ_TPM_LIMIT, 8000),
    timeoutMs: int(process.env.GROQ_TIMEOUT_MS, 45_000),
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY || "",
    // Free-tier models, best first. The free tier is often congested and
    // answers 503/429, so the chain moves on quickly instead of waiting.
    models: list(
      process.env.GEMINI_MODELS,
      "gemini-3.8-flash,gemini-3.6-flash,gemini-3.5-flash,gemini-3.5-flash-lite",
    ),
    deepModels: list(
      process.env.GEMINI_DEEP_MODELS,
      "gemini-4-hydrogen,gemini-3.8-flash,gemini-3.6-flash,gemini-3.5-flash-lite",
    ),
    timeoutMs: int(process.env.GEMINI_TIMEOUT_MS, 70_000),
    deepTimeoutMs: int(process.env.GEMINI_DEEP_TIMEOUT_MS, 150_000),
    // Upper bound for the whole Gemini fallback chain in one request.
    budgetMs: int(process.env.GEMINI_BUDGET_MS, 170_000),
  },
};

export const providersConfigured = () => ({
  groq: Boolean(config.groq.apiKey),
  gemini: Boolean(config.gemini.apiKey),
});

export function assertConfig(logger) {
  const configured = providersConfigured();
  if (!configured.groq && !configured.gemini) {
    const message =
      "No AI provider configured. Set GROQ_API_KEY and/or GEMINI_API_KEY.";
    if (config.isProd) throw new Error(message);
    logger.warn(message);
  }
  for (const [name, ok] of Object.entries(configured)) {
    if (!ok) logger.warn(`${name} is not configured; it will be skipped.`);
  }
}
