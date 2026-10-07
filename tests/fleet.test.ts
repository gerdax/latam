import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { aircraftOptions, createAircraft } from "../src/fleet";
import {
  cessnaContacts,
  cessnaCrashContacts,
  cessnaGroundClearance,
  cessnaScale,
} from "../src/aircraft-config";
import { getAirport, airportTerrain } from "../src/airports";
import {
  createFlightState,
  defaultFlightConfig,
  stepFlight,
} from "../src/physics";

function vertices(group: T.Group, wheelsOnly = false): T.Vector3[] {
  const result: T.Vector3[] = [];
  group.updateMatrixWorld(true);
  group.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    if (wheelsOnly && object.userData.part !== "wheel") return;
    const positions = object.geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      result.push(
        new T.Vector3()
          .fromBufferAttribute(positions, i)
          .applyMatrix4(object.matrixWorld),
      );
    }
  });
  return result;
}

test("Cessna catalog entry preserves the original flight geometry and contacts", () => {
  const aircraft = createAircraft("cessna");
  assert.equal(aircraft.contactPoints, cessnaContacts);
  assert.equal(aircraft.crashContactPoints, cessnaCrashContacts);
  assert.equal(aircraft.scale, cessnaScale);
  assert.equal(aircraft.groundClearance, cessnaGroundClearance);
  assert.equal(aircraft.wheelContactCount, 8);
});

for (const { id } of aircraftOptions) {
  test(`${id}: starts clear, lands gently, launches, and crashes on a hard impact`, () => {
    const aircraft = createAircraft(id);
    const config = {
      ...defaultFlightConfig,
      contactPoints: aircraft.contactPoints,
      crashContactPoints: aircraft.crashContactPoints,
      groundClearance: aircraft.groundClearance,
      wheelContactCount: aircraft.wheelContactCount,
    };
    const airport = getAirport(0);
    const terrain = (x: number, z = 0) => airportTerrain(x, z, -20);
    const start = createFlightState(terrain(0), config);
    assert.ok(start.altitude > terrain(0) + aircraft.groundClearance);
    stepFlight(start, 0, 0.1, terrain, config);
    assert.equal(start.phase, "flying");
    const approach = () => ({
      ...createFlightState(0, config),
      distance: airport.start + 20,
      altitude: airport.elevation + aircraft.groundClearance + 0.005,
      velocity: -1,
      pitch: -0.035,
      neutralTarget: null,
    });
    const landing = approach();
    stepFlight(landing, 0, 0.025, terrain, config);
    assert.equal(landing.phase, "rolling");
    assert.equal(
      landing.altitude,
      airport.elevation + aircraft.groundClearance,
    );
    const touchdownSpeed = Math.abs(landing.horizontalSpeed);
    stepFlight(landing, 0, .5, terrain, config);
    assert.equal(landing.phase, "rolling");
    assert.ok(Math.abs(landing.horizontalSpeed) > touchdownSpeed - .2);
    stepFlight(landing, -1, 3, terrain, config);
    assert.equal(landing.phase, "parked");
    const takeoff = approach();
    takeoff.phase = "parked";
    takeoff.horizontalSpeed = 0;
    takeoff.velocity = 0;
    takeoff.pitch = 0;
    stepFlight(takeoff, 1, 3.5, terrain, config);
    assert.equal(takeoff.phase, "flying");
    assert.ok(takeoff.altitude > airport.elevation + aircraft.groundClearance);
    const hard = approach();
    hard.velocity = -4;
    hard.pitch = -0.3;
    stepFlight(hard, 0, 0.025, terrain, config);
    assert.equal(hard.phase, "crashed");
    assert.ok(hard.crashBody);
    stepFlight(hard, 0, 0.5, terrain, config);
    assert.ok(Number.isFinite(hard.altitude));
    assert.ok(Number.isFinite(hard.velocity));
  });
  if (id === "cessna") continue;
  test(`${id}: scaled geometry has exact wheel clearance and a bounded complete crash hull`, () => {
    const aircraft = createAircraft(id);
    const meshVertices = vertices(aircraft.group);
    const wheelVertices = vertices(aircraft.group, true);
    const model = aircraft.group.children[0];
    assert.equal(
      model.scale.x,
      { transport: 0.5, passenger: 0.48, military: 0.65 }[id],
    );
    assert.equal(aircraft.group.scale.x, 1);
    assert.equal(aircraft.scale, 1);
    assert.equal(aircraft.wheels.length, 3);
    assert.equal(aircraft.wheelContactCount, 12);
    assert.ok(
      Math.abs(
        aircraft.groundClearance + Math.min(...wheelVertices.map((p) => p.y)),
      ) < 1e-10,
    );
    assert.ok(
      aircraft.contactPoints
        .slice(aircraft.wheelContactCount)
        .every((point) => point.y + aircraft.groundClearance > 0),
    );
    assert.ok(aircraft.crashContactPoints.length < 200);
    assert.ok(
      aircraft.crashContactPoints.every((point) =>
        [point.x, point.y, point.z].every(Number.isFinite),
      ),
    );
    // Arbitrary pitch, roll and yaw support directions must cover every visible vertex.
    for (let i = 0; i < 80; i++) {
      const direction = new T.Vector3(
        Math.sin(i * 1.3),
        Math.cos(i * 0.7),
        Math.sin(i * 0.43),
      ).normalize();
      const visualSupport = Math.max(
        ...meshVertices.map((point) => point.dot(direction)),
      );
      const hullSupport = Math.max(
        ...aircraft.crashContactPoints.map(
          (p) => p.x * direction.x + p.y * direction.y + p.z * direction.z,
        ),
      );
      assert.ok(hullSupport >= visualSupport - 1e-7, `support direction ${i}`);
    }
  });
}

