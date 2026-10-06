import test from "node:test";
import assert from "node:assert/strict";
import { airportTerrain, getAirport } from "../src/airports";
import {
  createFlightState,
  defaultFlightConfig,
  flightCeiling,
  stepFlight,
} from "../src/physics";

import { cessnaScale, cessnaGroundClearance } from "../src/aircraft-config";

const flat = () => 0;
const close = (actual: number, expected: number, tolerance = 1e-8) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} should be close to ${expected}`,
  );

test("start height clears terrain and forward speed is constant", () => {
  assert.equal(createFlightState(8).altitude, 12);
  const state = createFlightState(0);
  stepFlight(state, 0, 2, flat);
  close(state.distance, 14);
  close(state.altitude, 9);
});

test("descent accelerates faster and has a higher speed limit than climbing", () => {
  const climb = createFlightState(0);
  const descent = createFlightState(0);
  descent.altitude = 30;
  stepFlight(climb, 1, 0.2, flat);
  stepFlight(descent, -1, 0.2, flat);
  close(climb.velocity, 2);
  close(descent.velocity, -2.8);
  close(Math.abs(descent.velocity / climb.velocity), 1.4);
  stepFlight(climb, 1, 1.2, flat);
  stepFlight(descent, -1, 1.2, flat);
  close(climb.velocity, 10);
  close(descent.velocity, -18);
  close(Math.abs(descent.velocity / climb.velocity), 1.8);
});

test("neutral input preserves inertia while drag smoothly reduces speed", () => {
  const state = createFlightState(0);
  stepFlight(state, 1, 0.4, flat);
  const initialAltitude = state.altitude;
  stepFlight(state, 0, 0.5, flat);
  assert.ok(state.altitude > initialAltitude);
  close(state.velocity, 4 * Math.exp(-defaultFlightConfig.neutralDrag * 0.5));
  assert.ok(state.pitch > 0);
});

test("reversing controls brakes existing motion before descending", () => {
  const state = createFlightState(0);
  stepFlight(state, 1, 0.4, flat);
  const altitude = state.altitude;
  stepFlight(state, -1, 0.1, flat);
  assert.ok(state.velocity > 0 && state.velocity < 4);
  assert.ok(state.altitude > altitude);
  stepFlight(state, -1, 0.3, flat);
  assert.ok(state.velocity < 0);
});

test("different caller frame rates produce the same trajectory", () => {
  const simulate = (fps: number) => {
    const state = createFlightState(0);
    for (const input of [1, 0, -1, 0]) {
      for (let i = 0; i < fps; i++) stepFlight(state, input, 1 / fps, flat);
    }
    return state;
  };
  const slow = simulate(30);
  const fast = simulate(120);
  close(slow.altitude, fast.altitude);
  close(slow.velocity, fast.velocity);
  close(slow.distance, fast.distance);
  close(slow.pitch, fast.pitch);
});

test("ceiling stops upward velocity and permits immediate descent", () => {
  const state = createFlightState(0);
  stepFlight(state, 1, 6, flat);
  assert.equal(state.altitude, 40);
  assert.equal(state.velocity, 0);
  stepFlight(state, -1, 0.1, flat);
  assert.ok(state.altitude < 40);
  assert.ok(state.velocity < 0);
});

test("ceiling gently slows climb through the final four units of altitude", () => {
  const state = createFlightState(0);
  state.altitude = 38;
  state.velocity = 10;
  stepFlight(state, 1, 1 / 120, flat);
  assert.ok(state.velocity > 0 && state.velocity < 10);
  assert.ok(state.altitude > 38 && state.altitude < 40);
  const firstSpeed = state.velocity;
  stepFlight(state, 1, 0.1, flat);
  assert.ok(state.velocity > 0 && state.velocity < firstSpeed);
});

test("cruise maneuvers reach approximately 55 degrees up and 69 degrees down", () => {
  const climb = createFlightState(0);
  climb.velocity = defaultFlightConfig.maxClimbSpeed;
  stepFlight(climb, 1, 1.2, flat);
  close((climb.pitch * 180) / Math.PI, 55, 0.3);
  const descent = createFlightState(0);
  descent.altitude = 35;
  descent.velocity = -defaultFlightConfig.maxDescentSpeed;
  stepFlight(descent, -1, 1.2, flat);
  close((descent.pitch * 180) / Math.PI, -69, 0.5);
  assert.equal(descent.phase, "flying");
});

test("opposite input also brakes downward inertia before reversing it", () => {
  const state = createFlightState(0);
  stepFlight(state, -1, 0.4, flat);
  const altitude = state.altitude;
  stepFlight(state, 1, 0.1, flat);
  close(state.velocity, -4.6);
  assert.ok(state.altitude < altitude);
  stepFlight(state, 1, 0.5, flat);
  assert.ok(state.velocity > 0);
  assert.equal(state.phase, "flying");
});

test("ceiling is two viewport heights above the terrain under the aircraft", () => {
  for (const height of [-100, 0, 12]) {
    const terrain = () => height;
    const state = createFlightState(height);
    state.altitude = height + 9;
    stepFlight(state, 1, 6, terrain);
    close(state.altitude, height + 40);
    close(state.velocity, 0);
    assert.equal(state.phase, "flying");
  }
  const terrain = (x: number, z = 0) => 3 + x * 0.1 + z * 100;
  close(flightCeiling(10, terrain), 44);
  close(
    flightCeiling(10, terrain, { ...defaultFlightConfig, viewportHeight: 24 }),
    52,
  );
});

test("portrait ceiling permits eight more units of climb", () => {
  const config = { ...defaultFlightConfig, viewportHeight: 24 };
  const state = createFlightState(0, config);
  stepFlight(state, 1, 7, flat, config);
  close(state.altitude, 48);
  close(state.velocity, 0);
});

test("lowering the viewport ceiling stops rise without teleporting and allows descent", () => {
  const portrait = { ...defaultFlightConfig, viewportHeight: 24 };
  const state = createFlightState(0, portrait);
  state.altitude = 46;
  state.velocity = 5;
  stepFlight(state, 1, 0.5, flat);
  close(state.altitude, 46);
  close(state.velocity, 0);
  stepFlight(state, -1, 1, flat);
  close(state.altitude, 39);
  assert.ok(state.velocity < 0);
  stepFlight(state, 1, 4, flat);
  close(state.altitude, 40);
  close(state.velocity, 0);
});

test("descending terrain lowers the ceiling without moving an aircraft downward", () => {
  const terrain = (x: number) => (x < 1 ? 10 : 0);
  const state = createFlightState(10);
  state.altitude = 45;
  state.velocity = 0;
  stepFlight(state, 1, 0.5, terrain);
  assert.ok(state.altitude >= 45 && state.altitude < 46);
  close(state.velocity, 0);
  const altitude = state.altitude;
  stepFlight(state, 1, 0.5, terrain);
  close(state.altitude, altitude);
  stepFlight(state, -1, 0.5, terrain);
  assert.ok(state.altitude < altitude);
});

test("ceiling approach agrees at 30 and 120 frames per second", () => {
  const simulate = (fps: number) => {
    const state = createFlightState(0);
    for (let i = 0; i < fps * 6; i++) stepFlight(state, 1, 1 / fps, flat);
    for (let i = 0; i < fps; i++) stepFlight(state, -1, 1 / fps, flat);
    return state;
  };
  assert.deepEqual(simulate(30), simulate(120));
});

test("nose terrain collision retains motion, ignores controls and restarts after settling", () => {
  const state = createFlightState(0);
  const terrain = (x: number) => (x > 0.65 ? 9 : 0);
  stepFlight(state, 0, 1 / 120, terrain);
  assert.equal(state.phase, "crashed");
  assert.ok(state.crashBody);
  const distance = state.distance;
  const other = structuredClone(state);
  stepFlight(state, 1, 0.9, terrain);
  stepFlight(other, -1, 0.9, terrain);
  assert.deepEqual(state, other);
  assert.equal(state.phase, "crashed");
  assert.notEqual(state.distance, distance);
  stepFlight(state, 1, 2.1, terrain);
  assert.equal(state.phase, "flying");
  assert.equal(state.crashBody, null);
  assert.ok(state.altitude >= 13);
  assert.equal(state.velocity, 0);
  assert.equal(state.horizontalSpeed, defaultFlightConfig.forwardSpeed);
  assert.equal(state.crashTime, 0);
});

test("level main wheels collide before the old fuselage radius reaches ground", () => {
  const state = createFlightState(0);
  state.altitude = cessnaGroundClearance - 0.09 * cessnaScale;
  stepFlight(state, 0, 1 / 120, () => 0);
  assert.equal(state.phase, "crashed");
});

test("pitch transforms nose and tail contacts into the terrain frame", () => {
  for (const pitch of [-0.5, 0.5]) {
    const state = createFlightState(0);
    state.altitude = 0.9 * cessnaScale;
    state.pitch = pitch;
    stepFlight(state, 0, 1 / 120, () => 0);
    assert.equal(
      state.phase,
      "crashed",
      `pitch ${pitch} should strike terrain`,
    );
  }
  const level = createFlightState(0);
  level.altitude = 0.9 * cessnaScale;
  stepFlight(level, 0, 1 / 120, () => 0);
  assert.equal(level.phase, "flying");
});

test("wing span samples lateral terrain and reset clears every contact", () => {
  const state = createFlightState(0);
  const terrain = (_x: number, z = 0) =>
    Math.abs(z) > 1.8 * cessnaScale ? 10 : 0;
  stepFlight(state, 0, 1 / 120, terrain);
  assert.equal(state.phase, "crashed");
  stepFlight(state, 0, defaultFlightConfig.resetDelay, terrain);
  assert.equal(state.phase, "flying");
  for (const point of defaultFlightConfig.contactPoints) {
    assert.ok(
      state.altitude + point.y >=
        terrain(state.distance + point.x, point.z) + 4 - 1e-8,
    );
  }
});

test("terrain lookup uses the pitched horizontal contact position", () => {
  const pitch = -0.5;
  const point = { x: 1, y: -0.5, z: 0.25 };
  const expectedX = point.x * Math.cos(pitch) - point.y * Math.sin(pitch);
  const config = {
    ...defaultFlightConfig,
    forwardSpeed: 0,
    pitchResponse: 0,
    contactPoints: [point],
  };
  const state = createFlightState(0, config);
  state.altitude = 2;
  state.pitch = pitch;
  const terrain = (x: number, z = 0) =>
    Math.abs(x - expectedX) < 0.01 && z === point.z ? 1.1 : -100;
  stepFlight(state, 0, 1 / 120, terrain, config);
  assert.equal(state.phase, "crashed");
});

test("invalid delta is ignored and oversized input is clamped", () => {
  const state = createFlightState(0);
  const unchanged = { ...state };
  stepFlight(state, 1, NaN, flat);
  stepFlight(state, 1, -1, flat);
  assert.deepEqual(state, unchanged);
  stepFlight(state, 100, 0.2, flat);
  close(state.velocity, 2);
});

const airport = getAirport(0);
const runwayTerrain = (x: number, z = 0) => airportTerrain(x, z, 0);
const approach = () => ({
  ...createFlightState(airport.elevation),
  distance: airport.start + 10,
  altitude: airport.elevation + cessnaGroundClearance + 0.01,
  velocity: -1,
});

test("gentle wheel touchdown aligns the aircraft and brakes to a parked stop", () => {
  const state = approach();
  stepFlight(state, 0, 0.025, runwayTerrain);
  assert.equal(state.phase, "rolling");
  assert.equal(state.pitch, 0);
  assert.equal(state.velocity, 0);
  close(state.altitude, airport.elevation + cessnaGroundClearance);
  const touchdownDistance = state.distance;
  const touchdownSpeed = state.horizontalSpeed;
  stepFlight(state, 0, 4, runwayTerrain);
  assert.equal(state.phase, "parked");
  assert.equal(state.horizontalSpeed, 0);
  close(state.distance - touchdownDistance, touchdownSpeed ** 2 / 4, 0.0001);
  const parked = { ...state };
  stepFlight(state, -1, 2, runwayTerrain);
  assert.deepEqual(state, parked);
});

test("released controls gently flare just above the runway for a slightly steeper approach", () => {
  const state = approach();
  state.altitude =
    airport.elevation + defaultFlightConfig.groundClearance + 0.65;
  state.velocity = -2;
  state.pitch = -0.28;
  stepFlight(state, 0, 0.8, runwayTerrain);
  assert.equal(state.phase, "rolling");
  assert.equal(state.pitch, 0);
});

test("landing assist does not override deliberate input or soften a fast dive", () => {
  const intentional = approach();
  intentional.altitude += 0.65;
  intentional.pitch = -0.15;
  stepFlight(intentional, -0.5, 1 / 120, runwayTerrain);
  assert.ok(intentional.pitch < -0.15);
  const hard = approach();
  hard.velocity = -4;
  stepFlight(hard, 0, 0.025, runwayTerrain);
  assert.equal(hard.phase, "crashed");
});

test("hard, pitched, body-first and off-runway impacts crash", () => {
  const hard = approach();
  hard.velocity = -2.5;
  const pitched = approach();
  pitched.pitch = 0.3;
  const body = approach();
  body.altitude = airport.elevation + 0.2;
  const outside = approach();
  outside.distance = airport.start + 0.5;
  for (const [name, state] of Object.entries({
    hard,
    pitched,
    body,
    outside,
  })) {
    stepFlight(state, 0, 0.025, runwayTerrain);
    assert.equal(state.phase, "crashed", name);
    assert.ok(Number.isFinite(state.horizontalSpeed));
    assert.ok(state.crashBody);
  }
});

test("raised terrain under a body contact prevents otherwise gentle touchdown", () => {
  const state = approach();
  const bodyTerrain = (x: number, z = 0) =>
    Math.abs(x - (state.distance - 1.92 * cessnaScale)) < 0.15 &&
    Math.abs(z) < 0.1
      ? airport.elevation + 0.6
      : runwayTerrain(x, z);
  stepFlight(state, 0, 1 / 120, bodyTerrain);
  assert.equal(state.phase, "crashed");
});

test("holding up accelerates from parked, lifts off and returns to cruise speed", () => {
  const state = approach();
  state.phase = "parked";
  state.horizontalSpeed = 0;
  state.velocity = 0;
  stepFlight(state, 1, 1, runwayTerrain);
  assert.equal(state.phase, "takeoff");
  close(state.horizontalSpeed, 2.8);
  close(state.altitude, airport.elevation + cessnaGroundClearance);
  stepFlight(state, 1, 1.2, runwayTerrain);
  assert.equal(state.phase, "flying");
  assert.ok(state.altitude > airport.elevation + cessnaGroundClearance);
  assert.ok(state.velocity >= 1.5);
  assert.ok(state.horizontalSpeed >= 6 && state.horizontalSpeed < 7);
  stepFlight(state, 1, 0.4, runwayTerrain);
  close(state.horizontalSpeed, 7);
});

test("releasing up aborts takeoff and a brief tap cannot launch automatically", () => {
  const state = approach();
  state.phase = "parked";
  state.horizontalSpeed = 0;
  state.velocity = 0;
  stepFlight(state, 0.15, 0.1, runwayTerrain);
  assert.equal(state.phase, "parked");
  stepFlight(state, 1, 0.2, runwayTerrain);
  assert.equal(state.phase, "takeoff");
  stepFlight(state, 0, 0.1, runwayTerrain);
  assert.equal(state.phase, "rolling");
  stepFlight(state, 0, 2, runwayTerrain);
  assert.equal(state.phase, "parked");
  assert.equal(state.horizontalSpeed, 0);
  close(state.altitude, airport.elevation + cessnaGroundClearance);
});

test("the full aircraft envelope must stay on runway during ground roll", () => {
  const state = approach();
  state.distance = airport.end - 1.1;
  state.phase = "rolling";
  state.velocity = 0;
  stepFlight(state, 0, 0.05, runwayTerrain);
  assert.equal(state.phase, "crashed");
  const impactDistance = state.distance;
  stepFlight(state, 0, defaultFlightConfig.resetDelay, runwayTerrain);
  assert.equal(state.phase, "flying");
  close(state.horizontalSpeed, 7);
  assert.ok(state.distance >= impactDistance);
});

test("touchdown and braking agree across caller frame rates", () => {
  const simulate = (fps: number) => {
    const state = approach();
    for (let i = 0; i < fps * 4; i++)
      stepFlight(state, 0, 1 / fps, runwayTerrain);
    return state;
  };
  assert.deepEqual(simulate(30), simulate(120));
});

test("aircraft configurations can tune touchdown, ground clearance and launch", () => {
  const strict = approach();
  stepFlight(strict, 0, 0.025, runwayTerrain, {
    ...defaultFlightConfig,
    maxLandingDescentSpeed: 0.5,
  });
  assert.equal(strict.phase, "crashed");

  const state = approach();
  state.phase = "parked";
  state.horizontalSpeed = 0;
  state.velocity = 0;
  const config = {
    ...defaultFlightConfig,
    groundClearance: 1,
    takeoffAcceleration: 4,
    takeoffSpeed: 3,
    groundDeceleration: 4,
  };
  stepFlight(state, 1, 0.5, runwayTerrain, config);
  close(state.horizontalSpeed, 2);
  close(state.altitude, airport.elevation + 1);
  stepFlight(state, 0, 0.5, runwayTerrain, config);
  assert.equal(state.phase, "parked");
  stepFlight(state, 1, 0.8, runwayTerrain, config);
  assert.equal(state.phase, "flying");
});

test("runway overrun preserves departure speed, falls under gravity and resets cleanly", () => {
  const state = approach();
  state.distance = airport.end + 2;
  state.phase = "rolling";
  state.altitude = 5;
  state.velocity = 0;
  const lowTerrain = () => -2;
  stepFlight(state, 0, 1 / 120, lowTerrain);
  assert.equal(state.phase, "crashed");
  close(state.horizontalSpeed, defaultFlightConfig.forwardSpeed);
  const impactAltitude = state.altitude;
  const initialDistance = state.distance;
  stepFlight(state, 1, 0.5, lowTerrain);
  assert.ok(state.altitude < impactAltitude);
  assert.ok(state.distance > initialDistance);
  assert.ok(state.velocity < 0);
  stepFlight(state, 0, defaultFlightConfig.resetDelay - 0.5, lowTerrain);
  assert.equal(state.phase, "flying");
  assert.equal(state.crashBody, null);
  assert.equal(state.pitch, 0);
  assert.equal(state.velocity, 0);
  assert.equal(state.horizontalSpeed, defaultFlightConfig.forwardSpeed);
});
