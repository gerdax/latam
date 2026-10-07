/** Mass-normalized aerodynamic forces in the two-dimensional flight lane. */
export interface FlightForceConfig {
    cruiseSpeed: number;
    gravity: number;
    thrust: number;
    turnThrustBoost: number;
    quadraticDrag: number;
    liftFactor: number;
    liftSlope: number;
    maxLiftCoefficient: number;
    inducedDrag: number;
    stallAngle: number;
}
export const defaultFlightForces: Readonly<FlightForceConfig> = Object.freeze({
    cruiseSpeed: 11,
    gravity: 3.2,
    thrust: 3.15,
    turnThrustBoost: 0.4,
    quadraticDrag: 0.025,
    liftFactor: 0.065,
    liftSlope: 4,
    maxLiftCoefficient: 1.7,
    inducedDrag: 0.08,
    stallAngle: 25 * Math.PI / 180,
});
export interface FlightForceResult {
    accelerationX: number;
    accelerationY: number;
    airspeed: number;
    angleOfAttack: number;
    lift: number;
    drag: number;
}
export function wrapFlightAngle(angle: number): number {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
}
export function calculateFlightForces(motion: Readonly<{
    horizontalSpeed: number;
    velocity: number;
    pitch: number;
}>, control: number, config: Readonly<FlightForceConfig> = defaultFlightForces): FlightForceResult {
    const airspeed = Math.hypot(motion.horizontalSpeed, motion.velocity);
    const pathAngle = airspeed > 1e-8 ? Math.atan2(motion.velocity, motion.horizontalSpeed) : motion.pitch;
    const tx = Math.cos(pathAngle), ty = Math.sin(pathAngle);
    const angleOfAttack = wrapFlightAngle(motion.pitch - pathAngle);
    const absoluteAngle = Math.abs(angleOfAttack);
    const q = config.liftFactor * airspeed * airspeed;
    // Assisted trim supports a steady path even when the model is inverted.
    // The elevator/AoA contribution stalls smoothly; backward flow cannot lift.
    const trim = config.gravity / (config.liftFactor * config.cruiseSpeed ** 2) * tx;
    const stallT = Math.max(0, Math.min(1, (absoluteAngle - config.stallAngle) / (Math.PI / 2 - config.stallAngle)));
    const stallFade = 1 - stallT * stallT * (3 - 2 * stallT);
    const coefficient = absoluteAngle >= Math.PI / 2 ? 0 :
        Math.max(-config.maxLiftCoefficient, Math.min(config.maxLiftCoefficient, trim + config.liftSlope * angleOfAttack)) * stallFade;
    const lift = q * coefficient;
    const drag = config.quadraticDrag * airspeed * airspeed + q * config.inducedDrag * coefficient * coefficient;
    const thrust = config.thrust * (1 + config.turnThrustBoost * Math.min(1, Math.abs(control)));
    return {
        accelerationX: thrust * Math.cos(motion.pitch) - drag * tx - lift * ty,
        accelerationY: thrust * Math.sin(motion.pitch) - drag * ty + lift * tx - config.gravity,
        airspeed, angleOfAttack, lift, drag,
    };
}
