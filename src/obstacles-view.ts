import * as T from "three";
import { obstacleConfig, obstacleKinds, obstaclesAround, type Obstacle, type ObstacleKind, type ObstacleTerrain } from "./obstacles";

interface Model { group: T.Group; animate(time: number): void; configure?(obstacle: Obstacle): void; }
const material = (color: number, emissive = 0) => new T.MeshStandardMaterial({ color, roughness: 0.75, emissive, emissiveIntensity: 0.7 });
function mesh(group: T.Group, geometry: T.BufferGeometry, mat: T.Material, x = 0, y = 0, z = 0): T.Mesh {
  const object = new T.Mesh(geometry, mat); object.position.set(x, y, z); group.add(object); return object;
}
function createModel(kind: ObstacleKind): Model {
  const group = new T.Group();
  if (kind === "building") {
    const paint = material(0xc7a0a0);
    mesh(group, new T.BoxGeometry(.98, .84, .98), paint, 0, -.08);
    mesh(group, new T.BoxGeometry(1, .04, 1), material(0xebd3bf), 0, .36);
    const roofs: T.Mesh[] = [];
    roofs.push(mesh(group, new T.BoxGeometry(1, .1, 1), material(0xebd3bf), 0, .42));
    const pitched = mesh(group, new T.ConeGeometry(.7, .16, 4), material(0xab7e77), 0, .42);
    pitched.rotation.y = Math.PI / 4;
    roofs.push(pitched);
    roofs.push(mesh(group, new T.BoxGeometry(.6, .14, .6), paint, 0, .43));
    roofs.push(mesh(group, new T.CylinderGeometry(.015, .015, .12, 6), material(0x887f99), .2, .44));
    const windowMaterial = material(0xffe3a9, 0x584c23);
    const windows = new T.InstancedMesh(new T.BoxGeometry(.12, .045, .015), windowMaterial, 35);
    const windowTransform = new T.Object3D();
    group.add(windows);
    return {group, animate() {}, configure(obstacle) {
      const style = obstacle.buildingStyle;
      if (!style) return;
      paint.color.setHex(style.color);
      windowMaterial.color.setHex(style.windowColor);
      roofs.forEach((roof,index) => {roof.visible = index === style.roof;});
      windows.count = 7 * style.columns;
      for (let row = 0; row < 7; row++) for (let column = 0; column < style.columns; column++) {
        windowTransform.position.set(-.36 + column * .72 / (style.columns - 1), -.38 + row * .105, .492);
        windowTransform.updateMatrix();
        windows.setMatrixAt(row * style.columns + column, windowTransform.matrix);
      }
      windows.instanceMatrix.needsUpdate = true;
      windows.computeBoundingBox();
      windows.computeBoundingSphere();
    }};
  }
  if (kind === "bird") {
    const feather = material(0x7c8198);
    const body = mesh(group, new T.SphereGeometry(0.25, 10, 8), feather);
    body.scale.set(1.7, 0.7, 0.8);
    mesh(group, new T.SphereGeometry(0.18, 10, 8), feather, -0.35, 0.12);
    const beak = mesh(group, new T.ConeGeometry(0.065, 0.2, 6), material(0xf4c08b), -0.56, 0.12);
    beak.rotation.z = Math.PI / 2;
    const tail = mesh(group, new T.ConeGeometry(0.12, 0.42, 3), feather, 0.45, -0.02);
    tail.rotation.z = -Math.PI / 2;
    const wings: T.Group[] = [];
    for (const side of [-1, 1]) {
      const wing = new T.Group(); wing.position.z = side * 0.1; group.add(wing);
      const feathers = mesh(wing, new T.ConeGeometry(0.26, 0.8, 3), feather, 0.02, 0, side * 0.4);
      feathers.rotation.x = side * Math.PI / 2;
      wings.push(wing);
    }
    return { group, animate(time) { wings.forEach((wing, i) => { wing.rotation.x = Math.sin(time * 9) * (i ? 0.65 : -0.65); }); } };
  }
  if (kind === "satellite") {
    mesh(group, new T.BoxGeometry(0.9, 0.8, 0.8), material(0xddd4c6));
    const panel = material(0x6a96b7), grid = material(0xb4cedb);
    for (const side of [-1, 1]) {
      const solar = new T.Group();
      solar.position.x = side * 1.425;
      solar.rotation.x = 0.85;
      group.add(solar);
      mesh(solar, new T.BoxGeometry(1.45, 0.045, 1.1), panel);
      for (let i = 0; i < 5; i++) mesh(solar, new T.BoxGeometry(0.018, 0.01, 1.1), grid, -0.6 + i * 0.3, 0.03);
      for (const z of [-0.3, 0, 0.3]) mesh(solar, new T.BoxGeometry(1.45, 0.01, 0.018), grid, 0, 0.03, z);
    }
    const dish = mesh(group, new T.ConeGeometry(0.35, 0.2, 12, 1, true), material(0xf0dfcf), 0, 0.54);
    dish.rotation.z = -0.4;
    mesh(group, new T.CylinderGeometry(0.02, 0.02, 0.3, 6), material(0x8c8d9e), 0, 0.67);
    return { group, animate() {} };
  }
  const saucer = mesh(group, new T.SphereGeometry(1.5, 24, 12), material(0xb2a8c6));
  saucer.scale.y = 0.18;
  mesh(group, new T.CylinderGeometry(1.4, 1.15, 0.17, 24), material(0xd4c0ca), 0, -0.1);
  const glass = new T.MeshStandardMaterial({ color: 0xa7ded8, transparent: true, opacity: 0.38, roughness: 0.15, depthWrite: false });
  mesh(group, new T.SphereGeometry(0.65, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), glass, 0, 0.18);
  const alien = mesh(group, new T.SphereGeometry(0.22, 12, 10), material(0x96ba7c), 0, 0.47);
  alien.scale.set(0.9, 1.25, 0.9);
  for (const x of [-0.075, 0.075]) {
    const eye = mesh(group, new T.SphereGeometry(0.055, 8, 6), material(0x51566c), x, 0.5, 0.18);
    eye.scale.set(0.8, 1.4, 0.5);
  }
  const lights: T.Mesh[] = [];
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    lights.push(mesh(group, new T.SphereGeometry(0.07, 8, 6), material(0xffedb2, 0xe0b865), Math.cos(angle) * 1.39, -0.16, Math.sin(angle) * 1.39));
  }
  return { group, animate(time) { lights.forEach((light, i) => { (light.material as T.MeshStandardMaterial).emissiveIntensity = 0.5 + 0.4 * Math.sin(time * 3 + i); }); } };
}

