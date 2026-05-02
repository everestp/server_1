import express from "express";
import { pingHandler } from "../../controllers/ping.controller";
import { validateRequestBody } from "../../validators";
import { pingSchema } from "../../validators/ping.validator";

/**
 * Ping routes
 */
const pingRouter = express.Router();

/**
 * Ping endpoint
 */
pingRouter.get("/", validateRequestBody(pingSchema), pingHandler);

/**
 * Health check endpoint
 */
pingRouter.get("/health", (_req, res) => {
  res.status(200).send("OK");
});

export default pingRouter;
