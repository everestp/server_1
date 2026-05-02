import axios from "axios";
import { serverConfig } from "../config";
import logger from "../config/logger.config";
import { TelegramUserRepository } from "../repositories/telegram/telegramUser.repository";
import { TelegramPaymentRepository } from "../repositories/telegram/telegramPayment.repository";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";

export interface IUserNotifier {
  sendMessage(chatId: string | number, text: string): Promise<void>;
}

export class PaymentPollerService {
  private isRunning = false;

  constructor(
    private userRepo: TelegramUserRepository,
    private paymentRepo: TelegramPaymentRepository,
    private notifier: IUserNotifier
  ) {}

  // 🚀 Start polling
  start(intervalMs = 5000): void {
    logger.info("Starting payment poller...");

    setInterval(() => this.run(), intervalMs);
  }

  // 🔁 Main loop (protected from overlap)
  private async run(): Promise<void> {
    if (this.isRunning) return; // prevent overlapping runs
    this.isRunning = true;

    try {
      // ⏱️ expire old payments
      await this.paymentRepo.expireOldPayments?.();

      const pendingPayments = await this.paymentRepo.findPending();

      if (!pendingPayments.length) {
        this.isRunning = false;
        return;
      }

      logger.info(`Checking ${pendingPayments.length} pending payments`);

      for (const payment of pendingPayments) {
        await this.verify(payment);
      }
    } catch (err) {
      logger.error("Poller run error:", err);
    } finally {
      this.isRunning = false;
    }
  }

  // 🔍 Verify single payment
private async verify(payment: any): Promise<void> {
  try {
    const tx = await this.checkHelius(payment);

    if (!tx) return;

    // 🔐 Prevent duplicate processing
    const alreadyProcessed = await this.paymentRepo.findBySignature(
      tx.signature
    );

    if (alreadyProcessed) {
      logger.warn(`Duplicate tx ignored: ${tx.signature}`);
      return;
    }

    // ✅ Mark success FIRST (idempotency safe)
    await this.paymentRepo.markSuccess(payment.paymentId, tx.signature);

    // 🎉 Upgrade user
    await this.userRepo.upgradeToPremium(payment.userId, 100);

    // 📩 Notify user (do not block flow)
    this.notifier
      .sendMessage(
        payment.userId,
        `✅ *Payment Received!*\n\n🎉 You are now *PRO user*\n🚀 You unlocked 100 AI requests`
      )
      .catch((e: any) => {
        logger.error("Notify failed", {
          message: e?.message,
        });
      });

    logger.info(`✔ Payment completed`, {
      paymentId: payment.paymentId,
      signature: tx.signature,
      userId: payment.userId,
    });
  } catch (err: any) {
    logger.error(`Verify failed`, {
      paymentId: payment.paymentId,
      message: err?.message,
      stack: err?.stack,
    });
  }
}



  //  Helius check
async checkHelius(payment: any): Promise<{ signature: string; slot: number; timestamp: number } | null> {
  const url =
    `https://api-devnet.helius-rpc.com/v0/addresses/${serverConfig.SOLANA_TREASURY_WALLET}/transactions` +
    `?api-key=${serverConfig.HELIUS_API_KEY}&limit=20`;

  try {
    const { data } = await axios.get(url);

    if (!data?.length) return null;

    for (const tx of data) {
      if (tx.transactionError) continue;

      // ─────────────────────────────
      // 1. DECODE MEMO
      // ─────────────────────────────
      const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

      const memoIx = (tx.instructions || []).find(
        (ix: any) => ix.programId === MEMO_PROGRAM_ID
      );

      if (!memoIx) continue;

      let memo = "";
      try {
        memo = Buffer.from(bs58.decode(memoIx.data)).toString("utf8");
      } catch {
        continue;
      }

      if (!memo.includes(payment.paymentId)) continue;

      // ─────────────────────────────
      // 2. VALIDATE TRANSFER
      // ─────────────────────────────
      const validTransfer = (tx.tokenTransfers || []).some((t: any) =>
        t.mint === payment.tokenMint &&
        Number(t.tokenAmount) >= payment.amount
      );

      if (!validTransfer) continue;

      // ─────────────────────────────
      // 3. SUCCESS
      // ─────────────────────────────
      logger.info("✅ Valid payment found", {
        paymentId: payment.paymentId,
        signature: tx.signature,
      });

      return {
        signature: tx.signature,
        slot: tx.slot,
        timestamp: tx.timestamp,
      };
    }

    return null;
  } catch (err: any) {
    logger.error("Helius check failed", {
      message: err?.message,
      response: err?.response?.data,
    });
    return null;
  }
}
}
