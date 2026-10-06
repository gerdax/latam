import {
  createCrashBody,
  defaultCrashMaterial,
  resolveCrashContacts,
  stepCrash,
  type CrashBody,
  type CrashMaterial,
} from "./crash";
import {
  cessnaCrashContacts,
  cessnaContacts,
  cessnaGroundClearance,
} from "./aircraft-config";
import { airportAt, type Airport } from "./airports";

export interface FlightConfig {
  crashMaterial: Readonly<CrashMaterial>;
  crashContactPoints: ReadonlyArray<
    Readonly<{ x: number; y: number; z: number }>
  >;
  forwardSpeed: number;
  maxClimbSpeed: number;
  maxDescentSpeed: number;
  climbAcceleration: number;
  descentAcceleration: number;
  neutralDrag: number;
  /** World-space height visible in the current viewport. */
  viewportHeight: number;
  ceilingScreenHeights: number;
  startAltitude: number;
  resetClearance: number;
  resetDelay: number;
  pitchResponse: number;
  ceilingSlowdownDistance: number;
  maxLandingDescentSpeed: number;
  maxLandingPitch: number;
  landingAssistHeight: number;
  groundDeceleration: number;
  takeoffAcceleration: number;
  takeoffSpeed: number;
  wheelContactCount: number;
  groundClearance: number;
  /** Conservative local-space contact samples matching the Cessna model. */
  contactPoints: ReadonlyArray<Readonly<{ x: number; y: number; z: number }>>;
}

export const defaultFlightConfig: Readonly<FlightConfig> = Object.freeze({
  crashMaterial: defaultCrashMaterial,
  crashContactPoints: cessnaCrashContacts,
  forwardSpeed: 7,
  maxClimbSpeed: 10,
  maxDescentSpeed: 18,
  climbAcceleration: 10,
  descentAcceleration: 14,
  neutralDrag: 2.4,
  viewportHeight: 20,
  ceilingScreenHeights: 2,
  startAltitude: 9,
  resetClearance: 4,
  resetDelay: 3,
  pitchResponse: 5,
  ceilingSlowdownDistance: 4,
  maxLandingDescentSpeed: 2.2,
  maxLandingPitch: 0.22,
  landingAssistHeight: 0.8,
  groundDeceleration: 2,
  takeoffAcceleration: 2.8,
  takeoffSpeed: 6,
  wheelContactCount: 8,
  groundClearance: cessnaGroundClearance,
  contactPoints: cessnaContacts,
});

export interface FlightState {
  crashBody: CrashBody | null;
  altitude: number;
  velocity: number;
  pitch: number;
  distance: number;
  horizontalSpeed: number;
  phase: "flying" | "crashed" | "rolling" | "parked" | "takeoff";
  /** Elapsed seconds since impact. */
  crashTime: number;
}

/** Ceiling follows the ground directly below the aircraft, in viewport heights. */
export function flightCeiling(
  distance: number,
  terrain: (x: number, z?: number) => number,
  config: Readonly<FlightConfig> = defaultFlightConfig,
): number {
  return (
    terrain(distance, 0) + config.viewportHeight * config.ceilingScreenHeights
  );
}

export function createFlightState(
  terrainHeight: number,
  config: Readonly<FlightConfig> = defaultFlightConfig,
): FlightState {
  return {
    crashBody: null,
    altitude: Math.max(
      config.startAltitude,
      terrainHeight + config.resetClearance,
    ),
    velocity: 0,
    pitch: 0,
    distance: 0,
    horizontalSpeed: config.forwardSpeed,
    phase: "flying",
    crashTime: 0,
  };
}

function groundUnderAircraft(
  distance: number,
  pitch: number,
  terrain: (x: number, z?: number) => number,
  config: Readonly<FlightConfig>,
  contacts = config.contactPoints,
): number {
  const cos = Math.cos(pitch);
  const sin = Math.sin(pitch);
  let requiredAltitude = -Infinity;
  for (const point of contacts) {
    const x = point.x * cos - point.y * sin;
    const y = point.x * sin + point.y * cos;
    requiredAltitude = Math.max(
      requiredAltitude,
      terrain(distance + x, point.z) - y,
    );
  }
  return requiredAltitude;
}

