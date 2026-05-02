import mongoose, { Document } from "mongoose";

/**
 * LIVE NODE STATE (DEPIN STREAM)
 */
export interface INodeLatest extends Document {
    nodeId: string;
    ownerEmail?: string;

    temperature?: number;
    humidity?: number;

    pm25?: number;
    pm10?: number;

    aqi?: number;
    aqiLevel?: string;

    reward: number;
    syncing: boolean;

    location?: {
        lat: number;
        lng: number;
    };

    lastSeen?: Date;
}

const NodeLatestSchema = new mongoose.Schema<INodeLatest>({

    nodeId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    ownerEmail: {
        type: String,
        index: true
    },

    /* SENSOR DATA */
    temperature: Number,
    humidity: Number,

    pm25: Number,
    pm10: Number,

    aqi: Number,
    aqiLevel: String,

    /* REWARD SYSTEM */
    reward: {
        type: Number,
        default: 0
    },

    syncing: {
        type: Boolean,
        default: false
    },

    /* LOCATION */
    location: {
        lat: Number,
        lng: Number
    },

    /* HEALTH TRACKING */
    lastSeen: {
        type: Date,
        default: Date.now
    }

}, {
    timestamps: true
});

export const NodeLatest = mongoose.model<INodeLatest>(
    "NodeLatest",
    NodeLatestSchema
);
