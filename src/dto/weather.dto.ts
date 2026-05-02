export interface CurrentWeatherQueryDTO {
  nodeId: string;
}


export interface NearbyWeatherQueryDTO {
  lat: number;
  lng: number;
}

export interface HistoryQueryDTO {
  nodeId: string;
  from: Date;
  to: Date;
}
