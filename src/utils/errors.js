// Normalizes errors from both SDKs into a small set of kinds so the fallback
// logic can decide whether to try the next model, skip the provider, or stop.

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export class ProviderError extends Error {
  constructor(kind, message, { status, retryAfterMs } = {}) {
    super(message);
    this.kind = kind;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * kinds:
 *  - "rate_limited"  quota hit on this model; another model may still work
 *  - "unavailable"   overloaded / 5xx / timeout; try the next model
 *  - "too_large"     request exceeds this provider's limits; skip provider
 *  - "auth"          bad or missing key; skip provider
 *  - "invalid"       model rejected the request or returned unusable output
 *  - "aborted"       client went away; stop everything
 */
export function classifyError(err, { aborted = false } = {}) {
  if (err instanceof ProviderError) return err;
  if (aborted) return new ProviderError("aborted", "Request cancelled");

  const status = Number(err?.status ?? err?.code ?? err?.error?.code) || undefined;
  const raw = extractMessage(err);
  const name = err?.name ?? "";

  const code = String(err?.error?.error?.code ?? err?.error?.code ?? "");
  if (/json_validate_failed|failed to validate json|malformed JSON|empty response/i.test(`${code} ${raw}`)) {
    return new ProviderError("invalid", "Model returned malformed output", { status });
  }

  if (name === "TimeoutError" || /timed? ?out/i.test(raw) || name.includes("Timeout")) {
    return new ProviderError("unavailable", "Model timed out", { status });
  }
  if (name === "AbortError" || name === "APIUserAbortError") {
    return new ProviderError("unavailable", "Model timed out", { status });
  }
  if (status === 401 || status === 403) {
    return new ProviderError("auth", "API key rejected by provider", { status });
  }
  if (status === 413 || /request too large|context length|too many tokens/i.test(raw)) {
    return new ProviderError("too_large", "Code is too large for this provider", { status });
  }
  if (status === 429 || /RESOURCE_EXHAUSTED|rate limit/i.test(raw)) {
    const retryAfter = Number(err?.headers?.get?.("retry-after"));
    return new ProviderError("rate_limited", "Free-tier rate limit reached", {
      status,
      retryAfterMs: Number.isFinite(retryAfter) ? retryAfter * 1000 : undefined,
    });
  }
  if (!status || status >= 500 || /UNAVAILABLE|high demand|ECONNRESET|fetch failed/i.test(raw)) {
    return new ProviderError("unavailable", "Model is overloaded or unreachable", { status });
  }
  return new ProviderError("invalid", shorten(raw), { status });
}

const shorten = (s) => (s.length > 200 ? `${s.slice(0, 200)}…` : s);

/**
 * Both SDKs wrap the provider's JSON error body in the message, e.g.
 * `400 {"error":{"message":"…","failed_generation":"…"}}`. Pull out the human
 * message so raw model output never reaches logs or clients.
 */
function extractMessage(err) {
  const nested = err?.error?.error?.message ?? err?.error?.message;
  if (typeof nested === "string") return nested;
  const message = String(err?.message ?? err ?? "Unknown error");
  const json = message.indexOf("{");
  if (json !== -1) {
    try {
      const body = JSON.parse(message.slice(json));
      const inner = body?.error?.message ?? body?.message;
      if (typeof inner === "string") {
        return [body?.error?.code, body?.error?.status, inner].filter(Boolean).join(" ");
      }
    } catch {
      // not JSON, fall through
    }
  }
  return message;
}
