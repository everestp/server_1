import { SensorRepository } from "../repositories/sensor.repository";
import { distanceKm } from "../utils/geo.utils";

/**
 * ===============================
 * DTOs (Query Types)
 * ===============================
 */



/**
 * ===============================
 * Service Interface
 * ===============================
 */

export interface IWeatherService {
  getCurrent(nodeId: string): Promise<any>;

  getNearby(
    lat: number,
    lng: number
  ): Promise<{
    nearest: any;
    distanceKm: number;
  }>;

  getHistory(
    nodeId: string,
    from: Date,
    to: Date
  ): Promise<any[]>;
}

/**
 * ===============================
 * Service Implementation
 * ===============================
 */

export class WeatherService implements IWeatherService {
  constructor(private readonly repo: SensorRepository) {}

  /**
   * Get latest data for a node
   */
  async getCurrent(nodeId: string) {
    const data = await this.repo.getLatestByNode(nodeId);

    if (!data) {
      throw new Error("Node not found");
    }

    return data;
  }

  /**
   * Get nearest sensor based on lat/lng
   */
  async getNearby(lat: number, lng: number) {
    const nodes = await this.repo.getAllLatestPerNode();

    let nearest = null;
    let minDistance = Infinity;

    for (const node of nodes) {
      const d = distanceKm(
        lat,
        lng,
        node.location.lat,
        node.location.lng
      );

      if (d < minDistance) {
        minDistance = d;
        nearest = node;
      }
    }

    return {
      nearest,
      distanceKm: minDistance,
    };
  }

  /**
   * Get time-series data
   */
  async getHistory(
    nodeId: string,
    from: Date,
    to: Date
  ) {
    return this.repo.getHistory(nodeId, from, to);
  }
}
