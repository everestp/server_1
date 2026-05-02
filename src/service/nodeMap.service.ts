import { NodeLatestRepository } from "../repositories/nodeLatest.repository";

export class NodeMapService {

    constructor(private nodeLatestRepo: NodeLatestRepository) {}

    /**
     * Format data for Leaflet/Mapbox
     */
    async getMapNodes() {
        const nodes = await this.nodeLatestRepo.getAllNodesForMap();

        // transform for frontend map usage
        return nodes.map(node => ({
            nodeId: node.nodeId,
            lat: node.location?.lat,
            lng: node.location?.lng,
            aqi: node.aqi,
            aqiLevel: node.aqiLevel,
            temperature: node.temperature,
            pm25: node.pm25,
            pm10: node.pm10,
            reward: node.reward,
        }));
    }
 async getNearbyNodes(lat: number, lng: number, radius = 5000) {
    return this.nodeLatestRepo.findNearby(lat, lng, radius);
  }


}
