import { Withdrawal } from "../models/withdrawal.model";
export interface IWithdrawRepository {
    create(data: any): Promise<any>;
    findById(id: string): Promise<any>;
    findPendingByUser(userId: string): Promise<any>;
    getAll(): Promise<any>;
    getPending(): Promise<any>;
    update(id: string, data: any): Promise<any>;
}


export class WithdrawRepository implements IWithdrawRepository {

    create(data: any) {
        return Withdrawal.create(data);
    }

    findById(id: string) {
        return Withdrawal.findById(id);
    }

    findPendingByUser(userId: string) {
        return Withdrawal.findOne({
            userId,
            status: "pending"
        });
    }

    getAll() {
        return Withdrawal.find().sort({ createdAt: -1 });
    }

    getPending() {
        return Withdrawal.find({ status: "pending" }).sort({ createdAt: -1 });
    }

    update(id: string, data: any) {
        return Withdrawal.findByIdAndUpdate(id, data, { new: true });
    }
}
