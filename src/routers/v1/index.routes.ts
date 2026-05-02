import express from "express";
import pingRouter from "./ping.routes";
import authRouter from "./auth.routes";
import nodeRouter from "./node.routes";
import nodeMapRouter from "./nodeMap.routes";
import withdrawRouter from "./withdraw.routes";

/**
 * API v1 router
 */
const v1Router = express.Router();

// core routes
v1Router.use("/ping", pingRouter);
v1Router.use("/auth", authRouter);
v1Router.use("/node", nodeRouter);
v1Router.use("/map", nodeMapRouter);
v1Router.use("/withdraw", withdrawRouter);

export default v1Router;
