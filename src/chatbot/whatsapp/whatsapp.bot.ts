import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,

  proto,
  useMultiFileAuthState,
  WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import path from "path";
import fs from "fs";
import qrcode from "qrcode-terminal";

import { WhatsAppContext, WhatsAppSessionData } from "./whatsapp.context";
import { WhatsAppService } from "./whatsapp.service";
import { IUserNotifier } from "../../service/payment.poller.service";
import logger from "../../config/logger.config";

/**
 * WhatsAppBot
 *
 * Wires together the Baileys framework with WhatsAppService.
 * All business logic lives in WhatsAppService — this file is purely
 * the adapter layer between WhatsApp events and the service.
 *
 * Mirrors TelegramBot 1-to-1.
 */
export class WhatsAppBot implements IUserNotifier {
  private socket: WASocket | null = null;

  /** In-memory session store — keyed by phone number (JID prefix) */
  private readonly sessions = new Map<string, WhatsAppSessionData>();

  /** Auth state directory (persisted to disk for reconnects) */
  private readonly authDir: string;

  constructor(
    private readonly whatsappService: WhatsAppService,
    authDir = path.resolve(process.cwd(), ".whatsapp_auth")
  ) {
    this.authDir = authDir;
    if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });
  }

  // ─── Session helpers ─────────────────────────────────────────────────────────

  private getSession(jid: string): WhatsAppSessionData {
    if (!this.sessions.has(jid)) {
      this.sessions.set(jid, { awaitingLocation: false, locationAsked: false });
    }
    return this.sessions.get(jid)!;
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  /** Start the WhatsApp connection (long-lived WebSocket). */
  async startPolling(): Promise<void> {
    logger.info("Starting WhatsApp bot (Baileys WebSocket)…");
    await this.connect();
  }

  private async connect(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
    const { version } = await fetchLatestBaileysVersion();

    this.socket = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: "silent" }), // silence Baileys internal logs
      printQRInTerminal: true,            // shows QR code for first-time scan
    });

    // Persist credentials on every update
    this.socket.ev.on("creds.update", saveCreds);

    // Connection lifecycle
    this.socket.ev.on("connection.update", (update) => {
      this.onConnectionUpdate(update);
    });

    // Incoming messages
    this.socket.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;
      for (const msg of messages) {
        await this.dispatch(msg).catch((err) =>
          logger.error("Unhandled message error", { error: err, msg })
        );
      }
    });
  }

  // ─── Connection management ───────────────────────────────────────────────────

  private onConnectionUpdate(update: any): void {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
  console.log("\n==============================");
  console.log("📱 SCAN WHATSAPP QR:");
  console.log("==============================\n");
  qrcode.generate(qr, { small: true });
  console.log("\n==============================");
}


    if (connection === "open") {
      logger.info("WhatsApp connected ✅");
    }

    if (connection === "close") {
      const code = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;

      logger.warn(`WhatsApp disconnected (code: ${code}). Reconnect: ${shouldReconnect}`);

      if (shouldReconnect) {
        // Back-off a little then reconnect
        setTimeout(() => this.connect(), 3000);
      } else {
        logger.error("WhatsApp logged out — delete auth folder and restart.");
      }
    }
  }

  // ─── Dispatcher ──────────────────────────────────────────────────────────────

 private async dispatch(raw: proto.IWebMessageInfo): Promise<void> {
  const key = raw?.key;

  if (!key) return;
  if (key.fromMe) return;
  if (key.remoteJid === "status@broadcast") return;

  const jid = key.remoteJid;
  if (!jid) return;

  const phoneNumber = jid.split("@")[0];
  const session = this.getSession(jid);

  const ctx = this.buildContext(jid, phoneNumber, raw, session);

  // ── Route ──
  if (ctx.location) {
    await this.onLocation(ctx);
    return;
  }

  if (ctx.text) {
    const lower = ctx.text.trim().toLowerCase();

    if (["hi", "hello", "start", "/start"].includes(lower)) {
      await this.onStart(ctx);
      return;
    }

    await this.onText(ctx);
  }
}


  // ─── Context builder ─────────────────────────────────────────────────────────

  private buildContext(
    jid: string,
    phoneNumber: string,
    raw: proto.IWebMessageInfo,
    session: WhatsAppSessionData
  ): WhatsAppContext {
    const msgContent = raw.message;

    const text =
      msgContent?.conversation ??
      msgContent?.extendedTextMessage?.text ??
      null;

    const locMsg = msgContent?.locationMessage;
    const location = locMsg
      ? { latitude: locMsg.degreesLatitude!, longitude: locMsg.degreesLongitude! }
      : null;

    const socket = this.socket!;

    return {
      socket,
      message: raw,
      from: jid,
      phoneNumber,
      text,
      location,
      session,
      reply: async (replyText: string) => {
        await socket.sendMessage(jid, { text: replyText });
      },
    };
  }

  // ─── Handlers ────────────────────────────────────────────────────────────────

  /** Equivalent to Telegram /start */
  private async onStart(ctx: WhatsAppContext): Promise<void> {
    const { text, askLocation } = await this.whatsappService.handleStart(
      ctx.phoneNumber,
      ctx.phoneNumber
    );

    await ctx.reply(text);

    if (askLocation && !ctx.session.locationAsked) {
      ctx.session.awaitingLocation = true;
      ctx.session.locationAsked = true;

      await ctx.reply(
        "📍 Please share your location:\n\n" +
        "Tap 📎 → *Location* → *Send Your Current Location*"
      );
    }
  }

  /** Equivalent to Telegram message:location */
  private async onLocation(ctx: WhatsAppContext): Promise<void> {
    const { latitude, longitude } = ctx.location!;

    const reply = await this.whatsappService.saveLocation(
      ctx.phoneNumber,
      latitude,
      longitude
    );

    ctx.session.awaitingLocation = false;

    await ctx.reply(reply);
  }

  /** Equivalent to Telegram message:text */
  private async onText(ctx: WhatsAppContext): Promise<void> {
    if (!ctx.text) return;

    // Send "typing…" indicator (mirrors ctx.replyWithChatAction("typing"))
    await this.socket!.sendPresenceUpdate("composing", ctx.from);

    const result = await this.whatsappService.handleUserMessage(
      ctx.phoneNumber,
      ctx.text
    );

    // Stop typing indicator
    await this.socket!.sendPresenceUpdate("paused", ctx.from);

    switch (result.type) {
      case "answer":
      case "error":
        await ctx.reply(result.text!);
        break;

      case "payment_required":
        await ctx.reply(result.text!);

        if (result.qrBuffer) {
          await this.socket!.sendMessage(ctx.from, {
            image: result.qrBuffer,
            caption:
              `💳 Scan with Phantom / Solflare\n` +
              `Memo (keep this): \`${result.paymentId}\``,
          });
        }

        // Prompt location sharing if still missing
        if (result.text?.includes("location")) {
          ctx.session.awaitingLocation = true;
          await ctx.reply(
            "📍 Share your location to continue:\n\n" +
            "Tap 📎 → *Location* → *Send Your Current Location*"
          );
        }
        break;
    }
  }

  // ─── IUserNotifier ───────────────────────────────────────────────────────────

  /** Called by PaymentPollerService to notify the user. */
  async sendMessage(chatId: string | number, text: string): Promise<void> {
    if (!this.socket) {
      logger.error("WhatsApp socket not initialised — cannot send message");
      return;
    }

    // chatId is the raw phone number; convert to JID
    const jid = String(chatId).includes("@")
      ? String(chatId)
      : `${chatId}@s.whatsapp.net`;

    try {
      await this.socket.sendMessage(jid, { text });
    } catch (err) {
      logger.error("Failed to send WhatsApp message", { chatId, error: err });
    }
  }
}
