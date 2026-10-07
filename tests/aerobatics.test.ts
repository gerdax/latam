import test from "node:test";
import assert from "node:assert/strict";
import { createFlightState, defaultFlightConfig, flightOrientation, requestHalfRoll, stepFlight } from "../src/physics";
import { createCrashBody, rotateCrashPoint } from "../src/crash";
const flat = () => -100;
const config = { ...defaultFlightConfig, startAltitude: 30, viewportHeight: 200 };
const close = (a: number, b: number, t = 1e-8) => assert.ok(Math.abs(a - b) < t, `${a} != ${b}`);
test("held controls complete repeated loops and move backwards during figure", () => {
    for (const input of [1, -1]) {
        const s = createFlightState(-100, config);
        let backwards = false;
        for (let i = 0; i < 120 * 24; i++) {
            stepFlight(s, input, 1 / 120, flat, config);
            backwards ||= s.horizontalSpeed < 0;
            assert.equal(s.phase, "flying");
        }
        assert.ok(Math.abs(s.pitch) > Math.PI * 4);
        assert.ok(backwards);
        assert.ok(Math.abs(s.pitchVelocity) <= (input > 0 ? .7 : .85));
    }
});
test("changing pitch never overwrites persistent horizontal or vertical velocity", () => {
    const stationary = { ...config, pitchResponse: 0, neutralDrag: 0 };
    const s = createFlightState(-100, config);
    s.pitch = Math.PI / 2;
    s.horizontalSpeed = 8;
    s.velocity = 2;
    stepFlight(s, 0, 1 / 120, flat, stationary);
    assert.ok(s.horizontalSpeed > 7.8);
    assert.ok(Math.abs(s.velocity - 2) < .2);
});
test("reversing input brakes angular motion before changing direction", () => {
    const s = createFlightState(-100, config);
    stepFlight(s, 1, .5, flat, config);
    const p = s.pitch;
    stepFlight(s, -1, .1, flat, config);
    assert.ok(s.pitch > p);
    assert.ok(s.pitchVelocity > 0 && s.pitchVelocity < 1.2);
    stepFlight(s, -1, .5, flat, config);
    assert.ok(s.pitchVelocity < 0);
});
test("release selects nearest horizontal once and retains initial angular inertia", () => {
    const s = createFlightState(-100, config);
    s.pitch = 2.2;
    s.pitchVelocity = .8;
    s.neutralTarget = null;
    stepFlight(s, 0, .05, flat, config);
    assert.ok(s.pitch > 2.2);
    close(s.neutralTarget!, Math.PI);
    stepFlight(s, 0, 15, flat, config);
    close(s.pitch, Math.PI, .03);
    assert.ok(s.horizontalSpeed < 0);
    const vertical = createFlightState(-100, config);
    vertical.pitch = Math.PI / 2;
    vertical.neutralTarget = null;
    vertical.lastHorizontalDirection = -1;
    stepFlight(vertical, 0, 1 / 120, flat, config);
    close(vertical.neutralTarget!, Math.PI);
});
test("half roll lasts .6 seconds, does not change neutral path and ignores repeats", () => {
    const s = createFlightState(-100, config);
    assert.ok(requestHalfRoll(s));
    stepFlight(s, 0, .3, flat, config);
    close(s.roll, Math.PI / 2);
    assert.equal(requestHalfRoll(s), false);
    close(s.altitude, 30, .002);
    close(s.pitch, 0);
    stepFlight(s, 0, .3, flat, config);
    assert.equal(s.rollActive, false);
    close(s.roll, Math.PI);
    stepFlight(s, 1, .1, flat, config);
    assert.ok(s.pitch < 0);
    s.pitch = 0;
    s.pitchVelocity = 0;
    s.neutralTarget = 0;
    stepFlight(s, 0, .6, flat, config, true);
    close(s.roll, 2 * Math.PI);
    assert.equal(s.rollActive, false);
    s.phase = "parked";
    assert.equal(requestHalfRoll(s), false);
});
test("shared orientation composes body roll and pitch; crash factory preserves spin", () => {
    const s = createFlightState(-100, config);
    s.pitch = Math.PI;
    s.roll = Math.PI;
    const q = flightOrientation(s);
    const up = rotateCrashPoint(q, { x: 0, y: 1, z: 0 });
    close(up.y, 1);
    const nose = rotateCrashPoint(q, { x: 1, y: 0, z: 0 });
    close(nose.x, -1);
    const spin = { x: 2, y: 1, z: .8 };
    const body = createCrashBody(q, config.crashContactPoints, spin);
    assert.deepEqual(body.orientation, q);
    assert.deepEqual(body.angularVelocity, spin);
});
test("30 and 120 fps agree through loops, half rolls, ceiling and release", () => {
    const run = (fps: number) => {
        const s = createFlightState(-100, config);
        s.altitude = 285;
        for (const [segment, input] of [1, 1, 0, -1, 0].entries()) {
            for (let i = 0; i < fps; i++)
                stepFlight(s, input, 1 / fps, flat, config, segment === 1 && i === 0);
        }
        return s;
    };
    assert.deepEqual(run(30), run(120));
});
test("first collision during half roll preserves orientation and existing world spin", () => {
    const s = createFlightState(-100, config);
    requestHalfRoll(s);
    stepFlight(s, 1, .25, flat, config);
    s.altitude = -10;
    const noImpulse = { ...config, crashContactPoints: [{ x: 0, y: 0, z: 0 }], crashMaterial: { ...config.crashMaterial, friction: 0 } };
    stepFlight(s, 0, 1 / 120, () => 0, noImpulse);
    assert.equal(s.phase, "crashed");
    assert.ok(s.crashBody);
    assert.deepEqual(s.crashBody.orientation, flightOrientation(s));
    const t = s.rollElapsed / config.halfRollDuration;
    const rate = Math.PI * 6 * t * (1 - t) / config.halfRollDuration;
    close(s.crashBody.angularVelocity.x, Math.cos(s.pitch) * rate);
    close(s.crashBody.angularVelocity.y, Math.sin(s.pitch) * rate);
    close(s.crashBody.angularVelocity.z, s.pitchVelocity);
    stepFlight(s, 0, config.resetDelay, () => 0, config);
    assert.equal(s.roll, 0);
    assert.equal(s.rollElapsed, 0);
    assert.equal(s.pitchVelocity, 0);
});
test("roof and wing contacts rotate through full roll before crash detection", () => {
    for (const roll of [Math.PI, Math.PI / 2]) {
        const s = createFlightState(0, config);
        s.roll = roll;
        s.altitude = .3;
        stepFlight(s, 0, 1 / 120, () => 0, config);
        assert.equal(s.phase, "crashed");
        assert.deepEqual(s.crashBody!.orientation, flightOrientation(s));
    }
});
test("low-speed existing angular spin brakes without new low-speed rotation authority", () => {
    const s = createFlightState(-100, config);
    s.horizontalSpeed = .3;
    s.velocity = 0;
    s.pitchVelocity = .7;
    stepFlight(s, 0, .5, flat, config);
    assert.ok(s.pitchVelocity < .48);
    const controlled = createFlightState(-100, config);
    controlled.horizontalSpeed = .3;
    controlled.velocity = 0;
    stepFlight(controlled, 1, .5, flat, config);
    assert.ok(controlled.pitchVelocity < .05);
});
test("actual loop below ceiling has finite radius and slows at its climbing top", () => {
    const s = createFlightState(-100, config);
    s.altitude = 30;
    let minSpeed = 100, maxRate = 0, topRate = 1, xmin = 0, xmax = 0, ymin = 30, ymax = 30;
    for (let i = 0; i < 120 * 13 && s.pitch < 2 * Math.PI; i++) {
        stepFlight(s, 1, 1 / 120, flat, config);
        minSpeed = Math.min(minSpeed, Math.hypot(s.horizontalSpeed, s.velocity));
        maxRate = Math.max(maxRate, s.pitchVelocity);
        if (s.pitch > 2 && s.pitch < 3)
            topRate = Math.min(topRate, s.pitchVelocity);
        xmin = Math.min(xmin, s.distance);
        xmax = Math.max(xmax, s.distance);
        ymin = Math.min(ymin, s.altitude);
        ymax = Math.max(ymax, s.altitude);
    }
    assert.ok(s.pitch >= 2 * Math.PI);
    assert.ok(minSpeed > 7);
    assert.ok(xmax - xmin > 30 && ymax - ymin > 30);
    assert.ok(topRate < maxRate * .8);
});
test("first loop from default altitude completes over real terrain without stopping at ceiling", async () => {
    const { terrainHeight } = await import('../src/terrain');
    for (const startAltitude of [9, 22]) {
        const actual = { ...defaultFlightConfig, startAltitude };
        const s = createFlightState(terrainHeight(0), actual);
        let minSpeed = 100;
        for (let i = 0; i < 120 * 16 && s.pitch < 2 * Math.PI; i++) {
            stepFlight(s, 1, 1 / 120, terrainHeight, actual);
            assert.equal(s.phase, 'flying');
            minSpeed = Math.min(minSpeed, Math.hypot(s.horizontalSpeed, s.velocity));
        }
        assert.ok(s.pitch >= 2 * Math.PI);
        assert.ok(minSpeed > 4.5);
    }
});
test("high-ceiling energy loss stalls the aircraft rather than spinning it in place", () => {
    const actual = { ...defaultFlightConfig, startAltitude: 38 };
    const s = createFlightState(0, actual);
    let sawStall = false;
    for (let i = 0; i < 120 * 6; i++) {
        stepFlight(s, 1, 1 / 120, () => 0, actual);
        const speed = Math.hypot(s.horizontalSpeed, s.velocity);
        if (speed < 2) {
            sawStall = true;
            assert.ok(Math.abs(s.pitchVelocity) < .08);
        }
        assert.equal(s.phase, 'flying');
    }
    assert.ok(sawStall);
    assert.ok(s.pitch < Math.PI);
    assert.ok(s.distance > 20);
    assert.ok(s.velocity < 0);
});
