import "dotenv/config";
import http from "http";

import app from "./app";
import { serverConfig } from "./config";
import { connectDB } from "./db/db";
import logger from "./config/logger.config";
import { initSocket } from "./socket";

// ── Shared services ───────────────────────────────────────────────────────────
import { LLMService } from "./service/llm.service";
import { NodeLatestRepository } from "./repositories/nodeLatest.repository";

// ── Telegram ──────────────────────────────────────────────────────────────────
import { TelegramBot } from "./chatbot/telegram/telegram.bot";
import { TelegramService } from "./chatbot/telegram/telegram.service";
import { TelegramUserRepository } from "./repositories/telegram/telegramUser.repository";
import { TelegramPaymentRepository } from "./repositories/telegram/telegramPayment.repository";

// ── WhatsApp ──────────────────────────────────────────────────────────────────
import { WhatsAppBot } from "./chatbot/whatsapp/whatsapp.bot";
import { WhatsAppService } from "./chatbot/whatsapp/whatsapp.service";
import { WhatsAppUserRepository } from "./repositories/whatsapp/whatsappUser.repository";
import { WhatsAppPaymentRepository } from "./repositories/whatsapp/whatsappPayment.repository";
import { setWhatsAppBotInstance } from "./chatbot/whatsapp/bot.instance";

// ── Pollers ───────────────────────────────────────────────────────────────────
import { TelegramPaymentPoller, WhatsAppPaymentPoller } from "./service/payment.poller.service";

// ─────────────────────────────────────────────────────────────────────────────

const startServer = async (): Promise<void> => {
  try {
    // 1. Database
    await connectDB();
    logger.info("Database connected");

    // 2. Shared singletons
    const llmService    = new LLMService();
    const nodeRepo      = new NodeLatestRepository();

    // ── Telegram stack ────────────────────────────────────────────────────────
    const tgUserRepo    = new TelegramUserRepository();
    const tgPaymentRepo = new TelegramPaymentRepository();

    const telegramService = new TelegramService(llmService, tgUserRepo, nodeRepo, tgPaymentRepo);
    const telegramBot     = new TelegramBot(telegramService);

    // Non-blocking — bot runs in background; crash is logged, server stays up
    telegramBot.startPolling().catch((err) => logger.error("Telegram bot crashed:", err));
    logger.info("Telegram bot started");

    // ── WhatsApp stack ────────────────────────────────────────────────────────
    const waUserRepo    = new WhatsAppUserRepository();
    const waPaymentRepo = new WhatsAppPaymentRepository();

    const whatsappService = new WhatsAppService(llmService, waUserRepo, nodeRepo, waPaymentRepo);
    const whatsappBot     = new WhatsAppBot(whatsappService);

    setWhatsAppBotInstance(whatsappBot);

    // Non-blocking — QR scan happens in terminal; bot connects asynchronously
    whatsappBot.startPolling().catch((err) => logger.error("WhatsApp bot crashed:", err));
    logger.info("WhatsApp bot started");

    // ── Payment pollers (one per platform, fully isolated) ────────────────────
    new TelegramPaymentPoller(tgUserRepo, tgPaymentRepo, telegramBot).start();
    new WhatsAppPaymentPoller(waUserRepo, waPaymentRepo, whatsappBot).start();
    logger.info("Payment pollers started");

    // ── HTTP + WebSocket ──────────────────────────────────────────────────────
    const httpServer: http.Server = initSocket(app);

    httpServer.listen(serverConfig.PORT, () => {
      logger.info(`Server running on port ${serverConfig.PORT}`);
    });

    // ── Graceful shutdown ─────────────────────────────────────────────────────
    const shutdown = (signal: string) => async (): Promise<void> => {
      logger.info(`${signal} received — shutting down`);
      httpServer.close(() => {
        logger.info("HTTP server closed");
        process.exit(0);
      });
    };

    process.on("SIGINT",  shutdown("SIGINT"));
    process.on("SIGTERM", shutdown("SIGTERM"));

  } catch (err) {
    logger.error("Fatal startup error:", err);
    process.exit(1);
  }
};

startServer();
