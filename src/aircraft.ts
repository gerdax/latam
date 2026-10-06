import * as T from "three";
import {
  cessnaContacts,
  cessnaCrashContacts,
  cessnaScale,
} from "./aircraft-config";

export interface Aircraft {
  group: T.Group;
  propeller: T.Group;
  contactPoints: typeof cessnaContacts;
  crashContactPoints: typeof cessnaCrashContacts;
  wheels: T.Mesh[];
  scale: number;
}
export function createCessna(): Aircraft {
  const group = new T.Group();
  group.scale.setScalar(cessnaScale);
  const wheels: T.Mesh[] = [];
  const white = new T.MeshStandardMaterial({
    color: 0xfff5e6,
    roughness: 0.72,
  });
  const red = new T.MeshStandardMaterial({ color: 0xb74741, roughness: 0.65 });
  const glass = new T.MeshStandardMaterial({
    color: 0x607f87,
    roughness: 0.24,
    metalness: 0.15,
  });
  const dark = new T.MeshStandardMaterial({ color: 0x374140, roughness: 0.8 });
  function mesh(
    g: T.BufferGeometry,
    m: T.Material,
    x: number,
    y: number,
    z: number,
    outline = true,
  ) {
    const o = new T.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    group.add(o);
    if (outline) {
      const e = new T.LineSegments(
        new T.EdgesGeometry(g, 32),
        new T.LineBasicMaterial({
          color: 0x584b48,
          transparent: true,
          opacity: 0.55,
        }),
      );
      o.add(e);
    }
    return o;
  }
  function box(
    w: number,
    h: number,
    d: number,
    m: T.Material,
    x: number,
    y: number,
    z: number,
  ) {
    return mesh(new T.BoxGeometry(w, h, d), m, x, y, z);
  }
  const body = mesh(new T.SphereGeometry(1, 16, 10), white, 0, 0, 0);
  body.scale.set(1.38, 0.34, 0.34);
  const tail = mesh(new T.ConeGeometry(0.3, 1.8, 8), white, -1.02, 0.01, 0);
  tail.rotation.z = -Math.PI / 2;
  box(2.3, 0.09, 0.69, red, -0.1, -0.06, 0);
  const cabin = mesh(new T.SphereGeometry(1, 12, 8), white, 0.2, 0.28, 0);
  cabin.scale.set(0.66, 0.37, 0.36);
  box(0.56, 0.3, 0.025, glass, 0.33, 0.32, 0.365);
  box(0.3, 0.28, 0.025, glass, -0.14, 0.32, 0.365);
  box(0.56, 0.3, 0.025, glass, 0.33, 0.32, -0.365);
  box(0.3, 0.28, 0.025, glass, -0.14, 0.32, -0.365);
  const windshield = box(0.025, 0.32, 0.56, glass, 0.72, 0.3, 0);
  windshield.rotation.z = 0.35;
  box(0.65, 0.09, 3.8, white, 0.05, 0.65, 0);
  box(0.16, 0.095, 3.82, red, -0.21, 0.65, 0);
  box(0.55, 0.065, 1.45, white, -1.55, 0.12, 0);
  const fin = box(0.52, 0.68, 0.065, white, -1.53, 0.43, 0);
  fin.rotation.z = 0.2;
  box(0.12, 0.57, 0.073, red, -1.72, 0.43, 0);
  function rod(a: T.Vector3, b: T.Vector3, r: number, m: T.Material) {
    const v = b.clone().sub(a);
    const o = mesh(
      new T.CylinderGeometry(r, r, v.length(), 6),
      m,
      ...(a.clone().add(b).multiplyScalar(0.5).toArray() as [
        number,
        number,
        number,
      ]),
      false,
    );
    o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), v.normalize());
  }
  for (const z of [-1, 1]) {
    rod(
      new T.Vector3(0.2, -0.13, z * 0.25),
      new T.Vector3(0, 0.61, z * 1.35),
      0.025,
      white,
    );
    rod(
      new T.Vector3(-0.3, -0.18, z * 0.22),
      new T.Vector3(-0.4, -0.61, z * 0.5),
      0.035,
      dark,
    );
    const wheel = mesh(
      new T.CylinderGeometry(0.15, 0.15, 0.12, 12),
      dark,
      -0.4,
      -0.64,
      z * 0.5,
    );
    wheel.rotation.x = Math.PI / 2;
    wheels.push(wheel);
    const cover = mesh(
      new T.SphereGeometry(1, 12, 8),
      white,
      -0.38,
      -0.61,
      z * 0.5,
    );
    cover.scale.set(0.22, 0.1, 0.1);
  }
  rod(new T.Vector3(0.95, -0.12, 0), new T.Vector3(1, -0.58, 0), 0.035, dark);
  const wheel = mesh(
    new T.CylinderGeometry(0.12, 0.12, 0.13, 12),
    dark,
    1,
    -0.6,
    0,
  );
  wheel.rotation.x = Math.PI / 2;
  wheels.push(wheel);
  const nose = mesh(new T.ConeGeometry(0.25, 0.34, 12), red, 1.4, 0, 0);
  nose.rotation.z = -Math.PI / 2;
  const propeller = new T.Group();
  propeller.position.set(1.58, 0, 0);
  group.add(propeller);
  const blade = new T.Mesh(new T.BoxGeometry(0.045, 1.3, 0.095), dark);
  propeller.add(blade);
  const disk = new T.Mesh(
    new T.CircleGeometry(0.68, 32),
    new T.MeshBasicMaterial({
      color: 0xe8dcca,
      transparent: true,
      opacity: 0.16,
      side: T.DoubleSide,
      depthWrite: false,
    }),
  );
  disk.rotation.y = Math.PI / 2;
  propeller.add(disk);
  return {
    group,
    propeller,
    contactPoints: cessnaContacts,
    crashContactPoints: cessnaCrashContacts,
    wheels,
    scale: cessnaScale,
  };
}
