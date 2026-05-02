import { Router } from "express";
import { WithdrawController } from "../../controllers/withdraw.controller";
import { isAuthenticated } from "../../middlewares/isAuth.middleware";
import { WithdrawRepository } from "../../repositories/withdraw.repository";
import { WithdrawService } from "../../service/withdraw.service";
import { validateRequestBody } from "../../validators";
import { createWithdrawDTO, rejectWithdrawDTO } from "../../validators/withdraw.validator";



const withDrawRouter = Router();


const repo = new WithdrawRepository();
const service = new WithdrawService(repo);
const controller = new WithdrawController(service);

// USER
withDrawRouter.post(
    "/request",
    isAuthenticated,
    validateRequestBody(createWithdrawDTO),
    controller.request
);

// ADMIN
withDrawRouter.get("/pending", isAuthenticated, controller.getPending);
withDrawRouter.get("/all", isAuthenticated, controller.getAll);

withDrawRouter.patch("/approve/:id", isAuthenticated, controller.approve);

withDrawRouter.patch(
    "/reject/:id",
    isAuthenticated,
    validateRequestBody(rejectWithdrawDTO),
    controller.reject
);

export default withDrawRouter;
