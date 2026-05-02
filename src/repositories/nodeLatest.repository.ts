import { INodeLatest, NodeLatest } from "../models/nodelatest.model";
import { Node } from "../models/node.model";

const EARTH_RADIUS_KM = 6371;

/**
 * Node latest sensor data repository
 */
export class NodeLatestRepository {
  /**
   * Upsert sensor data and increment reward
   *
   * @param data - sensor payload
   * @param rewardIncrement - reward to add
   * @returns updated node latest document
   */
  async upsertNodeLatest(data: any, rewardIncrement: number) {
    const { nodeId } = data;

    return NodeLatest.findOneAndUpdate(
      { nodeId },
      {
        $set: {
          ...data,
          lastSeen: new Date(),
        },
        $inc: {
          reward: rewardIncrement,
        },
      },
      {
        upsert: true,
        new: true,
      }
    );
  }

  /**
   * Get all nodes for map view
   *
   * @returns list of node latest states
   */
  async getAllNodesForMap() {
    return NodeLatest.find(
      {},
      {
        nodeId: 1,
        ownerEmail: 1,
        temperature: 1,
        humidity: 1,
        pm25: 1,
        pm10: 1,
        aqi: 1,
        aqiLevel: 1,
        reward: 1,
        location: 1,
        lastSeen: 1,
        updatedAt: 1,
      }
    );
  }

  /**
   * Find latest data by nodeId
   *
   * @param nodeId - unique node id
   * @returns node latest document
   */
  async findNodeLatest(nodeId: string) {
    return NodeLatest.findOne({ nodeId });
  }

  /**
   * Mark node as syncing
   *
   * @param nodeId - unique node id
   */
  async markSyncing(nodeId: string) {
    return NodeLatest.updateOne(
      { nodeId },
      { $set: { syncing: true } }
    );
  }

  /**
   * Clear syncing flag
   *
   * @param nodeId - unique node id
   */
  async clearSyncFlag(nodeId: string) {
    return NodeLatest.updateOne(
      { nodeId },
      { $set: { syncing: false } }
    );
  }

  /**
   * Reset reward after on-chain sync
   *
   * @param nodeId - unique node id
   * @returns updated document
   */
  async resetReward(nodeId: string) {
    return NodeLatest.findOneAndUpdate(
      { nodeId },
      { $set: { reward: 0 } },
      { new: true }
    );
  }

  /**
   * Get user nodes with live data
   *
   * @param ownerEmail - owner email
   * @param ownerWallet - owner wallet address
   * @returns list of enriched node data
   */
  async getNodeByEmailAndWallet(
    ownerEmail: string,
    ownerWallet: string
  ) {
    const node = await Node.findOne({
      ownerEmail,
      ownerWallet,
      isLinked: true,
    });

    if (!node) return [];

    const liveNodes = await NodeLatest.find({ nodeId: node.nodeId });

    return liveNodes.map((n) => ({
      nodeId: n.nodeId,
      location: n.location || null,

      temperature: n.temperature,
      humidity: n.humidity,

      pm25: n.pm25,
      pm10: n.pm10,
      aqi: n.aqi,
      aqiLevel: n.aqiLevel,

      reward: n.reward,
      syncing: n.syncing,
      lastSeen: n.lastSeen,

      nodeAccount: node.nodeAccount,
      ownerWallet: node.ownerWallet,
      devicePublicKey: node.devicePublicKey,
    }));
  }

  /**
   * Update sensor data (fast path)
   *
   * @param nodeId - unique node id
   * @param data - sensor update payload
   * @returns updated document
   */
  async updateSensorData(nodeId: string, data: any) {
    return NodeLatest.findOneAndUpdate(
      { nodeId },
      {
        $set: {
          ...data,
          lastSeen: new Date(),
        },
      },
      { new: true }
    );
  }

  /**
   * Find nearby nodes within radius
   *
   * @param lat - latitude
   * @param lng - longitude
   * @param radiusKm - search radius in km
   * @returns nearby nodes
   */
  async findNearby(
    lat: number,
    lng: number,
    radiusKm: number
  ): Promise<INodeLatest[]> {
    const latDelta =
      (radiusKm / EARTH_RADIUS_KM) * (180 / Math.PI);
    const lngDelta =
      latDelta / Math.cos((lat * Math.PI) / 180);

    const candidates = await NodeLatest.find({
      "location.lat": {
        $gte: lat - latDelta,
        $lte: lat + latDelta,
      },
      "location.lng": {
        $gte: lng - lngDelta,
        $lte: lng + lngDelta,
      },
    }).lean();

    return candidates
      .filter((n) => {
        if (!n.location?.lat || !n.location?.lng) return false;
        return (
          this.haversineKm(
            lat,
            lng,
            n.location.lat,
            n.location.lng
          ) <= radiusKm
        );
      })
      .sort((a, b) => {
        const da = this.haversineKm(
          lat,
          lng,
          a.location!.lat,
          a.location!.lng
        );
        const db = this.haversineKm(
          lat,
          lng,
          b.location!.lat,
          b.location!.lng
        );
        return da - db;
      }) as INodeLatest[];
  }

  /**
   * Find node latest by id
   *
   * @param nodeId - unique node id
   * @returns node latest document
   */
  async findByNodeId(
    nodeId: string
  ): Promise<INodeLatest | null> {
    return NodeLatest.findOne({ nodeId });
  }

  /**
   * Haversine distance (km)
   *
   * @param lat1 - latitude 1
   * @param lng1 - longitude 1
   * @param lat2 - latitude 2
   * @param lng2 - longitude 2
   * @returns distance in km
   */
  private haversineKm(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const toRad = (d: number) => (d * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) ** 2;

    return (
      EARTH_RADIUS_KM *
      2 *
      Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    );
  }
}
