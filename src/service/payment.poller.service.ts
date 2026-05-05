import axios from "axios";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";

import { serverConfig } from "../config";
import logger from "../config/logger.config";

import { TelegramUserRepository } from "../repositories/telegram/telegramUser.repository";
import { TelegramPaymentRepository } from "../repositories/telegram/telegramPayment.repository";
import { WhatsAppUserRepository } from "../repositories/whatsapp/whatsappUser.repository";
import { WhatsAppPaymentRepository } from "../repositories/whatsapp/whatsappPayment.repository";

// ─── Notifier contract ────────────────────────────────────────────────────────

export interface IUserNotifier {
  sendMessage(chatId: string | number, text: string): Promise<void>;
}

// ─── Helius verified tx ───────────────────────────────────────────────────────

interface VerifiedTx {
  signature: string;
  slot: number;
  timestamp: number;
}

// ─── Helius verifier (stateless, shared between both pollers) ─────────────────

class HeliusVerifier {
  private static readonly MEMO_PROGRAM_ID =
    "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

  async check(payment: {
    paymentId: string;
    tokenMint: string;
    amount: number;
  }): Promise<VerifiedTx | null> {
    const url =
      `https://api-devnet.helius-rpc.com/v0/addresses/${serverConfig.SOLANA_TREASURY_WALLET}/transactions` +
      `?api-key=${serverConfig.HELIUS_API_KEY}&limit=20`;

    try {
      const { data } = await axios.get(url);
      if (!data?.length) return null;

      for (const tx of data) {
        if (tx.transactionError) continue;

        // 1. Find memo instruction
        const memoIx = (tx.instructions ?? []).find(
          (ix: any) => ix.programId === HeliusVerifier.MEMO_PROGRAM_ID
        );
        if (!memoIx) continue;

        // 2. Decode memo from base58
        let memo = "";
        try {
          memo = Buffer.from(bs58.decode(memoIx.data)).toString("utf8");
        } catch {
          continue;
        }

        // 3. Match paymentId in memo
        if (!memo.includes(payment.paymentId)) continue;

        // 4. Validate SPL token transfer — correct mint + sufficient amount
        const validTransfer = (tx.tokenTransfers ?? []).some(
          (t: any) =>
            t.mint === payment.tokenMint &&
            Number(t.tokenAmount) >= payment.amount
        );
        if (!validTransfer) continue;

        logger.info("✅ Helius: valid payment found", {
          paymentId: payment.paymentId,
          signature: tx.signature,
        });

        return { signature: tx.signature, slot: tx.slot, timestamp: tx.timestamp };
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

// ─── Shared singleton — one HTTP client for both pollers ──────────────────────
const helius = new HeliusVerifier();

// ─── Safe notify helper ───────────────────────────────────────────────────────

/**
 * Wraps notifier.sendMessage() so any throw (sync or async) is caught and
 * logged without breaking the poller's verify() flow.
 */
async function safeNotify(
  notifier: IUserNotifier,
  userId: string,
  text: string,
  platform: string
): Promise<void> {
  try {
    await notifier.sendMessage(userId, text);
  } catch (err: any) {
    logger.error(`[${platform}] Notify failed`, {
      userId,
      message: err?.message,
    });
  }
}

// ─── Telegram payment poller ──────────────────────────────────────────────────

export class TelegramPaymentPoller {
  private isRunning = false;

  constructor(
    private readonly userRepo: TelegramUserRepository,
    private readonly paymentRepo: TelegramPaymentRepository,
    private readonly notifier: IUserNotifier   // TelegramBot
  ) {}

  start(intervalMs = 5000): void {
    logger.info("[Telegram] Payment poller started");
    setInterval(() => this.run(), intervalMs);
  }

  private async run(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      // Expire stale payments first
      await this.paymentRepo.expireOldPayments?.();

      const pending = await this.paymentRepo.findPending();
      if (!pending.length) return;

      logger.info(`[Telegram] Checking ${pending.length} pending payment(s)`);

      for (const payment of pending) {
        await this.verify(payment);
      }
    } catch (err) {
      logger.error("[Telegram] Poller run error:", err);
    } finally {
      this.isRunning = false;
    }
  }

  private async verify(payment: any): Promise<void> {
    try {
      // 1. Check Helius for matching on-chain tx
      const tx = await helius.check(payment);
      if (!tx) return;

      // 2. Idempotency — skip if already processed in Telegram collection
      const duplicate = await this.paymentRepo.findBySignature(tx.signature);
      if (duplicate) {
        logger.warn(`[Telegram] Duplicate tx ignored: ${tx.signature}`);
        return;
      }

      // 3. Persist success BEFORE upgrading (crash-safe ordering)
      await this.paymentRepo.markSuccess(payment.paymentId, tx.signature);

      // 4. Upgrade the Telegram user record
      await this.userRepo.upgradeToPremium(payment.userId, 100);

      // 5. Notify via Telegram — payment.userId is the raw Telegram chat ID
      await safeNotify(
        this.notifier,
        payment.userId,
        `✅ *Payment Received!*\n\n` +
        `🎉 You are now a *PRO user* on Telegram\n` +
        `🚀 You have unlocked *100 AI requests*\n\n` +
        `Ask me anything about air quality — I'm ready! 🌬️`,
        "Telegram"
      );

      logger.info("[Telegram] ✔ Payment completed", {
        paymentId: payment.paymentId,
        signature: tx.signature,
        userId: payment.userId,
      });
    } catch (err: any) {
      logger.error("[Telegram] Verify failed", {
        paymentId: payment.paymentId,
        message: err?.message,
        stack: err?.stack,
      });
    }
  }
}

// ─── WhatsApp payment poller ──────────────────────────────────────────────────

export class WhatsAppPaymentPoller {
  private isRunning = false;

  constructor(
    private readonly userRepo: WhatsAppUserRepository,
    private readonly paymentRepo: WhatsAppPaymentRepository,
    private readonly notifier: IUserNotifier   // WhatsAppBot
  ) {}

  start(intervalMs = 5000): void {
    logger.info("[WhatsApp] Payment poller started");
    setInterval(() => this.run(), intervalMs);
  }

  private async run(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      // Expire stale payments first
      await this.paymentRepo.expireOldPayments?.();

      const pending = await this.paymentRepo.findPending();
      if (!pending.length) return;

      logger.info(`[WhatsApp] Checking ${pending.length} pending payment(s)`);

      for (const payment of pending) {
        await this.verify(payment);
      }
    } catch (err) {
      logger.error("[WhatsApp] Poller run error:", err);
    } finally {
      this.isRunning = false;
    }
  }

  private async verify(payment: any): Promise<void> {
    try {
      // 1. Check Helius for matching on-chain tx
      const tx = await helius.check(payment);
      if (!tx) return;

      // 2. Idempotency — scoped to WhatsApp collection only
      const duplicate = await this.paymentRepo.findBySignature(tx.signature);
      if (duplicate) {
        logger.warn(`[WhatsApp] Duplicate tx ignored: ${tx.signature}`);
        return;
      }

      // 3. Persist success BEFORE upgrading (crash-safe ordering)
      await this.paymentRepo.markSuccess(payment.paymentId, tx.signature);

      // 4. Upgrade the WhatsApp user record
      await this.userRepo.upgradeToPremium(payment.userId, 100);

      // 5. Notify via WhatsApp — payment.userId is raw phone e.g. "919876543210"
      //    WhatsAppBot.sendMessage() converts this to JID internally via toJid()
      await safeNotify(
        this.notifier,
        payment.userId,
        `✅ *Payment Received!*\n\n` +
        `🎉 You are now a *PRO user* on WhatsApp\n` +
        `🚀 You have unlocked *100 AI requests*\n\n` +
        `Reply with any air quality question to get started! 🌬️`,
        "WhatsApp"
      );

      logger.info("[WhatsApp] ✔ Payment completed", {
        paymentId: payment.paymentId,
        signature: tx.signature,
        userId: payment.userId,
      });
    } catch (err: any) {
      logger.error("[WhatsApp] Verify failed", {
        paymentId: payment.paymentId,
        message: err?.message,
        stack: err?.stack,
      });
    }
  }
}
