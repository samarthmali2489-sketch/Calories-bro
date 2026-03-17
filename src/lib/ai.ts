import { GoogleGenAI } from "@google/genai";

export async function generateAIContent(params: {
  model?: string;
  contents: any;
  config?: any;
}): Promise<{ text: string }> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
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
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return ai.models.generateContentStream({
    model: params.model || "gemini-3.1-flash-lite-preview",
    contents: params.contents,
    config: params.config,
  });
}

