import { Bot, session, InputFile } from "grammy";
import { BotContext, SessionData } from "./telegram.context";
import { TelegramService } from "./telegram.service";
import logger from "../../config/logger.config";
import { serverConfig } from "../../config";
import { IUserNotifier } from "../../service/payment.poller.service";


export class TelegramBot implements IUserNotifier {
  private readonly bot: Bot<BotContext>;

  constructor(private readonly telegramService: TelegramService) {
    const token = serverConfig.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error("Missing TELEGRAM_BOT_TOKEN env variable");

    this.bot = new Bot<BotContext>(token);

    this.registerMiddleware();
    this.registerHandlers();
  }

  // ───────────────── Middleware ─────────────────

  private registerMiddleware(): void {
    this.bot.use(
      session<SessionData, BotContext>({
        initial: () => ({
          awaitingLocation: false,
          locationAsked: false,
        }),
      })
    );

    this.bot.catch((err) => {
      logger.error("Bot error", { error: err.error });
    });
  }

  // ───────────────── Handlers ─────────────────

  private registerHandlers(): void {
    this.bot.command("start", (ctx) => this.onStart(ctx));
    this.bot.command("help", (ctx) => this.onHelp(ctx));
    this.bot.command("node", (ctx) => this.onNode(ctx));
    this.bot.command("location", (ctx) => this.onLocationCommand(ctx));

    this.bot.on("message:location", (ctx) => this.onLocation(ctx));
    this.bot.on("message:text", (ctx) => this.onText(ctx));
  }

  // ───────────────── Helpers ─────────────────

  private locationKeyboard() {
    return {
      keyboard: [
        [{ text: "📍 Share My Location", request_location: true }],
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
    };
  }

  private async showLocationPrompt(ctx: BotContext, message: string) {
    await ctx.reply(message, {
      reply_markup: this.locationKeyboard(),
    });
  }

  // ───────────────── /start ─────────────────

  private async onStart(ctx: BotContext): Promise<void> {
    const telegramId = String(ctx.from?.id);
    const username = ctx.from?.username;

    const { text, askLocation } = await this.telegramService.handleStart(
      telegramId,
      username
    );

    await ctx.reply(
      `${text}\n\nUse /help to see available commands.`,
      { parse_mode: "Markdown" }
    );

    if (askLocation && !ctx.session.locationAsked) {
      ctx.session.locationAsked = true;
      ctx.session.awaitingLocation = true;

      await this.showLocationPrompt(
        ctx,
        "📍 Please share your location to continue:"
      );
    }
  }

  // ───────────────── /help ─────────────────

  private async onHelp(ctx: BotContext): Promise<void> {
    await ctx.reply(
      `📌 *Available Commands*\n\n` +
        `/start - Start bot\n` +
        `/help - Show commands\n` +
        `/node - Show available nodes\n` +
        `/location - Share or update location`,
      { parse_mode: "Markdown" }
    );
  }

  // ───────────────── /node ─────────────────

  private async onNode(ctx: BotContext): Promise<void> {
    const telegramId = String(ctx.from?.id);

    const nodes = await this.telegramService.getAvailableNodes?.(telegramId);

    if (!nodes || nodes.length === 0) {
      await ctx.reply("⚠️ No nodes available right now.");
      return;
    }

    const text =
      "📡 *Available Nodes*\n\n" +
      nodes.map((n: any, i: number) => `• Node ${i + 1}: ${n.name || "Active"}`).join("\n");

    await ctx.reply(text, { parse_mode: "Markdown" });
  }

  // ───────────────── /location ─────────────────

  private async onLocationCommand(ctx: BotContext): Promise<void> {
    const telegramId = String(ctx.from?.id);

    const hasLocation = await this.telegramService.hasLocation?.(telegramId);

    if (!hasLocation) {
      ctx.session.awaitingLocation = true;
      await this.showLocationPrompt(
        ctx,
        "📍 Please share your location:"
      );
    } else {
      await ctx.reply("📍 Your location is already saved. You can update it anytime by sharing again.");
      await this.showLocationPrompt(ctx, "Want to update it? Share again below 👇");
    }
  }

  // ───────────────── Location message ─────────────────

  private async onLocation(ctx: BotContext): Promise<void> {
    const location = ctx.message?.location;
    if (!location) return;

    const telegramId = String(ctx.from?.id);

    const reply = await this.telegramService.saveLocation(
      telegramId,
      location.latitude,
      location.longitude
    );

    ctx.session.awaitingLocation = false;

    await ctx.reply(reply, {
      parse_mode: "Markdown",
      reply_markup: { remove_keyboard: true },
    });
  }

  // ───────────────── Text handler ─────────────────

  private async onText(ctx: BotContext): Promise<void> {
    const telegramId = String(ctx.from?.id);
    const text = ctx.message?.text ?? "";

    if (text.startsWith("/")) return;

    await ctx.replyWithChatAction("typing");

    const result = await this.telegramService.handleUserMessage(
      telegramId,
      text
    );

    switch (result.type) {
      case "answer":
      case "error":
        await ctx.reply(result.text!, { parse_mode: "Markdown" });
        break;

      case "payment_required":
        await ctx.reply(result.text!, { parse_mode: "Markdown" });

        if (result.qrBuffer) {
          await ctx.replyWithPhoto(
            new InputFile(result.qrBuffer, "payment_qr.png"),
            {
              caption: `💳 Scan to pay\nMemo: \`${result.paymentId}\``,
              parse_mode: "Markdown",
            }
          );
        }

        if (result.text?.includes("location")) {
          ctx.session.awaitingLocation = true;
          await this.showLocationPrompt(
            ctx,
            "📍 Please share your location to continue:"
          );
        }
        break;
    }
  }

  // ───────────────── Lifecycle ─────────────────

  async startPolling(): Promise<void> {
    logger.info("Bot starting...");
    await this.bot.start();
  }

  async handleWebhookUpdate(update: unknown): Promise<void> {
    await this.bot.handleUpdate(update as any);
  }

  async setWebhook(url: string): Promise<void> {
    await this.bot.api.setWebhook(url);
    logger.info(`Webhook set: ${url}`);
  }

  async deleteWebhook(): Promise<void> {
    await this.bot.api.deleteWebhook();
  }

  async sendMessage(chatId: string | number, text: string): Promise<void> {
    try {
      await this.bot.api.sendMessage(chatId, text, {
        parse_mode: "Markdown",
      });
    } catch (err) {
      logger.error("Send message failed", { chatId, err });
    }
  }
}

