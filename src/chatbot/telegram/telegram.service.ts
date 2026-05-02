import { configDotenv } from "dotenv";
import QRCode from "qrcode";
import logger from "../../config/logger.config";

import { NodeLatestRepository } from "../../repositories/nodeLatest.repository";
import { TelegramPaymentRepository } from "../../repositories/telegram/telegramPayment.repository";
import { TelegramUserRepository } from "../../repositories/telegram/telegramUser.repository";
import { LLMService } from "../../service/llm.service";
import { serverConfig } from "../../config";
import { nanoid } from "nanoid";

configDotenv();

const FREE_DAILY_LIMIT = 3;
const PAYMENT_AMOUNT = 10;
const PREMIUM_REQUESTS = 100;
const NEARBY_RADIUS_KM = 50;

export interface AskResult {
  type: "answer" | "payment_required" | "error";
  text?: string;
  qrBuffer?: Buffer;
  paymentId?: string;
  walletAddress?: string;
}

export class TelegramService {
  constructor(
    private readonly llmService: LLMService,
    private readonly telegramuserRepo: TelegramUserRepository,
    private readonly nodeRepo: NodeLatestRepository,
    private readonly telegramPaymentRepo: TelegramPaymentRepository
  ) {}

  // ─── /start ─────────────────────────────────────────
  async handleStart(
    telegramId: string,
    username?: string
  ): Promise<{ text: string; askLocation: boolean }> {
    let user = await this.telegramuserRepo.findByTelegramId(telegramId);

    if (!user) {
      user = await this.telegramuserRepo.create({ telegramId, username });
      logger.info(`New user registered: ${telegramId}`);
    }

    const askLocation = !user.location?.lat;

    const text = askLocation
      ? `🌬️ *BreezoNetwork*\n\nLive air quality, AQI & weather insights.\n\n📍 Share your location to start.`
      : `🌬️ *Welcome back${username ? `, @${username}` : ""}!*\n\nAsk me anything about AQI.`;

    return { text, askLocation };
  }

  // ─── Location ───────────────────────────────────────
  async saveLocation(
    telegramId: string,
    lat: number,
    lng: number
  ): Promise<string> {
    await this.telegramuserRepo.updateLocation(telegramId, lat, lng);

    const nearby = await this.nodeRepo.findNearby(
      lat,
      lng,
      NEARBY_RADIUS_KM
    );

    return (
      `✅ Location saved!\n\n` +
      `Found ${nearby.length} nodes nearby.\n\n` +
      `Now ask about air quality.`
    );
  }

  // ─── Main handler ───────────────────────────────────
  async handleUserMessage(
    telegramId: string,
    userText: string
  ): Promise<AskResult> {
    const user = await this.telegramuserRepo.findByTelegramId(telegramId);

    if (!user) {
      return {
        type: "error",
        text: `⚠️ Please send /start first.`,
      };
    }

    if (!user.location?.lat) {
      return {
        type: "answer",
        text: `📍 Please share your location first.`,
      };
    }

    const usageOk = await this.checkAndConsumeUsage(user);
    if (!usageOk) return this.buildPaymentResponse(telegramId);

    const { lat, lng } = user.location;
    const nodes = await this.nodeRepo.findNearby(
      lat,
      lng,
      NEARBY_RADIUS_KM
    );

    const prompt = this.buildPrompt(userText, lat, lng, nodes);

    try {
      const answer = await this.llmService.ask(prompt);
      return { type: "answer", text: answer };
    } catch (err) {
      logger.error("LLM error", err);
      return {
        type: "error",
        text: `⚠️ AI unavailable. Try again.`,
      };
    }
  }

  // ─── Usage ──────────────────────────────────────────
  private async checkAndConsumeUsage(user: any): Promise<boolean> {
    if (user.isPremium) {
      if (user.remainingRequests <= 0) return false;

      await this.telegramuserRepo.decrementRequests(user.telegramId);
      return true;
    }

    const today = new Date().toDateString();
    const last = user.lastDailyReset
      ? new Date(user.lastDailyReset).toDateString()
      : null;

    const count = last === today ? user.dailyUsage || 0 : 0;

    if (count >= FREE_DAILY_LIMIT) return false;

    await this.telegramuserRepo.incrementDailyUsage(
      user.telegramId,
      last !== today
    );

    return true;
  }

  // ─── 💳 Payment flow (FIXED) ─────────────────────────
private async buildPaymentResponse(telegramId: string): Promise<AskResult> {
  const treasury = serverConfig.SOLANA_TREASURY_WALLET!;
  const mint = serverConfig.BREEZO_TOKEN_MINT!;

  // ✅ only reuse non-expired pending payment
  let payment = await this.telegramPaymentRepo.findPendingByUserId(telegramId);

  if (!payment) {
    const paymentId = nanoid(10); // ✅ collision-safe
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // ✅ 15 min expiry

    payment = await this.telegramPaymentRepo.create({
      paymentId,
      userId: telegramId,
      amount: PAYMENT_AMOUNT,
      memo: paymentId,
      walletAddress: treasury,
      tokenMint: mint,
      expiresAt, // ✅
    });
  }

  const paymentId = payment.paymentId;

  const solanaPayUrl =
    `solana:${treasury}?` +
    `amount=${PAYMENT_AMOUNT}&` +
    `spl-token=${mint}&` +
    `memo=${encodeURIComponent(paymentId)}`;

  // ✅ throw on QR failure — don't send broken response
  const qrBuffer = await QRCode.toBuffer(solanaPayUrl, { width: 320 });

  return {
    type: "payment_required",
    text:
      `🔒 Limit reached\n\n` +
      `Unlock ${PREMIUM_REQUESTS} requests for ${PAYMENT_AMOUNT} tokens.\n\n` +
      `Scan QR to pay.\n\n` +
      `⏱ Expires in 15 minutes\n` + // ✅ inform user
      `Memo: \`${paymentId}\``,
    qrBuffer,
    paymentId,
    walletAddress: treasury,
  };
}


  // ─── Helpers ────────────────────────────────────────
  private buildPrompt(
    userText: string,
    lat: number,
    lng: number,
    nodes: any[]
  ): string {
    const context = nodes
      .slice(0, 3)
      .map((n, i) => `Node ${i + 1}: AQI=${n.aqi ?? "N/A"}`)
      .join("\n");

    return `Location: ${lat},${lng}\n${context}\n\nQ: ${userText}`;
  }
}
