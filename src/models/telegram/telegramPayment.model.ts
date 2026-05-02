import mongoose, { Document } from "mongoose";

/**
 * Telegram Payment document
 */
export interface ITelegramPayment extends Document {
  paymentId: string;
  userId: string;
  amount: number;

  status: "pending" | "success" | "failed";

  // blockchain
  memo: string;
  walletAddress: string;
  tokenMint: string;

  // verification
  txSignature?: string;

  // lifecycle
  expiresAt?: Date;
  paidAt?: Date;
}

const TelegramPaymentSchema = new mongoose.Schema<ITelegramPayment>(
  {
    paymentId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    amount: { type: Number, required: true },

    status: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
      index: true,
    },

    memo: { type: String, required: true, index: true },
    walletAddress: { type: String, required: true },
    tokenMint: { type: String, required: true },

    txSignature: { type: String, unique: true, sparse: true },

    expiresAt: { type: Date, index: true },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

export const TelegramPayment = mongoose.model<ITelegramPayment>(
  "TelegramPayment",
  TelegramPaymentSchema
);
