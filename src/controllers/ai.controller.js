import {
  getGeminiChatCompletion,
  getGroqChatCompletion,
} from "../services/ai.service.js";
export const generateResponse = async (req, res) => {
  const { prompt } = req.body;

  try {
    let response;

    try {
      response = await getGroqChatCompletion(prompt);

      if (!response?.trim()) {
        throw new Error("Empty Groq response");
      }

      if (process.env.NODE_ENV === "development") {
        console.log("Using Groq");
      }
    } catch (groqError) {
      if (process.env.NODE_ENV === "development") {
        console.warn("Groq failed:", groqError.message);
      }

      try {
        response = await getGeminiChatCompletion(prompt);

        if (!response?.trim()) {
          throw new Error("Empty Gemini response");
        }

        if (process.env.NODE_ENV === "development") {
          console.log("Using Gemini");
        }
      } catch (geminiError) {
        if (process.env.NODE_ENV === "development") {
          console.error("Gemini failed:", geminiError.message);
        }
        throw new Error(
          `All providers failed. Groq: ${groqError.message}. Gemini: ${geminiError.message}`,
        );
      }
    }

    return res.json({
      data: response,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Error generating response:", error);
    }

    return res.status(500).json({
      error: error.message,
    });
  }
};
