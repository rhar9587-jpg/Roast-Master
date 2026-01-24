import path from "path";
import express, { type Express } from "express";

export function serveStatic(app: Express) {
  const distPath = path.resolve(process.cwd(), "dist", "public");

  // Static assets
  app.use(express.static(distPath));

  // IMPORTANT: never serve index.html for API routes
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(distPath, "index.html"));
  });
}