import mongoose, { Document } from "mongoose";

/**
 * WhatsApp Payment document — mirrors ITelegramPayment 1-to-1
 * Stored in a separate "whatsapppayments" collection.
 */
export interface IWhatsAppPayment extends Document {
  paymentId: string;
  userId: string;           // E.164 phone number (no @s.whatsapp.net suffix)

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

const WhatsAppPaymentSchema = new mongoose.Schema<IWhatsAppPayment>(
  {
    paymentId:    { type: String, required: true, unique: true, index: true },
    userId:       { type: String, required: true, index: true },
    amount:       { type: Number, required: true },

    status: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
      index: true,
    },

    memo:          { type: String, required: true, index: true },
    walletAddress: { type: String, required: true },
    tokenMint:     { type: String, required: true },

    txSignature:   { type: String, unique: true, sparse: true },

    expiresAt: { type: Date, index: true },
    paidAt:    { type: Date },
  },
  { timestamps: true }
);

export const WhatsAppPayment = mongoose.model<IWhatsAppPayment>(
  "WhatsAppPayment",
  WhatsAppPaymentSchema
);