/** A constant pool: no meshes/materials are allocated as world cells change. */
export class ObstaclesView {
  readonly group = new T.Group();
  private readonly pools = new Map<ObstacleKind, Model[]>();
  constructor() {
    for (const kind of obstacleKinds) {
      const pool = Array.from({ length: obstacleConfig[kind].slots }, () => createModel(kind));
      pool.forEach(model => { model.group.userData.kind = kind; this.group.add(model.group); });
      this.pools.set(kind, pool);
    }
  }
  update(distance: number, time: number, terrain: ObstacleTerrain) {
    const obstacles = obstaclesAround(distance, time, terrain);
    for (const kind of obstacleKinds) {
      const descriptors = obstacles.filter(obstacle => obstacle.kind === kind);
      this.pools.get(kind)!.forEach((model, i) => {
        const obstacle = descriptors[i]; model.group.visible = Boolean(obstacle);
        if (!obstacle) return;
        if (model.group.userData.id !== obstacle.id) model.configure?.(obstacle);
        model.group.userData.id = obstacle.id;
        model.group.position.set(obstacle.x - distance, obstacle.y, obstacle.z);
        if (kind === "building") model.group.scale.set(obstacle.halfSize.x * 2, obstacle.halfSize.y * 2, obstacle.halfSize.z * 2);
        else model.group.scale.setScalar(kind === "bird" ? obstacleConfig.bird.scale : 1);
        model.animate(time + (kind === "bird" ? i * .17 : 0));
      });
    }
  }
}
