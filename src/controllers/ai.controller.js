
import { decode } from "he";
import {
  getGeminiChatCompletion,
  getGroqChatCompletion,
} from "../services/ai.service.js";

export const generateResponse = async (req, res) => {
  const { prompt } = req.body;

  try {
    const decodedPrompt = decode(prompt);

    const response =
      (await getGroqChatCompletion(decodedPrompt)) ||
      (await getGeminiChatCompletion(decodedPrompt));

    const decodedResponse = decode(response);

    console.log("Decoded Response:", decodedResponse);
    res.json({ data: decodedResponse });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Error generating response:", error);
    }

    res.status(500).json({
      error: "Failed to generate response",
    });
  }
};
