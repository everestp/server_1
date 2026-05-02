import mongoose, { Document } from "mongoose";

/**
 * Telegram user document
 */
export interface ITelegramUser extends Document {
  telegramId: string;
  username?: string;
  location?: { lat: number; lng: number };
  isPremium: boolean;
  remainingRequests: number;
  totalMessagesUsed: number;
  dailyUsage: number;
  lastDailyReset?: Date;
}

const TelegramUserSchema = new mongoose.Schema<ITelegramUser>(
  {
    telegramId: { type: String, required: true, unique: true, index: true },
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

export const TelegramUser = mongoose.model<ITelegramUser>(
  "TelegramUser",
  TelegramUserSchema
);
