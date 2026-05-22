import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { fetchCandles, calculateIndicators, getSmartSignal } from "./server/analysis.js";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enable JSON request parsing
  app.use(express.json());

  // API endpoint for token/ticker analysis
  app.get("/api/analyze", async (req, res) => {
    try {
      const symbolQuery = (req.query.symbol as string) || "BTCUSDT";
      console.log(`[API] Received analysis request for symbol: ${symbolQuery}`);

      // 1. Fetch candles
      const { candles, actualSymbol } = await fetchCandles(symbolQuery);

      if (!candles || candles.length === 0) {
        return res.status(400).json({
          success: false,
          error: `Could not fetch chart candles or trace daily ticks for: "${symbolQuery}"`,
        });
      }

      // 2. Mathematically compute complete indicator profiles
      const indicators = calculateIndicators(candles);

      // 3. Trigger smart analysis via Gemini (with prompt search grounding)
      const signal = await getSmartSignal(actualSymbol, indicators);

      // 4. Return results containing original chart list, numeric structures, and AI logic
      return res.json({
        success: true,
        actualSymbol,
        candles,
        indicators,
        signal,
      });
    } catch (err: any) {
      console.error("[API Error] Failed to process analysis:", err);
      return res.status(500).json({
        success: false,
        error: err.message || "Internal system fault analyzing assets",
      });
    }
  });

  // Serve static files / integration with React Vite
  if (process.env.NODE_ENV !== "production") {
    console.log("[SERVER] Launching dev mode with active Vite routing middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("[SERVER] Running in production mode, serving pre-built static assets from /dist...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] Ready! Active and listening on http://localhost:${PORT}`);
  });
}

startServer();
