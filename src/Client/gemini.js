import { GoogleGenAI } from "@google/genai";



const gemini=new GoogleGenAI({
    
    apiKey: process.env.GEMINI_API_KEY||"AQ.Ab8RN6JGwE9mn1qC-x1KmTqYs16wf-0Cuogm6tzsB8ICcSxngQ"
});


export default gemini;
