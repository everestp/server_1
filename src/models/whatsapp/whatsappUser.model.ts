import mongoose, { Document } from "mongoose";

/**
 * WhatsApp user document — mirrors ITelegramUser 1-to-1
 */
export interface IWhatsAppUser extends Document {
  whatsappId: string;       // E.164 phone number without suffix
  username?: string;
  location?: { lat: number; lng: number };
  isPremium: boolean;
  remainingRequests: number;
  totalMessagesUsed: number;
  dailyUsage: number;
  lastDailyReset?: Date;
}

const WhatsAppUserSchema = new mongoose.Schema<IWhatsAppUser>(
  {
    whatsappId: { type: String, required: true, unique: true, index: true },
    username: String,

    location: {
      lat: Number,
      lng: Number,
    },

    isPremium: { type: Boolean, default: false },

    remainingRequests: { type: Number, default: 0 },
    totalMessagesUsed: { type: Number, default: 0 },
    dailyUsage: { type: Number, default: 0 },

    lastDailyReset: Date,
  },
  { timestamps: true }
);

export const WhatsAppUser = mongoose.model<IWhatsAppUser>(
  "WhatsAppUser",
  WhatsAppUserSchema
);
