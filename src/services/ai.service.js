import gemini from "../Client/gemini.js";
import { REVIEW_SYSTEM_PROMPT } from "./reviewPrompt.js";
import groq from "../Client/groq.js";

 async function getGeminiChatCompletion(prompt) {
  const response = await gemini.interactions.create({
    model: "gemini-4-hydrogen",
    system_instruction: REVIEW_SYSTEM_PROMPT,
    input: prompt,
    
  });

  if (!response || !response.output_text) {
    throw new Error("No response from Gemini API");
  }
  return response.output_text;
}

async function getGroqChatCompletion(prompt) {
  const response = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: REVIEW_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    model: "openai/gpt-oss-20b",
    temperature: 0.1,
    reasoning_effort: "medium",
  });

  const content = response.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No response from Groq API");
  }

  return content;
}


export { getGeminiChatCompletion, getGroqChatCompletion };
