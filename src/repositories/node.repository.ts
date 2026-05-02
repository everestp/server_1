import { Node } from "../models/node.model";

/**
 * Node repository (device + blockchain node management)
 */
export class NodeRepository {
  /**
   * Find node by nodeId
   *
   * @param nodeId - unique node identifier
   * @returns node document or null
   */
  async findByNodeId(nodeId: string) {
    return Node.findOne({ nodeId });
  }

  /**
   * Find node by device public key
   *
   * @param publicKey - device public key
   * @returns node document or null
   */
  async findByPublicKey(publicKey: string) {
    return Node.findOne({ devicePublicKey: publicKey });
  }

  /**
   * Create new node
   *
   * @param nodeId - unique node id
   * @param devicePublicKey - device public key
   * @param ownerEmail - owner email
   * @param ownerWallet - owner wallet address
   * @returns created node document
   */
  async createNode(
    nodeId: string,
    devicePublicKey: string,
    ownerEmail: string,
    ownerWallet: string
  ) {
    return Node.create({
      nodeId,
      devicePublicKey,
      ownerEmail,
      ownerWallet,
      isLinked: false,
    });
  }

  /**
   * Upsert node basic info
   *
   * @param nodeId - unique node id
   * @param ownerEmail - owner email
   * @returns updated or created node
   */
  async upsertNode(nodeId: string, ownerEmail: string) {
    return Node.findOneAndUpdate(
      { nodeId },
      { ownerEmail },
      { upsert: true, new: true }
    );
  }

  /**
   * Set linking challenge
   *
   * @param publicKey - device public key
   * @param challenge - verification challenge
   * @returns updated node
   */
  async setChallenge(publicKey: string, challenge: string) {
    return Node.findOneAndUpdate(
      { devicePublicKey: publicKey },
      { linkChallenge: challenge },
      { new: true }
    );
  }

  /**
   * Link node to user (final step)
   *
   * @param publicKey - device public key
   * @param email - owner email
   * @param wallet - owner wallet address
   * @param nodeAccount - blockchain node account (PDA)
   * @returns updated node
   */
  async linkNode(
    publicKey: string,
    email: string,
    wallet: string,
    nodeAccount: string
  ) {
    return Node.findOneAndUpdate(
      { devicePublicKey: publicKey },
      {
        ownerEmail: email,
        ownerWallet: wallet,
        nodeAccount,
        isLinked: true,
        linkChallenge: null,
      },
      { new: true }
    );
  }

  /**
   * Get nodes by owner email
   *
   * @param email - owner email
   * @returns list of nodes
   */
  async getNodesByEmail(email: string) {
    return Node.find({ ownerEmail: email });
  }

  /**
   * Update node account (PDA)
   *
   * @param nodeId - unique node id
   * @param nodeAccount - blockchain account address
   * @returns updated node
   */
  async updateNodeAccount(nodeId: string, nodeAccount: string) {
    return Node.findOneAndUpdate(
      { nodeId },
      { nodeAccount },
      { new: true }
    );
  }
}
