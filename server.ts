import express from "express";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // AI Generation Endpoint
  app.post("/api/generate", async (req, res) => {
    try {
      const { model, contents, config } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ error: "API key is missing on the server" });
      }
      
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: model || "gemini-3.1-flash-lite-preview",
        contents,
        config,
      });
      
      res.json({ text: response.text || "" });
    } catch (error: any) {
      console.error("AI Generation Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate content" });
    }
  });

  // AI Streaming Endpoint
  app.post("/api/generate-stream", async (req, res) => {
    try {
      const { model, contents, config } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ error: "API key is missing on the server" });
      }
      
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const ai = new GoogleGenAI({ apiKey });
      const responseStream = await ai.models.generateContentStream({
        model: model || "gemini-3.1-flash-lite-preview",
        contents,
        config,
      });

      for await (const chunk of responseStream) {
        if (chunk.text) {
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error: any) {
      console.error("AI Stream Error:", error);
      res.write(`data: ${JSON.stringify({ error: error.message || "Failed to generate stream" })}\n\n`);
      res.end();
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve static files from dist
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
