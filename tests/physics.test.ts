import test from "node:test";
import assert from "node:assert/strict";
import { airportTerrain, getAirport } from "../src/airports";
import { createFlightState, defaultFlightConfig, flightCeiling, flightOrientation, stepFlight } from "../src/physics";
import { rotateCrashPoint } from "../src/crash";
import { cessnaScale, cessnaGroundClearance } from "../src/aircraft-config";
const flat = () => 0;
const close = (a: number, b: number, t = 1e-8) => assert.ok(Math.abs(a - b) <= t, `${a} != ${b}`);
const holdAngle = { ...defaultFlightConfig, pitchResponse: 0, neutralDrag: 0 };
test("level cruise clears terrain and moves at configured speed", () => {
    assert.equal(createFlightState(8).altitude, 12);
    const s = createFlightState(0);
    stepFlight(s, 0, 2, flat);
    close(s.distance, 22, .1);
    close(s.altitude, 9, .01);
});
test("invalid delta ignored and controls clamped", () => {
    const s = createFlightState(0), copy = structuredClone(s);
    stepFlight(s, 1, NaN, flat);
    stepFlight(s, 1, -1, flat);
    assert.deepEqual(s, copy);
    const other = createFlightState(0);
    stepFlight(s, 100, .2, flat);
    stepFlight(other, 1, .2, flat);
    assert.deepEqual(s, other);
});
test("ceiling follows terrain and viewport while resize preserves actual motion", () => {
    close(flightCeiling(10, x => 3 + x * .1), 44);
    close(flightCeiling(0, flat, { ...defaultFlightConfig, viewportHeight: 24 }), 48);
    const s = createFlightState(0);
    s.altitude = 46;
    s.velocity = 4;
    s.pitch = .3;
    stepFlight(s, 0, 1 / 120, flat);
    assert.ok(s.altitude > 46);
    assert.ok(s.velocity > 3.8);
});
test("ceiling field brakes gently while allowing overshoot and pitch rotation", () => {
    const s = createFlightState(0);
    s.altitude = 40;
    s.velocity = 5;
    s.pitch = .5;
    const angle = s.pitch;
    stepFlight(s, 1, .1, flat);
    assert.ok(s.pitch > angle);
    assert.ok(s.altitude > 40);
    assert.ok(s.velocity > 4);
});
test("nose and pitched body contacts trigger crash and reset all aerobatic state", () => {
    const s = createFlightState(0);
    const terrain = (x: number) => x > .65 ? 9 : 0;
    stepFlight(s, 0, 1 / 120, terrain);
    assert.equal(s.phase, "crashed");
    const copy = structuredClone(s);
    stepFlight(s, 1, .9, terrain);
    stepFlight(copy, -1, .9, terrain);
    assert.deepEqual(s, copy);
    stepFlight(s, 0, 2.1, terrain);
    assert.equal(s.phase, "flying");
    assert.equal(s.roll, 0);
    assert.equal(s.pitchVelocity, 0);
    assert.equal(s.rollActive, false);
    assert.equal(s.crashBody, null);
    for (const pitch of [-.5, .5]) {
        const p = createFlightState(0);
        p.altitude = .9 * cessnaScale;
        p.pitch = pitch;
        stepFlight(p, 0, 1 / 120, flat);
        assert.equal(p.phase, "crashed");
    }
});
test("lateral terrain contacts use full quaternion and reset clears every hull sample", () => {
    const s = createFlightState(0);
    const terrain = (_x: number, z = 0) => Math.abs(z) > 1.8 * cessnaScale ? 10 : 0;
    stepFlight(s, 0, 1 / 120, terrain);
    assert.equal(s.phase, "crashed");
    stepFlight(s, 0, 3, terrain);
    assert.equal(s.phase, "flying");
    for (const point of defaultFlightConfig.contactPoints) {
        const r = rotateCrashPoint(flightOrientation(s), point);
        assert.ok(s.altitude + r.y >= terrain(s.distance + r.x, r.z) + 4 - 1e-8);
    }
});
const airport = getAirport(0);
const runway = (x: number, z = 0) => airportTerrain(x, z, 0);
function approach(left = false) {
    const s = createFlightState(0);
    s.distance = left ? airport.end - 10 : airport.start + 10;
    s.altitude = airport.elevation + cessnaGroundClearance + .01;
    s.pitch = left ? Math.PI + .05 : -.05;
    s.roll = left ? Math.PI : 0;
    s.neutralTarget = null;
    s.lastHorizontalDirection = left ? -1 : 1;
    s.horizontalSpeed = left ? -11 : 11;
    s.velocity = -.8;
    return s;
}
test("upright gentle landing brakes to stop in both directions", () => {
    for (const left of [false, true]) {
        const s = approach(left);
        stepFlight(s, 0, .1, runway);
        assert.equal(s.phase, "rolling");
        close(s.pitch, left ? Math.PI : 0);
        close(s.roll, left ? Math.PI : 0);
        const d = s.distance;
        stepFlight(s, 0, 6, runway);
        assert.equal(s.phase, "parked");
        assert.ok(left ? s.distance < d : s.distance > d);
        const p = structuredClone(s);
        stepFlight(s, -1, 1, runway);
        assert.deepEqual(s, p);
    }
});
test("hard dives, inverted aircraft, body-first and off-runway impacts crash", () => {
    const hard = approach();
    hard.pitch = -.3;
    hard.altitude -= .02;
    const inverted = approach();
    inverted.roll = Math.PI;
    inverted.altitude = airport.elevation + .4;
    const body = approach();
    body.altitude = airport.elevation + .2;
    const outside = approach();
    outside.distance = airport.start + .5;
    outside.altitude -= .03;
    for (const s of [hard, inverted, body, outside]) {
        stepFlight(s, 0, 1 / 120, runway);
        assert.equal(s.phase, "crashed", JSON.stringify({ pitch: s.pitch, roll: s.roll, altitude: s.altitude, distance: s.distance }));
        assert.ok(s.crashBody);
    }
});
test("up takes off from parked preserving heading and roll, release aborts", () => {
    for (const left of [false, true]) {
        const s = approach(left);
        s.phase = "parked";
        s.pitch = left ? Math.PI : 0;
        s.horizontalSpeed = 0;
        s.velocity = 0;
        stepFlight(s, 1, 1, runway);
        assert.equal(s.phase, "takeoff");
        close(Math.abs(s.horizontalSpeed), 2.8);
        stepFlight(s, 1, 2.2, runway);
        assert.equal(s.phase, "flying");
        assert.ok(s.altitude > airport.elevation + cessnaGroundClearance);
        assert.ok(s.velocity > 0);
        assert.equal(Math.sign(s.horizontalSpeed), left ? -1 : 1);
        close(s.roll, left ? Math.PI : 0);
    }
    const s = approach();
    s.phase = "parked";
    s.horizontalSpeed = 0;
    stepFlight(s, 1, .2, runway);
    stepFlight(s, 0, 2, runway);
    assert.equal(s.phase, "parked");
});
test("both runway ends enforce whole rotated aircraft envelope", () => {
    for (const left of [false, true]) {
        const s = approach(left);
        s.phase = "rolling";
        s.pitch = left ? Math.PI : 0;
        s.distance = left ? airport.start + 1.1 : airport.end - 1.1;
        stepFlight(s, 0, .05, runway);
        assert.equal(s.phase, "crashed");
    }
});
test("touchdown and braking match 30 and 120 fps", () => {
    const run = (fps: number) => {
        const s = approach();
        for (let i = 0; i < fps * 6; i++)
            stepFlight(s, 0, 1 / fps, runway);
        return s;
    };
    assert.deepEqual(run(30), run(120));
});
test("backward-moving touchdown cannot reverse persistent velocity through landing logic", () => {
    const s=approach(true);s.horizontalSpeed=11;s.pitch=Math.PI;s.altitude=airport.elevation+cessnaGroundClearance;s.velocity=-.5;
    stepFlight(s,0,1/120,runway);assert.equal(s.phase,"crashed");
});