/** Require the complete pitched aircraft envelope to remain over the runway. */
function runwayUnderAircraft(
  state: FlightState,
  config: Readonly<FlightConfig>,
): Airport | null {
  const airport = airportAt(state.distance);
  if (!airport) return null;
  const cos = Math.cos(state.pitch);
  const sin = Math.sin(state.pitch);
  return config.contactPoints.every((point) => {
    const x = state.distance + point.x * cos - point.y * sin;
    return x >= airport.start && x <= airport.end;
  })
    ? airport
    : null;
}

function crash(
  state: FlightState,
  terrain: (x: number, z?: number) => number,
  config: Readonly<FlightConfig>,
): void {
  state.phase = "crashed";
  state.crashTime = 0;
  state.crashBody = createCrashBody(state.pitch, config.crashContactPoints);
  resolveCrashContacts(state, state.crashBody, terrain, config.crashMaterial);
}

/** Mutates state; input is positive for climb and negative for descent. */
export function stepFlight(
  state: FlightState,
  input: number,
  dt: number,
  terrainHeight: (x: number, z?: number) => number,
  config: Readonly<FlightConfig> = defaultFlightConfig,
): void {
  if (!Number.isFinite(dt) || dt <= 0) return;
  const control = Number.isFinite(input) ? Math.max(-1, Math.min(1, input)) : 0;
  // Bounded steps also prevent terrain tunnelling when a caller has a slow frame.
  const count = Math.ceil(dt * 120);
  const h = dt / count;
  for (let i = 0; i < count; i++) {
    if (state.phase === "crashed") {
      state.crashBody ??= createCrashBody(
        state.pitch,
        config.crashContactPoints,
      );
      stepCrash(state, state.crashBody, h, terrainHeight, config.crashMaterial);
      state.crashTime += h;
      if (state.crashTime + 1e-9 >= config.resetDelay) {
        state.altitude = Math.max(
          config.startAltitude,
          groundUnderAircraft(state.distance, 0, terrainHeight, config) +
            config.resetClearance,
        );
        state.velocity = 0;
        state.horizontalSpeed = config.forwardSpeed;
        state.pitch = 0;
        state.phase = "flying";
        state.crashTime = 0;
        state.crashBody = null;
      }
      continue;
    }

    if (state.phase !== "flying") {
      const airport = runwayUnderAircraft(state, config);
      if (!airport) {
        crash(state, terrainHeight, config);
        continue;
      }
      state.altitude = airport.elevation + config.groundClearance;
      state.pitch = 0;
      state.velocity = 0;
      const oldSpeed = state.horizontalSpeed;
      if (control > 0.15) {
        state.phase = "takeoff";
        state.horizontalSpeed = Math.min(
          config.forwardSpeed,
          oldSpeed + config.takeoffAcceleration * h,
        );
      } else {
        state.horizontalSpeed = Math.max(
          0,
          oldSpeed - config.groundDeceleration * h,
        );
        state.phase = state.horizontalSpeed === 0 ? "parked" : "rolling";
      }
      state.distance += ((oldSpeed + state.horizontalSpeed) * h) / 2;
      if (!runwayUnderAircraft(state, config)) {
        crash(state, terrainHeight, config);
      } else if (
        state.phase === "takeoff" &&
        state.horizontalSpeed >= config.takeoffSpeed
      ) {
        state.phase = "flying";
        state.altitude += 0.02;
        state.velocity = 1.5;
      }
      continue;
    }

    const oldVelocity = state.velocity;
    let verticalTravel: number;
    if (control === 0) {
      const decay = Math.exp(-config.neutralDrag * h);
      state.velocity *= decay;
      verticalTravel =
        config.neutralDrag === 0
          ? oldVelocity * h
          : (oldVelocity * (1 - decay)) / config.neutralDrag;
    } else {
      const acceleration =
        control *
        (control > 0 ? config.climbAcceleration : config.descentAcceleration);
      const limit =
        control > 0 ? config.maxClimbSpeed : -config.maxDescentSpeed;
      const reachesLimit =
        control > 0
          ? oldVelocity + acceleration * h > limit
          : oldVelocity + acceleration * h < limit;
      const activeTime = reachesLimit
        ? Math.max(0, (limit - oldVelocity) / acceleration)
        : h;
      state.velocity = reachesLimit ? limit : oldVelocity + acceleration * h;
      verticalTravel =
        oldVelocity * activeTime +
        (acceleration * activeTime * activeTime) / 2 +
        state.velocity * (h - activeTime);
    }
    const oldSpeed = state.horizontalSpeed;
    state.horizontalSpeed = Math.min(
      config.forwardSpeed,
      oldSpeed + config.takeoffAcceleration * h,
    );
    state.distance += ((oldSpeed + state.horizontalSpeed) * h) / 2;
    const ceiling = flightCeiling(state.distance, terrainHeight, config);
    if (state.velocity > 0 && config.ceilingSlowdownDistance > 0) {
      const remaining = Math.max(0, ceiling - state.altitude);
      const allowedSpeed =
        config.maxClimbSpeed *
        Math.sqrt(Math.min(1, remaining / config.ceilingSlowdownDistance));
      if (state.velocity > allowedSpeed) {
        state.velocity = allowedSpeed;
        verticalTravel = ((oldVelocity + state.velocity) * h) / 2;
      }
    }
    // A lower ceiling (terrain change or rotation) stops further rise without
    // moving an aircraft already above it. Descent always remains available.
    if (verticalTravel > 0) {
      verticalTravel = Math.min(
        verticalTravel,
        Math.max(0, ceiling - state.altitude),
      );
    }
    state.altitude += verticalTravel;
    if (state.altitude >= ceiling) {
      state.velocity = Math.min(0, state.velocity);
    }
    let targetPitch = Math.atan2(state.velocity, state.horizontalSpeed);
    const landingRunway = runwayUnderAircraft(state, config);
    const landingAssist =
      landingRunway &&
      Math.abs(control) <= 0.1 &&
      state.velocity <= 0 &&
      state.velocity >= -config.maxLandingDescentSpeed &&
      state.altitude <=
        landingRunway.elevation +
          config.groundClearance +
          config.landingAssistHeight;
    if (landingAssist) targetPitch = 0;
    state.pitch +=
      (targetPitch - state.pitch) *
      (1 -
        Math.exp(
          -(landingAssist
            ? Math.max(8, config.pitchResponse)
            : config.pitchResponse) * h,
        ));

    if (
      state.altitude <=
      groundUnderAircraft(state.distance, state.pitch, terrainHeight, config)
    ) {
      const airport = runwayUnderAircraft(state, config);
      const wheels = config.contactPoints.slice(0, config.wheelContactCount);
      const body = config.contactPoints.slice(config.wheelContactCount);
      const wheelsTouch =
        state.altitude <=
        groundUnderAircraft(
          state.distance,
          state.pitch,
          terrainHeight,
          config,
          wheels,
        );
      const bodyClear =
        state.altitude >=
        groundUnderAircraft(
          state.distance,
          state.pitch,
          terrainHeight,
          config,
          body,
        );
      if (
        airport &&
        wheelsTouch &&
        bodyClear &&
        state.velocity >= -config.maxLandingDescentSpeed &&
        state.velocity <= 0 &&
        Math.abs(state.pitch) <= config.maxLandingPitch
      ) {
        state.phase = "rolling";
        state.altitude = airport.elevation + config.groundClearance;
        state.pitch = 0;
        state.velocity = 0;
      } else {
        crash(state, terrainHeight, config);
      }
    }
  }
}
