import * as anchor from "@coral-xyz/anchor";
import BN from "bn.js";
import bs58 from "bs58";
import crypto from "crypto";
import nacl from "tweetnacl";

import { SolanaClient } from "../blockchain/solana.client";
import logger from "../config/logger.config";
import { SensorHistory } from "../models/sensorhistory.model";
import { NodeRepository } from "../repositories/node.repository";
import { NodeLatestRepository } from "../repositories/nodeLatest.repository";
import { getIO } from "../socket";
import { serverConfig } from "../config";
import { Keypair } from "@solana/web3.js";

export class NodeService {
  constructor(
    private nodeRepo: NodeRepository,
    private nodeLatestRepo: NodeLatestRepository,
    private solana: SolanaClient
  ) {}

  // =====================================================
  // TOKEN UTILS (VERY IMPORTANT)
  // =====================================================
  private BREEZO_DECIMALS = 9;
  private BREEZO_FACTOR = 10 ** this.BREEZO_DECIMALS;

  private toBaseUnits(amount: number): BN {
    return new BN(Math.round(amount * this.BREEZO_FACTOR));
  }

  // =====================================================
  // CREATE NODE
  // =====================================================
  async createNode(data: any) {
    const existing = await this.nodeRepo.findByNodeId(data.nodeId);
    if (existing) throw new Error("Node already exists");

    const nodeAccount = await this.createNodeOnChain(
      data.devicePublicKey,
      data.ownerWallet
    );

    const node = await this.nodeRepo.createNode(
      data.nodeId,
      data.devicePublicKey,
      data.ownerEmail,
      data.ownerWallet
    );

    await this.nodeRepo.updateNodeAccount(data.nodeId, nodeAccount);

    return { node, nodeAccount };
  }

  // =====================================================
  // CREATE NODE ON CHAIN
  // =====================================================
  async createNodeOnChain(devicePublicKey: string, wallet: string) {
    const program = this.solana.program as any;

    const ownerPubkey = new anchor.web3.PublicKey(wallet);
    const devicePubkey = new anchor.web3.PublicKey(devicePublicKey);

    const backendKeypair = Keypair.fromSecretKey(
      bs58.decode(serverConfig.BACKEND_AUTHORITY_PRIVATE_KEY)
    );

    const [nodeAccountPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("node"),
        ownerPubkey.toBuffer(),
        devicePubkey.toBuffer(),
      ],
      program.programId
    );

    const tx = await program.methods
      .initNode()
      .accounts({
        nodeAccount: nodeAccountPDA,
        authority: backendKeypair.publicKey,
        owner: ownerPubkey,
        devicePublicKey: devicePubkey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([backendKeypair])
      .rpc();

    logger.info("Node created TX:", tx);
    return nodeAccountPDA.toString();
  }

  // =====================================================
  // INGEST SENSOR DATA (FIXED)
  // =====================================================
  async ingestData(data: any) {
    const { nodeId, payload } = data;

    if (!nodeId || !payload) throw new Error("Missing fields");

    const node = await this.nodeRepo.findByNodeId(nodeId);
    if (!node || !node.isLinked) throw new Error("Node not linked");

    const reward = this.calculateReward(payload.pm25); // UI value

    const nodeLatest = await this.nodeLatestRepo.upsertNodeLatest(
      {
        nodeId,
        ownerEmail: node.ownerEmail,
        ...payload,
      },
      reward
    );

    // ✅ Emit for frontend (NO CHANGE NEEDED)
    getIO().emit("node:update", {
      nodeId,
      reward,
      ...payload,
    });

    SensorHistory.create({
      nodeId,
      ownerEmail: node.ownerEmail,
      ...payload,
    }).catch(console.error);

    // 🚀 AUTO SYNC (10 BERZ threshold)
    if (
      Number(nodeLatest.reward) >= 10 &&
      !nodeLatest.syncing &&
      node.nodeAccount
    ) {
      await this.nodeLatestRepo.markSyncing(nodeId);

      const rewardBase = this.toBaseUnits(Number(nodeLatest.reward));

      this.syncToSolanaAsync(
        rewardBase,
        nodeLatest.nodeId,
        node.ownerWallet!,
        node.nodeAccount
      );
    }

    return nodeLatest;
  }

  // =====================================================
  // SYNC TO SOLANA (FIXED)
  // =====================================================
  async syncToSolana(
    rewardBase: BN,
    nodeId: string,
    _wallet: string,
    nodeAccount: string
  ) {
    const program = this.solana.program as any;

    await program.methods
      .addReward(rewardBase)
      .accounts({
        nodeAccount: new anchor.web3.PublicKey(nodeAccount),
        backend: this.solana.wallet.publicKey,
      })
      .rpc();

    logger.info(
      `Synced ${rewardBase.toString()} base units for node ${nodeId}`
    );
  }

  async syncToSolanaAsync(
    rewardBase: BN,
    nodeId: string,
    wallet: string,
    nodeAccount: string
  ) {
    try {
      await this.syncToSolana(rewardBase, nodeId, wallet, nodeAccount);

      await this.nodeLatestRepo.resetReward(nodeId);
    } catch (e) {
      logger.error(e);
    } finally {
      await this.nodeLatestRepo.clearSyncFlag(nodeId);
    }
  }

  // =====================================================
  // DASHBOARD
  // =====================================================
  async getUserDashboard(email: string, wallet: string) {
    return this.nodeLatestRepo.getNodeByEmailAndWallet(email, wallet);
  }

  // =====================================================
  // CLAIM PREP
  // =====================================================
  async claimReward(nodeId: string, user: any) {
    const node = await this.nodeRepo.findByNodeId(nodeId);

    if (!node || node.ownerEmail !== user.email || !node.nodeAccount) {
      throw new Error("Unauthorized");
    }

    const nodeLatest = await this.nodeLatestRepo.findNodeLatest(nodeId);

    if (!nodeLatest || Number(nodeLatest.reward) <= 0) {
      throw new Error("No reward");
    }

    return {
      nodeAccount: node.nodeAccount,
      ownerWallet: node.ownerWallet,
      reward: nodeLatest.reward, // UI readable
      programId: this.solana.program.programId.toString(),
    };
  }

  // =====================================================
  // DEVICE LINKING
  // =====================================================
  async requestLink(devicePublicKey: string) {
    const node = await this.nodeRepo.findByPublicKey(devicePublicKey);
    if (!node) throw new Error("Device not found");

    const challenge = crypto.randomBytes(32).toString("hex");

    await this.nodeRepo.setChallenge(devicePublicKey, challenge);

    return { devicePublicKey, challenge };
  }

  async verifyLink(data: any) {
    const node = await this.nodeRepo.findByPublicKey(data.devicePublicKey);
    if (!node || !node.linkChallenge) throw new Error("Invalid link");

    const ok = nacl.sign.detached.verify(
      new TextEncoder().encode(node.linkChallenge),
      bs58.decode(data.signature),
      bs58.decode(data.devicePublicKey)
    );

    if (!ok) throw new Error("Invalid signature");

    const nodeAccount = await this.createNodeOnChain(
      data.devicePublicKey,
      data.wallet
    );

    return this.nodeRepo.linkNode(
      data.devicePublicKey,
      data.email,
      data.wallet,
      nodeAccount
    );
  }

  // =====================================================
  // REWARD LOGIC
  // =====================================================
  calculateReward(pm25: number): number {
    if (pm25 < 50) return 2;
    if (pm25 < 100) return 1;
    return 0.5;
  }
}
