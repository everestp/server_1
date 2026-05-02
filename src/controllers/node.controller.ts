import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/isAuth.middleware";
import { NodeService } from "../service/node.service";

export class NodeController {
  constructor(private nodeService: NodeService) {}

  // =====================================================
  // CREATE NODE
  // =====================================================
  createNode = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { nodeId, devicePublicKey, ownerEmail, ownerWallet } = req.body;

      if (!nodeId || !devicePublicKey || !ownerEmail || !ownerWallet) {
        res.status(400).json({
          success: false,
          message: "Missing required fields",
        });
        return;
      }

      const result = await this.nodeService.createNode({
        nodeId,
        devicePublicKey,
        ownerEmail,
        ownerWallet,
      });

      res.status(201).json({
        success: true,
        message: "Node created successfully",
        data: result,
      });
      return;
    } catch (error) {
      next(error);
    }
  };

  // =====================================================
  // INGEST DATA
  // =====================================================
  ingest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.nodeService.ingestData(req.body);

      res.status(200).json({
        success: true,
        message: "Data ingested successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // =====================================================
  // DASHBOARD
  // =====================================================
  dashboard = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const email = req.user?.email;
      const wallet = req.body.wallet;

      if (!email) {
        res.status(401).json({
          success: false,
          message: "Unauthorized: missing user",
        });
        return;
      }

      if (!wallet) {
        res.status(400).json({
          success: false,
          message: "Wallet required",
        });
        return;
      }

      const result = await this.nodeService.getUserDashboard(email, wallet);

      res.json({
        success: true,
        data: result || [],
      });
    } catch (error) {
      next(error);
    }
  };

  // =====================================================
  // REQUEST LINK
  // =====================================================
  requestLink = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { devicePublicKey } = req.body;

      if (!devicePublicKey) {
        res.status(400).json({
          success: false,
          message: "devicePublicKey required",
        });
        return;
      }

      const result =
        await this.nodeService.requestLink(devicePublicKey);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // =====================================================
  // VERIFY LINK
  // =====================================================
  verifyLink = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const user = req.user;

      if (!user) {
        res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
        return;
      }

      const { devicePublicKey, signature } = req.body;

      if (!devicePublicKey || !signature) {
        res.status(400).json({
          success: false,
          message: "Missing fields",
        });
        return;
      }

      const result = await this.nodeService.verifyLink({
        devicePublicKey,
        signature,
        email: user.email,
        wallet: user.wallet,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // =====================================================
  // CLAIM REWARD
  // =====================================================
  claimReward = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { nodeId } = req.body;
      const user = req.user;

      if (!user) {
        res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
        return;
      }

      if (!nodeId) {
        res.status(400).json({
          success: false,
          message: "nodeId required",
        });
        return;
      }

      const result = await this.nodeService.claimReward(nodeId, user);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
