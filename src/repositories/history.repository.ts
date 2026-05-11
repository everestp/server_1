import { SensorHistory } from "../models/sensorhistory.model";

export class HistoryRepository {
  /**
   * Aggregates sensor data to get daily averages for the last 7 days
   */
  async getWeeklyHistory(nodeId: string) {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0); // Start from the beginning of the day

    return await SensorHistory.aggregate([
      {
        $match: {
          nodeId,
          timestamp: {
            $gte: sevenDaysAgo,
            $lte: today,
          },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$timestamp" },
            month: { $month: "$timestamp" },
            day: { $dayOfMonth: "$timestamp" },
          },
          // Calculate the average for each metric
          avgAQI: { $avg: "$aqi" },
          avgPM25: { $avg: "$pm25" },
          avgPM10: { $avg: "$pm10" },
          avgTemp: { $avg: "$temperature" },
          avgHumidity: { $avg: "$humidity" },
        },
      },
      {
        $project: {
          _id: 0,
          dateKey: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: {
                $dateFromParts: {
                  year: "$_id.year",
                  month: "$_id.month",
                  day: "$_id.day",
                },
              }
            }
          },
          averages: {
            aqi: "$avgAQI",
            pm25: "$avgPM25",
            pm10: "$avgPM10",
            temperature: "$avgTemp",
            humidity: "$avgHumidity"
          }
        },
      },
      { $sort: { dateKey: 1 } }
    ]);
  }
}
