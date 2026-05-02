import { z } from "zod";

export const nodeDataSchema = z.object({
    nodeId: z.string(),
    ownerEmail: z.string().email(),

    temperature: z.number(),
    humidity: z.number().optional(),

    pm25: z.number(),
    pm10: z.number().optional(),

    aqi: z.number(),
    aqiLevel: z.string().optional(),

    location: z.object({
        lat: z.number(),
        lng: z.number()
    }).optional()
});
