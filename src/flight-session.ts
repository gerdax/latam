import { findObstacleCollision } from "./obstacle-collision";
import { applyObstacleImpact, resolveCrashContacts } from "./crash";
import type { Obstacle } from "./obstacles";
import { airportConfig, getAirport } from "./airports";
import { createFlightState, stepFlight, beginObstacleCrash, type FlightConfig, type FlightState, } from "./physics";
export type AircraftProfile = Pick<FlightConfig, "contactPoints" | "crashContactPoints" | "groundClearance" | "wheelContactCount">;
/** A reset returns to selection; waiting never advances flight or scenery. */
export class FlightSession {
    readonly state: FlightState;
    waiting = true;
    elapsed = 0;
    constructor(readonly config: FlightConfig, private readonly terrain: (x: number, z?: number) => number, private readonly obstacleProvider?: (distance: number, time: number, terrain: (x: number, z?: number) => number) => Obstacle[]) {
        this.state = createFlightState(terrain(0), config);
        this.parkOnRunway(0);
    }
    select(profile: AircraftProfile) {
        this.config.contactPoints = profile.contactPoints;
        this.config.crashContactPoints = profile.crashContactPoints;
        this.config.groundClearance = profile.groundClearance;
        this.config.wheelContactCount = profile.wheelContactCount;
        let airportId = Math.max(0, Math.floor((this.state.distance - airportConfig.first) / airportConfig.spacing));
        if (this.state.distance > getAirport(airportId).end)
            airportId++;
        this.parkOnRunway(airportId);
        this.waiting = false;
    }
    private parkOnRunway(airportId: number) {
        const airport = getAirport(airportId);
        const distance = airport.start + 8;
        Object.assign(this.state, createFlightState(this.terrain(distance), this.config), {
            distance,
            altitude: airport.elevation + this.config.groundClearance,
            horizontalSpeed: 0,
            velocity: 0,
            phase: "parked",
        });
    }
    step(input: number, dt: number, rollRequested = false) {
        if (this.waiting)
            return;
        if (!Number.isFinite(dt) || dt <= 0)
            return;
        const count = Math.ceil(dt * 120);
        for (let i = 0; i < count && !this.waiting; i++) {
            const wasCrashed = this.state.phase === "crashed";
            this.elapsed += dt / count;
            stepFlight(this.state, input, dt / count, this.terrain, this.config, i === 0 && rollRequested);
            if (wasCrashed && this.state.phase === "flying") {
                this.waiting = true;
                continue;
            }
            if (this.obstacleProvider) {
                const obstacles = this.obstacleProvider(this.state.distance, this.elapsed, this.terrain);
                const eligible = this.state.phase === "crashed" ? obstacles.filter(o => o.kind === "building") : obstacles;
                const hit = findObstacleCollision(this.state, this.config, eligible, this.terrain);
                if (hit) {
                    beginObstacleCrash(this.state, this.terrain, this.config);
                    applyObstacleImpact(this.state, this.state.crashBody!, hit.contact, hit.normal, hit.obstacle.velocityX, this.config.crashMaterial);
                    this.state.distance += hit.normal.x * (hit.penetration + 0.002);
                    this.state.altitude += hit.normal.y * (hit.penetration + 0.002);
                    resolveCrashContacts(this.state, this.state.crashBody!, this.terrain, this.config.crashMaterial);
                }
            }
        }
    }
}
