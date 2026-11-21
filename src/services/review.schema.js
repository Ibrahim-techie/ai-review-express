// The structured review contract shared by both providers.
//
// Every property is required and additionalProperties is false so the schema
// is valid for Groq's strict structured outputs (constrained decoding) as well
// as Gemini's responseJsonSchema.

export const SEVERITIES = ["critical", "high", "medium", "low", "info"];

export const CATEGORIES = [
  "bug",
  "security",
  "performance",
  "error-handling",
  "maintainability",
  "readability",
  "best-practice",
  "testing",
];

export const REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["language", "summary", "score", "issues", "strengths", "improvedCode"],
  properties: {
    language: {
      type: "string",
      description: "Detected programming language, lowercase (e.g. javascript, python).",
    },
    summary: {
      type: "string",
      description: "Two or three sentences: what the code does and its overall state.",
    },
    score: {
      type: "integer",
      minimum: 0,
      maximum: 100,
      description: "Overall quality score.",
    },
    issues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "severity",
          "category",
          "title",
          "line",
          "endLine",
          "explanation",
          "suggestion",
        ],
        properties: {
          severity: { type: "string", enum: SEVERITIES },
          category: { type: "string", enum: CATEGORIES },
          title: { type: "string", description: "Under 80 characters." },
          line: {
            type: "integer",
            description: "First affected line from the numbered listing, 0 if file-wide.",
          },
          endLine: {
            type: "integer",
            description: "Last affected line, same as line for a single line, 0 if file-wide.",
          },
          explanation: {
            type: "string",
            description: "Markdown. What is wrong and the concrete consequence.",
          },
          suggestion: {
            type: "string",
            description: "Markdown. How to fix it, with a short fenced code snippet when code changes.",
          },
        },
      },
    },
    strengths: {
      type: "array",
      items: { type: "string" },
      description: "Up to three genuine strengths. Empty if none.",
    },
    improvedCode: {
      type: "string",
      description: "The complete corrected file without line numbers.",
    },
  },
};

const SEVERITY_RANK = Object.fromEntries(SEVERITIES.map((s, i) => [s, i]));
export const severityRank = (s) => SEVERITY_RANK[s] ?? SEVERITIES.length;

const clampInt = (value, min, max) => {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
};

const str = (v, max = 4000) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Parses model output that should be JSON, tolerating code fences. */
export function parseModelJson(text) {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Model returned an empty response");
  }
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error("Model returned malformed JSON");
  }
}

// Model-reported scores are not calibrated (the same code has scored 65 and
// 92 on consecutive runs), so the worst finding caps the score to keep it
// consistent with the rubric in the prompt.
const SCORE_CAP = { critical: 39, high: 69, medium: 89 };

export function capScore(score, issues) {
  const worst = issues.reduce(
    (w, i) => (severityRank(i.severity) < severityRank(w) ? i.severity : w),
    "info",
  );
  return Math.min(score, SCORE_CAP[worst] ?? 100);
}

const NUMBERED_LINE = /^\s*\d+\s?\|\s?/;

/** Models occasionally echo the line-number gutter we send them; strip it. */
function stripLineNumbers(code) {
  const lines = code.split("\n");
  const nonEmpty = lines.filter((l) => l.trim());
  if (nonEmpty.length && nonEmpty.every((l) => NUMBERED_LINE.test(l))) {
    return lines.map((l) => l.replace(NUMBERED_LINE, "")).join("\n");
  }
  return code;
}

/**
 * Turns raw model output into a review the UI can rely on: enums are valid,
 * line numbers are inside the file, lists are bounded.
 */
export function normalizeReview(raw, { code, maxIssues, provider }) {
  const data = typeof raw === "string" ? parseModelJson(raw) : raw;
  if (!data || typeof data !== "object") throw new Error("Model returned no review");
  const lineCount = code.split("\n").length;

  const issues = (Array.isArray(data.issues) ? data.issues : [])
    .filter((i) => i && typeof i === "object" && str(i.title))
    .map((i) => {
      const line = clampInt(i.line, 0, lineCount);
      const endLine = line === 0 ? 0 : clampInt(i.endLine || line, line, lineCount);
      return {
        severity: SEVERITIES.includes(i.severity) ? i.severity : "info",
        category: CATEGORIES.includes(i.category) ? i.category : "best-practice",
        title: str(i.title, 140),
        line,
        endLine,
        explanation: str(i.explanation, 4000),
        suggestion: str(i.suggestion, 6000),
        sources: [provider],
      };
    })
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || a.line - b.line)
    .slice(0, maxIssues);

  const improved = typeof data.improvedCode === "string" ? data.improvedCode : "";

  return {
    language: str(data.language, 40).toLowerCase(),
    summary: str(data.summary, 1500),
    score: capScore(clampInt(data.score, 0, 100), issues),
    issues,
    strengths: (Array.isArray(data.strengths) ? data.strengths : [])
      .map((s) => str(s, 300))
      .filter(Boolean)
      .slice(0, 4),
    // Match the original's trailing newline so the diff shows only real edits.
    improvedCode: improved
      ? stripLineNumbers(improved).trimEnd() + (code.endsWith("\n") ? "\n" : "")
      : "",
  };
}
