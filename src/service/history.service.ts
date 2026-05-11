import { HistoryRepository } from "../repositories/history.repository";
import { getAQIInfo } from "../utils/aqi.utils";


export class HistoryService {
  private historyRepository: HistoryRepository;

  constructor() {
    this.historyRepository = new HistoryRepository();
  }

 async getWeeklyHistory(nodeId: string) {
  const rows =
    await this.historyRepository.getWeeklyHistory(nodeId);

  const map = new Map();

  // convert DB data → map
  rows.forEach((item: any) => {
    const date = new Date(
      item._id.year,
      item._id.month - 1,
      item._id.day
    );

    const key = date.toISOString().split("T")[0];

    map.set(key, item);
  });

  const result = [];

  // ALWAYS last 7 days from TODAY
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);

    const key = date.toISOString().split("T")[0];

    const data = map.get(key);

    const aqi = Math.round(data?.avgAQI ?? 0);

    result.push({
      label: date.toLocaleDateString("en-US", {
        weekday: "short",
      }),

      fullLabel: date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),

      aqi,
      pm25: data?.avgPM25 ?? 0,
      pm10: data?.avgPM10 ?? 0,
      temperature: data?.avgTemp ?? 0,
      humidity: data?.avgHumidity ?? 0,
      mq135: data?.avgMQ135 ?? 0,

      info: getAQIInfo(aqi),
    });
  }

  return result;
}
}
