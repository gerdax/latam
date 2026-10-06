import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createFlightState,
  stepFlight,
  defaultFlightConfig,
} from "../src/physics";
import { terrainHeight } from "../src/terrain";
import { AltitudeCamera } from "../src/camera-follow";
import { scenarioControl } from "./flight-scenario";
test("high flight returns to a runway landing and stop in both orientations", () => {
  for (const viewportHeight of [20, 24]) {
    const config = { ...defaultFlightConfig, viewportHeight };
    const state = createFlightState(terrainHeight(0)),
      camera = new AltitudeCamera();
    let highest = 0,
      sawGroundDisappear = false,
      sawLanding = false;
    for (let i = 0; i < 120 * 60; i++) {
      stepFlight(
        state,
        scenarioControl(state, config),
        1 / 120,
        terrainHeight,
        config,
      );
      assert.notEqual(
        state.phase,
        "crashed",
        `unexpected crash at ${state.distance},altitude ${state.altitude},pitch ${state.pitch}`,
      );
      highest = Math.max(highest, state.altitude);
      camera.update(state.altitude, 1 / 120);
      if (camera.center - viewportHeight / 2 > 10) sawGroundDisappear = true;
      if (state.phase === "rolling") sawLanding = true;
      if (state.phase === "parked") break;
    }
    assert.ok(highest > viewportHeight * 2 - 3);
    assert.ok(sawGroundDisappear);
    assert.ok(sawLanding);
    assert.equal(state.phase, "parked");
    camera.update(state.altitude, 2);
    assert.ok(Math.abs(camera.center - 7) < 0.001);
  }
});
