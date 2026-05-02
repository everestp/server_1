import { Request, Response, NextFunction } from "express";
import { WithdrawService } from "../service/withdraw.service";


export class WithdrawController {

    constructor(private service: WithdrawService) {}

    request = async (req: any, res: Response, next: NextFunction) => {
        try {
            const data = await this.service.request(req.user, req.body);
            res.json({ success: true, data });
        } catch (e) {
            next(e);
        }
    };

    approve = async (req: any, res: Response, next: NextFunction) => {
        try {
            const data = await this.service.approve(req.params.id, req.user.userId);
            res.json({ success: true, data });
        } catch (e) {
            next(e);
        }
    };

    reject = async (req: any, res: Response, next: NextFunction) => {
        try {
            const data = await this.service.reject(
                req.params.id,
                req.user.userId,
                req.body.reason
            );

            res.json({ success: true, data });
        } catch (e) {
            next(e);
        }
    };

    getAll = async (req: Request, res: Response) => {
        const data = await this.service.getAll();
        res.json({ success: true, data });
    };

    getPending = async (req: Request, res: Response) => {
        const data = await this.service.getPending();
        res.json({ success: true, data });
    };
}
