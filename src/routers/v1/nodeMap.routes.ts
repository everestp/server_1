import { Router } from "express";
import { NodeLatestRepository } from "../../repositories/nodeLatest.repository";
import { NodeMapService } from "../../service/nodeMap.service";
import { NodeMapController } from "../../controllers/nodeMap.controller";

/**
 * Node map routes
 */
const nodeMapRouter = Router();

/**
 * Dependency injection
 */
const nodeRepo = new NodeLatestRepository();
const nodeService = new NodeMapService(nodeRepo);
const nodeController = new NodeMapController(nodeService);

/**
 * Get all nodes for map view
 */
nodeMapRouter.get("/nodes", nodeController.getMapNodes);

export default nodeMapRouter;
