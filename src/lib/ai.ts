import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

export async function generateAIContent(params: {
  model?: string;
  contents: any;
  config?: any;
}): Promise<GenerateContentResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: params.model || "gemini-3.1-flash-lite-preview",
    contents: params.contents,
    config: params.config,
  });

  return response;
}

export async function generateAIContentStream(params: {
  model?: string;
  contents: any;
  config?: any;
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey });
  return ai.models.generateContentStream({
    model: params.model || "gemini-3.1-flash-lite-preview",
    contents: params.contents,
    config: params.config,
  });
}
