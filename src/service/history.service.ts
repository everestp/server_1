import { HistoryRepository } from "../repositories/history.repository";
import { getAQIInfo } from "../utils/aqi.utils";

export class HistoryService {
  private historyRepository: HistoryRepository;

  constructor() {
    this.historyRepository = new HistoryRepository();
  }

  async getWeeklyHistory(nodeId: string) {
    const rows = await this.historyRepository.getWeeklyHistory(nodeId);

    // Map database results to a quick-lookup object
    const dataMap = new Map();
    rows.forEach((row: any) => {
      dataMap.set(row.dateKey, row.averages);
    });

    const result = [];

    // Loop through the last 7 days ending with TODAY
    for (let i = 6; i >= 0; i--) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - i);

      const key = targetDate.toISOString().split("T")[0]; // YYYY-MM-DD
      const dailyData = dataMap.get(key);

      // Round the average AQI for display
      const aqi = Math.round(dailyData?.aqi ?? 0);

      result.push({
        label: targetDate.toLocaleDateString("en-US", {
          weekday: "short", // e.g., "Mon"
        }),
        fullLabel: targetDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric", // e.g., "May 11"
        }),
        aqi,
        pm25: Number((dailyData?.pm25 ?? 0).toFixed(2)),
        pm10: Number((dailyData?.pm10 ?? 0).toFixed(2)),
        temperature: Number((dailyData?.temperature ?? 0).toFixed(1)),
        humidity: Number((dailyData?.humidity ?? 0).toFixed(1)),
        info: getAQIInfo(aqi),
      });
    }

    return result;
  }
}
