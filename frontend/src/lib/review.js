// Presentation helpers for reviews. Colour carries meaning only, as text or
// a thin outline (ChaiUI): red for critical and high, yellow for medium,
// grey for the rest. Never filled pills.

export const SEVERITY = {
  critical: { label: "Critical", text: "text-red-700 dark:text-red-400", chip: "danger", mark: "sev-critical" },
  high: { label: "High", text: "text-red-700 dark:text-red-400", chip: "danger", mark: "sev-high" },
  medium: { label: "Medium", text: "text-yellow-700 dark:text-yellow-300", chip: "warning", mark: "sev-medium" },
  low: { label: "Low", text: "text-muted-foreground", chip: "default", mark: "sev-low" },
  info: { label: "Info", text: "text-muted-foreground", chip: "default", mark: "sev-info" },
};

export const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"];

export const CATEGORY_LABEL = {
  bug: "Bug",
  security: "Security",
  performance: "Performance",
  "error-handling": "Error handling",
  maintainability: "Maintainability",
  readability: "Readability",
  "best-practice": "Best practice",
  testing: "Testing",
};

export const PROVIDER_LABEL = { groq: "Groq", gemini: "Gemini" };

export const MODES = [
  {
    value: "quick",
    label: "Quick",
    description: "Groq only. Usually back in a few seconds.",
  },
  {
    value: "crosscheck",
    label: "Cross-check",
    description: "Groq and Gemini review separately. Findings both agree on are marked.",
  },
  {
    value: "deep",
    label: "Deep",
    description: "Gemini's strongest free model, thinking longer. Can take a few minutes when the free tier is busy.",
  },
];

export const FOCUS_AREAS = [
  { value: "bugs", label: "Bugs", hint: "Logic errors and edge cases" },
  { value: "security", label: "Security", hint: "Injection, secrets, unsafe input" },
  { value: "performance", label: "Performance", hint: "Complexity and wasted work" },
  { value: "readability", label: "Readability", hint: "Naming, structure, dead code" },
  { value: "best-practices", label: "Best practices", hint: "Idioms and error handling" },
  { value: "testing", label: "Testing", hint: "Testability and missing cases" },
];

export function scoreBand(score) {
  if (score >= 90) return { label: "Ready to ship", text: "text-green-700 dark:text-green-400" };
  if (score >= 70) return { label: "Solid, with fixable issues", text: "text-foreground" };
  if (score >= 40) return { label: "Significant problems", text: "text-yellow-700 dark:text-yellow-300" };
  return { label: "Unsafe or broken", text: "text-red-700 dark:text-red-400" };
}

export const lineLabel = (issue) =>
  issue.line === 0
    ? "Whole file"
    : issue.endLine > issue.line
      ? `Lines ${issue.line} to ${issue.endLine}`
      : `Line ${issue.line}`;

export const formatSeconds = (ms) => `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;

export function countBySeverity(issues) {
  const counts = Object.fromEntries(SEVERITY_ORDER.map((s) => [s, 0]));
  for (const i of issues) counts[i.severity] = (counts[i.severity] ?? 0) + 1;
  return counts;
}

/** The review as Markdown, for pasting into a pull request. */
export function reviewToMarkdown(review, { language }) {
  const lines = [`## Code review (score ${review.score}/100)`, "", review.summary, ""];
  if (review.issues.length) {
    lines.push("### Findings", "");
    for (const i of review.issues) {
      const where = i.line ? ` (${lineLabel(i).toLowerCase()})` : "";
      const both = i.confirmed ? " (found by both models)" : "";
      lines.push(`#### ${SEVERITY[i.severity].label}: ${i.title}${where}${both}`, "", i.explanation, "", i.suggestion, "");
    }
  }
  if (review.strengths.length) {
    lines.push("### What works well", "", ...review.strengths.map((s) => `- ${s}`), "");
  }
  if (review.improvedCode) {
    lines.push("### Improved code", "", "```" + (language || ""), review.improvedCode.trimEnd(), "```", "");
  }
  return lines.join("\n");
}
