import { Bot, session, InputFile } from "grammy";
import { BotContext, SessionData } from "./telegram.context";
import { TelegramService } from "./telegram.service";
import logger from "../../config/logger.config";
import { serverConfig } from "../../config";
import { IUserNotifier } from "../../service/payment.poller.service";

/**
 * TelegramBot
 *
 * Wires together the grammY bot framework with TelegramService.
 * All business logic lives in TelegramService — this file is purely
 * the adapter layer between Telegram events and the service.
 */
export class TelegramBot implements IUserNotifier {
  private readonly bot: Bot<BotContext>;

  constructor(private readonly telegramService: TelegramService) {
    const token = serverConfig.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error("Missing TELEGRAM_BOT_TOKEN env variable");

    this.bot = new Bot<BotContext>(token);
    this.registerMiddleware();
    this.registerHandlers();
  }

  // ─── Middleware ─────────────────────────────────────────────────────────────

  private registerMiddleware(): void {
    // In-memory session (swap to a DB adapter for multi-instance deployments)
    this.bot.use(
      session<SessionData, BotContext>({
        initial: () => ({ awaitingLocation: false, locationAsked: false }),
      })
    );

    // Global error boundary
    this.bot.catch((err) => {
      logger.error("Unhandled bot error", { error: err.error, ctx: err.ctx?.update });
    });
  }

  // ─── Handlers ───────────────────────────────────────────────────────────────

  private registerHandlers(): void {
    this.bot.command("start", (ctx) => this.onStart(ctx));
    this.bot.on("message:location", (ctx) => this.onLocation(ctx));
    this.bot.on("message:text", (ctx) => this.onText(ctx));
  }

  // ─── /start ─────────────────────────────────────────────────────────────────

  private async onStart(ctx: BotContext): Promise<void> {
    const telegramId = String(ctx.from?.id);
    const username = ctx.from?.username;

    const { text, askLocation } = await this.telegramService.handleStart(telegramId, username);

    await ctx.reply(text, { parse_mode: "Markdown" });

    if (askLocation && !ctx.session.locationAsked) {
      ctx.session.awaitingLocation = true;
      ctx.session.locationAsked = true;

      await ctx.reply("📍 Please share your location:", {
        reply_markup: {
          keyboard: [
            [
              {
                text: "📍 Share My Location",
                request_location: true,
              },
            ],
          ],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      });
    }
  }

  // ─── Location message ────────────────────────────────────────────────────────

  private async onLocation(ctx: BotContext): Promise<void> {
    const location = ctx.message?.location;
    if (!location) return;

    const telegramId = String(ctx.from?.id);
    const { latitude: lat, longitude: lng } = location;

    const reply = await this.telegramService.saveLocation(telegramId, lat, lng);

    ctx.session.awaitingLocation = false;

    await ctx.reply(reply, {
      parse_mode: "Markdown",
      reply_markup: { remove_keyboard: true },
    });
  }

  // ─── Text messages ───────────────────────────────────────────────────────────

  private async onText(ctx: BotContext): Promise<void> {
    const telegramId = String(ctx.from?.id);
    const text = ctx.message?.text ?? "";

    // Ignore bot commands that fall through
    if (text.startsWith("/")) return;

    // Show typing indicator while processing
    await ctx.replyWithChatAction("typing");

    const result = await this.telegramService.handleUserMessage(telegramId, text);

    switch (result.type) {
      case "answer":
      case "error":
        await ctx.reply(result.text!, { parse_mode: "Markdown" });
        break;

      case "payment_required":
        await ctx.reply(result.text!, { parse_mode: "Markdown" });

        if (result.qrBuffer) {
          await ctx.replyWithPhoto(new InputFile(result.qrBuffer, "payment_qr.png"), {
            caption:
              `💳 Scan with Phantom / Solflare\n` +
              `Memo (keep this): \`${result.paymentId}\``,
            parse_mode: "Markdown",
          });
        }

        // Prompt location sharing button if location is still missing
        if (result.text?.includes("location")) {
          ctx.session.awaitingLocation = true;
          await ctx.reply("📍 Share your location to continue:", {
            reply_markup: {
              keyboard: [[{ text: "📍 Share My Location", request_location: true }]],
              resize_keyboard: true,
              one_time_keyboard: true,
            },
          });
        }
        break;
    }
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  /** Start long-polling (dev / single-instance). */
  async startPolling(): Promise<void> {
    logger.info("Starting Telegram bot (long-polling)…");
    await this.bot.start({
      onStart: (info) => console.log(`Bot @${info.username} is running`),
    });
  }

  /**
   * Handle a single webhook update.
   * Call this from your Express webhook route in production.
   */
  async handleWebhookUpdate(update: unknown): Promise<void> {
    await this.bot.handleUpdate(update as any);
  }

  /** Set the webhook URL (call once at deploy time). */
  async setWebhook(url: string): Promise<void> {
    await this.bot.api.setWebhook(url);
    logger.info(`Telegram webhook set to ${url}`);
  }

  /** Remove webhook and go back to polling. */
  async deleteWebhook(): Promise<void> {
    await this.bot.api.deleteWebhook();
  }

  async sendMessage(chatId: string | number, text: string): Promise<void> {
    try {
      await this.bot.api.sendMessage(chatId, text, {
        parse_mode: "Markdown",
      });
    } catch (err) {
      logger.error("Failed to send Telegram message", {
        chatId,
        error: err,
      });
    }
  }

}
