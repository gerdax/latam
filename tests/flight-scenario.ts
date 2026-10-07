import { getAirport } from "../src/airports";
import { flightCeiling, type FlightState, type FlightConfig } from "../src/physics";
/** Feedback test pilot commands attitude, never writes actual velocity. */
export function scenarioControl(state: FlightState, config: Readonly<FlightConfig>): number {
    if (state.phase !== "flying")
        return 0;
    const airport = getAirport(1);
    if (state.distance > airport.start + 3 && state.altitude < airport.elevation + config.groundClearance + config.landingAssistHeight && state.velocity >= -config.maxLandingDescentSpeed)
        return 0;
    let desiredVerticalSpeed: number;
    if (state.distance < airport.start - 145) {
        const desiredHeight = flightCeiling(state.distance, () => 0, config) - 1;
        desiredVerticalSpeed = Math.max(-3, Math.min(5, (desiredHeight - state.altitude) * .5));
    }
    else {
        const targetHeight = state.distance < airport.start + 3 ? 2.5 : airport.elevation + config.groundClearance;
        const error = Math.max(0, state.altitude - targetHeight);
        desiredVerticalSpeed = -Math.min(6, Math.max(.6, error * .5));
    }
    const airspeed = Math.max(7, Math.hypot(state.horizontalSpeed, state.velocity));
    const pathAngle = Math.atan2(state.velocity, state.horizontalSpeed);
    const desiredAngle = Math.asin(Math.max(-.85, Math.min(.85, desiredVerticalSpeed / airspeed)));
    const targetPitch = desiredAngle + .2 * (desiredAngle - pathAngle);
    const desiredRate = (targetPitch - state.pitch) * 3 - state.pitchVelocity * .5;
    return Math.max(-1, Math.min(1, desiredRate / (desiredRate >= 0 ? config.maxPitchUpRate : config.maxPitchDownRate)));
}
