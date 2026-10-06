import { test } from "node:test";
import assert from "node:assert/strict";
import { airportAt, getAirport, airportConfig } from "../src/airports";
import { terrainHeight } from "../src/terrain";
import { AirportsView } from "../src/airports-view";
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
