import QRCode from "qrcode";
import logger from "../../config/logger.config";

import { NodeLatestRepository } from "../../repositories/nodeLatest.repository";
import { WhatsAppPaymentRepository } from "../../repositories/whatsapp/whatsappPayment.repository";
import { LLMService } from "../../service/llm.service";
import { serverConfig } from "../../config";
import { nanoid } from "nanoid";
import { WhatsAppUserRepository } from "../../repositories/whatsapp/whatsappUser.repository";

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
    private readonly whatsappPaymentRepo: WhatsAppPaymentRepository   // ← own repo
  ) {}

  // ─── Greeting ────────────────────────────────────────────────────────────────

  async handleStart(
    whatsappId: string,
    username?: string
  ): Promise<{ text: string; askLocation: boolean }> {
    let user = await this.whatsappUserRepo.findByWhatsAppId(whatsappId);

    if (!user) {
      user = await this.whatsappUserRepo.create({ whatsappId, username });
      logger.info(`New WhatsApp user registered: ${whatsappId}`);
    }

    const askLocation = !user.location?.lat;

    const text = askLocation
      ? `🌬️ *BreezoNetwork*\n\nLive air quality, AQI & weather insights.\n\n📍 Please share your location to get started.`
      : `🌬️ *Welcome back${username ? `, ${username}` : ""}!*\n\nAsk me anything about AQI.`;

    return { text, askLocation };
  }

  // ─── Location ────────────────────────────────────────────────────────────────

  async saveLocation(
    whatsappId: string,
    lat: number,
    lng: number
  ): Promise<string> {
    await this.whatsappUserRepo.updateLocation(whatsappId, lat, lng);

    const nearby = await this.nodeRepo.findNearby(lat, lng, NEARBY_RADIUS_KM);

    return (
      `✅ Location saved!\n\n` +
      `Found ${nearby.length} nodes nearby.\n\n` +
      `Now ask about air quality.`
    );
  }

  // ─── Main handler ────────────────────────────────────────────────────────────

  async handleUserMessage(
    whatsappId: string,
    userText: string
  ): Promise<AskResult> {
    const user = await this.whatsappUserRepo.findByWhatsAppId(whatsappId);

    if (!user) {
      return { type: "error", text: `⚠️ Please send *hi* to register first.` };
    }

    if (!user.location?.lat) {
      return {
        type: "answer",
        text: `📍 Please share your location first using the attachment (📎) button.`,
      };
    }

    const usageOk = await this.checkAndConsumeUsage(user);
    if (!usageOk) return this.buildPaymentResponse(whatsappId);

    const { lat, lng } = user.location;
    const nodes = await this.nodeRepo.findNearby(lat, lng, NEARBY_RADIUS_KM);
    const prompt = this.buildPrompt(userText, lat, lng, nodes);

    try {
      const answer = await this.llmService.ask(prompt);
      return { type: "answer", text: answer };
    } catch (err) {
      logger.error("LLM error", err);
      return { type: "error", text: `⚠️ AI unavailable. Try again later.` };
    }
  }

  // ─── Usage ───────────────────────────────────────────────────────────────────

  private async checkAndConsumeUsage(user: any): Promise<boolean> {
    if (user.isPremium) {
      if (user.remainingRequests <= 0) return false;
      await this.whatsappUserRepo.decrementRequests(user.whatsappId);
      return true;
    }

    const today = new Date().toDateString();
    const last = user.lastDailyReset
      ? new Date(user.lastDailyReset).toDateString()
      : null;

    const count = last === today ? user.dailyUsage || 0 : 0;
    if (count >= FREE_DAILY_LIMIT) return false;

    await this.whatsappUserRepo.incrementDailyUsage(
      user.whatsappId,
      last !== today
    );
    return true;
  }

  // ─── Payment flow ─────────────────────────────────────────────────────────────

  private async buildPaymentResponse(whatsappId: string): Promise<AskResult> {
    const treasury = serverConfig.SOLANA_TREASURY_WALLET!;
    const mint = serverConfig.BREEZO_TOKEN_MINT!;

    // Reuse existing non-expired pending payment from WhatsApp collection
    let payment = await this.whatsappPaymentRepo.findPendingByUserId(whatsappId);

    if (!payment) {
      const paymentId = nanoid(10);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      payment = await this.whatsappPaymentRepo.create({
        paymentId,
        userId: whatsappId,
        amount: PAYMENT_AMOUNT,
        memo: paymentId,
        walletAddress: treasury,
        tokenMint: mint,
        expiresAt,
      });
    }

    const paymentId = payment.paymentId;

    const solanaPayUrl =
      `solana:${treasury}?` +
      `amount=${PAYMENT_AMOUNT}&` +
      `spl-token=${mint}&` +
      `memo=${encodeURIComponent(paymentId)}`;

    const qrBuffer = await QRCode.toBuffer(solanaPayUrl, { width: 320 });

    return {
      type: "payment_required",
      text:
        `🔒 *Daily limit reached*\n\n` +
        `Unlock ${PREMIUM_REQUESTS} requests for ${PAYMENT_AMOUNT} tokens.\n\n` +
        `Scan the QR code below to pay via Phantom / Solflare.\n\n` +
        `⏱ Expires in 15 minutes\n` +
        `Memo: \`${paymentId}\``,
      qrBuffer,
      paymentId,
      walletAddress: treasury,
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

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
