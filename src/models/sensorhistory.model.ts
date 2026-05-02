import mongoose from "mongoose";

const SensorHistorySchema = new mongoose.Schema(
  {
    nodeId: {
      type: String,
      required: true,
      index: true, // 🔥 fast queries
    },

    ownerEmail: {
      type: String,
      index: true,
    },

    temperature: Number,
    humidity: Number,

    pm25: Number,
    pm10: Number,

    aqi: Number,
    aqiLevel: String,

    location: {
      lat: Number,
      lng: Number,
    },

    timestamp: {
      type: Date,
      default: Date.now,
      index: true, // critical for time queries
    },
  },
  {
    timestamps: true,
  }
);

export const SensorHistory = mongoose.model(
  "SensorHistory",
  SensorHistorySchema
);
