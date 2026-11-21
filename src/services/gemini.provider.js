// Gemini: 1M-token context, so it handles files far beyond Groq's budget, and
// the strongest free reasoning model (gemini-4-hydrogen) for deep reviews.
// The free tier is frequently congested, hence short per-model timeouts and a
// fallback chain across several free models.
import gemini from "../Client/gemini.js";
import { config } from "../config.js";
import { ProviderError } from "../utils/errors.js";
import { runModelChain } from "./modelChain.js";
import { REVIEW_SCHEMA, normalizeReview } from "./review.schema.js";

const THINKING = { quick: "LOW", crosscheck: "MEDIUM", deep: "HIGH" };

export const geminiAvailable = () => Boolean(gemini);

export async function reviewWithGemini({ system, user, code, mode, maxIssues, signal, onEvent }) {
  if (!gemini) throw new ProviderError("auth", "GEMINI_API_KEY is not set");

  const deep = mode === "deep";

  const generate = (model, attemptSignal, thinkingLevel) =>
    gemini.models.generateContent({
      model,
      contents: user,
      config: {
        systemInstruction: system,
        temperature: 0.2,
        maxOutputTokens: deep ? 32_768 : 16_384,
        responseMimeType: "application/json",
        responseJsonSchema: REVIEW_SCHEMA,
        ...(thinkingLevel && { thinkingConfig: { thinkingLevel } }),
        abortSignal: attemptSignal,
      },
    });

  return runModelChain({
    provider: "gemini",
    models: deep ? config.gemini.deepModels : config.gemini.models,
    // Only the dedicated deep model gets the long timeout; the fallbacks are
    // regular models and must not eat the whole budget.
    timeoutMs: (model, index) =>
      deep && index === 0 ? config.gemini.deepTimeoutMs : config.gemini.timeoutMs,
    budgetMs: config.gemini.budgetMs,
    signal,
    onEvent,
    attempt: async (model, attemptSignal) => {
      let response;
      try {
        response = await generate(model, attemptSignal, THINKING[mode] ?? "MEDIUM");
      } catch (err) {
        // Not every model accepts every thinking level; retry once with the
        // model's default rather than abandoning a model that is up.
        if (err?.status === 400 && /thinking/i.test(String(err?.message))) {
          response = await generate(model, attemptSignal, undefined);
        } else {
          throw err;
        }
      }

      const finish = response.candidates?.[0]?.finishReason;
      if (finish === "MAX_TOKENS") {
        throw new ProviderError("invalid", "Review was cut off by the token limit");
      }
      if (finish && !["STOP", "FINISH_REASON_UNSPECIFIED"].includes(finish)) {
        throw new ProviderError("invalid", `Model stopped early (${finish.toLowerCase()})`);
      }
      return normalizeReview(response.text, { code, maxIssues, provider: "gemini" });
    },
  });
}
