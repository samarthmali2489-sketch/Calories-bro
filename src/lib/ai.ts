import { GoogleGenAI } from "@google/genai";

// ⚠️ PASTE YOUR GEMINI API KEY HERE
// Example: const HARDCODED_API_KEY = "AIzaSy...";
const HARDCODED_API_KEY = "AIzaSyBKpCerpHcC66_NA_3gMeS4T_0V5zLLd5U";

export async function generateAIContent(params: {
  model?: string;
  contents: any;
  config?: any;
}): Promise<{ text: string }> {
  // It will try to use the environment variable first, then fall back to your hardcoded key
  const apiKey = process.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || HARDCODED_API_KEY;
  
  if (!apiKey) {
    throw new Error("Gemini API key is missing. Please paste your key in src/lib/ai.ts");
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: params.model || "gemini-3.1-flash-lite-preview",
    contents: params.contents,
    config: params.config,
  });
  
  return { text: response.text || "" };
}

export async function generateAIContentStream(params: {
  model?: string;
  contents: any;
  config?: any;
}) {
  const apiKey = process.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || HARDCODED_API_KEY;
  
  if (!apiKey) {
    throw new Error("Gemini API key is missing. Please paste your key in src/lib/ai.ts");
  }

  const ai = new GoogleGenAI({ apiKey });
  return ai.models.generateContentStream({
    model: params.model || "gemini-3.1-flash-lite-preview",
    contents: params.contents,
    config: params.config,
  });
}
