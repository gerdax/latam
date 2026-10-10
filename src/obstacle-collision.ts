import { Vector3 } from 'three';
import { ConvexHull } from 'three/addons/math/ConvexHull.js';
import { flightOrientation, type FlightConfig, type FlightState } from './physics';
import { rotateCrashPoint, type Vec3 } from './crash';
import type { Obstacle } from './obstacles';

type Hull = {normals: Vec3[]; edges: Vec3[]; faces: number[][]};
const hulls = new WeakMap<object, Hull>();
const dot = (a:Vec3,b:Vec3) => a.x*b.x+a.y*b.y+a.z*b.z;
const cross = (a:Vec3,b:Vec3):Vec3 => ({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
function uniqueAxis(list:Vec3[],v:Vec3) {
  const length=Math.hypot(v.x,v.y,v.z);
  if(length<1e-8) return;
  const n={x:v.x/length,y:v.y/length,z:v.z/length};
  if(!list.some(a=>Math.abs(dot(a,n))>1-1e-6)) list.push(n);
}
function collisionHull(points: FlightConfig['crashContactPoints']):Hull {
  const cached=hulls.get(points);
  if(cached) return cached;
  const result:Hull={normals:[],edges:[],faces:[]};
  if(points.length>=4) {
    const vertices=points.map(p=>new Vector3(p.x,p.y,p.z));
    const indices=new Map(vertices.map((p,i)=>[p,i]));
    const hull=new ConvexHull().setFromPoints(vertices);
    for(const face of hull.faces) {
      uniqueAxis(result.normals,face.normal);
      const faceIndices:number[]=[];
      let edge=face.edge;
      do {
        const a=edge.head().point,b=edge.tail().point;
        faceIndices.push(indices.get(a)!);
        uniqueAxis(result.edges,{x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
        edge=edge.next;
      } while(edge!==face.edge);
      result.faces.push(faceIndices);
    }
  }
  hulls.set(points,result);
  return result;
}
export interface ObstacleHit {
  obstacle:Obstacle;
  normal:Vec3;
  contact:Vec3;
  penetration:number;
}
/** SAT tests the rotated aircraft hull against each visible obstacle's box. */
export function findObstacleCollision(state:FlightState, config:Readonly<FlightConfig>, obstacles:ReadonlyArray<Obstacle>, terrain?: (x:number,z?:number)=>number):ObstacleHit|null {
  const orientation=state.crashBody?.orientation ?? flightOrientation(state);
  const points=config.crashContactPoints.map(p=>rotateCrashPoint(orientation,p));
  if(!points.length) return null;
  const min={x:Infinity,y:Infinity,z:Infinity},max={x:-Infinity,y:-Infinity,z:-Infinity};
  for(const p of points) for(const axis of ['x','y','z'] as const) {
    min[axis]=Math.min(min[axis],p[axis]);max[axis]=Math.max(max[axis],p[axis]);
  }
  const hull=collisionHull(config.crashContactPoints);
  for(const obstacle of obstacles) {
    const center={x:obstacle.x-state.distance,y:obstacle.y-state.altitude,z:obstacle.z};
    const half=obstacle.halfSize;
    if(['x','y','z'].some(a=>{const k=a as keyof Vec3;return max[k]<center[k]-half[k] || min[k]>center[k]+half[k];})) continue;
    const axes:Vec3[]=[{x:1,y:0,z:0},{x:0,y:1,z:0},{x:0,y:0,z:1},...hull.normals.map(n=>rotateCrashPoint(orientation,n))];
    for(const edge of hull.edges) {
      const e=rotateCrashPoint(orientation,edge);
      for(const axis of axes.slice(0,3)) uniqueAxis(axes,cross(e,axis));
    }
    let separated=false;
    for(const axis of axes) {
      let lo=Infinity,hi=-Infinity;
      for(const p of points) {const d=dot(p,axis);lo=Math.min(lo,d);hi=Math.max(hi,d);}
      const c=dot(center,axis),radius=Math.abs(axis.x)*half.x+Math.abs(axis.y)*half.y+Math.abs(axis.z)*half.z;
      if(hi<c-radius || lo>c+radius) {separated=true;break;}
    }
    if(separated) continue;
    // Translation is restricted to the flight lane; resolve along its X/Y axes.
    const sx=center.x>0?-1:1,sy=center.y>0?-1:1;
    const px=sx<0?max.x-center.x+half.x:center.x+half.x-min.x;
    const py=sy<0?max.y-center.y+half.y:center.y+half.y-min.y;
    let normal:Vec3=px<py?{x:sx,y:0,z:0}:{x:0,y:sy,z:0};
    let penetration=Math.min(px,py);
    if (normal.y < 0 && terrain && points.some(p => state.altitude - penetration + p.y < terrain(state.distance+p.x,p.z))) {
      // A building embedded in the ground has no exit through its underside.
      normal={x:sx,y:0,z:0};
      penetration=px;
    }
    // Clip hull surfaces to the obstacle so an off-center hit applies torque
    // at the actual contact region, rather than at an unrelated nose/wing tip.
    const contacts:Vec3[]=[];
    for(const face of hull.faces) {
      let polygon=face.map(index=>points[index]);
      for(const axis of ['x','y','z'] as const) for(const side of [-1,1]) {
        const boundary=center[axis]+side*half[axis];
        const clipped:Vec3[]=[];
        for(let i=0;i<polygon.length;i++) {
          const a=polygon[i],b=polygon[(i+1)%polygon.length];
          const da=(a[axis]-boundary)*side,db=(b[axis]-boundary)*side;
          if(da<=1e-9) clipped.push(a);
          if((da<0 && db>0) || (da>0 && db<0)) {
            const t=da/(da-db);
            clipped.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
          }
        }
        polygon=clipped;
      }
      contacts.push(...polygon);
    }
    let contact:Vec3;
    if(contacts.length) {
      let support=Infinity;
      for(const p of contacts) support=Math.min(support,dot(p,normal));
      const face=contacts.filter(p=>dot(p,normal)<support+0.025);
      contact=face.reduce((a,p)=>({x:a.x+p.x/face.length,y:a.y+p.y/face.length,z:a.z+p.z/face.length}),{x:0,y:0,z:0});
    } else {
      // The entire small obstacle can be inside the convex aircraft envelope.
      contact={x:center.x,y:center.y,z:center.z};
    }
    return {obstacle,normal,contact,penetration};
  }
  return null;
}
