import "./style.css";
import { GameScene } from "./scene";
import { terrainHeight } from "./terrain";
import { createFlightState, stepFlight, defaultFlightConfig } from "./physics";
import { FlightInput } from "./input";
import { EngineAudio } from "./audio";

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const view = new GameScene(canvas),
  audio = new EngineAudio();
const input = new FlightInput(canvas, () => audio.unlock());
const config = {
  ...defaultFlightConfig,
  contactPoints: view.aircraft.contactPoints,
  crashContactPoints: view.aircraft.crashContactPoints,
};
const state = createFlightState(terrainHeight(0), config);
let last = performance.now(),
  accumulator = 0;
const STEP = 1 / 120;
document.addEventListener("visibilitychange", () => {
  audio.setPaused(document.hidden);
  input.reset();
  last = performance.now();
  accumulator = 0;
});
function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (!document.hidden) {
    accumulator += dt;
    while (accumulator >= STEP) {
      stepFlight(state, input.value, STEP, terrainHeight, config);
      accumulator -= STEP;
    }
    audio.update(
      input.value,
      state.phase === "crashed",
      state.phase !== "flying",
      state.horizontalSpeed,
    );
    view.render(
      state.distance,
      state.altitude,
      state.pitch,
      state.phase,
      state.crashTime,
      dt,
      state.horizontalSpeed,
      state.crashBody?.orientation,
    );
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
