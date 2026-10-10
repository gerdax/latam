import test from 'node:test';
import assert from 'node:assert/strict';
import {createAircraft, aircraftOptions} from '../src/fleet';
import {createFlightState,defaultFlightConfig,flightOrientation} from '../src/physics';
import {findObstacleCollision} from '../src/obstacle-collision';
import {FlightSession} from '../src/flight-session';
import {rotateCrashPoint,applyObstacleImpact,createCrashBody} from '../src/crash';
import type {Obstacle} from '../src/obstacles';
const flat=()=>-100;
const obstacle=(x:number,y:number,kind:Obstacle['kind']='bird'):Obstacle=>({id:'test',kind,x,y,z:0,halfSize:{x:.7,y:.65,z:1.1},velocityX:-2});

test('aircraft hull detects all four obstacle kinds and ignores nearby clear paths',()=>{
 for(const option of aircraftOptions) {
  const model=createAircraft(option.id);
  const config={...defaultFlightConfig,crashContactPoints:model.crashContactPoints};
  const state=createFlightState(-100,config);state.altitude=20;
  for(const kind of ['building','bird','satellite','ufo'] as const) {
   const hit=findObstacleCollision(state,config,[obstacle(0,20,kind)]);
   assert.ok(hit,option.id+kind);
   assert.ok(Number.isFinite(hit.penetration));
  }
  assert.equal(findObstacleCollision(state,config,[obstacle(8,20)]),null);
  assert.equal(findObstacleCollision(state,config,[obstacle(0,28)]),null);
 }
});

test('rolled wings participate in spatial obstacle collisions',()=>{
 const state=createFlightState(-100);state.altitude=20;state.roll=Math.PI/2;
 const point=defaultFlightConfig.crashContactPoints.map(p=>rotateCrashPoint(flightOrientation(state),p)).sort((a,b)=>b.y-a.y)[0];
 const hit=obstacle(state.distance+point.x,state.altitude+point.y);
 hit.z=point.z;hit.halfSize={x:.08,y:.08,z:.08};
 assert.ok(findObstacleCollision(state,defaultFlightConfig,[hit]));
 state.roll=0;
 assert.equal(findObstacleCollision(state,defaultFlightConfig,[hit]),null);
});

test('obstacle impact uses existing crash, smoke phase and paused reset path',()=>{
 const session=new FlightSession({...defaultFlightConfig},flat,()=>[obstacle(2.7,20,'ufo')]);
 session.select(createAircraft('cessna'));
 Object.assign(session.state,{phase:'flying',distance:0,altitude:20,horizontalSpeed:11,velocity:0});
 session.step(0,.4);
 assert.equal(session.state.phase,'crashed');
 assert.ok(session.state.crashBody);
 assert.ok(Math.hypot(...Object.values(session.state.crashBody.angularVelocity))>0);
 const time=session.elapsed;
 session.step(0,5);
 assert.equal(session.waiting,true);
 session.step(1,5);
 assert.ok(session.elapsed>time);
 const paused=session.elapsed;
 session.step(1,5);
 assert.equal(session.elapsed,paused);
});

test('obstacle positions and collisions are consistent at 30 and 120 fps',()=>{
 const run=(fps:number)=>{
  const session=new FlightSession({...defaultFlightConfig},flat,(_distance,time)=>[obstacle(9-2*time,20)]);
  session.select(createAircraft('cessna'));
  Object.assign(session.state,{phase:'flying',distance:0,altitude:20,horizontalSpeed:11,velocity:0});
  for(let i=0;i<fps;i++)session.step(0,1/fps);
  return session;
 };
 const slow=run(30),fast=run(120);
 assert.equal(slow.state.phase,'crashed');
 assert.equal(fast.state.phase,'crashed');
 for(const key of ['distance','altitude','horizontalSpeed','velocity','crashTime'] as const) assert.ok(Math.abs(slow.state[key]-fast.state[key])<1e-8,key);
});

test('wreck remains supported by a building roof instead of falling through it',()=>{
 const building=obstacle(0,10,'building');building.halfSize={x:8,y:5,z:3};building.velocityX=0;
 const session=new FlightSession({...defaultFlightConfig},flat,()=>[building]);
 session.select(createAircraft('cessna'));
 Object.assign(session.state,{phase:'flying',distance:0,altitude:15.6,horizontalSpeed:0,velocity:-2});
 for(let i=0;i<120;i++)session.step(0,1/120);
 assert.equal(session.state.phase,'crashed');
 assert.ok(session.state.altitude>14);
 assert.ok(Number.isFinite(session.state.altitude));
});

test('small off-center nose contacts apply torque inside the actual obstacle region',()=>{
 const torques:number[]=[];
 for(const height of [.35,-.35]) {
  const state=createFlightState(-100);state.altitude=20;
  const object=obstacle(1.1,20+height);
  object.halfSize={x:.14,y:.08,z:.3};object.velocityX=0;
  const hit=findObstacleCollision(state,defaultFlightConfig,[object]);
  assert.ok(hit);
  assert.ok(hit.contact.y>=height-.08-1e-7 && hit.contact.y<=height+.08+1e-7);
  const body=createCrashBody(flightOrientation(state),defaultFlightConfig.crashContactPoints);
  applyObstacleImpact(state,body,hit.contact,hit.normal,0);
  torques.push(body.angularVelocity.z);
 }
 assert.ok(torques[0]*torques[1]<0);
});

test('a crash at a building base cannot push the wreck underneath the terrain',()=>{
 const building=obstacle(0,3,'building');building.halfSize={x:1.52,y:3,z:1.23};building.velocityX=0;
 const terrain=()=>0;
 const session=new FlightSession({...defaultFlightConfig},terrain,()=>[building]);
 session.select(createAircraft('cessna'));
 Object.assign(session.state,{phase:'flying',distance:0,altitude:1,horizontalSpeed:0,velocity:0});
 for(let i=0;i<120;i++) {
  session.step(0,1/120);
  assert.equal(session.state.phase,'crashed');
  for(const point of session.state.crashBody!.contacts) {
   const r=rotateCrashPoint(session.state.crashBody!.orientation,point);
   assert.ok(session.state.altitude+r.y>=-1e-7);
  }
 }
});
