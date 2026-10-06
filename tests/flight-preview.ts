import "../src/style.css";
import { GameScene } from "../src/scene";
import {
  createFlightState,
  stepFlight,
  defaultFlightConfig,
} from "../src/physics";
import { terrainHeight } from "../src/terrain";
import { scenarioControl } from "./flight-scenario";
const canvas = document.querySelector<HTMLCanvasElement>("canvas")!;
const view = new GameScene(canvas);
const state = createFlightState(terrainHeight(0));
const config = { ...defaultFlightConfig, viewportHeight: view.viewportHeight };
const sample = Number(new URLSearchParams(location.search).get("time") ?? "5");
for (let t = 0; t < sample; t += 1 / 120) {
  stepFlight(
    state,
    scenarioControl(state, config),
    1 / 120,
    terrainHeight,
    config,
  );
  view.altitudeCamera.update(state.altitude, 1 / 120);
}
view.render(
  state.distance,
  state.altitude,
  state.pitch,
  state.phase,
  state.crashTime,
  0,
  state.horizontalSpeed,
  state.crashBody?.orientation,
);
canvas.dataset.phase = state.phase;
canvas.dataset.altitude = String(state.altitude);
canvas.dataset.camera = String(view.altitudeCamera.center);
