import { test } from "node:test";
import assert from "node:assert/strict";
import { airportAt, getAirport, airportConfig } from "../src/airports";
import { terrainHeight } from "../src/terrain";
import { AirportsView } from "../src/airports-view";
import { AirportHangars } from "../src/hangars";
import { Box3 } from "three";
test("hangar occupants vary predictably and stay clear of the runway", () => {
  const hangars = new AirportHangars();
  const expected = ["transport", "passenger", "military", null];
  for (let id = 0; id < 8; id++) {
    hangars.update(id);
    hangars.group.updateMatrixWorld(true);
    const planes = hangars.group.children.filter(
      (c) => c.userData.kind && c.visible,
    );
    assert.equal(planes[0]?.userData.kind ?? null, expected[id % 4]);
    assert.equal(planes.length, id % 4 === 3 ? 0 : 1);
    for (const plane of planes) {
      const bounds = new Box3().setFromObject(plane);
      assert.ok(bounds.max.z < -airportConfig.width / 2);
      assert.ok(bounds.min.x > 0 && bounds.max.x < airportConfig.length);
    }
  }
  hangars.update(0);
  assert.equal(
    hangars.group.children.find((c) => c.visible && c.userData.kind)?.userData
      .kind,
    "transport",
  );
});
test("runways share their exact ground elevation with terrain across their width", () => {
  for (let id = 0; id < 50; id++) {
    const a = getAirport(id);
    for (let x = a.start; x <= a.end; x += 0.5)
      for (const z of [-3.5, 0, 3.5])
        assert.equal(terrainHeight(x, z), a.elevation);
    assert.equal(airportAt(a.start)?.id, id);
    assert.equal(airportAt(a.end)?.id, id);
    assert.equal(airportAt(a.end + 0.1), null);
  }
});
test("airport transitions join natural terrain without height jumps", () => {
  for (let id = 0; id < 5; id++) {
    const a = getAirport(id);
    for (const x of [
      a.start - airportConfig.transition,
      a.start,
      a.end,
      a.end + airportConfig.transition,
    ])
      assert.ok(
        Math.abs(terrainHeight(x - 1e-6) - terrainHeight(x + 1e-6)) < 1e-5,
      );
  }
});
test("airport scenery reuses a bounded pool during infinite travel", () => {
  const view = new AirportsView();
  const count = view.group.children.reduce((n, g) => n + g.children.length, 0);
  for (let distance = 0; distance < 100000; distance += 195) {
    view.update(distance, 0);
    assert.equal(view.group.children.length, 3);
    assert.equal(
      view.group.children.reduce((n, g) => n + g.children.length, 0),
      count,
    );
  }
});

test("backtracking restores airport positions without adding objects", () => {
  const view = new AirportsView();
  view.update(120, 0);
  const initial = view.group.children.map(g => g.position.clone());
  for (const distance of [10000, 300, -50, -10000, 120]) view.update(distance, 0);
  assert.equal(view.group.children.length, 3);
  view.group.children.forEach((g,i) => assert.ok(g.position.equals(initial[i])));
});

test('hangar aircraft match playable world dimensions and rest on the apron', async () => {
  const {createAircraft} = await import('../src/fleet');
  const {Vector3} = await import('three');
  const hangars = new AirportHangars();
  for (const [id,kind] of ['transport','passenger','military'].entries()) {
    hangars.update(id);
    const parked = hangars.group.children.find(c => c.userData.kind === kind)!;
    const playable = createAircraft(kind as 'transport'|'passenger'|'military');
    playable.group.scale.setScalar(playable.scale);
    const bounds = new Box3().setFromObject(parked);
    const parkedSize = bounds.getSize(new Vector3());
    const flightSize = new Box3().setFromObject(playable.group).getSize(new Vector3());
    assert.ok(parkedSize.distanceTo(flightSize) < 1e-8, kind);
    assert.ok(Math.abs(bounds.min.y) < 1e-8, kind);
  }
});
