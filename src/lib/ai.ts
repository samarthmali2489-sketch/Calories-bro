import { GoogleGenAI } from "@google/genai";

// ⚠️ PASTE YOUR GEMINI API KEY HERE
// Example: const HARDCODED_API_KEY = "AIzaSy...";
const HARDCODED_API_KEY = "AIzaSyBKpCerpHcC66_NA_3gMeS4T_0V5zLLd5U";

function getApiKey() {
  if (HARDCODED_API_KEY) return HARDCODED_API_KEY;
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) {
    return import.meta.env.VITE_GEMINI_API_KEY;
  }
  if (typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }
  return "";
}

export async function generateAIContent(params: {
  model?: string;
  contents: any;
  config?: any;
}): Promise<{ text: string }> {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    throw new Error("Gemini API key is missing. Please paste your key in src/lib/ai.ts");
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash", // Force a widely available model
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
  const apiKey = getApiKey();
  
  if (!apiKey) {
    throw new Error("Gemini API key is missing. Please paste your key in src/lib/ai.ts");
  }

  const ai = new GoogleGenAI({ apiKey });
  return ai.models.generateContentStream({
    model: "gemini-2.5-flash", // Force a widely available model
    contents: params.contents,
    config: params.config,
  });
}

