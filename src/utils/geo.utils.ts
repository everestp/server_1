export function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R: number = 6371; // Earth radius in kilometers

  const dLat: number = toRadians(lat2 - lat1);
  const dLon: number = toRadians(lon2 - lon1);

  const radLat1: number = toRadians(lat1);
  const radLat2: number = toRadians(lat2);

  const a: number =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radLat1) *
      Math.cos(radLat2) *
      Math.sin(dLon / 2) ** 2;

  const c: number = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Converts degrees to radians
 */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
