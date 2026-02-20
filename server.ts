import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import yahooFinance from 'yahoo-finance2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("neuro_os.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    password_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS apps (
    id TEXT PRIMARY KEY,
    name TEXT,
    icon TEXT,
    config TEXT,
    user_id TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT,
    system_prompt TEXT,
    model TEXT,
    user_id TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    name TEXT,
    content TEXT,
    type TEXT,
    parent_id TEXT,
    user_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", system: "NeuroOS" });
  });

  // Stock API
  app.get("/api/stocks/:symbol", async (req, res) => {
    const symbol = req.params.symbol;
    try {
      console.log(`Fetching stock data for: ${symbol}`);
      const quote = await yahooFinance.quote(symbol);
      console.log(`Successfully fetched stock data for: ${symbol}`);
      res.json(quote);
    } catch (error) {
      console.error(`Stock API Quote Error for ${symbol}:`, error);
      try {
        console.log(`Attempting fallback search for: ${symbol}`);
        const searchResult = await yahooFinance.search(symbol) as any;
        if (searchResult.quotes && searchResult.quotes.length > 0) {
          const firstQuote = searchResult.quotes[0];
          res.json({
            symbol: firstQuote.symbol,
            regularMarketPrice: firstQuote.regularMarketPrice || 0,
            regularMarketChangePercent: firstQuote.regularMarketChangePercent || 0,
            shortName: firstQuote.shortName || symbol
          });
          return;
        }
      } catch (searchError) {
        console.error(`Stock API Search Fallback Error for ${symbol}:`, searchError);
      }
      res.status(500).json({ error: "Failed to fetch stock data", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // News API (Yahoo Finance News)
  app.get("/api/news", async (req, res) => {
    try {
      console.log("Fetching news data...");
      const result = await yahooFinance.search('finance') as any;
      console.log("Successfully fetched news data");
      res.json(result.news || []);
    } catch (error) {
      console.error('News API error:', error);
      res.json([]);
    }
  });

  // Simple Auth Mock
  app.post("/api/auth/login", (req, res) => {
    const { username } = req.body;
    res.json({ id: "user_1", username: username || "guest", token: "mock_token" });
  });

  // File System API
  app.get("/api/files", (req, res) => {
    const files = db.prepare("SELECT * FROM files").all();
    res.json(files);
  });

  app.post("/api/files", (req, res) => {
    const { name, content, type, parent_id } = req.body;
    const id = Math.random().toString(36).substr(2, 9);
    db.prepare("INSERT INTO files (id, name, content, type, parent_id) VALUES (?, ?, ?, ?, ?)")
      .run(id, name, content, type, parent_id || null);
    res.json({ id, name });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`NeuroOS Server running on http://localhost:${PORT}`);
  });
}

startServer();
