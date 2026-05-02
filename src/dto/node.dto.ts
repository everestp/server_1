export interface NodeDataDTO {
    nodeId: string;
    ownerEmail: string;

    temperature: number;
    humidity?: number;

    pm25: number;
    pm10?: number;

    aqi: number;
    aqiLevel?: string;

    location?: {
        lat: number;
        lng: number;
    };
}
