import { Router } from "express";
import { HistoryController } from "../../controllers/history.controller";



const router = Router();

const controller = new HistoryController();

/**
 * GET WEEKLY HISTORY
 */
router.get(
  "/weekly/:nodeId",
  controller.getWeeklyHistory
);

export default router;
