import { config } from "../config.js";
import { FOCUS_AREAS } from "../services/review.prompt.js";

const MODES = new Set(["quick", "crosscheck", "deep"]);
const LANGUAGE = /^[\w#+.\- ]{1,40}$/;

export const validateReviewRequest = (req, res, next) => {
  const body = req.body ?? {};
  const errors = [];

  const code = typeof body.code === "string" ? body.code.replace(/\r\n?/g, "\n") : "";
  if (!code.trim()) errors.push("code is required and must be a non-empty string");
  if (code.length > config.maxCodeChars) {
    errors.push(`code must be at most ${config.maxCodeChars.toLocaleString()} characters`);
  }

  const mode = body.mode ?? "crosscheck";
  if (!MODES.has(mode)) errors.push("mode must be one of: quick, crosscheck, deep");

  const language = typeof body.language === "string" ? body.language.trim() : "";
  if (language && !LANGUAGE.test(language)) errors.push("language is not valid");

  const focus = body.focus ?? [];
  if (!Array.isArray(focus) || focus.some((f) => !(f in FOCUS_AREAS))) {
    errors.push(`focus must be an array of: ${Object.keys(FOCUS_AREAS).join(", ")}`);
  }

  const context = typeof body.context === "string" ? body.context.trim() : "";
  if (context.length > 2000) errors.push("context must be at most 2,000 characters");

  if (errors.length) {
    return res.status(400).json({ error: "Invalid request", details: errors });
  }

  req.review = {
    code,
    mode,
    language: language === "plaintext" ? "" : language,
    focus: [...new Set(focus)].sort(),
    context,
  };
  next();
};
