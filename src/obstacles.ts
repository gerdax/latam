import { airportConfig, getAirport } from "./airports";

export type ObstacleKind = "building" | "bird" | "satellite" | "ufo";
export interface Obstacle {
  id: string;
  kind: ObstacleKind;
  x: number;
  y: number;
  z: number;
  halfSize: { x: number; y: number; z: number };
  velocityX: number;
  buildingStyle?: { color: number; roof: number; columns: number; windowColor: number };
}
export type ObstacleTerrain = (x: number, z?: number) => number;
export const obstacleConfig = Object.freeze({
  building: { slots: 72, cells: 6, clusterSize: 12, spacing: 80, velocityX: 0, minHeight: 6, maxHeight: 11 },
  bird: { slots: 42, cells: 6, flockSize: 7, scale: 0.5, spacing: 65, velocityX: -2, minHeight: 13, maxHeight: 19 },
  satellite: { slots: 6, spacing: 95, velocityX: -0.6, minHeight: 27, maxHeight: 34 },
  ufo: { slots: 6, spacing: 120, velocityX: -3, minHeight: 43, maxHeight: 50 },
});
export const obstacleKinds = Object.keys(obstacleConfig) as ObstacleKind[];
function random(cell: number, salt: number): number {
  const value = Math.sin(cell * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}
function clearOfAirport(x: number, halfWidth: number): boolean {
  const nearest = Math.round((x - airportConfig.first - airportConfig.length / 2) / airportConfig.spacing);
  if (nearest < 0) return true;
  const airport = getAirport(nearest);
  return x + halfWidth < airport.start - 30 || x - halfWidth > airport.end + 30;
}

/** Deterministic world cells, queried in either direction without growing storage. */
export function obstaclesAround(distance: number, time: number, terrain: ObstacleTerrain): Obstacle[] {
  const result: Obstacle[] = [];
  for (const [kindIndex, kind] of obstacleKinds.entries()) {
    const config = obstacleConfig[kind];
    const first = Math.floor((distance - config.velocityX * time) / config.spacing) - 3;
    for (let slot = 0; slot < (kind === "building" ? obstacleConfig.building.cells : kind === "bird" ? obstacleConfig.bird.cells : config.slots); slot++) {
      const cell = first + slot;
      const anchorX = (cell + 0.5 + (random(cell, kindIndex + 1) - 0.5) * 0.24) * config.spacing;
      if (kind === "building") {
        if (!clearOfAirport(anchorX, 14)) continue;
        const colors = [0xc7a0a0, 0xaaaec3, 0xd7b994, 0x9eb6ac, 0xc4aed0, 0xc2c9ab, 0xd6b5a9, 0x9dacc1];
        for (let member = 0; member < obstacleConfig.building.clusterSize; member++) {
          const seed = cell * 17 + member;
          const row = Math.floor(member / 4);
          const x = anchorX + (member % 4 - 1.5) * 5.8 + (row % 2) * 2 + (random(seed, 41) - .5) * .8;
          const z = -row * 3.4;
          const width = 1.8 + random(seed, 42) * 2.6;
          const depth = 1.3 + random(seed, 43) * 1.5;
          const height = config.minHeight + random(seed, 44) * (config.maxHeight - config.minHeight);
          if (!clearOfAirport(x, width / 2)) continue;
          result.push({id:`building:${cell}:${member}`,kind,x,y:terrain(x,z)+height/2,z,
            halfSize:{x:width/2,y:height/2,z:depth/2},velocityX:0,
            buildingStyle:{color:colors[Math.floor(random(seed,45)*colors.length)],roof:Math.floor(random(seed,46)*4),columns:2+Math.floor(random(seed,47)*4),windowColor:random(seed,48)>.5?0xffe3a9:0x9dbbc8}});
        }
        continue;
      }
      const height = config.minHeight + random(cell, kindIndex + 7) * (config.maxHeight - config.minHeight);
      if (kind === "bird") {
        const scale = obstacleConfig.bird.scale;
        for (let member = 0; member < obstacleConfig.bird.flockSize; member++) {
          const rank = Math.ceil(member / 2);
          const side = member % 2 ? -1 : 1;
          result.push({id: `bird:${cell}:${member}`, kind,
            x: anchorX + config.velocityX * time + rank * 1.35,
            y: terrain(anchorX, 0) + Math.max(config.minHeight, Math.min(config.maxHeight, height + side * rank * .45)),
            z: -rank * .18, halfSize: {x: .7 * scale, y: .8 * scale, z: 1.1 * scale},
            velocityX: config.velocityX});
        }
        continue;
      }
      const halfSize = kind === "satellite" ? { x: 2.3, y: 0.85, z: 0.65 }
        : { x: 1.6, y: 1.1, z: 1.6 };
      result.push({
        id: `${kind}:${cell}`, kind,
        x: anchorX + config.velocityX * time,
        y: terrain(anchorX, 0) + height,
        z: 0, halfSize, velocityX: config.velocityX,
      });
    }
  }
  return result;
}
