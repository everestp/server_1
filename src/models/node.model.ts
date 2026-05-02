import mongoose, { Document } from "mongoose";

/**
 *  DEVICE REGISTRY (STATIC DATA)
 * - Identity of IoT device
 * - Ownership + wallet binding
 * - Link to Solana account
 */
export interface INode extends Document {
    nodeId: string;
    devicePublicKey: string;

    ownerEmail?: string;
    ownerWallet?: string;

    nodeAccount?: string; // Solana PDA (ON-CHAIN reference)

    isLinked: boolean;
    linkChallenge?: string;
}

const NodeSchema = new mongoose.Schema<INode>({

    nodeId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    devicePublicKey: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    ownerEmail: {
        type: String,
        index: true
    },

    ownerWallet: {
        type: String,
        index: true,
        required:true
    },

    /**
     * This is the Solana Program Account (PDA)
     * used for reward tracking & verification
     */
    nodeAccount: {
        type: String,
        default: null
    },

    isLinked: {
        type: Boolean,
        default: false
    },

    linkChallenge: {
        type: String,
        default: null
    }

}, {
    timestamps: true
});

export const Node = mongoose.model<INode>("Node", NodeSchema);
