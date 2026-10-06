import "./style.css";
import { GameScene } from "./scene";
import { terrainHeight } from "./terrain";
import { defaultFlightConfig } from "./physics";
import { AircraftPicker } from "./aircraft-picker";
import { FlightSession } from "./flight-session";
import type { AircraftKind } from "./fleet";
import { FlightInput } from "./input";
import { EngineAudio } from "./audio";

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const view = new GameScene(canvas),
  audio = new EngineAudio();
const input = new FlightInput(canvas, () => {
  if (!session.waiting) audio.unlock();
});
const config = {
  ...defaultFlightConfig,
  viewportHeight: view.viewportHeight,
  contactPoints: view.aircraft.contactPoints,
  crashContactPoints: view.aircraft.crashContactPoints,
};
const session = new FlightSession(config, terrainHeight);
const state = session.state;
let selected: AircraftKind = "cessna";
const picker = new AircraftPicker((kind) => {
  selected = kind;
  const plane = view.selectAircraft(kind);
  session.select(plane);
  input.reset();
  accumulator = 0;
  last = performance.now();
  view.aircraft.group.visible = true;
  audio.setPaused(false);
  audio.unlock();
});
view.aircraft.group.visible = false;
audio.setPaused(true);
picker.show(selected);
let last = performance.now(),
  accumulator = 0;
const STEP = 1 / 120;
document.addEventListener("visibilitychange", () => {
  audio.setPaused(document.hidden || session.waiting);
  input.reset();
  last = performance.now();
  accumulator = 0;
});
function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (!document.hidden) {
    if (!session.waiting) accumulator += dt;
    while (accumulator >= STEP) {
      config.viewportHeight = view.viewportHeight;
      session.step(input.value, STEP);
      if (session.waiting) {
        accumulator = 0;
        input.reset();
        audio.setPaused(true);
        view.aircraft.group.visible = false;
        picker.show(selected);
        break;
      }
      accumulator -= STEP;
    }
    if (session.waiting && !picker.isOpen) picker.show(selected);
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
      session.waiting ? 0 : dt,
      state.horizontalSpeed,
      state.crashBody?.orientation,
    );
    canvas.dataset.flightStatus = session.waiting ? "selection" : state.phase;
    canvas.dataset.aircraft = selected;
    canvas.dataset.distance = state.distance.toFixed(3);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
