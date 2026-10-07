import '../src/style.css';
import {GameScene} from '../src/scene';
import {defaultFlightConfig, createFlightState, stepFlight, flightOrientation} from '../src/physics';
import {terrainHeight} from '../src/terrain';
import type {AircraftKind} from '../src/fleet';
const canvas = document.querySelector<HTMLCanvasElement>('canvas')!;
const view = new GameScene(canvas);
const query = new URLSearchParams(location.search);
const aircraft = view.selectAircraft((query.get('plane') ?? 'cessna') as AircraftKind);
const config = {...defaultFlightConfig, viewportHeight:view.viewportHeight, ...{contactPoints:aircraft.contactPoints,crashContactPoints:aircraft.crashContactPoints,groundClearance:aircraft.groundClearance,wheelContactCount:aircraft.wheelContactCount}};
const state = createFlightState(terrainHeight(0), config);
state.altitude = 22;
const duration = Number(query.get('time') ?? '2.8');
const control = Number(query.get('control') ?? '1');
for(let i=0;i<Math.round(duration*120);i++){
  stepFlight(state,control,1/120,terrainHeight,config,query.has('roll') && i===0);
  view.altitudeCamera.update(state.altitude,1/120);
  view.horizontalCamera.update(state.horizontalSpeed,1/120);
}
view.render(state.distance,state.altitude,state.pitch,state.phase,state.crashTime,0,state.horizontalSpeed,state.crashBody?.orientation ?? flightOrientation(state));
canvas.dataset.phase=state.phase;
canvas.dataset.pitch=String(state.pitch);
canvas.dataset.roll=String(state.roll);
canvas.dataset.altitude=String(state.altitude);
canvas.dataset.distance=String(state.distance);
canvas.dataset.airspeed=String(Math.hypot(state.horizontalSpeed,state.velocity));
canvas.dataset.horizontalOffset=String(view.horizontalCamera.fraction);
