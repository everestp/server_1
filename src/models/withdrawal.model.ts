import mongoose from "mongoose";

export enum WithdrawMode {
    ESEWA = "esewa",
    WALLET = "wallet"
}

export enum WithdrawStatus {
    PENDING = "pending",
    APPROVED = "approved",
    REJECTED = "rejected"
}

const WithdrawalSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    email: { type: String, required: true }, // 🔥 IMPORTANT

    amount: { type: Number, required: true },

    mode: {
        type: String,
        enum: Object.values(WithdrawMode),
        required: true
    },

    address: { type: String, required: true },

    status: {
        type: String,
        enum: Object.values(WithdrawStatus),
        default: WithdrawStatus.PENDING
    },

    reason: { type: String, default: null },

    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    processedAt: { type: Date, default: null },

    createdAt: { type: Date, default: Date.now }
});

export const Withdrawal = mongoose.model("Withdrawal", WithdrawalSchema);
