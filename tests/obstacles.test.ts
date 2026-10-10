import { test } from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { obstacleConfig, obstacleKinds, obstaclesAround } from "../src/obstacles";
import { ObstaclesView } from "../src/obstacles-view";
import { getAirport } from "../src/airports";
const terrain = (x: number) => Math.sin(x * 0.07) * 1.5;

test("obstacles occupy ordered altitude bands and move with their configured velocity", () => {
  const flat = () => 0;
  const first = obstaclesAround(0, 0, flat);
  for (const kind of obstacleKinds) {
    const group = first.filter(obstacle => obstacle.kind === kind);
    assert.ok(group.length > 0);
    for (const obstacle of group) {
      const config = obstacleConfig[kind];
      const height = kind === "building" ? obstacle.halfSize.y * 2 : obstacle.y;
      assert.ok(height >= config.minHeight && height <= config.maxHeight);
      const later = obstaclesAround(0, 1, flat).find(other => other.id === obstacle.id);
      if (later) assert.ok(Math.abs(later.x - obstacle.x - config.velocityX) < 1e-8);
    }
  }
  assert.ok(obstacleConfig.building.maxHeight < obstacleConfig.bird.minHeight);
  assert.ok(obstacleConfig.bird.maxHeight < obstacleConfig.satellite.minHeight);
  assert.ok(obstacleConfig.satellite.maxHeight < obstacleConfig.ufo.minHeight);
});

test("signed travel is deterministic and returning to a cell restores descriptors", () => {
  const initial = obstaclesAround(-510, 40, terrain);
  obstaclesAround(50000, 10000, terrain);
  assert.deepEqual(obstaclesAround(-510, 40, terrain), initial);
  for (const distance of [-50000, -200, 0, 200, 50000]) {
    const objects = obstaclesAround(distance, 10000, terrain);
    assert.equal(new Set(objects.map(object => object.id)).size, objects.length);
    for (const object of objects) {
      assert.ok(Math.abs(object.x - distance) < obstacleConfig[object.kind].spacing * 3.7);
      assert.ok(Number.isFinite(object.y));
    }
  }
});

test("buildings leave each runway and its approaches clear", () => {
  for (let id = 0; id < 100; id++) {
    const airport = getAirport(id);
    const buildings = obstaclesAround((airport.start + airport.end) / 2, 0, terrain).filter(object => object.kind === "building");
    for (const building of buildings) {
      assert.ok(building.x + building.halfSize.x < airport.start - 30 || building.x - building.halfSize.x > airport.end + 30);
    }
  }
});

test("long flights retain a bounded descriptor count and reuse every rendered object", () => {
  const view = new ObstaclesView();
  const resources: T.Object3D[] = [];
  view.group.traverse(object => resources.push(object));
  assert.equal(view.group.children.length, 126);
  for (let i = 0; i < 200; i++) {
    const distance = Math.sin(i) * i * 700;
    const descriptors = obstaclesAround(distance, i * 100, terrain);
    assert.ok(descriptors.length <= 126);
    view.update(distance, i * 100, terrain);
    const after: T.Object3D[] = [];
    view.group.traverse(object => after.push(object));
    assert.deepEqual(after, resources);
  }
});

test("shared collision boxes enclose model geometry and complete bird wing animation", () => {
  const view = new ObstaclesView();
  for (let frame = 0; frame < 24; frame++) {
    const time = frame * Math.PI / 108;
    view.update(-100, time, terrain);
    view.group.updateMatrixWorld(true);
    const descriptors = obstaclesAround(-100, time, terrain);
    for (const model of view.group.children) {
      if (!model.visible) continue;
      const obstacle = descriptors.find(object => object.id === model.userData.id)!;
      const bounds = new T.Box3().setFromObject(model, true);
      const center = new T.Vector3(obstacle.x + 100, obstacle.y, obstacle.z);
      for (const axis of ["x", "y", "z"] as const) {
        assert.ok(bounds.min[axis] >= center[axis] - obstacle.halfSize[axis] - 1e-6, `${obstacle.kind} min ${axis}`);
        assert.ok(bounds.max[axis] <= center[axis] + obstacle.halfSize[axis] + 1e-6, `${obstacle.kind} max ${axis}`);
      }
    }
  }
});

test("cities contain dense multi-row clusters with distinct buildings", () => {
 const buildings=obstaclesAround(-1000,0,()=>0).filter(o=>o.kind==='building');
 const cluster=buildings.filter(o=>o.id.startsWith(buildings[0].id.split(':').slice(0,2).join(':')+':'));
 assert.equal(cluster.length,12);
 assert.equal(new Set(cluster.map(o=>o.z)).size,3);
 const styles=cluster.map(o=>JSON.stringify([o.halfSize,o.buildingStyle]));
 assert.equal(new Set(styles).size,12);
 assert.ok(new Set(cluster.map(o=>o.buildingStyle!.color)).size>=3);
 assert.ok(Math.max(...cluster.map(o=>o.x))-Math.min(...cluster.map(o=>o.x))<24);
});

 test("birds travel in compact seven-member flocks with smaller collision bounds", () => {
   const birds = obstaclesAround(-1000, 0, () => 0).filter(o => o.kind === "bird");
   assert.equal(birds.length, 42);
   const flock = birds.filter(o => o.id.startsWith(birds[0].id.split(":").slice(0,2).join(":") + ":"));
   assert.equal(flock.length, 7);
   assert.ok(Math.max(...flock.map(o=>o.x))-Math.min(...flock.map(o=>o.x)) < 5);
   assert.equal(new Set(flock.map(o=>`${o.x}:${o.y}`)).size, 7);
   for (const bird of flock) assert.deepEqual(bird.halfSize, {x:.35,y:.4,z:.55});
 });
