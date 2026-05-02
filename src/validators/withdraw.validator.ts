import { z } from "zod";

export const createWithdrawDTO = z.object({
    amount: z.number().min(0.0001),
    mode: z.enum(["esewa", "wallet"]),
    address: z.string().min(3)
});

export const rejectWithdrawDTO = z.object({
    reason: z.string().min(3)
});
