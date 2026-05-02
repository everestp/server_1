import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { BadRequestError } from "../utils/errors/app.error";
import { serverConfig } from "../config";

/**
 * Extend Express Request type to include user
 */
export interface AuthRequest extends Request {
    user?: any;
}

/**
 * AUTH MIDDLEWARE
 * Validates JWT token and attaches user payload to request
 */
export const isAuthenticated = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            throw new BadRequestError("Authorization token missing");
        }

        const token = authHeader.split(" ")[1];

        const JWT_SECRET = serverConfig.JWT_SECRET;

        if (!JWT_SECRET) {
            throw new BadRequestError("JWT secret not configured");
        }

        // verify token
        const decoded = jwt.verify(token, JWT_SECRET);

        if (!decoded) {
            throw new BadRequestError("Invalid token");
        }

        // attach user to request
        req.user = decoded;

        next();

    } catch (error: any) {
        next(new BadRequestError(error.message || "Unauthorized"));
    }
};
