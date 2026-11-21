import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config, providersConfigured } from "./config.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import aiRoutes from "./routes/ai.routes.js";

const app = express();
const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../frontend/dist");
const serveFrontend = existsSync(path.join(distDir, "index.html"));

app.disable("x-powered-by");
app.set("trust proxy", config.trustProxy);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        // Monaco injects inline styles and runs its language services in
        // same-origin module workers. Fonts are self-hosted (fontsource).
        "style-src": ["'self'", "'unsafe-inline'"],
        "font-src": ["'self'", "data:"],
        "img-src": ["'self'", "data:", "blob:"],
        "worker-src": ["'self'", "blob:"],
      },
    },
  }),
);

// Compression would buffer Server-Sent Events, so streams are excluded.
app.use(
  compression({
    filter: (req, res) =>
      !String(res.getHeader("Content-Type") ?? "").includes("text/event-stream") &&
      compression.filter(req, res),
  }),
);

app.use(
  "/api",
  cors({
    origin: (origin, done) => done(null, !origin || config.corsOrigins.includes(origin)),
    methods: ["GET", "POST"],
    maxAge: 86_400,
  }),
);

// Code up to MAX_CODE_CHARS plus notes; JSON escaping can roughly double it.
app.use(express.json({ limit: `${Math.ceil((config.maxCodeChars * 2.5) / 1024)}kb` }));

const health = (req, res) =>
  res.json({ status: "ok", uptime: Math.round(process.uptime()), providers: providersConfigured() });
app.get("/healthz", health);
app.get("/healthcheck", health);

app.use("/api", aiRoutes);
app.use("/api", notFound);

if (serveFrontend) {
  // Hashed build assets never change, so they can be cached for a year.
  app.use(
    "/assets",
    express.static(path.join(distDir, "assets"), { immutable: true, maxAge: "1y", index: false }),
  );
  app.use(express.static(distDir, { index: false, maxAge: "1h" }));
  // index.html must revalidate so a new deploy is picked up immediately.
  app.get(/.*/, (req, res) => {
    res.set("Cache-Control", "no-cache");
    res.sendFile(path.join(distDir, "index.html"));
  });
} else {
  app.get("/", (req, res) =>
    res.json({ status: "ok", message: "API running. Build the frontend to serve the UI from here." }),
  );
}

app.use(notFound);
app.use(errorHandler);

export default app;
