export interface Airport {
  id: number;
  start: number;
  end: number;
  elevation: number;
}
export const airportConfig = {
  first: 110,
  spacing: 285,
  length: 68,
  transition: 20,
  width: 7,
  apronDepth: 10,
};
export function getAirport(id: number): Airport {
  return {
    id,
    start: airportConfig.first + id * airportConfig.spacing,
    end:
      airportConfig.first + id * airportConfig.spacing + airportConfig.length,
    elevation: 0.4 + Math.sin(id * 2.7) * 0.35,
  };
}
export function airportAt(x: number): Airport | null {
  const id = Math.floor((x - airportConfig.first) / airportConfig.spacing);
  if (id < 0) return null;
  const airport = getAirport(id);
  return x <= airport.end ? airport : null;
}
export function nearbyAirport(x: number): Airport | null {
  const id = Math.round(
    (x - airportConfig.first - airportConfig.length / 2) /
      airportConfig.spacing,
  );
  if (id < 0) return null;
  const airport = getAirport(id);
  return x >= airport.start - airportConfig.transition &&
    x <= airport.end + airportConfig.transition
    ? airport
    : null;
}
export function airportTerrain(x: number, z: number, natural: number): number {
  const airport = nearbyAirport(x);
  if (!airport) return natural;
  const edge =
    Math.max(airport.start - x, x - airport.end, 0) / airportConfig.transition;
  const lateral =
    Math.max(
      0,
      z < 0 ? -z - airportConfig.apronDepth : z - airportConfig.width / 2 - 2,
    ) / 2;
  const t = Math.min(1, Math.max(edge, lateral));
  const smooth = t * t * (3 - 2 * t);
  return airport.elevation * (1 - smooth) + natural * smooth;
}
