import { Request, Response, NextFunction } from "express";
import { IAuthService } from "../service/auth.service";


export interface IAuthController {
    signUp(req: Request, res: Response, next: NextFunction): Promise<void>;
    login(req: Request, res: Response, next: NextFunction): Promise<void>;

}




export class AuthController {
    constructor(private authService: IAuthService) {}

    signUp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const result = await this.authService.signUp(req.body);

            res.status(201).json({
                success: true,
                message: "User registered successfully",
                data: result,
            });
        } catch (error) {
            next(error);
        }
    };

    login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const result = await this.authService.login(req.body);

            res.status(200).json({
                success: true,
                message: "Login successful",
                data: result,
            });
        } catch (error) {
            next(error);
        }
    };
}

