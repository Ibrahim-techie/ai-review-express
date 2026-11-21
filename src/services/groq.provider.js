// Groq: very low latency (sub-second to a few seconds), strict JSON schema
// support, but a small per-minute token budget on the free tier. Best for
// small and medium files and for giving the user a first answer fast.
import groq from "../Client/groq.js";
import { config } from "../config.js";
import { ProviderError } from "../utils/errors.js";
import { runModelChain } from "./modelChain.js";
import { estimateTokens } from "./review.prompt.js";
import { REVIEW_SCHEMA, normalizeReview } from "./review.schema.js";

// "high" effort was observed to break strict JSON output (json_validate_failed)
// on gpt-oss, and it eats the small token budget, so deep stays at medium.
const REASONING = {
  quick: { effort: "low", reserve: 700 },
  crosscheck: { effort: "medium", reserve: 1600 },
  deep: { effort: "medium", reserve: 1600 },
};

export const groqAvailable = () => Boolean(groq);

/**
 * Works out whether the request fits Groq's per-minute token budget and how
 * many completion tokens to request. Groq rejects (413) any request whose
 * input plus max_completion_tokens exceeds the limit, so asking for "as much
 * as possible" would fail outright.
 */
export function planGroq({ system, user, code, mode }) {
  const reasoning = REASONING[mode] ?? REASONING.crosscheck;
  const input = estimateTokens(system) + estimateTokens(user);
  // The corrected file is roughly the size of the input, plus the issue list.
  const needed = Math.ceil(estimateTokens(code) * 1.15) + 1400 + reasoning.reserve;
  const available = config.groq.tokensPerMinute - input - 250;
  return {
    fits: available >= needed,
    maxCompletionTokens: Math.min(available, 32_000),
    effort: reasoning.effort,
  };
}

export async function reviewWithGroq({ system, user, code, mode, maxIssues, signal, onEvent }) {
  if (!groq) throw new ProviderError("auth", "GROQ_API_KEY is not set");

  const plan = planGroq({ system, user, code, mode });
  if (!plan.fits) {
    throw new ProviderError(
      "too_large",
      `File is too large for Groq's free tier (${config.groq.tokensPerMinute.toLocaleString()} tokens/min)`,
    );
  }

  return runModelChain({
    provider: "groq",
    models: config.groq.models,
    timeoutMs: config.groq.timeoutMs,
    signal,
    onEvent,
    attempt: async (model, attemptSignal) => {
      const body = {
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.2,
        max_completion_tokens: plan.maxCompletionTokens,
        response_format: {
          type: "json_schema",
          json_schema: { name: "code_review", schema: REVIEW_SCHEMA, strict: true },
        },
      };
      if (model.startsWith("openai/gpt-oss")) {
        body.reasoning_effort = plan.effort;
        body.include_reasoning = false;
      }

      const completion = await groq.chat.completions.create(body, {
        signal: attemptSignal,
        timeout: config.groq.timeoutMs,
      });

      const choice = completion.choices?.[0];
      if (choice?.finish_reason === "length") {
        throw new ProviderError("too_large", "Review was cut off by the token limit");
      }
      return normalizeReview(choice?.message?.content, { code, maxIssues, provider: "groq" });
    },
  });
}
