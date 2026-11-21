import Groq from "groq-sdk";
import { config } from "../config.js";

// Retries are handled by our own model fallback chain, so the SDK's built-in
// retries are disabled to avoid waiting on a model that is out of quota.
const groq = config.groq.apiKey
  ? new Groq({ apiKey: config.groq.apiKey, maxRetries: 0 })
  : null;

export default groq;
