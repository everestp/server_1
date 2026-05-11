import { SensorHistory } from "../models/sensorhistory.model";
// import { getAQIInfo } from "../utils/aqi.utils";

export class HistoryRepository {
  /**
   * LAST 7 DAYS AQI HISTORY
   */
async getWeeklyHistory(nodeId: string) {
  const today = new Date();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 6);

  const rawData = await SensorHistory.aggregate([
    {
      $match: {
        nodeId,
        createdAt: {
          $gte: sevenDaysAgo,
          $lte: today,
        },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          day: { $dayOfMonth: "$createdAt" },
        },
        avgAQI: { $avg: "$aqi" },
        avgPM25: { $avg: "$pm25" },
        avgPM10: { $avg: "$pm10" },
        avgTemp: { $avg: "$temperature" },
        avgHumidity: { $avg: "$humidity" },
        avgMQ135: { $avg: "$mq135" },
      },
    },
  ]);

  return rawData;
}
}
