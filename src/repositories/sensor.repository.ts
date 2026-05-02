import { SensorHistory } from "../models/sensorhistory.model";

/**
 * Sensor history repository
 */
export class SensorRepository {
  /**
   * Get latest sensor record for a node
   *
   * @param nodeId - node identifier
   * @returns latest sensor record
   */
  async getLatestByNode(nodeId: string) {
    return SensorHistory.findOne({ nodeId })
      .sort({ timestamp: -1 })
      .lean();
  }

  /**
   * Get sensor history within time range
   *
   * @param nodeId - node identifier
   * @param from - start date
   * @param to - end date
   * @returns list of sensor records
   */
  async getHistory(nodeId: string, from: Date, to: Date) {
    return SensorHistory.find({
      nodeId,
      timestamp: { $gte: from, $lte: to },
    })
      .sort({ timestamp: 1 })
      .lean();
  }

  /**
   * Get latest record for all nodes
   *
   * @returns latest sensor record per node
   */
  async getAllLatestPerNode() {
    return SensorHistory.aggregate([
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: "$nodeId",
          latest: { $first: "$$ROOT" },
        },
      },
      {
        $replaceRoot: { newRoot: "$latest" },
      },
    ]);
  }
}
