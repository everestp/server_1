import { Router } from "express";
import { AuthController } from "../../controllers/auth.controller";
import { UserRepository } from "../../repositories/user.repository";
import { AuthService } from "../../service/auth.service";
import { validateRequestBody } from "../../validators";
import {
  signUpSchema,
  loginSchema,
} from "../../validators/auth.validator";

/**
 * Auth routes
 */
const authRouter = Router();

// dependencies
const userRepository = new UserRepository();
const authService = new AuthService(userRepository);
const authController = new AuthController(authService);

/**
 * Signup user
 */
authRouter.post(
  "/signup",
  validateRequestBody(signUpSchema),
  authController.signUp
);

/**
 * Login user
 */
authRouter.post(
  "/login",
  validateRequestBody(loginSchema),
  authController.login
);

export default authRouter;
