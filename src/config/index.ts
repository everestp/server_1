import dotenv from "dotenv";

dotenv.config();
console.log("Environment variables loaded");

// ─── Types ───────────────────────────────────────────────────────────────────

type RateLimitConfig = {
  windowMs: number;
  max: number;
};

export type ServerConfig = {
  PORT: number;

  rateLimit: RateLimitConfig;

  MONGO_URI: string;
  JWT_SECRET: string;

  BACKEND_AUTHORITY_PRIVATE_KEY: string;
  PROGRAM_ID: string;

  SOLANA_TREASURY_WALLET: string;
  BREEZO_TOKEN_MINT: string;

  TELEGRAM_BOT_TOKEN: string;
  WEBHOOK_BASE_URL?: string;

  REWARD_INCREMENT: number;

  AI_PROVIDER: string;
  AI_API_KEY: string;
  AI_MODEL: string;
  AI_BASE_URL: string;
  HELIUS_API_KEY:string
};

// ─── Config ─────────────────────────────────────────────────────────────────

export const serverConfig: ServerConfig = {
  PORT: Number(process.env.PORT) || 5002,

  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX) || 100,
  },

  MONGO_URI: process.env.MONGO_URI || "",
  JWT_SECRET: process.env.JWT_SECRET || "",

  BACKEND_AUTHORITY_PRIVATE_KEY:
    process.env.BACKEND_AUTHORITY_PRIVATE_KEY || "",
HELIUS_API_KEY:process.env.HELIUS_API_KEY || "",
  PROGRAM_ID:
    process.env.PROGRAM_ID ||
    "5ygRCA7pF2h7GeGxP9RaiNQNTNb5J5GnB9XSzxh75gVw",

  SOLANA_TREASURY_WALLET: process.env.SOLANA_TREASURY_WALLET || "",
  BREEZO_TOKEN_MINT: process.env.BREEZO_TOKEN_MINT || "",

  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "",
  WEBHOOK_BASE_URL: process.env.WEBHOOK_BASE_URL,

  // FIX: removed comma issue support
  REWARD_INCREMENT: Number(process.env.REWARD_INCREMENT) || 8,

  AI_PROVIDER: process.env.AI_PROVIDER || "groq",
  AI_API_KEY: process.env.AI_API_KEY || "",
  AI_MODEL: process.env.AI_MODEL || "llama3-8b-8192",
  AI_BASE_URL:
    process.env.AI_BASE_URL ||
    "https://api.groq.com/openai/v1/chat/completions",
};
