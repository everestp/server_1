import "dotenv/config";
import http from "http";
import app from "./app";
import { serverConfig } from "./config";

import { initSocket } from "./socket";
import { connectDB } from "./db/db";
import logger from "./config/logger.config";

// Telegram
import { TelegramBot } from "./chatbot/telegram/telegram.bot";
import { TelegramService } from "./chatbot/telegram/telegram.service";
import { LLMService } from "./service/llm.service";
import { NodeLatestRepository } from "./repositories/nodeLatest.repository";
import { TelegramPaymentRepository } from "./repositories/telegram/telegramPayment.repository";
import { TelegramUserRepository } from "./repositories/telegram/telegramUser.repository";

// Poller
import { PaymentPollerService } from "./service/payment.poller.service";

const startServer = async (): Promise<void> => {
  try {
    // ── DB ─────────────────────────────────────────────
    await connectDB();
    logger.info("Database connected");

    // ── Background services ───────────────────────────


    // ── Repositories ───────────────────────────────────
    const userRepo = new TelegramUserRepository();
    const paymentRepo = new TelegramPaymentRepository();
    const nodeRepo = new NodeLatestRepository();
    const llmService = new LLMService();

    // ── Telegram service ───────────────────────────────
    const telegramService = new TelegramService(
      llmService,
      userRepo,
      nodeRepo,
      paymentRepo
    );

    // ── Bot ────────────────────────────────────────────
    const bot = new TelegramBot(telegramService);

    // 🚀 Start bot WITHOUT blocking
    bot.startPolling().catch((err) => {
      logger.error("Telegram bot failed:", err);
    });

    logger.info("Telegram bot started");

    // ── Poller ─────────────────────────────────────────
    const paymentPoller = new PaymentPollerService(
      userRepo,
      paymentRepo,
      bot
    );

    paymentPoller.start();
    logger.info("Payment poller started");

    // ── HTTP server ────────────────────────────────────
    const httpServer: http.Server = initSocket(app);

    httpServer.listen(serverConfig.PORT, () => {
      logger.info(`Server running on port ${serverConfig.PORT}`);
    });

    // ── Graceful shutdown ───────────────────────────────
    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`${signal} received`);

      httpServer.close(() => {
        logger.info("HTTP server closed");
        process.exit(0);
      });
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (err) {
    logger.error("Fatal startup error:", err);
    process.exit(1);
  }
};

startServer();
