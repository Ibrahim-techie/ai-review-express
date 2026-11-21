// Cross-check: combines two independent reviews. An issue both models found
// is marked confirmed, which is the most useful signal two free models can
// give: agreement between different model families is rarely a false alarm.
import { SEVERITIES, capScore, severityRank } from "./review.schema.js";

const STOP = new Set(
  "a an the of to in on for and or is are be by with without when not no this that it its from as use using".split(" "),
);

const tokens = (text) =>
  new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, " ")
      .split(" ")
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );

const jaccard = (a, b) => {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / (a.size + b.size - shared);
};

const overlaps = (a, b, slack = 2) =>
  a.line > 0 && b.line > 0 && a.line <= b.endLine + slack && b.line <= a.endLine + slack;

/** 0 = unrelated, otherwise higher is a better match. */
function matchScore(a, b) {
  const sim = jaccard(tokens(`${a.title} ${a.category}`), tokens(`${b.title} ${b.category}`));
  const sameCategory = a.category === b.category;
  if (overlaps(a, b)) {
    if (sameCategory) return 1 + sim;
    if (sim >= 0.15) return 0.6 + sim;
    return 0;
  }
  if (a.line === 0 || b.line === 0) {
    return sim >= 0.4 && sameCategory ? sim : 0;
  }
  // Different lines: only a near-identical title counts (the same problem
  // reported at a slightly different spot).
  return sim >= 0.6 && sameCategory && Math.abs(a.line - b.line) <= 6 ? sim : 0;
}

const pickLonger = (a, b) => (b.length > a.length ? b : a);

export function mergeReviews(primary, secondary, [primaryName, secondaryName]) {
  const used = new Set();
  const merged = [];

  for (const a of primary.issues) {
    let best = -1;
    let bestScore = 0;
    secondary.issues.forEach((b, j) => {
      if (used.has(j)) return;
      const s = matchScore(a, b);
      if (s > bestScore) {
        bestScore = s;
        best = j;
      }
    });

    if (best === -1) {
      merged.push({ ...a, confirmed: false });
      continue;
    }
    used.add(best);
    const b = secondary.issues[best];
    merged.push({
      ...a,
      severity: SEVERITIES[Math.min(severityRank(a.severity), severityRank(b.severity))],
      explanation: pickLonger(a.explanation, b.explanation),
      suggestion: pickLonger(a.suggestion, b.suggestion),
      line: a.line || b.line,
      endLine: a.line ? a.endLine : b.endLine,
      sources: [...new Set([...a.sources, ...b.sources])],
      confirmed: true,
    });
  }

  secondary.issues.forEach((b, j) => {
    if (!used.has(j)) merged.push({ ...b, confirmed: false });
  });

  merged.sort(
    (x, y) =>
      severityRank(x.severity) - severityRank(y.severity) ||
      Number(y.confirmed) - Number(x.confirmed) ||
      x.line - y.line,
  );

  const strengths = [];
  for (const s of [...primary.strengths, ...secondary.strengths]) {
    const t = tokens(s);
    if (!strengths.some((x) => jaccard(tokens(x), t) > 0.5)) strengths.push(s);
  }

  return {
    language: primary.language || secondary.language,
    summary: primary.summary || secondary.summary,
    score: capScore(Math.round((primary.score + secondary.score) / 2), merged),
    scores: { [primaryName]: primary.score, [secondaryName]: secondary.score },
    issues: merged,
    strengths: strengths.slice(0, 4),
    improvedCode: primary.improvedCode || secondary.improvedCode,
  };
}
