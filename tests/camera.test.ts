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

test("cloud parallax reverses cleanly across negative world positions", () => {
  const clouds = new CloudField();
  clouds.update(-123, 24);
  const initial = clouds.group.children.map(c => c.position.clone());
  for (const distance of [5000, 0, -5000, -123]) clouds.update(distance, 24);
  assert.equal(clouds.group.children.length, 25);
  clouds.group.children.forEach((c,i) => assert.ok(c.position.equals(initial[i])));
});
test('camera follows the same loop at 30 and 120 frames per second', async () => {
  const {createFlightState, stepFlight, defaultFlightConfig} = await import('../src/physics');
  const run = (fps: number) => {
    const config = {...defaultFlightConfig, startAltitude:22};
    const state = createFlightState(0, config);
    const camera = new AltitudeCamera();
    camera.center = state.altitude - 2; // Begin after the preceding climb has settled.
    for(let i=0;i<fps*5;i++) {
      stepFlight(state,1,1/fps,()=>0,config);
      camera.update(state.altitude,1/fps);
      assert.ok(Math.abs(state.altitude-camera.center)<8);
    }
    return camera.center;
  };
  assert.ok(Math.abs(run(30)-run(120))<.25);
});

test('horizontal framing subtly follows acceleration and returns to center at steady speed', async () => {
  const {HorizontalCameraLag} = await import('../src/camera-follow');
  const camera = new HorizontalCameraLag();
  assert.equal(camera.update(11, 1/120), 0);
  for(let i=1;i<=120;i++) camera.update(11+4*i/120,1/120);
  assert.ok(camera.fraction>0 && camera.fraction<.04);
  for(let i=0;i<600;i++) camera.update(15,1/120);
  assert.ok(Math.abs(camera.fraction)<1e-6);
  for(let i=1;i<=120;i++) camera.update(15-4*i/120,1/120);
  assert.ok(camera.fraction<0 && camera.fraction>-.04);
  assert.equal(camera.update(100,0),camera.fraction);
  camera.reset();
  assert.equal(camera.update(-11,1/120),0);
});

test('horizontal lag is bounded, reversible and consistent at 30 and 120 fps', async () => {
  const {HorizontalCameraLag} = await import('../src/camera-follow');
  const run=(fps:number)=>{
    const camera=new HorizontalCameraLag();
    camera.update(11,1/fps);
    for(let i=1;i<=fps*2;i++) camera.update(11-12*i/fps,1/fps);
    assert.ok(camera.fraction<0);
    assert.ok(Math.abs(camera.fraction)<=.04);
    return camera.fraction;
  };
  assert.ok(Math.abs(run(30)-run(120))<1e-12);
  const camera=new HorizontalCameraLag();
  camera.update(-11,1/120);
  assert.ok(camera.update(-1e6,1/120)>=-.04);
  assert.ok(camera.update(1e6,1/120)<=.04);
  const before=camera.fraction;
  assert.equal(camera.update(NaN,1/120),before);
});
