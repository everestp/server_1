import { configDotenv } from "dotenv";
import QRCode from "qrcode";
import logger from "../../config/logger.config";

import { NodeLatestRepository } from "../../repositories/nodeLatest.repository";
import { WhatsAppPaymentRepository } from "../../repositories/whatsapp/whatsappPayment.repository";
import { WhatsAppUserRepository } from "../../repositories/whatsapp/whatsappUser.repository";

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

export class WhatsAppService {
  constructor(
    private readonly llmService: LLMService,
    private readonly whatsappUserRepo: WhatsAppUserRepository,
    private readonly nodeRepo: NodeLatestRepository,
    private readonly whatsappPaymentRepo: WhatsAppPaymentRepository
  ) {}

  // ───────────────── USER ─────────────────

  private async getUser(whatsappId: string) {
    return this.whatsappUserRepo.findByWhatsAppId(whatsappId);
  }

  async hasLocation(whatsappId: string) {
    const user = await this.getUser(whatsappId);
    return !!user?.location?.lat;
  }

  // ───────────────── NODES ─────────────────

  async getAvailableNodes(whatsappId: string) {
    const user = await this.getUser(whatsappId);
    if (!user?.location?.lat) return [];

    return this.nodeRepo.findNearby(
      user.location.lat,
      user.location.lng,
      NEARBY_RADIUS_KM
    );
  }

  // ───────────────── START ─────────────────

  async handleStart(
    whatsappId: string,
    username?: string
  ): Promise<{ text: string; askLocation: boolean }> {
    let user = await this.getUser(whatsappId);

    if (!user) {
      user = await this.whatsappUserRepo.create({
        whatsappId,
        username,
      });
      logger.info(`New WhatsApp user: ${whatsappId}`);
    }

    const askLocation = !user.location?.lat;

    return {
      text: askLocation
        ? `*Breezo Network*\n\nReal-time environmental monitoring assistant.\n\nShare your location to:\n• Find nearby sensors\n• Analyze AQI, CO₂, PM2.5\n• Get insights & health tips`.trim()
        : `*Welcome back${username ? ` ${username}` : ""}*\n\nHow can I help you with the air quality today?`.trim(),
      askLocation,
    };
  }

  // ───────────────── LOCATION ─────────────────

  async saveLocation(
    whatsappId: string,
    lat: number,
    lng: number
  ): Promise<string> {
    await this.whatsappUserRepo.updateLocation(whatsappId, lat, lng);
    const nearby = await this.nodeRepo.findNearby(lat, lng, NEARBY_RADIUS_KM);

    return `*Location updated successfully.*\n\nNearby active sensors: ${nearby.length}\n\nYou can now ask me environmental questions.`.trim();
  }

  // ───────────────── MAIN AI ─────────────────

  async handleUserMessage(
    whatsappId: string,
    userText: string
  ): Promise<AskResult> {
    const user = await this.getUser(whatsappId);

    if (!user) {
      return { type: "error", text: "Please send *hi* first." };
    }

    if (!user.location?.lat) {
      return {
        type: "answer",
        text: "Please share your location first using the attachment button.",
      };
    }

    const allowed = await this.checkUsage(user);
    if (!allowed) return this.buildPaymentResponse(whatsappId);

    const nearbyNodes = await this.nodeRepo.findNearby(
      user.location.lat,
      user.location.lng,
      NEARBY_RADIUS_KM
    );

    if (!nearbyNodes.length) {
      return {
        type: "answer",
        text: "No nearby environmental sensors are currently available in your area.",
      };
    }

    const prompt = this.buildPrompt(
      userText,
      user.location,
      nearbyNodes.slice(0, 3)
    );

    try {
      const answer = await this.llmService.ask(prompt);
      return { type: "answer", text: answer };
    } catch (err) {
      logger.error("LLM Error", err);
      return { type: "error", text: "_Environmental AI service unavailable._" };
    }
  }

  // ───────────────── USAGE ─────────────────

  private async checkUsage(user: any): Promise<boolean> {
    if (user.isPremium) {
      if (user.remainingRequests <= 0) return false;
      await this.whatsappUserRepo.decrementRequests(user.whatsappId);
      return true;
    }

    const today = new Date().toDateString();
    const lastReset = user.lastDailyReset
      ? new Date(user.lastDailyReset).toDateString()
      : null;

    const todayUsage = lastReset === today ? user.dailyUsage || 0 : 0;

    if (todayUsage >= FREE_DAILY_LIMIT) return false;

    await this.whatsappUserRepo.incrementDailyUsage(
      user.whatsappId,
      lastReset !== today
    );
    return true;
  }

  // ───────────────── PAYMENT ─────────────────

  private async buildPaymentResponse(whatsappId: string): Promise<AskResult> {
    const treasury = serverConfig.SOLANA_TREASURY_WALLET!;
    const mint = serverConfig.BREEZO_TOKEN_MINT!;

    let payment = await this.whatsappPaymentRepo.findPendingByUserId(whatsappId);

    if (!payment) {
      const paymentId = nanoid(10);
      payment = await this.whatsappPaymentRepo.create({
        paymentId,
        userId: whatsappId,
        amount: PAYMENT_AMOUNT,
        memo: paymentId,
        walletAddress: treasury,
        tokenMint: mint,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });
    }

    const paymentId = payment.paymentId;
    const solanaPayUrl = `solana:${treasury}?amount=${PAYMENT_AMOUNT}&spl-token=${mint}&memo=${encodeURIComponent(paymentId)}`;
    const qrBuffer = await QRCode.toBuffer(solanaPayUrl, { width: 320 });

    return {
      type: "payment_required",
      text: `*Daily limit reached.*\n\nUpgrade to premium:\n• ${PREMIUM_REQUESTS} AI requests\n• Multi-sensor insights\n\n*Amount:* ${PAYMENT_AMOUNT} tokens\n*Memo:* \`${paymentId}\`\n\nScan the QR code to pay via Phantom/Solflare.`.trim(),
      qrBuffer,
      paymentId,
      walletAddress: treasury,
    };
  }

  // ───────────────── AI PROMPT ─────────────────

  private buildPrompt(userText: string, location: any, nodes: any[]) {
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
