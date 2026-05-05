import {
  WhatsAppPayment,
  IWhatsAppPayment,
} from "../../models/whatsapp/whatsappPayment.model";

/**
 * WhatsApp payment repository — mirrors TelegramPaymentRepository 1-to-1.
 * Operates on the separate "whatsapppayments" Mongo collection.
 */
export class WhatsAppPaymentRepository {
  /**
   * Create a new payment record
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
  }): Promise<IWhatsAppPayment> {
    return WhatsAppPayment.create({
      ...data,
      status: data.status || "pending",
      expiresAt: data.expiresAt || new Date(Date.now() + 10 * 60 * 1000),
    });
  }

  /**
   * Find payment by paymentId (memo)
   */
  async findByPaymentId(paymentId: string): Promise<IWhatsAppPayment | null> {
    return WhatsAppPayment.findOne({ paymentId });
  }

  /**
   * Find payment by Solana transaction signature
   */
  async findBySignature(txSignature: string): Promise<IWhatsAppPayment | null> {
    return WhatsAppPayment.findOne({ txSignature });
  }

  /**
   * Find active pending payment for a user
   */
  async findPendingByUserId(userId: string): Promise<IWhatsAppPayment | null> {
    return WhatsAppPayment.findOne({
      userId,
      status: "pending",
      expiresAt: { $gt: new Date() },
    });
  }

  /**
   * Get all valid pending payments (not yet expired)
   */
  async findPending(): Promise<IWhatsAppPayment[]> {
    return WhatsAppPayment.find({
      status: "pending",
      expiresAt: { $gt: new Date() },
    });
  }

  /**
   * Mark payment as successful
   */
  async markSuccess(
    paymentId: string,
    txSignature: string
  ): Promise<IWhatsAppPayment | null> {
    return WhatsAppPayment.findOneAndUpdate(
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
   */
  async markFailed(paymentId: string): Promise<void> {
    await WhatsAppPayment.updateOne(
      { paymentId },
      { $set: { status: "failed", updatedAt: new Date() } }
    );
  }

  /**
   * Expire old pending payments (called by poller on each tick)
   */
  async expireOldPayments(): Promise<void> {
    await WhatsAppPayment.updateMany(
      { status: "pending", expiresAt: { $lt: new Date() } },
      { $set: { status: "failed" } }
    );
  }
}
