// Orchestrates a review across providers.
//
// Modes:
//   quick       Groq first (answers in seconds); Gemini only if Groq can't.
//   crosscheck  Groq and Gemini in parallel; findings are merged and issues
//               both models found are marked confirmed. Groq's result is
//               streamed first so the user isn't stuck waiting on Gemini.
//   deep        Gemini's strongest free model with high thinking; Groq is the
//               fallback.
import { config } from "../config.js";
import { LruCache, hashKey } from "../utils/cache.js";
import { HttpError } from "../utils/errors.js";
import { geminiAvailable, reviewWithGemini } from "./gemini.provider.js";
import { groqAvailable, planGroq, reviewWithGroq } from "./groq.provider.js";
import { mergeReviews } from "./review.merge.js";
import { DEPTHS, buildSystemPrompt, buildUserPrompt } from "./review.prompt.js";

const cache = new LruCache(config.cache);
const PROVIDERS = { groq: reviewWithGroq, gemini: reviewWithGemini };

const FRIENDLY = {
  rate_limited: "Free-tier quota is used up on every model for now. Try again in a minute.",
  unavailable: "Overloaded right now (free-tier demand spike).",
  auth: "The API key was rejected. Check the server configuration.",
};

const friendly = (err) => FRIENDLY[err.kind] ?? err.message;

function planProviders(mode, prompts) {
  const skipped = [];
  const hasGemini = geminiAvailable();
  let groqFits = false;

  if (!groqAvailable()) {
    skipped.push({ provider: "groq", message: "Not configured" });
  } else if (!(groqFits = planGroq({ ...prompts, mode }).fits)) {
    skipped.push({
      provider: "groq",
      message: "File is larger than Groq's free-tier token budget",
    });
  }
  if (!hasGemini) skipped.push({ provider: "gemini", message: "Not configured" });

  const groq = groqFits ? "groq" : null;
  const gemini = hasGemini ? "gemini" : null;

  if (mode === "crosscheck") {
    return { strategy: "parallel", run: [groq, gemini].filter(Boolean), skipped };
  }
  if (mode === "quick") {
    return { strategy: "fallback", run: [groq, gemini].filter(Boolean), skipped };
  }
  return { strategy: "fallback", run: [gemini, groq].filter(Boolean), skipped };
}

export function cacheStats() {
  return { entries: cache.size };
}

export async function runReview(input, { signal, onEvent = () => {} }) {
  const started = Date.now();
  const { code, language, mode, focus, context } = input;

  const cacheKey = hashKey([code, language, mode, focus, context]);
  const hit = cache.get(cacheKey);
  if (hit) {
    onEvent({ type: "start", mode, plan: [], strategy: "cache", cached: true });
    return { ...hit, cached: true, durationMs: Date.now() - started };
  }

  const system = buildSystemPrompt(mode);
  const user = buildUserPrompt({ code, language, focus, context });
  const lineCount = code.split("\n").length;
  const { maxIssues } = DEPTHS[mode];

  const plan = planProviders(mode, { system, user, code });
  if (!plan.run.length) {
    const tooLarge = plan.skipped.some((s) => s.message.includes("larger"));
    throw new HttpError(
      tooLarge ? 413 : 503,
      tooLarge
        ? "This file is too large for the configured providers. Add a GEMINI_API_KEY for large files."
        : "No AI provider is configured on the server.",
    );
  }

  onEvent({
    type: "start",
    mode,
    strategy: plan.strategy,
    plan: plan.run.map((provider, i) => ({
      provider,
      role: plan.strategy === "parallel" || i === 0 ? "primary" : "fallback",
    })),
    lineCount,
  });
  for (const s of plan.skipped) {
    onEvent({ type: "status", provider: s.provider, state: "skipped", message: s.message });
  }

  const results = {};
  const meta = new Map(plan.skipped.map((s) => [s.provider, { ...s, state: "skipped" }]));

  const runOne = async (provider) => {
    try {
      const r = await PROVIDERS[provider]({
        system,
        user,
        code,
        mode,
        maxIssues,
        signal,
        onEvent,
      });
      results[provider] = r.review;
      meta.set(provider, {
        provider,
        state: "done",
        model: r.model,
        durationMs: r.durationMs,
        issueCount: r.review.issues.length,
        score: r.review.score,
        fallbacks: r.fallbacks.map((f) => f.message),
      });
      onEvent({ type: "result", provider, model: r.model, durationMs: r.durationMs, review: r.review });
      return true;
    } catch (err) {
      if (err.kind === "aborted") throw err;
      const message = friendly(err);
      meta.set(provider, { provider, state: "failed", message, details: err.message });
      onEvent({ type: "status", provider, state: "failed", message, details: err.message });
      return false;
    }
  };

  if (plan.strategy === "parallel") {
    await Promise.all(plan.run.map(runOne));
  } else {
    for (const provider of plan.run) {
      if (await runOne(provider)) break;
    }
  }

  const done = Object.keys(results);
  if (!done.length) {
    throw new HttpError(503, "Every AI provider failed for this request. Please try again shortly.", {
      providers: [...meta.values()],
    });
  }

  const review =
    done.length === 2
      ? mergeReviews(results.gemini, results.groq, ["gemini", "groq"])
      : {
          ...results[done[0]],
          scores: { [done[0]]: results[done[0]].score },
          issues: results[done[0]].issues.map((i) => ({ ...i, confirmed: false })),
        };
  review.issues = review.issues.map((issue, i) => ({ id: `issue-${i + 1}`, ...issue }));

  const payload = {
    review,
    mode,
    providers: [...meta.values()],
    cached: false,
    durationMs: Date.now() - started,
  };

  // Don't pin a degraded result (one provider failed) in the cache: a retry a
  // minute later may get the full cross-check.
  const degraded = [...meta.values()].some((m) => m.state === "failed");
  if (!degraded) cache.set(cacheKey, payload);

  return payload;
}
