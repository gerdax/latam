import * as T from "three";
import {
  createParkedAircraft,
  type ParkedAircraftKind,
} from "./parked-aircraft";

export class AirportHangars {
  readonly group = new T.Group();
  private readonly aircraft: T.Group[] = [];
  private readonly shutter: T.Mesh;
  constructor() {
    const wall = new T.MeshStandardMaterial({ color: 0xe7d9b9, roughness: 1 });
    const roof = new T.MeshStandardMaterial({ color: 0xa96750, roughness: 1 });
    const dark = new T.MeshStandardMaterial({ color: 0x5e6260, roughness: 1 });
    const concrete = new T.MeshStandardMaterial({
      color: 0xa8aa9c,
      roughness: 1,
    });
    const addBox = (
      w: number,
      h: number,
      d: number,
      material: T.Material,
      x: number,
      y: number,
      z: number,
    ) => {
      const m = new T.Mesh(new T.BoxGeometry(w, h, d), material);
      m.position.set(x, y, z);
      this.group.add(m);
      return m;
    };
    addBox(48, 0.12, 5.8, concrete, 34, -0.055, -7);
    for (const [x, width, height] of [
      [23, 9, 3.1],
      [49, 7, 2.7],
    ]) {
      addBox(0.16, height, 5, wall, x - width / 2, height / 2, -6.6);
      addBox(0.16, height, 5, wall, x + width / 2, height / 2, -6.6);
      addBox(width, height, 0.15, dark, x, height / 2, -9.1);
      addBox(width, 0.3, 0.15, wall, x, height - 0.15, -4.1);
      const roofHalf = width / 2 + 0.2;
      for (const sign of [-1, 1]) {
        const panel = addBox(
          roofHalf,
          0.12,
          5.3,
          roof,
          x + (sign * width) / 4,
          height + 0.4,
          -6.6,
        );
        panel.rotation.z = -sign * 0.17;
      }
      for (const edge of [-1, 1])
        addBox(
          0.13,
          height,
          0.18,
          dark,
          x + edge * (width / 2 - 0.15),
          height / 2,
          -4.0,
        );
      if (x === 49) {
        addBox(
          width - 0.5,
          height - 0.3,
          0.13,
          dark,
          x,
          (height - 0.3) / 2,
          -4.03,
        );
        for (let i = 0; i < 6; i++)
          addBox(
            width - 0.55,
            0.018,
            0.018,
            concrete,
            x,
            0.4 + i * 0.35,
            -3.95,
          );
      }
    }
    this.shutter = addBox(8.5, 2.8, 0.13, dark, 23, 1.4, -4.03);
    for (const kind of [
      "transport",
      "passenger",
      "military",
    ] as ParkedAircraftKind[]) {
      const plane = createParkedAircraft(kind);
      plane.position.set(23, 0, -6.5);
      this.group.add(plane);
      this.aircraft.push(plane);
    }
  }
  update(id: number) {
    const variant = id % 4;
    this.shutter.visible = variant === 3;
    this.aircraft.forEach((plane, i) => {
      plane.visible = i === variant;
    });
    this.group.userData.airportId = id;
    this.group.userData.variant = variant;
  }
}
