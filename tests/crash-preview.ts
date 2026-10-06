// Local visual verification fixture. This page is not a production build entry.
import "../src/style.css";
import { GameScene } from "../src/scene";
import {
  createFlightState,
  stepFlight,
  defaultFlightConfig,
} from "../src/physics";
import { terrainHeight } from "../src/terrain";
const canvas = document.querySelector<HTMLCanvasElement>("canvas")!;
const view = new GameScene(canvas);
const state = createFlightState(terrainHeight(0));
state.altitude = terrainHeight(0) + 1.3;
state.velocity = -5.4;
state.pitch = -0.65;
const config = { ...defaultFlightConfig, resetDelay: 10 };
const sample = Number(
  new URLSearchParams(location.search).get("time") ?? ".65",
);
for (let t = 0; t < sample; t += 1 / 120) {
  stepFlight(state, 0, 1 / 120, terrainHeight, config);
  view.render(
    state.distance,
    state.altitude,
    state.pitch,
    state.phase,
    state.crashTime,
    1 / 120,
    state.horizontalSpeed,
    state.crashBody?.orientation,
  );
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
canvas.dataset.orientation = JSON.stringify(state.crashBody?.orientation);
canvas.dataset.motion = JSON.stringify({
  speed: state.horizontalSpeed,
  vertical: state.velocity,
  time: state.crashTime,
});
