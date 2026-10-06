import { test } from "node:test";
import assert from "node:assert/strict";
import { Landscape, layerHeight, terrainHeight } from "../src/terrain";
import * as T from "three";
test("terrain faces upwards and covers the bottom in both viewport orientations", () => {
  const world = new Landscape();
  world.update(0);
  world.group.updateMatrixWorld(true);
  const mesh = world.group.children[0] as T.Mesh;
  const g = mesh.geometry,
    p = g.getAttribute("position"),
    idx = g.index!;
  const a = new T.Vector3().fromBufferAttribute(p, idx.getX(0));
  const b = new T.Vector3().fromBufferAttribute(p, idx.getX(1));
  const c = new T.Vector3().fromBufferAttribute(p, idx.getX(2));
  assert.ok(b.sub(a).cross(c.sub(a)).y > 0);
  for (const aspect of [1280 / 720, 390 / 844]) {
    const height = aspect < 1 ? 24 : 20;
    const camera = new T.OrthographicCamera(
      (-height * aspect) / 2,
      (height * aspect) / 2,
      height / 2,
      -height / 2,
      0.1,
      180,
    );
    camera.position.set(0, 9.5, 32);
    camera.lookAt(0, 7, 0);
    camera.updateMatrixWorld(true);
    for (const x of [-0.9, 0, 0.9]) {
      const ray = new T.Raycaster();
      ray.setFromCamera(new T.Vector2(x, -0.99), camera);
      assert.ok(ray.intersectObject(world.group, true).length > 0);
    }
  }
});
test("terrain stays continuous at all segment boundaries", () => {
  for (let x = -1000; x < 1000; x += 16)
    for (let layer = 0; layer < 3; layer++)
      assert.ok(
        Math.abs(
          layerHeight(x - 1e-6, 0, layer) - layerHeight(x + 1e-6, 0, layer),
        ) < 1e-5,
      );
});
test("recycling preserves bounded resources and adjoining vertices during long flights", () => {
  const world = new Landscape();
  const count = world.group.children.length;
  for (let distance = 0; distance < 100000; distance += 137) {
    world.update(distance);
    assert.equal(world.group.children.length, count);
  }
  world.update(345);
  for (let layer = 0; layer < 3; layer++) {
    const meshes = world.group.children.slice(
      layer * 8,
      layer * 8 + 8,
    ) as any[];
    for (let i = 0; i < 7; i++) {
      const a = meshes[i].geometry.attributes.position,
        b = meshes[i + 1].geometry.attributes.position;
      for (let z = 0; z <= 8; z++)
        assert.ok(Math.abs(a.getY(24 * 9 + z) - b.getY(z)) < 1e-5);
    }
  }
  assert.ok(Number.isFinite(terrainHeight(1000000)));
});
