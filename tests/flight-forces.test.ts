import test from "node:test";
import assert from "node:assert/strict";
import { calculateFlightForces, defaultFlightForces } from "../src/flight-forces";
const close = (a: number, b: number, t = 1e-8) => assert.ok(Math.abs(a - b) < t, `${a} != ${b}`);
test("trim lift balances gravity at configured cruise without prescribing velocity", () => {
    const f = calculateFlightForces({ horizontalSpeed: 11, velocity: 0, pitch: 0 }, 0);
    close(f.accelerationY, 0);
    assert.ok(Math.abs(f.accelerationX) < .03);
});
test("aerodynamic lift is perpendicular to flow and drag dissipates kinetic energy", () => {
    const config = { ...defaultFlightForces, gravity: 0, thrust: 0 };
    const motion = { horizontalSpeed: 8, velocity: 3, pitch: .7 };
    const f = calculateFlightForces(motion, 0, config);
    close(f.accelerationX * motion.horizontalSpeed + f.accelerationY * motion.velocity, -f.drag * f.airspeed);
    assert.ok(f.lift > 0 && f.drag > 0);
});
test("stall lift fades continuously at ninety degrees and vanishes in backward flow", () => {
    const forward = { horizontalSpeed: 11, velocity: 0, pitch: 0 };
    const quarter = calculateFlightForces({ ...forward, pitch: Math.PI / 2 - 1e-5 }, 0);
    assert.ok(Math.abs(quarter.lift) < 1e-6);
    for (const pitch of [Math.PI / 2, Math.PI, -Math.PI / 2]) {
        close(calculateFlightForces({ ...forward, pitch }, 0).lift, 0);
    }
});
test("quadratic lift falls at low speed and sustained input adds bounded thrust", () => {
    const a = calculateFlightForces({ horizontalSpeed: 11, velocity: 0, pitch: .1 }, 0);
    const b = calculateFlightForces({ horizontalSpeed: 5.5, velocity: 0, pitch: .1 }, 0);
    close(b.lift, a.lift / 4);
    const boosted = calculateFlightForces({ horizontalSpeed: 11, velocity: 0, pitch: .1 }, 1);
    close(boosted.accelerationX - a.accelerationX, defaultFlightForces.thrust * .4 * Math.cos(.1));
});
