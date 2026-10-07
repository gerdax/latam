import {
  createFlightState,
  stepFlight,
  type FlightConfig,
  type FlightState,
} from "./physics";
export type AircraftProfile = Pick<
  FlightConfig,
  | "contactPoints"
  | "crashContactPoints"
  | "groundClearance"
  | "wheelContactCount"
>;
/** A reset returns to selection; waiting never advances flight or scenery. */
export class FlightSession {
  readonly state: FlightState;
  waiting = true;
  constructor(
    readonly config: FlightConfig,
    private readonly terrain: (x: number, z?: number) => number,
  ) {
    this.state = createFlightState(terrain(0), config);
  }
  select(profile: AircraftProfile) {
    this.config.contactPoints = profile.contactPoints;
    this.config.crashContactPoints = profile.crashContactPoints;
    this.config.groundClearance = profile.groundClearance;
    this.config.wheelContactCount = profile.wheelContactCount;
    const distance = this.state.distance;
    Object.assign(
      this.state,
      createFlightState(this.terrain(distance), this.config),
      { distance },
    );
    this.waiting = false;
  }
  step(input: number, dt: number, rollRequested = false) {
    if (this.waiting) return;
    if (!Number.isFinite(dt) || dt <= 0) return;
    const count = Math.ceil(dt * 120);
    for (let i = 0; i < count && !this.waiting; i++) {
      const wasCrashed = this.state.phase === "crashed";
      stepFlight(this.state, input, dt / count, this.terrain, this.config, i === 0 && rollRequested);
      if (wasCrashed && this.state.phase === "flying") this.waiting = true;
    }
  }
}
