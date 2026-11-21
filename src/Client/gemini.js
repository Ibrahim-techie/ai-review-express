import { GoogleGenAI } from "@google/genai";
import { config } from "../config.js";

// Never fall back to a hardcoded key: secrets belong in the environment.
const gemini = config.gemini.apiKey
  ? new GoogleGenAI({ apiKey: config.gemini.apiKey })
  : null;

export default gemini;