test("transport propellers rotate about their own engines and catalog instances own their assets", () => {
  const first = createAircraft("transport");
  const second = createAircraft("transport");
  assert.equal(first.propellers?.length, 2);
  assert.equal(first.propeller.children.length, 0);
  for (const propeller of first.propellers!) {
    const before = propeller.getWorldPosition(new T.Vector3());
    propeller.rotation.x += 1.2;
    first.group.updateMatrixWorld(true);
    assert.ok(
      before.distanceTo(propeller.getWorldPosition(new T.Vector3())) < 1e-10,
    );
  }
  const rotatedVertices = vertices(first.group);
  for (let i = 0; i < 80; i++) {
    const direction = new T.Vector3(
      Math.sin(i * 1.3),
      Math.cos(i * 0.7),
      Math.sin(i * 0.43),
    ).normalize();
    const support = Math.max(
      ...first.crashContactPoints.map(
        (p) => p.x * direction.x + p.y * direction.y + p.z * direction.z,
      ),
    );
    assert.ok(
      support >=
        Math.max(...rotatedVertices.map((p) => p.dot(direction))) - 1e-7,
    );
  }
  assert.notEqual(first.wheels[0].geometry, second.wheels[0].geometry);
  assert.notEqual(first.wheels[0].material, second.wheels[0].material);
  assert.equal(createAircraft("passenger").propellers?.length, 0);
  assert.equal(createAircraft("military").propellers?.length, 0);
});
test('every aircraft completes loops and a half roll with its own collision hull', () => {
  for (const {id} of aircraftOptions) {
    const aircraft = createAircraft(id);
    const config = {...defaultFlightConfig, startAltitude: 30, viewportHeight: 200,
      contactPoints: aircraft.contactPoints, crashContactPoints: aircraft.crashContactPoints,
      groundClearance: aircraft.groundClearance, wheelContactCount: aircraft.wheelContactCount};
    const state = createFlightState(-100, config);
    for (let i = 0; i < 1440; i++) stepFlight(state, 1, 1/120, () => -100, config);
    assert.equal(state.phase, 'flying', id);
    assert.ok(state.pitch > 2*Math.PI, id);
    stepFlight(state, 0, .6, () => -100, config, true);
    assert.equal(state.phase, 'flying', id);
    assert.ok(Math.abs(state.roll - Math.PI) < 1e-10, id);
  }
});
