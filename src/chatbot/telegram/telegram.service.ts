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
const NEARBY_RADIUS_KM = 5000;

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

  // ───────────────── USER ─────────────────

  private async getUser(telegramId: string) {
    return this.telegramuserRepo.findByTelegramId(telegramId);
  }

  async hasLocation(telegramId: string) {
    const user = await this.getUser(telegramId);
    return !!user?.location?.lat;
  }

  // ───────────────── NODES ─────────────────

  async getAvailableNodes(telegramId: string) {
    const user = await this.getUser(telegramId);

    if (!user?.location?.lat) return [];

    return this.nodeRepo.findNearby(
      user.location.lat,
      user.location.lng,
      NEARBY_RADIUS_KM
    );
  }

  // ───────────────── START ─────────────────

  async handleStart(
    telegramId: string,
    username?: string
  ): Promise<{ text: string; askLocation: boolean }> {
    let user = await this.getUser(telegramId);

    if (!user) {
      user = await this.telegramuserRepo.create({
        telegramId,
        username,
      });

      logger.info(`New telegram user: ${telegramId}`);
    }

    const askLocation = !user.location?.lat;

    return {
      text: askLocation
        ? `
Breezo Network

Real-time environmental monitoring assistant.

Share your location to:
• Find nearby sensors
• Analyze AQI, CO₂, PM2.5
• Get temperature & humidity insights
• Receive health recommendations

Use /help for commands.
`.trim()
        : `
Welcome back${username ? ` @${username}` : ""}

Use:
/help - Commands
/node - Nearby sensors
/location - Update location
`.trim(),

      askLocation,
    };
  }

  // ───────────────── LOCATION ─────────────────

  async saveLocation(
    telegramId: string,
    lat: number,
    lng: number
  ): Promise<string> {
    await this.telegramuserRepo.updateLocation(
      telegramId,
      lat,
      lng
    );

    const nearby = await this.nodeRepo.findNearby(
      lat,
      lng,
      NEARBY_RADIUS_KM
    );

    return `
Location updated successfully.

Nearby active sensors: ${nearby.length}

You can now:
• Ask environmental questions
• Use /node to view nearby sensors
• Use /help for commands
`.trim();
  }

  // ───────────────── MAIN AI ─────────────────

  async handleUserMessage(
    telegramId: string,
    userText: string
  ): Promise<AskResult> {

    const user = await this.getUser(telegramId);

    // USER CHECK
    if (!user) {
      return {
        type: "error",
        text: "Please send /start first.",
      };
    }

    // LOCATION CHECK
    if (!user.location?.lat) {
      return {
        type: "answer",
        text: "Please set your location using /location",
      };
    }

    // USAGE CHECK
    const allowed = await this.checkUsage(user);

    if (!allowed) {
      return this.buildPaymentResponse(telegramId);
    }

    // FETCH NODES
    const nearbyNodes = await this.nodeRepo.findNearby(
      user.location.lat,
      user.location.lng,
      NEARBY_RADIUS_KM
    );

    // NO NODE CASE
    if (!nearbyNodes.length) {
      return {
        type: "answer",
        text: "No nearby environmental sensors are currently available.",
      };
    }

    // BUILD AI PROMPT
    const prompt = this.buildPrompt(
      userText,
      user.location,
      nearbyNodes.slice(0, 3)
    );

    try {
      const answer = await this.llmService.ask(prompt);

      return {
        type: "answer",
        text: answer,
      };

    } catch (err) {
      logger.error("LLM Error", err);

      return {
        type: "error",
        text: "Environmental AI service unavailable.",
      };
    }
  }

  // ───────────────── USAGE ─────────────────

  private async checkUsage(user: any): Promise<boolean> {

    // PREMIUM USER
    if (user.isPremium) {

      if (user.remainingRequests <= 0) {
        return false;
      }

      await this.telegramuserRepo.decrementRequests(
        user.telegramId
      );

      return true;
    }

    // FREE USER
    const today = new Date().toDateString();

    const lastReset = user.lastDailyReset
      ? new Date(user.lastDailyReset).toDateString()
      : null;

    const todayUsage =
      lastReset === today
        ? user.dailyUsage || 0
        : 0;

    // LIMIT REACHED
    if (todayUsage >= FREE_DAILY_LIMIT) {
      return false;
    }

    // INCREMENT DAILY USAGE
    await this.telegramuserRepo.incrementDailyUsage(
      user.telegramId,
      lastReset !== today
    );

    return true;
  }

  // ───────────────── PAYMENT ─────────────────

  private async buildPaymentResponse(
    telegramId: string
  ): Promise<AskResult> {

    const treasury =
      serverConfig.SOLANA_TREASURY_WALLET!;

    const mint =
      serverConfig.BREEZO_TOKEN_MINT!;

    let payment =
      await this.telegramPaymentRepo.findPendingByUserId(
        telegramId
      );

    // CREATE NEW PAYMENT
    if (!payment) {

      const paymentId = nanoid(10);

      payment =
        await this.telegramPaymentRepo.create({
          paymentId,
          userId: telegramId,
          amount: PAYMENT_AMOUNT,
          memo: paymentId,
          walletAddress: treasury,
          tokenMint: mint,
          expiresAt: new Date(
            Date.now() + 15 * 60 * 1000
          ),
        });
    }

    const paymentId = payment.paymentId;

    // SOLANA PAY URL
    const solanaPayUrl =
      `solana:${treasury}?amount=${PAYMENT_AMOUNT}` +
      `&spl-token=${mint}` +
      `&memo=${encodeURIComponent(paymentId)}`;

    // QR
    const qrBuffer =
      await QRCode.toBuffer(solanaPayUrl, {
        width: 320,
      });

    return {
      type: "payment_required",

      text: `
Daily free limit reached.

Upgrade to premium:
• ${PREMIUM_REQUESTS} AI requests
• Real-time environmental analysis
• Multi-sensor insights

Payment amount: ${PAYMENT_AMOUNT} tokens
Expires in: 15 minutes

Memo:
${paymentId}
`.trim(),

      qrBuffer,
      paymentId,
      walletAddress: treasury,
    };
  }

  // ───────────────── AI PROMPT ─────────────────

private buildPrompt(userText: string, location: any, nodes: any[]) {
  // Use a compact string format for sensor data
  const sensorContext = nodes.slice(0, 3).map((n, i) =>
    `N${i+1}[ID:${n.nodeId ?? '?'}|AQI:${n.aqi ?? '?'}|Lvl:${n.aqiLevel ?? '?'}|PM2.5:${n.pm25 ?? '?'}|CO2:${n.pm10 ?? '?'}|T:${n.temperature ?? '?'}|H:${n.humidity ?? '?'}|Seen:${n.lastSeen ? new Date(n.lastSeen).toISOString() : '?'}]`
  ).join("; ");

  return `Role: Breezo Environmental AI.
Task: Analyze data & answer user question.
Rules: Max 70 words. No emojis. Professional. Include values for AQI, Temp, Humidity, CO2, PM2.5. Note stale data/comfort/pollution.
Location: ${location.lat},${location.lng}
Data: ${sensorContext}
Q: ${userText}
Output: Professional advice + values.`;
}
}
