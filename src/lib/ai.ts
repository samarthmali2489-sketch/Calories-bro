import { GoogleGenAI } from "@google/genai";

// If you are exporting this project to run locally, you can paste your actual API key below.
// In AI Studio, your key is automatically injected securely via process.env.GEMINI_API_KEY.
const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyBTdntZ9jb_T5Zzp1ie9YkL3rm6VrWznpg";

export async function generateAIContent(params: {
  model?: string;
  contents: any;
  config?: any;
}): Promise<{ text: string }> {
  if (!API_KEY || API_KEY === "AIzaSyBTdntZ9jb_T5Zzp1ie9YkL3rm6VrWznpg") {
    throw new Error("API key is missing. Please check your AI Studio settings or hardcode your key in src/lib/ai.ts if running locally.");
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });
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
  if (!API_KEY || API_KEY === "AIzaSyBTdntZ9jb_T5Zzp1ie9YkL3rm6VrWznpg") {
    throw new Error("API key is missing. Please check your AI Studio settings or hardcode your key in src/lib/ai.ts if running locally.");
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  return ai.models.generateContentStream({
    model: params.model || "gemini-3.1-flash-lite-preview",
    contents: params.contents,
    config: params.config,
  });
}

