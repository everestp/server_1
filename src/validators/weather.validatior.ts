import { z } from "zod";

export const weatherCurrentSchema = z.object({
  nodeId: z.string().min(1),
});

export const weatherNearbySchema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
});

export const weatherHistorySchema = z.object({
  nodeId: z.string(),
  from: z.string().datetime(),
  to: z.string().datetime(),
});
