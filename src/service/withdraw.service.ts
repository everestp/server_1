
import { NodeLatest } from "../models/nodelatest.model";
import { IWithdrawRepository } from "../repositories/withdraw.repository";
import { BadRequestError } from "../utils/errors/app.error";

export class WithdrawService {

    constructor(private repo: IWithdrawRepository) {}

    // USER REQUEST
    async request(user: any, data: any) {

        const node = await NodeLatest.findOne({
            ownerEmail: user.email
        });

        if (!node) throw new BadRequestError("Node not found");

        if (node.reward < data.amount) {
            throw new BadRequestError("Insufficient balance");
        }

        const existing = await this.repo.findPendingByUser(user.userId);

        if (existing) {
            throw new BadRequestError("Pending withdrawal exists");
        }

        // 🔥 LOCK BALANCE
        node.reward -= data.amount;
        await node.save();

        return this.repo.create({
            userId: user.userId,
            email: user.email,
            ...data
        });
    }

    // ADMIN APPROVE
    async approve(id: string, adminId: string) {
        const req = await this.repo.findById(id);

        if (!req) throw new BadRequestError("Not found");
        if (req.status !== "pending") throw new BadRequestError("Already processed");

        return this.repo.update(id, {
            status: "approved",
            processedBy: adminId,
            processedAt: new Date()
        });
    }

    // ADMIN REJECT
    async reject(id: string, adminId: string, reason: string) {
        const req = await this.repo.findById(id);

        if (!req) throw new BadRequestError("Not found");
        if (req.status !== "pending") throw new BadRequestError("Already processed");

        //  REFUND
        const node = await NodeLatest.findOne({
            ownerEmail: req.email
        });

        if (node) {
            node.reward += req.amount;
            await node.save();
        }

        return this.repo.update(id, {
            status: "rejected",
            reason,
            processedBy: adminId,
            processedAt: new Date()
        });
    }

    getAll() {
        return this.repo.getAll();
    }

    getPending() {
        return this.repo.getPending();
    }
}
