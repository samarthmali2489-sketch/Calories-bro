import { GoogleGenAI } from "@google/genai";

function getApiKey() {
  // Vite replaces process.env.GEMINI_API_KEY at build time via the define config
  try {
    const key = process.env.GEMINI_API_KEY;
    if (key && key !== "undefined") return key;
  } catch (e) {
    // Ignore ReferenceError if process is not defined and Vite didn't replace it
  }

  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) {
    return import.meta.env.VITE_GEMINI_API_KEY;
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
  const apiKey = getApiKey();
  
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

