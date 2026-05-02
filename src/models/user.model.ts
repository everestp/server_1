import mongoose, { Document } from "mongoose";

export interface IUser extends Document {
  _id: any;
  fullName: string;
  email: string;
  password: string;
  role: "User" | "Node" | "Admin";
  wallet?: string;

  // ✅ CREDIT SYSTEM
  credits: number;
  usedCredits: number;
}

const userSchema = new mongoose.Schema<IUser>(
  {
    fullName: {
      type: String,
      trim: true,
      required: [true, "fullname field is missing"],
    },
    email: {
      type: String,
      unique: true,
      trim: true,
      required: [true, "email field is missing"],
    },
    password: {
      type: String,
      required: [true, "password field is missing"],
    },
    role: {
      type: String,
      enum: ["User", "Node", "Admin"],
      default: "User",
    },
    wallet: {
      type: String,
      default: null,
    },

    // 🔥 NEW FIELDS
    credits: {
      type: Number,
      default: 0,
    },

    usedCredits: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", userSchema);
