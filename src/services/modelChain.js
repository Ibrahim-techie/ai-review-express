// Tries a provider's models in order until one returns a usable review.
// Free tiers fail often (per-model quotas, overloaded models), so a failure
// on one model is normal and the next one is tried right away.
import { ProviderError, classifyError } from "../utils/errors.js";

const STOP_PROVIDER = new Set(["auth", "too_large"]);

export async function runModelChain({
  provider,
  models,
  attempt,
  signal,
  timeoutMs,
  budgetMs = Infinity,
  onEvent,
}) {
  const started = Date.now();
  const failures = [];

  for (const [index, model] of models.entries()) {
    if (signal.aborted) throw new ProviderError("aborted", "Request cancelled");

    const remaining = budgetMs - (Date.now() - started);
    if (remaining < 8_000) break;

    onEvent?.({
      type: "status",
      provider,
      state: index === 0 ? "running" : "retrying",
      model,
      message: index === 0 ? undefined : failures.at(-1)?.message,
    });

    const limit = typeof timeoutMs === "function" ? timeoutMs(model, index) : timeoutMs;
    const attemptSignal = AbortSignal.any([
      signal,
      AbortSignal.timeout(Math.min(limit, remaining)),
    ]);
    const t0 = Date.now();

    try {
      const review = await attempt(model, attemptSignal);
      return {
        review,
        model,
        durationMs: Date.now() - t0,
        fallbacks: failures,
      };
    } catch (err) {
      const error = classifyError(err, { aborted: signal.aborted });
      if (error.kind === "aborted") throw error;
      failures.push({ model, kind: error.kind, message: `${model}: ${error.message}` });
      if (STOP_PROVIDER.has(error.kind)) break;
    }
  }

  const last = failures.at(-1);
  throw Object.assign(
    new ProviderError(
      last?.kind ?? "unavailable",
      last ? failures.map((f) => f.message).join("; ") : "Time budget exhausted",
    ),
    { failures },
  );
}
