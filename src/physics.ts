import { calculateFlightForces, defaultFlightForces, type FlightForceConfig } from "./flight-forces";
import { createCrashBody, defaultCrashMaterial, resolveCrashContacts, stepCrash, type CrashBody, type CrashMaterial, rotateCrashPoint, type Quaternion, } from "./crash";
import { cessnaCrashContacts, cessnaContacts, cessnaGroundClearance, } from "./aircraft-config";
import { airportAt, airportConfig, type Airport } from "./airports";
export interface FlightConfig {
    crashMaterial: Readonly<CrashMaterial>;
    crashContactPoints: ReadonlyArray<Readonly<{
        x: number;
        y: number;
        z: number;
    }>>;
    maxPitchUpRate: number;
    maxPitchDownRate: number;
    pitchUpAcceleration: number;
    pitchDownAcceleration: number;
    halfRollDuration: number;
    forwardSpeed: number;
    aerodynamics: Readonly<FlightForceConfig>;
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
    brakeDeceleration: number;
    takeoffAcceleration: number;
    takeoffSpeed: number;
    wheelContactCount: number;
    groundClearance: number;
    /** Conservative local-space contact samples matching the Cessna model. */
    contactPoints: ReadonlyArray<Readonly<{
        x: number;
        y: number;
        z: number;
    }>>;
}
export const defaultFlightConfig: Readonly<FlightConfig> = Object.freeze({
    crashMaterial: defaultCrashMaterial,
    crashContactPoints: cessnaCrashContacts,
    maxPitchUpRate: 0.7,
    maxPitchDownRate: 0.85,
    pitchUpAcceleration: 1.1,
    pitchDownAcceleration: 1.35,
    halfRollDuration: 0.6,
    forwardSpeed: 11,
    aerodynamics: defaultFlightForces,
    neutralDrag: 2.2,
    viewportHeight: 20,
    ceilingScreenHeights: 2,
    startAltitude: 9,
    resetClearance: 4,
    resetDelay: 3,
    pitchResponse: 2,
    ceilingSlowdownDistance: 4,
    maxLandingDescentSpeed: 2.2,
    maxLandingPitch: 0.22,
    landingAssistHeight: 0.8,
    groundDeceleration: 0.2,
    brakeDeceleration: 5,
    takeoffAcceleration: 2.8,
    takeoffSpeed: 8,
    wheelContactCount: 8,
    groundClearance: cessnaGroundClearance,
    contactPoints: cessnaContacts,
});
export interface FlightState {
    crashBody: CrashBody | null;
    altitude: number;
    velocity: number;
    pitch: number;
    pitchVelocity: number;
    roll: number;
    rollStart: number;
    rollElapsed: number;
    rollActive: boolean;
    neutralTarget: number | null;
    lastHorizontalDirection: 1 | -1;
    distance: number;
    horizontalSpeed: number;
    phase: "flying" | "crashed" | "rolling" | "parked" | "takeoff";
    /** Elapsed seconds since impact. */
    crashTime: number;
}
/** Ceiling follows the ground directly below the aircraft, in viewport heights. */
export function flightCeiling(distance: number, terrain: (x: number, z?: number) => number, config: Readonly<FlightConfig> = defaultFlightConfig): number {
    return (terrain(distance, 0) + config.viewportHeight * config.ceilingScreenHeights);
}
export function createFlightState(terrainHeight: number, config: Readonly<FlightConfig> = defaultFlightConfig): FlightState {
    return {
        crashBody: null,
        altitude: Math.max(config.startAltitude, terrainHeight + config.resetClearance),
        velocity: 0,
        pitch: 0,
        pitchVelocity: 0,
        roll: 0,
        rollStart: 0,
        rollElapsed: 0,
        rollActive: false,
        neutralTarget: 0,
        lastHorizontalDirection: 1,
        distance: 0,
        horizontalSpeed: config.forwardSpeed,
        phase: "flying",
        crashTime: 0,
    };
}
/** Shared Rz(pitch) * Rx(roll) orientation for models and contact hulls. */
export function flightOrientation(state: Pick<FlightState, "pitch" | "roll">): Quaternion {
    const z = Math.sin(state.pitch / 2), w = Math.cos(state.pitch / 2);
    const x = Math.sin(state.roll / 2), r = Math.cos(state.roll / 2);
    return { x: w * x, y: z * x, z: z * r, w: w * r };
}
export function requestHalfRoll(state: FlightState): boolean {
    if (state.phase !== "flying" || state.rollActive)
        return false;
    state.rollStart = state.roll;
    state.rollElapsed = 0;
    state.rollActive = true;
    return true;
}
function nearestHorizontal(state: FlightState): number {
    const lower = Math.floor(state.pitch / Math.PI) * Math.PI;
    const upper = lower + Math.PI;
    if (Math.abs(state.pitch - lower - Math.PI / 2) < 1e-9) {
        return Math.sign(Math.cos(lower)) === state.lastHorizontalDirection ? lower : upper;
    }
    return state.pitch - lower < upper - state.pitch ? lower : upper;
}
function groundUnderAircraft(state: Pick<FlightState, "distance" | "pitch" | "roll">, terrain: (x: number, z?: number) => number, config: Readonly<FlightConfig>, contacts = config.crashContactPoints): number {
    const orientation = flightOrientation(state);
    let requiredAltitude = -Infinity;
    for (const point of contacts) {
        const r = rotateCrashPoint(orientation, point);
        requiredAltitude = Math.max(requiredAltitude, terrain(state.distance + r.x, r.z) - r.y);
    }
    return requiredAltitude;
}
function runwayUnderAircraft(state: FlightState, config: Readonly<FlightConfig>): Airport | null {
    const airport = airportAt(state.distance);
    if (!airport)
        return null;
    const orientation = flightOrientation(state);
    return config.crashContactPoints.every(point => {
        const r = rotateCrashPoint(orientation, point);
        return state.distance + r.x >= airport.start && state.distance + r.x <= airport.end && Math.abs(r.z) <= airportConfig.width / 2;
    }) ? airport : null;
}
function upright(state: FlightState, config: Readonly<FlightConfig>): boolean {
    return !state.rollActive && rotateCrashPoint(flightOrientation(state), { x: 0, y: 1, z: 0 }).y >= Math.cos(config.maxLandingPitch);
}
function crash(state: FlightState, terrain: (x: number, z?: number) => number, config: Readonly<FlightConfig>): void {
    const t = Math.min(1, state.rollElapsed / config.halfRollDuration);
    const rollRate = state.rollActive ? Math.PI * 6 * t * (1 - t) / config.halfRollDuration : 0;
    state.phase = "crashed";
    state.crashTime = 0;
    state.crashBody = createCrashBody(flightOrientation(state), config.crashContactPoints, {
        x: Math.cos(state.pitch) * rollRate, y: Math.sin(state.pitch) * rollRate, z: state.pitchVelocity,
    });
    resolveCrashContacts(state, state.crashBody, terrain, config.crashMaterial);
}
/** Mutates state; positive input pulls the nose toward the local cabin roof. */
export function stepFlight(state: FlightState, input: number, dt: number, terrainHeight: (x: number, z?: number) => number, config: Readonly<FlightConfig> = defaultFlightConfig, rollRequested = false): void {
    if (!Number.isFinite(dt) || dt <= 0)
        return;
    const control = Number.isFinite(input) ? Math.max(-1, Math.min(1, input)) : 0;
    if (rollRequested)
        requestHalfRoll(state);
    // Bounded steps also prevent terrain tunnelling when a caller has a slow frame.
    const count = Math.ceil(dt * 120);
    const h = dt / count;
    for (let i = 0; i < count; i++) {
        if (state.phase === "crashed") {
            state.crashBody ??= createCrashBody(flightOrientation(state), config.crashContactPoints);
            stepCrash(state, state.crashBody, h, terrainHeight, config.crashMaterial);
            state.crashTime += h;
            if (state.crashTime + 1e-9 >= config.resetDelay) {
                state.altitude = Math.max(config.startAltitude, groundUnderAircraft({ distance: state.distance, pitch: 0, roll: 0 }, terrainHeight, config) +
                    config.resetClearance);
                state.velocity = 0;
                state.horizontalSpeed = config.forwardSpeed;
                state.pitch = 0;
                state.pitchVelocity = 0;
                state.roll = 0;
                state.rollStart = 0;
                state.rollElapsed = 0;
                state.rollActive = false;
                state.neutralTarget = 0;
                state.lastHorizontalDirection = 1;
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
            state.pitch = nearestHorizontal(state);
            state.pitchVelocity = 0;
            state.velocity = 0;
            const direction = state.lastHorizontalDirection;
            const oldSpeed = Math.abs(state.horizontalSpeed);
            let speed: number;
            if (control > 0.15) {
                state.phase = "takeoff";
                // Cruise speed limits added thrust, never removes touchdown momentum.
                speed = oldSpeed >= config.forwardSpeed
                    ? oldSpeed
                    : Math.min(config.forwardSpeed, oldSpeed + config.takeoffAcceleration * h);
            }
            else {
                const resistance = config.groundDeceleration + config.brakeDeceleration * Math.max(0, -control);
                speed = Math.max(0, oldSpeed - resistance * h);
                state.phase = speed === 0 ? "parked" : "rolling";
            }
            state.horizontalSpeed = speed === 0 ? 0 : direction * speed;
            state.distance += direction * (oldSpeed + speed) * h / 2;
            if (!runwayUnderAircraft(state, config))
                crash(state, terrainHeight, config);
            else if (state.phase === "takeoff" && speed >= config.takeoffSpeed) {
                state.phase = "flying";
                state.pitch += direction * 0.12;
                state.altitude = groundUnderAircraft(state, terrainHeight, config) + 0.02;
                state.velocity = 0.8;
                state.pitchVelocity = direction * 0.15;
                state.neutralTarget = null;
            }
            continue;
        }
        if (state.rollActive) {
            state.rollElapsed = Math.min(config.halfRollDuration, state.rollElapsed + h);
            const t = state.rollElapsed / config.halfRollDuration;
            state.roll = state.rollStart + Math.PI * t * t * (3 - 2 * t);
            if (t >= 1)
                state.rollActive = false;
        }
        const oldHorizontalSpeed = state.horizontalSpeed;
        const oldVerticalSpeed = state.velocity;
        const airspeed = Math.hypot(state.horizontalSpeed, state.velocity);
        const aerodynamicAuthority = Math.max(0.03, Math.min(1, (airspeed / config.aerodynamics.cruiseSpeed) ** 2));
        const oldRate = state.pitchVelocity;
        const effective = control * Math.cos(state.roll);
        let acceleration: number;
        if (control !== 0) {
            state.neutralTarget = null;
            const targetRate = effective * aerodynamicAuthority * (control > 0 ? config.maxPitchUpRate : config.maxPitchDownRate);
            const braking = oldRate * (targetRate - oldRate) < 0;
            const authority = Math.max(braking ? 0.5 : 0, Math.abs(effective) * aerodynamicAuthority * (control > 0 ? config.pitchUpAcceleration : config.pitchDownAcceleration));
            acceleration = Math.max(-authority, Math.min(authority, (targetRate - oldRate) / h));
        }
        else {
            state.neutralTarget ??= nearestHorizontal(state);
            acceleration = config.pitchResponse * (state.neutralTarget - state.pitch) - config.neutralDrag * state.pitchVelocity;
            const braking = oldRate * acceleration < 0;
            acceleration = Math.max(-Math.max(braking ? 0.5 : 0, config.pitchDownAcceleration * aerodynamicAuthority), Math.min(Math.max(braking ? 0.5 : 0, config.pitchUpAcceleration * aerodynamicAuthority), acceleration));
        }
        const cap = Math.max(config.maxPitchDownRate, config.maxPitchUpRate);
        state.pitchVelocity = Math.max(-cap, Math.min(cap, oldRate + acceleration * h));
        state.pitch += (oldRate + state.pitchVelocity) * h / 2;
        if (Math.abs(Math.cos(state.pitch)) > 1e-8)
            state.lastHorizontalDirection = Math.cos(state.pitch) > 0 ? 1 : -1;
        const runway = runwayUnderAircraft(state, config);
        const landingAssist = runway && control === 0 && upright(state, { ...config, maxLandingPitch: 0.3 }) &&
            state.velocity < 0 && state.velocity >= -config.maxLandingDescentSpeed &&
            state.altitude <= runway.elevation + config.groundClearance + config.landingAssistHeight;
        if (landingAssist) {
            const target = nearestHorizontal(state);
            const flareAcceleration = 8 * (target - state.pitch) - 4 * state.pitchVelocity;
            state.pitchVelocity += Math.max(-config.pitchDownAcceleration, Math.min(config.pitchUpAcceleration, flareAcceleration)) * h;
        }
        const forces = calculateFlightForces(state, control, config.aerodynamics);
        let accelerationY = forces.accelerationY;
        const ceiling = flightCeiling(state.distance, terrainHeight, config);
        const ceilingStart = ceiling - config.ceilingSlowdownDistance;
        if (state.altitude > ceilingStart) {
            // A soft acceleration field removes upward energy continuously. No
            // velocity reassignment or altitude clamp: overshoot is allowed.
            const proximity = Math.max(0, Math.min(1, (state.altitude - ceilingStart) / Math.max(0.1, config.ceilingSlowdownDistance)));
            const downward = Math.min(config.aerodynamics.gravity * 1.5, proximity * (config.aerodynamics.gravity * 0.25 + Math.max(0, state.velocity) * 0.15) + Math.max(0, state.altitude - ceiling) * 0.15);
            accelerationY -= downward;
        }
        if (landingAssist) {
            // A gentle sink is retained through the flare instead of converting
            // a level visual attitude into an instantaneous vertical stop.
            accelerationY += Math.max(-2, Math.min(2, (-0.9 - state.velocity) * 6));
        }
        state.horizontalSpeed += forces.accelerationX * h;
        state.velocity += accelerationY * h;
        state.distance += (oldHorizontalSpeed + state.horizontalSpeed) * h / 2;
        state.altitude += (oldVerticalSpeed + state.velocity) * h / 2;
        if (state.altitude <=
            groundUnderAircraft(state, terrainHeight, config)) {
            const airport = runwayUnderAircraft(state, config);
            const wheels = config.contactPoints.slice(0, config.wheelContactCount);
            const body = config.contactPoints.slice(config.wheelContactCount);
            const wheelsTouch = state.altitude <=
                groundUnderAircraft(state, terrainHeight, config, wheels);
            const bodyClear = state.altitude >=
                groundUnderAircraft(state, terrainHeight, config, body);
            if (airport &&
                wheelsTouch &&
                bodyClear &&
                state.velocity >= -config.maxLandingDescentSpeed &&
                state.velocity <= 0 &&
                state.horizontalSpeed * Math.cos(state.pitch) >= 0 &&
                upright(state, config) &&
                Math.abs(Math.sin(state.pitch)) <= Math.sin(config.maxLandingPitch)) {
                state.phase = "rolling";
                state.altitude = airport.elevation + config.groundClearance;
                state.pitch = nearestHorizontal(state);
                state.pitchVelocity = 0;
                state.neutralTarget = state.pitch;
                state.velocity = 0;
            }
            else {
                crash(state, terrainHeight, config);
            }
        }
    }
}
