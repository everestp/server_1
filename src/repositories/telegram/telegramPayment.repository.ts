import {
  TelegramPayment,
  ITelegramPayment,
} from "../../models/telegram/telegramPayment.model";

/**
 * Telegram payment repository
 */
export class TelegramPaymentRepository {
  /**
   * Create a new payment record
   *
   * @param data.paymentId - unique payment id (memo)
   * @param data.userId - telegram user id
   * @param data.amount - payment amount
   * @param data.memo - solana memo for verification
   * @param data.walletAddress - treasury wallet
   * @param data.tokenMint - token mint address
   * @param data.status - payment status (optional)
   * @param data.expiresAt - expiry time (optional)
   * @returns created payment document
   */
  async create(data: {
    paymentId: string;
    userId: string;
    amount: number;
    memo: string;
    walletAddress: string;
    tokenMint: string;
    status?: "pending" | "success" | "failed";
    expiresAt?: Date;
  }): Promise<ITelegramPayment> {
    return TelegramPayment.create({
      ...data,
      status: data.status || "pending",
      expiresAt:
        data.expiresAt || new Date(Date.now() + 10 * 60 * 1000),
    });
  }

  /**
   * Find payment by paymentId (memo)
   *
   * @param paymentId - unique payment identifier
   * @returns payment document or null
   */
  async findByPaymentId(
    paymentId: string
  ): Promise<ITelegramPayment | null> {
    return TelegramPayment.findOne({ paymentId });
  }

  /**
   * Find payment by Solana transaction signature
   *
   * @param txSignature - blockchain transaction signature
   * @returns payment document or null
   */
  async findBySignature(
    txSignature: string
  ): Promise<ITelegramPayment | null> {
    return TelegramPayment.findOne({ txSignature });
  }

  /**
   * Find active pending payment for a user
   *
   * @param userId - telegram user id
   * @returns pending payment or null
   */
  async findPendingByUserId(
    userId: string
  ): Promise<ITelegramPayment | null> {
    return TelegramPayment.findOne({
      userId,
      status: "pending",
    });
  }

  /**
   * Get all valid pending payments
   *
   * @returns list of active pending payments
   */
  async findPending(): Promise<ITelegramPayment[]> {
    return TelegramPayment.find({
      status: "pending",
      expiresAt: { $gt: new Date() },
    });
  }

  /**
   * Mark payment as successful
   *
   * @param paymentId - unique payment id
   * @param txSignature - blockchain transaction signature
   * @returns updated payment document
   */
  async markSuccess(
    paymentId: string,
    txSignature: string
  ): Promise<ITelegramPayment | null> {
    return TelegramPayment.findOneAndUpdate(
      { paymentId },
      {
        $set: {
          status: "success",
          txSignature,
          paidAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { new: true }
    );
  }

  /**
   * Mark payment as failed
   *
   * @param paymentId - unique payment id
   */
  async markFailed(paymentId: string): Promise<void> {
    await TelegramPayment.updateOne(
      { paymentId },
      {
        $set: {
          status: "failed",
          updatedAt: new Date(),
        },
      }
    );
  }

  /**
   * Expire old pending payments
   * (used by cron or poller job)
   */
  async expireOldPayments(): Promise<void> {
    await TelegramPayment.updateMany(
      {
        status: "pending",
        expiresAt: { $lt: new Date() },
      },
      {
        $set: { status: "failed" },
      }
    );
  }
}
