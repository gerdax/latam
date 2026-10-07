import * as T from "three";

export type ParkedAircraftKind = "transport" | "passenger" | "military";
/** Shared world scale for the playable and parked versions of each model. */
export const aircraftModelScales = Object.freeze({ transport: 0.5, passenger: 0.48, military: 0.65 });
/** Low-poly model source, used by both flight and decorative hangar aircraft. */
export function createParkedAircraft(kind: ParkedAircraftKind): T.Group {
  const group = new T.Group();
  const paint = new T.MeshStandardMaterial({
    color:
      kind === "military"
        ? 0x75866c
        : kind === "transport"
          ? 0xd5c9ad
          : 0xf0eee1,
    roughness: 0.8,
  });
  const trim = new T.MeshStandardMaterial({
    color:
      kind === "passenger"
        ? 0x597b92
        : kind === "transport"
          ? 0x9b7055
          : 0x52644f,
    roughness: 0.8,
  });
  const glass = new T.MeshStandardMaterial({ color: 0x3f5660, roughness: 0.4 });
  const rubber = new T.MeshStandardMaterial({ color: 0x3e4140, roughness: 1 });
  const mesh = (
    geometry: T.BufferGeometry,
    material: T.Material,
    x: number,
    y: number,
    z: number,
  ) => {
    const object = new T.Mesh(geometry, material);
    object.position.set(x, y, z);
    group.add(object);
    return object;
  };
  const box = (
    w: number,
    h: number,
    d: number,
    material: T.Material,
    x: number,
    y: number,
    z: number,
  ) => mesh(new T.BoxGeometry(w, h, d), material, x, y, z);
  const jet = kind === "military",
    transport = kind === "transport";
  const length = jet ? 3.6 : transport ? 5.4 : 6.1,
    wingSpan = jet ? 3.6 : 4.6,
    belly = jet ? 0.55 : 0.9;
  const fuselage = mesh(new T.SphereGeometry(1, 16, 10), paint, 0, belly, 0);
  fuselage.scale.set(length / 2, jet ? 0.22 : 0.38, jet ? 0.24 : 0.37);
  box(length * 0.72, 0.07, 0.76, trim, 0, belly - 0.03, 0);
  const tail = mesh(
    new T.ConeGeometry(jet ? 0.22 : 0.32, length * 0.32, 8),
    paint,
    -length * 0.34,
    belly,
    0,
  );
  tail.rotation.z = -Math.PI / 2;
  box(
    jet ? 0.75 : 1.0,
    0.09,
    wingSpan,
    paint,
    -0.25,
    belly + (transport ? 0.32 : 0),
    0,
  );
  if (jet) {
    for (const sign of [-1, 1]) {
      const wing = box(1.25, 0.065, 1.35, paint, -0.45, belly, sign * 1.0);
      wing.rotation.y = sign * 0.45;
    }
  }
  box(0.7, 0.06, jet ? 1.3 : 1.85, paint, -length * 0.4, belly + 0.13, 0);
  const fin = box(
    0.7,
    jet ? 0.65 : 0.95,
    0.07,
    paint,
    -length * 0.4,
    belly + 0.48,
    0,
  );
  fin.rotation.z = 0.25;
  box(0.15, jet ? 0.5 : 0.7, 0.08, trim, -length * 0.44, belly + 0.48, 0);
  const canopy = mesh(
    new T.SphereGeometry(1, 12, 8),
    glass,
    length * 0.2,
    belly + 0.2,
    0,
  );
  canopy.scale.set(jet ? 0.55 : 0.48, jet ? 0.19 : 0.2, 0.3);
  if (kind === "passenger")
    for (let x = -1.6; x < 1.6; x += 0.34)
      for (const sign of [-1, 1])
        box(0.13, 0.15, 0.025, glass, x, belly + 0.13, sign * 0.36);
  for (const sign of [-1, 1]) {
    const wheel = mesh(
      new T.CylinderGeometry(jet ? 0.11 : 0.15, jet ? 0.11 : 0.15, 0.13, 10),
      rubber,
      -0.45,
      0.15,
      sign * 0.7,
    );
    wheel.rotation.x = Math.PI / 2;
    wheel.userData.part = "wheel";
    box(0.035, belly - 0.25, 0.035, rubber, -0.45, belly / 2, sign * 0.7);
    if (!jet) {
      const engine = mesh(
        new T.CylinderGeometry(0.18, 0.22, 0.7, 10),
        trim,
        transport ? 0.1 : 0.05,
        belly - 0.1,
        sign * 1.35,
      );
      engine.rotation.z = Math.PI / 2;
      const inlet = mesh(
        new T.CircleGeometry(0.14, 10),
        rubber,
        0.41,
        belly - 0.1,
        sign * 1.35,
      );
      inlet.rotation.y = Math.PI / 2;
      if (transport) {
        const propeller = new T.Group();
        propeller.position.set(0.48, belly - 0.1, sign * 1.35);
        propeller.userData.part = "propeller";
        group.add(propeller);
        for (const [height, depth] of [
          [0.9, 0.065],
          [0.065, 0.9],
        ]) {
          propeller.add(
            new T.Mesh(new T.BoxGeometry(0.035, height, depth), rubber),
          );
        }
      }
    }
  }
  const frontWheel = mesh(
    new T.CylinderGeometry(0.11, 0.11, 0.12, 10),
    rubber,
    length * 0.3,
    0.12,
    0,
  );
  frontWheel.rotation.x = Math.PI / 2;
  frontWheel.userData.part = "wheel";
  box(0.035, belly - 0.3, 0.035, rubber, length * 0.3, belly / 2, 0);
  if (jet) {
    const exhaust = mesh(
      new T.CylinderGeometry(0.16, 0.2, 0.35, 10),
      rubber,
      -length * 0.48,
      belly,
      0,
    );
    exhaust.rotation.z = Math.PI / 2;
  }
  group.userData.kind = kind;
  return group;
}
