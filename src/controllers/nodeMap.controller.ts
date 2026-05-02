import { Request, Response, NextFunction } from "express";
import { NodeMapService } from "../service/nodeMap.service";


export class NodeMapController {

    constructor(private nodeMapService: NodeMapService) {}

    /**
     * PUBLIC MAP API 
     */
    getMapNodes = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await this.nodeMapService.getMapNodes();

             res.status(200).json({
                success: true,
                count: data.length,
                data
            });
        } catch (error) {
            next(error);
        }
    };
}
