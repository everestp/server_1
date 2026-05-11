import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import v1Router from "./routers/v1/index.routes";
import { serverConfig } from "./config";
import { appErrorHandler } from "./middlewares/error.middleware";


const app = express();

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------
app.use(helmet());

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        process.env.CLIENT_URL,
        "http://localhost:5173",
      ].filter(Boolean) as string[];

      // Allow requests without origin
      if (!origin) {
        return callback(null, true);
      }

      // Allow exact origins
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Allow *.breezonetwork.xyz
      const isBreezeNetwork =
        /^https?:\/\/([a-zA-Z0-9-]+\.)*breezonetwork\.xyz$/.test(origin);

      // Allow *.vercel.app
      const isVercel =
        /^https?:\/\/([a-zA-Z0-9-]+\.)*vercel\.app$/.test(origin);

      if (isBreezeNetwork || isVercel) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },

    credentials: true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);


// ---------------------------------------------------------------------------
// Global rate limiting
// ---------------------------------------------------------------------------
app.use(
  rateLimit({
    windowMs: serverConfig.rateLimit.windowMs,
    max: serverConfig.rateLimit.max,
    message: { success: false, error: "Too many requests, slow down." },
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// ---------------------------------------------------------------------------
// Request parsing
// ---------------------------------------------------------------------------
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));

// ---------------------------------------------------------------------------
// Health check
// Intentionally placed before the v1 router and auth middlewares so load
// balancers can reach it without a token.
// ---------------------------------------------------------------------------
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "API is healthy",
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------
app.use("/api/v1", v1Router);

// ---------------------------------------------------------------------------
// 404 — catch-all for unmatched routes
// ---------------------------------------------------------------------------
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: "Route not found" });
});

// ---------------------------------------------------------------------------
// Global error handler
// Must be last. Express detects error handlers by the 4-arg signature.
// ---------------------------------------------------------------------------
app.use(appErrorHandler);

export default app;
