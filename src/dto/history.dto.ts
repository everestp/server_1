export interface WeekHistoryDTO {
  label: string;
  fullLabel: string;

  aqi: number;
  pm25: number;
  pm10: number;

  temperature: number;
  humidity: number;

  mq135: number;

  info: {
    label: string;
    color: string;
  };
}
