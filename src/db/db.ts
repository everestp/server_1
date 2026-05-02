import mongoose from "mongoose";
import logger from "../config/logger.config";
import { InternalServerError } from "../utils/errors/app.error";
import { serverConfig } from "../config";

export const connectDB = async () => {
    try {
        const MONGO_URI = serverConfig.MONGO_URI;

        if (!MONGO_URI) {
            throw new InternalServerError("MongoDB URI is missing");
        }

        await mongoose.connect(MONGO_URI);

        logger.info("✅ MongoDB connected successfully");
    } catch (error) {
        logger.error(" MongoDB connection failed");

        throw new InternalServerError("Database connection failed");
    }
};
