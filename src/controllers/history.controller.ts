import { Request, Response } from "express";
import { HistoryService } from "../service/history.service";

export class HistoryController {
  private historyService: HistoryService;

  constructor() {
    this.historyService = new HistoryService();
  }

  getWeeklyHistory = async (
    req: Request,
    res: Response
  ) => {
    try {
      const { nodeId } = req.params;

      const history =
        await this.historyService.getWeeklyHistory(
          nodeId
        );

       res.status(200).json({
        success: true,
        history,
      });
    } catch (error) {
      console.error(error);

       res.status(500).json({
        success: false,
        message: "Failed to fetch history",
      });
    }
  };
}
