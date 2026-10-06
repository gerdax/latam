import { getAirport } from "../src/airports";
import type { FlightState, FlightConfig } from "../src/physics";
/** A repeatable visual test pilot; production input remains unchanged. */
export function scenarioControl(
  state: FlightState,
  config: Readonly<FlightConfig>,
): number {
  if (state.phase !== "flying") return 0;
  if (state.distance < 80) return 1;
  const ground = getAirport(0).elevation + config.groundClearance;
  const error = state.altitude - ground;
  const desired = -Math.min(
    12,
    Math.max(0.2, Math.sqrt(16 * Math.max(0, error - 0.6))),
  );
  const acceleration =
    desired > state.velocity
      ? config.climbAcceleration
      : config.descentAcceleration;
  return Math.max(
    -1,
    Math.min(1, ((desired - state.velocity) * 20) / acceleration),
  );
}
