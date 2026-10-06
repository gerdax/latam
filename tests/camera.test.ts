import { test } from "node:test";
import assert from "node:assert/strict";
import { AltitudeCamera, viewportWorldHeight } from "../src/camera-follow";
import { CloudField } from "../src/clouds";
test("camera preserves ground framing and smoothly follows high altitude", () => {
  const camera = new AltitudeCamera();
  camera.update(4, 1);
  assert.equal(camera.center, 7);
  camera.update(40, 1 / 60);
  assert.ok(camera.center > 7 && camera.center < 38);
  for (let i = 0; i < 120; i++) camera.update(40, 1 / 60);
  assert.ok(Math.abs(camera.center - 38) < 0.001);
  const old = camera.center;
  camera.update(9, 1 / 60);
  assert.ok(camera.center < old && camera.center > 7);
  camera.update(9, 10);
  assert.equal(camera.center, 7);
});
test("camera smoothing is independent of frame rate for the same target", () => {
  const simulate = (fps: number) => {
    const camera = new AltitudeCamera();
    for (let i = 0; i < fps; i++) camera.update(40, 1 / fps);
    return camera.center;
  };
  assert.ok(Math.abs(simulate(30) - simulate(120)) < 1e-10);
});
test("camera tracks moving ascent and descent consistently and keeps aircraft in view", () => {
  const simulate = (fps: number) => {
    const camera = new AltitudeCamera();
    for (let i = 1; i <= fps * 3; i++) {
      const altitude = 9 + (10 * i) / fps;
      camera.update(altitude, 1 / fps);
      assert.ok(Math.abs(altitude - camera.center) < 8);
    }
    for (let i = 1; i <= fps * 1.8; i++) {
      const altitude = 39 - (18 * i) / fps;
      camera.update(altitude, 1 / fps);
      assert.ok(Math.abs(altitude - camera.center) < 8);
    }
    return camera.center;
  };
  assert.ok(Math.abs(simulate(30) - simulate(120)) < 0.25);
  assert.equal(viewportWorldHeight(16 / 9), 20);
  assert.equal(viewportWorldHeight(390 / 844), 24);
});
test("cloud pool remains bounded and restores world positions after descending", () => {
  const clouds = new CloudField();
  clouds.update(100, 7);
  const initial = clouds.group.children.map((c) => c.position.clone());
  for (let h = 7; h < 1000; h += 3) clouds.update(100, h);
  assert.equal(clouds.group.children.length, 25);
  clouds.update(100, 7);
  clouds.group.children.forEach((c, i) =>
    assert.ok(c.position.equals(initial[i])),
  );
  clouds.update(100, 46);
  assert.ok(
    clouds.group.children.some((c) => c.position.y > 40 && c.position.y < 60),
  );
});
