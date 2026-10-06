import test from "node:test";
import assert from "node:assert/strict";
import {
  createCrashBody,
  defaultCrashMaterial,
  resolveCrashContacts,
  rotateCrashPoint,
  stepCrash,
  type CrashBody,
  type CrashMotion,
} from "../src/crash";
import { cessnaCrashContacts } from "../src/aircraft-config";
import { createCessna } from "../src/aircraft";
import { terrainHeight } from "../src/terrain";
import { Mesh, Vector3 } from "three";
const flat = () => 0;
const close = (actual: number, expected: number, tolerance = 1e-8) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} != ${expected}`,
  );
const material = {
  ...defaultCrashMaterial,
  gravity: 0,
  friction: 0,
  linearDrag: 0,
  angularDrag: 0,
};
const motion = (): CrashMotion => ({
  distance: 0,
  altitude: 0,
  horizontalSpeed: 0,
  velocity: -4,
});
test("visible propeller sweep stays above terrain during diagonal crash rotation", () => {
  const aircraft = createCessna();
  aircraft.group.updateMatrixWorld(true);
  const disk = aircraft.propeller.children[1] as Mesh;
  const vertices = disk.geometry.getAttribute("position");
  const points = Array.from({ length: vertices.count }, (_, i) =>
    disk.localToWorld(new Vector3().fromBufferAttribute(vertices, i)),
  );
  const m = { distance: 120, altitude: 0.6, horizontalSpeed: 7, velocity: -4 };
  const b = createCrashBody(0.2, cessnaCrashContacts);
  resolveCrashContacts(m, b, terrainHeight);
  for (let i = 0; i < 120; i++) {
    stepCrash(m, b, 1 / 120, terrainHeight);
    for (const point of points) {
      const r = rotateCrashPoint(b.orientation, point);
      assert.ok(
        m.altitude + r.y >= terrainHeight(m.distance + r.x, r.z) - 0.005,
      );
    }
  }
});
function energy(m: CrashMotion, b: CrashBody): number {
  const q = b.orientation;
  const w = rotateCrashPoint(
    { x: -q.x, y: -q.y, z: -q.z, w: q.w },
    b.angularVelocity,
  );
  return (
    (m.horizontalSpeed ** 2 +
      m.velocity ** 2 +
      b.inertia.x * w.x ** 2 +
      b.inertia.y * w.y ** 2 +
      b.inertia.z * w.z ** 2) /
    2
  );
}
test("center-of-mass impact rebounds with configured restitution 0.4 to 0.6", () => {
  for (const restitution of [0.4, 0.5, 0.6]) {
    const m = motion(),
      b = createCrashBody(0, [{ x: 0, y: 0, z: 0 }]);
    resolveCrashContacts(m, b, flat, { ...material, restitution });
    close(m.velocity, 4 * restitution);
    assert.deepEqual(b.angularVelocity, { x: 0, y: 0, z: 0 });
  }
});
test("nose and wing impacts transfer impulse into pitch and roll with correct signs", () => {
  for (const point of [
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
  ]) {
    const m = motion(),
      b = createCrashBody(0, [point]);
    resolveCrashContacts(m, b, flat, material);
    if (point.x)
      assert.ok(b.angularVelocity.z > 0, "nose upward impulse pitches nose up");
    if (point.z)
      assert.ok(
        b.angularVelocity.x < 0,
        "right wing upward impulse rolls it up",
      );
    const v = point.x
      ? m.velocity + b.angularVelocity.z
      : m.velocity - b.angularVelocity.x;
    close(v, 2);
    assert.ok(energy(m, b) < 8);
  }
});
test("friction dissipates energy and never reverses the center contact tangent", () => {
  const m = { ...motion(), horizontalSpeed: 5 },
    b = createCrashBody(0, [{ x: 0, y: 0, z: 0 }]);
  const before = energy(m, b);
  resolveCrashContacts(m, b, flat, { ...material, friction: 0.55 });
  assert.ok(m.horizontalSpeed >= 0 && m.horizontalSpeed < 5);
  assert.ok(energy(m, b) < before);
});
test("airborne crash drag gives exponential linear and angular decay while gravity falls", () => {
  const m = { ...motion(), altitude: 100, horizontalSpeed: 7, velocity: 0 };
  const b = createCrashBody(0, cessnaCrashContacts);
  b.angularVelocity = { x: 1, y: 2, z: 3 };
  stepCrash(m, b, 1, flat);
  close(m.horizontalSpeed, 7 * Math.exp(-defaultCrashMaterial.linearDrag));
  close(b.angularVelocity.z, 3 * Math.exp(-defaultCrashMaterial.angularDrag));
  assert.ok(m.altitude < 100 && m.velocity < 0);
  const q = b.orientation;
  close(Math.hypot(q.x, q.y, q.z, q.w), 1);
});
test("low-speed impacts settle without restitution bounce", () => {
  const m = { ...motion(), velocity: -0.4 },
    b = createCrashBody(0, [{ x: 0, y: 0, z: 0 }]);
  resolveCrashContacts(m, b, flat, material);
  close(m.velocity, 0);
});
test("rotating hull stays finite and nonpenetrating through repeated terrain contacts", () => {
  const terrain = (x: number, z = 0) => 0.1 * Math.sin(x) + 0.15 * z;
  const m = { ...motion(), altitude: 0.6, horizontalSpeed: 7 };
  const b = createCrashBody(-0.6, cessnaCrashContacts);
  b.angularVelocity = { x: 2, y: 0.5, z: -2 };
  const startEnergy = energy(m, b);
  for (let i = 0; i < 360; i++) {
    stepCrash(m, b, 1 / 120, terrain);
    assert.ok(Object.values(m).every(Number.isFinite));
    assert.ok(Object.values(b.angularVelocity).every(Number.isFinite));
    for (const point of b.contacts) {
      const r = rotateCrashPoint(b.orientation, point);
      assert.ok(m.altitude + r.y >= terrain(m.distance + r.x, r.z) - 1e-8);
    }
  }
  assert.ok(
    energy(m, b) < startEnergy * 0.03,
    "wreck loses most motion during settling",
  );
  assert.ok(Math.abs(m.horizontalSpeed) < 0.4);
});
test("crash trajectory agrees at 30 and 120 caller frames per second", () => {
  const simulate = (fps: number) => {
    const m = { ...motion(), altitude: 1, horizontalSpeed: 7 },
      b = createCrashBody(-0.3, cessnaCrashContacts);
    for (let i = 0; i < fps * 2; i++) stepCrash(m, b, 1 / fps, flat);
    return { m, b };
  };
  assert.deepEqual(simulate(30), simulate(120));
});
test("inclined and lateral ground normals deflect translation and impart torque", () => {
  const m = motion(),
    b = createCrashBody(0, [{ x: 1, y: 0, z: 1 }]);
  resolveCrashContacts(m, b, (x, z = 0) => 0.2 * x + 0.3 * z, material);
  assert.ok(m.horizontalSpeed < 0);
  assert.ok(b.angularVelocity.x < 0);
  assert.ok(b.angularVelocity.z > 0);
  assert.ok(energy(m, b) <= 8);
});
test("simultaneous off-center contacts dissipate kinetic energy for arbitrary orientations", () => {
  for (let i = 0; i < 40; i++) {
    const m = {
      distance: i / 5,
      altitude: -2,
      horizontalSpeed: 8 * Math.cos(i),
      velocity: -2 - Math.abs(Math.sin(i)) * 6,
    };
    const b = createCrashBody(i / 7, cessnaCrashContacts);
    const a = i / 11;
    b.orientation = { x: Math.sin(a), y: 0, z: 0, w: Math.cos(a) };
    b.angularVelocity = {
      x: Math.sin(i) * 3,
      y: Math.cos(i) * 2,
      z: Math.sin(i / 2) * 4,
    };
    const before = energy(m, b);
    resolveCrashContacts(m, b, flat, defaultCrashMaterial);
    assert.ok(
      energy(m, b) <= before + 1e-8,
      `contact energy increased at case ${i}`,
    );
  }
});
