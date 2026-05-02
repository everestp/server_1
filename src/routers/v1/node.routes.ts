import { Router } from "express";
import { NodeController } from "../../controllers/node.controller";
import { NodeRepository } from "../../repositories/node.repository";
import { NodeService } from "../../service/node.service";
import { isAuthenticated } from "../../middlewares/isAuth.middleware";
import { NodeLatestRepository } from "../../repositories/nodeLatest.repository";
import { SolanaClient } from "../../blockchain/solana.client";

/**
 * Node routes
 */
const router = Router();

/**
 * Dependency injection
 */
const nodeRepo = new NodeRepository();
const nodeLatestRepo = new NodeLatestRepository();
const solana = new SolanaClient();

const service = new NodeService(nodeRepo, nodeLatestRepo, solana);
const controller = new NodeController(service);

/**
 * Create node
 */
router.post("/create", isAuthenticated, controller.createNode);

/**
 * Device ingestion (ESP32)
 */
router.post("/ingest", controller.ingest);

/**
 * User dashboard (all nodes + rewards)
 */
router.post("/dashboard", isAuthenticated, controller.dashboard);

/**
 * Node linking flow - request challenge
 */
router.post("/link/request", isAuthenticated, controller.requestLink);

/**
 * Node linking flow - verify & link
 */
router.post("/link/verify", isAuthenticated, controller.verifyLink);

/**
 * Claim reward (on-chain)
 */
router.post("/reward/claim", isAuthenticated, controller.claimReward);

export default router;
